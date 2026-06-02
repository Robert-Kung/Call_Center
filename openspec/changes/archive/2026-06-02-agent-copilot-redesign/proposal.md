## Why

目前 AgentView 只是 DemoView 的精簡子集（AI 分析 + 單據 + Log），缺乏真正「客服值機員」需要的工具：即時逐字稿、LLM 摘要、建議回應、客戶資訊查詢、轉接真人時的脈絡交接。這讓 demo 缺少最具說服力的故事線 — **AI 如何輔助真人客服，而非取代他們**。現在 Gemini Live 語音串流已穩定，是時候把 AgentView 改造成一個真正的 AI Copilot 介面。

## What Changes

- **重新設計 AgentView 佈局**：從「場景選擇 + 分析面板」改為三欄式值機台（逐字稿 / 客戶資訊 / AI 輔助）
- **新增即時逐字稿面板**：通話中即時顯示雙方對話文字（復用 `displayedConversations` + `streamingAiText`）
- **新增 LLM 即時摘要**：每輪對話後自動更新摘要，用 Gemini function call `generate_summary` 或 Mock 預設資料
- **新增建議回應框**：根據意圖分析顯示建議話術（Mock 預設 / Gemini 生成）
- **新增客戶識別卡**：擷取的實體結構化顯示（戶名、門號、服務類型、情緒標記）
- **新增「轉接真人」按鈕 + 交接摘要面板**：一鍵生成交接包（摘要 + 意圖 + 實體 + 完整對話連結）
- **新增快速查詢按鈕列**：模擬 CRM/工單系統查詢（帳號、線路狀態、維修記錄）
- **保留 ConsumerView / SystemView / HistoryView 現有功能不動**
- **DemoView 保持現有全貌展示不變**

## Capabilities

### New Capabilities
- `agent-copilot-ui`: AgentView 三欄式值機台佈局設計，含逐字稿、客戶資訊卡、AI 輔助面板
- `realtime-summary`: 通話中即時 LLM 摘要功能，支援 Mock 預設資料與 Gemini Live function call 兩種模式
- `handoff-transfer`: 轉接真人客服時的交接摘要包生成與展示

### Modified Capabilities
<!-- 無既有 spec 需要修改 -->

## Impact

- **前端檔案**：`src/views/AgentView.jsx` 完全重寫；可能新增 `src/components/agent/` 子元件目錄
- **Context 層**：`CallContext.jsx` 新增 `currentSummary`、`suggestedResponse`、`customerProfile`、`handoffPackage` state
- **Config**：`src/config/api.js` 新增 `generate_summary` tool declaration（Gemini Live 模式）
- **Scenarios**：`src/data/scenarios.js` 新增 Mock 模式的摘要、建議回應、客戶資料欄位
- **不影響**：ConsumerView、SystemView、HistoryView、DemoView 現有功能
- **不影響**：GeminiLiveService、RestWebSocketService 核心邏輯（僅新增一個 tool handler）
