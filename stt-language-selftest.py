"""Provider contract tests with a fake model; no microphone or real ASR claim."""
import importlib.util
import math
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('stt', 'jarvis-local-stt-v4.py')
stt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stt)

class Model:
    supported_languages = ['tr', 'de', 'en']
    probability = .96
    logprob = -.1
    no_speech = .01
    def __init__(self):
        self.calls = []
    def transcribe(self, audio, **options):
        self.calls.append(options)
        return iter([SimpleNamespace(text='Guten Tag', avg_logprob=self.logprob, no_speech_prob=self.no_speech)]), SimpleNamespace(language=options['language'] or 'de', language_probability=self.probability)

assert stt.language_capabilities()['languages'] == []
model = Model()
stt._model = model
assert stt.language_capabilities()['languages'] == ['de', 'en', 'tr']
text, meta = stt.transcribe(object(), language='auto')
assert text == 'Guten Tag' and model.calls[-1]['language'] is None
assert model.calls[-1]['hotwords'] is None
assert meta['language_detection'] == {'mode': 'automatic', 'language': 'de', 'confidence': .96, 'final': True, 'reliable': True}
first_id = meta['utterance_id']
text, meta = stt.transcribe(object(), language='tr-TR')
assert model.calls[-1]['language'] == 'tr' and model.calls[-1]['hotwords']
assert meta['language_detection']['mode'] == 'configured' and meta['language_detection']['confidence'] == 0
assert meta['utterance_id'] != first_id
for value in [float('nan'), float('inf'), -1, 1.5, '.99', True]:
    model.probability = value
    _, meta = stt.transcribe(object(), language='auto')
    assert meta['language_detection']['confidence'] == 0
model.probability = .95
model.logprob = -.95
_, meta = stt.transcribe(object(), language='auto')
assert meta['decode_mode'] == 'retry'
assert meta['language_detection']['reliable'] is False and meta['language_detection']['confidence'] == 0
assert all(x['language'] is None for x in model.calls[-2:])
model.logprob = -.1
model.no_speech = .8
_, meta = stt.transcribe(object(), language='auto')
assert meta['language_detection']['confidence'] == 0
for value in ['xx', '__proto__', 'tr; exit', '', 42]:
    try:
        stt.transcribe(object(), language=value)
        raise AssertionError('invalid/unsupported language accepted')
    except ValueError:
        pass
model.supported_languages = ['en']
try:
    stt.transcribe(object(), language='auto')
    raise AssertionError('English-only model claimed automatic detection')
except ValueError:
    pass
for origin in ['http://localhost.evil.test', 'http://127.0.0.1.evil.test', 'http://localhost@evil.test']:
    assert not stt.Handler._origin_ok(SimpleNamespace(headers={'Origin': origin}))
assert stt.Handler._origin_ok(SimpleNamespace(headers={'Origin': 'http://localhost:8765'}))
print('STT LANGUAGE SELFTEST PASS · fake-model contract, not microphone E2E')

# A disconnected request stops microphone capture at the next block boundary.
import socket
left, right = socket.socketpair()
try:
    assert stt.connection_closed(left) is False
    right.close()
    assert stt.connection_closed(left) is True
finally:
    left.close()
    right.close()
try:
    stt.record_utterance(cancelled=lambda: True)
    raise AssertionError('cancelled capture entered microphone setup')
except RuntimeError as error:
    assert str(error) == 'capture_cancelled'
print('STT DISCONNECT CANCELLATION SELFTEST PASS')
