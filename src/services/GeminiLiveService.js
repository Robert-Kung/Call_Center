/**
 * GeminiLiveService - Gemini Live API WebSocket 封裝 (Realtime Streaming 架構)
 *
 * 此服務負責:
 * 1. 建立與 Gemini Live API 的 WebSocket 連線
 * 2. 持續串流麥克風 PCM 音訊 (16kHz mono)
 * 3. 接收並回調 AI 回應 (24kHz PCM + 文字轉錄)
 * 4. 依靠伺服器端 VAD 自動偵測語音端點
 *
 * 流程:
 *   initialize(scenario) → startStreaming(mediaStream) → [callback driven] → stopStreaming() → close()
 */

import { GEMINI_CONFIG, GEMINI_SYSTEM_PROMPTS, WELCOME_MESSAGES, GEMINI_TOOL_DECLARATIONS } from '../config/api';
import { sessionLogger } from './SessionLogger';

class GeminiLiveService {
  constructor(apiKey = GEMINI_CONFIG.apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;

    // Token 使用量追蹤
    this.tokenUsage = { input: 0, output: 0, total: 0 };

    // 音訊緩衝 (累積 turnComplete 前的 chunks)
    this.audioBuffer = [];
    this.textBuffer = '';
    this.outputTranscriptBuffer = '';
    this.inputTranscriptBuffer = '';

    // 串流相關
    this._audioContext = null;
    this._scriptProcessor = null;
    this._mediaStreamSource = null;
    this._isStreaming = false;

    // 輸入抑制 (AI 播放音訊時暫停送出麥克風資料，防止回音)
    this._suppressInput = false;

    // 事件回調 (由外部設定)
    this.onResponseComplete = null;   // ({ audio, aiText, userText, latency, tokenUsage }) => void
    this.onAudioChunk = null;         // (base64AudioChunk) => void  (即時音訊片段)
    this.onTranscript = null;         // ({ type: 'input'|'output', text }) => void
    this.onInterrupted = null;        // () => void
    this.onError = null;              // (error) => void
    this.onConnectionChange = null;   // (status) => void
    this.onToolCall = null;           // ({ name, args }) => void  (Function Calling 回調)

    // Promise-based handler (用於 initialize 的歡迎語)
    this._messageHandlers = new Map();

    // 回應計時
    this._responseStartTime = null;

    // 音訊串流統計
    this._audioChunksSent = 0;
    this._audioBytesSent = 0;
    this._audioStatsInterval = null;
  }

  // ==================== Public API ====================

  /**
   * 初始化 Gemini Live 會話 (連線 + setup + 歡迎語)
   */
  async initialize(scenario) {
    const startTime = performance.now();

    if (!this.apiKey) {
      throw new Error('Gemini API Key 未設定。請在 .env 設定 VITE_GEMINI_API_KEY');
    }

    // 生成 session ID
    this.sessionId = this._generateSessionId();

    // 連線
    await this._connect();

    // 發送 setup
    const systemPrompt = scenario.systemPrompt || GEMINI_SYSTEM_PROMPTS[scenario.id] || this._getDefaultPrompt(scenario);
    await this._sendSetupMessage(systemPrompt);

    // 開始 session 記錄
    sessionLogger.startSession(this.sessionId, scenario.id, scenario.name);

    // 觸發歡迎語 (用 clientContent 文字觸發，因為 setup 後 Gemini 不會自動說話)
    const welcomePrompt = WELCOME_MESSAGES[scenario.id] || '請用你的角色身份跟客戶打招呼';
    console.log('[GeminiLive] 發送歡迎觸發:', welcomePrompt);
    this._sendTextMessage(welcomePrompt);

    // 等待歡迎回應 (這是唯一用 Promise 等的場景)
    const welcomeResponse = await this._waitForResponse(30000);
    console.log('[GeminiLive] 收到歡迎回應:', {
      hasAudio: !!welcomeResponse.audio,
      audioLength: welcomeResponse.audio?.length || 0,
      aiText: (welcomeResponse.outputTranscript || welcomeResponse.text || '').substring(0, 60),
    });

    const latency = Math.round(performance.now() - startTime);

    const welcomeText = welcomeResponse.outputTranscript || welcomeResponse.text || '';
    sessionLogger.log('welcome', {
      aiText: welcomeText,
      audioLength: welcomeResponse.audio?.length || 0,
      latency
    });

    return {
      sessionId: this.sessionId,
      audioBase64: welcomeResponse.audio,
      aiText: welcomeText,
      latency: { total: latency, e2e: latency }
    };
  }

