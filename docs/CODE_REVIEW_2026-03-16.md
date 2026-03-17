# Deep Code Review — AI 語音客服助理專案

**日期**: 2026-03-16  
**範圍**: 全專案（排除 `my-voice-agent/`），重點針對 Gemini Live 模式  
**參考依據**: Google 官方文件（`ai.google.dev/gemini-api/docs/live*.md.txt`、`live-tools.md.txt`）、專案 Skill 文件 `gemini-live-api-dev`

> **修復更新 2026-03-16**：議題 #1、#2、#4、#6、#8、#19 已於本次 session 修復完成。

---

## 🔴 嚴重問題 (Bugs / 功能性錯誤)

### 1. ~~`analyze_intent` 缺少 `behavior: 'NON_BLOCKING'` 宣告 — Function Calling 阻塞語音串流~~ 🔄 已撤销修復 → 確認為設計決策

> **最終判斷**：加入 `behavior: 'NON_BLOCKING'` 後，Gemini 出現「自問自答」現象，已**撤销**此修復。Blocking 模式是正確設計。
> 
> **根本原因**：系統提示的「靜默原則（規則 2）」與 NON_BLOCKING 行為衝突。当 Gemini 在 IDLE 狀態收到 NON_BLOCKING toolResponse、`scheduling: 'SILENT'` 時，Gemini 把意圖資訊「留待後面對話使用」而主動開口，興系統提示的靜默指令衝突。
>
> **Blocking 模式正確的原因**：
> - toolResponse 由前端立即回傳（<20ms），語音暫停時間人耳察覺不到
> - `scheduling: 'SILENT'` 在 blocking 模式下被 Gemini 忽略，靜默效果由系統提示的語言規則達成
> - 模式穩定，無自問自答問題
>
> 此議題移至「設計決策」章節 C。

**位置**: `src/config/api.js` — `GEMINI_TOOL_DECLARATIONS`

原問題描述：`copilot-instructions.md` 記載 `analyze_intent` 應為 `NON_BLOCKING`，但實際 `GEMINI_TOOL_DECLARATIONS` 中未設定 `behavior` 屬性。根據 Google 官方文件，缺少 `behavior: 'NON_BLOCKING'` 下，Gemini 會在 toolCall 時暫停語音生成。實際測試證明，blocking 模式 + 系統提示引導 = 正確行為，不需要修改。

**位置**: `src/config/api.js` — `GEMINI_TOOL_DECLARATIONS`

**問題**: `copilot-instructions.md` 記載 `analyze_intent` 應為 `NON_BLOCKING, WHEN_IDLE`，但實際 `GEMINI_TOOL_DECLARATIONS` 中未設定 `behavior` 屬性。根據 Google 官方文件：

> *"Function calling executes sequentially by default, meaning execution pauses until the results of each function call are available. This ensures sequential processing, which means you won't be able to continue interacting with the model while the functions are being run."*
>
> *"If you don't want to block the conversation, you can tell the model to run the functions asynchronously. To do so, you first need to add a `behavior` to the function definitions."*

**缺少 `behavior: 'NON_BLOCKING'` 時**，即使程式碼用 `_sendFunctionResponse` 立即回傳 toolResponse，Gemini 仍會在發出 toolCall 那一刻暫停語音生成，等待 toolResponse 後才恢復。每次偵測到客戶意圖時會造成短暫但可感知的語音停頓。

**官方正確做法**:
```js
{ name: "analyze_intent", behavior: "NON_BLOCKING", description: "...", parameters: {...} }
```

**連帶影響**: `_sendFunctionResponse` 中的 `scheduling: 'SILENT'` 是 NON_BLOCKING 專屬功能，沒有 `behavior: 'NON_BLOCKING'` 時 `scheduling` 欄位會被 Gemini 忽略。

**修正建議**: 在 `GEMINI_TOOL_DECLARATIONS` 的 `analyze_intent` 物件加上 `behavior: 'NON_BLOCKING'`。

---

### 2. ~~`copilot-instructions.md` 與實際程式碼不一致：「analyze_intent 不送 toolResponse」~~ ✅ 已修復

> **修復**: 更新 `.github/copilot-instructions.md` 以正確描述 Function Calling 行為，並同步更新 `GeminiLiveService.js` 中 `_sendSetupMessage()` 與 `_handleFunctionCall()` 的程式碼註解。

**位置**: `.github/copilot-instructions.md`

> *"analyze_intent (NON_BLOCKING, WHEN_IDLE — UI side-effect only, **no toolResponse sent**)"*

