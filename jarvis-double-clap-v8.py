# JARVIS OS - double-clap detector v5
# Goal: recognize two hand claps while rejecting music and continuous loud audio.
# Strategy: two transient candidates + required quiet gap between them + ambient guard.

import sys, time, subprocess, webbrowser, urllib.request, collections, os

def ensure_packages():
    try:
        import sounddevice as sd
        import numpy as np
        return sd, np
    except Exception:
        print("[JARVIS] DOUBLE CLAP V8: installing audio dependencies...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "--quiet", "sounddevice", "numpy"])
        import sounddevice as sd
        import numpy as np
        return sd, np

sd, np = ensure_packages()
devices = sd.query_devices()

device_index = None
device_name = None

# Prefer USB microphone.
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

# Final fallback.
if device_index is None:
    for idx, d in enumerate(devices):
        if d.get("max_input_channels", 0) > 0:
            device_index = idx
            device_name = str(d.get("name", f"Input {idx}"))
            break

if device_index is None:
    print("[JARVIS] DOUBLE CLAP V8: no input device found", flush=True)
    sys.exit(3)

print(f"[JARVIS] DOUBLE CLAP V8: INPUT {device_name} id={device_index}", flush=True)

SAMPLE_RATE = 16000
BLOCKSIZE = 512  # 32 ms

# Candidate quality gates.
HARD_MIN_PEAK = 0.080
HARD_MAX_PEAK = 0.990
MIN_DIFF_RMS = 0.012
MIN_CREST = 2.2
MIN_HF_RATIO = 0.27
MIN_ONSET_RATIO = 1.35

# Pair timing.
MIN_GAP = 0.18
MAX_GAP = 2.40
RESET_GAP = 2.70
WAKE_COOLDOWN = 3.0

# Silence requirements reject music.
PRE_QUIET_REQUIRED = 0.18
INTER_CLAP_QUIET_REQUIRED = 0.06
QUIET_PEAK_FACTOR = 1.8
QUIET_RMS_FACTOR = 2.2
AMBIENT_GUARD_FACTOR = 2.8

# Pair similarity.
MIN_PAIR_RATIO = 0.20
MAX_PAIR_RATIO = 4.5

noise_rms = 0.006
noise_diff = 0.002
last_smoothed_peak = 0.0
last_meter = 0.0
cooldown_until = 0.0

# State.
state = "idle"  # idle | waiting_second
first_time = 0.0
first_peak = 0.0
quiet_since = None
inter_quiet_seen = False

# Rolling ambient history (~0.8 s) to reject music/continuous loud audio.
history = collections.deque(maxlen=25)
TTS_LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jarvis-tts-active.lock")
tts_pause_announced = False

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
                print("[JARVIS] DOUBLE CLAP V8: WAKE LOCAL", flush=True)
                return
    except Exception:
        pass
    webbrowser.open("https://jarvis-os-1iuv.onrender.com/?wake=clap", new=0, autoraise=True)
    print("[JARVIS] DOUBLE CLAP V8: WAKE BROWSER FALLBACK", flush=True)

def features(block):
    x = np.asarray(block[:, 0], dtype=np.float32)
    if x.size == 0:
        return 0.0, 0.0, 0.0, 0.0, 0.0

    x = x - float(np.mean(x))
    absx = np.abs(x)
    peak = float(np.max(absx))
    rms = float(np.sqrt(np.mean(x * x)))

    if x.size > 1:
        dx = np.diff(x)
        diff_rms = float(np.sqrt(np.mean(dx * dx)))
    else:
        diff_rms = 0.0

    win = np.hanning(x.size).astype(np.float32)
    spec = np.abs(np.fft.rfft(x * win)) ** 2
    freqs = np.fft.rfftfreq(x.size, 1.0 / SAMPLE_RATE)
    total_mask = (freqs >= 180) & (freqs <= 7600)
    hf_mask = (freqs >= 1800) & (freqs <= 7600)
    total = float(np.sum(spec[total_mask])) + 1e-12
    hf_ratio = float(np.sum(spec[hf_mask])) / total

    clipped_ratio = float(np.mean(absx >= 0.985))
    return peak, rms, diff_rms, hf_ratio, clipped_ratio

try:
    with sd.InputStream(
        device=device_index,
        channels=1,
        samplerate=SAMPLE_RATE,
        blocksize=BLOCKSIZE,
        dtype="float32",
    ) as stream:
        print("[JARVIS] DOUBLE CLAP V8: CALIBRATING 3s - stay quiet", flush=True)
        cal_rms, cal_diff = [], []
        end_cal = time.monotonic() + 3.0
        while time.monotonic() < end_cal:
            data, _ = stream.read(BLOCKSIZE)
            peak, rms, diff_rms, hf_ratio, clipped_ratio = features(data)
            if peak < 0.12 and clipped_ratio == 0:
                cal_rms.append(rms)
                cal_diff.append(diff_rms)

        if cal_rms:
            noise_rms = max(0.002, float(np.median(cal_rms)))
        if cal_diff:
            noise_diff = max(0.0008, float(np.median(cal_diff)))

        print(
            f"[JARVIS] DOUBLE CLAP V8: ARMED noise={noise_rms:.4f} diff={noise_diff:.4f}",
            flush=True,
        )

        while True:
            data, overflowed = stream.read(BLOCKSIZE)
            now = time.monotonic()

            # Do not listen to Jarvis' own voice. The worker creates this lock
            # while TTS is playing and removes it after the audio has fully ended.
            if os.path.exists(TTS_LOCK_FILE):
                if not tts_pause_announced:
                    print("[JARVIS] DOUBLE CLAP V8: PAUSED FOR JARVIS VOICE", flush=True)
                    tts_pause_announced = True
                state = "idle"
                first_time = 0.0
                first_peak = 0.0
                inter_quiet_seen = False
                quiet_since = now
                history.clear()
                last_smoothed_peak = 0.0
                continue
            elif tts_pause_announced:
                print("[JARVIS] DOUBLE CLAP V8: RESUMED", flush=True)
                tts_pause_announced = False
                quiet_since = now
                history.clear()

            peak, rms, diff_rms, hf_ratio, clipped_ratio = features(data)

            peak_thr = max(HARD_MIN_PEAK, noise_rms * 6.0)
            diff_thr = max(MIN_DIFF_RMS, noise_diff * 5.0)
            crest = peak / max(rms, 1e-6)
            onset_ratio = peak / max(last_smoothed_peak, 0.008)

            # IMPORTANT: evaluate the room state BEFORE the current block.
            # In V5 the clap block itself was inserted into the ambient history
            # before this check, so a real clap made "ambient_quiet" false.
            pre_ambient_rms = float(np.mean(history)) if history else noise_rms
            pre_ambient_quiet = pre_ambient_rms <= max(noise_rms * AMBIENT_GUARD_FACTOR, 0.020)
            pre_quiet_duration = (now - quiet_since) if quiet_since is not None else 0.0

            # Classify the current block as quiet/non-quiet only after saving
            # the pre-event state.
            quiet_now = (
                peak <= max(peak_thr * QUIET_PEAK_FACTOR, 0.050)
                and rms <= max(noise_rms * QUIET_RMS_FACTOR, 0.015)
            )

            # Add the current block to ambient history after the pre-check.
            history.append(rms)

            if quiet_now:
                if quiet_since is None:
                    quiet_since = now
            else:
                quiet_since = None

            quiet_duration = (now - quiet_since) if quiet_since is not None else 0.0

            # First clap stays strict. After a verified quiet decay, the
            # second clap can be softer/different because real hand claps often
            # vary a lot in loudness and spectral shape.
            candidate = (
                peak >= peak_thr
                and peak <= HARD_MAX_PEAK
                and clipped_ratio < 0.006
                and diff_rms >= diff_thr
                and crest >= MIN_CREST
                and hf_ratio >= MIN_HF_RATIO
                and onset_ratio >= MIN_ONSET_RATIO
            )
            second_peak_thr = max(0.055, noise_rms * 4.2)
            second_diff_thr = max(0.0075, noise_diff * 3.2)
            second_candidate = (
                peak >= second_peak_thr
                and peak <= HARD_MAX_PEAK
                and clipped_ratio < 0.010
                and diff_rms >= second_diff_thr
                and crest >= 1.55
                and hf_ratio >= 0.16
            )

            if state == "idle":
                # First clap must come from an otherwise quiet environment.
                if candidate and not (pre_ambient_quiet and pre_quiet_duration >= PRE_QUIET_REQUIRED):
                    print(
                        f"[JARVIS] DOUBLE CLAP V8: CLAP-LIKE REJECTED "
                        f"preQuiet={pre_quiet_duration:.2f}s ambient={pre_ambient_rms:.4f}",
                        flush=True,
                    )
                first_ok = (
                    candidate
                    and pre_ambient_quiet
                    and pre_quiet_duration >= PRE_QUIET_REQUIRED
                    and now >= cooldown_until
                )
                if first_ok:
                    state = "waiting_second"
                    first_time = now
                    first_peak = peak
                    inter_quiet_seen = False
                    print(
                        f"[JARVIS] DOUBLE CLAP V8: FIRST peak={peak:.4f} "
                        f"diff={diff_rms:.4f} hf={hf_ratio:.2f}",
                        flush=True,
                    )
                    print("[JARVIS] DOUBLE CLAP V8: WAITING SECOND CLAP", flush=True)

            else:
                gap = now - first_time

                # We must observe a quiet decay after the first clap.
                if quiet_duration >= INTER_CLAP_QUIET_REQUIRED:
                    inter_quiet_seen = True

                if second_candidate and not inter_quiet_seen:
                    print(
                        f"[JARVIS] DOUBLE CLAP V8: SECOND-LIKE WAITING FOR QUIET "
                        f"gap={gap:.2f}s peak={peak:.4f}",
                        flush=True,
                    )
                if gap > RESET_GAP:
                    print("[JARVIS] DOUBLE CLAP V8: RESET - second clap timeout", flush=True)
                    state = "idle"
                    first_time = 0.0
                    first_peak = 0.0
                    inter_quiet_seen = False
                elif (
                    second_candidate
                    and inter_quiet_seen
                    and MIN_GAP <= gap <= MAX_GAP
                    and now >= cooldown_until
                ):
                    ratio = peak / max(first_peak, 1e-6)
                    if MIN_PAIR_RATIO <= ratio <= MAX_PAIR_RATIO:
                        print(
                            f"[JARVIS] DOUBLE CLAP V8: SECOND peak={peak:.4f} "
                            f"gap={gap:.2f}s ratio={ratio:.2f}",
                            flush=True,
                        )
                        print("[JARVIS] DOUBLE CLAP V8: DOUBLE CLAP CONFIRMED", flush=True)
                        state = "idle"
                        first_time = 0.0
                        first_peak = 0.0
                        inter_quiet_seen = False
                        cooldown_until = now + WAKE_COOLDOWN
                        wake()
                    else:
                        print(
                            f"[JARVIS] DOUBLE CLAP V8: RESET - pair ratio {ratio:.2f}",
                            flush=True,
                        )
                        state = "idle"
                        first_time = 0.0
                        first_peak = 0.0
                        inter_quiet_seen = False

            # Adapt noise floor only during quiet, idle periods.
            if state == "idle" and quiet_now:
                noise_rms = (noise_rms * 0.995) + (rms * 0.005)
                noise_diff = (noise_diff * 0.995) + (diff_rms * 0.005)

            last_smoothed_peak = (last_smoothed_peak * 0.45) + (peak * 0.55)

except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"[JARVIS] DOUBLE CLAP V8 ERROR: {e}", flush=True)
    sys.exit(1)
