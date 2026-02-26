---
name: gemini-live-implementation
description: 在 AI 語音客服助理專案中實作 Gemini Live 模式。當使用者要求實作 Gemini Live、新增 WebSocket 語音功能、或整合 Google Gemini API 端到端語音處理時使用此 Skill。實作時確保不影響現有的 Mock 模式和 REST Live 模式功能。
---

# Gemini Live Implementation

## 概述
此 Skill 用於在 AI 語音客服助理專案中實作 Gemini Live 模式。實作時必須確保不影響現有的 Mock 模式和 REST Live 模式功能。

如需完整的 GeminiLiveService 範本程式碼，請參閱 [templates/GeminiLiveService.js.template](templates/GeminiLiveService.js.template)。

## 專案當前狀態

### 三模式架構
- **Mock 模式** (已實作): 本地腳本展示，無 API 呼叫
- **REST Live 模式** (已實作): ASR → LLM → TTS 三階段處理
- **Gemini Live 模式** (待實作): 端到端即時語音 WebSocket

### 核心檔案結構
```
src/
├─ context/CallContext.jsx     # 全域狀態管理 (現有 mode: 'mock' | 'live')
├─ services/
│  ├─ VoiceService.js          # 語音服務封裝 (現有 REST 方法)
│  ├─ ApiClient.js             # HTTP 客戶端
│  └─ GeminiLiveService.js     # [待建立] Gemini WebSocket 服務
├─ components/
│  ├─ ModeSwitch.jsx           # [待擴充] 模式切換 UI
│  └─ GeminiLivePanel.jsx      # [待建立] Gemini 監控面板
└─ config/api.js               # API 配置
```

## 實作原則

### 向後相容性保證
1. **不修改現有介面**: 保持 `initializeCall()` 和 `processUserAudio()` 原有簽名
2. **新增方法而非修改**: 使用新方法如 `initializeCallGeminiLive()`
3. **狀態隔離**: Gemini 狀態獨立於現有狀態
4. **漸進式切換**: 透過 `voiceMode` 控制三模式分流

### 模式命名規範
```javascript
// CallContext.jsx 中的 voiceMode
'mock'        // 演示模式 (現有)
'rest-live'   // REST Live 模式 (現有 'live' 改名)
'gemini-live' // Gemini Live 模式 (新增)
```

---

## 實作階段

### Phase 1: 環境配置
**目標**: 設定 Gemini API 環境變數

**檔案**: `.env.local` (前端) 或 `my-voice-agent/.env` (如需後端 proxy)

```bash
# .env.local
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GEMINI_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
```

**驗證**: 確認 `import.meta.env.VITE_GEMINI_API_KEY` 可存取

---

### Phase 2: GeminiLiveService 核心實作
**目標**: 建立 WebSocket 連線與音訊處理

**檔案**: `src/services/GeminiLiveService.js`

**核心 API**:
```javascript
class GeminiLiveService {
  constructor(apiKey)
  async initialize(scenario) → { audioBase64, sessionId, latency }
  async processAudio(audioBlob, scenario) → { userText, aiText, audioBase64, latency, tokenUsage }
  close() → void

  // 狀態
  isConnected: boolean
  sessionId: string | null
  tokenUsage: { input: number, output: number, total: number }
}
```

**WebSocket 連線**:
```javascript
// Gemini Live API endpoint
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
```

**音訊格式**:
- Input: 16kHz PCM mono (從 MediaRecorder 轉換)
- Output: 24kHz PCM (Gemini 回傳)

**系統提示設定** (中文):
```javascript
const setupMessage = {
  setup: {
    model: `models/${modelName}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    },
    systemInstruction: {
      parts: [{ text: scenario.systemPrompt || SYSTEM_PROMPTS[scenario.id] }]
    }
  }
};
```

---

### Phase 3: VoiceService 擴充
**目標**: 新增 Gemini Live 方法，不影響現有方法

**檔案**: `src/services/VoiceService.js`

**新增方法** (在現有類別中):
```javascript
// 新增: Gemini Live 相關
import { geminiLiveService } from './GeminiLiveService';

class VoiceService {
  // === 現有方法保持不變 ===
  async initializeCall(scenario) { /* 原 REST 實作 */ }
  async processUserAudio(audioBlob, scenario) { /* 原 REST 實作 */ }

  // === 新增 Gemini Live 方法 ===
  async initializeCallGeminiLive(scenario) {
    return await geminiLiveService.initialize(scenario);
  }

  async processUserAudioGeminiLive(audioBlob, scenario) {
    return await geminiLiveService.processAudio(audioBlob, scenario);
  }

  endGeminiSession() {
    geminiLiveService.close();
  }

