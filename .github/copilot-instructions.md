# Copilot Instructions

## Project overview
- React + Vite frontend (port 3100) in [src/App.jsx](src/App.jsx) with five views (demo/consumer/agent/system/history).
- Three voice modes: **Mock** (scripted demo), **WS Live** (Gemini Live wire protocol via backend proxy), **Gemini Live** (end-to-end WebSocket, direct to Google).
- Backend proxy server at `192.168.2.100:8003` (uvicorn/Python) — handles WS Live mode via `/ws/live`. Not needed for Mock or Gemini Live.
- Primary WS Live flow: 16kHz PCM stream → `RestWebSocketService` → backend proxy `/ws/live` (Gemini Live wire protocol) → 24kHz PCM audio + transcript.
- Primary Gemini Live flow: 16kHz PCM stream → `GeminiLiveService` → Google Gemini WebSocket direct → 24kHz PCM audio + transcript.
- **Gemini model**: `gemini-2.5-flash-native-audio-preview-12-2025` — native audio output, affective dialog, 128k context window. This is the recommended model for all Live API use cases.
- **Token server**: `token-server/` (Express, port 3005) signs ephemeral tokens via `@google/genai` v1alpha. Frontend calls `POST /api/gemini-token` before each Gemini Live connection.

## Architecture & data flow
- `CallContext` is the state hub for call lifecycle, mode (`voiceMode`), logs, latency, transcripts, tickets, and analysis. Start at [src/context/CallContext.jsx](src/context/CallContext.jsx).
- `voiceMode` values: `'mock'` | `'rest-live'` | `'gemini-live'`. All branching logic should use this.
- `ModeSwitch` component ([src/components/ModeSwitch.jsx](src/components/ModeSwitch.jsx)) handles UI for switching modes; rendered in App.jsx header as `HeaderModeSwitch` (compact mode, disabled during calls). The `'rest-live'` mode label displays as **WS Live**.
- WS Live: `VoiceService` → `RestWebSocketService` ([src/services/RestWebSocketService.js](src/services/RestWebSocketService.js)) → WebSocket to backend proxy. Uses the **Gemini Live wire protocol**: `setup`→`setupComplete` handshake, `realtimeInput.mediaChunks` for mic streaming (backend-specific format), `serverContent.*` for responses, `toolCall` for function calling.
- Gemini Live: `VoiceService` → `GeminiLiveService` ([src/services/GeminiLiveService.js](src/services/GeminiLiveService.js)) opens a `BidiGenerateContent` WebSocket, streams mic audio via `realtimeInput.audio`, receives PCM audio + transcript via callbacks. Also handles `toolCall` messages for function calling.
- Both WS Live and Gemini Live use continuous streaming (server-side VAD — no PTT). `isStreaming` in `CallContext` is shared by both modes. `useAudioRecorder` hook file exists but is unused dead code.
- **Audio formats**: Input 16kHz PCM mono (`audio/pcm;rate=16000`), Output 24kHz PCM mono. Gemini resamples non-16kHz input automatically. AudioContext for capture is created at 16kHz; browser hardware handles downsampling.
- **Gemini Live latency metrics** (from `GeminiLiveService.onTurnComplete`): `ttfc` (ms from user speech end → first AI audio chunk), `streamDuration` (ms from first chunk → turnComplete), `total = ttfc + streamDuration`. These replace the old single `e2e` field. `latencyMetrics.ttfc` and `latencyMetrics.streamDuration` are set in `CallContext` on each turn.
- **Streaming AI text**: `CallContext` exposes `streamingAiText` (reset on each turn start, built up via `GeminiLiveService.onTranscript({type:'output', text})`). `ConversationPanel` renders a live typing bubble using this value; it disappears once `turn_complete` fires and the full message is appended to `displayedConversations`.
- **DemoView panel visibility** is `voiceMode`-gated: `AnalysisPanel` + `TicketPanel` hidden for `rest-live` (no function calls); `LatencyMonitor` shown only for `mock` (Live modes have their own panels). `GeminiLivePanel` and `RestWsPanel` self-hide via `voiceMode` guard inside each component.

