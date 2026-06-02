# AI 語音客服助理系統架構設計

## 一、系統總覽

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI 語音客服助理系統                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │  客戶端  │───▶│   ASR    │───▶│   LLM    │───▶│   TTS    │───▶│  客戶端  │ │
│   │ (語音輸入)│    │ 語音轉文字 │    │ 對話引擎  │    │ 文字轉語音 │    │ (語音輸出)│ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│         │              │               │               │               │        │
│         │              ▼               ▼               ▼               │        │
│         │        ┌─────────────────────────────────────────────┐       │        │
│         │        │              儀錶板 Dashboard                │       │        │
│         │        │  • 即時逐字稿  • 意圖分析  • 單據產生  • Log │       │        │
│         │        └─────────────────────────────────────────────┘       │        │
│         │                            │                                 │        │
│         │                            ▼                                 │        │
│         │        ┌─────────────────────────────────────────────┐       │        │
│         │        │              後端服務 Backend                │       │        │
│         │        │  • Session 管理  • 業務邏輯  • 資料庫查詢    │       │        │
│         │        └─────────────────────────────────────────────┘       │        │
│         │                                                              │        │
└─────────┴──────────────────────────────────────────────────────────────┴────────┘
```

---

## 二、詳細流程圖

### 2.1 語音對話完整流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           語音對話處理流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

[客戶說話] 
    │
    ▼
┌─────────────────┐
│ 1. 音訊擷取      │  • 麥克風輸入 (WebRTC / MediaRecorder API)
│    Audio Capture │  • 音訊格式: PCM 16-bit, 16kHz mono
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. VAD 語音偵測  │  • Voice Activity Detection
│    端點偵測      │  • 判斷說話開始/結束
└────────┬────────┘  • 靜音超過 1.5 秒視為結束
         │
         ▼
┌─────────────────┐
│ 3. ASR 語音辨識  │  • 即時串流 (Streaming) 或 批次處理 (Batch)
│    Speech-to-Text│  • 輸出: 文字 + 時間戳記 + 信心度
└────────┬────────┘
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐
│ 4a. 前處理       │              │ 4b. 儀錶板更新   │
│    Preprocessing │              │    即時逐字稿    │
└────────┬────────┘              └─────────────────┘
         │
         │  • 文字正規化 (數字、日期、地址)
         │  • 敏感資訊遮罩 (身分證、信用卡)
         │  • 語意校正 (錯字修正)
         ▼
┌─────────────────┐
│ 5. LLM 對話引擎  │  
│    意圖識別      │  • Intent Classification
│    實體擷取      │  • Named Entity Recognition (NER)
│    回應生成      │  • Response Generation
└────────┬────────┘
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐
│ 6a. 業務邏輯處理 │              │ 6b. 儀錶板更新   │
│    API 呼叫      │              │    意圖/實體/單據 │
└────────┬────────┘              └─────────────────┘
         │
         │  • 查詢資料庫 (帳單、庫存、房況)
         │  • 建立工單 (報修、訂位、訂房)
         │  • 外部系統整合
         ▼
┌─────────────────┐
│ 7. TTS 語音合成  │  • 文字轉語音
│    Text-to-Speech│  • 輸出: 音訊串流
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 8. 音訊播放      │  • Web Audio API
│    Audio Playback│  • 支援打斷 (Barge-in)
└─────────────────┘
         │
         ▼
    [客戶聽到回應]
         │
         └──────▶ 回到步驟 1 (等待下一輪對話)
```

### 2.2 即時串流 vs 批次處理

