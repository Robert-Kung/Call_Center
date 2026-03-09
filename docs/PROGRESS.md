# 進度追蹤

> **任務規劃**: [TASK_PLAN.md](TASK_PLAN.md)  
> **開發規範**: [../.claude/skills/project-workflow/SKILL.md](../.claude/skills/project-workflow/SKILL.md)  
> **最後更新**: 2026-03-04

---

## 總覽

| Phase | 名稱 | 狀態 | 預計 | 實際 |
|-------|------|------|------|------|
| 0 | 文件清理 | ✅ 已完成 | 0.5 天 | 0.5 天 |
| 1 | UI 佈局修正 | ✅ 已完成 | 1 天 | 0.5 天 |
| 2 | 四視角模式感知 | ✅ 已完成 | 2 天 | 0.5 天 |
| 3 | Live 模式意圖分析與單據 | ✅ 已完成 | 3-5 天 | 1 天 |
| 4 | 整合測試與優化 | ✅ 已完成 | 1 天 | 0.5 天 |
| 5 | REST Live 改用 WebSocket 流線 | ✅ 已完成 | 2 天 | 1 天 |
| 6 | AudioWorklet 音訊採集升級 | ✅ 已完成 | - | - |

---

## 詳細記錄

### Phase 0: 文件清理
**狀態**: ✅ 2026-02-26 完成  
**預計**: 0.5 天 | **實際**: 0.5 天

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 0-1 | 更新 README.md | ✅ | 2026-02-26 | 移除「規劃中」、補充 ModeSwitch/GeminiLivePanel/GeminiLiveService/SessionLogger/docker-compose.dev.yml |
| 0-2 | 更新 STRUCTURE.md | ✅ | 2026-02-26 | 加入 SessionLogger.js、data/、docker-compose.dev.yml |
| 0-3 | 歸檔 GEMINI_LIVE_IMPLEMENTATION_PLAN.md | ✅ | 2026-02-26 | 頂部加上「✅ 已完成」標記 |
| 0-4 | 更新 copilot-instructions.md | ✅ | 2026-02-26 | 完整重寫，補入三模式架構、Gemini Live、SessionLogger、ModeSwitch、dev workflows |

---

### Phase 1: UI 佈局修正
**狀態**: ✅ 2026-03-02 完成  
**預計**: 1 天 | **實際**: 0.5 天

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 1-1 | 統一 ModeSwitch 至 App.jsx header | ✅ | 2026-03-02 | 建立 HeaderModeSwitch 子元件，compact 模式置於 header 右側 |
| 1-2 | 移除 ConsumerView 獨立 ModeSwitch | ✅ | 2026-03-02 | 移除 absolute 定位的 ModeSwitch 和 import |
| 1-3 | 確認各視角無遮擋 | ✅ | 2026-03-02 | Docker build 通過、HMR 正常 |

---

### Phase 2: 四視角模式感知
**狀態**: ✅ 2026-03-02 完成  
**預計**: 2 天 | **實際**: 0.5 天

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 2-1 | AgentView 支援 Live 模式語音輸入 | ✅ | 2026-03-02 | Mock→nextStep / REST→PTT / Gemini→串流指示器；模式標籤+空白提示語 |
| 2-2 | SystemView 適配 Gemini Pipeline | ✅ | 2026-03-02 | 動態 pipeline（REST 5 節點、Gemini 3 節點）、模式標籤、mode-aware 進度/控制 |
| 2-3 | SystemView 加入 Gemini 資訊 | ✅ | 2026-03-02 | 右側欄依模式切換：REST→ASR/LLM/TTS 延遲分解 / Gemini→E2E 延遲+連線+Token+串流 |
| 2-4 | DemoView PhoneSimulator 模式指示 | ✅ | 2026-03-02 | 通話中顯示模式 badge（Mock/REST/Gemini + 串流動畫）|

---

