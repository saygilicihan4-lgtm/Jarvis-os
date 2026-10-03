# JARVIS Mobile Language Relay v130

v130 adds a fail-closed relay contract for language-bound mobile TTS work. It is a shared core intended to sit between the phone web client, the cloud queue and an approved signed Windows Worker.

## Security invariants

- Every request must carry a syntactically valid locale. Locale syntax alone is **not** evidence that STT or TTS is supported.
- A Worker claim returns the canonical locale plus a one-time claim token.
- Only the Worker that owns the claim may submit its result.
- A successful result must echo the same locale and current claim token.
- Wrong-Worker, stale-token, wrong-locale, duplicate, oversized and post-cancel results are rejected without mutating accepted audio.
- Requests expire from the in-memory relay and capacity is bounded.
- This layer does not register or infer STT capability.

## Verification

The relay contract is exercised inside `speech-runtime-selftest.js`, which is executed by both `Jarvis CI` and `Jarvis Adaptive Speech CI` on pull requests to `main`.

## Scope boundary

This PR establishes and ships the relay core through the trusted Windows updater. It does **not** claim that phone microphone STT or HP Windows + phone end-to-end acceptance is complete. Runtime wiring into the existing large `server.js` and `worker.js` paths remains a separate integration step so those files can be changed minimally and reviewed without unsafe wholesale replacement.
