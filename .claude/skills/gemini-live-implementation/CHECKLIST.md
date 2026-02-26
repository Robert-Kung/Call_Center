# Gemini Live 實作進度追蹤

> 最後更新: 2026-02-23

## 實作前準備
- [x] 確認已閱讀 `skill.md` 完整指引
- [ ] 取得 Gemini API Key (https://aistudio.google.com/apikey)
- [x] 確認專案可正常啟動 (`npm run dev`)

---

## Phase 1: 環境配置
- [ ] 建立 `.env.local` 檔案
- [ ] 新增 `VITE_GEMINI_API_KEY=xxx`
- [x] 新增 `VITE_GEMINI_MODEL=gemini-2.5-flash-native-audio-preview-12-2025`（已在 api.js 設定預設值）
- [ ] 驗證: `console.log(import.meta.env.VITE_GEMINI_API_KEY)` 有值

## Phase 2: GeminiLiveService 核心
- [x] 建立 `src/services/GeminiLiveService.js`
- [x] 實作 WebSocket 連線邏輯
- [x] 實作 `initialize(scenario)` 方法
- [x] 實作 `processAudio(audioBlob)` 方法
- [x] 實作 `close()` 方法
- [x] 實作音訊格式轉換 (WebM → 16kHz PCM)
- [ ] 驗證: WebSocket 可成功連線（需 API Key）
- [ ] 驗證: 可收到歡迎語音（需 API Key）

## Phase 3: VoiceService 擴充
- [x] 引入 `GeminiLiveService`
- [x] 新增 `initializeCallGeminiLive()` 方法
- [x] 新增 `processUserAudioGeminiLive()` 方法
- [x] 新增 `endGeminiSession()` 方法
- [x] 驗證: 現有 REST 方法未受影響
- [ ] 驗證: 新方法可正常呼叫（需 API Key）

## Phase 4: CallContext 狀態管理
- [x] 將 `mode` 改名為 `voiceMode`
- [x] `voiceMode` 支援三值: `'mock'` | `'rest-live'` | `'gemini-live'`
- [x] 新增 `geminiTokenUsage` 狀態
- [x] 新增 `geminiConnectionStatus` 狀態
- [x] 新增 `dialGeminiLive()` 方法
- [x] 修改 `dial()` 支援三模式分流
- [x] 修改 `sendAudio()` 支援 Gemini 處理
- [x] 修改 `hangUp()` 處理 Gemini session 清理
- [x] 驗證: Mock 模式仍正常
- [x] 驗證: REST Live 模式仍正常
- [ ] 驗證: Gemini Live 可撥號（需 API Key）

## Phase 5: UI 元件
### 5.1 ModeSwitch 擴充
- [x] 新增 Gemini Live 按鈕
- [x] 顯示「實驗」標籤
- [x] 通話中禁用切換
- [x] 驗證: 三模式可切換

### 5.2 GeminiLivePanel 新增
- [x] 建立 `src/components/GeminiLivePanel.jsx`
- [x] 顯示連線狀態指示燈
- [x] 顯示 Token 使用量 (input/output/total)
- [x] 顯示端到端延遲
- [x] 僅在 Gemini 模式顯示
- [x] 整合到 DemoView

## Phase 6: 配置更新
- [x] 在 `api.js` 新增 `GEMINI_CONFIG`
- [x] 新增 `GEMINI_SYSTEM_PROMPTS`
- [x] 設定延遲閾值

---

## 回歸測試

### Mock 模式
- [x] 可選擇場景
- [x] 可撥號接通
- [x] 可點擊「下一步」推進對話
- [x] 可掛斷
- [x] 延遲顯示正確

### REST Live 模式
- [x] 可切換到 REST Live 模式
- [x] 可撥號接通
- [ ] 可錄音並傳送（需後端服務）
- [ ] 可收到 AI 回應（需後端服務）
- [x] 延遲顯示正確 (ASR/LLM/TTS)
- [x] 可掛斷

### Gemini Live 模式
- [x] 可切換到 Gemini Live 模式
- [ ] 可撥號接通（需 API Key）
- [ ] 可錄音並傳送（需 API Key）
- [ ] 可收到即時 AI 回應（需 API Key）
- [x] Token 使用量顯示（UI 已實作）
- [ ] 端到端延遲 < 1000ms（需實測）
- [x] 可掛斷

---

## 完成標準
- [x] 三模式無縫切換
- [ ] Gemini Live 平均延遲 < 600ms（需實測）
- [x] 繁體中文對話自然（Mock 場景已驗證）
- [ ] 所有回歸測試通過
- [ ] 無 console 錯誤

---

## 備註
- 實作過程中如遇問題，優先查看 `skill.md` 的故障排除章節
- 如需回滾，參考 `skill.md` 的回滾策略
- 標記為「需 API Key」或「需後端服務」的項目，程式碼已完成，僅需環境配置後驗證
