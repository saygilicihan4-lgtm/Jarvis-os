# JARVIS OS - robust local double-clap wake for Windows.
# Uses Python sounddevice instead of direct winmm marshalling.

import os, sys, time, subprocess, webbrowser

def ensure_packages():
    try:
        import sounddevice as sd
        import numpy as np
        return sd, np
    except Exception:
        print("[JARVIS] DOUBLE CLAP: installing local audio dependencies...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "--quiet", "sounddevice", "numpy"])
        import sounddevice as sd
        import numpy as np
        return sd, np

sd, np = ensure_packages()

devices = sd.query_devices()
device_index = None
device_name = None

# Prefer the Windows default input first if it is a usable USB microphone.
try:
    default_in = sd.default.device[0]
    if default_in is not None and int(default_in) >= 0:
        d = devices[int(default_in)]
        if d.get("max_input_channels", 0) > 0:
            device_index = int(default_in)
            device_name = d.get("name", "Default input")
except Exception:
    pass

# Explicitly prefer USB Microphone when present.
for idx, d in enumerate(devices):
    name = str(d.get("name", ""))
    if d.get("max_input_channels", 0) > 0 and "usb" in name.lower() and "micro" in name.lower():
        device_index = idx
        device_name = name
        break

# Fallback: first available input.
if device_index is None:
    for idx, d in enumerate(devices):
        if d.get("max_input_channels", 0) > 0:
            device_index = idx
            device_name = d.get("name", f"Input {idx}")
            break

if device_index is None:
    print("[JARVIS] DOUBLE CLAP: no input device found", flush=True)
    sys.exit(3)

print(f"[JARVIS] DOUBLE CLAP: INPUT {device_name} id={device_index}", flush=True)
print("[JARVIS] DOUBLE CLAP: ARMED (PYTHON SOUNDDEVICE)", flush=True)

sample_rate = 16000
blocksize = 1024
noise_floor = 0.01
last_clap = 0.0
cooldown_until = 0.0
last_meter = 0.0

# Tuned for a relatively quiet/low-gain microphone.
MIN_THRESHOLD = 0.045
NOISE_MULTIPLIER = 4.0
MIN_GAP = 0.10
MAX_GAP = 1.00
RESET_GAP = 1.10
COOLDOWN = 2.20

def wake():
    # Prefer signaling the already-open Jarvis UI through the local worker.
    # This avoids launching Edge/new browser windows on every wake.
    try:
        import urllib.request
        req = urllib.request.Request(
            "http://127.0.0.1:8765/wake",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.5) as r:
            if 200 <= r.status < 300:
                print("[JARVIS] DOUBLE CLAP: WAKE LOCAL", flush=True)
                return
    except Exception:
        pass

    # Fallback only if the local bridge is unavailable.
    url = "https://jarvis-os-1iuv.onrender.com/?wake=clap"
    webbrowser.open(url, new=0, autoraise=True)
    print("[JARVIS] DOUBLE CLAP: WAKE BROWSER FALLBACK", flush=True)

try:
    with sd.InputStream(
        device=device_index,
        channels=1,
        samplerate=sample_rate,
        blocksize=blocksize,
        dtype="float32",
    ) as stream:
        while True:
            data, overflowed = stream.read(blocksize)
            mono = np.asarray(data[:, 0], dtype=np.float32)
            peak = float(np.max(np.abs(mono))) if mono.size else 0.0
            rms = float(np.sqrt(np.mean(mono * mono))) if mono.size else 0.0

            # Slow adaptation to ambient sound. Avoid letting a transient clap
            # immediately raise the floor enough to hide the second clap.
            if peak < max(0.20, noise_floor * 8.0):
                noise_floor = (noise_floor * 0.97) + (rms * 0.03)

            threshold = max(MIN_THRESHOLD, noise_floor * NOISE_MULTIPLIER)
            now = time.monotonic()

            if now - last_meter >= 1.0:
                print(f"[JARVIS] DOUBLE CLAP: LEVEL peak={peak:.4f} threshold={threshold:.4f}", flush=True)
                last_meter = now

            if peak >= threshold and now >= cooldown_until:
                print(f"[JARVIS] DOUBLE CLAP: HIT peak={peak:.4f} threshold={threshold:.4f}", flush=True)
                if last_clap and MIN_GAP <= (now - last_clap) <= MAX_GAP:
                    last_clap = 0.0
                    cooldown_until = now + COOLDOWN
                    wake()
                else:
                    last_clap = now

            if last_clap and (now - last_clap) > RESET_GAP:
                last_clap = 0.0
except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"[JARVIS] DOUBLE CLAP ERROR: {e}", flush=True)
    sys.exit(1)
