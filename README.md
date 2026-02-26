# AI 語音客服助理展示平台

> 🎯 **目標**：展示 AI 語音對話系統的三種實作模式（Mock / REST Live / Gemini Live）

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)

---

## 🌟 專案特色

- **三模式架構**：支援 Mock 展示、REST Live、Gemini Live 實時語音對話
- **繁體中文優化**：針對台灣市場設計，支援繁體中文語音識別與合成
- **多場景展示**：電信、餐飲、飯店三大產業客服情境
- **即時延遲追蹤**：完整的 ASR/LLM/TTS 或端到端延遲監控
- **四視角儀錶板**：展示、消費者、客服、系統四種視角

---

## 📦 系統架構

```
┌─────────────────────────────────────────────────────────┐
│                  AI 語音客服助理系統                      │
│                   (三模式並行)                           │
└─────────────────────────────────────────────────────────┘

前端 (React + Vite)                          後端服務
│                                             │
├─► 【Mock 模式】                             │
│   └─ 本地腳本展示                            │
│                                             │
├─► 【REST Live 模式】────────────────────►  my-voice-agent/
│   └─ 三階段流程                             ├─ ASR (Whisper)
│      (瀏覽器 → 後端 → 外部 API)              ├─ LLM (GPT/Claude)
│                                             └─ TTS (Voice API)
│
└─► 【Gemini Live 模式】(規劃中)
    └─ 端到端即時語音 ──────────────────►   Gemini API
       (瀏覽器 ←→ WebSocket ←→ Google)        (WebSocket)
```

---

## 🚀 快速開始

### 環境需求

- Node.js 20+
- npm 或 yarn

### 前端安裝與啟動

```bash
# 安裝依賴
npm install

# 開發模式 (port 3100)
npm run dev

# 建置正式版本
npm build
```

### 後端服務 (REST Live 模式)

```bash
cd my-voice-agent

# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env 填入 API Keys

# 啟動服務 (port 3000)
npm start
```

### Docker 部署

本專案 Docker 僅部署**前端**靜態站點，後端 `my-voice-agent` 需在另一台機器上獨立運行。

```bash
# 1. 建立環境變數
cp .env.example .env
# 編輯 .env 填入 VITE_GEMINI_API_KEY 和 VITE_BACKEND_HOST
```

#### 生產模式（預設）

```bash
# 啟動（multi-stage build → serve 靜態檔案）
docker compose up -d

# 重新建置（修改 .env 後必須重 build，因為 VITE_* 在 build 階段嵌入）
docker compose up -d --build

# 查看 log
docker compose logs -f

# 停止
docker compose down
```

#### 開發模式（hot reload）

```bash
# 使用獨立的 docker-compose.dev.yml，支援 volume mount + 即時更新
docker compose -f docker-compose.dev.yml up

# 背景執行
docker compose -f docker-compose.dev.yml up -d
```

> ⚠️ 兩種模式皆開放 **port 3100**，不可同時執行。

---

## 📁 專案結構

```
Call_Center/
├─ src/                          # 前端主程式
│  ├─ components/                # UI 組件
│  │  ├─ PhoneSimulator.jsx      # 手機模擬器
│  │  ├─ ConversationPanel.jsx   # 對話面板
│  │  ├─ AnalysisPanel.jsx       # 意圖分析
│  │  └─ LatencyMonitor.jsx      # 延遲監控
│  ├─ context/
│  │  └─ CallContext.jsx         # 全域狀態管理
│  ├─ services/
│  │  ├─ VoiceService.js         # 語音服務封裝
│  │  └─ ApiClient.js            # HTTP 客戶端
│  ├─ data/
│  │  └─ scenarios.js            # Mock 對話腳本
│  ├─ config/
│  │  └─ api.js                  # API 配置與系統提示
│  └─ views/
│     ├─ DemoView.jsx            # 展示視角
│     ├─ ConsumerView.jsx        # 消費者視角
│     ├─ AgentView.jsx           # 客服視角
│     └─ SystemView.jsx          # 系統視角
│
├─ my-voice-agent/               # REST Live 後端服務
│  ├─ src/
│  │  ├─ app.js                  # Express 主程式
│  │  └─ services/
│  │     ├─ asr.js               # 語音識別服務
│  │     ├─ llm.js               # 大語言模型服務
│  │     └─ tts.js               # 語音合成服務
│  └─ package.json
│
├─ docs/                         # 技術文件
│  ├─ ai-voice-assistant-architecture.md
│  ├─ api-specification.md
│  └─ GEMINI_LIVE_IMPLEMENTATION_PLAN.md
│
├─ legacy/                       # 舊版檔案歸檔
│  └─ call-center-demo.jsx       # 原型單檔案版本
│
├─ .github/
│  └─ copilot-instructions.md    # AI 編程助手指引
│
├─ package.json                  # 前端依賴
├─ vite.config.js                # Vite 配置
├─ tailwind.config.js            # Tailwind CSS 配置
└─ docker-compose.yml            # Docker 配置
```

