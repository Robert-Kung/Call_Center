#!/usr/bin/env python3
"""
gemini_live_proxy.py  —  Gemini Live API 相容 WebSocket 代理服務

同事可用官方 google-genai SDK 或任何相容 Gemini Live API 協議的客戶端連線，
請求會被轉發到本地的 ASR / LLM / TTS 服務。

端點 (短):   ws://HOST:8003/ws/live
端點 (標準): ws://HOST:8003/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent

協議 (Gemini Live WebSocket API):
  Client → Server
    {"setup": {"model": "...", "generation_config": {"response_modalities": ["AUDIO"],
                "system_instruction": {"parts": [{"text": "..."}]}}}}
    {"realtimeInput": {"mediaChunks": [{"data": "<base64 PCM16 16kHz>", "mimeType": "audio/pcm;rate=16000"}]}}
    {"clientContent": {"turns": [{"role": "user", "parts": [{"text": "..."}]}], "turnComplete": true}}

  Server → Client
    {"setupComplete": {}}
    {"serverContent": {"modelTurn": {"parts": [{"inlineData": {"data": "<base64 PCM16 24kHz>",
                                                                "mimeType": "audio/pcm;rate=24000"}},
                                               {"text": "..."}]}}}
    {"serverContent": {"turnComplete": true}}
    {"serverContent": {"interrupted": true}}
    {"serverContent": {"inputTranscription": {"text": "...", "finished": true}}}

SDK 使用方式 (Python google-genai):
    import google.generativeai as genai
    # 指向此服務
    client = genai.Client(
        api_key="local-key",
        http_options={"base_url": "http://localhost:8003"}
    )
"""

import asyncio
import base64
import io
import json
import os
import re
import time
import traceback

import aiohttp
import edge_tts
import numpy as np
import opencc
import soundfile as sf
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from loguru import logger

# ─────────────────────────────────────────────────────────────
# 讀取 .env（同目錄）
# ─────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ─────────────────────────────────────────────────────────────
# 設定（與 websocket_bot.py 共用相同環境變數）
# ─────────────────────────────────────────────────────────────
LLM_URL    = os.getenv("LLM_URL",    "http://localhost:1234/v1/chat/completions")
LLM_MODEL  = os.getenv("LLM_MODEL",  "qwen/qwen3.5-9b")
LLM_KEY    = os.getenv("LLM_KEY",    "local-key")

WHISPER_URL   = os.getenv("WHISPER_URL",   "http://localhost:9000/asr")
COSYVOICE_URL = os.getenv("COSYVOICE_URL", "http://localhost:50000/tts")

# OpenCC：繁簡轉換（本地，不呼叫 API）
_cc_s2t = opencc.OpenCC('s2t')   # 簡體 → 繁體（ASR 輸出後）
_cc_t2s = opencc.OpenCC('t2s')   # 繁體 → 簡體（送 TTS 前）
TTS_SPK_ID    = os.getenv("TTS_SPK_ID",    "Verna")
TTS_SPEED     = os.getenv("TTS_SPEED",     "1")
TTS_ENGINE    = os.getenv("TTS_ENGINE",    "cosyvoice")  # cosyvoice|fishaudio|google|edgetts

FISHAUDIO_URL            = os.getenv("FISHAUDIO_URL",            "http://127.0.0.1:8080/v1/tts")
FISHAUDIO_REFERENCE_ID   = os.getenv("FISHAUDIO_REFERENCE_ID",   None)
FISHAUDIO_CHUNK_LENGTH   = int(os.getenv("FISHAUDIO_CHUNK_LENGTH",   "100"))
FISHAUDIO_MAX_NEW_TOKENS = int(os.getenv("FISHAUDIO_MAX_NEW_TOKENS", "256"))
FISHAUDIO_MEMORY_CACHE   = os.getenv("FISHAUDIO_MEMORY_CACHE",   "on")

GOOGLE_API_KEY         = os.getenv("GOOGLE_API_KEY",         "")
GOOGLE_TTS_VOICE       = os.getenv("GOOGLE_TTS_VOICE",       "cmn-TW-Standard-A")  # https://cloud.google.com/text-to-speech/docs/voices
GOOGLE_TTS_LANG        = os.getenv("GOOGLE_TTS_LANG",        "cmn-TW")
GOOGLE_TTS_SAMPLE_RATE = int(os.getenv("GOOGLE_TTS_SAMPLE_RATE", "24000"))

