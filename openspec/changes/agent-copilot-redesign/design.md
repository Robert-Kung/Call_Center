## Context

目前 AgentView 是一個簡單的二分欄佈局（左：場景選擇/對話；右：意圖分析 + 單據 + Log），本質上只是 DemoView 的子集。在實際客服場景中，值機員需要的是：

1. 即時看到雙方對話文字（逐字稿）
2. AI 自動產生的通話摘要（不用自己記）
3. 客戶資料卡（從對話中自動擷取的關鍵欄位）
4. 建議回應（下一步該說什麼）
5. 轉接給真人時的脈絡打包

技術棧：React + Tailwind + CallContext，已有 Gemini Live function calling 基礎（`analyze_intent` / `create_ticket`），可擴充新 tool。

## Goals / Non-Goals

**Goals:**
- 將 AgentView 重設計為三欄式 AI 值機助理佈局
- Mock 模式用預設腳本資料即可跑通完整 demo 流程
- Gemini Live 模式透過新增 `generate_summary` function call 實現即時摘要
- 轉接功能產生結構化交接包（JSON-like summary）
- 所有新增狀態走 CallContext，三模式相容

**Non-Goals:**
- 不做真正的電話轉接（SIP/PSTN）— 只做 UI 展示
- 不做真正的 CRM 系統對接 — 快速查詢用 mock 資料
- 不動 DemoView / ConsumerView / SystemView / HistoryView
- 不改 GeminiLiveService 連線邏輯（僅新增 tool handler）
- 不做多語系

## Decisions

### 1. 三欄式佈局結構

```
┌────────────────┬───────────────────┬────────────────────────────┐
│  左欄 (30%)    │  中欄 (35%)       │  右欄 (35%)                │
│                │                   │                            │
│  即時逐字稿    │  客戶識別卡        │  AI 即時摘要               │
│  (chat-style)  │  ─────────────     │  ─────────────             │
│                │  意圖分析          │  建議回應                  │
│                │  ─────────────     │  ─────────────             │
│                │  產生單據          │  快速查詢結果              │
│                │                   │  ─────────────             │
│                │                   │  轉接交接包（觸發時展示）   │
└────────────────┴───────────────────┴────────────────────────────┘
```

**Why**: 客服值機員最常看的是逐字稿（左欄固定寬度滾動），其次是客戶上下文（中欄），最後是 AI 輔助建議（右欄）。三欄對齊桌面螢幕使用場景，寬度 ≥1280px。

**Alternative rejected**: Tab 切換式（隱藏資訊、增加操作步驟）

### 2. 摘要生成策略

| 模式 | 實作方式 |
|------|---------|
| Mock | `scenarios.js` 中每輪對話附帶 `summary` 欄位，隨步進更新 |
| Gemini Live | 新增 `generate_summary` tool declaration，AI 每 2-3 輪主動呼叫，回傳結構化摘要 |
| WS Live | 不支援 function calling（後端限制），fallback 顯示最後一次 `analyze_intent` 的結果作為簡易摘要 |

**Why**: 用 function calling 而非另外呼叫 API，因為摘要需要完整對話脈絡，Gemini session 內已有 context。

**`generate_summary` tool schema:**
```json
{
  "name": "generate_summary",
  "description": "生成目前通話的即時摘要，包含客戶主要需求、情緒狀態、已完成步驟",
  "parameters": {
    "type": "object",
    "properties": {
      "summary": { "type": "string", "description": "50字以內的通話摘要" },
      "customerName": { "type": "string" },
      "mainIssue": { "type": "string" },
      "emotionState": { "type": "string", "enum": ["positive", "neutral", "frustrated", "angry"] },
      "completedSteps": { "type": "array", "items": { "type": "string" } },
      "nextAction": { "type": "string", "description": "建議下一步行動" }
    },
    "required": ["summary", "mainIssue", "emotionState"]
  }
}
```

### 3. 轉接交接包

觸發：點擊「轉接真人」按鈕 → 彈出交接面板（overlay 或右欄展開）

內容結構：
```json
{
  "handoffTime": "2026-05-26T14:05:00Z",
  "duration": "3:24",
  "customer": { "name": "林志豪", "phone": "02-2876-XXXX", "relation": "配偶" },
  "intent": "報修申訴",
  "summary": "客戶因太太名下寬頻斷線3天來電，情緒激動，影響在家工作",
  "entities": ["門號:02-2876-XXXX", "戶名:林美玲", "問題:網路斷線"],
  "flags": ["情緒激動", "客戶急迫"],
  "conversationCount": 6,
  "suggestedAction": "確認線路狀態後安排技師上門"
}
```

**Mock**: 從當前 `currentAnalysis` + `displayedConversations` 組裝  
**Gemini Live**: 觸發 `generate_summary` 取得最新摘要後組裝

### 4. 客戶識別卡的資料來源

從 `currentAnalysis.entities` 解析結構化欄位：
- 解析 `"戶名:林美玲"` → `{ label: "戶名", value: "林美玲" }`
- 搭配 `currentAnalysis.intent` 和 `currentAnalysis.flags`

不需要新的 function call，直接復用已有的 `analyze_intent` 結果。

### 5. 建議回應的生成

| 模式 | 來源 |
|------|------|
| Mock | `scenarios.js` 新增 `suggestedResponse` 欄位 |
| Gemini Live | `generate_summary` 的 `nextAction` 欄位，或另增 `suggest_response` tool（v2 再考慮） |

MVP 先用 `generate_summary.nextAction` 就好，避免 tool 過多影響 Gemini 行為穩定性。

### 6. 元件拆分

```
src/views/AgentView.jsx          → 主佈局（三欄 container）
src/components/agent/
  ├── TranscriptPanel.jsx        → 左欄：即時逐字稿
  ├── CustomerInfoCard.jsx       → 中欄上：客戶識別卡
  ├── IntentAnalysisCard.jsx     → 中欄中：意圖分析（從現有 AnalysisPanel 精簡）
  ├── TicketCard.jsx             → 中欄下：單據（精簡版）
  ├── AiSummaryPanel.jsx         → 右欄上：AI 摘要
  ├── SuggestedResponseCard.jsx  → 右欄中：建議回應
  ├── QuickQueryPanel.jsx        → 右欄下：快速查詢
  └── HandoffOverlay.jsx         → 轉接交接包 overlay
```

### 7. CallContext 新增 state

```javascript
// 新增
const [currentSummary, setCurrentSummary] = useState(null);
const [suggestedResponse, setSuggestedResponse] = useState('');
const [handoffPackage, setHandoffPackage] = useState(null);
const [isHandoffMode, setIsHandoffMode] = useState(false);

// 新增 action
const generateHandoff = useCallback(() => { ... }, []);
```

## Risks / Trade-offs

- **[Tool 過多影響 Gemini 品質]** → 先只加 `generate_summary` 一個 tool，觀察穩定性後再決定是否拆分
- **[三欄在窄螢幕崩壞]** → 設定 `min-w-[1280px]`，小螢幕 fallback 為 Tab 模式（v2）
- **[Mock 腳本維護成本]** → 只為「電信」場景寫完整 summary 資料，其他場景 fallback 顯示「摘要生成中...」
- **[generate_summary 呼叫時機]** → 若 Gemini 不主動呼叫，需在 system prompt 加入「每 2-3 輪對話後呼叫 generate_summary」指令
- **[轉接是假功能]** → 明確標示「Demo 展示用」，不做真正的電話轉接