  /**
   * 開始持續串流麥克風音訊到 Gemini
   * @param {MediaStream} mediaStream - getUserMedia 取得的音訊串流
   */
  async startStreaming(mediaStream) {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未連線');
    }
    if (this._isStreaming) {
      console.warn('[GeminiLive] 已在串流中');
      return;
    }

    console.log('[GeminiLive] 開始即時串流...');
    this._isStreaming = true;

    // 建立 AudioContext — 使用瀏覽器預設取樣率
    // 官方文件: "the Live API will resample if needed so any sample rate can be sent"
    // 不做客戶端重採樣，交給 Gemini 伺服器處理
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this._actualSampleRate = this._audioContext.sampleRate;

    console.log('[GeminiLive] AudioContext sampleRate: %d (Gemini 會自動重採樣)', this._actualSampleRate);

    // 連接麥克風到 ScriptProcessor
    this._mediaStreamSource = this._audioContext.createMediaStreamSource(mediaStream);

    // 確認 MediaStream 的 track 設定
    const audioTrack = mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      const settings = audioTrack.getSettings();
      console.log('[GeminiLive] 麥克風 track:', JSON.stringify({
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
      }));
    }

    // ScriptProcessorNode
    const bufferSize = 4096;
    this._scriptProcessor = this._audioContext.createScriptProcessor(bufferSize, 1, 1);

    this._audioChunksSent = 0;
    this._audioBytesSent = 0;
    this._maxAmpEver = 0;
    this._silentChunks = 0;

    this._scriptProcessor.onaudioprocess = (e) => {
      if (!this._isStreaming) return;

      // AI 播放中 → 不送出麥克風音訊 (防止回音)
      if (this._suppressInput) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // 檢查音量
      let maxAmp = 0;
      for (let i = 0; i < float32.length; i++) {
        const abs = Math.abs(float32[i]);
        if (abs > maxAmp) maxAmp = abs;
      }
      if (maxAmp > this._maxAmpEver) this._maxAmpEver = maxAmp;
      if (maxAmp < 0.001) this._silentChunks++;

      // 直接轉為 16-bit PCM（不重採樣，MIME type 帶實際取樣率）
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // 轉為 base64 並送出
      const uint8 = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);
      this._sendRealtimeAudio(b64);

      this._audioChunksSent++;
      this._audioBytesSent += uint8.length;

      // 第一個 chunk — 詳細診斷
      if (this._audioChunksSent === 1) {
        console.log('[GeminiLive] 🎤 首個音訊 chunk:', {
          samples: float32.length,
          maxAmp: maxAmp.toFixed(6),
          b64Length: b64.length,
          pcmBytes: uint8.length,
          sampleRate: this._actualSampleRate,
          mimeType: `audio/pcm;rate=${this._actualSampleRate}`
        });
      }

      // 每 20 個 chunk 印一次統計
      if (this._audioChunksSent % 20 === 0) {
        console.log('[GeminiLive] 🎤 串流: chunks=%d, bytes=%d, maxAmp=%.4f, maxEver=%.4f, silent=%d',
          this._audioChunksSent, this._audioBytesSent, maxAmp, this._maxAmpEver, this._silentChunks);
      }
    };

    this._mediaStreamSource.connect(this._scriptProcessor);
    this._scriptProcessor.connect(this._audioContext.destination);

    console.log('[GeminiLive] 串流已啟動 (sampleRate=%d, bufferSize=%d)', this._actualSampleRate, bufferSize);

    // 定期記錄音訊統計到 session log
    this._audioStatsInterval = setInterval(() => {
      if (this._isStreaming) {
        sessionLogger.logAudioStats({
          chunksSent: this._audioChunksSent,
          totalBytes: this._audioBytesSent,
          isStreaming: true
        });
      }
    }, 30000);  // 每 30 秒
  }

  /**
   * 停止串流
   */
  stopStreaming() {
    if (!this._isStreaming) return;

    console.log('[GeminiLive] 停止串流 (已送 %d chunks, %d bytes, maxAmp=%.4f, silentChunks=%d)',
      this._audioChunksSent, this._audioBytesSent, this._maxAmpEver || 0, this._silentChunks || 0);
    this._isStreaming = false;

    if (this._audioStatsInterval) {
      clearInterval(this._audioStatsInterval);
      this._audioStatsInterval = null;
    }

    sessionLogger.logAudioStats({
      chunksSent: this._audioChunksSent,
      totalBytes: this._audioBytesSent,
      maxAmpEver: this._maxAmpEver || 0,
      silentChunks: this._silentChunks || 0,
      isStreaming: false,
      event: 'stop'
    });

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
   * 關閉連線
   */
  close() {
    this.stopStreaming();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this._resetBuffers();
    this._messageHandlers.clear();
    this._notifyConnectionChange('disconnected');

    // 結束 session 記錄 (儲存 JSON)
    sessionLogger.endSession();
  }

  /**
   * 取得連線狀態
   */
  getConnectionStatus() {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'disconnecting';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  getTokenUsage() { return { ...this.tokenUsage }; }
  isCurrentlyStreaming() { return this._isStreaming; }

  /**
   * 設定輸入抑制 (AI 播放音訊時暫停送出麥克風，防止回音)
   * @param {boolean} suppress - true=暫停送出, false=恢復送出
   */
  setSuppressInput(suppress) {
    this._suppressInput = suppress;
    console.log('[GeminiLive]', suppress ? '🔇 暫停麥克風輸入 (AI 播放中)' : '🔈 恢復麥克風輸入');

    // 安全機制: 最多抑制 15 秒後自動恢復（防止 onEnd 沒觸發）
    if (suppress) {
      if (this._suppressTimeout) clearTimeout(this._suppressTimeout);
      this._suppressTimeout = setTimeout(() => {
        if (this._suppressInput) {
          console.warn('[GeminiLive] ⚠ 抑制超時 (15s)，強制恢復麥克風輸入');
          this._suppressInput = false;
        }
      }, 15000);
    } else {
      if (this._suppressTimeout) {
        clearTimeout(this._suppressTimeout);
        this._suppressTimeout = null;
      }
    }
  }

  // ==================== Private: WebSocket ====================

  async _connect() {
    return new Promise((resolve, reject) => {
      const url = `${GEMINI_CONFIG.wsUrl}?key=${this.apiKey}`;
      console.log('[GeminiLive] 正在連線...');
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'blob';

      this.ws.onopen = () => {
        console.log('[GeminiLive] WebSocket 已連線');
        this.isConnected = true;
        this._notifyConnectionChange('connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[GeminiLive] WebSocket 錯誤:', error);
        this.isConnected = false;
        this._notifyConnectionChange('error');
        reject(new Error('WebSocket 連線失敗'));
      };

      this.ws.onclose = (event) => {
        console.log('[GeminiLive] WebSocket 已關閉:', event.code, event.reason);
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.stopStreaming();
        this._notifyConnectionChange('disconnected');

        // 如果是非預期關閉，通知錯誤
        if (wasConnected && event.code !== 1000) {
          const err = new Error(`WebSocket 已關閉: ${event.code} ${event.reason}`);
          this._rejectHandler('response', err);
          if (this.onError) this.onError(err);
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
          reject(new Error('WebSocket 連線超時'));
        }
      }, GEMINI_CONFIG.connection.timeout);
    });
  }

  // ==================== Private: Messages ====================

  async _sendSetupMessage(systemPrompt) {
    const setupMessage = {
      setup: {
        model: `models/${GEMINI_CONFIG.model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: GEMINI_CONFIG.voice.default
              }
            }
          },
          thinkingConfig: { thinkingBudget: 0 }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        // Function Calling — tools 必須放在 setup 頂層（與 generationConfig 同級）
        // 官方格式: tools: [{ functionDeclarations: [...] }]
        // analyze_intent 設為 NON_BLOCKING，避免阻塞音訊輸出
        tools: [{
          functionDeclarations: GEMINI_TOOL_DECLARATIONS.map(decl => ({
            ...decl,
            ...(decl.name === 'analyze_intent' ? { behavior: 'NON_BLOCKING' } : {})
          }))
        }],
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    };
    console.log('[GeminiLive] Setup 包含 %d 個 tool declarations', GEMINI_TOOL_DECLARATIONS.length);
    this._sendMessage(setupMessage);
    return this._waitForSetupComplete();
  }

  _sendTextMessage(text) {
    const message = {
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    };
    this._sendMessage(message);
  }

  _sendRealtimeAudio(base64Chunk) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // 使用實際 AudioContext 取樣率 — Gemini 會自動重採樣
    const rate = this._actualSampleRate || 16000;
    const message = {
      realtimeInput: {
        audio: {
          mimeType: `audio/pcm;rate=${rate}`,
          data: base64Chunk
        }
      }
    };
    this.ws.send(JSON.stringify(message));
  }

  _sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[GeminiLive] >>> 送出:', Object.keys(message).join(', '));
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket 未就緒');
    }
  }

  // ==================== Private: Message Handler ====================

  _handleMessage(data) {
    try {
      const message = JSON.parse(data);

      // Setup 完成
      if (message.setupComplete) {
        console.log('[GeminiLive] Setup 完成 ✓');
        this._resolveHandler('setup');
        return;
      }

      // Server content
      if (message.serverContent) {
        const content = message.serverContent;

        // 收集音訊/文字
        if (content.modelTurn?.parts) {
          if (!this._responseStartTime) {
            this._responseStartTime = performance.now();
          }

          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              this.audioBuffer.push(part.inlineData.data);
              // 即時音訊回調
              if (this.onAudioChunk) this.onAudioChunk(part.inlineData.data);
            }
            if (part.text) {
              this.textBuffer += part.text;
            }
            // [Fallback] Live API 的 function call 正常是在頂層 toolCall 訊息
            // 但某些情境下可能出現在 modelTurn.parts，防禦性處理
            if (part.functionCall) {
              console.log('[GeminiLive] ⚠ functionCall 出現在 modelTurn.parts (非標準 Live API 路徑)');
              this._handleFunctionCall(part.functionCall);
            }
          }
        }

        // AI 輸出轉錄
        if (content.outputTranscription?.text) {
          this.outputTranscriptBuffer += content.outputTranscription.text;
          console.log('[GeminiLive] 🔊 AI 轉錄:', content.outputTranscription.text);
          sessionLogger.log('output_transcript', { text: content.outputTranscription.text });
          if (this.onTranscript) {
            this.onTranscript({ type: 'output', text: content.outputTranscription.text });
          }
        }

        // 使用者輸入轉錄
        if (content.inputTranscription?.text) {
          this.inputTranscriptBuffer += content.inputTranscription.text;
          console.log('[GeminiLive] 🎤 使用者轉錄:', content.inputTranscription.text);
          sessionLogger.log('input_transcript', { text: content.inputTranscription.text });
          if (this.onTranscript) {
            this.onTranscript({ type: 'input', text: content.inputTranscription.text });
          }
        }

        // 回合結束
        if (content.turnComplete) {
          const latency = this._responseStartTime
            ? Math.round(performance.now() - this._responseStartTime)
            : 0;

          const response = {
            audio: this.audioBuffer.join(''),
            aiText: this.outputTranscriptBuffer || this.textBuffer,
            userText: this.inputTranscriptBuffer,
            latency: { total: latency, e2e: latency },
            tokenUsage: this._extractTokenUsage(message.usageMetadata)
          };

          console.log('[GeminiLive] turnComplete ✓ (audio chunks: %d, latency: %dms)',
            this.audioBuffer.length, latency);
          console.log('[GeminiLive]   👤 USER:', response.userText || '(無)');
          console.log('[GeminiLive]   🤖 AI:', response.aiText || '(無)');

          // 記錄到 session log
          sessionLogger.logTurn({
            userText: response.userText,
            aiText: response.aiText,
            audioChunks: this.audioBuffer.length,
            audioLength: response.audio.length,
            latency,
            tokenUsage: response.tokenUsage
          });

          // 先嘗試 resolve Promise (用於 initialize 的歡迎語)
          const handler = this._messageHandlers.get('response');
          if (handler) {
            this._messageHandlers.delete('response');
            handler.resolve({
              audio: response.audio,
              text: this.textBuffer || '',
              outputTranscript: response.aiText,
              userTranscript: response.userText,
              usageMetadata: message.usageMetadata
            });
          } else if (this.onResponseComplete) {
            // 串流模式回調
            this.onResponseComplete(response);
          }

          this._resetBuffers();
        }

        // 被中斷 (使用者開始說話時)
        if (content.interrupted) {
          console.log('[GeminiLive] ⚠ interrupted — 清除緩衝');
          sessionLogger.log('interrupted', { bufferedAudioChunks: this.audioBuffer.length });
          this._resetBuffers();
          if (this.onInterrupted) this.onInterrupted();
        }
      }

      // Token 使用量
      if (message.usageMetadata) {
        this.tokenUsage = this._extractTokenUsage(message.usageMetadata);
      }

      // 錯誤
      if (message.error) {
        console.error('[GeminiLive] ✗ API 錯誤:', JSON.stringify(message.error));
        sessionLogger.log('error', { message: message.error.message, code: message.error.code, details: JSON.stringify(message.error) });
        const err = new Error(message.error.message || 'Gemini API 錯誤');
        this._rejectHandler('response', err);
        if (this.onError) this.onError(err);
      }

      // [Primary] Live API 的 Function Calling — toolCall 是獨立的頂層訊息類型
      // 官方格式: { toolCall: { functionCalls: [{ id, name, args }] } }
      if (message.toolCall) {
        const calls = message.toolCall.functionCalls || [];
        console.log('[GeminiLive] 🔧 收到 toolCall，共 %d 個 function calls', calls.length);
        for (const fc of calls) {
          this._handleFunctionCall(fc);
        }
      }

    } catch (err) {
      console.error('[GeminiLive] ✗ 訊息解析錯誤:', err);
    }
  }

  // ==================== Private: Function Calling ====================

  /**
   * 處理 Gemini 發出的 function call
   */
  _handleFunctionCall(functionCall) {
    const { name, id, args } = functionCall;
    console.log('[GeminiLive] 🔧 Function Call:', name, 'id:', id, 'args:', JSON.stringify(args));

    sessionLogger.log('function_call', { name, id, args });

    // 通知外部（CallContext）並取得執行結果
    // onToolCall 應回傳 result 物件，供 Gemini 了解函式執行結果
    let result = { result: 'ok' };
    if (this.onToolCall) {
      try {
        const callbackResult = this.onToolCall({ name, args, id });
        if (callbackResult && typeof callbackResult === 'object') {
          result = callbackResult;
        }
      } catch (err) {
        console.error('[GeminiLive] ✗ onToolCall 執行錯誤:', err);
        result = { result: 'error', error: err.message };
      }
    }

    // 回傳 functionResponse 給 Gemini（含實際執行結果）
    // 官方格式: { toolResponse: { functionResponses: [{ id, name, response }] } }
    // analyze_intent 用 WHEN_IDLE（不打斷）; create_ticket 用 INTERRUPT（立即回報）
    const scheduling = name === 'analyze_intent' ? 'WHEN_IDLE' : 'INTERRUPT';
    this._sendFunctionResponse(name, id, { ...result, scheduling });
  }

  /**
   * 回傳 functionResponse 給 Gemini
   */
  _sendFunctionResponse(functionName, callId, result) {
    const message = {
      toolResponse: {
        functionResponses: [{
          name: functionName,
          id: callId,
          response: result
        }]
      }
    };
    console.log('[GeminiLive] >>> toolResponse:', functionName, 'result:', JSON.stringify(result).substring(0, 100));
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

  _extractTokenUsage(metadata) {
    if (!metadata) return this.tokenUsage;
    return {
      input: metadata.promptTokenCount || this.tokenUsage.input,
      output: metadata.candidatesTokenCount || metadata.responseTokenCount || this.tokenUsage.output,
      total: metadata.totalTokenCount || this.tokenUsage.total
    };
  }

  _notifyConnectionChange(status) {
    if (this.onConnectionChange) this.onConnectionChange(status);
  }

  _waitForSetupComplete() {
    return new Promise((resolve, reject) => {
      this._messageHandlers.set('setup', { resolve, reject });
      setTimeout(() => {
        if (this._messageHandlers.has('setup')) {
          this._messageHandlers.delete('setup');
          reject(new Error('Setup 超時'));
        }
      }, 15000);
    });
  }

  _waitForResponse(timeout = GEMINI_CONFIG.connection.responseTimeout) {
    return new Promise((resolve, reject) => {
      this._messageHandlers.set('response', { resolve, reject });
      setTimeout(() => {
        if (this._messageHandlers.has('response')) {
          this._messageHandlers.delete('response');
          reject(new Error('回應超時'));
        }
      }, timeout);
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
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 9);
    return `gemini-${ts}-${rand}`;
  }

  _getDefaultPrompt(scenario) {
    return `你是${scenario.companyInfo?.name || scenario.name}的AI客服助理。
請用繁體中文、親切專業的語氣即時回答客戶問題。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。`;
  }
}

// 導出單例
export const geminiLiveService = new GeminiLiveService();
export default GeminiLiveService;
