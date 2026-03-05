## Plan: REST Live WebSocket 重構

**TL;DR** — 將 REST Live 模式從 HTTP request-response 改為 WebSocket 雙向串流架構，**仿 Gemini Live 模式**的設計模式。前端新建 `RestWebSocketService`，透過 WebSocket 持續串流 PCM 音訊至後端（後端負責 VAD + ASR→LLM→TTS），後端以 base64 JSON 串流回傳 TTS 音訊 chunks + 文字。移除舊 REST HTTP 路徑（`ApiClient` 的 `sendAudio`/`startSession`），保留 `healthCheck`。使用者稍後自行設置後端 WebSocket server。

---

**Steps**

### Phase 1: 新增配置 — `REST_WS_CONFIG`

1. 在 `src/config/api.js` 新增 `REST_WS_CONFIG`，結構仿 `GEMINI_CONFIG`：
   - `wsUrl`：從 `VITE_REST_WS_URL` 環境變數讀取（預設 `ws://192.168.2.100:3000/ws`）
   - `audio.inputSampleRate`：使用瀏覽器原生 sampleRate（同 Gemini 模式）
   - `audio.outputSampleRate`：依後端 TTS 輸出格式（預設 24000）
   - `audio.inputFormat`：`audio/pcm;rate={actualRate}`（base64 JSON）
   - `audio.outputFormat`：`audio/pcm;rate=24000`
   - `voice`：保留 `default: 'Verna'`，`options` 沿用 CosyVoice 可用角色
   - `connection.timeout`：10000ms、`connection.responseTimeout`：30000ms
   - `latencyThresholds`：保留 ASR/LLM/TTS/total 四段式閾值（從現有 `API_CONFIG.latencyThresholds` 搬過來）
2. `API_CONFIG` 中移除 `endpoints.talk`、`timeout`、`retries`（不再需要 HTTP 端點配置），僅保留 `baseUrl` 供 `healthCheck` 使用

### Phase 2: 新建 `RestWebSocketService`

3. 新建 `src/services/RestWebSocketService.js`，參照 `GeminiLiveService.js` 結構，包含：

   **連線生命週期方法：**
   - `constructor()` — 初始化 state、buffers、callbacks
   - `async initialize(scenario)` — 建立 WebSocket → 發送 setup 訊息（scenario、system prompt、voice_id）→ 等 `connection_established` → 發送 welcome trigger → 等首次 `turn_complete` → 回傳 `{ sessionId, audioBase64, aiText, latency }`
   - `async startStreaming(mediaStream)` — 建立 `AudioContext` + `ScriptProcessorNode`，float32→int16→base64，透過 WebSocket 送 `realtimeInput` 訊息
   - `stopStreaming()` — 斷開 audio pipeline
   - `close()` — stopStreaming + 送 hangup control 訊息 + ws.close + reset state
   - `setSuppressInput(suppress)` — 回音抑制（播放時暫停送音）
   - `getConnectionStatus()` / `isCurrentlyStreaming()`

   **Callback 屬性（由 CallContext 注入）：**
   - `onResponseComplete({ audio, aiText, userText, latency })` — 一輪對話結束
   - `onAudioChunk(base64Chunk)` — 接收到 TTS 串流音訊 chunk
   - `onTranscript({ type: 'input'|'output', text })` — ASR 辨識結果 / AI 回應文字
   - `onInterrupted()` — 使用者打斷（barge-in）
   - `onError(error)` — 錯誤
   - `onConnectionChange(status)` — 連線狀態變化
   - `onAnalysis(analysisData)` — 意圖分析結果（取代 Gemini 的 `onToolCall`）
   - `onTicketCreated(ticketData)` — 工單建立通知

   **WebSocket 訊息協定（Client → Server）：**
   - **Setup**：`{ type: 'setup', scenario, systemPrompt, voiceId, sessionId }`
   - **Audio**：`{ type: 'audio_input', data: '<base64 PCM>', mimeType: 'audio/pcm;rate=48000' }`
   - **Control**：`{ type: 'control', command: 'hangup' | 'barge_in' }`

   **WebSocket 訊息協定（Server → Client）：**
   - `{ type: 'connection_established', sessionId, status }`
   - `{ type: 'transcript', role: 'user'|'assistant', text, isFinal }`
   - `{ type: 'audio_chunk', data: '<base64 PCM>' }` — TTS 串流 chunk
   - `{ type: 'turn_complete', aiText, userText, latency: { asr, llm, tts, total } }` — 一輪結束
   - `{ type: 'interrupted' }` — 打斷確認
   - `{ type: 'analysis', intent, entities, flags }` — 意圖分析
   - `{ type: 'ticket_created', ticket: {...} }` — 工單
   - `{ type: 'error', code, message }`

   **核心內部邏輯（仿 GeminiLiveService）：**
   - `_connect()` — new WebSocket + onopen/onerror/onclose 處理
   - `_handleMessage(data)` — JSON.parse → 依 `type` 分派處理
   - `_sendMessage(obj)` — JSON.stringify + ws.send
   - `_sendRealtimeAudio(base64)` — 封裝成 `audio_input` 訊息
   - 音訊 buffer 累積：`audioBuffer[]` 在 `audio_chunk` 時 push，`turn_complete` 時 join → 觸發 `onResponseComplete`
   - 文字 buffer 累積：`outputTranscriptBuffer` / `inputTranscriptBuffer`
   - `_responseStartTime` 用於前端 e2e 延遲計算