**實際**:
- `GeminiLiveService.js` L878 **確實有送 toolResponse**（`{ status: 'ok', scheduling: 'SILENT' }`）
- `RestWebSocketService.js` L709 **不送 toolResponse**

根據官方文件，即使是 NON_BLOCKING 的 tool，仍應送 toolResponse（否則 Gemini 不知道函式執行完畢）。GeminiLiveService 的做法（送 response）是正確的。

**問題**: 文件誤導後續開發者；兩個 service 對 `analyze_intent` 的 toolResponse 行為不一致。

---

### 3. `_resetBuffers()` 在 `interrupted` 事件中過早清除 `_userSpeechEndTime`

**位置**: `src/services/GeminiLiveService.js` — `_handleMessage` 中 `content.interrupted` 分支

```js
if (content.interrupted) {
  this._resetBuffers();  // ← 清除 _userSpeechEndTime
  if (this.onInterrupted) this.onInterrupted();
}
```

`_resetBuffers()` 會清除 `_userSpeechEndTime` 和 `_ttfc`。但 `interrupted` 代表使用者開始說話（打斷 AI），此時 `_userSpeechEndTime` 應該保留，因為接下來新的 turn 需要從這個時間起算 TTFC。

---

## 🟠 中度問題 (潛在風險 / 設計缺陷)

### 4. ~~`useAudioRecorder.js` 仍存在但不被使用（死碼）~~ ✅ 已修復

> **修復**: 已刪除 `src/hooks/useAudioRecorder.js`（248 行），同步移除 `STRUCTURE.md` 中對應的項目記錄。

**位置**: `src/hooks/useAudioRecorder.js`

`copilot-instructions.md` 明確記載 *"useAudioRecorder is removed"*，但檔案仍存在於專案中（248 行）。無任何地方 import 使用。這是死碼，應移除以保持一致性。

---

### 5. Gemini Live `_sendTextMessage` 使用 `clientContent` 發送歡迎觸發語

**位置**: `src/services/GeminiLiveService.js` — `initialize()` 中

```js
this._sendTextMessage(welcomePrompt);  // uses clientContent
```

Skill 文件 `gemini-live-api-dev` 明確記載：

> *"Use `sendRealtimeInput` for all real-time user input (audio, video, **and text**). Use `sendClientContent` **only** for incremental conversation history updates."*

`clientContent` 語義上是「補充對話歷史」，不是「送出新的使用者訊息」。雖然在歡迎觸發的場景下差異可能不大（只有初始化那一次），但語義上不正確，可能影響 Gemini 的內部 turn tracking。

---

### 6. ~~`my-voice-agent/` 目錄仍存在~~ ✅ 已修復

> **修復**: 已刪除整個 `my-voice-agent/` 目錄（含 `.env`、`node_modules/`、`src/`、`uploads/`、`規格.md` 等）。

使用者已確認 `my-voice-agent` 可以刪除。該目錄仍佔專案空間，建議移除。

---

### 7. `vite.config.js` 中 `rebuildIndex()` 的 `catch` 引用未定義變數 `filename`

**位置**: `vite.config.js` — `rebuildIndex()` 函式

```js
} catch (err) {
  console.error(`Failed to read or parse session file "${filename}":`, err.message || err);
  return null;
}
```

`filename` 在 `rebuildIndex()` 函式的 `catch` 作用域中未定義（只存在於 `files.map()` 的 callback 中）。此處 `filename` 會是 `undefined`。

---

### 8. ~~Session Resumption 首次連線時未啟用~~ ✅ 已修復

> **修復**: 將條件式 spread `...(resumptionHandle ? { sessionResumption: ... } : {})` 改為無條件賦值：
> ```js
> sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {}
> ```
> 首次連線時帶 `sessionResumption: {}` 空物件，使伺服器從一開始就傳送 `sessionResumptionUpdate` 訊息，確保 10 分鐘後重連可完整恢復對話脈絡。(`src/services/GeminiLiveService.js`)

**位置**: `src/services/GeminiLiveService.js` — `_sendSetupMessage()`

```js
...(resumptionHandle ? { sessionResumption: { handle: resumptionHandle } } : {})
```

首次連線時 `resumptionHandle` 為 `null`，不會附帶 `sessionResumption`。根據 Google 官方文件，要在首次連線就接收 `sessionResumptionUpdate`（含 `newHandle`），**首次 setup 就需要包含 `sessionResumption: {}` 空物件**。目前首次連線不啟用，代表只有重連時才有 resumption capability。

**建議**: 首次連線也帶 `sessionResumption: {}`，使得首次 10 分鐘連線結束時可以平滑接續。

