# JARVIS OS - robust double-clap wake v3 for Windows.
# Designed to reject USB pops, clipped transients, speech and sustained noise.

import sys, time, subprocess, webbrowser, urllib.request, math

def ensure_packages():
    try:
        import sounddevice as sd
        import numpy as np
        return sd, np
    except Exception:
        print("[JARVIS] DOUBLE CLAP V4: installing local audio dependencies...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "--quiet", "sounddevice", "numpy"])
        import sounddevice as sd
        import numpy as np
        return sd, np

sd, np = ensure_packages()
devices = sd.query_devices()

DEBUG_LEVELS = False

device_index = None
device_name = None

# Prefer the explicit USB microphone the user selected in Windows.
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
    print("[JARVIS] DOUBLE CLAP V4: no input device found", flush=True)
    sys.exit(3)

print(f"[JARVIS] DOUBLE CLAP V4: INPUT {device_name} id={device_index}", flush=True)

SAMPLE_RATE = 16000
BLOCKSIZE = 512

# Conservative candidate gates. We prefer a missed clap over false wakes.
HARD_MIN_PEAK = 0.075
HARD_MAX_PEAK = 0.985   # reject clipped USB/system pops
MIN_DIFF_RMS = 0.010
MIN_CREST = 2.0
MIN_HF_RATIO = 0.24
MIN_ONSET_RATIO = 1.30

MIN_GAP = 0.12
MAX_GAP = 2.50
RESET_GAP = 2.80
WAKE_COOLDOWN = 2.8
REARM_QUIET_TIME = 0.12

# Two genuine hand claps are usually in the same rough loudness range.
MIN_PAIR_RATIO = 0.28
MAX_PAIR_RATIO = 3.6

noise_rms = 0.006
noise_diff = 0.002
last_smoothed_peak = 0.0
first_clap_time = 0.0
first_clap_peak = 0.0
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
                print("[JARVIS] DOUBLE CLAP V4: WAKE LOCAL", flush=True)
                return
    except Exception:
        pass
    webbrowser.open("https://jarvis-os-1iuv.onrender.com/?wake=clap", new=0, autoraise=True)
    print("[JARVIS] DOUBLE CLAP V4: WAKE BROWSER FALLBACK", flush=True)

def features(block):
    x = np.asarray(block[:, 0], dtype=np.float32)
    if x.size == 0:
        return 0.0, 0.0, 0.0, 0.0, 0.0

    # Remove block DC bias.
    x = x - float(np.mean(x))
    absx = np.abs(x)
    peak = float(np.max(absx))
    rms = float(np.sqrt(np.mean(x * x)))

    if x.size > 1:
        dx = np.diff(x)
        diff_rms = float(np.sqrt(np.mean(dx * dx)))
    else:
        diff_rms = 0.0

    # Broadband/high-frequency energy helps distinguish claps from voice.
    win = np.hanning(x.size).astype(np.float32)
    spec = np.abs(np.fft.rfft(x * win)) ** 2
    freqs = np.fft.rfftfreq(x.size, 1.0 / SAMPLE_RATE)
    total_mask = (freqs >= 180) & (freqs <= 7600)
    hf_mask = (freqs >= 1800) & (freqs <= 7600)
    total = float(np.sum(spec[total_mask])) + 1e-12
    hf_ratio = float(np.sum(spec[hf_mask])) / total

    # Reject blocks where a large portion is saturated.
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
        print("[JARVIS] DOUBLE CLAP V4: CALIBRATING 3s - stay quiet", flush=True)
        cal_rms, cal_diff = [], []
        end_cal = time.monotonic() + 3.0
        while time.monotonic() < end_cal:
            data, _ = stream.read(BLOCKSIZE)
            peak, rms, diff_rms, hf_ratio, clipped_ratio = features(data)
            if peak < 0.10 and clipped_ratio == 0:
                cal_rms.append(rms)
                cal_diff.append(diff_rms)

        if cal_rms:
            noise_rms = max(0.002, float(np.median(cal_rms)))
        if cal_diff:
            noise_diff = max(0.0008, float(np.median(cal_diff)))

        print(
            f"[JARVIS] DOUBLE CLAP V4: ARMED noise={noise_rms:.4f} diff={noise_diff:.4f}",
            flush=True,
        )

        while True:
            data, overflowed = stream.read(BLOCKSIZE)
            peak, rms, diff_rms, hf_ratio, clipped_ratio = features(data)
            now = time.monotonic()

            peak_thr = max(HARD_MIN_PEAK, noise_rms * 5.5)
            diff_thr = max(MIN_DIFF_RMS, noise_diff * 4.5)
            crest = peak / max(rms, 1e-6)
            onset_ratio = peak / max(last_smoothed_peak, 0.008)

            # A valid clap candidate:
            # - not clipped
            # - sharp transient
            # - broadband/high-frequency
            # - clear onset over prior block
            candidate = (
                peak >= peak_thr
                and peak <= HARD_MAX_PEAK
                and clipped_ratio < 0.006
                and diff_rms >= diff_thr
                and crest >= MIN_CREST
                and hf_ratio >= MIN_HF_RATIO
                and onset_ratio >= MIN_ONSET_RATIO
            )

            # Re-arm only after the sound has clearly decayed.
            if event_latched:
                if peak < peak_thr * 0.55:
                    if quiet_since is None:
                        quiet_since = now
                    elif (now - quiet_since) >= REARM_QUIET_TIME:
                        event_latched = False
                        quiet_since = None
                else:
                    quiet_since = None

            if candidate and not event_latched and now >= cooldown_until:
                event_latched = True
                quiet_since = None

                print(
                    f"[JARVIS] DOUBLE CLAP V4: CANDIDATE peak={peak:.4f} "
                    f"thr={peak_thr:.4f} diff={diff_rms:.4f} "
                    f"hf={hf_ratio:.2f} crest={crest:.2f}",
                    flush=True,
                )

                if first_clap_time:
                    gap = now - first_clap_time
                    loudness_ratio = peak / max(first_clap_peak, 1e-6)
                    pair_ok = (
                        MIN_GAP <= gap <= MAX_GAP
                        and MIN_PAIR_RATIO <= loudness_ratio <= MAX_PAIR_RATIO
                    )
                    if pair_ok:
                        first_clap_time = 0.0
                        first_clap_peak = 0.0
                        cooldown_until = now + WAKE_COOLDOWN
                        print("[JARVIS] DOUBLE CLAP V4: DOUBLE CLAP CONFIRMED", flush=True)
                        wake()
                    else:
                        # This transient does not plausibly match the first one.
                        # Treat it as a new first candidate instead of waking.
                        first_clap_time = now
                        first_clap_peak = peak
                        print(
                            f"[JARVIS] DOUBLE CLAP V4: PAIR REJECTED gap={gap:.2f}s "
                            f"ratio={loudness_ratio:.2f}",
                            flush=True,
                        )
                else:
                    first_clap_time = now
                    first_clap_peak = peak
                    print("[JARVIS] DOUBLE CLAP V4: WAITING SECOND CLAP", flush=True)

            if first_clap_time and (now - first_clap_time) > RESET_GAP:
                first_clap_time = 0.0
                first_clap_peak = 0.0

            # Adapt only on quiet blocks.
            if not event_latched and peak < peak_thr * 0.65:
                noise_rms = (noise_rms * 0.99) + (rms * 0.01)
                noise_diff = (noise_diff * 0.99) + (diff_rms * 0.01)

            if DEBUG_LEVELS and now - last_meter >= 1.5:
                print(
                    f"[JARVIS] DOUBLE CLAP V4: LEVEL peak={peak:.4f} "
                    f"thr={peak_thr:.4f} diff={diff_rms:.4f} hf={hf_ratio:.2f}",
                    flush=True,
                )
                last_meter = now

            last_smoothed_peak = (last_smoothed_peak * 0.45) + (peak * 0.55)

except KeyboardInterrupt:
    pass
except Exception as e:
    print(f"[JARVIS] DOUBLE CLAP V4 ERROR: {e}", flush=True)
    sys.exit(1)
