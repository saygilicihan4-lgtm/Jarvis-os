# JARVIS multilingual conversation v129

Adds an optional Windows desktop **ÇOK DİLLİ SOHBET** button and a local
`/language-conversation` endpoint. This is conversation only; native actions
continue through the normal command controls. The phone relay is not wired to
this path and the button is disabled on phones.

## Turn contract

1. Refresh runtime provider inventory; capture with the loaded local STT model.
2. Require two consecutive reliable observations before switching languages.
   The first new-language observation asks for another sentence, without
   answering in the old language. Explicit preferences retain precedence.
3. Freeze the accepted locale and zero-cost provider/voice for the entire turn.
4. Ask the configured local Ollama model for a locale-tagged reply. Reject bad
   JSON or a mismatched locale. Model labels do not prove linguistic accuracy.
5. Synthesize with the exact runtime-discovered Edge voice or enabled installed
   SAPI voice. Edge requires internet; SAPI and STT run locally. No paid provider,
   automatic package/model installation, silent voice fallback or shared legacy
   speech cache is used. SAPI receives text as JSON data, never executable code.
6. Keep the turn active during playback. Only the browser's audio-ended event
   sends a successful, single-use receipt. Failed/interrupted/unplayed replies
   cannot advance learned preferences. A receipt is not hardware E2E proof.

History is session-local RAM, bounded to eight messages, and only includes
successfully reported playback. Audio files are removed after rendering.
Privacy mode, logout, page hiding, normal commands and the stop button cancel
this flow. Disconnected STT requests stop capture between recording blocks;
an already running native model inference may finish, but its result is discarded.

## Verification and remaining limits

Both required CI workflows include conversation and UI lifecycle regressions:
locale/voice agreement, first-observation confirmation, forged/replayed receipts,
failed synthesis, malformed model replies, playback failure, cancellation,
stale responses, temporary-file cleanup and session history isolation. Worker
HTTP tests cover the endpoint and exact-origin rejection. SAPI syntax is checked
by PowerShell in CI; local tests simulate provider/model/audio data.

These tests do not verify actual microphone recognition, the model's language
quality, Edge service availability, Windows SAPI audio, browser autoplay behavior
on the user's machine, or audible playback. They do not prove all languages are
supported. Runtime inventories advertise capabilities; quality needs device tests.

Continue software development and CI before the final HP Windows + phone E2E
acceptance. This milestone does not mark JARVIS complete. Connect and validate
the phone relay separately. Only after our JARVIS passes both device acceptances
may the separate global multilingual installer/site proceed (download, install,
permissions, pairing, test, paths and troubleshooting).

YouTube/Shopify PUBLIC actions still require explicit approval. Learned language
preferences never modify code, tool permissions or publication policy. Every
merge requires both named CI workflows successful on the exact PR head, a fresh
open/mergeable/unchanged-head check and a post-merge content comparison.
