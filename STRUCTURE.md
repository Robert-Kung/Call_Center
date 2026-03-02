# 專案目錄結構

```
Call_Center/
│
├─ 📱 前端應用
│  ├─ src/                           # React 主程式
│  │  ├─ App.jsx                     # 應用程式入口（四視角切換）
│  │  ├─ main.jsx                    # React 渲染根節點
│  │  ├─ index.css                   # 全域樣式
│  │  ├─ components/                 # UI 組件
│  │  │  ├─ PhoneSimulator.jsx       # 手機模擬器
│  │  │  ├─ ConversationPanel.jsx    # 對話面板
│  │  │  ├─ AnalysisPanel.jsx        # 意圖分析面板
│  │  │  ├─ LatencyMonitor.jsx       # 延遲監控（支援 REST/Gemini 雙模式）
│  │  │  ├─ SystemLogPanel.jsx       # 系統日誌
│  │  │  ├─ TicketPanel.jsx          # 工單顯示
│  │  │  ├─ ModeSwitch.jsx           # 三模式切換器 (Mock/REST/Gemini)
│  │  │  └─ GeminiLivePanel.jsx      # Gemini Live 監控面板
│  │  ├─ context/
│  │  │  └─ CallContext.jsx          # 全域狀態管理（三模式分流）
│  │  ├─ services/
│  │  │  ├─ VoiceService.js          # 語音服務封裝（REST + Gemini）
│  │  │  ├─ ApiClient.js             # HTTP 客戶端（REST Live 用）
│  │  │  ├─ GeminiLiveService.js     # Gemini Live WebSocket 服務
│  │  │  └─ SessionLogger.js         # 通話 Session 記錄器（本地 JSON）
│  │  ├─ hooks/
│  │  │  ├─ useAudioRecorder.js      # 錄音 Hook（16kHz mono）
│  │  │  └─ useAudioPlayer.js        # 播放 Hook（佇列式 base64 播放）
│  │  ├─ data/
│  │  │  └─ scenarios.js             # Mock 對話腳本（3 場景）
│  │  ├─ config/
│  │  │  └─ api.js                   # API + Gemini 配置
│  │  └─ views/
│  │     ├─ DemoView.jsx             # 展示視角
│  │     ├─ ConsumerView.jsx         # 消費者視角（含 PTT 錄音）
│  │     ├─ AgentView.jsx            # 客服視角
│  │     └─ SystemView.jsx           # 系統視角（Pipeline 視覺化）
│  ├─ index.html                     # HTML 模板
│  ├─ package.json                   # 前端依賴
│  ├─ vite.config.js                 # Vite 配置（proxy → 後端）
│  ├─ tailwind.config.js             # Tailwind 配置
│  └─ postcss.config.js              # PostCSS 配置
│
├─ 🔧 後端服務 (REST Live)
│  └─ my-voice-agent/
│     ├─ src/
│     │  ├─ app.js                   # Express 主程式
│     │  └─ services/
│     │     ├─ asr.js                # 語音識別（Whisper）
│     │     ├─ llm.js                # 大語言模型（OpenAI 相容）
│     │     └─ tts.js                # 語音合成（CosyVoice）
│     ├─ public/
│     ├─ uploads/                    # 音訊暫存
│     ├─ package.json                # 後端依賴
│     ├─ .env                        # 環境變數
│     └─ 規格.md                     # 後端規格說明
│
├─ 📚 文件
│  ├─ docs/
│  │  ├─ README.md                   # 文件索引
│  │  ├─ TASK_PLAN.md                # 任務規劃（Phase 0-4 定義）
│  │  ├─ PROGRESS.md                 # 開發進度追蹤（每日更新）
│  │  ├─ ai-voice-assistant-architecture.md
│  │  ├─ api-specification.md
│  │  └─ GEMINI_LIVE_IMPLEMENTATION_PLAN.md  # ✅ 已完成歸檔
│  └─ README.md                      # 專案主文件
│
├─ 🗂️ 歷史檔案
│  └─ legacy/
│     ├─ README.md                   # 舊版說明
│     └─ call-center-demo.jsx        # 原型單檔案版本
│
├─ 🗄️ 通話記錄
│  └─ data/                          # Session 記錄（本地，不上傳 git）
│     └─ session-*.json              # 各次 Gemini Live 通話記錄
│
├─ ⚙️ 配置與部署
│  ├─ .github/
│  │  └─ copilot-instructions.md     # GitHub Copilot 編程指引
│  ├─ .claude/                       # Claude Code 配置
│  │  ├─ settings.local.json         # 本地權限設定
│  │  └─ skills/                     # Claude Skills
│  │     ├─ gemini-live-implementation/  # Gemini Live 實作指引
│  │     │  ├─ SKILL.md              # 完整實作步驟
│  │     │  ├─ CHECKLIST.md          # 進度追蹤
│  │     │  └─ templates/            # 程式碼範本
│  │     └─ ui-ux-pro-max/           # UI/UX 設計智慧助手
│  │        ├─ SKILL.md              # 設計工作流指引
│  │        ├─ data/                 # 設計資料庫 (CSV)
│  │        └─ scripts/              # 搜尋腳本 (Python)
│  ├─ Dockerfile                     # 容器映像檔
│  ├─ docker-compose.yml             # 容器編排（生產）
│  └─ docker-compose.dev.yml         # 容器編排（開發/hot reload）
```

## 目錄說明

### 📱 前端 (`/src`)
模組化 React 應用程式，採用 Context API 進行狀態管理。支援三種語音模式：

- **Mock 模式** — 預設腳本展示，無 API 呼叫
- **REST Live 模式** — ASR → LLM → TTS 三階段處理
- **Gemini Live 模式** — 端到端即時語音 WebSocket（實驗性）

**核心組件**：
- `CallContext.jsx` - 管理通話狀態、三模式切換、延遲追蹤
- `VoiceService.js` - 封裝 REST + Gemini 語音處理邏輯
- `GeminiLiveService.js` - Gemini Live WebSocket 連線管理
- `scenarios.js` - Mock 模式的對話腳本資料

### 🔧 後端 (`/my-voice-agent`)
Express.js 伺服器，提供 REST Live 模式的 ASR→LLM→TTS 處理。

**關鍵端點**：
- `POST /webhook/talk` - 統一的語音處理介面

### 📚 文件 (`/docs`)
所有技術文件集中管理，包含架構設計、API 規格、實作規劃。

### 🗂️ 歷史檔案 (`/legacy`)
保留原型版本作為參考，不應在生產環境使用。

### ⚙️ AI 編程配置
- `.github/copilot-instructions.md` — GitHub Copilot 專案上下文
- `.claude/skills/` — Claude Code Skills（Gemini 實作指引、UI/UX 設計助手）

---

## 快速導航

| 需求 | 位置 |
|------|------|
| 修改 UI | `src/components/` |
| 調整業務邏輯 | `src/context/CallContext.jsx` |
| 新增對話場景 | `src/data/scenarios.js` |
| 配置 API | `src/config/api.js` |
| 修改後端邏輯 | `my-voice-agent/src/app.js` |
| 查看系統架構 | `docs/ai-voice-assistant-architecture.md` |
| Gemini Live 規劃 | `docs/GEMINI_LIVE_IMPLEMENTATION_PLAN.md` |

---

**最後更新**：2026-02-23