```
┌─────────────────────────────────────────────────────────────────┐
│                    模式比較                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【即時串流模式 Streaming】                                      │
│                                                                 │
│   用戶說話 ──▶ [音訊chunk] ──▶ [音訊chunk] ──▶ [音訊chunk]       │
│                    │              │              │              │
│                    ▼              ▼              ▼              │
│               "你好"  ──▶  "你好我想" ──▶ "你好我想訂位"          │
│                                                                 │
│   優點: 延遲低、即時顯示、體驗好                                  │
│   缺點: 實作複雜、需要 WebSocket                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【批次處理模式 Batch】                                          │
│                                                                 │
│   用戶說話 ──▶ [完整音訊檔案] ──▶ ASR ──▶ "你好我想訂位"          │
│                                                                 │
│   優點: 實作簡單、準確度較高                                      │
│   缺點: 延遲較高、需等待說完                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、技術選型建議

### 3.1 ASR 語音辨識

| 方案 | 優點 | 缺點 | 中文支援 | 延遲 | 建議場景 |
|------|------|------|----------|------|----------|
| **OpenAI Whisper API** | 準確度高、多語言 | 僅批次、成本較高 | ★★★★★ | 中 | 品質優先 |
| **Google Speech-to-Text** | 串流支援、即時 | 需 GCP 帳號 | ★★★★★ | 低 | 即時對話 |
| **Azure Speech Service** | 企業整合、客製化 | 設定複雜 | ★★★★☆ | 低 | 企業部署 |
| **Whisper 本地部署** | 免費、隱私 | 需 GPU、維運成本 | ★★★★★ | 中高 | 地端部署 |
| **FunASR (阿里)** | 免費、中文優化 | 社群支援較少 | ★★★★★ | 中 | 成本敏感 |

**推薦組合**：
- 開發測試：OpenAI Whisper API（簡單快速）
- 正式環境：Google Speech-to-Text Streaming（低延遲）

### 3.2 LLM 大語言模型

| 方案 | 優點 | 缺點 | 建議場景 |
|------|------|------|----------|
| **Claude API** | 推理強、長上下文 | 成本較高 | 複雜對話邏輯 |
| **OpenAI GPT-4o** | 生態完整、Function Calling | 成本較高 | 通用場景 |
| **OpenAI GPT-4o-mini** | 性價比高、速度快 | 推理稍弱 | 成本敏感 |
| **本地 LLM (Llama/Qwen)** | 免費、隱私 | 需 GPU、品質不穩 | 地端部署 |

**推薦**：Claude API 或 GPT-4o + Function Calling

### 3.3 TTS 語音合成

| 方案 | 優點 | 缺點 | 中文自然度 | 延遲 |
|------|------|------|------------|------|
| **OpenAI TTS** | 自然度高、簡單 | 聲音選擇少 | ★★★★☆ | 低 |
| **Google Cloud TTS** | 聲音多、SSML 支援 | 設定複雜 | ★★★★☆ | 低 |
| **Azure Neural TTS** | 企業級、客製聲音 | 成本高 | ★★★★★ | 低 |
| **ElevenLabs** | 超自然、聲音複製 | 貴、中文一般 | ★★★☆☆ | 中 |
| **Edge TTS (免費)** | 免費、品質不錯 | 非官方 API | ★★★★☆ | 低 |

**推薦**：OpenAI TTS（開發）或 Azure Neural TTS（正式環境）

---

## 四、後端 API 設計

### 4.1 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        後端服務架構                              │
└─────────────────────────────────────────────────────────────────┘

                         ┌─────────────┐
                         │   Nginx     │
                         │ Load Balancer│
                         └──────┬──────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │ WebSocket     │   │ REST API      │   │ WebSocket     │
    │ /ws/call      │   │ /api/v1/*     │   │ /ws/dashboard │
    │ (語音串流)     │   │ (業務邏輯)     │   │ (儀錶板推送)   │
    └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   FastAPI Backend   │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ Session Mgr   │  │  ← 通話狀態管理
                    │  ├───────────────┤  │
                    │  │ ASR Service   │  │  ← 語音辨識整合
                    │  ├───────────────┤  │
                    │  │ LLM Service   │  │  ← 對話引擎
                    │  ├───────────────┤  │
                    │  │ TTS Service   │  │  ← 語音合成整合
                    │  ├───────────────┤  │
                    │  │ Business Logic│  │  ← 業務邏輯 (訂位/報修)
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
    ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
    │    Redis      │  │   PostgreSQL  │  │  外部 API     │
    │  (Session/    │  │  (業務資料)    │  │  (ASR/LLM/TTS)│
    │   Cache)      │  │               │  │               │
    └───────────────┘  └───────────────┘  └───────────────┘
```