4. 新增 `SessionLogger` 支援 — 在 `RestWebSocketService` 中加入 `SessionLogger` 記錄（`session-rest-ws-*` 前綴），記錄 `audio_input`、`transcript`、`turn_complete` 等事件

### Phase 3: 修改 `VoiceService` — 新增 REST WS 委派方法

5. 在 `src/services/VoiceService.js` 中：
   - Import `RestWebSocketService`
   - 在 constructor 中建立 `this.restWsService = new RestWebSocketService()`
   - 新增委派方法（仿 Gemini 模式模式）：
     - `initializeCallRestWs(scenario)` → `restWsService.initialize(scenario)`
     - `startRestWsStreaming(mediaStream)` → `restWsService.startStreaming(mediaStream)`
     - `stopRestWsStreaming()` → `restWsService.stopStreaming()`
     - `isRestWsStreaming()` → `restWsService.isCurrentlyStreaming()`
     - `getRestWsService()` → 回傳 `restWsService` 單例（供 callback 注入）
     - `endRestWsSession()` → `restWsService.close()`
     - `getRestWsConnectionStatus()` → `restWsService.getConnectionStatus()`
   - **移除**舊 REST 方法：`initializeCall()`、`processUserAudio()`、`endSession()` （或標記 `@deprecated`）

### Phase 4: 修改 `CallContext` — 重寫 `rest-live` 流程

6. 在 `src/context/CallContext.jsx` 中：

   **替換 `dialLive()` 為 `dialRestWs()`，仿 `dialGeminiLive()` 模式：**
   - `callState='dialing'`、`connectionStatus='connecting'`
   - `navigator.mediaDevices.getUserMedia()` 取得 mic stream（與 Gemini 相同方式，**不再使用 `useAudioRecorder`**）
   - 從 `voiceService.getRestWsService()` 取得服務實例
   - 注入 callbacks：`onResponseComplete`、`onAudioChunk`、`onTranscript`、`onInterrupted`、`onError`、`onConnectionChange`、`onAnalysis`、`onTicketCreated`
   - 呼叫 `voiceService.initializeCallRestWs(scenario)` → 取得 welcome
   - 播放 welcome audio（PCM + suppress）
   - `voiceService.startRestWsStreaming(micStream)` → `setIsStreaming(true)`
   - `callState='connected'`

   **`onResponseComplete` callback 處理：**
   - 新增 user/AI 文字到 `displayedConversations`
   - 播放 PCM audio，播放前 `setSuppressInput(true)`，結束後 `setSuppressInput(false)`
   - 更新 `latencyMetrics`（含 asr/llm/tts/total 四段）

   **`onAnalysis` / `onTicketCreated` callback 處理：**
   - 直接更新 `currentAnalysis` / 新增到 `tickets`
   - 取代 Gemini 的 `onToolCall` 邏輯（因為分析和工單是後端主動推送，不是 function calling）

   **`onAudioChunk` callback（串流播放）：**
   - **Option A（MVF）**：暫時累積到 buffer，待 `turn_complete` 後一次播放（同現有 Gemini 行為）
   - **Option B（進階）**：實現真正的串流播放（在 `useAudioPlayer` 增加 `streamPCMAudio` 方法）
   - 建議先做 Option A，之後再迭代

   **`hangUp()` 修改：**
   - 在 `voiceMode === 'rest-live'` 分支中，仿 Gemini hangup 流程
   - 停止 streaming → 停止 mic tracks → 清空 callbacks → `endRestWsSession()`

   **移除舊邏輯：**
   - 刪除 `sendAudio()` 函式（HTTP POST 方式）
   - 刪除 `startRecording()` / `stopRecordingAndSend()` 的 REST 分支
   - 清理 `isProcessing` 在 REST 模式的用途（不再需要，streaming 模式用 `isStreaming`）

