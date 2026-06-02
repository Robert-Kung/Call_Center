## 1. Data Layer — CallContext 擴充

- [x] 1.1 新增 state: `currentSummary`, `suggestedResponse`, `handoffPackage`, `isHandoffMode` 至 CallContext
- [x] 1.2 新增 action: `generateHandoff()` — 組裝交接包並設定 `isHandoffMode = true`
- [x] 1.3 新增 `onToolCall` handler 分支：處理 `generate_summary` 回傳資料，更新 `currentSummary`
- [x] 1.4 `switchMode` / `goBack` / `hangUp` 時清除新增 state

## 2. Config — Gemini Tool & Prompt

- [x] 2.1 在 `src/config/api.js` 的 `GEMINI_TOOL_DECLARATIONS` 新增 `generate_summary` schema
- [x] 2.2 更新 `GEMINI_SYSTEM_PROMPTS` — 加入「每 2-3 輪對話主動呼叫 generate_summary」指示
- [x] 2.3 (optional) 確認 `analyze_intent` + `generate_summary` 並存時 Gemini 行為穩定，並驗證 tool 觸發時機（本地 Gemini Live 文字驅動端到端測試，含原 6.2）。**結果 PASS**：5 輪模擬對話中 analyze_intent×5（每輪）、generate_summary×3（turn 1/3/5，符合「每 2-3 輪」）、create_ticket×1（提供問題+門號時）；無自問自答、無語音停頓異常，3 tool 並存穩定。blocking 模式正確，fallback 未啟用。註：模型偶有臆測未提供的地址（grounding 問題，與 tool 穩定性無關）。

## 3. Scenarios — Mock 資料擴充

- [x] 3.1 為 `telecom` 場景每個 conversation step 新增 `summary` 欄位（漸進式摘要）
- [x] 3.2 為 `telecom` 場景新增 `suggestedResponse` 欄位（建議回應話術）
- [x] 3.3 為 `telecom` 場景新增 `customerProfile` 預設資料（快速查詢用 mock 結果）
- [x] 3.4 其他場景（reservation/medical/logistics）至少新增首輪 summary placeholder + customerProfile.queries

## 4. UI Components — AgentView 子元件

- [x] 4.1 建立 `src/components/agent/TranscriptPanel.jsx` — 即時逐字稿（chat bubble + auto-scroll + streaming indicator）
- [x] 4.2 建立 `src/components/agent/CustomerInfoCard.jsx` — 解析 entities 為結構化卡片 + emotion badge
- [x] 4.3 建立 `src/components/agent/IntentAnalysisCard.jsx` — 精簡版意圖分析（intent + confidence + entity tags）
- [x] 4.4 建立 `src/components/agent/TicketCard.jsx` — 精簡版單據列表
- [x] 4.5 建立 `src/components/agent/AiSummaryPanel.jsx` — 摘要文字 + emotion indicator + completedSteps + nextAction
- [x] 4.6 建立 `src/components/agent/SuggestedResponseCard.jsx` — 建議回應顯示
- [x] 4.7 建立 `src/components/agent/QuickQueryPanel.jsx` — 快速查詢按鈕 + mock 結果顯示
- [x] 4.8 建立 `src/components/agent/HandoffOverlay.jsx` — 轉接交接包 overlay（摘要/客戶/意圖/標記/行動）

## 5. AgentView 主頁面重寫

- [x] 5.1 重寫 `src/views/AgentView.jsx` 為三欄佈局（左：TranscriptPanel / 中：CustomerInfoCard + IntentAnalysisCard + TicketCard / 右：AiSummaryPanel + SuggestedResponseCard + QuickQueryPanel）
- [x] 5.2 實作頂部 toolbar：場景資訊 + 模式 badge + 通話計時 + 延遲指標 + 靜音/掛斷/轉接按鈕
- [x] 5.3 實作 idle 狀態場景選擇畫面（接聽模式）
- [x] 5.4 串接「轉接真人」按鈕 → `generateHandoff()` → `HandoffOverlay` 顯示
- [x] 5.5 確保三模式（mock/rest-live/gemini-live）各有正確的資料源 fallback（Mock verified; Live modes use onToolCall path）

## 6. Integration & Testing

- [x] 6.1 Mock 模式完整 demo 流程驗證：選場景 → 接聽 → 逐字稿 + 摘要 + 建議更新 → 轉接
- [x] 6.2 Gemini Live generate_summary 端到端驗證 → 併入 2.3（PASS）
- [-] 6.3 (已刪除) WS Live 無 function calling，generate_summary 不會觸發，此路徑不存在，不需驗證
- [x] 6.4 確認 DemoView / ConsumerView / SystemView / HistoryView 無 regression
- [x] 6.5 Docker build 驗證（`docker compose -f docker-compose.dev.yml up --build`）
