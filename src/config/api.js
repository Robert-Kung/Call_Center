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
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。`,

  restaurant: `你是雅緻軒餐廳的AI訂位助理。請用繁體中文、親切專業的語氣即時協助客戶訂位。
餐廳資訊：營業時間11:00-21:00，可容納80人，提供中式料理。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。`,

  hotel: `你是晶華渡假酒店的AI訂房助理。請用繁體中文、親切專業的語氣即時協助客戶訂房。
酒店設施：游泳池、健身房、SPA、餐廳。房型：標準房、豪華房、套房。
回答請簡潔自然，適合語音對話，每次回覆控制在30字以內。`
};