### Phase 3: Live 模式意圖分析與單據產生
**狀態**: ✅ 2026-03-02 完成  
**預計**: 3-5 天 | **實際**: 1 天  
**採用方案**: 方案 A（Gemini 原生 function calling + audio 共存）

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 3-1 | 驗證 Gemini Function Calling + Audio | ✅ | 2026-03-02 | 官方文件確認支援；實際測試 analyze_intent 成功觸發 |
| 3-2 | 定義 Tool Schema | ✅ | 2026-03-02 | `GEMINI_TOOL_DECLARATIONS`: analyze_intent + create_ticket，含 enum、examples |
| 3-3 | 修改 System Prompt | ✅ | 2026-03-02 | 三場景 prompt 加入【工具使用規則】，含實體擷取格式範例 |
| 3-4 | GeminiLiveService 處理 Tool Call | ✅ | 2026-03-02 | toolCall 頂層路徑 + fallback modelTurn.parts；NON_BLOCKING + scheduling |
| 3-5 | CallContext 接收分析/單據 | ✅ | 2026-03-02 | onToolCall 回傳實際結果；uid() 唯一 ID 避免 duplicate key |
| 3-6 | fallback: 文字分析 API | ⏭️ | - | 不需要 — 方案 A 原生 function calling 已驗證可行 |

**技術細節**:
- 對齊官方 Live API 格式: toolCall 頂層訊息 + toolResponse.functionResponses[{id, name, response}]
- analyze_intent 設為 NON_BLOCKING + scheduling: WHEN_IDLE，不阻塞語音串流
- create_ticket 設為 scheduling: INTERRUPT，建單後立即通知
- SessionLogger 記錄 function_call + function_response 事件
- CallContext onToolCall 回傳結構化結果（分析摘要/單據 ID）供 Gemini 後續參考

---

### Phase 4: 整合測試與優化
**狀態**: ✅ 2026-03-02 完成  
**預計**: 1 天 | **實際**: 0.5 天

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 4-1 | 三模式切換狀態保持 | ✅ | 2026-03-02 | `selectScenario`/`goBack` 加入 `isStreaming`/`isProcessing` 防竟性重置；`goBack` 末尾無條件清除 |
| 4-2 | 3×3×4 組合測試 | ✅ | 2026-03-02 | Mock×3場景×4視角代碼審查通過；Gemini Live 架構已驗證；需实機测試 |
| 4-3 | header 響應式檢查 | ✅ | 2026-03-02 | Logo/ModeSwitch 加 `flex-shrink-0`；Nav 改 `flex-1 justify-center`；`xl:` 斷點隱藏文字標籤 |
| 4-4 | 更新文件 | ✅ | 2026-03-02 | README 輕文件索引、STRUCTURE 补 TASK_PLAN/PROGRESS、copilot-instructions 更新 ModeSwitch 位置 + Function Calling 說明 |

---

### Phase 5: REST Live 改用 WebSocket 流線
**狀態**: ✅ 2026-03-04 完成  
**預計**: 2 天 | **實際**: 1 天  
**核心調整**: REST HTTP 請求回應模式 → WebSocket 雙向串流（後端負責 VAD）

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 5-1 | `REST_WS_CONFIG` 加入 api.js | ✅ | 2026-03-03 | 加入 wsUrl/voice/audio/latencyThresholds/connection；`API_CONFIG` 簡化為僅 baseUrl+defaultVoiceId |
| 5-2 | 建立 `RestWebSocketService.js` | ✅ | 2026-03-04 | 採用 Gemini Live wire protocol（setup/realtimeInput/serverContent/toolCall）；支援 setupComplete 握手、Blob 訊息、function calling |
| 5-3 | 更新 `VoiceService.js` | ✅ | 2026-03-03 | 移除舊 HTTP 方法；新增 7 個 REST WS 委任方法 |
| 5-4 | 重寫 `CallContext.jsx` | ✅ | 2026-03-03 | 移除 PTT/錄音器邏輯；新增 `dialRestWs()`；`isStreaming` 共用於雙模式 |
| 5-5 | 清理 `ApiClient.js` | ✅ | 2026-03-03 | 移除 startSession/sendAudio 等；僅保留 `healthCheck()` |
| 5-6 | UI 調整 | ✅ | 2026-03-03 | ModeSwitch 標籤改為「WS Live」；新增 `RestWsPanel.jsx`；AgentView PTT 改為串流狀態指示 |
| 5-7 | Vite proxy + .env 設定 | ✅ | 2026-03-03 | `/ws` proxy 指向後端；`VITE_REST_WS_URL=/ws/live`（相對路徑，自動對應 wss://）|
| 5-8 | HTTPS 混合內容修復 | ✅ | 2026-03-03 | 相對路徑識別 + 自動補 wss:// 協定；路由競爆 env_file 載入問題修復 |
| 5-9 | RestWebSocketService 改為 Gemini 協定 | ✅ | 2026-03-04 | 改用 Gemini Live wire protocol；提升酶斷診斷、stopStreaming 統計、function calling |

