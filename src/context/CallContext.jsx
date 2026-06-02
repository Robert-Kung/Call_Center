import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { scenarios } from '../data/scenarios';
import { voiceService } from '../services/VoiceService';
import { sessionLogger } from '../services/SessionLogger';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { REST_WS_CONFIG } from '../config/api';

const CallContext = createContext(null);

// 唯一遞增 ID 生成器 — 避免 Date.now() 在快速連續呼叫時產生重複 key
let _uidCounter = 0;
const uid = () => `${Date.now()}-${++_uidCounter}`;

export function CallProvider({ children }) {
  // 核心狀態
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [conversationIndex, setConversationIndex] = useState(-1);
  const [displayedConversations, setDisplayedConversations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // 模式控制 (mock: 演示模式, rest-live: REST 即時模式, gemini-live: Gemini 即時模式)
  const [voiceMode, setVoiceMode] = useState('mock');
  const [sessionId, setSessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Gemini Live 專用狀態
  const [geminiTokenUsage, setGeminiTokenUsage] = useState({ input: 0, output: 0, total: 0 });
  const [geminiConnectionStatus, setGeminiConnectionStatus] = useState('disconnected');
  const [isStreaming, setIsStreaming] = useState(false);  // Gemini Live 即時串流中
  const [pendingAutoHangup, setPendingAutoHangup] = useState(false); // 自動掛斷觸發旗標
  const [streamingAiText, setStreamingAiText] = useState('');    // AI 串流逐字稿（即時顯示）
  const [streamingUserText, setStreamingUserText] = useState(''); // 使用者語音轉錄（說話時即時顯示，turnComplete 後轉正式訊息）

  // Agent Copilot 狀態
  const [currentSummary, setCurrentSummary] = useState(null);        // { summary, mainIssue, emotionState, completedSteps, nextAction, customerName }
  const [suggestedResponse, setSuggestedResponse] = useState('');    // 建議回應文字
  const [handoffPackage, setHandoffPackage] = useState(null);        // 轉接交接包
  const [isHandoffMode, setIsHandoffMode] = useState(false);         // 是否正在轉接

  // 麥克風 MediaStream ref (用於 Gemini Live 串流)
  const mediaStreamRef = useRef(null);

  // UX 回饋計時器 refs（長時間未偵測到語音的提示與自動掛斷）
  const noSpeechTimerRef = useRef(null);     // 7秒：偵測不到聲音提示
  const aiSlowTimerRef = useRef(null);       // 3秒：AI 處理中提示
  const autoHangupTimerRef = useRef(null);   // 20秒：自動掛斷
  const autoHangupTriggeredRef = useRef(false); // 是否已觸發自動掛斷

  // 延遲追蹤
  const [latencyMetrics, setLatencyMetrics] = useState({
    asr: 0,
    llm: 0,
    tts: 0,
    total: 0
  });

  // 計時器 ref
  const timerRef = useRef(null);
  const voiceServiceRef = useRef(voiceService);

  // Audio hooks
  const audioPlayer = useAudioPlayer();

  // 取得當前場景
  const scenario = selectedScenarioId ? scenarios[selectedScenarioId] : null;

  // 計時器
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callState]);

  // 格式化通話時間
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 新增系統 Log
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-TW');
    setSystemLogs(prev => [...prev, { timestamp, message, type, id: uid() }]);
  }, []);

  // 模擬延遲指標 (Mock 模式用)
  const simulateLatency = useCallback(() => {
    const asr = Math.floor(Math.random() * 300) + 200;
    const llm = Math.floor(Math.random() * 800) + 400;
    const tts = Math.floor(Math.random() * 200) + 100;
    setLatencyMetrics({
      asr,
      llm,
      tts,
      total: asr + llm + tts
    });
  }, []);

  // 切換模式
  const switchMode = useCallback((newMode) => {
    if (callState !== 'idle' && callState !== 'ended') {
      addLog('通話中無法切換模式', 'warning');
      return false;
    }
    setVoiceMode(newMode);
    setError(null);
    const modeLabels = {
      'mock': '演示模式',
      'rest-live': 'REST 即時語音',
      'gemini-live': 'Gemini Live'
    };
    addLog(`模式切換: ${modeLabels[newMode] || newMode}`, 'system');
    return true;
  }, [callState, addLog]);

  // 選擇場景
  const selectScenario = useCallback((scenarioId) => {
    setSelectedScenarioId(scenarioId);
    setCallState('idle');
    setConversationIndex(-1);
    setDisplayedConversations([]);
    setTickets([]);
    setCurrentAnalysis(null);
    setSystemLogs([]);
    setCallDuration(0);
    setIsMuted(false);
    setLatencyMetrics({ asr: 0, llm: 0, tts: 0, total: 0 });
    setSessionId(null);
    setConnectionStatus('disconnected');
    setGeminiConnectionStatus('disconnected');
    setGeminiTokenUsage({ input: 0, output: 0, total: 0 });
    setIsStreaming(false);
    setIsProcessing(false);
    setError(null);
    setCurrentSummary(null);
    setSuggestedResponse('');
    setHandoffPackage(null);
    setIsHandoffMode(false);
  }, []);

  // Mock 模式撥號
  const dialMock = useCallback(() => {
    if (!selectedScenarioId) return;

    setCallState('dialing');
    addLog('撥出通話中...', 'system');

    setTimeout(() => {
      setCallState('connected');
      addLog('通話已接通', 'success');
      addLog(`來電類型: ${scenarios[selectedScenarioId].name}`, 'info');
      addLog('ASR 引擎就緒: OpenAI Whisper', 'system');
      addLog('LLM 模型載入: Claude 3.5 Sonnet', 'system');
      addLog('TTS 引擎就緒: Azure Neural TTS', 'system');
    }, 1500);
  }, [selectedScenarioId, addLog]);

  // REST WebSocket 模式撥號 (仿 Gemini Live 模式)
  const dialRestWs = useCallback(async () => {
    if (!selectedScenarioId || !scenario) return;

    setCallState('dialing');
    setConnectionStatus('connecting');
    setError(null);

    // 先請求麥克風權限並取得 MediaStream
    addLog('正在請求麥克風權限...', 'system');
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = micStream;
      addLog('麥克風權限已取得', 'info');
    } catch (micErr) {
      console.error('Mic permission error:', micErr);
      setCallState('idle');
      setConnectionStatus('disconnected');
      setError('麥克風權限被拒絕，無法進行語音通話');
      addLog('麥克風權限被拒絕，撥號中止', 'error');
      return;
    }

    addLog('正在連接 REST WebSocket 服務...', 'system');

    try {
      // 取得 RestWebSocketService 實例並注入 callbacks
      const restWsService = voiceServiceRef.current.getRestWsService();

      // 串流音訊計數：追蹤「已送出但尚未播完」的 chunk 數，
      // 確保所有 chunk 播完 + turnComplete 後才解除麥克風抑制
      let pendingAudioChunks = 0;
      let turnComplete = false;

      const tryReleaseSuppression = () => {
        if (pendingAudioChunks === 0 && turnComplete) {
          turnComplete = false; // 立即重置防止重複觸發
          // 延遲一個 worklet chunk（256ms）再開麥克風：
          // 讓喇叭最後殘留的 AI 回音散掉，避免 worklet buffer 邊界的回音觸發 Gemini VAD
          setTimeout(() => restWsService.setSuppressInput(false), 256);
        }
      };

      // ---- 即時音訊串流 (逐 chunk 播放，不等 turnComplete) ----
      restWsService.onAudioChunk = (chunkBase64) => {
        pendingAudioChunks++;
        // 第一個 chunk 到達時開始抑制麥克風（防止回音）
        if (pendingAudioChunks === 1) {
          restWsService.setSuppressInput(true);
        }
        audioPlayer.playAudio(chunkBase64, {
          isPCM: true,
          sampleRate: REST_WS_CONFIG.audio.outputSampleRate,
          onEnd: () => {
            pendingAudioChunks--;
            tryReleaseSuppression();
          }
        });
      };

      // ---- 每輪對話完成 ----
      restWsService.onResponseComplete = (response) => {
        console.log('[CallContext] REST WS 回應完成 — user:', response.userText, 'ai:', response.aiText);

        if (response.userText && response.userText.trim()) {
          setDisplayedConversations(prev => [...prev, {
            id: uid(),
            speaker: 'customer',
            text: response.userText
          }]);
          addLog(`語音辨識: "${response.userText}"`, 'ai');
        }

        if (response.aiText && response.aiText.trim()) {
          setDisplayedConversations(prev => [...prev, {
            id: uid(),
            speaker: 'ai',
            text: response.aiText
          }]);
          addLog(`AI 回應: "${response.aiText.substring(0, 30)}..."`, 'ai');
        }

        // 音訊已由 onAudioChunk 逐 chunk 播放，此處只處理 suppress 釋放時機
        // （若無音訊 chunk、或音訊已全部播完，直接解除抑制）
        turnComplete = true;
        tryReleaseSuppression();

        // 更新延遲指標
        if (response.latency) {
          setLatencyMetrics(response.latency);
          const { asr, llm, tts, total } = response.latency;
          addLog(`延遲: ASR ${asr}ms, LLM ${llm}ms, TTS ${tts}ms, 共 ${total}ms`, 'info');
        }
      };

      // ---- 打斷 ----
      restWsService.onInterrupted = () => {
        console.log('[CallContext] REST WS 被中斷');
        audioPlayer.stopPlayback();
        // 重置串流計數，避免殘留值影響下一輪的 suppress 邏輯
        pendingAudioChunks = 0;
        turnComplete = false;
        restWsService.setSuppressInput(false);
        addLog('AI 回應被中斷', 'info');
      };

      // ---- 錯誤 ----
      restWsService.onError = (err) => {
        console.error('[CallContext] REST WS 錯誤:', err);
        setError(err.message);
        addLog(`REST WS 錯誤: ${err.message}`, 'error');
      };

      // ---- 連線狀態 ----
      restWsService.onConnectionChange = (status) => {
        console.log('[CallContext] REST WS 連線狀態:', status);
        setConnectionStatus(status);
        if (status === 'disconnected' && callState === 'connected') {
          addLog('REST WebSocket 連線中斷', 'warning');
        }
      };

      // ---- 意圖分析 ----
      restWsService.onAnalysis = (data) => {
        const analysis = {
          intent:     data.intent     || '未知',
          confidence: data.confidence || 0,
          entities:   data.entities   || [],
          flags:      data.flags      || [],
          flagTypes:  data.flagTypes  || []
        };
        setCurrentAnalysis(analysis);
        addLog(`🔍 意圖分析: ${analysis.intent} (${(analysis.confidence * 100).toFixed(0)}%)`, 'ai');
        if (analysis.entities.length > 0) {
          addLog(`  實體: ${analysis.entities.join(', ')}`, 'info');
        }
        analysis.flags.forEach((flag, idx) => {
          const flagType = analysis.flagTypes?.[idx] || 'warning';
          addLog(`  標記: ${flag}`, flagType);
        });
      };

      // ---- 工單建立 ----
      restWsService.onTicketCreated = (ticketData) => {
        const ticket = {
          id:          uid(),
          type:        ticketData.type        || '服務單',
          ticketId:    ticketData.ticketId    || `TKT-${Date.now()}`,
          summary:     ticketData.summary     || '',
          customerName: ticketData.customerName || '',
          contactPhone: ticketData.contactPhone || '',
          priority:    ticketData.priority    || '一般',
          status:      ticketData.status      || '已建立',
          ...ticketData
        };
        setTickets(prev => [...prev, ticket]);
        addLog(`✓ ${ticket.type}已建立: ${ticket.ticketId}`, 'success');
      };

      // 初始化 (連線 + setup + 歡迎語)
      const response = await voiceServiceRef.current.initializeCallRestWs(scenario);

      setSessionId(response.sessionId);
      setCallState('connected');
      setConnectionStatus('connected');

      addLog('通話已接通 (REST WebSocket)', 'success');
      addLog(`Session ID: ${response.sessionId}`, 'system');
      addLog('即時串流模式: 後端 VAD 偵測', 'system');

      // 播放歡迎語音 (PCM)
      const restSvc = voiceServiceRef.current.getRestWsService();
      if (response.audio_base64) {
        restSvc.setSuppressInput(true);
        audioPlayer.playAudio(response.audio_base64, {
          isPCM: true,
          sampleRate: REST_WS_CONFIG.audio.outputSampleRate,
          onEnd: () => {
            restSvc.setSuppressInput(false);
          }
        });
        addLog(`播放歡迎語音 (PCM ${REST_WS_CONFIG.audio.outputSampleRate}Hz)`, 'info');
      }

      // 加入 AI 歡迎語到對話
      if (response.ai_text) {
        setDisplayedConversations([{
          id: uid(),
          speaker: 'ai',
          text: response.ai_text
        }]);
      }

      // 更新延遲
      if (response.latency) {
        setLatencyMetrics(prev => ({ ...prev, ...response.latency }));
      }

      // 開始持續串流麥克風音訊
      await voiceServiceRef.current.startRestWsStreaming(micStream);
      setIsStreaming(true);
      addLog('即時串流已啟動 — 直接說話即可', 'success');

    } catch (err) {
      console.error('Dial REST WS error:', err);
      setConnectionStatus('error');
      setError(err.message);
      setCallState('idle');
      setIsStreaming(false);
      addLog(`REST WS 連接失敗: ${err.message}`, 'error');

      // 清理 mediaStream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [selectedScenarioId, scenario, addLog, audioPlayer, callState]);

  // Gemini Live 模式撥號
  const dialGeminiLive = useCallback(async () => {
    if (!selectedScenarioId || !scenario) return;

    setCallState('dialing');
    setGeminiConnectionStatus('connecting');
    setConnectionStatus('connecting');
    setError(null);

    // 先請求麥克風權限並取得 MediaStream
    addLog('正在請求麥克風權限...', 'system');
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // 啟用 AEC 消除喇叭回音，避免 AI 聲音觸發 Gemini VAD 誤判為使用者打斷
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      mediaStreamRef.current = micStream;
      addLog('麥克風權限已取得', 'info');
    } catch (micErr) {
      console.error('Mic permission error:', micErr);
      setCallState('idle');
      setGeminiConnectionStatus('disconnected');
      setConnectionStatus('disconnected');
      setError('麥克風權限被拒絕，無法進行語音通話');
      addLog('麥克風權限被拒絕，撥號中止', 'error');
      return;
    }

    addLog('正在連接 Gemini Live...', 'system');

    try {
      // 設定 Gemini Live 回調（收到 AI 回應時觸發）
      const geminiService = voiceServiceRef.current.getGeminiLiveService();

      // 追蹤播放中的 chunk 數量，用於 suppress 釋放時機判斷（同 REST WS 模式）
      let pendingAudioChunks = 0;
      let turnComplete = false;

      // 重置自動掛斷旗標（新通話開始時清除前次狀態）
      autoHangupTriggeredRef.current = false;

      // 記錄最近幾輪對話，用於重連後注入 context（client-side fallback）
      let lastConversationContext = '';

      // ---- 重連機制 ----
      let reconnectAttempts = 0;
      const MAX_RECONNECT = 3;

      const attemptReconnect = async () => {
        setConnectionStatus('reconnecting');
        setGeminiConnectionStatus('reconnecting');

        while (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 8000); // 1s, 2s, 4s
          addLog(`連線中斷，${delay / 1000}秒後嘗試重新連線 (${reconnectAttempts}/${MAX_RECONNECT})...`, 'warning');

          await new Promise(r => setTimeout(r, delay));

          // 確認通話仍在進行中（hangUp 時 mediaStreamRef 會清空）
          if (!mediaStreamRef.current) {
            console.log('[CallContext] 重連已取消：通話已結束');
            return;
          }

          try {
            await geminiService.reconnect(mediaStreamRef.current);
            reconnectAttempts = 0;
            addLog('重新連線成功 ✓', 'success');
            setConnectionStatus('connected');
            setGeminiConnectionStatus('connected');
            // 重置音訊播放狀態
            pendingAudioChunks = 0;
            turnComplete = false;
            audioPlayer.stopPlayback();
            // P4: 根據是否有 resumption handle 決定通知內容
            // 有 handle：伺服器已自動恢復對話歷史，只需告知 AI 主動說明斷線情況
            // 無 handle：全新 session，需附上完整對話摘要
            if (geminiService._lastResumptionHandle) {
              geminiService.sendSystemMessage(
                '【系統通知：連線剛才短暫中斷後已恢復】請立即主動告知客戶連線已恢復，並簡短說明剛才討論到哪裡，然後繼續對話。不要等客戶先開口。'
              );
            } else if (lastConversationContext) {
              geminiService.sendSystemMessage(
                `【系統通知：連線中斷後重新建立】請立即主動告知客戶連線已恢復。以下是斷線前的對話摘要，請根據此摘要繼續服務客戶：\n${lastConversationContext}`
              );
            }
            // P1: 移除此處的 startNoSpeechTimer()
            // AI 若有回應，suppress 釋放後 tryReleaseSuppression() 會自動呼叫
            // AI 若無回應（resumption handle 有效、靜默銜接），suppress 已重置，
            // GeminiLiveService.reconnect() 完成後 _suppressInput=false，
            // 使用者可立即說話，等待 inputTranscription 觸發 onUserSpeechDetected()
            return; // 成功，退出
          } catch (err) {
            console.error('[CallContext] 重新連線失敗 (%d/%d):', reconnectAttempts, MAX_RECONNECT, err);
            addLog(`重新連線失敗 (${reconnectAttempts}/${MAX_RECONNECT}): ${err.message}`, 'error');
          }
        }

        // 達到最大重試次數，掛斷通話
        addLog('無法重新連線，自動掛斷通話', 'error');
        setConnectionStatus('disconnected');
        setGeminiConnectionStatus('disconnected');
      };

      // ---- UX 回饋計時器輔助函式 ----

      // 重置 20秒無語音自動掛斷計時器（每次使用者說話或 suppress 釋放時呼叫）
      const resetAutoHangupTimer = () => {
        if (autoHangupTimerRef.current) clearTimeout(autoHangupTimerRef.current);
        autoHangupTimerRef.current = setTimeout(() => {
          autoHangupTimerRef.current = null;
          autoHangupTriggeredRef.current = true;
          console.log('[CallContext] 20秒無使用者語音，觸發自動掛斷');
          addLog('長時間未偵測到您的聲音，AI 將結束通話', 'warning');
          geminiService.sendSystemMessage('【系統通知】已超過20秒未偵測到使用者聲音。請簡短感謝客戶來電，禮貌道別並結束通話。');
          // 最多等 15 秒讓 AI 說完道別，再強制掛斷
          setTimeout(() => setPendingAutoHangup(true), 15000);
        }, 20000);
      };

      // suppress 釋放後啟動：7秒偵測不到聲音提示 + 重置 20秒計時器
      const startNoSpeechTimer = () => {
        if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null; }
        noSpeechTimerRef.current = setTimeout(() => {
          noSpeechTimerRef.current = null;
          addLog('偵測不到您的聲音，請確認麥克風是否正常', 'warning');
        }, 7000);
        resetAutoHangupTimer();
      };

      // inputTranscription 到達時：取消無聲音提示，啟動 3秒 AI 慢回應提示
      const onUserSpeechDetected = () => {
        if (autoHangupTriggeredRef.current) return; // 自動掛斷流程中不重置計時器
        if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null; }
        if (aiSlowTimerRef.current) clearTimeout(aiSlowTimerRef.current);
        aiSlowTimerRef.current = setTimeout(() => {
          aiSlowTimerRef.current = null;
          addLog('AI 正在處理中，請稍候...', 'info');
        }, 3000);
        resetAutoHangupTimer();
      };

      const tryReleaseSuppression = () => {
        console.log('[Suppress] tryRelease: pendingChunks=%d, turnComplete=%s', pendingAudioChunks, turnComplete);
        if (pendingAudioChunks === 0 && turnComplete) {
          turnComplete = false; // 立即重置防止重複觸發
          if (autoHangupTriggeredRef.current) {
            // 自動掛斷模式：AI 道別音訊播完後掛斷，不重開麥克風
            console.log('[CallContext] 自動掛斷：AI 道別播完，觸發掛斷');
            setTimeout(() => setPendingAutoHangup(true), 500);
            return;
          }
          // 延遲一個 worklet chunk（256ms）再開麥克風：
          // 讓喇叭最後殘留的 AI 回音散掉，避免 worklet buffer 邊界的回音觸發 Gemini VAD
          console.log('[Suppress] 條件滿足，256ms 後釋放麥克風');
          setTimeout(() => {
            geminiService.setSuppressInput(false);
            startNoSpeechTimer();
          }, 256);
        }
      };

      // ---- 即時文字串流（outputTranscription 逐 chunk 顯示）----
      geminiService.onTranscript = ({ type, text }) => {
        if (type === 'output') {
          setStreamingAiText(prev => prev + text);
        } else if (type === 'input') {
          // 使用者說話時即時更新轉錄，turnComplete 後由 displayedConversations 取代
          setStreamingUserText(prev => prev + text);
          onUserSpeechDetected(); // 取消無聲音提示，啟動 AI 慢回應計時器
        }
      };

      // ---- 即時音訊串流 (逐 chunk 播放，不等 turnComplete) ----
      geminiService.onAudioChunk = (chunkBase64) => {
        // AI 開始回應：取消「AI 慢回應」提示
        if (aiSlowTimerRef.current) { clearTimeout(aiSlowTimerRef.current); aiSlowTimerRef.current = null; }
        pendingAudioChunks++;
        console.log('[Suppress] onAudioChunk 到達，pendingChunks=%d', pendingAudioChunks);
        // 第一個 chunk 到達時開始抑制麥克風（防止回音）
        if (pendingAudioChunks === 1) {
          geminiService.setSuppressInput(true);
        }
        audioPlayer.playAudio(chunkBase64, {
          isPCM: true,
          sampleRate: 24000,
          onEnd: () => {
            pendingAudioChunks--;
            console.log('[Suppress] onEnd 觸發，pendingChunks=%d', pendingAudioChunks);
            tryReleaseSuppression();
          }
        });
      };

      geminiService.onResponseComplete = (response) => {
        console.log('[CallContext] Gemini 回應完成:');
        console.log('[CallContext]   👤 USER:', response.userText || '(無)');
        console.log('[CallContext]   🤖 AI:', response.aiText || '(無)');

        // 清除串流文字（改由 displayedConversations 顯示完整訊息）
        setStreamingAiText('');
        setStreamingUserText('');

        // 加入使用者語音轉文字（自動掛斷的系統訊息不顯示在 UI）
        if (!autoHangupTriggeredRef.current && response.userText && response.userText.trim()) {
          setDisplayedConversations(prev => [...prev, {
            id: uid(),
            speaker: 'customer',
            text: response.userText
          }]);
          addLog(`語音辨識: "${response.userText}"`, 'ai');
        }

        // 加入 AI 回應
        if (response.aiText && response.aiText.trim()) {
          setDisplayedConversations(prev => [...prev, {
            id: uid(),
            speaker: 'ai',
            text: response.aiText
          }]);
          addLog(`AI 回應: "${response.aiText.substring(0, 30)}..."`, 'ai');
        }

        // 更新最近對話 context（供重連後注入，client-side fallback）
        if (response.userText || response.aiText) {
          const lines = [];
          if (response.userText?.trim()) lines.push(`客戶：${response.userText.trim()}`);
          if (response.aiText?.trim()) lines.push(`AI：${response.aiText.trim().substring(0, 60)}`);
          const prev = lastConversationContext ? lastConversationContext.split('\n') : [];
          lastConversationContext = [...prev, ...lines].slice(-8).join('\n'); // 保留最近 4 輪
        }

        // 音訊已由 onAudioChunk 逐 chunk 播放，此處只處理 suppress 釋放時機
        console.log('[Suppress] onResponseComplete，pendingChunks=%d → 設 turnComplete=true', pendingAudioChunks);
        turnComplete = true;
        tryReleaseSuppression();

        // 更新延遲指標
        if (response.latency) {
          setLatencyMetrics({
            ...response.latency,
            asr: 0,
            llm: 0,
            tts: 0
          });
          const { ttfc, streamDuration, e2e } = response.latency;
          const latencyLog = ttfc != null
            ? `TTFC: ${ttfc}ms, 串流: ${streamDuration}ms`
            : `端到端延遲: ${e2e}ms`;
          addLog(latencyLog, 'info');
        }

        // 更新 Token 使用量
        if (response.tokenUsage) {
          setGeminiTokenUsage(response.tokenUsage);
        }
      };

      geminiService.onInterrupted = () => {
        console.log('[CallContext] Gemini 被中斷（使用者開始說話）');
        audioPlayer.stopPlayback();
        // 清除串流文字（被中斷，捨棄未完成的回應）
        setStreamingAiText('');
        setStreamingUserText('');
        // 重置串流計數，避免殘留值影響下一輪的 suppress 邏輯
        pendingAudioChunks = 0;
        turnComplete = false;
        geminiService.setSuppressInput(false);
        // 清除 AI 慢回應計時器（使用者已打斷）
        if (aiSlowTimerRef.current) { clearTimeout(aiSlowTimerRef.current); aiSlowTimerRef.current = null; }
        addLog('AI 回應被中斷', 'info');
      };

      geminiService.onError = (err) => {
        console.error('[CallContext] Gemini 錯誤:', err);
        setError(err.message);
        addLog(`Gemini 錯誤: ${err.message}`, 'error');
      };

      geminiService.onConnectionChange = (status) => {
        console.log('[CallContext] Gemini 連線狀態:', status);
        setGeminiConnectionStatus(status);
        if (status === 'disconnected' && !autoHangupTriggeredRef.current) {
          // 意外斷線：立即設為 'reconnecting'（阻止 auto-hangup useEffect），然後嘗試重連
          addLog('Gemini Live 連線中斷，嘗試重新連線...', 'warning');
          attemptReconnect();
        } else {
          setConnectionStatus(status);
        }
      };

      geminiService.onGoAway = (secondsLeft) => {
        addLog(`伺服器連線即將重置 (剩餘約 ${secondsLeft} 秒)，提前重連中...`, 'warning');
        // P3: 利用 GoAway 預警時間提前重連，避免等到真正斷線才被動處理
        if (!autoHangupTriggeredRef.current) {
          attemptReconnect();
        }
      };

      // Function Calling 回調 — 處理意圖分析和單據建立
      // 必須回傳 result 物件，供 GeminiLiveService 回傳給 Gemini
      geminiService.onToolCall = ({ name, args, id }) => {
        console.log('[CallContext] 🔧 Tool Call:', name, 'id:', id, args);

        if (name === 'analyze_intent') {
          // 正規化 entities：trim 空白、去除空字串
          const entities = (args.entities || [])
            .map(e => (typeof e === 'string' ? e.trim() : ''))
            .filter(e => e.length > 0);

          // 正規化 flags：過濾字面量「無」和空值
          const rawFlags = args.flags || [];
          const flags = rawFlags.filter(
            f => f && typeof f === 'string' && f.trim() !== '' && f.trim() !== '無'
          );

          // 正規化 flagTypes：對齊 flags 長度，不足補 'info'
          const rawFlagTypes = args.flagTypes || [];
          const flagTypes = flags.map((_, i) => rawFlagTypes[i] || 'info');

          // intent 缺漏時，嘗試從 entities 推斷（模型偶爾省略 intent 但把意圖寫進 entities）
          const INTENT_ENUM = [
            '問候', '結束通話', '提供資訊', '身份確認', '常見問題',
            '報修申訴', '費用查詢', '方案諮詢',
            '訂位', '訂位查詢', '訂位取消',
            '掛號', '取消掛號', '看診進度查詢',
            '貨件追蹤', '修改配送', '寄件諮詢'
          ];
          let resolvedIntent = args.intent;
          if (!resolvedIntent) {
            // 從 entities 裡的「意圖:xxx」或「需求:xxx」標籤中找符合 enum 的值
            const entityHint = (args.entities || []).join(' ');
            resolvedIntent = INTENT_ENUM.find(label => entityHint.includes(label)) || '提供資訊';
          }

          // 更新 AI 意圖分析面板
          const analysis = {
            intent: resolvedIntent,
            confidence: args.confidence || 0,
            entities,
            flags,
            flagTypes
          };
          setCurrentAnalysis(analysis);
          addLog(`🔍 意圖分析: ${analysis.intent} (${(analysis.confidence * 100).toFixed(0)}%)`, 'ai');
          if (analysis.entities.length > 0) {
            addLog(`  實體: ${analysis.entities.join(', ')}`, 'info');
          }
          if (analysis.flags.length > 0) {
            analysis.flags.forEach((flag, idx) => {
              const flagType = analysis.flagTypes[idx] || 'warning';
              addLog(`  標記: ${flag}`, flagType);
            });
          }
          // 回傳結果給 Gemini
          return {
            result: 'success',
            analysis: {
              intent: analysis.intent,
              confidence: analysis.confidence,
              entityCount: analysis.entities.length,
              flagCount: analysis.flags.length
            }
          };
        }

        if (name === 'create_ticket') {
          // 解析 details 欄位（支援物件或 JSON 字串）
          let parsedDetails = {};
          if (args.details) {
            if (typeof args.details === 'object') {
              parsedDetails = args.details;
            } else {
              try { parsedDetails = JSON.parse(args.details); } catch { parsedDetails = { raw: args.details }; }
            }
          }

          // 依場景前綴自動生成 ticketId
          const _prefixMap = { '網路報修單': 'CHT', '費用查詢單': 'CHT', '方案變更單': 'CHT', '訂位單': 'RES', '醫療掛號單': 'MED', '物流處理單': 'LOG' };
          const _prefix = _prefixMap[args.type] || 'TKT';
          const _dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const _autoId = `${_prefix}-${_dateStr}-${String(++_uidCounter).padStart(4, '0')}`;

          const ticket = {
            id: uid(),
            type: args.type || '服務單',
            ticketId: (args.ticketId && args.ticketId.trim()) ? args.ticketId.trim() : _autoId,
            summary: args.summary || '',
            customerName: args.customerName || '',
            contactPhone: args.contactPhone || '',
            priority: args.priority || '一般',
            status: args.status || '已建立',
            ...parsedDetails
          };
          setTickets(prev => [...prev, ticket]);
          addLog(`✓ ${ticket.type}已建立: ${ticket.ticketId}`, 'success');
          // 回傳結果給 Gemini
          return {
            result: 'success',
            ticketId: ticket.ticketId,
            type: ticket.type,
            status: ticket.status
          };
        }

        if (name === 'generate_summary') {
          const summary = {
            summary: args.summary || '',
            mainIssue: args.mainIssue || '',
            emotionState: args.emotionState || 'neutral',
            completedSteps: args.completedSteps || [],
            nextAction: args.nextAction || '',
            customerName: args.customerName || ''
          };
          setCurrentSummary(summary);
          if (args.nextAction) setSuggestedResponse(args.nextAction);
          addLog(`📋 摘要更新: ${summary.summary.substring(0, 40)}...`, 'ai');
          return { result: 'success' };
        }

        // 未知的 function — 仍回傳結果避免 Gemini 卡住
        console.warn('[CallContext] 未知的 tool call:', name);
        return { result: 'error', error: `Unknown function: ${name}` };
      };

      // 初始化 (連線 + setup + 歡迎語)
      const response = await voiceServiceRef.current.initializeCallGeminiLive(scenario);

      setSessionId(response.sessionId);
      setCallState('connected');
      setGeminiConnectionStatus('connected');
      setConnectionStatus('connected');

      addLog('通話已接通 (Gemini Live)', 'success');
      addLog(`Session ID: ${response.sessionId}`, 'system');
      addLog('Gemini Live API 已連線', 'system');

      // 歡迎語音訊已由 onAudioChunk 逐 chunk 即時播放完畢
      // initialize() 回傳後只需通知 suppress 機制「turn 已完成」，讓 tryReleaseSuppression 統一釋放麥克風
      turnComplete = true;
      tryReleaseSuppression();

      // 加入 AI 歡迎語到對話（同時清除 streamingAiText，歡迎語走 Promise 路徑不會自動清除）
      setStreamingAiText('');
      if (response.ai_text) {
        setDisplayedConversations([{
          id: uid(),
          speaker: 'ai',
          text: response.ai_text
        }]);
      }

      // 更新延遲
      if (response.latency) {
        setLatencyMetrics({
          ...response.latency,
          asr: 0,
          llm: 0,
          tts: 0
        });
      }

      // 開始即時串流麥克風音訊
      await voiceServiceRef.current.startGeminiStreaming(micStream);
      setIsStreaming(true);
      addLog('即時串流已啟動 — 直接說話即可', 'success');

    } catch (err) {
      console.error('Dial Gemini Live error:', err);
      setGeminiConnectionStatus('error');
      setConnectionStatus('error');
      setError(err.message);
      setCallState('idle');
      setIsStreaming(false);
      addLog(`Gemini Live 連接失敗: ${err.message}`, 'error');

      // 清理 mediaStream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [selectedScenarioId, scenario, addLog, audioPlayer, callState]);

  // 統一撥號 (根據模式選擇)
  const dial = useCallback(() => {
    switch (voiceMode) {
      case 'gemini-live':
        dialGeminiLive();
        break;
      case 'rest-live':
        dialRestWs();
        break;
      case 'mock':
      default:
        dialMock();
        break;
    }
  }, [voiceMode, dialGeminiLive, dialRestWs, dialMock]);

  // 掛斷
  const hangUp = useCallback(() => {
    // 停止所有進行中的音訊操作
    audioPlayer.stopPlayback();

    // 清除 UX 回饋計時器，防止掛斷後繼續觸發
    if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null; }
    if (aiSlowTimerRef.current) { clearTimeout(aiSlowTimerRef.current); aiSlowTimerRef.current = null; }
    if (autoHangupTimerRef.current) { clearTimeout(autoHangupTimerRef.current); autoHangupTimerRef.current = null; }
    autoHangupTriggeredRef.current = false;

    // 停止即時串流 (Gemini 或 REST WS)
    if (isStreaming) {
      if (voiceMode === 'gemini-live') {
        voiceServiceRef.current.stopGeminiStreaming();
      } else if (voiceMode === 'rest-live') {
        voiceServiceRef.current.stopRestWsStreaming();
      }
      setIsStreaming(false);
    }

    // 清理 mediaStream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // 結束 SessionLogger 記錄
    if (voiceMode === 'gemini-live' || voiceMode === 'rest-live') {
      sessionLogger.endSession();
    }

    // 結束 session (根據模式) — 無論 sessionId 是否已取得皆執行，
    // 確保撥號連線中途掛斷時 WebSocket 也能被正確關閉。
    if (voiceMode === 'gemini-live') {
      // 清除 Gemini callbacks
      const geminiService = voiceServiceRef.current.getGeminiLiveService();
      geminiService.onAudioChunk = null;
      geminiService.onTranscript = null;
      geminiService.onResponseComplete = null;
      geminiService.onInterrupted = null;
      geminiService.onError = null;
      geminiService.onConnectionChange = null;
      geminiService.onToolCall = null;
      geminiService.onGoAway = null;
      setStreamingAiText('');
      setStreamingUserText('');
      voiceServiceRef.current.endGeminiSession();
      setGeminiConnectionStatus('disconnected');
    } else if (voiceMode === 'rest-live') {
      // 清除 REST WS callbacks
      const restWsService = voiceServiceRef.current.getRestWsService();
      restWsService.onResponseComplete = null;
      restWsService.onAudioChunk = null;
      restWsService.onTranscript = null;
      restWsService.onInterrupted = null;
      restWsService.onError = null;
      restWsService.onConnectionChange = null;
      restWsService.onAnalysis = null;
      restWsService.onTicketCreated = null;
      voiceServiceRef.current.endRestWsSession();
    }
    if (sessionId) setSessionId(null);
    if (voiceMode !== 'mock') setConnectionStatus('disconnected');

    setCallState('ended');
    setIsProcessing(false);
    addLog('通話已結束', 'system');
    addLog(`通話時長: ${formatDuration(callDuration)}`, 'info');
    addLog(`處理對話輪數: ${displayedConversations.length}`, 'info');
    if (tickets.length > 0) {
      addLog(`產生單據數量: ${tickets.length}`, 'success');
    }
    if (voiceMode === 'gemini-live' && geminiTokenUsage.total > 0) {
      addLog(`Gemini Token 使用: ${geminiTokenUsage.total}`, 'info');
    }
  }, [voiceMode, sessionId, isStreaming, audioPlayer, addLog, formatDuration, callDuration, displayedConversations.length, tickets.length, geminiTokenUsage.total]);

  // 自動掛斷觸發：AI 道別播完後執行 hangUp
  useEffect(() => {
    if (pendingAutoHangup && callState === 'connected') {
      setPendingAutoHangup(false);
      hangUp();
    }
  }, [pendingAutoHangup, callState, hangUp]);

  // 伺服器端斷線自動掛斷
  // 當 live 模式通話中 connectionStatus 變為 disconnected/error 時自動觸發 hangUp，
  // 避免畫面卡在通話中但 WebSocket 已實際斷線的狀態。
  // 注意：hangUp() 本身也會設 connectionStatus='disconnected'，但屆時
  // callState 已為 'ended'，guard 會阻止重複觸發。
  useEffect(() => {
    if (voiceMode === 'mock') return;
    if (callState !== 'connected' && callState !== 'dialing') return;
    if (connectionStatus === 'reconnecting') return; // 重連中，不觸發掛斷
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      addLog('連線中斷，自動掛斷通話', 'warning');
      hangUp();
    }
  }, [connectionStatus, callState, voiceMode, addLog, hangUp]);

  // Mock 模式下一步對話
  const nextStep = useCallback(() => {
    if (!scenario) return;

    // Live 模式不使用 nextStep
    if (voiceMode !== 'mock') {
      addLog('即時模式請使用錄音功能', 'warning');
      return;
    }

    const nextIndex = conversationIndex + 1;

    if (nextIndex >= scenario.conversations.length) {
      hangUp();
      return;
    }

    const conv = scenario.conversations[nextIndex];
    setConversationIndex(nextIndex);
    setDisplayedConversations(prev => [...prev, { ...conv, id: uid() }]);

    // 模擬延遲
    simulateLatency();

    // 處理分析
    if (conv.analysis) {
      setCurrentAnalysis(conv.analysis);
      addLog(`意圖識別: ${conv.analysis.intent} (${(conv.analysis.confidence * 100).toFixed(0)}%)`, 'ai');
      conv.analysis.entities.forEach(entity => {
        addLog(`實體擷取: ${entity}`, 'info');
      });
      if (conv.analysis.flags && conv.analysis.flags.length > 0) {
        conv.analysis.flags.forEach((flag, idx) => {
          const flagType = conv.analysis.flagTypes?.[idx] || 'warning';
          addLog(`標記: ${flag}`, flagType);
        });
      }
    }

    // 處理 Agent Copilot 摘要（Mock 模式）
    if (conv.summary) {
      setCurrentSummary(conv.summary);
    }
    if (conv.suggestedResponse) {
      setSuggestedResponse(conv.suggestedResponse);
    }

    // 處理動作
    if (conv.action) {
      handleAction(conv.action);
    }
  }, [scenario, voiceMode, conversationIndex, hangUp, simulateLatency, addLog]);

  // 處理動作
  const handleAction = useCallback((action) => {
    switch (action.type) {
      case 'query':
      case 'check_availability':
      case 'check_inventory':
      case 'verify_account':
      case 'check_schedule':
        addLog(action.status || `執行: ${action.type}...`, 'system');
        break;
      case 'date_parsing':
        addLog(`日期解析: "${action.input}" → ${action.result}`, 'ai');
        break;
      case 'log':
        addLog(action.message, 'info');
        break;
      case 'diagnosis':
        addLog(`問題診斷: ${action.result}`, 'ai');
        break;
      case 'schedule_result':
        if (action.available === false) {
          addLog(`✗ 時段 "${action.requested}" 已額滿`, 'warning');
        }
        if (action.alternatives) {
          addLog('可用替代時段:', 'info');
          action.alternatives.forEach(alt => {
            addLog(`  → ${alt.date} ${alt.time}: ${alt.status}`, 'success');
          });
        }
        break;
      case 'availability_result':
        if (action.available === true) {
          addLog('✓ 該時段有空位', 'success');
        } else if (action.available === false) {
          addLog('✗ 該時段已客滿', 'warning');
        } else if (action.available === 'partial') {
          addLog('⚠ 部分房型可訂', 'warning');
          if (action.details) {
            Object.entries(action.details).forEach(([room, status]) => {
              addLog(`  ${room}: ${status}`, status === '可訂' ? 'success' : 'warning');
            });
          }
        }
        if (action.alternatives) {
          addLog('替代方案:', 'info');
          action.alternatives.forEach(alt => {
            if (alt.date) {
              addLog(`  → ${alt.date} ${alt.time}: ${alt.status}`, 'info');
            } else if (alt.option) {
              addLog(`  → ${alt.option}: ${alt.price}`, 'info');
            }
          });
        }
        break;
      case 'promotion_check':
        addLog('可用優惠方案:', 'success');
        action.available.forEach(promo => {
          addLog(`  ✓ ${promo.name}: ${promo.benefit}`, 'success');
        });
        break;
      case 'policy_check':
        addLog(`政策查詢: ${action.policy}`, 'system');
        addLog(`  結果: ${action.result}`, action.result.includes('不') ? 'warning' : 'info');
        if (action.alternative) {
          addLog(`  替代方案: ${action.alternative}`, 'info');
        }
        break;
      case 'policy_info':
        addLog(`${action.category}說明:`, 'info');
        action.rules.forEach(rule => {
          addLog(`  ${rule.period}: ${rule.fee}`, 'info');
        });
        break;
      case 'inventory_result':
        addLog(`庫存查詢: ${action.item}`, 'system');
        addLog(`  平日: ${action.weekday}`, action.weekday === '可供應' ? 'success' : 'warning');
        addLog(`  週末: ${action.weekend}`, action.weekend === '可供應' ? 'success' : 'warning');
        break;
      case 'form_start':
        addLog(`開始建立${action.formType === 'repair' ? '報修單' : action.formType === 'reservation' ? '訂位單' : action.formType === 'medical' ? '掛號單' : '物流處理單'}`, 'system');
        break;
      case 'info_provided':
        addLog(`提供資訊: ${action.category}`, 'info');
        break;
      case 'ticket_created':
        setTickets(prev => [...prev, { ...action.ticket, id: uid() }]);
        addLog(`✓ ${action.ticket.type}已建立: ${action.ticket.ticketId}`, 'success');
        break;
      case 'call_end':
        if (action.summary) {
          addLog(`通話摘要: ${action.summary}`, 'info');
        }
        setTimeout(() => hangUp(), 500);
        break;
      default:
        break;
    }
  }, [addLog, hangUp]);

  // 返回
  const goBack = useCallback(() => {
    // 停止串流
    if (isStreaming) {
      if (voiceMode === 'gemini-live') {
        voiceServiceRef.current.stopGeminiStreaming();
      } else if (voiceMode === 'rest-live') {
        voiceServiceRef.current.stopRestWsStreaming();
      }
      setIsStreaming(false);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // 結束 SessionLogger 記錄
    if (voiceMode === 'gemini-live' || voiceMode === 'rest-live') {
      sessionLogger.endSession();
    }

    // 清理 session
    if (sessionId) {
      if (voiceMode === 'gemini-live') {
        const geminiService = voiceServiceRef.current.getGeminiLiveService();
        geminiService.onAudioChunk = null;
        geminiService.onTranscript = null;
        geminiService.onResponseComplete = null;
        geminiService.onInterrupted = null;
        geminiService.onError = null;
        geminiService.onConnectionChange = null;
        geminiService.onToolCall = null;
        setStreamingAiText('');
        setStreamingUserText('');
        voiceServiceRef.current.endGeminiSession();
        setGeminiConnectionStatus('disconnected');
      } else if (voiceMode === 'rest-live') {
        const restWsService = voiceServiceRef.current.getRestWsService();
        restWsService.onResponseComplete = null;
        restWsService.onAudioChunk = null;
        restWsService.onTranscript = null;
        restWsService.onInterrupted = null;
        restWsService.onError = null;
        restWsService.onConnectionChange = null;
        restWsService.onAnalysis = null;
        restWsService.onTicketCreated = null;
        voiceServiceRef.current.endRestWsSession();
      }
    }

    setSelectedScenarioId(null);
    setCallState('idle');
    setConversationIndex(-1);
    setDisplayedConversations([]);
    setTickets([]);
    setCurrentAnalysis(null);
    setSystemLogs([]);
    setCallDuration(0);
    setIsMuted(false);
    setLatencyMetrics({ asr: 0, llm: 0, tts: 0, total: 0 });
    setSessionId(null);
    setIsStreaming(false);
    setIsProcessing(false);
    setConnectionStatus('disconnected');
    setGeminiConnectionStatus('disconnected');
    setGeminiTokenUsage({ input: 0, output: 0, total: 0 });
    setError(null);
    setCurrentSummary(null);
    setSuggestedResponse('');
    setHandoffPackage(null);
    setIsHandoffMode(false);
  }, [voiceMode, sessionId, isStreaming]);

  // 切換靜音
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    addLog(newMuted ? '麥克風已靜音' : '麥克風已開啟', 'system');

    // 實際靜音/取消靜音麥克風 track（Mock 模式無 mediaStream，安全跳過）
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }
  }, [isMuted, addLog]);

  // 重新開始
  const restart = useCallback(() => {
    if (selectedScenarioId) {
      selectScenario(selectedScenarioId);
    }
  }, [selectedScenarioId, selectScenario]);

  // 清除錯誤
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 生成轉接交接包
  const generateHandoff = useCallback(() => {
    const pkg = {
      handoffTime: new Date().toISOString(),
      duration: formatDuration(callDuration),
      customer: {},
      intent: currentAnalysis?.intent || '未知',
      summary: currentSummary?.summary || `通話時長 ${formatDuration(callDuration)}，共 ${displayedConversations.length} 輪對話`,
      entities: currentAnalysis?.entities || [],
      flags: currentAnalysis?.flags || [],
      conversationCount: displayedConversations.length,
      suggestedAction: currentSummary?.nextAction || suggestedResponse || ''
    };
    // 從 entities 解析客戶資料
    if (currentAnalysis?.entities) {
      currentAnalysis.entities.forEach(e => {
        const [key, val] = e.split(':');
        if (key && val) {
          if (key.includes('戶名') || key.includes('姓名')) pkg.customer.name = val;
          if (key.includes('門號') || key.includes('電話')) pkg.customer.phone = val;
          if (key.includes('關係')) pkg.customer.relation = val;
        }
      });
    }
    if (currentSummary?.customerName) pkg.customer.name = currentSummary.customerName;
    setHandoffPackage(pkg);
    setIsHandoffMode(true);
    addLog('📤 生成轉接交接包', 'system');
  }, [callDuration, currentAnalysis, currentSummary, displayedConversations.length, suggestedResponse, formatDuration, addLog]);

  // 取消轉接
  const cancelHandoff = useCallback(() => {
    setIsHandoffMode(false);
    setHandoffPackage(null);
  }, []);

  // 確認轉接（結束通話）
  const confirmHandoff = useCallback(() => {
    addLog('✓ 已確認轉接，通話結束', 'success');
    setIsHandoffMode(false);
    hangUp();
  }, [hangUp, addLog]);

  const value = {
    // 狀態
    selectedScenarioId,
    scenario,
    scenarios,
    callState,
    conversationIndex,
    displayedConversations,
    tickets,
    currentAnalysis,
    systemLogs,
    callDuration,
    isMuted,
    latencyMetrics,

    // 模式相關狀態
    voiceMode,
    sessionId,
    connectionStatus,
    isProcessing,
    error,

    // Gemini Live 專用狀態
    geminiTokenUsage,
    geminiConnectionStatus,
    isStreaming,
    streamingAiText,
    streamingUserText,

    // Agent Copilot 狀態
    currentSummary,
    suggestedResponse,
    handoffPackage,
    isHandoffMode,

    // 播放狀態
    isPlaying: audioPlayer.isPlaying,

    // 方法
    selectScenario,
    dial,
    hangUp,
    nextStep,
    goBack,
    toggleMute,
    restart,
    formatDuration,
    addLog,

    // 模式相關方法
    switchMode,
    clearError,

    // Agent Copilot 方法
    generateHandoff,
    cancelHandoff,
    confirmHandoff,

    // 播放相關方法
    stopPlayback: audioPlayer.stopPlayback
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export default CallContext;
