---
name: project-workflow
description: 專案開發工作流規範。當進行任何程式碼修改、功能新增、Bug 修復時使用此 Skill。定義程式碼撰寫規則、commit 慣例、文件同步更新流程、進度追蹤機制。確保每次變更後相關文件保持一致。
---

# Project Workflow — 開發規範與文件更新流程

## 概述

此 Skill 定義了本專案的開發規範，包括程式碼撰寫規則、任務執行流程、文件同步更新機制。所有程式碼變更必須遵循此規範。

---

## 一、程式碼撰寫規則

### 1.1 語言與格式

| 項目 | 規範 |
|------|------|
| **UI 文字** | 繁體中文（台灣用語） |
| **程式碼註解** | 繁體中文；函式/類別上方使用 JSDoc 格式 |
| **變數/函式命名** | camelCase（英文），語意清晰 |
| **元件命名** | PascalCase，檔名與 export 名稱一致 |
| **CSS** | Tailwind utility classes，不使用自訂 CSS class（除 `index.css` 全域設定） |
| **Icon** | 統一使用 `lucide-react`，不引入其他 icon 庫 |
| **縮排** | 2 spaces |

### 1.2 React 元件規範

```jsx
// ✅ 正確：函式元件 + named export（如需）
export default function ComponentName() { ... }

// ✅ 正確：使用 useCall() 取得共用狀態
import { useCall } from '../context/CallContext';

// ❌ 禁止：在元件外直接操作 DOM
// ❌ 禁止：使用 class component
// ❌ 禁止：在 useEffect 中直接 setState 造成無限迴圈
```

### 1.3 狀態管理規範

```
所有跨元件狀態 → CallContext (src/context/CallContext.jsx)
元件內部 UI 狀態 → useState / useRef
副作用 → useEffect / useCallback
```

- **新增全域狀態**：必須同時在 `CallProvider` 定義 state 和在 `value` 物件中暴露
- **三模式分流**：所有涉及模式的邏輯必須使用 `voiceMode` 判斷，不可硬編碼模式
- **模式值**：`'mock'` | `'rest-live'` | `'gemini-live'`

### 1.4 三模式向後相容原則

```
1. 不修改現有介面的簽名
2. 新增方法而非修改：例如 initializeCallGeminiLive() 而非改 initializeCall()
3. 狀態隔離：Gemini 專用狀態獨立（如 geminiTokenUsage, geminiConnectionStatus）
4. 條件渲染：使用 voiceMode 判斷顯示內容，而非刪除原有元素
```

### 1.5 檔案組織

```
src/
├─ components/        # 可重用 UI 元件（不含業務邏輯）
├─ views/             # 頁面級視角元件（Demo/Consumer/Agent/System）
├─ context/           # 全域狀態（僅 CallContext）
├─ services/          # API / WebSocket / 工具服務
├─ hooks/             # 自訂 Hooks
├─ config/            # 設定檔（api.js）
└─ data/              # 靜態資料（scenarios.js）
```

**新增檔案規則**：
- 元件 → `src/components/XxxPanel.jsx` 或 `src/components/XxxSwitch.jsx`
- 服務 → `src/services/XxxService.js`
- 視角 → `src/views/XxxView.jsx`
- Hook → `src/hooks/useXxx.js`

---

## 二、任務執行流程

### 2.1 開始任務前

1. **閱讀任務規劃**：確認 [docs/TASK_PLAN.md](../../docs/TASK_PLAN.md) 中的任務定義與驗收標準
2. **更新進度追蹤**：在 [docs/PROGRESS.md](../../docs/PROGRESS.md) 記錄任務開始
3. **確認影響範圍**：列出會修改的檔案，評估是否影響其他模式

### 2.2 執行任務中

1. **單一職責**：每個 commit 只做一件事
2. **先測試再提交**：確認修改後無 console error，三模式基本功能不受影響
3. **增量交付**：大型任務拆分為可獨立驗證的小步驟