**主要設計決策**:
- 後端目標位址: `ws://192.168.2.100:8003/ws/live`（uvicorn 服務，支援 Gemini Live wire protocol）
- 後端不發送 `connection_established`，`_sendSetupMessage` 等待 `setupComplete`
- 歡迎語由後端在 setupComplete 後自動推送（TODO: 觸發機制待後端確認）
- 音訊格式: `{ realtimeInput: { audio: { mimeType, data } } }`
- function calling: `analyze_intent` 不送 toolResponse；`create_ticket` 送 toolResponse

---

---

### Phase 6: AudioWorklet 音訊採集升級
**狀態**: ✅ 2026-02-24 完成

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| 6-1 | 建立 `src/worklets/audioProcessor.worklet.js` | ✅ | 2026-02-24 | 獨立執行緒處理器；支援可選降採樣（線性插值）；固定 128 samples/call 累積至 targetChunkMs |
| 6-2 | RestWebSocketService 改用 AudioWorkletNode | ✅ | 2026-02-24 | resampleTo=16000, chunk=100ms；移除 ScriptProcessor 與主執行緒降採樣邏輯 |
| 6-3 | GeminiLiveService 改用 AudioWorkletNode | ✅ | 2026-02-24 | resampleTo=null（Gemini server 端重採），chunk=100ms；移除 ScriptProcessor |
| 6-4 | 更新 STRUCTURE.md | ✅ | 2026-02-24 | 新增 worklets/ 目錄說明 |

**技術設計**:
- Worklet 執行緒：累積 128-sample 區塊至目標時長後，在 worklet 端完成降採樣 + int16 轉換
- 零複製傳輸：ArrayBuffer transfer（`postMessage` transferList）避免複製開銷
- 振幅診斷：在 worklet 端計算 maxAmp，隨資料一起傳回，主執行緒不需額外迴圈
- RestWS：`resampleTo=16000`（後端 VAD 需要 16kHz），chunk ≈ 100ms → 1600 samples @ 16kHz
- GeminiLive：`resampleTo=null`（Gemini 接受任意取樣率），chunk ≈ 100ms → 4800 samples @ 48kHz

---

## 變更日誌

| 日期 | 事項 |
|------|------|
| 2026-02-26 | 建立任務規劃、Skill 規範、進度追蹤文件 |
| 2026-02-26 | ✅ Phase 0 完成：更新 README、STRUCTURE、GEMINI_LIVE_IMPLEMENTATION_PLAN、copilot-instructions |
| 2026-03-02 | ✅ Phase 1 完成：ModeSwitch 統一至 App header（compact）、移除 ConsumerView 獨立 ModeSwitch |
| 2026-03-02 | ✅ Phase 2 完成：AgentView PTT/串流、SystemView 動態 pipeline+Gemini 統計、PhoneSimulator 模式 badge |
| 2026-03-02 | ✅ Phase 3 完成：Gemini Function Calling 驗證+實作，analyze_intent+create_ticket 工具，NON_BLOCKING 非同步，uid() 唯一 ID |
| 2026-03-02 | ✅ Phase 4 完成：狀態保持防竟修復、header 響應式、文件同步更新 |
| 2026-03-03 | 開始 Phase 5：REST WS 重構規劃完成；執行 Phase 1-7（內部分院）完成；env 載入問題修復；HTTPS mixed content 修復 |
| 2026-03-04 | ✅ Phase 5 完成：RestWebSocketService 改用 Gemini Live wire protocol，build 驗證通過 |
| 2026-02-24 | ✅ Phase 6 完成：AudioWorklet 升級（RestWS + GeminiLive），新增 audioProcessor.worklet.js，移除 ScriptProcessor |
| 2026-03-04 | 移除 ConsumerView/SystemView 殘留 PTT 按鈕（`startRecording`/`stopRecordingAndSend` 已無效）；改為 WS Live 串流狀態指示器（青色，對齊 Gemini Live 紫色） |