### 4.2 核心 API 端點

```yaml
# API 端點設計

# ===== WebSocket 端點 =====

ws://api/ws/call/{session_id}:
  description: 語音通話雙向串流
  input:
    - audio_chunk (binary): 音訊片段
    - control (json): 控制指令 (mute/hangup/barge-in)
  output:
    - transcript (json): 即時逐字稿
    - ai_audio (binary): AI 回應音訊
    - analysis (json): 意圖分析結果
    - action (json): 業務動作結果

ws://api/ws/dashboard/{session_id}:
  description: 儀錶板即時推送
  output:
    - transcript_update: 逐字稿更新
    - intent_analysis: 意圖分析
    - entity_extraction: 實體擷取
    - ticket_created: 單據建立
    - system_log: 系統日誌

# ===== REST API 端點 =====

POST /api/v1/call/start:
  description: 開始通話
  request:
    scenario: string  # telecom | restaurant | hotel
    customer_id?: string
  response:
    session_id: string
    websocket_url: string

POST /api/v1/call/end:
  description: 結束通話
  request:
    session_id: string
  response:
    summary: object
    tickets: array

GET /api/v1/call/{session_id}/transcript:
  description: 取得完整逐字稿
  response:
    messages: array
    duration: number

GET /api/v1/call/{session_id}/analysis:
  description: 取得對話分析
  response:
    intents: array
    entities: array
    sentiment: object

# ===== 業務 API =====

POST /api/v1/booking/check-availability:
  description: 查詢空位
  request:
    type: string  # restaurant | hotel
    date: string
    time?: string
    guests?: number
  response:
    available: boolean
    alternatives?: array

POST /api/v1/ticket/create:
  description: 建立工單
  request:
    type: string  # repair | reservation | booking
    data: object
  response:
    ticket_id: string
    status: string
```

### 4.3 資料模型

```python
# models.py

from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

# ===== 通話 Session =====

class CallSession(BaseModel):
    session_id: str
    scenario: Literal["telecom", "restaurant", "hotel"]
    status: Literal["idle", "connecting", "active", "ended"]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    customer_info: Optional[dict]
    
# ===== 對話訊息 =====

class Message(BaseModel):
    id: str
    session_id: str
    role: Literal["customer", "ai", "system"]
    content: str
    timestamp: datetime
    audio_url: Optional[str]
    
    # ASR 相關
    asr_confidence: Optional[float]
    asr_alternatives: Optional[List[str]]
    
    # LLM 分析
    intent: Optional[str]
    intent_confidence: Optional[float]
    entities: Optional[List[dict]]
    flags: Optional[List[str]]

# ===== 意圖定義 =====

class IntentConfig(BaseModel):
    name: str
    description: str
    examples: List[str]
    required_entities: List[str]
    actions: List[str]

# ===== 工單 =====

class Ticket(BaseModel):
    ticket_id: str
    session_id: str
    type: Literal["repair", "reservation", "booking"]
    status: Literal["pending", "confirmed", "cancelled"]
    created_at: datetime
    data: dict

# ===== LLM 請求/回應 =====

class LLMRequest(BaseModel):
    session_id: str
    user_message: str
    conversation_history: List[dict]
    scenario_context: dict
    available_functions: List[dict]

class LLMResponse(BaseModel):
    assistant_message: str
    intent: str
    confidence: float
    entities: List[dict]
    function_calls: Optional[List[dict]]
    flags: List[str]
```

---

## 五、LLM Prompt 設計

### 5.1 System Prompt 結構

