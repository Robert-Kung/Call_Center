import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const backendHost = process.env.VITE_BACKEND_HOST || '192.168.2.100';
const backendPort = process.env.VITE_BACKEND_PORT || '8003';

// Session Log Plugin — 接收前端 POST 的對話記錄，寫入 data/ 資料夾 + Docker log
function sessionLogPlugin() {
  const dataDir = path.resolve(process.cwd(), 'data');

  return {
    name: 'session-log-plugin',
    configureServer(server) {
      // 確保 data 資料夾存在
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 即時事件 log → Docker log (stdout)
      server.middlewares.use('/api/session-log', (req, res, next) => {
        // 排除 /api/session-log/save (由下一個 handler 處理)
        if (req.url === '/save') return next();
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { sessionId, event } = JSON.parse(body);
            const ts = event?.timestamp || new Date().toISOString();
            const type = event?.type || 'unknown';

            // 印到 Docker log（server-side stdout）
            if (type === 'turn_complete') {
              console.log(`\n📝 [${ts}] [${sessionId}] TURN COMPLETE`);
              if (event.userText) console.log(`   👤 USER: ${event.userText}`);
              if (event.aiText) console.log(`   🤖 AI:   ${event.aiText}`);
              if (event.latency) console.log(`   ⏱  Latency: ${event.latency}ms`);
            } else if (type === 'input_transcript') {
              console.log(`🎤 [${ts}] [${sessionId}] USER: ${event.text || '(空)'}`);
            } else if (type === 'output_transcript') {
              console.log(`🔊 [${ts}] [${sessionId}] AI: ${event.text || '(空)'}`);
            } else if (type === 'session_start') {
              console.log(`\n🟢 [${ts}] SESSION START: ${sessionId} (${event.scenarioName || event.scenarioId})`);
            } else if (type === 'session_end') {
              console.log(`\n🔴 [${ts}] SESSION END: ${sessionId} (${event.totalEvents} events, ${Math.round((event.duration || 0)/1000)}s)`);
            } else if (type === 'error') {
              console.log(`❌ [${ts}] [${sessionId}] ERROR: ${event.message || JSON.stringify(event)}`);
            } else if (type === 'audio_stats') {
              console.log(`🎵 [${ts}] [${sessionId}] AUDIO: chunks=${event.chunksSent || 0}, totalBytes=${event.totalBytes || 0}`);
            } else if (type === 'welcome') {
              console.log(`👋 [${ts}] [${sessionId}] WELCOME: ${event.aiText || '(無文字)'}`);
            } else {
              console.log(`📋 [${ts}] [${sessionId}] ${type}: ${JSON.stringify(event).substring(0, 200)}`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          } catch (err) {
            console.error('Session log parse error:', err.message);
            res.writeHead(400);
            res.end('{"error":"parse error"}');
          }
        });
      });

      // 完整 session 儲存為 JSON 檔案
      server.middlewares.use('/api/session-log/save', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const session = JSON.parse(body);
            const filename = `session-${session.sessionId || Date.now()}.json`;
            const filepath = path.join(dataDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(session, null, 2), 'utf-8');
            console.log(`\n💾 Session saved: ${filepath}`);

            // 印出對話摘要
            if (session.summary?.length > 0) {
              console.log(`\n===== 對話摘要 (${session.summary.length} 回合) =====`);
              session.summary.forEach((turn, i) => {
                if (turn.userText) console.log(`  [${i+1}] 👤 USER: ${turn.userText}`);
                if (turn.aiText)   console.log(`  [${i+1}] 🤖 AI:   ${turn.aiText}`);
              });
              console.log('===== 摘要結束 =====\n');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, file: filename }));
          } catch (err) {
            console.error('Session save error:', err.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sessionLogPlugin()],
  server: {
    port: 3100,
    host: '0.0.0.0',
    allowedHosts: ['callcenter.rouqikong.com'],
    watch: {
      usePolling: true,
    },
    // Proxy for voice assistant backend API (排除 session-log — 由 plugin 處理)
    proxy: {
      '/api': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 60000,
        bypass(req) {
          // session-log 由 Vite plugin 處理，不走 proxy
          if (req.url.startsWith('/api/session-log')) return req.url;
        },
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error:', err);
          });
        }
      },
      // REST WebSocket proxy — 開發環境可設 VITE_REST_WS_URL=/ws/live
      '/ws': {
        target: `ws://${backendHost}:${backendPort}`,
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[WS Proxy] ❌ Error: ${err.message} | path: ${req?.url || '?'}`);
          });
          proxy.on('proxyReqWs', (proxyReq, req) => {
            console.log(`[WS Proxy] 🔗 ${req.url} → ws://${backendHost}:${backendPort}${req.url}`);
          });
          proxy.on('close', (res, socket) => {
            console.log(`[WS Proxy] 🔌 closed`);
          });
        }
      }
    }
  },
})