# Edge TTS 參數
EDGETTS_VOICE  = os.getenv("EDGETTS_VOICE",  "zh-TW-HsiaoChenNeural")
EDGETTS_RATE   = os.getenv("EDGETTS_RATE",   "+0%")
EDGETTS_VOLUME = os.getenv("EDGETTS_VOLUME", "+0%")
EDGETTS_PITCH  = os.getenv("EDGETTS_PITCH",  "+0Hz")

# Gemini Live 輸出取樣率（固定 24kHz，符合 Gemini Live API 規範）
OUTPUT_SAMPLE_RATE = 24000
INPUT_SAMPLE_RATE  = 16000

SENTENCE_END = re.compile(r'[,，.!?。！？…；;：:]+\s*')

# LLM 輸出清洗：去除模型洩漏的 control token 與 JSON wrapper
_CTRL_TOKEN  = re.compile(r'<\|[^|>]*\|>[^<]*')   # <|channel|>... <|xxx|>
_DIRECTIVE   = re.compile(r'\b(?:commentary|channel|response|assistant|system)\s*(?:to|from)?\s*=\s*\S*\s*:?\s*', re.IGNORECASE)  # commentary to=xxx:
_JSON_WRAP   = re.compile(r'^\s*["\{\[]|["\}\]]\s*$')  # 首尾的 " { [ ] } "


def _sanitize_llm_output(text: str) -> str:
    """移除 LLM 洩漏的 control token 及 JSON wrapper，只保留純文字。"""
    # 移除所有 <|token|> 及其後跟隨的 directive 文字（到下一個 <| 或結尾）
    cleaned = _CTRL_TOKEN.sub('', text)
    # 移除 streaming 時 <|channel|> 被拆開後殘留的 commentary to=xxx: 等 directive
    cleaned = _DIRECTIVE.sub('', cleaned)
    # 若整段被 JSON 引號或大括號包住，嘗試只取字串值
    # 例如 {"response": "..."} 或 "..."
    m = re.match(r'^\s*\{\s*"[^"]+"\s*:\s*"(.+)"\s*\}\s*$', cleaned, re.DOTALL)
    if m:
        cleaned = m.group(1)
    else:
        # 移除首尾多餘的 " { } [ ]
        cleaned = re.sub(r'^[\s"\{\[]+|[\s"\}\]]+$', '', cleaned)
    return cleaned.strip()

PORT = int(os.getenv("GEMINI_PROXY_PORT", "8003"))

# ─────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────
app = FastAPI(title="Gemini Live API Proxy", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 58)
    logger.info("  Gemini Live API 相容代理服務")
    logger.info(f"  標準端點: ws://0.0.0.0:{PORT}/ws/google.ai.generativelanguage"
                ".v1beta.GenerativeService.BidiGenerateContent")
    logger.info(f"  短端點  : ws://0.0.0.0:{PORT}/ws/live")
    if TTS_ENGINE == "fishaudio":
        logger.info(f"  FishAudio  : {FISHAUDIO_URL}  ref={FISHAUDIO_REFERENCE_ID}")
    elif TTS_ENGINE == "google":
        logger.info(f"  Google TTS : voice={GOOGLE_TTS_VOICE}  lang={GOOGLE_TTS_LANG}  {GOOGLE_TTS_SAMPLE_RATE}Hz")
    elif TTS_ENGINE == "edgetts":
        logger.info(f"  Edge TTS   : voice={EDGETTS_VOICE}  rate={EDGETTS_RATE}")
    else:
        logger.info(f"  CosyVoice  : {COSYVOICE_URL}")
    logger.info(f"  Whisper : {WHISPER_URL}")
    logger.info(f"  LLM     : {LLM_URL}  [{LLM_MODEL}]")
    logger.info("=" * 58)


