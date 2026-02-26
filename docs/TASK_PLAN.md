# 前端四視角連動與 Live 模式單據產生 — 任務規劃

> **建立日期**: 2026-02-26  
> **進度追蹤**: [PROGRESS.md](PROGRESS.md)  
> **Skill 規範**: [../.claude/skills/project-workflow/SKILL.md](../.claude/skills/project-workflow/SKILL.md)  
> **狀態**: 📋 待確認

---

## 目標

1. 修正 UI 佈局問題（ModeSwitch 與 header 重疊）
2. 讓四個前端視角（Demo / Consumer / Agent / System）在三種模式下都能正常運作
3. 讓 Gemini Live 模式也能產生意圖分析與單據（目前僅 Mock 模式有）
4. 清理過時文件

---

## 現況分析

### 四視角 × 三模式支援矩陣

| 視角 | ModeSwitch | Mock | REST Live | Gemini Live | 意圖分析 | 單據產生 |
|------|:----------:|:----:|:---------:|:-----------:|:--------:|:--------:|
| **DemoView** | ❌ 無 | ✅ | ✅ | ✅ | ✅ Mock only | ✅ Mock only |
| **ConsumerView** | ✅ 右上角(重疊) | ✅ | ✅ PTT | ✅ Streaming | ❌ 無面板 | ❌ 無面板 |
| **AgentView** | ❌ 無 | ✅ | ❌ 無語音輸入 | ❌ 無語音輸入 | ✅ Mock only | ✅ Mock only |
| **SystemView** | ❌ 無 | ✅ | ❌ | ❌ | ❌ | ❌ |

### 核心問題

1. **ModeSwitch 僅存在於 ConsumerView**，且位置 (`absolute top-6 right-6`) 與 App.jsx header 右側「當前視角」文字重疊
2. **意圖分析 / 單據僅 Mock 有資料**，來自 `scenarios.js` 預設腳本中的 `analysis` 和 `ticket_created` action
3. **AgentView / SystemView 完全沒有 Live 模式語音輸入**
4. **SystemView Pipeline 永遠顯示 ASR→LLM→TTS 五節點**，未適配 Gemini 端到端模型

---

## Phase 定義

### Phase 0：文件清理

> 難度 ⭐ | 預計 0.5 天

| # | 任務 | 影響檔案 | 說明 |
|---|------|----------|------|
| 0-1 | 更新 README.md | `README.md` | Gemini Live 改為「已完成」；更新專案結構補上 `ModeSwitch.jsx`、`GeminiLivePanel.jsx`、`GeminiLiveService.js`、`SessionLogger.js`、`docker-compose.dev.yml` |
| 0-2 | 更新 STRUCTURE.md | `STRUCTURE.md` | 加入 `docker-compose.dev.yml`、`data/` 資料夾、`SessionLogger.js` |
| 0-3 | 歸檔 Gemini 實作計畫 | `docs/GEMINI_LIVE_IMPLEMENTATION_PLAN.md` | 頂部加上「✅ 已完成」標記，說明各階段完成狀態 |
| 0-4 | 更新 copilot-instructions.md | `.github/copilot-instructions.md` | 補上 Gemini Live 模式、SessionLogger、ModeSwitch 描述 |

**驗收標準**: 所有文件與程式碼現況一致、無過時描述

---

### Phase 1：UI 佈局修正（header 重疊問題）

> 難度 ⭐⭐ | 預計 1 天

| # | 任務 | 影響檔案 | 說明 |
|---|------|----------|------|
| 1-1 | 統一 ModeSwitch 至 App.jsx header | `src/App.jsx` | 在 header 右側「當前視角」旁加入 compact 版 ModeSwitch，從 CallContext 取得 `voiceMode` / `switchMode` |
| 1-2 | 移除 ConsumerView 獨立 ModeSwitch | `src/views/ConsumerView.jsx` | 移除 `absolute top-6 right-6` 的 ModeSwitch；手機內部僅保留模式指示標記 |
| 1-3 | 確認各視角無遮擋 | 全部 views | 測試四視角切換下 header 顯示正常 |

**驗收標準**: ModeSwitch 在所有視角可見且不與任何元素重疊；通話中 ModeSwitch disabled

---

### Phase 2：四視角模式感知

> 難度 ⭐⭐⭐ | 預計 2 天

| # | 任務 | 影響檔案 | 說明 |
|---|------|----------|------|
| 2-1 | AgentView 支援 Live 模式語音輸入 | `src/views/AgentView.jsx` | 加入 PTT 按鈕（REST Live）和串流指示器（Gemini Live）。利用 CallContext 已有的 `startRecording` / `stopRecordingAndSend` |
| 2-2 | SystemView 適配 Gemini Pipeline | `src/views/SystemView.jsx` | 根據 `voiceMode` 動態切換 Pipeline 節點：Mock/REST 顯示 5 節點 (Input→ASR→LLM→TTS→Output)；Gemini 顯示 3 節點 (Input→Gemini E2E→Output)。延遲改顯示 `e2e` |
| 2-3 | SystemView 加入 Gemini 資訊 | `src/views/SystemView.jsx` | 右側 log 區在 Gemini 模式下顯示 Token 用量和連線狀態 |
| 2-4 | DemoView PhoneSimulator 模式指示 | `src/components/PhoneSimulator.jsx` | 通話中顯示當前模式標記（類似 ConsumerView 動態島的模式指示器） |

