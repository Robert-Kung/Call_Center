# Copilot Instructions

## Project overview
- React + Vite frontend (port 3100) in [src/App.jsx](src/App.jsx) with four views (demo/consumer/agent/system).
- Three voice modes: **Mock** (scripted demo), **REST Live** (ASR→LLM→TTS via backend), **Gemini Live** (end-to-end WebSocket, direct to Google).
- Optional Node/Express backend in [my-voice-agent/src/app.js](my-voice-agent/src/app.js) (port 3000) — deployed on a separate machine; not required for Mock or Gemini Live modes.
- Primary REST flow: Audio blob → ASR → LLM → TTS → base64 audio for playback.
- Primary Gemini flow: 16kHz PCM stream → Gemini WebSocket → 24kHz PCM audio + transcript.

## Architecture & data flow
- `CallContext` is the state hub for call lifecycle, mode (`voiceMode`), logs, latency, transcripts, tickets, and analysis. Start at [src/context/CallContext.jsx](src/context/CallContext.jsx).
- `voiceMode` values: `'mock'` | `'rest-live'` | `'gemini-live'`. All branching logic should use this.
- `ModeSwitch` component ([src/components/ModeSwitch.jsx](src/components/ModeSwitch.jsx)) handles UI for switching modes; currently rendered in `ConsumerView` — being migrated to App.jsx header (Phase 1).
- REST Live: `VoiceService` → `ApiClient` → `/webhook/talk` (init uses `text_input: START_CALL_TRIGGER`; turns use `FormData` with `file`, `session_id`, `voice_id`). See [src/services/VoiceService.js](src/services/VoiceService.js) and [src/services/ApiClient.js](src/services/ApiClient.js).
- Gemini Live: `VoiceService` → `GeminiLiveService` ([src/services/GeminiLiveService.js](src/services/GeminiLiveService.js)) opens a `BidiGenerateContent` WebSocket, streams mic audio, receives PCM audio + transcript via callbacks.
- `SessionLogger` ([src/services/SessionLogger.js](src/services/SessionLogger.js)) records Gemini Live sessions to `data/session-*.json` for debugging.
- Mock mode replays scripted scenarios from [src/data/scenarios.js](src/data/scenarios.js) without backend traffic. Tickets and analysis come from scenario `action` fields.
- Audio capture/playback lives in [src/hooks/useAudioRecorder.js](src/hooks/useAudioRecorder.js) and [src/hooks/useAudioPlayer.js](src/hooks/useAudioPlayer.js); keep 16kHz mono settings aligned with backend expectations.

## Backend integration points
- External ASR/LLM/TTS endpoints come from `ASR_API_URL`, `LLM_API_URL`, `TTS_API_URL` in the backend services under [my-voice-agent/src/services](my-voice-agent/src/services).
- Backend stores session history in an in-memory `Map`; no persistence.
- Gemini Live uses `VITE_GEMINI_API_KEY` (frontend env var) and connects directly from browser — no backend needed.

## Dev workflows
- Frontend dev: `docker compose -f docker-compose.dev.yml up` (hot reload, port 3100).
- Frontend prod: `docker compose up -d --build` (static build, port 3100). VITE_* vars are baked in at build time.
- Backend: `npm run dev` in [my-voice-agent/](my-voice-agent/) — runs on separate machine at `192.168.2.100:3000`.

## Project-specific conventions
- UI text and comments are Traditional Chinese; icons come from `lucide-react`.
- Scenario content and prompts must stay in sync: update [src/data/scenarios.js](src/data/scenarios.js) and [src/config/api.js](src/config/api.js) together.
- API responses are expected to include `latency` metrics for dashboard visualization.
- Gemini config (model, voice, audio format, latency thresholds) lives in `GEMINI_CONFIG` in [src/config/api.js](src/config/api.js).
- Three-mode compatibility rule: never break Mock or REST Live when adding Gemini Live features; use `voiceMode` guards.