### Function Calling (Gemini Live)
- `GEMINI_TOOL_DECLARATIONS` in [src/config/api.js](src/config/api.js) defines two tools:
  - **`analyze_intent`**: **Intentionally uses default blocking mode** (no `behavior: 'NON_BLOCKING'`). toolResponse is returned instantly by the frontend (<20ms), so the pause is imperceptible. `scheduling: 'SILENT'` is kept in the toolResponse but is **ignored in blocking mode** per official docs — silence is achieved instead by the system prompt's "silence principle" (rule 2: don't speak after calling analyze_intent). Adding `NON_BLOCKING` causes Gemini to self-answer: it calls the tool async, then in IDLE state treats `SILENT` as "use knowledge later in the discussion" and proactively speaks, conflicting with the silence rule.
  - **`create_ticket`**: Default blocking behavior. Sends toolResponse with execution result; Gemini verbally confirms ticket creation.
- `CallContext.onToolCall` processes results and updates `currentAnalysis` / `tickets` state.
- WS Live mode: `RestWebSocketService` handles toolCall similarly but does NOT send toolResponse for `analyze_intent` (backend proxy handles response).

### Echo prevention & interruption policy
- **No user interruption of AI**: This project intentionally does NOT support users interrupting AI while it speaks. The suppress mechanism (send silence during AI playback → 256ms delay after playback → resume mic) physically prevents interruption.
- **`echoCancellation: false`** in Gemini Live `getUserMedia`: Intentional design. Browser AEC is unnecessary (suppress handles echo prevention) and can degrade audio quality sent to Gemini VAD. REST WS mode uses `echoCancellation: true` because its backend may handle audio differently.
- The `onInterrupted` handler exists as defensive code but is not expected to trigger in normal operation.

### Session management (Gemini Live)
- **Context window compression**: `contextWindowCompression: { slidingWindow: {} }` in setup message. Avoids 15-min hard cutoff for audio-only sessions.
- **Session resumption**: `sessionResumptionUpdate` tokens are saved in `_lastResumptionHandle`. On reconnect, the handle is passed to `_sendSetupMessage()` to restore conversation context (valid for 2 hours).
- **GoAway handling**: `onGoAway` callback warns `CallContext` of imminent server disconnect. `CallContext` triggers `reconnect()` with exponential backoff (max 3 attempts).
- **Connection lifetime**: ~10 min per WebSocket. Use session resumption + context compression for longer calls.

### Authentication (Gemini Live)
- **Ephemeral tokens** (recommended): Frontend calls `POST /api/gemini-token` (token-server) → receives single-use token → connects via `v1alpha` endpoint `BidiGenerateContentConstrained`. Token has `uses=1`, `newSessionExpireTime=1min`, `expireTime=30min`.
- **API key fallback** (dev only): If token-server is unavailable, falls back to `VITE_GEMINI_API_KEY` via `v1beta` endpoint. **Never use API keys in production browser deployments.**

### VAD configuration (Gemini Live)
- Server-side VAD via `realtimeInputConfig.automaticActivityDetection` in setup message.
- `GEMINI_CONFIG.vad` in [src/config/api.js](src/config/api.js): `silenceDurationMs=1000` (higher than default ~600ms to avoid mid-sentence cutoff), `startOfSpeechSensitivity=HIGH`, `endOfSpeechSensitivity=LOW`.

### Other data flow
- `REST_WS_CONFIG` in [src/config/api.js](src/config/api.js) controls WS Live settings (wsUrl, voice, audio sample rates, latency thresholds, connection timeout).
- `SessionLogger` ([src/services/SessionLogger.js](src/services/SessionLogger.js)) records sessions (including `function_call` and `function_response` events) to `data/session-*.json` for debugging. On each save it also rebuilds `data/sessions-index.json`.
- **History view**: `HistoryView` ([src/views/HistoryView.jsx](src/views/HistoryView.jsx)) reads session files via `GET /api/sessions` (Vite plugin dev middleware) or fallback to `/data/sessions-index.json` (prod static). `SessionHistoryService` ([src/services/SessionHistoryService.js](src/services/SessionHistoryService.js)) handles fetch + `computeStats()`. Sub-components in `src/components/history/`: `StatsOverview`, `SessionTable`, `SessionDetail`. History view uses local state only — does NOT use `CallContext`.
- Mock mode replays scripted scenarios from [src/data/scenarios.js](src/data/scenarios.js) without backend traffic. Tickets and analysis come from scenario `action` fields.
- Audio playback in [src/hooks/useAudioPlayer.js](src/hooks/useAudioPlayer.js); PCM playback uses AudioWorklet (`pcmPlayback.worklet.js`) at 24kHz, matching Gemini output format. Both live modes capture mic directly in their service classes via `getUserMedia`.

