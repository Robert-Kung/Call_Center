# Gemini Live 整合實作規劃

> ✅ **已完成** — 2026-02 實作完畢。此文件保留作為歷史規劃記錄。  
> 當前功能狀態請參閱 [TASK_PLAN.md](TASK_PLAN.md) 與 [PROGRESS.md](PROGRESS.md)。

**目標**：在現有架構基礎上新增 Gemini Live 模式，實現三模式並行驗證（Mock → REST Live → Gemini Live）

**時間估計**：2-3 週 ✅ 已完成  
**風險等級**：中等（WebSocket 新增，但不影響現有功能）

---

## 架構概覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI 語音客服助理系統                           │
│                      (三模式並行架構)                               │
└─────────────────────────────────────────────────────────────────────┘

前端 (React)
│
├─► 模式切換
│   ├─ Mock 模式 (展示)
│   ├─ REST Live 模式 (現有後端: ASR→LLM→TTS)
│   └─ Gemini Live 模式 (新增: 直連 WebSocket)
│
├─ Mock: 本地 scenarios 腳本
│   └─ 無外部 API 呼叫
│
├─ REST Live: 現有架構保持不變
│   ├─ Browser ──► HTTP POST /webhook/talk
│   └─ Backend ──► ASR/LLM/TTS 分離
│
└─ Gemini Live: WebSocket 直連 Google
    └─ Browser ──► WSS ──► Gemini API
        ├─ Audio: 16kHz PCM → Gemini 處理 → 24kHz PCM output
        ├─ Text: 中文系統提示 + 對話歷史
        └─ Metadata: Token 使用量、即時延遲
```

---

## 詳細實作步驟

### 第一階段：環境與配置 (1-2 天)

#### 任務 1.1：取得 Gemini API 並配置環境

**檔案修改**：`.env` / `my-voice-agent/.env`

```bash
# 新增
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
```

**步驟**：
1. 前往 https://aistudio.google.com/apikey 申請 API Key
2. 在專案根目錄建立 `.env.local`（開發環境）
3. 驗證 API Key 有效性

**驗證點**：
- [ ] API Key 成功儲存
- [ ] 前端能讀取環境變數（Vite `import.meta.env.VITE_GEMINI_API_KEY`）

---

#### 任務 1.2：架構決策文件

**建立**：`GEMINI_LIVE_ARCHITECTURE.md`

**內容**：
- 三模式的差異與適用場景
- WebSocket 通訊協定說明
- 音訊格式轉換規則 (16kHz input → 24kHz output)
- 錯誤處理與 fallback 策略

---

### 第二階段：核心服務實作 (3-5 天)

#### 任務 2.1：建立 GeminiLiveService.js

**檔案**：`src/services/GeminiLiveService.js`

**核心功能**：

```javascript
class GeminiLiveService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.sessionId = null;
    this.conversationHistory = [];
  }

  // 初始化連線
  async initialize(scenario) {
    // 建立 WebSocket 連接
    // 傳送系統提示 (中文)
    // 產生歡迎語音
    return { audioBase64, sessionId, latency };
  }

  // 處理使用者音訊
  async processAudio(audioBlob, scenario) {
    // 串流傳送 16kHz 音訊
    // 接收 24kHz 音訊回應
    // 追蹤 token 使用量
    return { userText, aiText, audioBase64, latency, tokenUsage };
  }

  // 結束會話
  async close() {
    // 清理 WebSocket
    // 回傳會話統計
  }
}
```

**關鍵實作細節**：
- WebSocket 連線管理（重連機制）
- 音訊緩衝與串流處理
- 中文系統提示設定
- Token 使用量統計

**驗證點**：
- [ ] WebSocket 連線成功
- [ ] 中文歡迎語音產生
- [ ] 音訊 blob 正確編碼/解碼

---

#### 任務 2.2：擴充 VoiceService.js

**檔案**：`src/services/VoiceService.js`

**新增方法**：

```javascript
// 支援 Gemini Live 模式
async initializeCallGeminiLive(scenario) {
  // 委派給 GeminiLiveService
}

async processUserAudioGeminiLive(audioBlob, scenario) {
  // 委派給 GeminiLiveService
}

