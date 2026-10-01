import json
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
ALLOWED_ORIGIN = os.environ.get("JARVIS_WEB_ORIGIN", "https://jarvis-os-1iuv.onrender.com")

_model = None
_model_lock = threading.Lock()
_listen_lock = threading.Lock()


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
            log("loading model " + MODEL_NAME + " (cpu/int8)")
            _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
            log("model ready")
    return _model


def rms(np, block):
    if block.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(block), dtype=np.float64)))


def record_utterance(max_seconds=8.0, wait_seconds=4.0):
    np, sd, _ = load_deps()
    rate = 16000
    block_seconds = 0.10
    block_size = int(rate * block_seconds)
    calibration_blocks = 4
    noise = []
    frames = []
    started = False
    speech_blocks = 0
    silence_blocks = 0
    required_silence = max(5, int(0.75 / block_seconds))
    min_speech_blocks = max(3, int(0.35 / block_seconds))
    max_blocks = int(max_seconds / block_seconds)
    wait_blocks = int(wait_seconds / block_seconds)

    with sd.InputStream(
        samplerate=rate,
        channels=1,
        dtype="float32",
        blocksize=block_size,
        latency="low",
    ) as stream:
        for _ in range(calibration_blocks):
            block, _overflowed = stream.read(block_size)
            noise.append(rms(np, block[:, 0]))

        base = max(0.0025, float(np.median(noise)) if noise else 0.0025)
        threshold = min(0.08, max(0.008, base * 3.2))
        log("listening threshold=%.4f noise=%.4f" % (threshold, base))

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
            if level >= threshold * 0.72:
                speech_blocks += 1
                silence_blocks = 0
            else:
                silence_blocks += 1

            if speech_blocks >= min_speech_blocks and silence_blocks >= required_silence:
                break

    if not frames or speech_blocks < min_speech_blocks:
        return None, {"reason": "no_speech", "threshold": threshold, "noise": base}

    audio = np.concatenate(frames).astype("float32", copy=False)
    # trim final silence while leaving a short tail
    tail = int(rate * 0.20)
    if audio.size > tail:
        audio = audio[: max(tail, audio.size - int(rate * max(0, silence_blocks * block_seconds - 0.20)))]

    return audio, {
        "threshold": threshold,
        "noise": base,
        "seconds": round(float(audio.size) / rate, 2),
    }


def transcribe(audio):
    model = get_model()
    segments, info = model.transcribe(
        audio,
        language=LANGUAGE,
        beam_size=3,
        best_of=3,
        temperature=0.0,
        vad_filter=True,
        condition_on_previous_text=False,
        word_timestamps=False,
    )
    text = " ".join(seg.text.strip() for seg in segments if seg.text and seg.text.strip()).strip()
    return text, {
        "language": getattr(info, "language", LANGUAGE),
        "language_probability": round(float(getattr(info, "language_probability", 0.0)), 3),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "JarvisLocalSTT/1.0"

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
            return self._json(200, {
                "ok": True,
                "model": MODEL_NAME,
                "language": LANGUAGE,
                "loaded": ready,
                "engine": "faster-whisper",
                "cost": 0,
            })
        return self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self._origin_ok():
            return self._json(403, {"ok": False, "error": "forbidden"})
        if urlparse(self.path).path != "/listen":
            return self._json(404, {"ok": False, "error": "not found"})

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
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log("READY http://%s:%d model=%s language=%s" % (HOST, PORT, MODEL_NAME, LANGUAGE))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