### Phase 5: 移除舊模組

7. **移除或清理 `ApiClient`**：
   - `src/services/ApiClient.js` 中刪除 `startSession()`、`sendAudio()`、`_fetchWithRetry()`
   - 保留 `healthCheck()` 方法（可用於檢測後端 WS server 是否存活）
   - 如果 `healthCheck` 是唯一剩餘方法，考慮改為簡易 utility function 或合併到 `RestWebSocketService`

8. **`useAudioRecorder` hook**：
   - REST Live 模式不再使用此 hook（改用直接 `getUserMedia` + `RestWebSocketService.startStreaming`）
   - 如果 Mock 模式也不需要（目前 Mock 模式是腳本播放，不錄音），此 hook 可考慮**完全移除**
   - 如果保留，標註僅供特殊用途

### Phase 6: UI 調整

9. **`ModeSwitch` 組件** `src/components/ModeSwitch.jsx`：
   - `'rest-live'` 模式名稱可考慮更新為反映 WebSocket 架構（如 `'ws-live'` 或保持 `'rest-live'` — 視使用者偏好）
   - 更新 mode 描述文字

10. **新增 `RestWsPanel` 組件**（仿 `src/components/GeminiLivePanel.jsx`）：
    - 顯示 WebSocket 連線狀態
    - 顯示 ASR / LLM / TTS / Total 四段延遲（色彩編碼）
    - 顯示目前後端 pipeline 資訊
    - 在 `voiceMode === 'rest-live'` 時渲染

11. **`PhoneSimulator` 組件**：
    - 在 `rest-live` 模式移除 PTT 相關按鈕（錄音 start/stop）
    - 改為顯示連續串流狀態指示器（麥克風活躍中）
    - 行為與 Gemini Live 模式一致

12. **`useAudioPlayer`** `src/hooks/useAudioPlayer.js`：
    - REST WS 模式現在也使用 `playPCMAudio`（與 Gemini 相同路徑）
    - 如後端 TTS 輸出的 sampleRate 不同於 24000，需確保 config 可配

### Phase 7: 配置與文檔

13. 更新 `.env` / Docker 配置：
    - 新增 `VITE_REST_WS_URL` 環境變數
    - 更新 `docker-compose.dev.yml` 和 `docker-compose.yml`
    - Vite proxy 若需支援 WebSocket upgrading，更新 `vite.config.js`

14. 更新 `src/data/scenarios.js`：
    - 確認 `SYSTEM_PROMPTS` 和 `WELCOME_MESSAGES` 仍適用
    - 如果後端現在自行處理 system prompt，評估是否需要透過 setup 訊息傳遞

15. 同步更新文件：
    - `.github/copilot-instructions.md` — 更新 REST Live 的說明
    - `docs/PROGRESS.md` — 記錄重構進度
    - `STRUCTURE.md` — 更新檔案結構

---

**Verification**

1. **Unit check**：`RestWebSocketService` 可以 `new` + `initialize()` + `startStreaming()` + `close()` 不報錯（需假後端或 mock WS）
2. **Mock 模式不受影響**：切到 `voiceMode='mock'` 驗證所有 scenario 正常播放
3. **Gemini Live 不受影響**：切到 `voiceMode='gemini-live'` 驗證連線 + 語音對話正常
4. **REST WS 前端流程**：在無後端情況下驗證 — 撥號時 WebSocket 嘗試連線 → 顯示 connecting → 超時顯示 error（確認 lifecycle 正確）
5. **整合測試**（待後端就緒）：撥號 → 連線 → 說話 → 收到 ASR transcript → 收到 AI audio + text → 播放 → 掛斷
6. **ESLint / build**：`npm run build` 無錯誤

---

**Decisions**

- **移除舊 REST HTTP 路徑**：不保留 fallback，完全切換到 WebSocket
- **音訊格式統一 base64 JSON**：不使用 binary WebSocket frame，與 Gemini Live 一致，簡化訊息處理
- **前端不做 VAD**：所有 VAD 由後端處理，前端僅負責連續串流 PCM
- **分析與工單改為後端推送**：不使用 function calling 模式，後端直接推 `analysis` / `ticket_created` 訊息
- **先做 Option A（buffer → 一次播放）**：TTS 串流播放的真正 chunked playback 留後續迭代
- **新建 `RestWebSocketService` 而非改造 `ApiClient`**：保持模組職責清晰，與 `GeminiLiveService` 平行存在
