# Plan: Session History 總覽頁面

新增第五個 view「歷史紀錄」，從伺服器 `/data/` 讀取所有 session JSON 檔案，提供統計圖表摘要 + 列表 + 點擊展開詳細對話紀錄。頂部展示 KPI 卡片與分佈圖表，下方為可搜尋/篩選的 session 表格，點擊任一 session 進入詳細頁面顯示逐輪對話、事件時間線、意圖分析與延遲指標。

---

## Phase 1 — 後端 API（讀取 session 資料）

### 1. 擴充 Vite plugin

在 `vite.config.js` 的 `sessionLogPlugin()` 中新增兩個 GET endpoint：

- `GET /api/sessions` — 掃描 `data/` 目錄，讀取每個 JSON 檔的摘要欄位（`sessionId`, `scenarioId`, `scenarioName`, `startTime`, `endTime`, `summary.length`, `events.length`，以及計算出的 `avgLatency`, `mode`, `duration`, `intentCount`, `ticketCount`），回傳 JSON 陣列。
- `GET /api/sessions/:filename` — 回傳指定 session 檔案的完整 JSON 內容。

### 2. 生產環境方案

在 Vite plugin 的 `save` 邏輯中，同時維護一份 `data/sessions-index.json` 索引檔（每次存檔時更新）。在 `Dockerfile` 中將 `data/` 複製進 `dist/data/`，讓 `serve -s dist` 可直接靜態提供 JSON 檔案。前端在 prod 環境 fallback 到 `fetch('/data/sessions-index.json')` + `fetch('/data/session-xxx.json')`。

---

## Phase 2 — 資料服務層

### 3. 新建 `src/services/SessionHistoryService.js`

封裝 API 呼叫邏輯：

- `fetchSessionList()` — 先嘗試 `GET /api/sessions`，失敗則 fallback 讀 `/data/sessions-index.json`。
- `fetchSessionDetail(filename)` — 先嘗試 `GET /api/sessions/:filename`，fallback 讀 `/data/:filename`。
- `computeStats(sessions)` — 從 session 列表計算聚合統計：總 session 數、各模式分佈、各情境分佈、平均延遲、平均對話輪數、總 token 用量、意圖分佈等。

---

## Phase 3 — 統計圖表元件

### 4. 安裝 `recharts`

在 `package.json` 加入 `recharts` 依賴（輕量、React 原生、無額外依賴）。

### 5. 新建 `src/components/history/StatsOverview.jsx`

頂部統計區域：

- **KPI 卡片列**（4 張）：總 Session 數、平均延遲 (ms)、平均對話輪數、意圖辨識率
- **模式分佈** — donut chart（Gemini Live / WS Live / Legacy 各佔比）
- **情境分佈** — bar chart（各 `scenarioName` 的 session 數量）
- **延遲趨勢** — line chart（按時間排序的各 session 平均延遲）
- **意圖分佈** — horizontal bar chart（各 `intent` 出現次數排名）

---

## Phase 4 — Session 列表元件

### 6. 新建 `src/components/history/SessionTable.jsx`

可篩選/排序的 session 表格：

- **欄位**：時間、模式（badge）、情境名稱、對話輪數、平均延遲、意圖摘要、工單數、持續時間
- **頂部篩選列**：模式 filter（全部 / Gemini Live / WS Live / Legacy）、情境 filter、日期範圍
- **排序**：點擊表頭切換升降冪排序
- **點擊某列** → 進入詳細頁面（傳入 filename）
- **空狀態**：無資料時顯示友善提示訊息

---

## Phase 5 — Session 詳細頁面元件

### 7. 新建 `src/components/history/SessionDetail.jsx`

展開後的完整 session 檢視：

- **基本資訊 header**：session ID、模式 badge、情境名稱、時間、持續時間
- **延遲概覽 panel**：每輪延遲 bar chart + 平均 / 最大 / 最小值卡片
- **對話紀錄 panel**：逐輪顯示 user（靠右藍色）/ AI（靠左紫色）對話氣泡，附帶延遲標籤與 token 用量
- **意圖分析 panel**：列出所有 `analyze_intent` function call，顯示 intent、confidence bar、entities、flags
- **工單紀錄 panel**：列出所有 `create_ticket` function call 的詳情
- **事件時間線**（可收合）：全部 events 按 elapsed 時間排列，各 type 用不同顏色 / icon 標識
- **返回按鈕** — 回到列表頁

