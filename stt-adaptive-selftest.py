import importlib.util
import os

os.environ.setdefault("JARVIS_STT_SHORT_SILENCE", "0.45")
os.environ.setdefault("JARVIS_STT_LONG_SILENCE", "0.65")
os.environ.setdefault("JARVIS_STT_FAST_BEAM", "2")
os.environ.setdefault("JARVIS_STT_RETRY_BEAM", "5")

spec = importlib.util.spec_from_file_location("jarvis_local_stt_v4", "jarvis-local-stt-v4.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

assert mod.required_silence_blocks_for(5, 0.10) == 5
assert mod.required_silence_blocks_for(20, 0.10) == 7

assert mod.should_retry_transcription("", -0.1, 0.1) is True
assert mod.should_retry_transcription("merhaba", -0.95, 0.1) is True
assert mod.should_retry_transcription("merhaba", -0.2, 0.8) is True
assert mod.should_retry_transcription("merhaba", -0.2, 0.1) is False

assert mod.FAST_BEAM == 2
assert mod.RETRY_BEAM == 5

print("STT ADAPTIVE SELFTEST PASS")