---

## 🎭 三種運行模式

### 1️⃣ Mock 模式（展示）

- **用途**：商業展示、快速演示、UI/UX 測試
- **特點**：本地腳本、零延遲、無需 API Key
- **適合**：向客戶展示系統流程與介面

### 2️⃣ REST Live 模式（現有後端）

- **用途**：完整功能驗證、可控的後端邏輯
- **流程**：Audio → ASR → LLM → TTS → Audio
- **特點**：
  - 分階段延遲可追蹤
  - 自訂 ASR/LLM/TTS 供應商
  - 支援 Session 管理
- **適合**：需要自定義業務邏輯的正式環境

### 3️⃣ Gemini Live 模式（規劃中）

- **用途**：超低延遲展示、成本優化
- **流程**：Audio ←→ Gemini API (WebSocket) ←→ Audio
- **特點**：
  - 端到端處理（300-600ms）
  - 原生繁體中文支援
  - Token 使用量追蹤
- **適合**：追求極致延遲體驗的場景

---

## 🎯 使用場景

### 電信客服（中華電信）
- 帳單查詢
- 網路報修
- 方案諮詢

### 餐廳訂位（雅緻軒餐廳）
- 訂位管理
- 菜色查詢
- 特殊需求處理

### 飯店訂房（晶華渡假酒店）
- 房型查詢
- 設施介紹
- 訂房服務

---

## ⚙️ 配置說明

### 前端環境變數

```bash
# .env.local
VITE_API_BASE_URL=http://192.168.2.100:3000  # REST Live 後端
VITE_GEMINI_API_KEY=your_gemini_key          # Gemini Live 模式
```

### 後端環境變數

```bash
# my-voice-agent/.env
ASR_API_URL=http://your-whisper-endpoint
LLM_API_URL=http://your-llm-endpoint
TTS_API_URL=http://your-tts-endpoint
```

---

## 📊 效能指標

| 模式 | 平均延遲 | Token 成本 | 適用場景 |
|------|---------|-----------|---------|
| Mock | 0ms | $0 | 展示演示 |
| REST Live | 1200-2000ms | $0.02/次 | 正式環境 |
| Gemini Live | 300-600ms | $0.01/次 | 低延遲展示 |

---

## 📚 文件索引

- [系統架構說明](docs/ai-voice-assistant-architecture.md)
- [API 規格書](docs/api-specification.md)
- [Gemini Live 實作規劃](docs/GEMINI_LIVE_IMPLEMENTATION_PLAN.md)
- [AI 編程指引](.github/copilot-instructions.md)

---

## 🛠️ 開發指引

### 程式碼規範

- **語言**：UI 文字和註解使用繁體中文
- **樣式**：Tailwind CSS utility classes
- **圖示**：統一使用 `lucide-react`
- **狀態管理**：React Context API

### 新增場景

1. 編輯 `src/data/scenarios.js` 新增對話腳本
2. 在 `src/config/api.js` 設定系統提示
3. 更新場景圖示與配色

### API 整合

REST Live 模式使用單一端點：
```javascript
POST /webhook/talk
// 初始化：{ text_input: 'START_CALL_TRIGGER', ... }
// 語音對話：FormData with audio file
```

---

## 🤝 貢獻指南

歡迎提交 Issue 或 Pull Request！

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

---

## 📝 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案

---

## 🙏 致謝

- OpenAI Whisper - ASR
- Claude / GPT - LLM
- Google Gemini - 端到端語音處理
- React & Vite - 前端框架

---

## 📧 聯絡資訊

如有任何問題，歡迎透過 Issue 與我們聯繫。

---

**🚀 立即體驗 AI 語音客服的未來！**
