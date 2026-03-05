# Plan：AI 助理 Tool Use 全流程重設計

> 根據 22+ 筆 session data 分析制定。目標：修復無限迴圈、強化意圖擷取、讓 create_ticket 真正被觸發。
> 建立日期：2026-03-04

---

## 背景：Session Data 分析結論

| 問題 | 嚴重度 | 證據 |
|---|---|---|
| Gemini 自我分析歡迎語 → 無限 `analyze_intent(問候)` 迴圈 | 🔴 HIGH | 22 sessions 中 6 sessions 觸發（27%），最多循環 25+ 次 |
| `entities` 幾乎永遠為空陣列 | 🟠 MEDIUM | 僅 2 sessions 曾出現非空 entities（姓名、電話） |
| `create_ticket` 從未被呼叫 | 🟠 MEDIUM | 全部 22+ sessions 零次觸發 |
| Gemini 偶爾輸出簡體中文或英文 | 🟡 MEDIUM | mma1ipe6 中出現「续约方案」、mma6zlda 出現「Let me check」 |
| `flags: ["無"]` 字面量 vs 空陣列不一致 | 🟡 LOW | mm8rlain session 全程使用 "無" 字串 |
| `功能查詢` intent 不在 enum 中但 Gemini 仍產出 | 🟡 MEDIUM | mm8rlain session 出現 |
| Double welcome（重複問候語） | 🟠 MEDIUM | mmae8q0v：aiText 中出現兩次完整問候語 |

---

## Phase 1：修復無限 analyze_intent(問候) 迴圈

**狀態：⬜ 未完成**

**根因：** Gemini 在送出歡迎語後立即呼叫 `analyze_intent({intent:"問候"})`，服務端回傳 `{status:'ok'}` 後 Gemini 把它視為 context 更新而再次生成輸出，再次自我分析，形成迴圈。

**修改檔案：** `src/services/GeminiLiveService.js`

### 1-A：追蹤最後使用者輸入時間

在 `constructor` 中新增：
```js
this._lastUserInputTime = 0;     // 最後一次收到 inputTranscription 的時間
this._consecutiveGreetingCount = 0;  // 連續 analyze_intent(問候) 次數
```

在 `content.inputTranscription?.text` 處理區塊，加入：
```js
if (content.inputTranscription?.text?.trim()) {
  this._lastUserInputTime = Date.now();
  this._consecutiveGreetingCount = 0;  // 有真實 user input → 重置計數器
}
```

### 1-B：在 _handleFunctionCall 加入防護邏輯

```js
if (name === 'analyze_intent') {
  const isGreeting = args.intent === '問候';
  const timeSinceUserInput = Date.now() - this._lastUserInputTime;
  const noRecentUserInput = timeSinceUserInput > 3000; // 3 秒內沒有 user input

  if (isGreeting && noRecentUserInput) {
    this._consecutiveGreetingCount++;
    console.warn('[GeminiLive] ⚡ 攔截自我分析問候 (count=%d, timeSince=%dms)',
      this._consecutiveGreetingCount, timeSinceUserInput);

    if (this._consecutiveGreetingCount >= 2) {
      // 超過 2 次 → 完全忽略，不送 toolResponse（避免餵 Gemini 繼續生成）
      sessionLogger.log('function_call_handled', { name, id, blocked: 'loop_guard' });
      return;
    }
  } else if (!isGreeting) {
    this._consecutiveGreetingCount = 0;
  }

  // 正常路徑：更新 UI + 送空 ack（{}而非{status:'ok'}）
  if (this.onToolCall) { ... }
  this._sendFunctionResponse(name, id, {});  // 空物件，減少 Gemini 反應
  ...
}
```

### 1-C：Welcome Prompt 同步強化

在 `src/config/api.js` 的 `WELCOME_MESSAGES` 每個場景加入尾綴：
```
「問候完畢後，請保持靜默等待客戶說話。不要呼叫 analyze_intent，也不要繼續說話。」
```

### 驗證方法
啟動 Gemini Live telecom 場景，觀察 welcome 後 session log 中 `function_call` 事件：
- **期望**：最多 1 次 `analyze_intent(問候)` → 後續靜默
- **舊行為**：連續 10–25 次 `analyze_intent(問候)` 呼叫

---

## Phase 2：重新設計 GEMINI_SYSTEM_PROMPTS

**狀態：⬜ 未完成**

**修改檔案：** `src/config/api.js`

### 三場景共用結構變更