```python
SYSTEM_PROMPT_TEMPLATE = """
你是 {company_name} 的 AI 語音客服助理，名字叫{assistant_name}。

## 角色設定
- 說話方式：自然、親切、專業
- 語速：適中，每次回應控制在 2-3 句話內（語音友好）
- 情緒處理：遇到客戶抱怨時先同理再處理

## 業務範圍
{business_scope}

## 可用功能 (Function Calling)
{available_functions}

## 對話規則
1. 每次只問一個問題，不要一次問太多
2. 主動確認關鍵資訊（日期、人數、地址）
3. 遇到模糊表達要澄清（「兩週後」→ 具體日期）
4. 遇到超出範圍的問題，禮貌說明並引導回正題

## 當前時間
{current_datetime}

## 客戶資訊
{customer_context}
"""
```

### 5.2 Function Calling 定義

```python
FUNCTIONS = [
    {
        "name": "check_availability",
        "description": "查詢訂位/訂房空位狀況",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "日期，格式 YYYY-MM-DD"
                },
                "time": {
                    "type": "string",
                    "description": "時間，格式 HH:MM（餐廳用）"
                },
                "guests": {
                    "type": "integer",
                    "description": "人數"
                },
                "room_type": {
                    "type": "string",
                    "description": "房型（飯店用）"
                }
            },
            "required": ["date"]
        }
    },
    {
        "name": "create_reservation",
        "description": "建立訂位/訂房",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "訂位人姓名"},
                "phone": {"type": "string", "description": "聯絡電話"},
                "date": {"type": "string", "description": "日期"},
                "time": {"type": "string", "description": "時間"},
                "guests": {"type": "integer", "description": "人數"},
                "special_requests": {"type": "string", "description": "特殊需求"}
            },
            "required": ["name", "phone", "date"]
        }
    },
    {
        "name": "create_repair_ticket",
        "description": "建立報修單",
        "parameters": {
            "type": "object",
            "properties": {
                "account": {"type": "string", "description": "門號/帳號"},
                "address": {"type": "string", "description": "地址"},
                "issue": {"type": "string", "description": "問題描述"},
                "preferred_time": {"type": "string", "description": "希望維修時段"},
                "contact_name": {"type": "string", "description": "聯絡人"},
                "contact_phone": {"type": "string", "description": "聯絡電話"}
            },
            "required": ["account", "address", "issue"]
        }
    },
    {
        "name": "parse_fuzzy_date",
        "description": "解析模糊日期表達",
        "parameters": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "模糊日期表達，如「下週末」、「兩週後」、「中秋節」"
                }
            },
            "required": ["expression"]
        }
    },
    {
        "name": "query_account",
        "description": "查詢客戶帳戶資訊",
        "parameters": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "門號"},
                "query_type": {
                    "type": "string",
                    "enum": ["bill", "plan", "usage", "repair_history"],
                    "description": "查詢類型"
                }
            },
            "required": ["phone"]
        }
    }
]
```

---

## 六、參數配置建議

### 6.1 ASR 參數

```python
ASR_CONFIG = {
    # OpenAI Whisper
    "whisper": {
        "model": "whisper-1",
        "language": "zh",           # 強制中文，提高準確度
        "temperature": 0,           # 降低隨機性
        "response_format": "verbose_json",  # 取得時間戳記
    },
    
    # Google Speech-to-Text
    "google": {
        "encoding": "LINEAR16",
        "sample_rate_hertz": 16000,
        "language_code": "zh-TW",
        "enable_automatic_punctuation": True,
        "model": "latest_long",      # 或 "phone_call" 針對電話優化
        "use_enhanced": True,        # 使用增強模型
        "enable_word_time_offsets": True,
        
        # 串流設定
        "streaming_config": {
            "interim_results": True,  # 即時中間結果
            "single_utterance": False,
        }
    }
}
```

### 6.2 LLM 參數

