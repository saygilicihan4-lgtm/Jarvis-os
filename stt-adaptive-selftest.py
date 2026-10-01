import importlib.util
import os

os.environ.setdefault("JARVIS_STT_SHORT_SILENCE", "0.38")
os.environ.setdefault("JARVIS_STT_MEDIUM_SILENCE", "0.58")
os.environ.setdefault("JARVIS_STT_LONG_SILENCE", "0.85")
os.environ.setdefault("JARVIS_STT_HESITATION_BONUS", "0.12")
os.environ.setdefault("JARVIS_STT_MAX_UTTERANCE", "20")
os.environ.setdefault("JARVIS_STT_FAST_BEAM", "2")
os.environ.setdefault("JARVIS_STT_RETRY_BEAM", "5")

spec = importlib.util.spec_from_file_location("jarvis_local_stt_v5", "jarvis-local-stt-v5.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

assert mod.endpoint_profile_for(5, 0.10)[0] == "short"
assert mod.endpoint_profile_for(20, 0.10)[0] == "medium"
assert mod.endpoint_profile_for(60, 0.10)[0] == "long"
assert mod.required_silence_blocks_for(5, 0.10, 0) == 4
assert mod.required_silence_blocks_for(20, 0.10, 0) == 6
assert mod.required_silence_blocks_for(60, 0.10, 0) == 9
assert mod.required_silence_blocks_for(60, 0.10, 2) == 11

assert mod.should_retry_transcription("", -0.1, 0.1) is True
assert mod.should_retry_transcription("merhaba", -0.95, 0.1) is True
assert mod.should_retry_transcription("merhaba", -0.2, 0.8) is True
assert mod.should_retry_transcription("merhaba", -0.2, 0.1) is False

assert mod.FAST_BEAM == 2
assert mod.RETRY_BEAM == 5
assert mod.MAX_UTTERANCE_SECONDS == 20.0

print("STT ADAPTIVE SELFTEST PASS")