@app.get("/", response_class=JSONResponse)
async def info():
    return {
        "service": "Gemini Live API Proxy",
        "version": "1.0.0",
        "endpoints": {
            "standard": "/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
            "short": "/ws/live",
        },
        "internal": {
            "asr": WHISPER_URL,
            "llm": LLM_URL,
            "tts_engine": TTS_ENGINE,
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────
# 音訊工具
# ─────────────────────────────────────────────────────────────

def audio_to_pcm16_24k(raw: bytes, mime: str) -> bytes:
    """
    將任意音訊（WAV / MP3 / raw PCM）轉換為 24kHz 單聲道 int16 PCM。
    不含 WAV 標頭，直接回傳原始 PCM bytes。
    """
    try:
        # 嘗試讀取音訊（soundfile 支援 WAV、FLAC、OGG 等）
        buf = io.BytesIO(raw)
        audio, src_rate = sf.read(buf, dtype="float32", always_2d=False)
    except Exception:
        # 若 soundfile 無法解析（如 MP3），嘗試透過 ffmpeg 管道轉換
        try:
            import subprocess
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-i", "pipe:0",
                 "-f", "f32le", "-ar", str(OUTPUT_SAMPLE_RATE), "-ac", "1", "pipe:1"],
                input=raw, capture_output=True, timeout=15
            )
            if proc.returncode != 0:
                raise RuntimeError(f"ffmpeg 失敗: {proc.stderr.decode()}")
            pcm_f32 = np.frombuffer(proc.stdout, dtype=np.float32)
            pcm_i16 = np.clip(pcm_f32 * 32767, -32768, 32767).astype(np.int16)
            return pcm_i16.tobytes()
        except FileNotFoundError:
            raise RuntimeError("無法解析音訊格式，請安裝 ffmpeg 或使用 WAV TTS 引擎")

    # 多聲道 → 單聲道
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    # 重新取樣至 24kHz
    if src_rate != OUTPUT_SAMPLE_RATE:
        try:
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(OUTPUT_SAMPLE_RATE, src_rate)
            up, down = OUTPUT_SAMPLE_RATE // g, src_rate // g
            audio = resample_poly(audio, up, down).astype(np.float32)
        except ImportError:
            # 若無 scipy，用 numpy 線性插值（品質略差）
            old_len = len(audio)
            new_len = int(round(old_len * OUTPUT_SAMPLE_RATE / src_rate))
            audio = np.interp(
                np.linspace(0, old_len - 1, new_len),
                np.arange(old_len),
                audio
            ).astype(np.float32)

    pcm_i16 = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    return pcm_i16.tobytes()


# ─────────────────────────────────────────────────────────────
# ASR（Whisper + OpenCC 簡→繁）
# ─────────────────────────────────────────────────────────────