---

### 9. Token Server `uses: 1` 與 API key fallback 的安全風險

**位置**: `token-server/src/index.js`

Ephemeral token 設為 `uses=1`（單次使用），搭配 `reconnect()` 取得新 token 是正確的。但 `_getEphemeralToken()` 若因 token server 暫時不可用而 fallback 到 API key，重連會將 API key 直接暴露在瀏覽器 WebSocket URL 中。Skill 文件明確建議：

> *"Use ephemeral tokens for client-side deployments — never expose API keys in browsers"*

---

### 10. `realtimeInput.audio` vs `realtimeInput.mediaChunks` 格式不一致

GeminiLiveService 使用（正確）：
```js
{ realtimeInput: { audio: { mimeType, data } } }
```
RestWebSocketService 使用：
```js
{ realtimeInput: { mediaChunks: [{ data, mimeType }] } }
```

Skill 文件：
> *"Do not use `media` in `sendRealtimeInput`. Use the specific keys: `audio` for audio data..."*

GeminiLiveService 的格式正確。RestWebSocketService 使用 `mediaChunks` 是因為後端 proxy 期望此格式。如果後端是完全相容的 Gemini Live wire protocol proxy，應統一使用 `audio` key。

---

### 11. `GeminiLiveService._sendTextMessage` 不記錄到 `SessionLogger`

歡迎觸發語和自動掛斷系統訊息透過 `_sendTextMessage` 發送，但未通過 `sessionLogger.log()`，導致 session 記錄缺少這些關鍵事件。相比之下，`RestWebSocketService.sendTextMessage()` 有正確記錄。

---

## 🟡 改善建議 (最佳實踐 / 可維護性)

### 12. `CallContext.jsx` 過於龐大 — 1259 行

整個 `CallContext.jsx` 承擔所有通話邏輯、三種模式的撥號/掛斷、所有回調設定、計時器管理、Function Calling 處理。建議拆分為：
- `useGeminiDialer` / `useRestWsDialer` / `useMockDialer` 自訂 hooks
- `CallContext` 只負責狀態暴露和模式分流

---

### 13. 回調函式在 `useCallback` 閉包中定義，通話期間無法動態更新

**位置**: `src/context/CallContext.jsx` — `dialGeminiLive` 的 `useCallback` 內

所有 `geminiService.onXxx = ...` 回調都在閉包內定義。若依賴值在通話中更新，回調仍持有舊的閉包值。雖然目前 `audioPlayer` 和 `addLog` 是穩定的 ref/callback，但通話狀態的判斷邏輯可能受影響。

---

### 14. `SYSTEM_PROMPTS` 和 `GEMINI_SYSTEM_PROMPTS` 大量重複

**位置**: `src/config/api.js`

兩份 prompt 內容高度重複，差異只在 Gemini 版多了「工具使用規則」段落且回覆字數不同（50→40 字）。維護兩份容易不同步。

**建議**: 共用基礎模板 + 按模式附加差異段落。

---

### 15. `pcmPlaybackEndTimeRef` 跨輪累積問題

**位置**: `src/hooks/useAudioPlayer.js`

程式碼中有 `⚠ onEnd 延遲過大` 的診斷 warning。`pcmPendingTimerIdsRef` 長度歸零時會重置，但若某個 turn 的最後一個 onEnd timer 觸發前下一個 turn 的 chunk 已開始播放，可能產生計時累積。

---

### 16. 模式名稱不一致

- 程式碼中用 `'rest-live'`
- UI 顯示 `'WS Live'`
- 文件中混用 `'REST WebSocket'`、`'REST Live'`、`'WS Live'`

建議統一文件用語。

---

### 17. `sendSystemMessage` 使用 `role: 'user'` 發送系統指令

**位置**: `src/services/GeminiLiveService.js` — `sendSystemMessage` 呼叫 `_sendTextMessage`

自動掛斷觸發語透過 `clientContent` + `role: 'user'` 發送，Gemini 會將其視為使用者訊息。此行為應確認是否符合預期。

---

### 18. `thinkingConfig: { thinkingBudget: 0 }` — 停用 thinking 的 tradeoff

**位置**: `src/services/GeminiLiveService.js` — setup message

完全停用 native audio model 的 thinking 能力降低延遲，但可能影響 Function Calling 中意圖判斷的準確率。建議在文件中說明此決策原因。

---

### 19. ~~`STRUCTURE.md` 與實際狀態不同步~~ ✅ 已修復