新增強制語言規則（解決簡體/英文 leakage）：
```
【語言規則】
必須全程使用繁體中文（台灣用語）。禁止使用簡體中文或英文。
```

重寫工具使用規則為 6 條（原 5 條的強化版）：
1. **觸發時機**：只在偵測到「客戶」的語音輸入後呼叫 `analyze_intent`。自己的問候語、回應或沉默間隔，不是客戶輸入——不要分析。
2. **靜默原則**：呼叫 `analyze_intent` 後不主動說話，等客戶開口。
3. **entities 必填**：每次呼叫時盡可能擷取客戶提到的所有具體資訊（見場景專屬範例）。
4. **create_ticket 觸發條件**：依場景設定（見下方）。
5. **自然語音**：呼叫工具的同時繼續正常語音回覆，不提及工具操作。
6. **情緒標記**：使用標準 flags 枚舉（見下方），不使用「無」字串，無標記則留 `[]`。

### 場景專屬 entities 範例

**telecom：** `"門號:0912345678"`、`"戶名:林美玲"`、`"問題:網路斷線"`、`"地址:台北市士林區文林路200號"`、`"數據機狀態:紅燈閃爍"`、`"選擇方案:5G無限"`

**restaurant：** `"姓名:陳先生"`、`"電話:0911222333"`、`"日期:1月24日"`、`"時間:18:30"`、`"人數:4位"`、`"特殊需求:素食"`、`"兒童椅:1張"`

**hotel：** `"姓名:張雅婷"`、`"電話:0955666777"`、`"入住:10月2日"`、`"退房:10月4日"`、`"房型:豪華雙人房"`、`"兒童年齡:8歲,5歲"`、`"寵物:小狗"`

### create_ticket 觸發條件（各場景）

- **telecom**：客戶描述網路/電話問題並提供地址，或明確確認方案變更
- **restaurant**：客戶確認訂位日期+人數後（不需等姓名完整）
- **hotel**：客戶確認入住退房日期+房型後

### 情緒標記枚舉表

| flag | flagType | 適用情境 |
|---|---|---|
| `"情緒激動"` | `error` | 客戶語氣強烈、抱怨、投訴 |
| `"客戶急迫"` | `warning` | 客戶強調急迫性 |
| `"情緒已緩和"` | `success` | 客戶情緒轉為平穩 |
| `"客戶滿意"` | `success` | 客戶表達滿意、感謝 |
| `"資訊不完整"` | `warning` | 客戶提供的資訊有缺漏 |
| `"非本人來電"` | `warning` | 來電者非帳戶本人 |
| `"資訊已確認"` | `info` | 客戶確認了提供的資訊 |

---

## Phase 3：重新設計 analyze_intent 工具宣告

**狀態：⬜ 未完成**

**修改檔案：** `src/config/api.js` — `GEMINI_TOOL_DECLARATIONS[0]`

### Intent Enum 更新

**新增：** `身份確認`（客戶提供姓名/電話/帳號）、`功能查詢`（客戶問 AI 能做什麼）
**移除：** `確認預約`（與 `提供資訊` 重疊，從未出現）

最終 enum：
```js
['問候', '報修申訴', '費用查詢', '方案諮詢', '訂位查詢', '訂房查詢', '描述問題', '提供資訊', '身份確認', '功能查詢', '結束通話']
```

### Entities Description 強化

加入：「每次分析都應盡量填寫，不要留空陣列。格式：`"欄位名稱:內容"`，例如 `"姓名:王小明"`、`"電話:0912345678"`、`"問題:網路斷線"`。即使是簡短回應也要擷取語意關鍵詞。」

### Flags/FlagTypes 改為必填

`flags` 與 `flagTypes` 加入 `required`（目前只有 intent/confidence/entities）。加入說明：「如無特殊情緒或狀態，回傳 `[]`，禁止使用 `["無"]` 或其他字面量。」

---

## Phase 4：重新設計 create_ticket 工具宣告

**狀態：⬜ 未完成**

**修改檔案：** `src/config/api.js` — `GEMINI_TOOL_DECLARATIONS[1]`

### Details 欄位 Key 對照表（對齊 TicketPanel fieldLabels）

Description 中明確列出三組 key：

**報修單** keys（對應 `fieldLabels`）：
```
address, issue, diagnosis, scheduledTime, account, accountHolder, contact, fee
```

**訂位單** keys：
```
date, time, guests, table, specialNeeds, notes
```

**訂房單** keys：
```
checkIn, checkOut, nights, rooms, price, total, deposit, guests, includes, specialNeeds, cancelPolicy
```