// 保持現有方法不變
async initializeCall(scenario) { /* 現有 REST 實作 */ }
async processUserAudio(audioBlob, scenario) { /* 現有 REST 實作 */ }
```

**驗證點**：
- [ ] 現有 REST 介面未受影響
- [ ] 新增 Gemini 方法正確路由

---

### 第三階段：狀態管理改進 (2-3 天)

#### 任務 3.1：修改 CallContext.jsx

**檔案**：`src/context/CallContext.jsx`

**變更**：

```javascript
// 新增狀態
const [voiceMode, setVoiceMode] = useState('mock'); // 'mock' | 'rest-live' | 'gemini-live'
const [geminiSessionId, setGeminiSessionId] = useState(null);
const [geminiTokenUsage, setGeminiTokenUsage] = useState({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0
});

// 初始化邏輯
const initializeCall = useCallback(async (scenario) => {
  if (voiceMode === 'mock') {
    // 現有 mock 模式
  } else if (voiceMode === 'rest-live') {
    // 現有 REST 模式
    const response = await voiceService.initializeCall(scenario);
  } else if (voiceMode === 'gemini-live') {
    // 新的 Gemini Live 模式
    const response = await voiceService.initializeCallGeminiLive(scenario);
    setGeminiSessionId(response.sessionId);
  }
}, [voiceMode]);

// 處理音訊邏輯
const sendAudio = useCallback(async (audioBlob) => {
  let response;
  if (voiceMode === 'gemini-live') {
    response = await voiceService.processUserAudioGeminiLive(audioBlob, scenario);
    setGeminiTokenUsage(response.tokenUsage);
  } else {
    response = await voiceService.processUserAudio(audioBlob, scenario);
  }
  // 顯示結果
}, [voiceMode, scenario]);
```

**關鍵設計**：
- 三模式的狀態分離（不互相污染）
- 延遲追蹤相容三模式
- 清晰的條件分支邏輯

**驗證點**：
- [ ] Mock 模式仍可正常切換
- [ ] REST Live 模式不受影響
- [ ] Gemini Live 狀態獨立管理

---

### 第四階段：UI 元件更新 (2-3 天)

#### 任務 4.1：建立模式切換元件

**檔案**：`src/components/VoiceModeSwitcher.jsx`（新增）

**功能**：
```jsx
export default function VoiceModeSwitcher() {
  return (
    <div className="flex gap-2">
      <button onClick={() => switchVoiceMode('mock')}>
        展示模式 (Mock)
      </button>
      <button onClick={() => switchVoiceMode('rest-live')}>
        REST Live (ASR→LLM→TTS)
      </button>
      <button onClick={() => switchVoiceMode('gemini-live')}>
        ✨ Gemini Live (實驗)
      </button>
    </div>
  );
}
```

**位置**：在 `PhoneSimulator.jsx` 或 `DemoView.jsx` 中整合

---

#### 任務 4.2：新增 GeminiLivePanel.jsx

**檔案**：`src/components/GeminiLivePanel.jsx`（新增）

**顯示內容**：
- Token 使用量 (input / output)
- 即時串流延遲
- WebSocket 連線狀態
- API 成本估算

**整合位置**：在 `SystemView` 中與 `LatencyMonitor` 並排顯示

---

#### 任務 4.3：修改 PhoneSimulator.jsx

**變更**：
- 通話模式指示器
- 對應的快捷鍵提示 (例：長按切換模式)

---

### 第五階段：測試與驗證 (3-5 天)

#### 任務 5.1：單元測試

**檔案**：`src/services/__tests__/GeminiLiveService.test.js`（新增）

**測試案例**：
```javascript
describe('GeminiLiveService', () => {
  it('should initialize with Chinese system prompt', async () => {});
  it('should handle 16kHz audio input', async () => {});
  it('should return 24kHz audio output', async () => {});
  it('should track token usage', async () => {});
  it('should handle WebSocket reconnection', async () => {});
  it('should support Traditional Chinese conversation', async () => {});
});
```

---

#### 任務 5.2：整合測試

**場景**：
1. **Mock → REST Live → Gemini Live 切換**
   - [ ] 無縫切換不遺失通話狀態
   - [ ] 模式指示器準確顯示

2. **三模式延遲對比**
   - [ ] Mock：0ms (本地)
   - [ ] REST Live：1000-2000ms
   - [ ] Gemini Live：300-600ms
   - [ ] 在儀錶板並排顯示

3. **繁體中文驗證**
   - [ ] 電信場景：「我要查帳單」
   - [ ] 餐廳場景：「晚上八點有位嗎？」
   - [ ] 飯店場景：「房間有 WiFi 嗎？」

4. **錯誤處理**
   - [ ] API Key 無效 → 清楚的錯誤提示
   - [ ] 網路中斷 → 自動重連
   - [ ] Token 限制 → 優雅降級

---

#### 任務 5.3：效能測試

**指標**：
- 首次連線時間 < 2s
- 平均延遲：Gemini Live < 500ms
- 記憶體佔用：單一 session < 50MB
- Token 成本：每則訊息平均 50-100 tokens

---

### 第六階段：文件與知識庫 (1-2 天)

#### 任務 6.1：更新 copilot-instructions.md

**新增內容**：
```markdown
## 三模式架構