> **修復**: 已移除 `STRUCTURE.md` 中 `useAudioRecorder.js` 的項目記錄，與實際檔案系統同步。

`copilot-instructions.md` 記載 *"useAudioRecorder is removed"*，但 `STRUCTURE.md` 第 34 行仍列出 `useAudioRecorder.js`。按照 `project-workflow` skill 規範，檔案變動後需同步更新 `STRUCTURE.md`。

---

### 20. GoAway `timeLeft` 解析可能不完整

**位置**: `src/services/GeminiLiveService.js` — `message.goAway` 處理

Google API 的 `Duration` 格式可能是 `"300s"` 字串或 `{ seconds: "300", nanos: 0 }` 物件。目前的解析邏輯覆蓋了兩種格式，但建議加入更明確的 protobuf Duration 格式解析以提高穩健性。

---

### 21. `contextWindowCompression: { slidingWindow: {} }` 缺少控制參數

**位置**: `src/services/GeminiLiveService.js` — setup message

空物件依賴 Gemini 預設值，未知壓縮比率是否適合客服場景（可能過早壓縮重要客戶資訊）。建議研究是否需設定 `targetTokens` 等參數。

---

## 📝 設計決策記錄（非問題 — 已確認為有意的設計）

### C. `analyze_intent` 使用 Blocking 模式（身不設 'NON_BLOCKING'）

**經測試確認**：加入 `behavior: 'NON_BLOCKING'` 會導致 Gemini 自問自答。原因如下：

Gemini 官方對 `scheduling: 'SILENT'` 的定義是「**Or do nothing and use that knowledge later on in the discussion**」——將此知識留待後續對話使用。與 `NON_BLOCKING` 一起使用時，Gemini 在 IDLE 狀態收到 toolResponse 後，會把意圖分析結果「帶入下一居話」而主動開口，興系統提示規則 2（「呼叫 analyze_intent 後不主動說話」）衝突。

**目前正確構成**：
- **Blocking** + toolResponse 立即回傳（<20ms） + 系統提示靜默原則 = 正確、穩定
- `scheduling: 'SILENT'` 保留在 toolResponse 中但被 blocking 模式忽略（無剖）

### D. Gemini Live 模式 `echoCancellation: false`

**位置**: `src/context/CallContext.jsx` — `dialGeminiLive` 中 `getUserMedia` 設定

```js
audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
```

**原因**: 此專案使用 **suppress 機制**（AI 播放期間送靜音給 Gemini，播完後延遲 256ms 再恢復）取代瀏覽器 AEC，因為：
1. suppress 期間麥克風送靜音，不存在回音問題
2. suppress 解除 256ms 延遲足以讓殘留回音散掉
3. 不支援 interrupt AI 對話（使用者無法在 AI 說話時打斷）
4. 瀏覽器 AEC 演算法可能造成送入 Gemini 的音訊品質下降，影響 VAD 辨識

**註解問題**: 程式碼中的註解寫「啟用 AEC 消除喇叭回音」但值為 `false`，註解應修正以反映實際設計意圖。

### E. 不支援 Interrupted（使用者打斷 AI 說話）

雖然 Gemini Live API 原生支援 VAD 打斷機制、程式碼中也有 `onInterrupted` 回調和 `content.interrupted` 處理，但**目前產品設計不打算啟用使用者打斷 AI 的功能**。suppress 機制確保 AI 播放期間麥克風靜音，物理上阻止了打斷的發生。

---

## 📋 總結

| 分類 | 數量 | 已修復 / 已撤销 | 尚待處理 |
|------|------|------------|----------|
| 🔴 嚴重 | 3 | #1 🔄（撤销，設計決策 C）、#2 ✅ | #3 |
| 🟠 中度 | 8 | #4 ✅、#6 ✅、#8 ✅ | #5、#7、#9、#10、#11 |
| 🟡 改善 | 10 | #19 ✅ | #12、#13、#14、#15、#16、#17、#18、#20、#21 |
| 📝 設計決策 | 4 | — | C、D、E（有意設計，不修） |

**已修復（本 session）**：#2 註解與文件一致性、#4 死碼清理、#6 舊目錄移除、#8 Session Resumption 首次連線修正、#19 `STRUCTURE.md` 同步。  
**已撤销**：#1（`behavior: 'NON_BLOCKING'` 加入後導致自問自答，確認 blocking 模式為正確設計，移入設計決策 C）。

**剩餘最高優先**：問題 #3（`_resetBuffers()` 在 `interrupted` 事件中過早清除 `_userSpeechEndTime`）、#7（`vite.config.js` 未定義變數 `filename`）。
