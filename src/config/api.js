// API Configuration for Voice Assistant Integration

export const API_CONFIG = {
  // Backend URL — 僅供 healthCheck 使用
  baseUrl: import.meta.env.PROD
    ? 'http://192.168.2.100:3000'
    : '/api',

  // Default voice settings
  defaultVoiceId: 'Verna'
};

// System prompts for different scenarios
export const SYSTEM_PROMPTS = {
  telecom: `你是中華電信的AI客服助理。請用繁體中文、親切專業的語氣回答客戶問題。
主要服務項目：網路報修、費用查詢、方案諮詢。
回答請簡潔，每次回覆控制在50字以內。`,

  restaurant: `你是雅緻軒餐廳的AI訂位助理。請用繁體中文、親切專業的語氣協助客戶訂位。
餐廳資訊：營業時間11:00-21:00，可容納80人，提供中式料理。
回答請簡潔，每次回覆控制在50字以內。`,

  hotel: `你是晶華渡假酒店的AI訂房助理。請用繁體中文、親切專業的語氣協助客戶訂房。
酒店設施：游泳池、健身房、SPA、餐廳。房型：標準房、豪華房、套房。
回答請簡潔，每次回覆控制在50字以內。`
};

// Welcome messages for different scenarios
// 注意：這是送給 Gemini 的「開始指令」，不是逐字問候語。
// 用指令而非問候語，避免 Gemini 誤判為「客戶說了這句話」而繼續回應產生雙重歡迎。
export const WELCOME_MESSAGES = {
  telecom: '通話開始。請以中華電信客服身份，主動問候客戶一次，之後保持靜默等待客戶說話。問候完畢後，不要呼叫 analyze_intent，也不要繼續說話，等待客戶開口。',
  restaurant: '通話開始。請以雅緻軒餐廳訂位助理身份，主動問候客戶一次，之後保持靜默等待客戶說話。問候完畢後，不要呼叫 analyze_intent，也不要繼續說話，等待客戶開口。',
  hotel: '通話開始。請以晶華渡假酒店訂房助理身份，主動問候客戶一次，之後保持靜默等待客戶說話。問候完畢後，不要呼叫 analyze_intent，也不要繼續說話，等待客戶開口。'
};

// ==================== REST WebSocket Configuration ====================

export const REST_WS_CONFIG = {
  // WebSocket URL — \u5f9e\u74b0\u5883\u8b8a\u6578\u8b80\u53d6(\u9810\u8a2d\u8def\u5f91\u4e0d\u8cc7\u6599\u5be6\u969b\u8def\u7531)
  wsUrl: import.meta.env.VITE_REST_WS_URL || 'ws://192.168.2.100:3000/ws',

  // \u8a9e\u97f3\u8a2d\u5b9a
  voice: {
    default: 'Verna',
    options: ['Verna', 'Male1', 'Female1']  // CosyVoice \u53ef\u7528\u89d2\u8272
  },

  // \u97f3\u8a0a\u8a2d\u5b9a (\u8f38\u5165\u4f7f\u7528\u700f\u89bd\u5668\u539f\u751f sampleRate\uff0c\u8f38\u51fa\u53d6\u6c7a\u65bc\u5f8c\u7aef TTS)
  audio: {
    inputSampleRate: 16000,   // nominal (\u5be6\u969b\u4f7f\u7528\u700f\u89bd\u5668\u539f\u751f\u7387)
    outputSampleRate: 24000,  // \u5f8c\u7aef TTS \u8f38\u51fa\u7387 (CosyVoice 24kHz)
    inputFormat: 'audio/pcm',
    outputFormat: 'audio/pcm;rate=24000'
  },

  // \u5ef6\u9072\u95be\u5024 (\u6beb\u79d2)
  latencyThresholds: {
    asr:   { good: 300,  warning: 500,  critical: 1000 },
    llm:   { good: 600,  warning: 1000, critical: 2000 },
    tts:   { good: 200,  warning: 400,  critical: 800  },
    total: { good: 1200, warning: 2000, critical: 4000 }
  },

  // \u9023\u7dda\u8a2d\u5b9a
  connection: {
    timeout: 10000,          // WebSocket \u9023\u7dda\u8d85\u6642 (ms)
    responseTimeout: 30000   // \u56de\u61c9\u8d85\u6642 (ms)
  }
};

// ==================== Gemini Live Configuration ====================