---

## Phase 6 — History View 主元件

### 8. 新建 `src/views/HistoryView.jsx`

管理列表 / 詳細兩種子頁面狀態：

- `useState` 管理 `selectedSession`（null = 列表頁，有值 = 詳細頁）
- 列表頁：`StatsOverview` + `SessionTable`
- 詳細頁：`SessionDetail`
- Loading / Error 狀態處理
- 使用 `useEffect` + `fetchSessionList()` 在 mount 時載入資料

---

## Phase 7 — 整合進 App

### 9. 修改 `src/App.jsx`

在 `viewConfig` 陣列新增：

```js
{ id: 'history', label: '歷史紀錄', icon: History, description: '通話紀錄總覽' }
```

在 `renderView()` switch 加入 `case 'history': return <HistoryView />`。

Import `HistoryView` 和 lucide-react `History` icon。

---

## Phase 8 — 文件更新

### 10. 更新文件

更新 `STRUCTURE.md`、`README.md`、`.github/copilot-instructions.md` 中的 view 列表（四個 → 五個）及新增的元件 / 服務描述。

---

## Verification Checklist

- [ ] `npm run dev` 啟動後第五個 tab「歷史紀錄」可正常顯示
- [ ] 統計卡片正確顯示 `/data/` 中所有 session 的聚合數據
- [ ] 圖表渲染正常（模式分佈、延遲趨勢、意圖分佈、情境分佈）
- [ ] 表格可按模式 / 情境篩選、按延遲 / 時間排序
- [ ] 點擊任一 session → 展開詳細對話紀錄，逐輪氣泡正確顯示
- [ ] 詳細頁中意圖分析與工單紀錄正確解析
- [ ] 返回按鈕回到列表頁
- [ ] 既有四個 view（demo / consumer / agent / system）功能不受影響
- [ ] 三種 voice mode（Mock / WS Live / Gemini Live）正常運作
- [ ] 無 console 錯誤

---

## Decisions

| 決策項目 | 選擇 | 理由 |
|---------|------|------|
| 圖表庫 | `recharts` | React 生態最成熟、輕量、支援 responsive，不需要 D3 的複雜度 |
| API 架構 | 雙模式（dev Vite plugin + prod 靜態索引） | 避免需要額外 Node server，dev 即時掃描，prod 靜態服務 |
| 狀態管理 | local state（不用 CallContext） | 資料獨立於即時通話狀態，避免汙染既有 context |
| 頁面切換 | local state（不引入 router） | 保持與現有四個 view 一致的單頁架構 |
| Session 模式偵測 | 由 `sessionId` 前綴推斷 | `gemini-` → Gemini Live、`rest-ws-` → WS Live、其他 → Legacy |

---

## Session JSON Schema 參考

```json
{
  "sessionId": "gemini-mmac35cb-8rwngz2",
  "scenarioId": "telecom",
  "scenarioName": "中華電信",
  "startTime": "2026-03-03T08:16:25.909Z",
  "endTime": "2026-03-03T08:17:09.000Z",
  "events": [
    { "type": "session_start", "timestamp": "...", "elapsed": 0 },
    { "type": "turn_complete", "timestamp": "...", "elapsed": 5000,
      "userText": "你好，我要查詢門號",
      "aiText": "請問您想查詢哪一方面？",
      "latency": 1234,
      "tokenUsage": { "input": 100, "output": 50, "total": 150 }
    },
    { "type": "function_call", "timestamp": "...", "elapsed": 6000,
      "name": "analyze_intent",
      "id": "call-xxx",
      "args": { "intent": "費用查詢", "confidence": 0.85, "entities": [], "flags": [] }
    },
    { "type": "session_end", "timestamp": "...", "elapsed": 44000,
      "totalEvents": 87, "duration": 44000
    }
  ],
  "summary": [
    { "userText": "...", "aiText": "...", "latency": 1234, "elapsed": 5000 }
  ]
}
```