```python
LLM_CONFIG = {
    # Claude
    "claude": {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 300,           # 語音回應不宜太長
        "temperature": 0.3,          # 較低溫度，穩定輸出
        "system": SYSTEM_PROMPT,
    },
    
    # OpenAI
    "openai": {
        "model": "gpt-4o",
        "max_tokens": 300,
        "temperature": 0.3,
        "functions": FUNCTIONS,
        "function_call": "auto",
    },
    
    # 對話管理
    "conversation": {
        "max_history_turns": 20,     # 保留最近 20 輪對話
        "context_window_tokens": 4000,
    }
}
```

### 6.3 TTS 參數

```python
TTS_CONFIG = {
    # OpenAI TTS
    "openai": {
        "model": "tts-1",            # 或 "tts-1-hd" 高品質
        "voice": "nova",             # alloy, echo, fable, onyx, nova, shimmer
        "speed": 1.0,                # 0.25 - 4.0
        "response_format": "mp3",    # mp3, opus, aac, flac
    },
    
    # Azure Neural TTS
    "azure": {
        "voice_name": "zh-TW-HsiaoChenNeural",  # 台灣女聲
        # 其他選項: zh-TW-YunJheNeural (男), zh-CN-XiaoxiaoNeural (大陸女)
        "output_format": "audio-16khz-128kbitrate-mono-mp3",
        "speaking_rate": "0%",       # -50% ~ +50%
        "pitch": "0%",               # -50% ~ +50%
        
        # SSML 支援
        "use_ssml": True,
        "ssml_template": """
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW">
            <voice name="{voice_name}">
                <prosody rate="{rate}" pitch="{pitch}">
                    {text}
                </prosody>
            </voice>
        </speak>
        """
    },
    
    # Edge TTS (免費方案)
    "edge": {
        "voice": "zh-TW-HsiaoChenNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
    }
}
```

### 6.4 VAD 語音活動偵測

```python
VAD_CONFIG = {
    "sample_rate": 16000,
    "frame_duration_ms": 30,         # 每幀長度
    "padding_duration_ms": 300,      # 前後 padding
    "silence_threshold": 0.5,        # 靜音判斷閾值
    "speech_pad_ms": 400,            # 語音前後保留
    
    # 端點偵測
    "endpoint_detection": {
        "min_speech_duration_ms": 250,   # 最短語音長度
        "max_silence_duration_ms": 1500, # 靜音多久算結束
        "min_silence_at_end_ms": 700,    # 結尾至少靜音多久
    },
    
    # 使用 WebRTC VAD 或 Silero VAD
    "vad_model": "silero",  # "webrtc" | "silero"
}
```

### 6.5 完整環境配置

```python
# config.py

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # === 服務配置 ===
    APP_NAME: str = "AI Voice Assistant"
    DEBUG: bool = False
    
    # === ASR 配置 ===
    ASR_PROVIDER: str = "openai"  # openai | google | azure
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    # === LLM 配置 ===
    LLM_PROVIDER: str = "claude"  # claude | openai
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY")
    LLM_MODEL: str = "claude-sonnet-4-20250514"
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 300
    
    # === TTS 配置 ===
    TTS_PROVIDER: str = "openai"  # openai | azure | edge
    TTS_VOICE: str = "nova"
    TTS_SPEED: float = 1.0
    
    # === WebSocket 配置 ===
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_MESSAGE_SIZE: int = 1048576  # 1MB
    
    # === Redis 配置 ===
    REDIS_URL: str = "redis://localhost:6379/0"
    SESSION_TTL: int = 3600  # 1 hour
    
    # === 資料庫配置 ===
    DATABASE_URL: str = "postgresql://user:pass@localhost/voice_assistant"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 七、前端整合 (語音輸入輸出)

### 7.1 瀏覽器端語音處理

```javascript
// voiceClient.js

