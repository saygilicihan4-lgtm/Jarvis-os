# JARVIS Tri-Core Deliberation v180

## Goal

v180 turns cross-core consultation from prompt wording into a real, bounded local analysis step while keeping one authority chain.

The primary role remains deterministic:

- JARVIS — execution-oriented speaking personality
- NOVA — advisory speaking personality
- ORION — specialist speaking personality

When the deterministic router identifies a useful secondary lens, the runtime may ask up to two other cores for short advisory notes before the primary core produces the single final answer.

## Not independent agents

Consultant cores are not workers or autonomous agents. A consultation pass:

- has no tools;
- has no Mission Engine / Worker handle;
- has no approval or publish authority;
- has no filesystem, PC or credential authority;
- can only call the already-required local loopback language model;
- returns a bounded advisory note, not an action result;
- cannot change which core is primary;
- cannot grant itself or the primary core new authority.

The final answer is still produced once by the selected primary core.

## Privacy boundary

Consultant calls do not receive conversation history. They receive only a bounded copy of the current turn after redaction of common credential formats, bearer tokens, password/token/secret fields, credential-bearing URLs and 8-digit session-style codes.

Consultation text and notes are not written to localStorage/sessionStorage and are not logged by the deliberation module.

The primary conversation path continues to use the normal conversation history and existing local loopback model boundary.

## Failure and cancellation

Consultation is advisory and fail-soft: if one consultant is unavailable, the primary answer path may continue with the successful notes or no notes. Turn cancellation remains fail-closed and aborts consultation.

Only successfully completed, allow-listed consultant IDs can be returned to the UI as `consultWith`. This makes the holographic collaboration state evidence-based rather than merely planned.

## Evidence boundary

CI can prove routing contracts, loopback-only configuration, secret redaction behavior, no-tool request bodies, fail-soft behavior, cancellation, deterministic consultation metadata and no persistence/logging in the deliberation module.

Physical Windows/iPhone rendering, GPU timing, microphone behavior and real-device audio remain final acceptance tests and are not claimed by v180.