### 2.3 任務完成後（必做清單）

> ⚠️ 每完成一個 Phase 後，必須依序執行以下步驟：

#### Step 1: 更新進度追蹤
- 在 `docs/PROGRESS.md` 記錄完成項目、日期、實際耗時
- 標記 Phase 狀態為 ✅ 完成

#### Step 2: 文件同步檢查
根據修改內容，檢查以下文件是否需要更新：

| 修改類型 | 需更新的文件 |
|----------|-------------|
| 新增/刪除/重命名檔案 | `STRUCTURE.md`、`README.md` 專案結構區塊 |
| 新增元件或服務 | `.github/copilot-instructions.md` |
| API 或配置變更 | `src/config/api.js` 註解、`docs/api-specification.md` |
| 模式行為變更 | `README.md` 三模式說明區塊 |
| UI 佈局變更 | 無需文件更新（視覺變更） |
| 新增 state 到 CallContext | `.github/copilot-instructions.md` 的 data flow 章節 |

#### Step 3: 驗收自檢
- [ ] 修改的功能在 Mock 模式下正常
- [ ] 修改的功能在 Gemini Live 模式下正常（如適用）
- [ ] 無 console error / warning
- [ ] UI 在 1920×1080 下無重疊或截斷
- [ ] 文件已同步更新

---

## 三、文件維護規範

### 3.1 文件層級

```
必須維護（每次變更後檢查）:
├─ README.md                         # 專案總覽
├─ STRUCTURE.md                      # 目錄結構
├─ .github/copilot-instructions.md   # AI 編程指引
└─ docs/PROGRESS.md                  # 進度追蹤

按需維護（相關變更時更新）:
├─ docs/TASK_PLAN.md                 # 任務規劃
├─ docs/api-specification.md         # API 規格
└─ docs/ai-voice-assistant-architecture.md  # 架構設計
```

### 3.2 文件撰寫格式

- **日期格式**: `YYYY-MM-DD`
- **狀態標記**: `📋 計畫中` → `🔄 進行中` → `✅ 已完成` → `❌ 已取消`
- **表格對齊**: 使用 markdown 表格，避免純文字列表描述結構化資訊
- **連結**: 文件間使用相對路徑連結

### 3.3 進度追蹤格式（PROGRESS.md）

```markdown
### Phase X: [名稱]
**狀態**: 🔄 進行中 → ✅ 2026-02-28 完成  
**預計**: 1 天 | **實際**: 1.5 天

| # | 任務 | 狀態 | 完成日期 | 備註 |
|---|------|------|----------|------|
| X-1 | 任務描述 | ✅ | 2026-02-28 | 實際變更說明 |
```

---

## 四、Docker 開發環境

### 4.1 開發流程

```bash
# 開發模式（hot reload）
docker compose -f docker-compose.dev.yml up

# 生產模式（需 rebuild）
docker compose up -d --build

# 查看 log
docker compose -f docker-compose.dev.yml logs -f
```

### 4.2 環境變數

- **VITE_* 變數**: 在 build 階段嵌入，修改後需 `--build`
- **開發模式**: `docker-compose.dev.yml` 使用 volume mount，修改即時生效
- **Gemini API Key**: `VITE_GEMINI_API_KEY` 在 `.env` 中設定

---

## 五、品質檢查清單

### 每次修改後快速檢查

```
□ 瀏覽器 Console 無 error
□ React DevTools 無 warning  
□ Mock 模式：選場景 → 撥號 → 下一步 → 掛斷 → 返回
□ 四視角切換正常、header 不重疊
□ Tailwind class 生效（無拼寫錯誤的 class）
```

### Phase 完成後完整檢查

```
□ Mock 模式 × 3 場景 × 4 視角
□ Gemini Live 模式 × 1 場景 × ConsumerView（如可用）
□ 文件同步更新（Step 2 清單）
□ PROGRESS.md 已更新
□ Docker 開發模式正常啟動
```
