import json
import math
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = int(os.environ.get("JARVIS_STT_PORT", "8768"))
MODEL_NAME = os.environ.get("JARVIS_STT_MODEL", "base")
LANGUAGE = os.environ.get("JARVIS_STT_LANGUAGE", "tr")
HOTWORDS = os.environ.get(
    "JARVIS_STT_HOTWORDS",
    "Jarvis, Cihan Bey, YouTube, Google, GitHub, ChatGPT, Opera GX, Chrome, Edge, Bluetooth, Wi-Fi, "
    "VAROVA, Fikir2App, LifeCV, sistem durumu, disk durumu, ağ durumu, pil durumu, sesi yükselt, sesi azalt"
)
LEXICON_FILE = os.environ.get("JARVIS_SPEECH_LEXICON_FILE", "")
FAST_BEAM = max(1, int(os.environ.get("JARVIS_STT_FAST_BEAM", "2")))
RETRY_BEAM = max(FAST_BEAM, int(os.environ.get("JARVIS_STT_RETRY_BEAM", "5")))
SHORT_SILENCE_SECONDS = float(os.environ.get("JARVIS_STT_SHORT_SILENCE", "0.38"))
MEDIUM_SILENCE_SECONDS = float(os.environ.get("JARVIS_STT_MEDIUM_SILENCE", "0.58"))
LONG_SILENCE_SECONDS = float(os.environ.get("JARVIS_STT_LONG_SILENCE", "0.85"))
HESITATION_BONUS_SECONDS = float(os.environ.get("JARVIS_STT_HESITATION_BONUS", "0.12"))
MAX_UTTERANCE_SECONDS = max(8.0, min(24.0, float(os.environ.get("JARVIS_STT_MAX_UTTERANCE", "20"))))
ALLOWED_ORIGIN = os.environ.get("JARVIS_WEB_ORIGIN", "https://jarvis-os-1iuv.onrender.com")

_model = None
_model_lock = threading.Lock()
_listen_lock = threading.Lock()
_model_state = {
    "status": "idle",
    "started_at": None,
    "ready_at": None,
    "load_seconds": None,
    "error": None,
}


def _lexicon_payload():
    if not LEXICON_FILE:
        return {"aliases": {}, "hotwords": []}
    try:
        with open(LEXICON_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        aliases = data.get("aliases", {}) if isinstance(data, dict) else {}
        hotwords = data.get("hotwords", []) if isinstance(data, dict) else []
        if not isinstance(aliases, dict):
            aliases = {}
        if not isinstance(hotwords, list):
            hotwords = []
        return {
            "aliases": aliases,
            "hotwords": [str(x).strip() for x in hotwords if str(x).strip()],
        }
    except Exception:
        return {"aliases": {}, "hotwords": []}


def dynamic_hotwords():
    data = _lexicon_payload()
    learned = list(data.get("hotwords", []))
    for target in data.get("aliases", {}).values():
        target = str(target).strip()
        if target:
            learned.append(target)
            learned.extend([x for x in target.split() if len(x) >= 3])
    merged = []
    seen = set()
    for item in [HOTWORDS] + learned:
        item = str(item).strip()
        key = item.casefold()
        if not item or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= 180:
            break
    return ", ".join(merged)


def lexicon_count():
    data = _lexicon_payload()
    return len(data.get("aliases", {}))


def log(msg):
    print("[JARVIS STT] " + str(msg), flush=True)


def load_deps():
    try:
        import numpy as np
        import sounddevice as sd
        from faster_whisper import WhisperModel
        return np, sd, WhisperModel
    except Exception as exc:
        raise RuntimeError("STT dependency missing: " + str(exc))


def get_model():
    global _model
    if _model is not None:
        return _model
    np, sd, WhisperModel = load_deps()
    with _model_lock:
        if _model is None:
            started = time.time()
            _model_state["status"] = "loading"
            _model_state["started_at"] = started
            _model_state["error"] = None
            log("loading model " + MODEL_NAME + " (cpu/int8)")
            try:
                _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
                _model_state["status"] = "ready"
                _model_state["ready_at"] = time.time()
                _model_state["load_seconds"] = round(_model_state["ready_at"] - started, 2)
                log("model ready in %.2fs" % _model_state["load_seconds"])
            except Exception as exc:
                _model_state["status"] = "error"
                _model_state["error"] = str(exc)[:300]
                raise
    return _model


def preload_model():
    try:
        get_model()
    except Exception as exc:
        log("model preload failed: " + str(exc))


def rms(np, block):
    if block.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(block), dtype=np.float64)))


def _resample_linear(np, audio, src_rate, dst_rate=16000):
    if src_rate == dst_rate or audio.size == 0:
        return audio.astype("float32", copy=False)
    duration = float(audio.size) / float(src_rate)
    dst_n = max(1, int(round(duration * dst_rate)))
    src_x = np.linspace(0.0, 1.0, num=audio.size, endpoint=False)
    dst_x = np.linspace(0.0, 1.0, num=dst_n, endpoint=False)
    return np.interp(dst_x, src_x, audio).astype("float32", copy=False)


