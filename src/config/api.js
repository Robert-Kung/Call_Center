// API Configuration for Voice Assistant Integration

export const API_CONFIG = {
  // Backend URL - uses Vite proxy in development
  baseUrl: import.meta.env.PROD
    ? 'http://192.168.2.100:3000'
    : '/api',

  endpoints: {
    talk: '/webhook/talk'
  },

  // Request settings
  timeout: 30000,  // 30 seconds for full ASR->LLM->TTS pipeline
  retries: 2,

  // Default voice settings
  defaultVoiceId: 'Verna',

  // Latency thresholds for UI indicators (milliseconds)
  latencyThresholds: {
    asr: { good: 300, warning: 500, critical: 1000 },
    llm: { good: 600, warning: 1000, critical: 2000 },
    tts: { good: 200, warning: 400, critical: 800 },
    total: { good: 1200, warning: 2000, critical: 4000 }
  }
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
export const WELCOME_MESSAGES = {
  telecom: '您好，歡迎致電中華電信客服中心，請問有什麼可以為您服務的？',
  restaurant: '您好，歡迎致電雅緻軒餐廳，請問需要訂位嗎？',
  hotel: '您好，歡迎致電晶華渡假酒店，請問有什麼可以為您服務的？'
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
  telecom: `你是中華電信的AI客服助理。請用繁體中文、親切專業的語氣即時回答客戶問題。
主要服務項目：網路報修、費用查詢、方案諮詢。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 每當客戶說完一句有意義的話，同時呼叫 analyze_intent，特別注意擷取客戶提到的姓名、電話、地址等實體放入 entities 欄位（格式如 "姓名:王小明"）
2. 當客戶明確提出報修需求且描述了問題後，就呼叫 create_ticket 建立報修單，不需等到所有資訊都完整
3. 呼叫工具的同時繼續正常語音回覆客戶，不要在語音中提及工具操作
4. 如果客戶情緒激動，在 flags 加入 "情緒激動" 並設 flagTypes 為 error。客戶滿意時加 "客戶滿意" / success`,

  restaurant: `你是雅緻軒餐廳的AI訂位助理。請用繁體中文、親切專業的語氣即時協助客戶訂位。
餐廳資訊：營業時間11:00-21:00，可容納80人，提供中式料理。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 每當客戶說完一句有意義的話，同時呼叫 analyze_intent，特別註意擷取姓名、日期、時間、人數等實體（格式如 "姓名:李小花"、"人數:4位"、"日期:週六晚上"）
2. 當客戶提供了姓名和用餐需求後，就呼叫 create_ticket 建立訂位單，不需等到所有欄位都填完
3. 呼叫工具的同時繼續正常語音回覆客戶，不要在語音中提及工具操作
4. 如果客戶情緒激動，在 flags 加入 "情緒激動" 並設 flagTypes 為 error。客戶滿意時加 "客戶滿意" / success`,

  hotel: `你是晶華渡假酒店的AI訂房助理。請用繁體中文、親切專業的語氣即時協助客戶訂房。
酒店設施：游泳池、健身房、SPA、餐廳。房型：標準房、豪華房、套房。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。

【工具使用規則】
1. 每當客戶說完一句有意義的話，同時呼叫 analyze_intent，特別注意擷取姓名、日期、房型、人數等實體（格式如 "姓名:張大華"、"房型:豪華房"、"入住:3月5號"）
2. 當客戶提供了姓名和住宿需求後，就呼叫 create_ticket 建立訂房單，不需等到所有欄位都填完
3. 呼叫工具的同時繼續正常語音回覆客戶，不要在語音中提及工具操作
4. 如果客戶情緒激動，在 flags 加入 "情緒激動" 並設 flagTypes 為 error。客戶滿意時加 "客戶滿意" / success`
};

// ==================== Gemini Function Calling Tool Declarations ====================

export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'analyze_intent',
    description: '分析客戶當前發話的意圖、情緒和關鍵實體。每當客戶說完一句有意義的話時呼叫此工具。注意擷取客戶提到的具體資訊如姓名、電話、地址、日期、人數等。',
    parameters: {
      type: 'OBJECT',
      properties: {
        intent: {
          type: 'STRING',
          description: '意圖標籤，必須是以下之一：問候、報修申訴、費用查詢、方案諮詢、訂位查詢、確認預約、訂房查詢、描述問題、提供資訊、結束通話',
          enum: ['問候', '報修申訴', '費用查詢', '方案諮詢', '訂位查詢', '確認預約', '訂房查詢', '描述問題', '提供資訊', '結束通話']
        },
        confidence: {
          type: 'NUMBER',
          description: '信心度 0 到 1 之間，例如 0.85'
        },
        entities: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '客戶提到的具體資訊，例如："姓名:王小明"、"電話:0912345678"、"地址:台北市信義路100號"、"日期:3月5號"、"人數:4位"、"房型:豪華房"'
        },
        flags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '情緒和狀態標記，例如："情緒激動"、"客戶急迫"、"情緒已緩和"、"客戶滿意"、"資訊已確認"。如果客戶語氣平常則留空陣列 []'
        },
        flagTypes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '對應 flags 的類型，可用值: error / warning / success / info'
        }
      },
      required: ['intent', 'confidence', 'entities']
    }
  },
  {
    name: 'create_ticket',
    description: '當客戶明確提出服務需求且已收集到足夠資訊時，建立服務單據。報修單需要問題描述；訂位單需要姓名、日期、人數；訂房單需要姓名、日期、房型。即使資訊不完整也應建立單據，將已知資訊填入。',
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
          description: '單號，格式範例：CHT-20260302-0001、RES-20260302-0001、HTL-20260302-0001'
        },
        summary: {
          type: 'STRING',
          description: '問題/需求摘要，例如："客戶反映家中網路斷線，已三天未恢復"'
        },
        customerName: {
          type: 'STRING',
          description: '客戶姓名，如未提供可留空'
        },
        contactPhone: {
          type: 'STRING',
          description: '聯絡電話，如未提供可留空'
        },
        details: {
          type: 'STRING',
          description: 'JSON 格式的詳細欄位，依場景而異。報修: {"address":"地址","issue":"故障描述"}; 訂位: {"date":"日期","time":"時間","guests":"人數","specialRequests":"特殊需求"}; 訂房: {"checkIn":"入住日","checkOut":"退房日","roomType":"房型","guests":"人數"}'
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
