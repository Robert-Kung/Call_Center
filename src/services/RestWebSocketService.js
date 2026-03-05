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
 *   後端在 setupComplete 後自動推送（TODO: 待後端確認觸發方式）
 *   initialize() 在 setupComplete 後直接返回，歡迎語透過 onAudioChunk/onTranscript callback 接收
 *
 * 流程:
 *   initialize(scenario) → startStreaming(mediaStream) → [callback driven] → stopStreaming() → close()
 */

import { REST_WS_CONFIG, GEMINI_SYSTEM_PROMPTS } from '../config/api';
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
    this._scriptProcessor = null;
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
    console.log(`[RestWS] ✅ 初始化完成 (${latency}ms)，等待後端歡迎語...`);

    // 歡迎語由後端自動推送，透過 onAudioChunk/onTranscript/onResponseComplete 接收
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

    const bufferSize = 4096;
    this._scriptProcessor = this._audioContext.createScriptProcessor(bufferSize, 1, 1);

    this._scriptProcessor.onaudioprocess = (e) => {
      if (!this._isStreaming) return;
      if (this._suppressInput) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // 音量診斷
      let maxAmp = 0;
      for (let i = 0; i < float32.length; i++) {
        const abs = Math.abs(float32[i]);
        if (abs > maxAmp) maxAmp = abs;
      }
      if (maxAmp > this._maxAmpEver) this._maxAmpEver = maxAmp;
      if (maxAmp < 0.001) this._silentChunks++;

      // 降採樣到 16kHz（後端 VAD 固定以 16kHz 計算音訊長度）
      // 使用線性插值，同步執行不阻塞 audio thread
      const TARGET_RATE = 16000;
      let pcmSource = float32;
      if (this._actualSampleRate !== TARGET_RATE) {
        const ratio = this._actualSampleRate / TARGET_RATE;
        const outLen = Math.round(float32.length / ratio);
        pcmSource = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const pos = i * ratio;
          const idx = Math.floor(pos);
          const frac = pos - idx;
          const a = float32[idx] ?? 0;
          const b = float32[Math.min(idx + 1, float32.length - 1)] ?? 0;
          pcmSource[i] = a + frac * (b - a);
        }
      }

      // float32 → int16 PCM
      const int16 = new Int16Array(pcmSource.length);
      for (let i = 0; i < pcmSource.length; i++) {
        const s = Math.max(-1, Math.min(1, pcmSource[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // int16 → base64
      const uint8 = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);

      this._sendRealtimeAudio(b64);
      this._audioChunksSent++;
      this._audioBytesSent += uint8.length;

      // 首個 chunk 詳細診斷
      if (this._audioChunksSent === 1) {
        console.log('[RestWS] 🎤 首個音訊 chunk:', {
          srcSamples: float32.length,
          dstSamples: pcmSource.length,
          srcRate: this._actualSampleRate,
          dstRate: TARGET_RATE,
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

    // 連接 audio pipeline
    this._mediaStreamSource.connect(this._scriptProcessor);
    this._scriptProcessor.connect(this._audioContext.destination);

    console.log('[RestWS] ✅ 音訊串流已啟動 (sampleRate=%d, bufferSize=%d)', this._actualSampleRate, bufferSize);
  }

  /**
   * 停止麥克風串流 (但保持 WebSocket 連線)
   */
  stopStreaming() {
    if (!this._isStreaming) return;

    console.log('[RestWS] 停止串流 (已送 %d chunks, %d bytes, maxAmp=%.4f, silentChunks=%d)',
      this._audioChunksSent, this._audioBytesSent, this._maxAmpEver, this._silentChunks);
    this._isStreaming = false;

    if (this._scriptProcessor) {
      this._scriptProcessor.disconnect();
      this._scriptProcessor = null;
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
    const setupMessage = {
      setup: {
        model: `models/${import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025'}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId }
            }
          },
          thinkingConfig: { thinkingBudget: 0 }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {}
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
            this.textBuffer += part.text;
          }
        }
      }

      // AI 輸出轉錄
      if (content.outputTranscription?.text) {
        this.outputTranscriptBuffer += content.outputTranscription.text;
        console.log('[RestWS] 🔊 AI:', content.outputTranscription.text);
        sessionLogger.log('output_transcript', { text: content.outputTranscription.text });
        this.onTranscript?.({ type: 'output', text: content.outputTranscription.text });
      }

      // 使用者輸入轉錄
      if (content.inputTranscription?.text) {
        this.inputTranscriptBuffer += content.inputTranscription.text;
        console.log('[RestWS] 🎤 USER:', content.inputTranscription.text);
        sessionLogger.log('input_transcript', { text: content.inputTranscription.text });
        this.onTranscript?.({ type: 'input', text: content.inputTranscription.text });
      }

      // 回合結束
      if (content.turnComplete) {
        const latency = this._responseStartTime
          ? Math.round(performance.now() - this._responseStartTime)
          : 0;

        const response = {
          audio:    this.audioBuffer.join(''),
          aiText:   this.outputTranscriptBuffer || this.textBuffer,
          userText: this.inputTranscriptBuffer,
          latency:  { total: latency, e2e: latency }
        };

        console.log('[RestWS] ✅ turnComplete (audio chunks: %d, latency: %dms)', this.audioBuffer.length, latency);
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
