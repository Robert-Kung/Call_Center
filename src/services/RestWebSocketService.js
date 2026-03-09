/**
 * RestWebSocketService - 自定義後端 WebSocket 封裝 (Gemini Live 相容協定)
 *
 * 此服務負責:
 * 1. 建立與後端 WebSocket Proxy 的連線（使用 Gemini Live wire protocol）
 * 2. 持續串流麥克風 PCM 音訊 (realtimeInput 格式)
 * 3. 接收並回調 AI 回應 (serverContent PCM chunks + 轉錄)
 * 4. 依靠伺服器端 VAD 自動偵測語音端點
 *
 * 協定格式與 GeminiLiveService 完全相同（後端為 Gemini Live proxy）:
 *   Client → Server:
 *     { setup: { model, generationConfig, systemInstruction } }
 *     { realtimeInput: { mediaChunks: [{ mimeType, data }] } }
 *   Server → Client:
 *     { setupComplete }
 *     { serverContent: { modelTurn, outputTranscription, inputTranscription, turnComplete, interrupted } }
 *     { toolCall: { functionCalls: [{ id, name, args }] } }
 *     { error: { code, message } }
 *
 * 歡迎語:
 *   initialize() 在 setupComplete 後，自動以 clientContent 發送 WELCOME_MESSAGES 觸發語。
 *   後端執行 process_turn → LLM → TTS，回應透過 onAudioChunk/onTranscript/onResponseComplete 接收。
 *
 * 流程:
 *   initialize(scenario) → sendTextMessage(welcome) → startStreaming(mediaStream) → [callback driven] → stopStreaming() → close()
 */

import { REST_WS_CONFIG, GEMINI_SYSTEM_PROMPTS, WELCOME_MESSAGES } from '../config/api';
import { sessionLogger } from './SessionLogger';