### Mock 模式
- 場景：展示演示、開發測試
- 特點：本地腳本，0 延遲

### REST Live 模式（現有）
- 場景：正式環境、可控後端
- 流程：ASR → LLM → TTS
- 特點：分階段延遲可追蹤

### Gemini Live 模式（新增）
- 場景：低延遲展示、成本最佳化
- 流程：端到端語音處理
- 特點：超低延遲、Token 追蹤
```

---

#### 任務 6.2：更新 api-specification.md

**新增 Gemini Live 章節**：
```markdown
## Gemini Live API 規格

### WebSocket 連線
- URL: `wss://generativelanguage.googleapis.com/...`
- 認證: API Key in header
- 音訊格式: 16kHz PCM (input) → 24kHz PCM (output)

### 訊息格式
...
```

---

#### 任務 6.3：建立遷移指南

**檔案**：`GEMINI_LIVE_MIGRATION.md`

**內容**：
- 從 REST Live 遷移到 Gemini Live
- 成本與效能對比
- 故障排除指南

---

## 檔案變更總覽

| 類別 | 檔案 | 操作 | 優先級 |
|------|------|------|--------|
| **新增服務** | `src/services/GeminiLiveService.js` | 建立 | P0 |
| **狀態管理** | `src/context/CallContext.jsx` | 修改 | P0 |
| **語音服務** | `src/services/VoiceService.js` | 擴充 | P0 |
| **UI 元件** | `src/components/VoiceModeSwitcher.jsx` | 建立 | P1 |
| **監控面板** | `src/components/GeminiLivePanel.jsx` | 建立 | P1 |
| **電話模擬** | `src/components/PhoneSimulator.jsx` | 修改 | P1 |
| **測試** | `src/services/__tests__/` | 新增 | P2 |
| **配置** | `.env.local` | 新增 | P0 |
| **文件** | `.github/copilot-instructions.md` | 更新 | P2 |
| **文件** | `api-specification.md` | 更新 | P2 |

---

## 實作順序（建議）

```
Week 1:
├─ 任務 1.1-1.2 (配置環境)
├─ 任務 2.1 (GeminiLiveService)
└─ 任務 2.2 (VoiceService 擴充)

Week 2:
├─ 任務 3.1 (CallContext 改進)
├─ 任務 4.1-4.3 (UI 更新)
└─ 任務 5.1-5.2 (單元+整合測試)

Week 3:
├─ 任務 5.3 (效能測試)
└─ 任務 6.1-6.3 (文件完善)
```

---

## 風險與緩解策略

| 風險 | 影響 | 緩解方案 |
|------|------|---------|
| **WebSocket 連線不穩定** | Gemini Live 無法使用 | 實作自動重連、心跳檢測 |
| **API 成本超預期** | 意外消費 | 實作 token 計數、每日限額 |
| **中文支援不足** | 對話品質下降 | 測試多個中文 prompt 模板 |
| **音訊格式不相容** | 音質問題 | 提前驗證 16kHz → 24kHz 轉換 |
| **現有程式碼破壞** | 回歸問題 | 保持 Mock/REST Live 獨立、充分測試 |

---

## 成功標準

- ✅ 三模式無縫切換，互不干擾
- ✅ Gemini Live 平均延遲 < 600ms
- ✅ 繁體中文對話自然流暢
- ✅ Token 使用量準確追蹤
- ✅ 所有現有功能測試通過
- ✅ 文件完整可維護

---

## 後續擴充（非本期）

1. **OpenAI Realtime API 整合** (Week 4)
   - 類似 Gemini Live 的實作
   - 成本與延遲對比

2. **PersonaPlex 本地部署** (Month 2)
   - GPU 支援（可選）
   - 多語言全雙工支援

3. **效能最佳化** (Ongoing)
   - 音訊壓縮
   - 快取策略

---

## 檢查清單

**開發前**：
- [ ] Gemini API Key 已取得且有效
- [ ] 理解三模式架構
- [ ] 確認 WebSocket 支援環境

**開發中**：
- [ ] 每日同步進度
- [ ] 及時測試 Mock → REST Live 相容性

**發布前**：
- [ ] 完整整合測試通過
- [ ] 文件已更新
- [ ] 效能基準已達成