async def call_asr(wav_bytes: bytes) -> str:
    async with aiohttp.ClientSession() as session:
        form = aiohttp.FormData()
        form.add_field("audio_file", wav_bytes, filename="speech.wav",
                       content_type="audio/wav")
        params = {"encode": "true", "task": "transcribe",
                  "vad_filter": "false", "word_timestamps": "false", "output": "txt"}
        async with session.post(WHISPER_URL, data=form, params=params,
                                headers={"accept": "application/json"},
                                timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Whisper 錯誤 {resp.status}: {await resp.text()}")
            ct = resp.headers.get("Content-Type", "")
            if "json" in ct:
                data = await resp.json()
                raw = (data.get("text") or data.get("data") or "").strip()
            else:
                raw = (await resp.text()).strip()

        if not raw:
            return ""

        # OpenCC s2t（簡→繁）
        return _cc_s2t.convert(raw).strip()


# ─────────────────────────────────────────────────────────────
# TTS（多引擎，回傳原始音訊 bytes + mime）
# ─────────────────────────────────────────────────────────────

async def _tts_cosyvoice(session, text: str) -> tuple[bytes, str]:
    simplified = _cc_t2s.convert(text).strip() or text
    async with session.post(COSYVOICE_URL,
                            json={"text": simplified + "<|endofprompt|>",
                                  "spk_id": TTS_SPK_ID, "speed": TTS_SPEED},
                            timeout=aiohttp.ClientTimeout(total=30)) as r:
        if r.status != 200:
            raise RuntimeError(f"CosyVoice {r.status}: {await r.text()}")
        return await r.read(), "audio/wav"


async def _tts_fishaudio(session, text: str) -> tuple[bytes, str]:
    simplified = _cc_t2s.convert(text).strip() or text
    payload = {
        "text": simplified, "chunk_length": FISHAUDIO_CHUNK_LENGTH,
        "format": "wav", "references": [],
        "reference_id": FISHAUDIO_REFERENCE_ID, "seed": None,
        "use_memory_cache": FISHAUDIO_MEMORY_CACHE, "normalize": True,
        "streaming": False, "max_new_tokens": FISHAUDIO_MAX_NEW_TOKENS,
        "top_p": 0.7, "repetition_penalty": 1.1, "temperature": 0.7,
    }
    async with session.post(FISHAUDIO_URL, json=payload,
                            timeout=aiohttp.ClientTimeout(total=30)) as r:
        if r.status != 200:
            raise RuntimeError(f"FishAudio {r.status}: {await r.text()}")
        return await r.read(), "audio/wav"


async def _tts_google(session, text: str) -> tuple[bytes, str]:
    import base64 as _b64
    simplified = _cc_t2s.convert(text).strip() or text
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_API_KEY}"
    payload = {
        "input": {"text": simplified},
        "voice": {"languageCode": GOOGLE_TTS_LANG, "name": GOOGLE_TTS_VOICE},
        "audioConfig": {"audioEncoding": "MP3", "sampleRateHertz": GOOGLE_TTS_SAMPLE_RATE},
    }
    async with session.post(url, json=payload,
                            timeout=aiohttp.ClientTimeout(total=30)) as r:
        if r.status != 200:
            raise RuntimeError(f"Google TTS 錯誤 {r.status}: {await r.text()}")
        data = await r.json()
    audio = _b64.b64decode(data["audioContent"])
    return audio, "audio/mpeg"


async def _tts_edgetts(text: str) -> tuple[bytes, str]:
    communicate = edge_tts.Communicate(
        text=text,
        voice=EDGETTS_VOICE,
        rate=EDGETTS_RATE,
        volume=EDGETTS_VOLUME,
        pitch=EDGETTS_PITCH,
    )
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    if buf.tell() == 0:
        raise RuntimeError("Edge TTS 未產生音訊資料")
    return buf.getvalue(), "audio/mpeg"


async def call_tts(text: str) -> tuple[bytes, str]:
    """回傳 (audio_bytes, mime_type)"""
    if TTS_ENGINE == "edgetts":
        return await _tts_edgetts(text)
    async with aiohttp.ClientSession() as session:
        if TTS_ENGINE == "fishaudio":
            return await _tts_fishaudio(session, text)
        elif TTS_ENGINE == "google":
            return await _tts_google(session, text)
        else:
            return await _tts_cosyvoice(session, text)


# ─────────────────────────────────────────────────────────────
# LLM 串流（SSE，逐句回呼）
# ─────────────────────────────────────────────────────────────

async def stream_llm_sentences(messages: list, on_sentence, on_done):
    full_text = ""
    buf = ""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            LLM_URL,
            json={"model": LLM_MODEL, "messages": messages, "stream": True},
            headers={"Accept": "text/event-stream",
                     "Authorization": f"Bearer {LLM_KEY}"},
            timeout=aiohttp.ClientTimeout(total=120, sock_read=120),
        ) as resp:
            if resp.status != 200:
                raise RuntimeError(f"LLM 錯誤 {resp.status}: {await resp.text()}")
            pending = ""
            async for raw_chunk in resp.content:
                pending += raw_chunk.decode("utf-8", errors="replace")
                while "\n" in pending:
                    line, pending = pending.split("\n", 1)
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        obj = json.loads(payload)
                        token = (obj.get("choices", [{}])[0]
                                    .get("delta", {}).get("content") or "")
                    except Exception:
                        continue
                    if not token:
                        continue
                    token = _sanitize_llm_output(token)
                    if not token:
                        continue
                    buf += token
                    full_text += token
                    pos = 0
                    while True:
                        match = SENTENCE_END.search(buf, pos)
                        if not match:
                            break
                        segment = buf[:match.end()].strip()
                        if len(segment) >= 10:
                            buf = buf[match.end():]
                            segment = _sanitize_llm_output(segment)
                            if segment:
                                await on_sentence(segment, full_text)
                            break
                        else:
                            pos = match.end()
            if buf.strip():
                final = _sanitize_llm_output(buf.strip())
                if final:
                    await on_sentence(final, full_text)
    await on_done(full_text)