**驗收標準**: 四個視角在三種模式下均可操作通話；SystemView Pipeline 正確反映當前模式

---

### Phase 3：Live 模式意圖分析與單據產生

> 難度 ⭐⭐⭐⭐⭐ | 預計 3-5 天  
> ⚠️ 高風險：依賴 Gemini API 對 native audio + function calling 的同時支援

| # | 任務 | 影響檔案 | 說明 |
|---|------|----------|------|
| 3-1 | 驗證 Gemini Function Calling + Audio | 獨立測試 | 確認 `gemini-2.5-flash-native-audio-preview` 模型是否支援 `tools` 定義。若不支援走備選方案 |
| 3-2 | 定義 Tool Schema | `src/config/api.js` | 定義 `analyze_intent` 和 `create_ticket` 兩個 function，含參數 schema |
| 3-3 | 修改 System Prompt | `src/config/api.js` | 指示 Gemini 在每輪對話後呼叫 `analyze_intent`、在適當時機呼叫 `create_ticket` |
| 3-4 | GeminiLiveService 處理 Tool Call | `src/services/GeminiLiveService.js` | 監聽 WebSocket `toolCall` 訊息類型，解析後透過 callback 通知 CallContext |
| 3-5 | CallContext 接收分析/單據 | `src/context/CallContext.jsx` | `onResponseComplete` 回調中處理 `analysis` / `tickets` 欄位，更新 `currentAnalysis` + `tickets` state |
| 3-6 | fallback: 文字分析 API | `src/services/GeminiLiveService.js` | 若 3-1 驗證不可行，每輪對話結束後用獨立的 Gemini text API 呼叫分析對話內容 |

**備選方案優先級**:
1. **方案 A（最佳）**: Gemini 原生 function calling + audio 共存
2. **方案 B（可靠）**: 每輪對話後額外呼叫 Gemini text API 分析（增加 200-400ms）
3. **方案 C（簡易）**: 前端 keyword 匹配產生簡易分析（無額外延遲但品質低）

**驗收標準**: Gemini Live 通話過程中能產生意圖分析、通話結束前能產生工單；AnalysisPanel 和 TicketPanel 有資料顯示

---

### Phase 4：整合測試與優化

> 難度 ⭐⭐ | 預計 1 天

| # | 任務 | 說明 |
|---|------|------|
| 4-1 | 三模式切換狀態保持 | 切換視角時模式保持一致，切換模式時通話狀態正確處理 |
| 4-2 | 3 場景 × 3 模式 × 4 視角 | 36 種組合快速驗證（以 Mock 全量 + Live 抽樣） |
| 4-3 | header 響應式檢查 | 窄螢幕時 ModeSwitch + 視角切換 + 當前視角文字不擠壓 |
| 4-4 | 更新文件 | 同步更新 README、STRUCTURE、copilot-instructions |

**驗收標準**: 全組合無 crash、UI 無重疊、文件與程式碼一致

---

## 時程總覽

```
Week 1:
├── Day 1      Phase 0: 文件清理 (0.5d) + Phase 1: UI 佈局修正 (0.5d)
├── Day 2      Phase 1: 完成 + 驗證
├── Day 3-4    Phase 2: 四視角模式感知
└── Day 5      Phase 2: 完成 + 驗證
               ★ 里程碑 1: 四視角均可使用三模式通話

Week 2:
├── Day 1      Phase 3-1: 驗證 Gemini Function Calling + Audio
├── Day 2-3    Phase 3-2~3-5: 實作分析與單據
├── Day 4      Phase 3-6: fallback 方案（若需要）
└── Day 5      Phase 4: 整合測試 + 文件更新
               ★ 里程碑 2: Live 模式產生分析 + 單據
```

**總估計: 7-10 個工作天**

---

## 相關文件

| 文件 | 用途 |
|------|------|
| [PROGRESS.md](PROGRESS.md) | 每日進度追蹤 |
| [../.claude/skills/project-workflow/SKILL.md](../.claude/skills/project-workflow/SKILL.md) | 開發規範與文件更新流程 |
| [../.github/copilot-instructions.md](../.github/copilot-instructions.md) | AI 助手編程指引 |
| [GEMINI_LIVE_IMPLEMENTATION_PLAN.md](GEMINI_LIVE_IMPLEMENTATION_PLAN.md) | Gemini Live 原始規劃（已完成歸檔） |