### 降低觸發門檻

描述改為：「只要客戶表達了明確的服務需求，即可立即建立單據。未知欄位填空字串 `""`，不要等到所有資訊都完整。」

### ticketId 設為 Optional

移除 ticketId 的 required（由 CallContext 備用生成），降低 Gemini 輸出複雜度。

---

## Phase 5：CallContext onToolCall 處理邏輯優化

**狀態：⬜ 未完成**

**修改檔案：** `src/context/CallContext.jsx`

### 5-A：Flags 正規化

```js
const rawFlags = args.flags || [];
const flags = rawFlags.filter(f => f && f !== '無' && f.trim() !== '');
```

### 5-B：FlagTypes 長度對齊

```js
const rawFlagTypes = args.flagTypes || [];
const flagTypes = flags.map((_, i) => rawFlagTypes[i] || 'info');
```

### 5-C：Entities 去重/正規化

```js
const entities = (args.entities || [])
  .map(e => (typeof e === 'string' ? e.trim() : ''))
  .filter(e => e.length > 0);
```

### 5-D：TicketId 自動生成（含場景前綴）

```js
const prefixMap = { '網路報修單': 'CHT', '訂位單': 'RES', '訂房單': 'HTL' };
const prefix = prefixMap[args.type] || 'TKT';
const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
const ticketId = args.ticketId || `${prefix}-${date}-${String(++_uidCounter).padStart(4,'0')}`;
```

### 5-E：Details 解析容錯

```js
let parsedDetails = {};
if (args.details) {
  if (typeof args.details === 'object') {
    parsedDetails = args.details;  // 直接使用物件
  } else {
    try { parsedDetails = JSON.parse(args.details); } catch { parsedDetails = { raw: args.details }; }
  }
}
```

---

## Phase 6：同步更新 scenarios.js Mock 資料

**狀態：⬜ 未完成**

**修改檔案：** `src/data/scenarios.js`

### 變更重點

1. **intent 值** — 改為新 enum 中的值：
   - `'報修申訴（情緒激動）'` → `'報修申訴'`（情緒移至 flags）
   - `'確認身份 + 追問進度'` → `'身份確認'`
   - `'確認預約'` → `'提供資訊'`

2. **entities 格式** — 改為 `"key:value"` 統一格式：
   - `'網路問題'` → `'問題:網路斷線'`
   - `'持續數天'` → `'持續時間:數天'`
   - `'完整地址: 台北市士林區文林路200號3樓之1'` → `'地址:台北市士林區文林路200號3樓之1'`

3. **flags** — 對齊 Phase 2 枚舉表：
   - `'客戶情緒激動'` → `'情緒激動'`
   - `'可能需優先處理'` → `'客戶急迫'`

4. **flagTypes 長度** — 確保與 flags 陣列等長

5. **ticket 欄位 key** — 確保 key 在 TicketPanel `fieldLabels` 中存在

---

## Phase 7：WELCOME_MESSAGES 防迴圈補強

**狀態：⬜ 未完成**

**修改檔案：** `src/config/api.js`

每個場景的 WELCOME_MESSAGES 在末尾加入：
```
問候後立即停止，保持靜默等待客戶說話。不要呼叫任何工具，不要繼續說話。
```

---

## 執行順序建議

```
Phase 1（迴圈修復）→ Phase 7（Welcome 補強）→ Phase 2（Prompt 重設計）
→ Phase 3（analyze_intent schema）→ Phase 4（create_ticket schema）
→ Phase 5（CallContext 正規化）→ Phase 6（scenarios.js 同步）
```

Phase 1 + 7 優先，因為迴圈問題直接影響可用性。

---

## 進度追蹤

| Phase | 描述 | 狀態 |
|---|---|---|
| 1 | 修復無限 analyze_intent(問候) 迴圈 | ⏸ 暫緩（測試未再出現，保留備用） |
| 2 | 重新設計 GEMINI_SYSTEM_PROMPTS | ✅ 完成 |
| 3 | 重新設計 analyze_intent 工具宣告 | ✅ 完成 |
| 4 | 重新設計 create_ticket 工具宣告 | ✅ 完成 |
| 5 | CallContext onToolCall 處理邏輯優化 | ✅ 完成 |
| 6 | 同步更新 scenarios.js Mock 資料 | ✅ 完成 |
| 7 | WELCOME_MESSAGES 防迴圈補強 | ✅ 已存在（先前已完成） |
