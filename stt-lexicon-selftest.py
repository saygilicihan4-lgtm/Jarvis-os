import importlib.util
import json
import os
import pathlib
import tempfile

with tempfile.TemporaryDirectory() as td:
    lex = pathlib.Path(td) / "speech-lexicon.json"
    lex.write_text(json.dumps({
        "version": 1,
        "aliases": {"yutup ac": "youtube aç"},
        "hotwords": ["YouTube", "Fikir2App"]
    }, ensure_ascii=False), encoding="utf-8")

    os.environ["JARVIS_SPEECH_LEXICON_FILE"] = str(lex)
    spec = importlib.util.spec_from_file_location("jarvis_local_stt_v4", "jarvis-local-stt-v4.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.lexicon_count() == 1, mod.lexicon_count()
    hot = mod.dynamic_hotwords()
    assert "YouTube" in hot, hot
    assert "Fikir2App" in hot, hot
    assert "youtube aç" in hot.lower(), hot

print("STT LEXICON SELFTEST PASS")