def endpoint_profile_for(speech_blocks, block_seconds=0.10):
    speech_seconds = float(max(0, speech_blocks)) * float(block_seconds)
    if speech_seconds < 1.3:
        return "short", SHORT_SILENCE_SECONDS
    if speech_seconds < 4.0:
        return "medium", MEDIUM_SILENCE_SECONDS
    return "long", LONG_SILENCE_SECONDS


def required_silence_blocks_for(speech_blocks, block_seconds=0.10, pause_resumes=0):
    _profile, base_target = endpoint_profile_for(speech_blocks, block_seconds)
    bonus = min(0.30, max(0, int(pause_resumes)) * HESITATION_BONUS_SECONDS)
    target = min(1.20, base_target + bonus)
    return max(3, int(math.ceil(target / float(block_seconds))))


def should_retry_transcription(text, avg_logprob, max_no_speech):
    if not str(text or "").strip():
        return True
    if avg_logprob is not None and float(avg_logprob) < -0.85:
        return True
    if max_no_speech is not None and float(max_no_speech) > 0.65:
        return True
    return False


def record_utterance(max_seconds=None, wait_seconds=6.0):
    if max_seconds is None:
        max_seconds = MAX_UTTERANCE_SECONDS
    np, sd, _ = load_deps()
    device = sd.query_devices(kind="input")
    native_rate = int(round(float(device.get("default_samplerate", 16000) or 16000)))
    native_rate = max(8000, min(96000, native_rate))
    block_seconds = 0.10
    block_size = max(256, int(native_rate * block_seconds))
    calibration_blocks = 3
    noise = []
    frames = []
    started = False
    speech_blocks = 0
    silence_blocks = 0
    pause_resumes = 0
    min_speech_blocks = max(3, int(0.35 / block_seconds))
    max_blocks = int(max_seconds / block_seconds)
    wait_blocks = int(wait_seconds / block_seconds)

    with sd.InputStream(
        samplerate=native_rate,
        channels=1,
        dtype="float32",
        blocksize=block_size,
        latency="low",
    ) as stream:
        for _ in range(calibration_blocks):
            block, _overflowed = stream.read(block_size)
            noise.append(rms(np, block[:, 0]))

        base = max(0.0025, float(np.median(noise)) if noise else 0.0025)
        threshold = min(0.08, max(0.007, base * 3.0))
        log("listening device=%s rate=%s threshold=%.4f noise=%.4f" % (
            device.get("name", "default"), native_rate, threshold, base
        ))

        for i in range(max_blocks):
            block, _overflowed = stream.read(block_size)
            mono = block[:, 0].copy()
            level = rms(np, mono)

            if not started:
                if level >= threshold:
                    started = True
                    frames.append(mono)
                    speech_blocks += 1
                    silence_blocks = 0
                elif i >= wait_blocks:
                    break
                continue

            frames.append(mono)
            if level >= threshold * 0.70:
                if silence_blocks >= 2:
                    pause_resumes += 1
                speech_blocks += 1
                silence_blocks = 0
            else:
                silence_blocks += 1

            required_silence = required_silence_blocks_for(speech_blocks, block_seconds, pause_resumes)
            if speech_blocks >= min_speech_blocks and silence_blocks >= required_silence:
                break

    if not frames or speech_blocks < min_speech_blocks:
        return None, {
            "reason": "no_speech",
            "threshold": threshold,
            "noise": base,
            "device": device.get("name", "default"),
            "native_rate": native_rate,
        }

    audio_native = np.concatenate(frames).astype("float32", copy=False)
    tail = int(native_rate * 0.20)
    if audio_native.size > tail:
        audio_native = audio_native[: max(
            tail,
            audio_native.size - int(native_rate * max(0, silence_blocks * block_seconds - 0.20))
        )]

    audio = _resample_linear(np, audio_native, native_rate, 16000)
    endpoint_profile, endpoint_base = endpoint_profile_for(speech_blocks, block_seconds)
    endpoint_target = min(
        1.20,
        endpoint_base + min(0.30, max(0, int(pause_resumes)) * HESITATION_BONUS_SECONDS)
    )
    return audio, {
        "threshold": threshold,
        "noise": base,
        "seconds": round(float(audio.size) / 16000.0, 2),
        "device": device.get("name", "default"),
        "native_rate": native_rate,
        "transcribe_rate": 16000,
        "pause_resumes": pause_resumes,
        "endpoint_profile": endpoint_profile,
        "endpoint_silence_ms": int(round(endpoint_target * 1000)),
        "max_utterance_seconds": MAX_UTTERANCE_SECONDS,
    }


def _decode_audio(audio, beam_size, best_of):
    model = get_model()
    segments, info = model.transcribe(
        audio,
        language=LANGUAGE,
        beam_size=beam_size,
        best_of=best_of,
        temperature=0.0,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=350),
        condition_on_previous_text=False,
        word_timestamps=False,
        hotwords=dynamic_hotwords(),
    )
    segments = list(segments)
    text = " ".join(seg.text.strip() for seg in segments if seg.text and seg.text.strip()).strip()
    logprobs = [float(getattr(seg, "avg_logprob", 0.0)) for seg in segments]
    no_speech = [float(getattr(seg, "no_speech_prob", 0.0)) for seg in segments]
    avg_logprob = (sum(logprobs) / len(logprobs)) if logprobs else None
    max_no_speech = max(no_speech) if no_speech else None
    return text, info, avg_logprob, max_no_speech