# ─────────────────────────────────────────────────────────────
# WebSocket 處理核心（共用邏輯）
# ─────────────────────────────────────────────────────────────

async def _handle_live_session(websocket: WebSocket):
    """
    Gemini Live API 相容 WebSocket 多輪對話處理。
    協議說明見模組頂部 docstring。
    """
    await websocket.accept()
    logger.info("Client connected")

    # ── VAD 參數 ────────────────────────────────────────────
    SPEECH_THRESHOLD      = float(os.getenv("VAD_SPEECH_THRESHOLD",  "0.030"))
    SILENCE_THRESHOLD     = float(os.getenv("VAD_SILENCE_THRESHOLD", "0.010"))
    SILENCE_CHUNKS_TO_END = int(os.getenv("VAD_SILENCE_CHUNKS",      "3"))
    MIN_SPEECH_DURATION   = float(os.getenv("VAD_MIN_SPEECH",        "0.5"))
    MAX_SPEECH_DURATION   = float(os.getenv("VAD_MAX_SPEECH",        "30.0"))

    # ── 狀態 ────────────────────────────────────────────────
    connected         = True
    speech_buffer     = bytearray()
    is_speaking       = False
    silence_count     = 0

    DEFAULT_SYSTEM = (
        "你是親切助手，請用自然口語簡潔回答。"
        "輸出僅保留逗號與句號，禁止換行與特殊符號，字數控制在80字內。"
    )
    conversation_history: list[dict] = []
    system_instruction = DEFAULT_SYSTEM  # 可被 setup 覆寫

    # ── 工具函式 ─────────────────────────────────────────────
    async def send(obj: dict):
        nonlocal connected
        if not connected:
            return
        try:
            await websocket.send_text(json.dumps(obj, ensure_ascii=False))
        except Exception:
            connected = False

    def get_messages():
        return [{"role": "system", "content": system_instruction}] + conversation_history

    async def process_turn(user_text: str, asr_ms: int = 0):
        """ASR 結果 → LLM → TTS → 以 Gemini Live 協議格式回傳"""
        if not user_text.strip():
            return

        logger.info(f"👤 user: {user_text}")

        # 回傳 inputTranscription（供客戶端顯示字幕）
        await send({
            "serverContent": {
                "inputTranscription": {"text": user_text, "finished": True}
            }
        })

        conversation_history.append({"role": "user", "content": user_text})
        accumulated_text = ""
        llm_first_ms: int = 0
        tts_total_ms: int = 0
        llm_start = time.time()
        first_sentence = True

        async def on_sentence(sentence: str, acc: str):
            nonlocal accumulated_text, llm_first_ms, tts_total_ms, first_sentence
            if not connected:
                return
            accumulated_text = acc

            if first_sentence:
                llm_first_ms = int((time.time() - llm_start) * 1000)
                first_sentence = False

            # 傳遞文字 part（含目前累積文字）
            await send({
                "serverContent": {
                    "modelTurn": {
                        "parts": [{"text": acc}]
                    }
                }
            })

            # TTS → 重取樣到 24kHz PCM16 → base64
            try:
                t0 = time.time()
                raw_audio, mime = await call_tts(sentence)
                pcm_bytes = audio_to_pcm16_24k(raw_audio, mime)
                audio_b64 = base64.b64encode(pcm_bytes).decode()
                tts_sentence_ms = int((time.time() - t0) * 1000)
                tts_total_ms += tts_sentence_ms
                logger.info(f"🔊 TTS ({tts_sentence_ms}ms, {len(pcm_bytes)}B): '{sentence[:40]}'")
                await send({
                    "serverContent": {
                        "modelTurn": {
                            "parts": [{
                                "inlineData": {
                                    "data": audio_b64,
                                    "mimeType": f"audio/pcm;rate={OUTPUT_SAMPLE_RATE}"
                                }
                            }]
                        }
                    }
                })
            except Exception as e:
                logger.error(f"❌ TTS failed: {e}")

        async def on_done(full_text: str):
            conversation_history.append({"role": "assistant", "content": full_text})
            await send({
                "serverContent": {
                    "turnComplete": True,
                    "latency": {
                        "asr_ms": asr_ms,
                        "llm_first_ms": llm_first_ms,
                        "tts_total_ms": tts_total_ms,
                    },
                }
            })
            logger.info(
                f"✅ turn done  "
                f"ASR={asr_ms}ms  LLM首句={llm_first_ms}ms  TTS累計={tts_total_ms}ms"
            )

        await stream_llm_sentences(get_messages(), on_sentence, on_done)

    async def process_audio_buffer(speech_data: bytearray):
        """VAD 觸發後：PCM16 bytearray → ASR → process_turn"""
        if len(speech_data) % 2 != 0:
            speech_data = speech_data[:-1]
        audio_np = np.frombuffer(bytes(speech_data), dtype=np.int16).astype(np.float32) / 32768.0

        # 修剪尾部靜音
        TRIM_BLOCK = 512
        pad_samples = int(0.1 * INPUT_SAMPLE_RATE)
        trim_end = len(audio_np)
        for i in range(len(audio_np) - TRIM_BLOCK, TRIM_BLOCK, -TRIM_BLOCK):
            if float(np.sqrt(np.mean(audio_np[i:i + TRIM_BLOCK] ** 2))) >= SILENCE_THRESHOLD:
                trim_end = min(len(audio_np), i + TRIM_BLOCK + pad_samples)
                break
        audio_np = audio_np[:trim_end]

        rms = float(np.sqrt(np.mean(audio_np ** 2)))
        duration = len(audio_np) / INPUT_SAMPLE_RATE

        if rms < SILENCE_THRESHOLD:
            return

        buf = io.BytesIO()
        sf.write(buf, audio_np, INPUT_SAMPLE_RATE, format="WAV", subtype="PCM_16")
        wav_bytes = buf.getvalue()

        try:
            asr_t0 = time.time()
            user_text = await call_asr(wav_bytes)
            asr_ms = int((time.time() - asr_t0) * 1000)
            logger.info(f"📝 ASR ({asr_ms}ms): '{user_text}'")
            if user_text:
                await process_turn(user_text, asr_ms=asr_ms)
        except Exception as e:
            logger.error(f"❌ ASR/LLM error: {e}\n{traceback.format_exc()}")
            await send({"error": {"code": 500, "message": str(e)[:200]}})

    # ── 主收訊迴圈 ───────────────────────────────────────────
    setup_done = False
    try:
        while True:
            try:
                msg = await websocket.receive()
            except RuntimeError as e:
                logger.info(f"Client disconnected: {e}")
                connected = False
                break

            if msg.get("type") == "websocket.disconnect":
                logger.info("Client disconnected")
                connected = False
                break

            # 文字 JSON 訊息
            if "text" in msg and msg["text"]:
                try:
                    data = json.loads(msg["text"])
                except Exception:
                    continue

                # ── setup ───────────────────────────────────
                if "setup" in data:
                    cfg = data["setup"]
                    gen_cfg = cfg.get("generation_config", {})
                    sys_instr = (gen_cfg.get("system_instruction") or
                                 cfg.get("system_instruction") or {})
                    if isinstance(sys_instr, str):
                        system_instruction = sys_instr or DEFAULT_SYSTEM
                        sys_source = "client" if sys_instr else "DEFAULT"
                    elif isinstance(sys_instr, dict):
                        parts = sys_instr.get("parts", [])
                        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
                        joined = " ".join(texts).strip()
                        system_instruction = joined or DEFAULT_SYSTEM
                        sys_source = "client" if joined else "DEFAULT"
                    else:
                        sys_source = "DEFAULT"
                    model = cfg.get("model", "?")
                    logger.info(f"⚙️  setup: model={model}  sys[{sys_source}]='{system_instruction[:60]}'")
                    conversation_history.clear()
                    setup_done = True
                    await send({"setupComplete": {}})
                    continue

                # ── realtimeInput（串流音訊）────────────────
                if "realtimeInput" in data:
                    if not setup_done:
                        # 允許不送 setup 直接推音訊（相容性）
                        setup_done = True
                        await send({"setupComplete": {}})

                    for chunk in data["realtimeInput"].get("mediaChunks", []):
                        raw_b64 = chunk.get("data", "")
                        if not raw_b64:
                            continue
                        chunk_bytes = base64.b64decode(raw_b64)

                        # VAD
                        chunk_np = np.frombuffer(chunk_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                        chunk_rms = float(np.sqrt(np.mean(chunk_np ** 2))) if len(chunk_bytes) >= 2 else 0.0

                        if not is_speaking:
                            if chunk_rms >= SPEECH_THRESHOLD:
                                is_speaking = True
                                silence_count = 0
                                speech_buffer.clear()
                                speech_buffer.extend(chunk_bytes)
                                logger.info(f"🟢 語音開始 (RMS={chunk_rms:.4f})")
                        else:
                            speech_buffer.extend(chunk_bytes)
                            dur = len(speech_buffer) / (INPUT_SAMPLE_RATE * 2)
                            silence_count = silence_count + 1 if chunk_rms < SILENCE_THRESHOLD else 0
                            should_end = (
                                (silence_count >= SILENCE_CHUNKS_TO_END and dur >= MIN_SPEECH_DURATION)
                                or dur >= MAX_SPEECH_DURATION
                            )
                            if should_end:
                                is_speaking = False
                                silence_count = 0
                                speech_data = bytearray(speech_buffer)
                                speech_buffer.clear()
                                logger.info(f"🔴 語句結束 {dur:.2f}s")
                                await process_audio_buffer(speech_data)
                    continue

                # ── clientContent（文字輸入或多輪輸入）────────
                if "clientContent" in data:
                    if not setup_done:
                        setup_done = True
                        await send({"setupComplete": {}})

                    turns = data["clientContent"].get("turns", [])
                    turn_complete = data["clientContent"].get("turnComplete", True)

                    for turn in turns:
                        role = turn.get("role", "user")
                        parts = turn.get("parts", [])
                        text_parts = [p.get("text", "") for p in parts
                                      if isinstance(p, dict) and "text" in p]
                        combined = " ".join(t for t in text_parts if t).strip()

                        if role == "user" and combined and turn_complete:
                            try:
                                await process_turn(combined)
                            except Exception as e:
                                logger.error(f"❌ {e}\n{traceback.format_exc()}")
                                await send({"error": {"code": 500, "message": str(e)[:200]}})

    except WebSocketDisconnect:
        logger.info("Client disconnected (WebSocketDisconnect)")
    except Exception as e:
        logger.error(f"WS error: {e}\n{traceback.format_exc()}")
    finally:
        connected = False
        logger.info("Connection closed")


# ─────────────────────────────────────────────────────────────
# WebSocket 端點（標準路徑 + 短路徑）
# ─────────────────────────────────────────────────────────────

@app.websocket(
    "/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)
async def ws_standard(websocket: WebSocket):
    await _handle_live_session(websocket)


@app.websocket("/ws/live")
async def ws_short(websocket: WebSocket):
    await _handle_live_session(websocket)


# ─────────────────────────────────────────────────────────────
# 主程式
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 58)
    logger.info("  Gemini Live API 相容代理服務  (port {})".format(PORT))
    if TTS_ENGINE == "fishaudio":
        logger.info(f"  FishAudio  : {FISHAUDIO_URL}  ref={FISHAUDIO_REFERENCE_ID}")
    elif TTS_ENGINE == "google":
        logger.info(f"  Google TTS : voice={GOOGLE_TTS_VOICE}  lang={GOOGLE_TTS_LANG}  {GOOGLE_TTS_SAMPLE_RATE}Hz")
    elif TTS_ENGINE == "edgetts":
        logger.info(f"  Edge TTS   : voice={EDGETTS_VOICE}  rate={EDGETTS_RATE}")
    else:
        logger.info(f"  CosyVoice  : {COSYVOICE_URL}")
    logger.info(f"  Whisper    : {WHISPER_URL}")
    logger.info(f"  LLM        : {LLM_URL}  [{LLM_MODEL}]")
    logger.info("=" * 58)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