class RestWebSocketService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;

    // 音訊/文字緩衝 (累積至 turnComplete)
    this.audioBuffer = [];
    this.textBuffer = '';
    this.outputTranscriptBuffer = '';
    this.inputTranscriptBuffer = '';

    // 串流相關
    this._audioContext = null;
    this._workletNode = null;
    this._mediaStreamSource = null;
    this._isStreaming = false;
    this._actualSampleRate = null;

    // 輸入抑制 (AI 播放音訊時暫停送出麥克風資料，防止回音)
    this._suppressInput = false;
    this._suppressSafetyTimer = null;

    // 串流診斷統計
    this._audioChunksSent = 0;
    this._audioBytesSent = 0;
    this._maxAmpEver = 0;
    this._silentChunks = 0;

    // 事件回調 (由外部注入，通常由 CallContext 設定)
    this.onResponseComplete = null;  // ({ audio, aiText, userText, latency }) => void
    this.onAudioChunk = null;        // (base64Chunk) => void
    this.onTranscript = null;        // ({ type: 'input'|'output', text }) => void
    this.onInterrupted = null;       // () => void
    this.onError = null;             // (error) => void
    this.onConnectionChange = null;  // (status: string) => void
    this.onAnalysis = null;          // (analysisData) => void   (via toolCall)
    this.onTicketCreated = null;     // (ticketData) => void     (via toolCall)
    this.onToolCall = null;          // ({ name, args, id }) => void

    // Promise-based handlers (用於 initialize 握手等待)
    this._messageHandlers = new Map();

    // 回應計時
    this._responseStartTime = null;

    // 歡迎回合旗標：發送 WELCOME_MESSAGES 的那一回合，
    // 後端會把觸發語反送 inputTranscription，需抑制以免出現在對話紀錄
    this._isWelcomeTurn = false;
  }

  // ==================== Public API ====================

  /**
   * 初始化 WebSocket 會話 (連線 + setup 握手)
   * 歡迎語由後端在 setupComplete 後自動推送 (TODO: 待後端確認觸發機制)
   * @param {object} scenario - 場景物件 { id, name, voiceId, ... }
   * @returns {Promise<{ sessionId, audioBase64, aiText, latency }>}
   */
  async initialize(scenario) {
    const startTime = performance.now();

    let wsUrl = REST_WS_CONFIG.wsUrl;
    if (!wsUrl) {
      throw new Error('REST WebSocket URL 未設定。請在 .env 設定 VITE_REST_WS_URL');
    }
    // 支援相對路徑（如 /ws/live），自動對應目前頁面協定（https→wss, http→ws）
    if (wsUrl.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${wsUrl}`;
    }

    // 生成 session ID
    this.sessionId = this._generateSessionId();

    // 建立 WebSocket 連線
    await this._connect(wsUrl);

    // 發送 setup，等待 setupComplete
    const systemPrompt = this._getSystemPrompt(scenario);
    await this._sendSetupMessage(scenario, systemPrompt);

    // 開始 session 記錄
    sessionLogger.startSession(this.sessionId, scenario.id, scenario.name);

    const latency = Math.round(performance.now() - startTime);
    console.log(`[RestWS] ✅ 初始化完成 (${latency}ms)，發送歡迎觸發語...`);

    // 發送 WELCOME_MESSAGES 觸發歡迎語，後端執行 process_turn → LLM → TTS
    // 回應透過 onResponseComplete callback 接收（需在 initialize 前注入 callback）
    // 設旗標：此回合的 inputTranscription 是系統指令，不應顯示在對話中
    this._isWelcomeTurn = true;
    const welcomePrompt = WELCOME_MESSAGES[scenario.id] || '通話開始。請主動問候客戶一次，之後等待客戶說話。';
    this.sendTextMessage(welcomePrompt);
    console.log(`[RestWS] >>> welcome clientContent (scenario: ${scenario.id})`);

    return {
      sessionId: this.sessionId,
      audioBase64: null,
      aiText: '',
      latency: { total: latency, asr: 0, llm: 0, tts: 0 }
    };
  }

  /**
   * 開始持續串流麥克風音訊到後端
   * @param {MediaStream} mediaStream - getUserMedia 取得的音訊串流
   */
  async startStreaming(mediaStream) {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未連線，無法啟動串流');
    }
    if (this._isStreaming) {
      console.warn('[RestWS] 已在串流中');
      return;
    }

    console.log('[RestWS] 開始即時串流...');
    this._isStreaming = true;

    // 建立 AudioContext — 使用瀏覽器預設取樣率，後端負責重採樣
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this._actualSampleRate = this._audioContext.sampleRate;

    console.log(`[RestWS] AudioContext sampleRate: ${this._actualSampleRate}`);

    // 診斷統計歸零
    this._audioChunksSent = 0;
    this._audioBytesSent = 0;
    this._maxAmpEver = 0;
    this._silentChunks = 0;

    // 連接麥克風到 ScriptProcessorNode
    this._mediaStreamSource = this._audioContext.createMediaStreamSource(mediaStream);

    const audioTrack = mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      const settings = audioTrack.getSettings();
      console.log('[RestWS] 🎤 麥克風 track:', JSON.stringify({
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
      }));
    }

    // 載入 AudioWorklet 模組（獨立執行緒，不阻塞主執行緒）
    // resampleTo: 16000 — 後端 VAD 固定以 16kHz 解析 PCM
    // targetChunkMs: 100ms — 每次送出約 1600 samples @ 16kHz
    const workletUrl = new URL('../worklets/audioProcessor.worklet.js', import.meta.url);
    await this._audioContext.audioWorklet.addModule(workletUrl);
    this._workletNode = new AudioWorkletNode(this._audioContext, 'audio-processor', {
      processorOptions: {
        targetChunkMs: 100,
        resampleTo: 16000
      }
    });

    // 接收來自 Worklet 的 int16 音訊 chunk（已完成降採樣與 int16 轉換）
    this._workletNode.port.onmessage = (event) => {
      if (!this._isStreaming || this._suppressInput) return;

      const { int16, outputRate, maxAmp } = event.data;

      // 振幅診斷（worklet 端計算後傳回）
      if (maxAmp > this._maxAmpEver) this._maxAmpEver = maxAmp;
      if (maxAmp < 0.001) this._silentChunks++;

      // int16 ArrayBuffer → base64
      const b64 = this._int16BufferToBase64(int16);
      this._sendRealtimeAudio(b64);
      this._audioChunksSent++;
      this._audioBytesSent += int16.byteLength;

      // 首個 chunk 詳細診斷
      if (this._audioChunksSent === 1) {
        console.log('[RestWS] 🎤 首個音訊 chunk (AudioWorklet):', {
          int16Samples: int16.byteLength / 2,
          srcRate: this._actualSampleRate,
          dstRate: outputRate,
          maxAmp: maxAmp.toFixed(6),
          b64Length: b64.length,
        });
      }

      // 每 20 chunks 印統計
      if (this._audioChunksSent % 20 === 0) {
        console.log('[RestWS] 🎤 串流: chunks=%d, bytes=%d, maxAmp=%.4f, maxEver=%.4f, silent=%d',
          this._audioChunksSent, this._audioBytesSent, maxAmp, this._maxAmpEver, this._silentChunks);
      }
    };

    // 連接 audio pipeline（WorkletNode 不需接到 destination）
    this._mediaStreamSource.connect(this._workletNode);

    console.log('[RestWS] ✅ 音訊串流已啟動 (AudioWorklet, srcRate=%d, dstRate=16000, chunk=100ms)',
      this._actualSampleRate);
  }

  /**
   * 發送文字訊息到後端 (clientContent 格式)
   * 可用於：觸發歡迎語、傳遞系統指令、文字輸入測試
   * @param {string} text - 文字內容
   * @param {string} [role='user'] - 角色 ('user' | 'system')
   */
  sendTextMessage(text, role = 'user') {
    if (!this.isConnected || !this.ws) {
      console.warn('[RestWS] sendTextMessage 失敗：WebSocket 未連線');
      return;
    }
    const message = {
      clientContent: {
        turns: [{ role, parts: [{ text }] }],
        turnComplete: true
      }
    };
    console.log(`[RestWS] >>> clientContent (role=${role}): ${text.substring(0, 60)}...`);
    sessionLogger.log('client_text', { role, text: text.substring(0, 200) });
    this._sendMessage(message);
  }

  /**
   * 停止麥克風串流 (但保持 WebSocket 連線)
   */
  stopStreaming() {
    if (!this._isStreaming) return;

    console.log('[RestWS] 停止串流 (已送 %d chunks, %d bytes, maxAmp=%.4f, silentChunks=%d)',
      this._audioChunksSent, this._audioBytesSent, this._maxAmpEver, this._silentChunks);
    this._isStreaming = false;

    if (this._workletNode) {
      this._workletNode.port.close();
      this._workletNode.disconnect();
      this._workletNode = null;
    }
    if (this._mediaStreamSource) {
      this._mediaStreamSource.disconnect();
      this._mediaStreamSource = null;
    }
    if (this._audioContext && this._audioContext.state !== 'closed') {
      this._audioContext.close();
      this._audioContext = null;
    }
  }

  /**
   * 完整關閉 (停止串流 + 關閉 WebSocket)
   */
  close() {
    this.stopStreaming();

    // 清除 suppress safety timer
    if (this._suppressSafetyTimer) {
      clearTimeout(this._suppressSafetyTimer);
      this._suppressSafetyTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this._resetBuffers();
    this._messageHandlers.clear();
    this._notifyConnectionChange('disconnected');

    sessionLogger.endSession();
    console.log('[RestWS] 服務已關閉');
  }

  /**
   * 回音抑制 — AI 播放音訊時暫停送出麥克風資料
   * @param {boolean} suppress
   */
  setSuppressInput(suppress) {
    this._suppressInput = suppress;
    console.log(`[RestWS] 麥克風輸入${suppress ? '已暫停 (AI 播放中)' : '已恢復'}`);

    // 安全機制：最長抑制 15 秒，避免麥克風永久靜音
    if (suppress) {
      if (this._suppressSafetyTimer) clearTimeout(this._suppressSafetyTimer);
      this._suppressSafetyTimer = setTimeout(() => {
        if (this._suppressInput) {
          console.warn('[RestWS] 強制解除輸入抑制 (超過 15 秒)');
          this._suppressInput = false;
        }
      }, 15000);
    } else {
      if (this._suppressSafetyTimer) {
        clearTimeout(this._suppressSafetyTimer);
        this._suppressSafetyTimer = null;
      }
    }
  }

  /**
   * 取得目前連線狀態
   * @returns {'connecting'|'connected'|'disconnecting'|'disconnected'|'error'}
   */
  getConnectionStatus() {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN:       return 'connected';
      case WebSocket.CLOSING:    return 'disconnecting';
      case WebSocket.CLOSED:     return 'disconnected';
      default:                   return 'unknown';
    }
  }

  /**
   * 是否正在串流
   */
  isCurrentlyStreaming() {
    return this._isStreaming;
  }

  // ==================== Private: WebSocket ====================

  _connect(wsUrl) {
    return new Promise((resolve, reject) => {
      console.log(`[RestWS] 建立連線: ${wsUrl}`);
      this._notifyConnectionChange('connecting');

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'blob';

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[RestWS] ✅ WebSocket 已連線');
        this._notifyConnectionChange('connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[RestWS] ❌ WebSocket 錯誤:', error);
        this.isConnected = false;
        this._notifyConnectionChange('error');
        reject(new Error('WebSocket 連線失敗'));
      };

      this.ws.onclose = (event) => {
        console.log(`[RestWS] 連線已關閉: code=${event.code} reason=${event.reason}`);
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.stopStreaming();
        this._notifyConnectionChange('disconnected');

        // 非預期關閉時通知錯誤
        if (wasConnected && event.code !== 1000) {
          const err = new Error(`WebSocket 已關閉: ${event.code} ${event.reason}`);
          this._rejectHandler('setup', err);
          this.onError?.(err);
        }
      };

      this.ws.onmessage = async (event) => {
        let data = event.data;
        if (data instanceof Blob) {
          data = await data.text();
        } else if (data instanceof ArrayBuffer) {
          data = new TextDecoder().decode(data);
        }
        this._handleMessage(data);
      };

      setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          reject(new Error(`WebSocket 連線超時 (${REST_WS_CONFIG.connection.timeout}ms)`));
        }
      }, REST_WS_CONFIG.connection.timeout);
    });
  }

  // ==================== Private: Messages ====================

  async _sendSetupMessage(scenario, systemPrompt) {
    const voiceId = scenario.voiceId || REST_WS_CONFIG.voice.default;
    // Bug fix: 後端代理以 snake_case 讀取 generation_config / system_instruction，
    // 原先 camelCase 鍵名導致後端查找失敗，系統 Prompt 永遠被忽略。
    const setupMessage = {
      setup: {
        model: `models/${import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025'}`,
        generation_config: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: { voice_name: voiceId }
            }
          },
          thinking_config: { thinking_budget: 0 },
          system_instruction: {
            parts: [{ text: systemPrompt }]
          }
        },
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        output_audio_transcription: {},
        input_audio_transcription: {}
      }
    };
    console.log(`[RestWS] >>> setup (scenario: ${scenario.id}, voice: ${voiceId})`);
    this._sendMessage(setupMessage);
    return this._waitForSetupComplete();
  }

  _sendRealtimeAudio(base64Chunk) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // 後端讀取 mediaChunks 陣列（非 audio 物件），且固定以 16kHz 解析 PCM bytes
    this.ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          data: base64Chunk,
          mimeType: 'audio/pcm;rate=16000'
        }]
      }
    }));
  }

  _sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket 未就緒');
    }
  }

  // ==================== Private: Message Handler ====================

  _handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      console.warn('[RestWS] 無法解析訊息:', data);
      return;
    }

    // Setup 完成
    if (message.setupComplete) {
      console.log('[RestWS] ✅ Setup 完成');
      this._resolveHandler('setup');
      return;
    }

    // Server content
    if (message.serverContent) {
      const content = message.serverContent;

      // 收集音訊 chunks
      if (content.modelTurn?.parts) {
        if (!this._responseStartTime) {
          this._responseStartTime = performance.now();
        }
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            this.audioBuffer.push(part.inlineData.data);
            this.onAudioChunk?.(part.inlineData.data);
          }
          if (part.text) {
            // Bug fix: 後端每次傳送的是累積式全文（非 delta），用 = 覆寫而非 += 累加
            this.textBuffer = part.text;
            // Bug fix: 後端不發送 outputTranscription，改由 modelTurn.parts[].text 觸發即時字幕
            console.log('[RestWS] 🔊 AI (streaming):', part.text);
            sessionLogger.log('output_transcript', { text: part.text });
            this.onTranscript?.({ type: 'output', text: part.text });
          }
        }
      }

      // AI 輸出轉錄（outputTranscription）
      // 注意：此後端代理不發送 outputTranscription，字幕已由上方 modelTurn.parts[].text 處理
      if (content.outputTranscription?.text) {
        this.outputTranscriptBuffer = content.outputTranscription.text;
        console.log('[RestWS] 🔊 AI (transcription):', content.outputTranscription.text);
        sessionLogger.log('output_transcript_explicit', { text: content.outputTranscription.text });
        this.onTranscript?.({ type: 'output', text: content.outputTranscription.text });
      }

      // 使用者輸入轉錄
      // 歡迎回合中後端會把觸發語反送 inputTranscription，跳過以免出現在對話紀錄
      if (content.inputTranscription?.text) {
        if (this._isWelcomeTurn) {
          console.log('[RestWS] 🔇 跳過歡迎回合 inputTranscription:', content.inputTranscription.text.substring(0, 40));
        } else {
          this.inputTranscriptBuffer += content.inputTranscription.text;
          console.log('[RestWS] 🎤 USER:', content.inputTranscription.text);
          sessionLogger.log('input_transcript', { text: content.inputTranscription.text });
          this.onTranscript?.({ type: 'input', text: content.inputTranscription.text });
        }
      }

      // 回合結束
      if (content.turnComplete) {
        // 歡迎回合結束後才開始正常記錄使用者輸入
        this._isWelcomeTurn = false;

        const clientE2E = this._responseStartTime
          ? Math.round(performance.now() - this._responseStartTime)
          : 0;

        // 後端提供分段延遲 { asr_ms, llm_first_ms, tts_total_ms }，映射至前端欄位
        let latency;
        if (content.latency) {
          const { asr_ms = 0, llm_first_ms = 0, tts_total_ms = 0 } = content.latency;
          const total = asr_ms + llm_first_ms + tts_total_ms;
          latency = { asr: asr_ms, llm: llm_first_ms, tts: tts_total_ms, total, e2e: clientE2E };
        } else {
          // 後端未提供時 fallback 至前端計時
          latency = { asr: 0, llm: 0, tts: 0, total: clientE2E, e2e: clientE2E };
        }

        const response = {
          audio:    this._mergeBase64Audio(this.audioBuffer),
          aiText:   this.outputTranscriptBuffer || this.textBuffer,
          userText: this.inputTranscriptBuffer,
          latency
        };

        console.log('[RestWS] ✅ turnComplete (audio chunks: %d, ASR=%dms, LLM=%dms, TTS=%dms, total=%dms)',
          this.audioBuffer.length, latency.asr, latency.llm, latency.tts, latency.total);
        console.log('[RestWS]   👤 USER:', response.userText || '(無)');
        console.log('[RestWS]   🤖 AI:', response.aiText || '(無)');

        sessionLogger.log('turn_complete', {
          userText: response.userText,
          aiText:   response.aiText,
          latency
        });

        // 先嘗試 resolve Promise handler（握手期間使用）
        const handler = this._messageHandlers.get('response');
        if (handler) {
          this._messageHandlers.delete('response');
          handler.resolve(response);
        } else {
          this.onResponseComplete?.(response);
        }

        this._resetBuffers();
      }

      // 被打斷
      if (content.interrupted) {
        console.log('[RestWS] ⚡ interrupted — 清除緩衝');
        sessionLogger.log('interrupted', { bufferedChunks: this.audioBuffer.length });
        this._resetBuffers();
        this.onInterrupted?.();
      }
    }

    // 錯誤
    if (message.error) {
      console.error('[RestWS] ❌ API 錯誤:', JSON.stringify(message.error));
      sessionLogger.log('error', { message: message.error.message, code: message.error.code });
      const err = new Error(message.error.message || 'WebSocket 後端錯誤');
      this._rejectHandler('setup', err);
      this._rejectHandler('response', err);
      this.onError?.(err);
    }

    // Function Calling (toolCall) — 對應 analyze_intent / create_ticket
    if (message.toolCall) {
      const calls = message.toolCall.functionCalls || [];
      console.log('[RestWS] 🔧 toolCall, %d calls', calls.length);
      for (const fc of calls) {
        this._handleFunctionCall(fc);
      }
    }
  }

  // ==================== Private: Function Calling ====================

  _handleFunctionCall({ name, id, args }) {
    console.log('[RestWS] 🔧 Function Call:', name, 'args:', JSON.stringify(args));
    sessionLogger.log('function_call', { name, id, args });

    // analyze_intent — 純 UI side-effect，不送 toolResponse
    if (name === 'analyze_intent') {
      this.onToolCall?.({ name, args, id });
      this.onAnalysis?.({
        intent:     args.intent || '',
        confidence: args.confidence || 0,
        entities:   args.entities || [],
        flags:      args.flags || [],
        flagTypes:  args.flagTypes || []
      });
      console.log('[RestWS] ✓ analyze_intent UI 更新，不送 toolResponse');
      return;
    }

    // create_ticket — 呼叫 callback 並回傳 toolResponse
    let result = { result: 'ok' };
    if (this.onToolCall) {
      try {
        const cbResult = this.onToolCall({ name, args, id });
        if (cbResult && typeof cbResult === 'object') result = cbResult;
      } catch (err) {
        console.error('[RestWS] ✗ onToolCall 錯誤:', err);
        result = { result: 'error', error: err.message };
      }
    }

    if (name === 'create_ticket' && args) {
      this.onTicketCreated?.(args);
    }

    this._sendFunctionResponse(name, id, result);
  }

  _sendFunctionResponse(functionName, callId, result) {
    const message = {
      toolResponse: {
        functionResponses: [{ name: functionName, id: callId, response: result }]
      }
    };
    console.log('[RestWS] >>> toolResponse:', functionName);
    sessionLogger.log('function_response', { name: functionName, id: callId, result });
    this._sendMessage(message);
  }

  // ==================== Private: Helpers ====================

  _resetBuffers() {
    this.audioBuffer = [];
    this.textBuffer = '';
    this.outputTranscriptBuffer = '';
    this.inputTranscriptBuffer = '';
    this._responseStartTime = null;
  }

  /**
   * int16 ArrayBuffer → base64 字串
   * 分塊呼叫 apply 避免大 buffer 造成 call stack overflow
   */
  _int16BufferToBase64(buffer) {
    const uint8 = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < uint8.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  /**
   * 正確合併多個 base64 音訊 chunk。
   * 直接 join() 會把每個 chunk 的 `=` padding 嵌入中間，導致 atob() 拋出
   * "String contains an invalid character" — 必須先 decode 成 bytes，
   * 連接後再重新 encode 成單一 base64 字串。
   */
  _mergeBase64Audio(chunks) {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0];

    // Decode 每個 chunk → Uint8Array（原生 API，避免逐字元迴圈）
    const arrays = chunks.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

    // 合併成單一 buffer
    const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const a of arrays) {
      merged.set(a, offset);
      offset += a.length;
    }

    // 重新 encode 成單一合法 base64
    // 分塊呼叫 apply 避免大 buffer 造成 call stack overflow
    const CHUNK = 0x8000;
    let bin = '';
    for (let i = 0; i < merged.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, merged.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  _notifyConnectionChange(status) {
    this.onConnectionChange?.(status);
  }

  _waitForSetupComplete() {
    return new Promise((resolve, reject) => {
      this._messageHandlers.set('setup', { resolve, reject });
      setTimeout(() => {
        if (this._messageHandlers.has('setup')) {
          this._messageHandlers.delete('setup');
          reject(new Error('Setup 超時'));
        }
      }, REST_WS_CONFIG.connection.timeout);
    });
  }

  _resolveHandler(type, data = null) {
    const handler = this._messageHandlers.get(type);
    if (handler) {
      this._messageHandlers.delete(type);
      handler.resolve(data);
    }
  }

  _rejectHandler(type, error) {
    const handler = this._messageHandlers.get(type);
    if (handler) {
      this._messageHandlers.delete(type);
      handler.reject(error);
    }
  }

  _generateSessionId() {
    const ts  = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 9);
    return `rest-ws-${ts}-${rnd}`;
  }

  _getSystemPrompt(scenario) {
    // 使用針對語音對話優化的 GEMINI_SYSTEM_PROMPTS（含工具使用規則）
    if (GEMINI_SYSTEM_PROMPTS[scenario.id]) return GEMINI_SYSTEM_PROMPTS[scenario.id];
    return `你是${scenario.companyInfo?.name || scenario.name}的AI客服助理。
請用繁體中文、親切專業的語氣回答客戶問題。
回答請簡潔，每次回覆控制在50字以內。`;
  }
}

// 匯出單例
export const restWebSocketService = new RestWebSocketService();
export default RestWebSocketService;
