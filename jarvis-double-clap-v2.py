# JARVIS OS - robust double-clap wake v2 for Windows.
# Uses Python sounddevice and transient gating to avoid false positives.

import sys, time, subprocess, webbrowser, urllib.request

def ensure_packages():
    try:
        import sounddevice as sd
        import numpy as np
        return sd, np
    except Exception:
        print("[JARVIS] DOUBLE CLAP V2: installing local audio dependencies...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "--quiet", "sounddevice", "numpy"])
        import sounddevice as sd
        import numpy as np
        return sd, np

sd, np = ensure_packages()
devices = sd.query_devices()

device_index = None
device_name = None

# Prefer explicit USB microphone.
for idx, d in enumerate(devices):
    name = str(d.get("name", ""))
    if d.get("max_input_channels", 0) > 0 and "usb" in name.lower() and "micro" in name.lower():
        device_index = idx
        device_name = name
        break

# Then Windows default input.
if device_index is None:
    try:
        default_in = int(sd.default.device[0])
        if default_in >= 0 and devices[default_in].get("max_input_channels", 0) > 0:
            device_index = default_in
            device_name = str(devices[default_in].get("name", "Default input"))
    except Exception:
        pass

# Last fallback: first input device.
if device_index is None:
    for idx, d in enumerate(devices):
        if d.get("max_input_channels", 0) > 0:
            device_index = idx
            device_name = str(d.get("name", f"Input {idx}"))
            break

if device_index is None:
    print("[JARVIS] DOUBLE CLAP V2: no input device found", flush=True)
    sys.exit(3)

print(f"[JARVIS] DOUBLE CLAP V2: INPUT {device_name} id={device_index}", flush=True)

sample_rate = 16000
blocksize = 512  # 32 ms blocks: better transient timing

# Timing
MIN_GAP = 0.16
MAX_GAP = 1.45
RESET_GAP = 1.65
WAKE_COOLDOWN = 2.50
REARM_QUIET_TIME = 0.14

# Floors; calibration/adaptation raises these if the room is noisy.
MIN_PEAK_THRESHOLD = 0.035
MIN_DIFF_THRESHOLD = 0.006
PEAK_NOISE_MULT = 5.0
DIFF_NOISE_MULT = 4.0
MIN_CREST = 1.7
ONSET_RATIO = 1.45

noise_rms = 0.006
noise_diff = 0.002
last_peak = 0.0
last_clap = 0.0
cooldown_until = 0.0
event_latched = False
quiet_since = None
last_meter = 0.0

def wake():
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8765/wake",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.5) as r:
            if 200 <= r.status < 300:
                print("[JARVIS] DOUBLE CLAP V2: WAKE LOCAL", flush=True)
                return
    except Exception:
        pass

    url = "https://jarvis-os-1iuv.onrender.com/?wake=clap"
    webbrowser.open(url, new=0, autoraise=True)
    print("[JARVIS] DOUBLE CLAP V2: WAKE BROWSER FALLBACK", flush=True)

def features(block):
    mono = np.asarray(block[:, 0], dtype=np.float32)
    if mono.size == 0:
        return 0.0, 0.0, 0.0
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(mono * mono)))
    if mono.size > 1:
        delta = np.diff(mono)
        diff_rms = float(np.sqrt(np.mean(delta * delta)))
    else:
        diff_rms = 0.0
    return peak, rms, diff_rms

try:
    with sd.InputStream(
        device=device_index,
        channels=1,
        samplerate=sample_rate,
        blocksize=blocksize,
        dtype="float32",
    ) as stream:
        # Ambient calibration: ignore all wake events for ~2 seconds.
        print("[JARVIS] DOUBLE CLAP V2: CALIBRATING 2s", flush=True)
        cal_rms = []
        cal_diff = []
        end_cal = time.monotonic() + 2.0
        while time.monotonic() < end_cal:
            data, _ = stream.read(blocksize)
            peak, rms, diff_rms = features(data)
            # Robustly ignore obvious transients during calibration.
            if peak < 0.25:
                cal_rms.append(rms)
                cal_diff.append(diff_rms)
        if cal_rms:
            noise_rms = max(0.002, float(np.median(cal_rms)))
        if cal_diff:
            noise_diff = max(0.0008, float(np.median(cal_diff)))

        print("[JARVIS] DOUBLE CLAP V2: ARMED", flush=True)

        while True:
            data, overflowed = stream.read(blocksize)
            peak, rms, diff_rms = features(data)
            now = time.monotonic()

            peak_threshold = max(MIN_PEAK_THRESHOLD, noise_rms * PEAK_NOISE_MULT)
            diff_threshold = max(MIN_DIFF_THRESHOLD, noise_diff * DIFF_NOISE_MULT)
            crest = peak / max(rms, 1e-6)

            # A clap must be a sharp onset, not just a loud sustained signal.
            sharp = (
                peak >= peak_threshold
                and diff_rms >= diff_threshold
                and crest >= MIN_CREST
                and peak >= max(peak_threshold, last_peak * ONSET_RATIO)
            )

            # One physical burst can span several audio blocks. Latch it as a
            # single event until the signal falls clearly below the threshold.
            if event_latched:
                if peak < peak_threshold * 0.55:
                    if quiet_since is None:
                        quiet_since = now
                    elif (now - quiet_since) >= REARM_QUIET_TIME:
                        event_latched = False
                        quiet_since = None
                else:
                    quiet_since = None

            if sharp and not event_latched and now >= cooldown_until:
                event_latched = True
                quiet_since = None
                print(
                    f"[JARVIS] DOUBLE CLAP V2: HIT peak={peak:.4f} "
                    f"thr={peak_threshold:.4f} diff={diff_rms:.4f} crest={crest:.2f}",
                    flush=True,
                )

                if last_clap and MIN_GAP <= (now - last_clap) <= MAX_GAP:
                    last_clap = 0.0
                    cooldown_until = now + WAKE_COOLDOWN
                    wake()
                else:
                    last_clap = now
                    print("[JARVIS] DOUBLE CLAP V2: WAITING SECOND CLAP", flush=True)

            if last_clap and (now - last_clap) > RESET_GAP:
                last_clap = 0.0

            # Adapt only while quiet. This prevents a clap/noise burst from
            # instantly lifting the threshold and hiding the next clap.
            if not event_latched and peak < peak_threshold * 0.75:
                noise_rms = (noise_rms * 0.985) + (rms * 0.015)
                noise_diff = (noise_diff * 0.985) + (diff_rms * 0.015)

            if now - last_meter >= 1.2:
                print(
                    f"[JARVIS] DOUBLE CLAP V2: LEVEL peak={peak:.4f} "
                    f"thr={peak_threshold:.4f} diff={diff_rms:.4f}",
                    flush=True,
                )
                last_meter = now

            last_peak = (last_peak * 0.35) + (peak * 0.65)

except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"[JARVIS] DOUBLE CLAP V2 ERROR: {e}", flush=True)
    sys.exit(1)