  getGeminiTokenUsage() {
    return geminiLiveService.tokenUsage;
  }
}
```

---

### Phase 4: CallContext 狀態管理
**目標**: 支援三模式切換與 Gemini 專屬狀態

**檔案**: `src/context/CallContext.jsx`

**狀態變更**:
```javascript
// 修改: mode → voiceMode，支援三值
const [voiceMode, setVoiceMode] = useState('mock');
// 可選值: 'mock' | 'rest-live' | 'gemini-live'

// 新增: Gemini 專屬狀態
const [geminiTokenUsage, setGeminiTokenUsage] = useState({
  input: 0, output: 0, total: 0
});
const [geminiConnectionStatus, setGeminiConnectionStatus] = useState('disconnected');
// 可選值: 'disconnected' | 'connecting' | 'connected' | 'error'
```

**撥號邏輯修改**:
```javascript
const dial = useCallback(async () => {
  if (voiceMode === 'mock') {
    dialMock();
  } else if (voiceMode === 'rest-live') {
    await dialLive();  // 現有 REST Live
  } else if (voiceMode === 'gemini-live') {
    await dialGeminiLive();  // 新增
  }
}, [voiceMode, dialMock, dialLive, dialGeminiLive]);
```

**新增 dialGeminiLive**:
```javascript
const dialGeminiLive = useCallback(async () => {
  if (!selectedScenarioId || !scenario) return;

  setCallState('dialing');
  setGeminiConnectionStatus('connecting');
  addLog('正在連接 Gemini Live...', 'system');

  try {
    const response = await voiceServiceRef.current.initializeCallGeminiLive(scenario);

    setSessionId(response.sessionId);
    setCallState('connected');
    setGeminiConnectionStatus('connected');

    addLog('Gemini Live 已連接', 'success');
    addLog(`延遲: ${response.latency?.total || 0}ms (端到端)`, 'info');

    if (response.audioBase64) {
      audioPlayer.playAudio(response.audioBase64);
    }

    if (response.aiText) {
      setDisplayedConversations([{
        id: Date.now(),
        speaker: 'ai',
        text: response.aiText
      }]);
    }
  } catch (err) {
    setGeminiConnectionStatus('error');
    setError(err.message);
    setCallState('idle');
    addLog(`Gemini 連接失敗: ${err.message}`, 'error');
  }
}, [selectedScenarioId, scenario, addLog, audioPlayer]);
```

**音訊處理修改**:
```javascript
const sendAudio = useCallback(async (audioBlob) => {
  if (callState !== 'connected' || !scenario) return;

  setIsProcessing(true);

  try {
    let response;

    if (voiceMode === 'gemini-live') {
      response = await voiceServiceRef.current.processUserAudioGeminiLive(audioBlob, scenario);
      setGeminiTokenUsage(response.tokenUsage || geminiTokenUsage);
    } else if (voiceMode === 'rest-live') {
      response = await voiceServiceRef.current.processUserAudio(audioBlob, scenario);
    } else {
      return; // Mock 模式不處理音訊
    }

    // 共用的回應處理...
    if (response.user_text || response.userText) {
      // 加入使用者語音
    }
    if (response.ai_text || response.aiText) {
      // 加入 AI 回應
    }
    // ...
  } catch (err) {
    // 錯誤處理
  } finally {
    setIsProcessing(false);
  }
}, [voiceMode, callState, scenario, geminiTokenUsage]);
```

---

### Phase 5: UI 元件
**目標**: 模式切換器與 Gemini 監控面板

#### 5.1 擴充 ModeSwitch.jsx
```jsx
// src/components/ModeSwitch.jsx
export default function ModeSwitch() {
  const { voiceMode, switchMode, callState } = useCall();

  const modes = [
    { id: 'mock', label: '展示模式', icon: Play },
    { id: 'rest-live', label: 'REST Live', icon: Server },
    { id: 'gemini-live', label: 'Gemini Live', icon: Zap, badge: '實驗' }
  ];

  return (
    <div className="flex gap-2">
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => switchMode(mode.id)}
          disabled={callState !== 'idle' && callState !== 'ended'}
          className={voiceMode === mode.id ? 'bg-blue-600' : 'bg-slate-700'}
        >
          <mode.icon size={16} />
          {mode.label}
          {mode.badge && <span className="text-xs">{mode.badge}</span>}
        </button>
      ))}
    </div>
  );
}
```

#### 5.2 新增 GeminiLivePanel.jsx
```jsx
// src/components/GeminiLivePanel.jsx
export default function GeminiLivePanel() {
  const { voiceMode, geminiTokenUsage, geminiConnectionStatus, latencyMetrics } = useCall();

  if (voiceMode !== 'gemini-live') return null;

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-emerald-400 font-semibold mb-3">Gemini Live 監控</h3>

      {/* 連線狀態 */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${
          geminiConnectionStatus === 'connected' ? 'bg-green-500' :
          geminiConnectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
          'bg-red-500'
        }`} />
        <span>{geminiConnectionStatus}</span>
      </div>

      {/* Token 使用量 */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-slate-400">Input</span>
          <div>{geminiTokenUsage.input}</div>
        </div>
        <div>
          <span className="text-slate-400">Output</span>
          <div>{geminiTokenUsage.output}</div>
        </div>
        <div>
          <span className="text-slate-400">Total</span>
          <div>{geminiTokenUsage.total}</div>
        </div>
      </div>

      {/* 端到端延遲 */}
      <div className="mt-3">
        <span className="text-slate-400">E2E 延遲</span>
        <div className="text-2xl font-mono">{latencyMetrics.total}ms</div>
      </div>
    </div>
  );
}
```

---

### Phase 6: 配置更新
**目標**: 新增 Gemini Live 相關配置

**檔案**: `src/config/api.js`

```javascript
// 新增 Gemini 配置
export const GEMINI_CONFIG = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',

  // WebSocket 設定
  wsUrl: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',

  // 音訊設定
  audio: {
    inputSampleRate: 16000,
    outputSampleRate: 24000,
    channels: 1
  },

  // 語音設定
  voice: {
    default: 'Kore',  // 支援中文的預設語音
    alternatives: ['Puck', 'Charon', 'Aoede']
  },

  // 延遲閾值 (端到端)
  latencyThresholds: {
    good: 400,
    warning: 700,
    critical: 1000
  }
};

// Gemini 系統提示 (可與 REST 共用或獨立)
export const GEMINI_SYSTEM_PROMPTS = {
  telecom: `你是中華電信的AI客服助理。用繁體中文、親切專業的語氣回答。回覆簡潔，控制在50字內。`,
  restaurant: `你是雅緻軒餐廳的訂位助理。用繁體中文、親切專業的語氣協助訂位。回覆簡潔，控制在50字內。`,
  hotel: `你是晶華渡假酒店的訂房助理。用繁體中文、親切專業的語氣協助訂房。回覆簡潔，控制在50字內。`
};
```

---

## 驗證清單

### Phase 1 完成條件
- [ ] `.env.local` 已建立且包含 `VITE_GEMINI_API_KEY`
- [ ] `import.meta.env.VITE_GEMINI_API_KEY` 可正確讀取

### Phase 2 完成條件
- [ ] `GeminiLiveService.js` 已建立
- [ ] WebSocket 可成功連線到 Gemini API
- [ ] 可發送系統提示並收到歡迎語音
- [ ] 音訊格式轉換正確 (16kHz → 24kHz)

### Phase 3 完成條件
- [ ] `VoiceService.js` 新增 Gemini 方法
- [ ] 現有 `initializeCall()` 和 `processUserAudio()` 未被修改
- [ ] 單元測試: REST 方法仍可正常運作

### Phase 4 完成條件
- [ ] `voiceMode` 支援三值切換
- [ ] Mock 模式仍可正常使用 (回歸測試)
- [ ] REST Live 模式仍可正常使用 (回歸測試)
- [ ] Gemini Live 可成功撥號並對話

### Phase 5 完成條件
- [ ] 模式切換 UI 顯示三個選項
- [ ] Gemini Live Panel 在對應模式下顯示
- [ ] Token 使用量正確追蹤

### Phase 6 完成條件
- [ ] `GEMINI_CONFIG` 可正確導入
- [ ] 延遲閾值在 UI 中正確呈現

---

## 故障排除

### WebSocket 連線失敗
1. 檢查 API Key 是否有效
2. 確認網路環境允許 WebSocket 連線
3. 查看 Chrome DevTools Network → WS 頁籤

### 音訊無法播放
1. 確認 Base64 解碼正確
2. 檢查 AudioContext sample rate 設定
3. 驗證音訊格式為 PCM

### 中文回應品質不佳
1. 調整系統提示，明確要求繁體中文
2. 嘗試不同的語音模型 (Kore, Puck)
3. 確認輸入音訊清晰度

---

## 回滾策略

如實作過程中發現問題，可快速回滾：

1. `voiceMode` 預設值改回 `'mock'`
2. 移除 UI 中的 Gemini Live 選項
3. 服務層的 Gemini 方法保留但不呼叫

所有 Gemini 相關程式碼應以**新增**方式加入，而非修改現有程式碼，確保可安全回滾。
