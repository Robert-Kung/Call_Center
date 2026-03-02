import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { scenarios } from '../data/scenarios';
import { voiceService } from '../services/VoiceService';
import { sessionLogger } from '../services/SessionLogger';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

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

  // 麥克風 MediaStream ref (用於 Gemini Live 串流)
  const mediaStreamRef = useRef(null);

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
  const audioRecorder = useAudioRecorder();
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

  // Live 模式撥號
  const dialLive = useCallback(async () => {
    if (!selectedScenarioId || !scenario) return;

    setCallState('dialing');
    setConnectionStatus('connecting');
    setError(null);

    // 先請求麥克風權限，被拒絕就中斷撥號
    addLog('正在請求麥克風權限...', 'system');
    try {
      const granted = await audioRecorder.requestPermission();
      if (!granted) {
        setCallState('idle');
        setConnectionStatus('disconnected');
        setError('麥克風權限被拒絕，無法進行語音通話');
        addLog('麥克風權限被拒絕，撥號中止', 'error');
        return;
      }
      addLog('麥克風權限已取得', 'info');
    } catch (micErr) {
      setCallState('idle');
      setConnectionStatus('disconnected');
      setError('無法取得麥克風權限');
      addLog('麥克風權限請求失敗，撥號中止', 'error');
      return;
    }

    addLog('正在連接語音服務...', 'system');

    try {
      const response = await voiceServiceRef.current.initializeCall(scenario);

      setSessionId(response.sessionId);
      setCallState('connected');
      setConnectionStatus('connected');

      addLog('通話已接通 (即時模式)', 'success');
      addLog(`Session ID: ${response.sessionId}`, 'system');
      addLog('ASR 引擎就緒: Whisper (本地)', 'system');
      addLog('LLM 模型就緒: 本地 LLM', 'system');
      addLog('TTS 引擎就緒: CosyVoice', 'system');

      // 播放歡迎語音
      if (response.audio_base64) {
        audioPlayer.playAudio(response.audio_base64);
        addLog('播放歡迎語音', 'info');
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
        setLatencyMetrics(response.latency);
      }

    } catch (err) {
      console.error('Dial live error:', err);
      setConnectionStatus('error');
      setError(err.message);
      setCallState('idle');
      addLog(`連接失敗: ${err.message}`, 'error');
    }
  }, [selectedScenarioId, scenario, addLog, audioPlayer, audioRecorder]);

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

      geminiService.onResponseComplete = (response) => {
        console.log('[CallContext] Gemini 回應完成:');
        console.log('[CallContext]   👤 USER:', response.userText || '(無)');
        console.log('[CallContext]   🤖 AI:', response.aiText || '(無)');
        console.log('[CallContext]   🔊 audio:', response.audio?.length || 0, 'chunks, latency:', response.latency?.total, 'ms');

        // 加入使用者語音轉文字
        if (response.userText && response.userText.trim()) {
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

        // 播放 AI 回應音訊 (PCM 24kHz) — 播放期間暫停麥克風輸入防止回音
        if (response.audio && response.audio.length > 0) {
          geminiService.setSuppressInput(true);
          audioPlayer.playAudio(response.audio, {
            isPCM: true,
            sampleRate: 24000,
            onEnd: () => {
              geminiService.setSuppressInput(false);
            }
          });
        }

        // 更新延遲指標
        if (response.latency) {
          setLatencyMetrics({
            ...response.latency,
            asr: 0,
            llm: 0,
            tts: 0
          });
          addLog(`端到端延遲: ${response.latency.e2e || response.latency.total}ms`, 'info');
        }

        // 更新 Token 使用量
        if (response.tokenUsage) {
          setGeminiTokenUsage(response.tokenUsage);
        }
      };

      geminiService.onInterrupted = () => {
        console.log('[CallContext] Gemini 被中斷（使用者開始說話）');
        audioPlayer.stopPlayback();
        geminiService.setSuppressInput(false);  // 中斷時恢復麥克風
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
        if (status === 'disconnected' && callState === 'connected') {
          addLog('Gemini Live 連線中斷', 'warning');
        }
      };

      // Function Calling 回調 — 處理意圖分析和單據建立
      // 必須回傳 result 物件，供 GeminiLiveService 回傳給 Gemini
      geminiService.onToolCall = ({ name, args, id }) => {
        console.log('[CallContext] 🔧 Tool Call:', name, 'id:', id, args);

        if (name === 'analyze_intent') {
          // 更新 AI 意圖分析面板
          const analysis = {
            intent: args.intent || '未知',
            confidence: args.confidence || 0,
            entities: args.entities || [],
            flags: args.flags || [],
            flagTypes: args.flagTypes || []
          };
          setCurrentAnalysis(analysis);
          addLog(`🔍 意圖分析: ${analysis.intent} (${(analysis.confidence * 100).toFixed(0)}%)`, 'ai');
          if (analysis.entities.length > 0) {
            addLog(`  實體: ${analysis.entities.join(', ')}`, 'info');
          }
          if (analysis.flags && analysis.flags.length > 0) {
            analysis.flags.forEach((flag, idx) => {
              const flagType = analysis.flagTypes?.[idx] || 'warning';
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
          // 解析 details 欄位（可能是 JSON 字串）
          let parsedDetails = {};
          if (args.details) {
            try {
              parsedDetails = typeof args.details === 'string' ? JSON.parse(args.details) : args.details;
            } catch {
              parsedDetails = { raw: args.details };
            }
          }

          const ticket = {
            id: uid(),
            type: args.type || '服務單',
            ticketId: args.ticketId || `TKT-${Date.now()}`,
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

      // 播放歡迎語音 (Gemini Live 回傳 raw PCM 24kHz)
      // 歡迎語播放期間抑制麥克風輸入防止回音
      const geminiSvc = voiceServiceRef.current.getGeminiLiveService();
      if (response.audio_base64) {
        geminiSvc.setSuppressInput(true);
        audioPlayer.playAudio(response.audio_base64, {
          isPCM: true,
          sampleRate: 24000,
          onEnd: () => {
            geminiSvc.setSuppressInput(false);
          }
        });
        addLog('播放歡迎語音 (PCM 24kHz)', 'info');
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
        dialLive();
        break;
      case 'mock':
      default:
        dialMock();
        break;
    }
  }, [voiceMode, dialGeminiLive, dialLive, dialMock]);

  // 傳送音訊到後端 (REST Live 模式專用)
  const sendAudio = useCallback(async (audioBlob) => {
    if (voiceMode !== 'rest-live' || callState !== 'connected' || !scenario) {
      return;
    }

    setIsProcessing(true);
    addLog('處理語音中...', 'system');

    try {
      const response = await voiceServiceRef.current.processUserAudio(audioBlob, scenario);

      // 加入使用者語音轉文字
      if (response.user_text && response.user_text.trim()) {
        setDisplayedConversations(prev => [...prev, {
          id: uid(),
          speaker: 'customer',
          text: response.user_text
        }]);
        addLog(`ASR 辨識: "${response.user_text}"`, 'ai');
      }

      // 加入 AI 回應
      if (response.ai_text) {
        setDisplayedConversations(prev => [...prev, {
          id: uid(),
          speaker: 'ai',
          text: response.ai_text
        }]);
        addLog(`AI 回應: "${response.ai_text.substring(0, 30)}..."`, 'ai');
      }

      // 更新延遲指標
      if (response.latency) {
        setLatencyMetrics(response.latency);
        addLog(`延遲: ASR ${response.latency.asr}ms, LLM ${response.latency.llm}ms, TTS ${response.latency.tts}ms`, 'info');
      }

      // 播放 AI 回應音訊
      if (response.audio_base64) {
        audioPlayer.playAudio(response.audio_base64);
      }

    } catch (err) {
      console.error('Send audio error:', err);
      setError(err.message);
      addLog(`處理失敗: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [voiceMode, callState, scenario, addLog, audioPlayer]);

  // 開始錄音 (REST Live 模式專用)
  const startRecording = useCallback(async () => {
    if (voiceMode !== 'rest-live' || callState !== 'connected') {
      return;
    }

    if (audioPlayer.isPlaying) {
      audioPlayer.stopPlayback();
    }

    await audioRecorder.startRecording();
    addLog('開始錄音...', 'system');
  }, [voiceMode, callState, audioRecorder, audioPlayer, addLog]);

  // 停止錄音並傳送
  const stopRecordingAndSend = useCallback(async () => {
    const audioBlob = await audioRecorder.stopRecording();
    addLog('錄音完成', 'system');

    if (audioBlob) {
      await sendAudio(audioBlob);
    }
  }, [audioRecorder, sendAudio, addLog]);

  // 掛斷
  const hangUp = useCallback(() => {
    // 停止所有進行中的音訊操作
    if (audioRecorder.isRecording) {
      audioRecorder.cancelRecording();
    }
    audioPlayer.stopPlayback();

    // 停止 Gemini Live 串流
    if (isStreaming) {
      voiceServiceRef.current.stopGeminiStreaming();
      setIsStreaming(false);
    }

    // 清理 mediaStream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // 結束 SessionLogger 記錄
    if (voiceMode === 'gemini-live') {
      sessionLogger.endSession();
    }

    // 結束 session (根據模式)
    if (sessionId) {
      if (voiceMode === 'gemini-live') {
        // 清除回調
        const geminiService = voiceServiceRef.current.getGeminiLiveService();
        geminiService.onResponseComplete = null;
        geminiService.onInterrupted = null;
        geminiService.onError = null;
        geminiService.onConnectionChange = null;
        geminiService.onToolCall = null;

        voiceServiceRef.current.endGeminiSession();
        setGeminiConnectionStatus('disconnected');
      } else if (voiceMode === 'rest-live') {
        voiceServiceRef.current.endSession();
      }
      setSessionId(null);
      setConnectionStatus('disconnected');
    }

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
  }, [voiceMode, sessionId, isStreaming, audioRecorder, audioPlayer, addLog, formatDuration, callDuration, displayedConversations.length, tickets.length, geminiTokenUsage.total]);

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
        addLog(`開始建立${action.formType === 'repair' ? '報修單' : action.formType === 'reservation' ? '訂位單' : '訂房單'}`, 'system');
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
      voiceServiceRef.current.stopGeminiStreaming();
      setIsStreaming(false);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // 結束 SessionLogger 記錄
    if (voiceMode === 'gemini-live') {
      sessionLogger.endSession();
    }

    // 清理 session
    if (sessionId) {
      if (voiceMode === 'gemini-live') {
        const geminiService = voiceServiceRef.current.getGeminiLiveService();
        geminiService.onResponseComplete = null;
        geminiService.onInterrupted = null;
        geminiService.onError = null;
        geminiService.onConnectionChange = null;
        geminiService.onToolCall = null;
        voiceServiceRef.current.endGeminiSession();
        setGeminiConnectionStatus('disconnected');
      } else if (voiceMode === 'rest-live') {
        voiceServiceRef.current.endSession();
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
  }, [voiceMode, sessionId, isStreaming]);

  // 切換靜音
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    addLog(isMuted ? '麥克風已開啟' : '麥克風已靜音', 'system');
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

    // 錄音狀態
    isRecording: audioRecorder.isRecording,
    audioLevel: audioRecorder.audioLevel,
    micPermission: audioRecorder.permissionStatus,
    micError: audioRecorder.error,

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

    // 錄音相關方法
    startRecording,
    stopRecordingAndSend,
    cancelRecording: audioRecorder.cancelRecording,
    requestMicPermission: audioRecorder.requestPermission,

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