def transcribe(audio):
    text, info, avg_logprob, max_no_speech = _decode_audio(
        audio, beam_size=FAST_BEAM, best_of=FAST_BEAM
    )
    decode_mode = "fast"
    if should_retry_transcription(text, avg_logprob, max_no_speech):
        retry_text, retry_info, retry_logprob, retry_no_speech = _decode_audio(
            audio, beam_size=RETRY_BEAM, best_of=RETRY_BEAM
        )
        if retry_text:
            text = retry_text
            info = retry_info
            avg_logprob = retry_logprob
            max_no_speech = retry_no_speech
        decode_mode = "retry"

    return text, {
        "language": getattr(info, "language", LANGUAGE),
        "language_probability": round(float(getattr(info, "language_probability", 0.0)), 3),
        "decode_mode": decode_mode,
        "fast_beam": FAST_BEAM,
        "retry_beam": RETRY_BEAM,
        "avg_logprob": None if avg_logprob is None else round(float(avg_logprob), 3),
        "max_no_speech": None if max_no_speech is None else round(float(max_no_speech), 3),
    }

class Handler(BaseHTTPRequestHandler):
    server_version = "JarvisLocalSTT/1.2"

    def _origin_ok(self):
        origin = self.headers.get("Origin", "")
        if not origin:
            return True
        return origin == ALLOWED_ORIGIN or origin.startswith("http://127.0.0.1") or origin.startswith("http://localhost")

    def _cors(self):
        origin = self.headers.get("Origin", "")
        self.send_header("Access-Control-Allow-Origin", origin if origin else ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def _json(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        if not self._origin_ok():
            return self._json(403, {"ok": False, "error": "forbidden"})
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if not self._origin_ok():
            return self._json(403, {"ok": False, "error": "forbidden"})
        if urlparse(self.path).path == "/health":
            ready = _model is not None
            mic = None
            native_rate = None
            try:
                _np, sd, _WhisperModel = load_deps()
                d = sd.query_devices(kind="input")
                mic = d.get("name", "default")
                native_rate = int(round(float(d.get("default_samplerate", 0) or 0))) or None
            except Exception:
                pass
            return self._json(200, {
                "ok": True,
                "model": MODEL_NAME,
                "language": LANGUAGE,
                "loaded": ready,
                "load_state": dict(_model_state),
                "engine": "faster-whisper",
                "cost": 0,
                "hotwords": dynamic_hotwords(),
                "lexicon_count": lexicon_count(),
                "adaptive_lexicon": True,
                "adaptive_decode": True,
                "adaptive_turn_boundary": True,
                "hesitation_tolerance": True,
                "fast_beam": FAST_BEAM,
                "retry_beam": RETRY_BEAM,
                "max_utterance_seconds": MAX_UTTERANCE_SECONDS,
                "endpointing": {
                    "short_silence_ms": int(round(SHORT_SILENCE_SECONDS * 1000)),
                    "medium_silence_ms": int(round(MEDIUM_SILENCE_SECONDS * 1000)),
                    "long_silence_ms": int(round(LONG_SILENCE_SECONDS * 1000)),
                    "hesitation_bonus_ms": int(round(HESITATION_BONUS_SECONDS * 1000)),
                    "max_silence_ms": 1200,
                },
                "microphone": mic,
                "native_rate": native_rate,
            })
        return self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self._origin_ok():
            return self._json(403, {"ok": False, "error": "forbidden"})
        if urlparse(self.path).path != "/listen":
            return self._json(404, {"ok": False, "error": "not found"})

        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except Exception:
            length = 0
        if length > 65536:
            return self._json(413, {"ok": False, "error": "too_large"})
        if length:
            self.rfile.read(length)

        if not _listen_lock.acquire(blocking=False):
            return self._json(409, {"ok": False, "error": "busy"})

        try:
            started = time.time()
            audio, meta = record_utterance()
            if audio is None:
                return self._json(408, {"ok": False, "error": "no_speech", "meta": meta})
            text, info = transcribe(audio)
            if not text:
                return self._json(422, {"ok": False, "error": "empty_transcript", "meta": meta})
            return self._json(200, {
                "ok": True,
                "text": text,
                "model": MODEL_NAME,
                "engine": "faster-whisper",
                "elapsed": round(time.time() - started, 2),
                "meta": {**meta, **info},
            })
        except Exception as exc:
            log("listen error: " + str(exc))
            return self._json(500, {"ok": False, "error": str(exc)[:300]})
        finally:
            _listen_lock.release()

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    try:
        load_deps()
    except Exception as exc:
        log(exc)
        sys.exit(2)
    threading.Thread(target=preload_model, name="jarvis-stt-preload", daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log("READY http://%s:%d model=%s language=%s (preloading)" % (HOST, PORT, MODEL_NAME, LANGUAGE))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
