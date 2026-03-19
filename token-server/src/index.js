require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3005;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 支援逗號分隔的多個 origin，例如：http://localhost:3100,http://localhost:5173
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'http://localhost:3100')
  .split(',').map(o => o.trim());

// 初始化 Gemini 客戶端（使用 v1alpha，ephemeral token 只在此版本支援）
let genaiClient;
if (GEMINI_API_KEY) {
  genaiClient = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { apiVersion: 'v1alpha' },
  });
}

app.use(cors({
  origin: ALLOWED_ORIGINS.length === 1 ? ALLOWED_ORIGINS[0] : ALLOWED_ORIGINS,
  methods: ['POST', 'GET'],
}));
app.use(express.json());

// 健康檢查
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Gemini Token Server',
    port: PORT,
    ready: !!genaiClient,
  });
});

/**
 * POST /api/gemini-token
 * 向 Gemini 簽發 ephemeral token，回傳給前端使用
 *
 * 前端用 token.name 作為 WebSocket URL 的 access_token 參數：
 *   wss://...BidiGenerateContent?access_token={token.name}
 */
app.post('/api/gemini-token', async (req, res) => {
  if (!genaiClient) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 未設定，請建立 token-server/.env' });
  }

  try {
    const now = new Date();
    // newSessionExpireTime: 1 分鐘後（必須在此時間內建立 WebSocket 連線）
    const newSessionExpireTime = new Date(now.getTime() + 60 * 1000).toISOString();
    // expireTime: 30 分鐘後（連線建立後可傳訊息的最長時間）
    const expireTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const tokenResponse = await genaiClient.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
      },
    });

    // tokenResponse.name 是給前端用的 ephemeral token
    const token = tokenResponse.name;
    if (!token) {
      console.error('[TokenServer] Gemini 回應格式異常:', tokenResponse);
      return res.status(502).json({ error: 'Gemini 回應缺少 token.name' });
    }

    console.log('[TokenServer] 成功簽發 ephemeral token，有效期至:', expireTime);
    res.json({
      token,
      expiresAt: new Date(expireTime).getTime(),
    });

  } catch (err) {
    console.error('[TokenServer] 簽發 token 失敗:', err.message);
    res.status(500).json({ error: '內部錯誤', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[TokenServer] Gemini Token Server 啟動於 port ${PORT}`);
  console.log(`[TokenServer] 允許來源: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!GEMINI_API_KEY) {
    console.warn('[TokenServer] ⚠️  GEMINI_API_KEY 未設定，請建立 .env 檔案');
  }
});
