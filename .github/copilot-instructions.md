# Copilot Instructions

## Project overview
- React + Vite frontend (port 3100) in [src/App.jsx](src/App.jsx) with four views (demo/consumer/agent/system).
- Three voice modes: **Mock** (scripted demo), **WS Live** (Gemini Live wire protocol via backend proxy), **Gemini Live** (end-to-end WebSocket, direct to Google).
- Backend proxy server at `192.168.2.100:8003` (uvicorn/Python) — handles WS Live mode via `/ws/live`. Not needed for Mock or Gemini Live.
- Primary WS Live flow: 16kHz PCM stream → `RestWebSocketService` → backend proxy `/ws/live` (Gemini Live wire protocol) → 24kHz PCM audio + transcript.
- Primary Gemini Live flow: 16kHz PCM stream → `GeminiLiveService` → Google Gemini WebSocket direct → 24kHz PCM audio + transcript.

## Architecture & data flow
- `CallContext` is the state hub for call lifecycle, mode (`voiceMode`), logs, latency, transcripts, tickets, and analysis. Start at [src/context/CallContext.jsx](src/context/CallContext.jsx).
- `voiceMode` values: `'mock'` | `'rest-live'` | `'gemini-live'`. All branching logic should use this.
- `ModeSwitch` component ([src/components/ModeSwitch.jsx](src/components/ModeSwitch.jsx)) handles UI for switching modes; rendered in App.jsx header as `HeaderModeSwitch` (compact mode, disabled during calls). The `'rest-live'` mode label displays as **WS Live**.
- WS Live: `VoiceService` → `RestWebSocketService` ([src/services/RestWebSocketService.js](src/services/RestWebSocketService.js)) → WebSocket to backend proxy. Uses the **Gemini Live wire protocol**: `setup`→`setupComplete` handshake, `realtimeInput.audio` for mic streaming, `serverContent.*` for responses, `toolCall` for function calling.
- Gemini Live: `VoiceService` → `GeminiLiveService` ([src/services/GeminiLiveService.js](src/services/GeminiLiveService.js)) opens a `BidiGenerateContent` WebSocket, streams mic audio, receives PCM audio + transcript via callbacks. Also handles `toolCall` messages for function calling.
- Both WS Live and Gemini Live use continuous streaming (server-side VAD — no PTT). `isStreaming` in `CallContext` is shared by both modes. `useAudioRecorder` is removed.
- Function Calling: `GEMINI_TOOL_DECLARATIONS` in [src/config/api.js](src/config/api.js) defines two tools — `analyze_intent` (NON_BLOCKING, WHEN_IDLE — UI side-effect only, no toolResponse sent) and `create_ticket` (INTERRUPT — sends toolResponse). `CallContext.onToolCall` processes results and updates `currentAnalysis` / `tickets` state.
- `REST_WS_CONFIG` in [src/config/api.js](src/config/api.js) controls WS Live settings (wsUrl, voice, audio sample rates, latency thresholds, connection timeout).
- `SessionLogger` ([src/services/SessionLogger.js](src/services/SessionLogger.js)) records sessions (including `function_call` and `function_response` events) to `data/session-*.json` for debugging.
- Mock mode replays scripted scenarios from [src/data/scenarios.js](src/data/scenarios.js) without backend traffic. Tickets and analysis come from scenario `action` fields.
- Audio playback in [src/hooks/useAudioPlayer.js](src/hooks/useAudioPlayer.js); keep 24kHz output settings aligned. Both live modes capture mic directly in their service classes via `getUserMedia`.

## Backend integration points
- WS Live backend: `ws://192.168.2.100:8003/ws/live` — uvicorn Python server, implements Gemini Live wire protocol as a proxy.
- Gemini Live uses `VITE_GEMINI_API_KEY` (frontend env var) and connects directly from browser — no backend needed.
- `ApiClient.js` is now minimal — only `healthCheck()`. The old HTTP ASR→LLM→TTS pipeline has been removed.

## Dev workflows
- Frontend dev: `docker compose -f docker-compose.dev.yml up` (hot reload, port 3100). **Use `--force-recreate`** when changing `.env` — `restart` alone does not reload `env_file`.
- Frontend prod: `docker compose up -d --build` (static build, port 3100). VITE_* vars are baked in at build time.
- WS proxy (dev): Vite proxies `/ws` → `ws://192.168.2.100:8003`. Set `VITE_REST_WS_URL=/ws/live` (relative path) to avoid HTTPS mixed-content errors; `RestWebSocketService` auto-expands to `wss://` on HTTPS.

## Project-specific conventions
- UI text and comments are Traditional Chinese; icons come from `lucide-react`.
- Scenario content and prompts must stay in sync: update [src/data/scenarios.js](src/data/scenarios.js) and [src/config/api.js](src/config/api.js) together.
- Gemini config (model, voice, audio format, latency thresholds) lives in `GEMINI_CONFIG` in [src/config/api.js](src/config/api.js).
- Gemini tool declarations (function schema with enums, examples) live in `GEMINI_TOOL_DECLARATIONS` in [src/config/api.js](src/config/api.js) — update alongside `SCENARIO_PROMPTS` when changing tools.
- Three-mode compatibility rule: never break Mock or WS Live when adding Gemini Live features; use `voiceMode` guards.
- WS Live welcome message: backend auto-pushes after `setupComplete` (TODO: trigger mechanism TBD with backend team).