## Backend integration points
- WS Live backend: `ws://192.168.2.100:8003/ws/live` — uvicorn Python server, implements Gemini Live wire protocol as a proxy.
- Gemini Live authentication: `token-server/` (port 3005) → ephemeral token. Fallback: `VITE_GEMINI_API_KEY` (frontend env var, dev only).
- `ApiClient.js` is now minimal — only `healthCheck()`. The old HTTP ASR→LLM→TTS pipeline has been removed.

## Dev workflows
- Frontend dev: `docker compose -f docker-compose.dev.yml up` (hot reload, port 3100). **Use `--force-recreate`** when changing `.env` — `restart` alone does not reload `env_file`.
- Frontend prod: `docker compose up -d --build` (static build, port 3100). VITE_* vars are baked in at build time.
- WS proxy (dev): Vite proxies `/ws` → `ws://192.168.2.100:8003`. Set `VITE_REST_WS_URL=/ws/live` (relative path) to avoid HTTPS mixed-content errors; `RestWebSocketService` auto-expands to `wss://` on HTTPS.
- Token server (dev): Vite proxies `/api/gemini-token` → `http://localhost:3005`. In Docker, uses `TOKEN_SERVER_HOST` env var.

## Project-specific conventions
- UI text and comments are Traditional Chinese; icons come from `lucide-react`.
- Scenario content and prompts must stay in sync: update [src/data/scenarios.js](src/data/scenarios.js) and [src/config/api.js](src/config/api.js) together.
- Gemini config (model, voice, audio format, latency thresholds) lives in `GEMINI_CONFIG` in [src/config/api.js](src/config/api.js). Latency threshold key for Gemini is `e2e` (applied to `ttfc` comparisons in `GeminiLivePanel` / `LatencyMonitor`).
- Gemini tool declarations (function schema with enums, examples) live in `GEMINI_TOOL_DECLARATIONS` in [src/config/api.js](src/config/api.js) — update alongside `GEMINI_SYSTEM_PROMPTS` when changing tools. `analyze_intent` must have `behavior: 'NON_BLOCKING'`.
- Three-mode compatibility rule: never break Mock or WS Live when adding Gemini Live features; use `voiceMode` guards.
- WS Live welcome message: frontend sends `clientContent` with `WELCOME_MESSAGES` trigger after `setupComplete`. Backend processes it via LLM → TTS pipeline.

## Gemini Live API reference
- Official docs index: `https://ai.google.dev/gemini-api/docs/llms.txt`
- Key pages: [Live API Overview](https://ai.google.dev/gemini-api/docs/live.md.txt), [Capabilities](https://ai.google.dev/gemini-api/docs/live-guide.md.txt), [Tool Use](https://ai.google.dev/gemini-api/docs/live-tools.md.txt), [Session Management](https://ai.google.dev/gemini-api/docs/live-session.md.txt), [Ephemeral Tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens.md.txt), [WebSocket API Reference](https://ai.google.dev/api/live.md.txt).
- Use `sendRealtimeInput` for all real-time user input (audio, video, text). Use `sendClientContent` only for conversation history injection.
- Async function calling: `behavior: 'NON_BLOCKING'` on declaration + `scheduling: 'SILENT'|'WHEN_IDLE'|'INTERRUPT'` in toolResponse.
- Connection lifetime ~10 min; enable `sessionResumption` + `contextWindowCompression` for longer calls.
