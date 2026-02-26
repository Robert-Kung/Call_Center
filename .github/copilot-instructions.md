# Copilot Instructions

## Project overview
- React + Vite frontend (port 3100) in [src/App.jsx](src/App.jsx) with four views (demo/consumer/agent/system).
- Optional Node/Express backend in [my-voice-agent/src/app.js](my-voice-agent/src/app.js) (port 3000) that exposes a single `POST /webhook/talk` endpoint.
- Primary flow: Audio blob → ASR → LLM → TTS → base64 audio for playback.

## Architecture & data flow
- `CallContext` is the state hub for call lifecycle, mode, logs, latency, and transcripts. Start at [src/context/CallContext.jsx](src/context/CallContext.jsx).
- Live mode calls `VoiceService` → `ApiClient` → `/webhook/talk` (init uses `text_input: START_CALL_TRIGGER`; turns use `FormData` with `file`, `session_id`, `voice_id`). See [src/services/VoiceService.js](src/services/VoiceService.js) and [src/services/ApiClient.js](src/services/ApiClient.js).
- Mock mode replays scripted scenarios from [src/data/scenarios.js](src/data/scenarios.js) without backend traffic.
- Audio capture/playback lives in [src/hooks/useAudioRecorder.js](src/hooks/useAudioRecorder.js) and [src/hooks/useAudioPlayer.js](src/hooks/useAudioPlayer.js); keep 16kHz mono settings aligned with backend expectations.

## Backend integration points
- External ASR/LLM/TTS endpoints come from `ASR_API_URL`, `LLM_API_URL`, `TTS_API_URL` in the backend services under [my-voice-agent/src/services](my-voice-agent/src/services).
- Backend stores session history in an in-memory `Map`; no persistence.

## Dev workflows
- Frontend: `npm run dev` (Vite on 3100) with proxy `/api` → `http://192.168.2.100:3000` in [vite.config.js](vite.config.js).
- Backend: `npm run dev` in [my-voice-agent/package.json](my-voice-agent/package.json).
- Docker starts only the frontend (see [Dockerfile](Dockerfile) and [docker-compose.yml](docker-compose.yml)).

## Project-specific conventions
- UI text and comments are Traditional Chinese; icons come from `lucide-react`.
- Scenario content and prompts must stay in sync: update [src/data/scenarios.js](src/data/scenarios.js) and [src/config/api.js](src/config/api.js) together.
- API responses are expected to include `latency` metrics for dashboard visualization.