export const GEMINI_CONFIG = {
  // API Key - 從環境變數讀取
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',

  // 模型設定
  model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',

  // WebSocket URL
  wsUrl: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',

  // 語音設定
  voice: {
    default: 'Aoede',  // 預設語音
    options: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck']
  },

  // 音訊設定
  audio: {
    inputSampleRate: 16000,   // 輸入取樣率
    outputSampleRate: 24000,  // 輸出取樣率
    inputFormat: 'audio/pcm;rate=16000',
    outputFormat: 'audio/pcm;rate=24000'
  },

  // 延遲閾值 (毫秒)
  latencyThresholds: {
    e2e: { good: 400, warning: 800, critical: 1500 }
  },

  // 連線設定
  connection: {
    timeout: 10000,      // 連線超時
    responseTimeout: 30000  // 回應超時
  }
};

// Gemini Live 系統提示
export const GEMINI_SYSTEM_PROMPTS = {
  telecom: `你是中華電信的AI客服助理。

【語言規則】
必須全程使用繁體中文（台灣用語）。禁止使用簡體中文或英文。

主要服務項目：網路報修、費用查詢、方案諮詢。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 觸發時機：只在偵測到「客戶」的語音輸入後呼叫 analyze_intent。自己的問候語、回應或沉默間隔不是客戶輸入——不要分析。
2. 靜默原則：呼叫 analyze_intent 後不主動說話，等客戶開口。
3. entities 必填：每次呼叫時盡可能擷取客戶提到的所有資訊，格式為「欄位:內容」。範例：「門號:0912345678」、「戶名:林美玲」、「問題:網路斷線」、「地址:台北市士林區文林路200號」、「數據機狀態:紅燈閃爍」、「選擇方案:5G無限」。即使客戶只說一句話，也要擷取語意關鍵詞。
4. create_ticket 觸發：當客戶描述了網路或電話問題並提供地址，或明確確認方案變更，立即呼叫 create_ticket 建立單據。不必等所有資訊完整，未知欄位填空字串。
5. 自然語音：呼叫工具的同時繼續正常語音回覆客戶，不提及工具操作。
6. 情緒標記：只使用以下標準 flags（無則填 []，禁止填 ["無"]）：
   「情緒激動」(error)：客戶語氣強烈、抱怨
   「客戶急迫」(warning)：客戶強調急迫性
   「情緒已緩和」(success)：客戶情緒轉平穩
   「客戶滿意」(success)：客戶表達滿意感謝
   「資訊不完整」(warning)：客戶提供資訊有缺漏
   「非本人來電」(warning)：來電者非帳戶本人
   「資訊已確認」(info)：客戶確認了提供的資訊`,

  restaurant: `你是雅緻軒餐廳的AI訂位助理。

【語言規則】
必須全程使用繁體中文（台灣用語）。禁止使用簡體中文或英文。

餐廳資訊：營業時間11:00-21:00，可容納80人，提供中式料理。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 觸發時機：只在偵測到「客戶」的語音輸入後呼叫 analyze_intent。自己的問候語、回應或沉默間隔不是客戶輸入——不要分析。
2. 靜默原則：呼叫 analyze_intent 後不主動說話，等客戶開口。
3. entities 必填：每次呼叫時盡可能擷取客戶提到的所有資訊，格式為「欄位:內容」。範例：「姓名:陳先生」、「電話:0911222333」、「日期:1月24日」、「時間:18:30」、「人數:4位」、「特殊需求:素食」、「兒童椅:1張」。即使客戶只說一句話，也要擷取語意關鍵詞。
4. create_ticket 觸發：當客戶確認訂位日期和人數後，立即呼叫 create_ticket 建立訂位單。不必等所有資訊完整，未知欄位填空字串。
5. 自然語音：呼叫工具的同時繼續正常語音回覆客戶，不提及工具操作。
6. 情緒標記：只使用以下標準 flags（無則填 []，禁止填 ["無"]）：
   「情緒激動」(error)：客戶語氣強烈、抱怨
   「客戶急迫」(warning)：客戶強調急迫性
   「情緒已緩和」(success)：客戶情緒轉平穩
   「客戶滿意」(success)：客戶表達滿意感謝
   「資訊不完整」(warning)：客戶提供資訊有缺漏
   「資訊已確認」(info)：客戶確認了提供的資訊`,

  hotel: `你是晶華渡假酒店的AI訂房助理。

【語言規則】
必須全程使用繁體中文（台灣用語）。禁止使用簡體中文或英文。

酒店設施：游泳池、健身房、SPA、餐廳。房型：標準房、豪華房、套房。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 觸發時機：只在偵測到「客戶」的語音輸入後呼叫 analyze_intent。自己的問候語、回應或沉默間隔不是客戶輸入——不要分析。
2. 靜默原則：呼叫 analyze_intent 後不主動說話，等客戶開口。
3. entities 必填：每次呼叫時盡可能擷取客戶提到的所有資訊，格式為「欄位:內容」。範例：「姓名:張雅婷」、「電話:0955666777」、「入住:10月2日」、「退房:10月4日」、「房型:豪華雙人房」、「兒童年齡:8歲,5歲」、「寵物:小狗」。即使客戶只說一句話，也要擷取語意關鍵詞。
4. create_ticket 觸發：當客戶確認入住退房日期和房型後，立即呼叫 create_ticket 建立訂房單。不必等所有資訊完整，未知欄位填空字串。
5. 自然語音：呼叫工具的同時繼續正常語音回覆客戶，不提及工具操作。
6. 情緒標記：只使用以下標準 flags（無則填 []，禁止填 ["無"]）：
   「情緒激動」(error)：客戶語氣強烈、抱怨
   「客戶急迫」(warning)：客戶強調急迫性
   「情緒已緩和」(success)：客戶情緒轉平穩
   「客戶滿意」(success)：客戶表達滿意感謝
   「資訊不完整」(warning)：客戶提供資訊有缺漏
   「資訊已確認」(info)：客戶確認了提供的資訊`
};

