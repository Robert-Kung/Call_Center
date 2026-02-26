# 文件索引

本目錄包含 AI 語音客服助理系統的技術文件。

## 📚 文件列表

### 1. [系統架構設計](ai-voice-assistant-architecture.md)
**用途**：完整的系統架構說明  
**內容**：
- 系統總覽與流程圖
- ASR/LLM/TTS 技術選型建議
- 後端 API 設計
- WebSocket vs REST 模式比較
- 部署架構建議

**適合對象**：架構師、後端開發者

---

### 2. [API 規格書](api-specification.md)
**用途**：詳細的 API 介面規格  
**內容**：
- REST API 端點定義
- WebSocket 通訊協定
- 訊息格式與資料模型
- LLM Function Calling 規格
- 錯誤處理與狀態碼

**適合對象**：前後端開發者、測試人員

---

### 3. [Gemini Live 實作規劃](GEMINI_LIVE_IMPLEMENTATION_PLAN.md)
**用途**：Gemini Live 模式整合的完整規劃（✅ 已完成）  
**內容**：
- 三模式架構設計
- 詳細實作步驟（6 個階段）
- 檔案變更清單
- 測試驗證計畫
- 風險與緩解策略

**適合對象**：開發團隊、專案經理

---

### 4. [任務規劃 — 前端四視角連動](TASK_PLAN.md)
**用途**：當前開發任務的完整規劃  
**內容**：
- 現況分析（四視角 × 三模式矩陣）
- Phase 0-4 任務定義與驗收標準
- 時程估計與里程碑

**適合對象**：開發團隊、專案經理

---

### 5. [進度追蹤](PROGRESS.md)
**用途**：即時記錄各 Phase 的執行進度  
**內容**：
- 各 Phase 狀態一覽
- 每個任務的完成日期與備註
- 變更日誌

**適合對象**：全體成員

---

## 🔗 相關文件

- [專案 README](../README.md) - 快速開始與專案概覽
- [AI 編程指引](../.github/copilot-instructions.md) - AI 助手使用指南
- [舊版檔案](../legacy/README.md) - 原型版本說明

---

## 📝 文件更新準則

1. **架構變更**：更新 `ai-voice-assistant-architecture.md`
2. **API 變更**：更新 `api-specification.md`，包含範例
3. **新功能規劃**：建立獨立的實作規劃文件（如 Gemini Live）
4. **版本記錄**：在文件頂部標註最後更新日期

---

## 🤝 貢獻

更新文件時請確保：
- ✅ 範例程式碼可執行
- ✅ 圖表與文字一致
- ✅ 繁體中文正確無誤
- ✅ 連結有效

有任何疑問請開 Issue 討論。