class VoiceClient {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.ws = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.isRecording = false;
  }

  // 建立 WebSocket 連線
  async connect() {
    this.ws = new WebSocket(`wss://api.example.com/ws/call/${this.sessionId}`);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };
  }

  // 開始錄音
  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      } 
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };

    this.mediaRecorder.start(100); // 每 100ms 傳送一次
    this.isRecording = true;
  }

  // 停止錄音
  stopRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  // 播放 AI 回應音訊
  async playAudio(audioData) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    
    const audioBuffer = await this.audioContext.decodeAudioData(audioData);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
    
    return new Promise((resolve) => {
      source.onended = resolve;
    });
  }

  // 處理 WebSocket 訊息
  handleMessage(data) {
    switch (data.type) {
      case 'transcript':
        // 更新逐字稿 UI
        this.onTranscript?.(data);
        break;
      case 'ai_response':
        // 播放 AI 語音
        this.playAudio(data.audio);
        break;
      case 'analysis':
        // 更新分析面板
        this.onAnalysis?.(data);
        break;
      case 'ticket':
        // 顯示建立的單據
        this.onTicket?.(data);
        break;
    }
  }

  // 送出控制指令
  sendControl(command) {
    this.ws.send(JSON.stringify({ type: 'control', command }));
  }

  // 斷開連線
  disconnect() {
    this.stopRecording();
    this.ws?.close();
  }
}
```

---

## 八、延遲優化策略

```
┌─────────────────────────────────────────────────────────────────┐
│                     延遲優化策略                                  │
└─────────────────────────────────────────────────────────────────┘

目標總延遲: < 2 秒 (用戶說完 → 聽到 AI 回應)

┌─────────────────┬──────────────┬─────────────────────────────────┐
│ 階段            │ 目標延遲     │ 優化方式                         │
├─────────────────┼──────────────┼─────────────────────────────────┤
│ VAD 端點偵測    │ < 500ms      │ 較短靜音閾值、即時處理           │
├─────────────────┼──────────────┼─────────────────────────────────┤
│ ASR 語音辨識    │ < 500ms      │ 串流模式、選擇低延遲模型         │
├─────────────────┼──────────────┼─────────────────────────────────┤
│ LLM 推理        │ < 800ms      │ 串流輸出、較短回應、快取常見問題  │
├─────────────────┼──────────────┼─────────────────────────────────┤
│ TTS 語音合成    │ < 400ms      │ 串流合成、邊生成邊播放            │
└─────────────────┴──────────────┴─────────────────────────────────┘

進階優化:
1. LLM 串流 + TTS 串流並行：LLM 每產出一句就開始 TTS
2. 預測性生成：根據對話上下文預先生成可能的回應
3. 快取機制：常見 QA 直接從快取返回
4. 連線池：保持 API 連線，減少建立連線時間
```

---

## 九、下一步建議

### Phase 1: MVP (2-3 週)
- [ ] 建立 FastAPI 後端骨架
- [ ] 整合 OpenAI Whisper API (批次模式)
- [ ] 整合 Claude API + Function Calling
- [ ] 整合 OpenAI TTS
- [ ] 前端 WebSocket 連線

### Phase 2: 優化 (2-3 週)
- [ ] 改用 Google Speech-to-Text 串流模式
- [ ] 實作 VAD 端點偵測
- [ ] TTS 串流播放
- [ ] 儀錶板即時推送

### Phase 3: 進階功能 (3-4 週)
- [ ] 打斷處理 (Barge-in)
- [ ] 多輪對話狀態管理
- [ ] 業務系統整合 (真實資料庫)
- [ ] 通話錄音與回放
- [ ] 數據分析報表

---

## 十、附錄：技術資源

### API 文件
- OpenAI Whisper: https://platform.openai.com/docs/guides/speech-to-text
- Google Speech-to-Text: https://cloud.google.com/speech-to-text/docs
- Claude API: https://docs.anthropic.com/
- OpenAI TTS: https://platform.openai.com/docs/guides/text-to-speech

### 開源專案參考
- Pipecat (語音 AI 框架): https://github.com/pipecat-ai/pipecat
- Vocode (語音 Agent): https://github.com/vocodedev/vocode-python
- Silero VAD: https://github.com/snakers4/silero-vad

### 延伸閱讀
- WebRTC 語音處理: https://webrtc.org/
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
