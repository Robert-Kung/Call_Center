# AI 語音客服中心 API 規格書

> **版本**: 1.0.0  
> **最後更新**: 2026-01-15  
> **Base URL**: `https://api.example.com/v1`  
> **WebSocket URL**: `wss://api.example.com/ws`

---

## 目錄

1. [概述](#1-概述)
2. [認證與授權](#2-認證與授權)
3. [WebSocket API](#3-websocket-api)
4. [REST API](#4-rest-api)
5. [資料模型](#5-資料模型)
6. [LLM Function Calling](#6-llm-function-calling)
7. [錯誤處理](#7-錯誤處理)
8. [附錄](#8-附錄)

---

## 1. 概述

### 1.1 系統架構

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   客戶端    │────▶│   Gateway   │────▶│   Backend   │
│  (Browser)  │◀────│   (Nginx)   │◀────│  (FastAPI)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
            ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
            │  ASR Service │           │ LLM Service │           │ TTS Service │
            │  (Whisper)   │           │  (Claude)   │           │  (OpenAI)   │
            └─────────────┘           └─────────────┘           └─────────────┘
```

### 1.2 支援場景

| 場景代碼 | 名稱 | 業務範圍 |
|----------|------|----------|
| `telecom` | 中華電信 | QA、帳單查詢、報修申請 |
| `restaurant` | 雅緻軒餐廳 | QA、訂位、菜色查詢 |
| `hotel` | 晶華渡假酒店 | QA、訂房、旅遊資訊 |

### 1.3 通訊協定

| 功能 | 協定 | 說明 |
|------|------|------|
| 語音串流 | WebSocket | 雙向即時音訊傳輸 |
| 儀錶板更新 | WebSocket | 即時推送分析結果 |
| 業務操作 | REST API | 通話管理、工單建立 |

---

## 2. 認證與授權

### 2.1 API Key 認證

所有 API 請求需在 Header 中包含 API Key：

```http
Authorization: Bearer {api_key}
```

### 2.2 WebSocket 認證

WebSocket 連線時透過 Query Parameter 傳遞 Token：

```
wss://api.example.com/ws/call/{session_id}?token={jwt_token}
```

### 2.3 JWT Token 結構

```json
{
  "sub": "user_id",
  "exp": 1704067200,
  "iat": 1704063600,
  "scope": ["call:read", "call:write", "dashboard:read"],
  "org_id": "org_123"
}
```

---

## 3. WebSocket API

### 3.1 語音通話連線

#### 端點
```
wss://api.example.com/ws/call/{session_id}
```

#### 連線參數

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `session_id` | string | ✓ | 通話 Session ID |
| `token` | string | ✓ | JWT Token |

#### 連線流程

```
Client                                  Server
   │                                      │
   │──── WebSocket Connect ──────────────▶│
   │                                      │
   │◀─── connection_established ──────────│
   │     { session_id, status }           │
   │                                      │
   │──── audio_chunk (binary) ───────────▶│  ← 客戶語音輸入
   │──── audio_chunk (binary) ───────────▶│
   │                                      │
   │◀─── transcript_interim ──────────────│  ← ASR 中間結果
   │     { text, is_final: false }        │
   │                                      │
   │◀─── transcript_final ────────────────│  ← ASR 最終結果
   │     { text, is_final: true }         │
   │                                      │
   │◀─── analysis ────────────────────────│  ← LLM 分析結果
   │     { intent, entities, flags }      │
   │                                      │
   │◀─── ai_response_start ───────────────│  ← AI 回應開始
   │                                      │
   │◀─── ai_audio_chunk (binary) ─────────│  ← TTS 音訊串流
   │◀─── ai_audio_chunk (binary) ─────────│
   │                                      │
   │◀─── ai_response_end ─────────────────│  ← AI 回應結束
   │     { text, duration }               │
   │                                      │
   │──── control { command: "hangup" } ──▶│  ← 掛斷
   │                                      │
   │◀─── call_ended ──────────────────────│
   │     { summary, duration }            │
   │                                      │
```

---

#### 3.1.1 Client → Server 訊息

##### (A) 音訊資料 (Binary)

直接傳送二進位音訊資料：
- **格式**: PCM 16-bit, 16kHz, Mono 或 WebM Opus
- **建議區塊大小**: 100ms (1600 samples for PCM)

##### (B) 控制指令 (JSON)

```typescript
interface ControlMessage {
  type: "control";
  command: "mute" | "unmute" | "hangup" | "barge_in";
  timestamp?: number;  // Unix timestamp ms
}
```

**指令說明**:

| 指令 | 說明 |
|------|------|
| `mute` | 靜音（停止傳送音訊） |
| `unmute` | 取消靜音 |
| `hangup` | 結束通話 |
| `barge_in` | 打斷 AI 回應 |

**範例**:
```json
{
  "type": "control",
  "command": "hangup",
  "timestamp": 1704067200000
}
```

---

#### 3.1.2 Server → Client 訊息

##### (A) 連線建立

```typescript
interface ConnectionEstablished {
  type: "connection_established";
  session_id: string;
  scenario: "telecom" | "restaurant" | "hotel";
  status: "connected";
  server_time: string;  // ISO 8601
}
```

##### (B) ASR 逐字稿（中間結果）

```typescript
interface TranscriptInterim {
  type: "transcript_interim";
  text: string;
  confidence: number;     // 0-1
  is_final: false;
  timestamp: number;
}
```

##### (C) ASR 逐字稿（最終結果）

```typescript
interface TranscriptFinal {
  type: "transcript_final";
  text: string;
  confidence: number;
  is_final: true;
  timestamp: number;
  duration_ms: number;    // 語音長度
  alternatives?: string[]; // 替代結果
}
```

##### (D) LLM 分析結果

```typescript
interface AnalysisResult {
  type: "analysis";
  intent: string;
  intent_confidence: number;
  entities: Entity[];
  flags: string[];
  action?: ActionRequest;
  timestamp: number;
}

interface Entity {
  type: string;       // "date", "time", "phone", "name", "address", etc.
  value: string;      // 原始值
  normalized?: string; // 正規化值
  confidence: number;
}

interface ActionRequest {
  action_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
}
```

**範例**:
```json
{
  "type": "analysis",
  "intent": "訂位需求",
  "intent_confidence": 0.94,
  "entities": [
    {
      "type": "date",
      "value": "兩週後週末",
      "normalized": "2026-01-24",
      "confidence": 0.89
    },
    {
      "type": "guests",
      "value": "4個人",
      "normalized": "4",
      "confidence": 0.95
    }
  ],
  "flags": ["⚠️ 模糊日期需解析", "🔥 熱門時段"],
  "action": {
    "action_type": "date_parsing",
    "status": "completed",
    "message": "日期解析: 兩週後週末 → 2026/01/24 (六)"
  },
  "timestamp": 1704067200000
}
```

##### (E) AI 回應開始

```typescript
interface AIResponseStart {
  type: "ai_response_start";
  response_id: string;
  timestamp: number;
}
```

##### (F) AI 音訊資料 (Binary)

直接傳送二進位音訊資料：
- **格式**: MP3 或 Opus
- **串流**: 邊生成邊傳送

##### (G) AI 回應文字（串流）

```typescript
interface AITextChunk {
  type: "ai_text_chunk";
  response_id: string;
  text: string;          // 增量文字
  is_final: boolean;
}
```

##### (H) AI 回應結束

```typescript
interface AIResponseEnd {
  type: "ai_response_end";
  response_id: string;
  full_text: string;
  duration_ms: number;
  timestamp: number;
}
```

##### (I) 業務動作結果

```typescript
interface ActionResult {
  type: "action_result";
  action_type: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
```

**範例 - 查詢空位**:
```json
{
  "type": "action_result",
  "action_type": "check_availability",
  "success": true,
  "data": {
    "available": false,
    "requested": {
      "date": "2026-01-24",
      "time": "18:30",
      "guests": 4
    },
    "alternatives": [
      { "date": "2026-01-24", "time": "17:30", "status": "available" },
      { "date": "2026-01-24", "time": "20:00", "status": "available" },
      { "date": "2026-01-25", "time": "18:30", "status": "available" }
    ]
  },
  "timestamp": 1704067200000
}
```

##### (J) 工單建立通知

```typescript
interface TicketCreated {
  type: "ticket_created";
  ticket: Ticket;
  timestamp: number;
}

interface Ticket {
  ticket_id: string;
  ticket_type: "repair" | "reservation" | "booking";
  status: "pending" | "confirmed" | "hold";
  data: RepairTicket | ReservationTicket | BookingTicket;
  created_at: string;
}
```

**範例 - 訂位單**:
```json
{
  "type": "ticket_created",
  "ticket": {
    "ticket_id": "R-0124-17",
    "ticket_type": "reservation",
    "status": "confirmed",
    "data": {
      "name": "陳先生/小姐",
      "phone": "0911-222-333",
      "date": "2026-01-24",
      "time": "17:30",
      "guests": 4,
      "table": "B區 圓桌",
      "special_needs": ["兒童座椅x1", "素食x1（蛋奶素）"],
      "notes": "人數若增加請前一天來電確認"
    },
    "created_at": "2026-01-12T14:30:00Z"
  },
  "timestamp": 1704067200000
}
```

##### (K) 系統日誌

```typescript
interface SystemLog {
  type: "system_log";
  level: "info" | "warning" | "error" | "success" | "ai";
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

##### (L) 通話結束

```typescript
interface CallEnded {
  type: "call_ended";
  session_id: string;
  duration_seconds: number;
  summary: string;
  tickets_created: string[];  // ticket_ids
  transcript_url: string;
  timestamp: number;
}
```

---

### 3.2 儀錶板連線

#### 端點
```
wss://api.example.com/ws/dashboard/{session_id}
```

#### 說明

供值機人員監看通話狀態的唯讀連線，接收與 `/ws/call` 相同的訊息，但不能傳送音訊或控制指令。

#### 額外訊息類型

##### 通話狀態變更

```typescript
interface CallStateChange {
  type: "call_state_change";
  session_id: string;
  previous_state: CallState;
  current_state: CallState;
  timestamp: number;
}

type CallState = "idle" | "ringing" | "connected" | "hold" | "ended";
```

##### 情緒分析

```typescript
interface SentimentUpdate {
  type: "sentiment_update";
  sentiment: "positive" | "neutral" | "negative";
  score: number;        // -1 to 1
  indicators: string[]; // ["情緒激動", "語速加快"]
  timestamp: number;
}
```

---

## 4. REST API

### 4.1 通話管理

#### 4.1.1 建立通話 Session

**POST** `/calls`

建立新的通話 Session，取得 WebSocket 連線資訊。

**Request Body**:
```typescript
interface CreateCallRequest {
  scenario: "telecom" | "restaurant" | "hotel";
  customer_id?: string;        // 可選：已知客戶 ID
  metadata?: {
    channel: string;           // "web" | "app" | "phone"
    device_info?: string;
    [key: string]: any;
  };
}
```

**Response** `201 Created`:
```typescript
interface CreateCallResponse {
  session_id: string;
  scenario: string;
  status: "created";
  websocket_url: string;
  dashboard_url: string;
  expires_at: string;          // Session 過期時間
  created_at: string;
}
```

**範例**:
```bash
curl -X POST https://api.example.com/v1/calls \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "restaurant",
    "metadata": {
      "channel": "web"
    }
  }'
```

**Response**:
```json
{
  "session_id": "call_abc123xyz",
  "scenario": "restaurant",
  "status": "created",
  "websocket_url": "wss://api.example.com/ws/call/call_abc123xyz",
  "dashboard_url": "wss://api.example.com/ws/dashboard/call_abc123xyz",
  "expires_at": "2026-01-12T15:30:00Z",
  "created_at": "2026-01-12T14:30:00Z"
}
```

---

#### 4.1.2 取得通話資訊

**GET** `/calls/{session_id}`

**Response** `200 OK`:
```typescript
interface CallInfo {
  session_id: string;
  scenario: string;
  status: CallState;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  customer_info?: CustomerInfo;
  tickets: TicketSummary[];
  metadata?: Record<string, any>;
}

interface CustomerInfo {
  name?: string;
  phone?: string;
  account?: string;
  relationship?: string;  // "本人" | "配偶" | "家屬"
}

interface TicketSummary {
  ticket_id: string;
  ticket_type: string;
  status: string;
}
```

---

#### 4.1.3 結束通話

**POST** `/calls/{session_id}/end`

**Request Body** (可選):
```typescript
interface EndCallRequest {
  reason?: string;             // "completed" | "abandoned" | "transferred"
  notes?: string;
}
```

**Response** `200 OK`:
```typescript
interface EndCallResponse {
  session_id: string;
  status: "ended";
  duration_seconds: number;
  summary: CallSummary;
  tickets: Ticket[];
  transcript_url: string;
  recording_url?: string;
}

interface CallSummary {
  total_turns: number;
  customer_turns: number;
  ai_turns: number;
  intents_detected: string[];
  issues_resolved: boolean;
  sentiment_trend: string;
}
```

---

#### 4.1.4 取得通話逐字稿

**GET** `/calls/{session_id}/transcript`

**Query Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `format` | string | `json` (預設) 或 `text` |
| `include_timestamps` | boolean | 是否包含時間戳記 |
| `include_analysis` | boolean | 是否包含分析結果 |

**Response** `200 OK`:
```typescript
interface TranscriptResponse {
  session_id: string;
  scenario: string;
  duration_seconds: number;
  messages: TranscriptMessage[];
}

interface TranscriptMessage {
  id: string;
  role: "customer" | "ai" | "system";
  content: string;
  timestamp: string;
  duration_ms?: number;
  analysis?: {
    intent?: string;
    confidence?: number;
    entities?: Entity[];
    flags?: string[];
  };
}
```

---

#### 4.1.5 列出通話紀錄

**GET** `/calls`

**Query Parameters**:

| 參數 | 類型 | 說明 |
|------|------|------|
| `scenario` | string | 篩選場景 |
| `status` | string | 篩選狀態 |
| `start_date` | string | 起始日期 (ISO 8601) |
| `end_date` | string | 結束日期 |
| `page` | number | 頁碼 (預設 1) |
| `page_size` | number | 每頁筆數 (預設 20, 最大 100) |

**Response** `200 OK`:
```typescript
interface CallListResponse {
  data: CallInfo[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}
```

---

### 4.2 工單管理

#### 4.2.1 取得工單詳情

**GET** `/tickets/{ticket_id}`

**Response** `200 OK`:
```typescript
interface TicketDetailResponse {
  ticket_id: string;
  session_id: string;
  ticket_type: "repair" | "reservation" | "booking";
  status: string;
  data: RepairTicket | ReservationTicket | BookingTicket;
  history: TicketHistory[];
  created_at: string;
  updated_at: string;
}

interface TicketHistory {
  action: string;
  actor: string;
  timestamp: string;
  details?: Record<string, any>;
}
```

---

#### 4.2.2 更新工單狀態

**PATCH** `/tickets/{ticket_id}`

**Request Body**:
```typescript
interface UpdateTicketRequest {
  status?: string;
  data?: Partial<RepairTicket | ReservationTicket | BookingTicket>;
  notes?: string;
}
```

**Response** `200 OK`:
```typescript
interface UpdateTicketResponse {
  ticket_id: string;
  status: string;
  updated_at: string;
}
```

---

#### 4.2.3 取消工單

**POST** `/tickets/{ticket_id}/cancel`

**Request Body**:
```typescript
interface CancelTicketRequest {
  reason: string;
  cancelled_by?: string;
}
```

---

### 4.3 業務查詢 API

#### 4.3.1 查詢可用時段（餐廳/飯店）

**POST** `/availability/check`

**Request Body**:
```typescript
interface CheckAvailabilityRequest {
  type: "restaurant" | "hotel";
  date: string;              // YYYY-MM-DD
  time?: string;             // HH:MM (餐廳)
  guests?: number;           // 人數
  nights?: number;           // 住宿晚數 (飯店)
  room_type?: string;        // 房型 (飯店)
}
```

**Response** `200 OK`:
```typescript
interface CheckAvailabilityResponse {
  available: boolean;
  requested: {
    date: string;
    time?: string;
    guests?: number;
  };
  result?: {
    // 餐廳
    tables?: AvailableTable[];
    // 飯店
    rooms?: AvailableRoom[];
  };
  alternatives?: Alternative[];
}

interface AvailableTable {
  table_id: string;
  zone: string;
  capacity: number;
  features: string[];  // ["窗邊", "包廂"]
}

interface AvailableRoom {
  room_type: string;
  available_count: number;
  price_per_night: number;
  features: string[];
}

interface Alternative {
  date: string;
  time?: string;
  status: "available" | "limited";
  note?: string;
}
```

---

#### 4.3.2 解析模糊日期

**POST** `/utils/parse-date`

**Request Body**:
```typescript
interface ParseDateRequest {
  expression: string;        // "兩週後週末", "中秋節", "下個月底"
  reference_date?: string;   // 參考日期 (預設今天)
}
```

**Response** `200 OK`:
```typescript
interface ParseDateResponse {
  expression: string;
  parsed_dates: ParsedDate[];
  confidence: number;
}

interface ParsedDate {
  date: string;              // YYYY-MM-DD
  day_of_week: string;       // "六"
  description: string;       // "2026年1月24日 週六"
  is_holiday?: boolean;
  holiday_name?: string;     // "中秋節"
}
```

**範例**:
```bash
curl -X POST https://api.example.com/v1/utils/parse-date \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "中秋節連假",
    "reference_date": "2026-01-12"
  }'
```

**Response**:
```json
{
  "expression": "中秋節連假",
  "parsed_dates": [
    {
      "date": "2026-10-01",
      "day_of_week": "四",
      "description": "2026年10月1日 週四",
      "is_holiday": true,
      "holiday_name": "中秋節連假"
    },
    {
      "date": "2026-10-02",
      "day_of_week": "五",
      "description": "2026年10月2日 週五",
      "is_holiday": true,
      "holiday_name": "中秋節連假"
    },
    {
      "date": "2026-10-03",
      "day_of_week": "六",
      "description": "2026年10月3日 週六 (中秋節)",
      "is_holiday": true,
      "holiday_name": "中秋節"
    },
    {
      "date": "2026-10-04",
      "day_of_week": "日",
      "description": "2026年10月4日 週日",
      "is_holiday": true,
      "holiday_name": "中秋節連假"
    }
  ],
  "confidence": 0.95
}
```

---

#### 4.3.3 查詢帳戶資訊（電信）

**POST** `/telecom/account/query`

**Request Body**:
```typescript
interface QueryAccountRequest {
  phone: string;             // 門號或市話
  query_type: "bill" | "plan" | "usage" | "repair_history";
  verify?: {
    holder_name?: string;    // 戶名
    id_last_four?: string;   // 身分證後四碼
  };
}
```

**Response** `200 OK`:
```typescript
interface QueryAccountResponse {
  account: {
    phone: string;
    holder_name: string;
    account_type: "mobile" | "landline" | "broadband";
    status: "active" | "suspended" | "terminated";
  };
  query_result: BillInfo | PlanInfo | UsageInfo | RepairHistory;
}

interface BillInfo {
  type: "bill";
  current_bill: {
    amount: number;
    due_date: string;
    status: "unpaid" | "paid" | "overdue";
  };
  recent_bills?: {
    period: string;
    amount: number;
    status: string;
  }[];
}

interface PlanInfo {
  type: "plan";
  plan_name: string;
  monthly_fee: number;
  data_quota?: string;
  voice_quota?: string;
  contract_end_date?: string;
}
```

---

#### 4.3.4 查詢維修時段（電信）

**POST** `/telecom/repair/schedule`

**Request Body**:
```typescript
interface RepairScheduleRequest {
  address: string;
  issue_type: "network" | "phone" | "tv" | "other";
  preferred_dates?: string[];  // 希望的日期
  preferred_time?: "morning" | "afternoon" | "evening";
}
```

**Response** `200 OK`:
```typescript
interface RepairScheduleResponse {
  available_slots: TimeSlot[];
  earliest_available: TimeSlot;
}

interface TimeSlot {
  date: string;
  time_range: string;        // "14:00-17:00"
  is_preferred: boolean;
  estimated_arrival?: string;
}
```

---

### 4.4 場景配置 API

#### 4.4.1 取得場景設定

**GET** `/scenarios/{scenario_id}/config`

**Response** `200 OK`:
```typescript
interface ScenarioConfig {
  scenario_id: string;
  name: string;
  company_info: {
    name: string;
    phone: string;
    address?: string;
    hours?: string;
  };
  ai_config: {
    assistant_name: string;
    greeting: string;
    personality: string;
  };
  intents: IntentConfig[];
  entities: EntityConfig[];
  business_rules: BusinessRule[];
}

interface IntentConfig {
  name: string;
  description: string;
  examples: string[];
  required_entities: string[];
  actions: string[];
  priority: number;
}

interface EntityConfig {
  name: string;
  type: "text" | "number" | "date" | "time" | "phone" | "address";
  validation?: string;        // regex pattern
  normalization?: string;     // 正規化規則
}

interface BusinessRule {
  rule_id: string;
  condition: string;
  action: string;
  message?: string;
}
```

---

## 5. 資料模型

### 5.1 工單資料結構

#### 5.1.1 報修單 (RepairTicket)

```typescript
interface RepairTicket {
  // 帳戶資訊
  account: string;            // 門號/帳號
  account_holder: string;     // 戶名
  contact: string;            // 聯絡人
  contact_phone: string;      // 聯絡電話
  relationship?: string;      // 與戶主關係
  
  // 問題描述
  address: string;            // 報修地址
  issue: string;              // 問題描述
  symptoms?: string[];        // 症狀
  diagnosis?: string;         // 初步診斷
  
  // 維修安排
  scheduled_time: string;     // 預約時段
  priority: "normal" | "urgent" | "emergency";
  
  // 費用
  fee_estimate?: string;      // 費用說明
  
  // 狀態
  status: "pending" | "dispatched" | "in_progress" | "completed" | "cancelled";
  engineer_name?: string;
  engineer_phone?: string;
}
```

#### 5.1.2 訂位單 (ReservationTicket)

```typescript
interface ReservationTicket {
  // 訂位人資訊
  name: string;
  phone: string;
  
  // 訂位資訊
  date: string;               // YYYY-MM-DD
  time: string;               // HH:MM
  guests: number | string;    // 數字或 "4-6位"
  table?: string;             // 座位區域
  
  // 特殊需求
  special_needs?: string[];   // ["兒童座椅x1", "素食x1"]
  notes?: string;
  
  // 狀態
  status: "confirmed" | "hold" | "cancelled" | "completed" | "no_show";
  hold_until?: string;        // 保留期限
  
  // 提醒
  reminder_sent?: boolean;
  confirmation_sent?: boolean;
}
```

#### 5.1.3 訂房單 (BookingTicket)

```typescript
interface BookingTicket {
  // 訂房人資訊
  name: string;
  phone: string;
  email?: string;
  
  // 入住資訊
  check_in: string;           // YYYY-MM-DD HH:MM
  check_out: string;
  nights: number;
  
  // 房間資訊
  rooms: RoomBooking[];
  
  // 住客資訊
  guests: {
    adults: number;
    children?: number;
    children_ages?: number[];
  };
  
  // 價格
  room_rate: string;          // 每晚房價
  total_amount: number;       // 總金額
  deposit: number;            // 訂金
  deposit_status: "pending" | "paid" | "refunded";
  
  // 包含服務
  includes?: string[];        // ["早餐", "溫泉", "健身房"]
  
  // 備註
  special_requests?: string[];
  pet_note?: string;
  cancel_policy?: string;
  
  // 狀態
  status: "hold" | "pending_payment" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
  hold_until?: string;
}

interface RoomBooking {
  room_type: string;
  quantity: number;
  add_bed?: boolean;
  price_per_night: number;
}
```

---

### 5.2 分析結果資料結構

```typescript
interface ConversationAnalysis {
  session_id: string;
  
  // 意圖統計
  intents: {
    name: string;
    count: number;
    first_occurrence: number;  // turn number
  }[];
  
  // 實體統計
  entities: {
    type: string;
    values: string[];
  }[];
  
  // 情緒分析
  sentiment: {
    overall: "positive" | "neutral" | "negative";
    score: number;             // -1 to 1
    trend: "improving" | "stable" | "declining";
    highlights: {
      turn: number;
      sentiment: string;
      trigger: string;
    }[];
  };
  
  // 對話品質
  quality: {
    resolution_achieved: boolean;
    escalation_needed: boolean;
    customer_satisfaction?: number;  // 1-5
    avg_response_time_ms: number;
    interruptions: number;
  };
}
```

---

## 6. LLM Function Calling

### 6.1 Function 定義

以下為 LLM 可呼叫的 Function 定義，使用 OpenAI Function Calling 格式：

```typescript
const FUNCTIONS = [
  {
    name: "check_availability",
    description: "查詢餐廳訂位或飯店訂房的空位狀況",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["restaurant", "hotel"],
          description: "查詢類型"
        },
        date: {
          type: "string",
          description: "日期，格式 YYYY-MM-DD"
        },
        time: {
          type: "string",
          description: "時間，格式 HH:MM（餐廳訂位用）"
        },
        guests: {
          type: "integer",
          description: "人數"
        },
        room_type: {
          type: "string",
          description: "房型（飯店訂房用）"
        },
        nights: {
          type: "integer",
          description: "住宿晚數（飯店訂房用）"
        }
      },
      required: ["type", "date"]
    }
  },
  
  {
    name: "create_reservation",
    description: "建立餐廳訂位",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "訂位人姓名"
        },
        phone: {
          type: "string",
          description: "聯絡電話"
        },
        date: {
          type: "string",
          description: "訂位日期 YYYY-MM-DD"
        },
        time: {
          type: "string",
          description: "訂位時間 HH:MM"
        },
        guests: {
          type: "integer",
          description: "用餐人數"
        },
        special_needs: {
          type: "array",
          items: { type: "string" },
          description: "特殊需求（兒童座椅、素食等）"
        },
        notes: {
          type: "string",
          description: "備註事項"
        }
      },
      required: ["name", "phone", "date", "time", "guests"]
    }
  },
  
  {
    name: "create_booking",
    description: "建立飯店訂房",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "訂房人姓名"
        },
        phone: {
          type: "string",
          description: "聯絡電話"
        },
        check_in: {
          type: "string",
          description: "入住日期 YYYY-MM-DD"
        },
        check_out: {
          type: "string",
          description: "退房日期 YYYY-MM-DD"
        },
        room_type: {
          type: "string",
          description: "房型"
        },
        room_count: {
          type: "integer",
          description: "房間數量"
        },
        adults: {
          type: "integer",
          description: "成人人數"
        },
        children: {
          type: "integer",
          description: "兒童人數"
        },
        children_ages: {
          type: "array",
          items: { type: "integer" },
          description: "兒童年齡"
        },
        add_bed: {
          type: "boolean",
          description: "是否加床"
        },
        special_requests: {
          type: "array",
          items: { type: "string" },
          description: "特殊需求"
        }
      },
      required: ["name", "phone", "check_in", "check_out", "room_type"]
    }
  },
  
  {
    name: "create_repair_ticket",
    description: "建立電信報修單",
    parameters: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "門號或帳號"
        },
        account_holder: {
          type: "string",
          description: "戶名"
        },
        contact_name: {
          type: "string",
          description: "聯絡人姓名"
        },
        contact_phone: {
          type: "string",
          description: "聯絡電話"
        },
        relationship: {
          type: "string",
          description: "與戶主關係"
        },
        address: {
          type: "string",
          description: "報修地址"
        },
        issue: {
          type: "string",
          description: "問題描述"
        },
        symptoms: {
          type: "array",
          items: { type: "string" },
          description: "問題症狀"
        },
        preferred_time: {
          type: "string",
          description: "希望維修時段"
        },
        priority: {
          type: "string",
          enum: ["normal", "urgent"],
          description: "優先程度"
        }
      },
      required: ["account", "address", "issue"]
    }
  },
  
  {
    name: "parse_fuzzy_date",
    description: "解析模糊的日期表達為具體日期",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "模糊日期表達，如「下週末」、「兩週後」、「中秋節」"
        }
      },
      required: ["expression"]
    }
  },
  
  {
    name: "query_account",
    description: "查詢電信客戶帳戶資訊",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "門號或市話"
        },
        query_type: {
          type: "string",
          enum: ["bill", "plan", "usage", "repair_history"],
          description: "查詢類型"
        }
      },
      required: ["phone", "query_type"]
    }
  },
  
  {
    name: "check_repair_schedule",
    description: "查詢可用的維修時段",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "維修地址"
        },
        issue_type: {
          type: "string",
          enum: ["network", "phone", "tv", "other"],
          description: "問題類型"
        },
        preferred_dates: {
          type: "array",
          items: { type: "string" },
          description: "希望的日期"
        }
      },
      required: ["address"]
    }
  },
  
  {
    name: "check_menu_item",
    description: "查詢餐廳菜色供應狀況",
    parameters: {
      type: "object",
      properties: {
        item_name: {
          type: "string",
          description: "菜色名稱"
        },
        date: {
          type: "string",
          description: "查詢日期"
        },
        meal_period: {
          type: "string",
          enum: ["lunch", "dinner"],
          description: "用餐時段"
        }
      },
      required: ["item_name"]
    }
  },
  
  {
    name: "get_business_info",
    description: "查詢商家基本資訊（地址、營業時間、停車資訊等）",
    parameters: {
      type: "object",
      properties: {
        info_type: {
          type: "string",
          enum: ["address", "hours", "parking", "facilities", "nearby", "policy"],
          description: "資訊類型"
        }
      },
      required: ["info_type"]
    }
  },
  
  {
    name: "check_promotions",
    description: "查詢可用的優惠方案",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "適用日期"
        },
        booking_type: {
          type: "string",
          description: "訂房/訂位類型"
        }
      },
      required: []
    }
  },
  
  {
    name: "hold_reservation",
    description: "保留訂位/訂房（尚未確認）",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["restaurant", "hotel"],
          description: "保留類型"
        },
        name: {
          type: "string",
          description: "姓名"
        },
        phone: {
          type: "string",
          description: "電話"
        },
        reservation_details: {
          type: "object",
          description: "訂位/訂房詳情"
        },
        hold_duration_hours: {
          type: "integer",
          description: "保留時數"
        }
      },
      required: ["type", "name", "phone", "reservation_details"]
    }
  }
];
```

---

## 7. 錯誤處理

### 7.1 HTTP 錯誤碼

| 狀態碼 | 說明 | 範例情境 |
|--------|------|----------|
| `400` | Bad Request | 請求格式錯誤、必填欄位缺失 |
| `401` | Unauthorized | API Key 無效或過期 |
| `403` | Forbidden | 無權限存取該資源 |
| `404` | Not Found | Session 或工單不存在 |
| `409` | Conflict | 資源狀態衝突（如重複建立） |
| `422` | Unprocessable Entity | 請求資料驗證失敗 |
| `429` | Too Many Requests | 請求頻率超限 |
| `500` | Internal Server Error | 伺服器內部錯誤 |
| `503` | Service Unavailable | 服務暫時不可用 |

### 7.2 錯誤回應格式

```typescript
interface ErrorResponse {
  error: {
    code: string;            // 錯誤代碼
    message: string;         // 錯誤訊息
    details?: any;           // 詳細資訊
    request_id?: string;     // 請求 ID（用於追蹤）
  };
}
```

### 7.3 錯誤代碼表

| 錯誤代碼 | HTTP 狀態碼 | 說明 |
|----------|-------------|------|
| `invalid_request` | 400 | 請求格式錯誤 |
| `missing_field` | 400 | 必填欄位缺失 |
| `invalid_field` | 422 | 欄位值無效 |
| `authentication_failed` | 401 | 認證失敗 |
| `token_expired` | 401 | Token 已過期 |
| `permission_denied` | 403 | 權限不足 |
| `resource_not_found` | 404 | 資源不存在 |
| `session_expired` | 404 | Session 已過期 |
| `session_already_ended` | 409 | 通話已結束 |
| `duplicate_request` | 409 | 重複請求 |
| `rate_limit_exceeded` | 429 | 超過請求限制 |
| `asr_error` | 500 | 語音辨識服務錯誤 |
| `llm_error` | 500 | LLM 服務錯誤 |
| `tts_error` | 500 | 語音合成服務錯誤 |
| `database_error` | 500 | 資料庫錯誤 |
| `external_service_error` | 503 | 外部服務不可用 |

### 7.4 WebSocket 錯誤

```typescript
interface WebSocketError {
  type: "error";
  error: {
    code: string;
    message: string;
    recoverable: boolean;    // 是否可恢復
    retry_after_ms?: number; // 建議重試間隔
  };
  timestamp: number;
}
```

**範例**:
```json
{
  "type": "error",
  "error": {
    "code": "asr_timeout",
    "message": "語音辨識服務回應超時",
    "recoverable": true,
    "retry_after_ms": 1000
  },
  "timestamp": 1704067200000
}
```

---

## 8. 附錄

### 8.1 Rate Limits

| API 類型 | 限制 | 時間窗口 |
|----------|------|----------|
| REST API | 100 requests | per minute |
| WebSocket 連線 | 10 connections | per user |
| 音訊傳送 | 1 MB | per second |

### 8.2 WebSocket 心跳

Client 需每 30 秒發送心跳訊息：

```json
{
  "type": "ping",
  "timestamp": 1704067200000
}
```

Server 回應：

```json
{
  "type": "pong",
  "timestamp": 1704067200001
}
```

### 8.3 音訊格式支援

| 格式 | 編碼 | 取樣率 | 聲道 | 說明 |
|------|------|--------|------|------|
| PCM | LINEAR16 | 16kHz | Mono | 建議格式 |
| WebM | Opus | 16kHz | Mono | 瀏覽器原生支援 |
| MP3 | MP3 | 24kHz | Mono | TTS 輸出 |

### 8.4 SDK 範例

#### JavaScript/TypeScript

```typescript
import { VoiceCallClient } from '@example/voice-sdk';

const client = new VoiceCallClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.example.com/v1'
});

// 建立通話
const session = await client.createCall({
  scenario: 'restaurant'
});

// 連線 WebSocket
await session.connect();

// 開始錄音
await session.startRecording();

// 監聽事件
session.on('transcript', (data) => {
  console.log('逐字稿:', data.text);
});

session.on('analysis', (data) => {
  console.log('意圖:', data.intent);
});

session.on('ticket', (data) => {
  console.log('工單建立:', data.ticket_id);
});

// 結束通話
await session.hangup();
```

#### Python

```python
from voice_sdk import VoiceCallClient

client = VoiceCallClient(
    api_key="your-api-key",
    base_url="https://api.example.com/v1"
)

# 建立通話
session = client.create_call(scenario="restaurant")

# 連線並處理
async with session.connect() as ws:
    async for message in ws:
        if message.type == "transcript":
            print(f"逐字稿: {message.text}")
        elif message.type == "analysis":
            print(f"意圖: {message.intent}")
        elif message.type == "ticket_created":
            print(f"工單: {message.ticket.ticket_id}")
```

---

## 變更日誌

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-15 | 初始版本 |

---

## 聯絡資訊

- **技術支援**: support@example.com
- **API 狀態頁面**: https://status.example.com
- **開發者文件**: https://docs.example.com
