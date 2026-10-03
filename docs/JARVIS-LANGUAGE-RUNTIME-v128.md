# JARVIS safe language runtime v128

## Scope and verified baseline

Live review on 2026-10-03 confirmed PR #162 merged as
`20391ebb92a215b611b7b768c5e64d72a0798cd7`. Its head was
`835c82b479d18d0580565952f2a52e67adc6fef3`; the head-to-merge comparison
contained no changed files. Jarvis CI #401 and Adaptive Speech CI #229
passed for that head; post-merge Jarvis CI #402 passed.

This change consolidates the competing session designs in #163 and #164.
Neither design was merged: single-observation switching, explicit-preference
precedence, non-finite confidence and unverified persistent observations
needed stronger contracts.

## What this release implements

- Canonical BCP-47 locale validation that preserves script and region.
- Two consecutive, final, reliable automatic observations with confidence
  >= 0.85 before a proposed session switch. Invalid/intervening evidence
  resets the candidate; repeated or stale observations cannot advance it.
- A turn keeps its locale from `begin` until its matching `complete`.
  A pending language applies at the next turn boundary. An explicit requested
  or saved language prevents automatic switching.
- Three consecutive accepted completed turns with confidence >= 0.90 can
  learn a preference. Failed, mismatched or invalid turns reset that candidate.
  The caller supplies the completion receipt; this is **not device proof**.
  Session observation alone cannot write a preference. Profiles are written
  atomically under the configured workspace; no transcript is stored here.
- Per-request `language: "auto"` in the local faster-whisper helper, without
  changing its default `tr` configuration. A forced-language probability of
  1.0 is configuration, never automatic language evidence. Auto mode omits
  Turkish hotwords and keeps the same language choice during retry decoding.
- STT inventory comes from the **loaded model's** `supported_languages`.
  An English-only model cannot claim automatic multilingual detection.
- Edge TTS voice IDs/locales come from the installed package's live voice
  inventory. Windows SAPI inventory includes only enabled installed voices.
  Edge is marked online; SAPI and the loaded STT model are marked local.
  No paid provider, package installation or model download is added.
- Provider mapping requires runtime evidence, exact TTS locale and a known
  zero-cost provider. Evidence expires after five minutes; failed refreshes
  revoke it. No automatic fallback to another language. A missing voice
  results in a text-only/unavailable plan. Turkish prefers AhmetNeural.

Runtime inventory proves a provider advertises a capability. It does not
prove intelligibility, recognition accuracy, output playback or E2E readiness.
Whisper language codes do not prove recognition quality for every region or
script. No "all languages supported" claim is made.

## Integration API

The existing local Worker bridge exposes `POST /language-session` with the
same exact-origin restriction as its other local endpoints. It is an
experimental integration surface, not yet used by the normal desktop/mobile
conversation loop. Default UI, response-language prompts, voice queues and
mobile speech relay are unchanged. Do not present this release as multilingual
conversation already working on the user's PC or phone.

Actions:

| Action | Inputs | Result |
| --- | --- | --- |
| `create` | optional `requested` locale | new bounded session ID |
| `probe` | none | loaded STT and runtime TTS inventory reports |
| `listen` | `sessionId` | loopback STT capture, validated observation, staged locale |
| `begin` | `sessionId` | turn ID, frozen context, provider/voice plan |
| `complete` | `sessionId`, `turnId`, boolean `successful` | release turn; gated preference learning |
| `status` | `sessionId` | context, pending locale, truthful provider plan |
| `set-preference` | locale or `null` | set or clear explicit preference |
| `reset-learned` | none | clear learned preference, preserve explicit choice |

Clients cannot supply a workspace path, provider URL, detected confidence,
voice inventory or arbitrary executable. Capture uses the configured loopback
STT port. Only one capture runs at once. An active response prevents a new
capture. Sessions expire after 30 minutes of inactivity and have bounded
capacity; start a new session after 128 captures. Profiles are currently
workspace-scoped for a single user, not multi-tenant cloud profiles.
Provider utterance IDs are also deduplicated across sessions. After 4096
observations the runtime requires a restart rather than evicting replay
evidence. A reliable detection without speech coverage blocks `begin`; it
cannot silently reuse the previous language's voice.

Updater and one-click installation include all language-runtime dependencies.
The legacy worker can still start before those optional modules are installed;
the API reports an error instead of advertising invented support.

## Automated verification and limits

Both Jarvis CI and Jarvis Adaptive Speech CI run:

- `session-language-selftest.js`: thresholds, explicit preference, turn
  boundaries, invalid locales/confidence, replay and profile behavior.
- `speech-runtime-selftest.js`: provider freshness/revocation, offline routing,
  complete capture-to-session-to-learning flow using simulated STT/voice data,
  concurrent capture rejection, expiry and no transcript persistence.
- `stt-language-selftest.py`: fake-model faster-whisper contract, automatic vs
  configured language, retries, quality gating and origin validation.
- `language-session-worker-selftest.js`: actual local HTTP Worker process,
  session API, origin checks and installer/updater file coverage.

These tests use fixtures for ASR and voice inventories. No real microphone,
Windows SAPI synthesis, mobile STT or audible output is claimed by them.

Provider API references:
- https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
- https://github.com/rany2/edge-tts/blob/master/src/edge_tts/voices.py
- https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer

## Next integration and final acceptance order

Next software work: connect the session's frozen context and selected voice to
response generation, speech queue/cache, interruptions and the mobile relay;
carry browser recognition evidence only where it can actually be measured.
Do not wire a new output language into the existing Turkish-only response
prompts or Turkish text normalizer without updating them together.

Continue free/local development and CI first. New learning must never alter
code, execution permissions or publication policy without separate validation.
YouTube/Shopify PUBLIC actions continue to require explicit authorization.
Every merge requires completed-success **Jarvis CI and Jarvis Adaptive Speech
CI on the exact PR head**, a fresh open/mergeable/unchanged-head check, and a
post-merge head-to-merge comparison.

After software development is complete, perform the final step-by-step E2E
acceptance on Cihan's HP Windows PC **and** phone. Both remain unverified.
Only after our own JARVIS passes that acceptance may a separate global,
multilingual installation website/package proceed: download, install,
permissions, phone pairing and verification, with files/folders and
troubleshooting instructions. This document does not mark the project complete.