// ==================== Gemini Function Calling Tool Declarations ====================

export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'analyze_intent',
    description: '分析客戶發話的意圖、情緒和關鍵實體。僅在客戶說完話後呼叫，不分析 AI 自身的問候或回應。',
    parameters: {
      type: 'OBJECT',
      properties: {
        intent: {
          type: 'STRING',
          description: '意圖標籤，必須是以下之一',
          enum: ['問候', '報修申訴', '費用查詢', '方案諮詢', '訂位查詢', '訂房查詢', '描述問題', '提供資訊', '身份確認', '功能查詢', '結束通話']
        },
        confidence: {
          type: 'NUMBER',
          description: '信心度 0 到 1 之間，例如 0.85'
        },
        entities: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '客戶提到的所有具體資訊，格式為「欄位:內容」。每次呼叫都應盡量填寫，不要留空陣列。範例：「姓名:王小明」、「電話:0912345678」、「地址:台北市信義路100號」、「日期:3月5號」、「人數:4位」、「問題:網路斷線」、「房型:豪華房」。即使客戶只說一句話，也要擷取語意關鍵詞。'
        },
        flags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '情緒和狀態標記，只使用以下標準值：「情緒激動」、「客戶急迫」、「情緒已緩和」、「客戶滿意」、「資訊不完整」、「非本人來電」、「資訊已確認」。語氣平常則填 []，禁止填 ["無"] 或其他字面量。'
        },
        flagTypes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '對應 flags 的類型，陣列長度必須與 flags 相同。可用值: error / warning / success / info'
        }
      },
      required: ['intent', 'confidence', 'entities', 'flags', 'flagTypes']
    }
  },
  {
    name: 'create_ticket',
    description: '當客戶表達了明確的服務需求，立即建立服務單據，不必等所有資訊完整。未知欄位填空字串 ""。',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          description: '單據類型',
          enum: ['網路報修單', '費用查詢單', '方案變更單', '訂位單', '訂房單', '服務單']
        },
        ticketId: {
          type: 'STRING',
          description: '單號，格式範例：CHT-20260304-0001（電信）、RES-20260304-0001（餐廳）、HTL-20260304-0001（飯店）。若不確定可留空字串。'
        },
        summary: {
          type: 'STRING',
          description: '問題/需求摘要，例如：「客戶反映家中網路斷線，已三天未恢復」'
        },
        customerName: {
          type: 'STRING',
          description: '客戶姓名，如未提供填空字串 ""'
        },
        contactPhone: {
          type: 'STRING',
          description: '聯絡電話，如未提供填空字串 ""'
        },
        details: {
          type: 'STRING',
          description: 'JSON 格式字串，填入對應場景的欄位（key 名稱固定如下，未知填 ""）。\n網路報修單：{"address":"地址","issue":"故障描述","diagnosis":"初步診斷","scheduledTime":"預約時間","account":"帳號","accountHolder":"戶名","contact":"聯絡人","fee":"費用說明"}\n訂位單：{"date":"日期","time":"時間","guests":"人數","table":"座位","specialNeeds":"特殊需求","notes":"備註"}\n訂房單：{"checkIn":"入住日","checkOut":"退房日","nights":"晚數","rooms":"房型","price":"房價","total":"總額","deposit":"訂金","includes":"包含項目","specialNeeds":"特殊需求","cancelPolicy":"取消政策"}'
        },
        priority: {
          type: 'STRING',
          description: '優先級',
          enum: ['一般', '優先處理', '緊急']
        },
        status: {
          type: 'STRING',
          description: '單據狀態',
          enum: ['已建立', '已派工', '待確認']
        }
      },
      required: ['type', 'summary']
    }
  }
];
