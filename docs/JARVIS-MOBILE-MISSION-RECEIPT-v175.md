# v175 — Mobile Mission Approval Receipt / Decision Trail

After `act()` has resolved the exact card ID, rendered label and 80-bit REQ,
`runActionWithProof()` must complete both the Worker receipt and durable-state
checks. Only this successful call registers an immutable proof object, bound in
memory to action + mission ID + REQ. A bare state proof, a forged proof-shaped
object or another decision's proof cannot build a decision receipt.

The receipt contains only version, approve/cancel, the last eight mission-ID and
REQ characters, `worker_receipt+durable_state`, a fixed result enum and ISO time.
It records **approval request consumption or mission closure**, not successful
completion of the mission's later work. Raw request IDs, labels, input, payloads,
URLs, credentials and raw Worker results are never copied into receipts.

The status line includes time and proof/result. Up to eight sanitized receipts
are stored in `sessionStorage` under `jarvisMissionReceiptsV1`. Storage access,
parsing and writes are guarded. Reads have a 4,096-character bound, reject invalid schema,
version/date/result combinations, remove malformed data and strip unknown fields
from stored data. Denied storage and optional queue refresh failures cannot turn
an already verified decision into a reported failure. Receipt history is local
display data, not a tamper-proof audit log, and never grants permission.

## REDTEAM findings fixed

- Missing mission telemetry used to look like an empty queue. Proof now requires
  explicit online/healthy telemetry, a queue array, consistent open count and
  valid unique mission records. Invalid target approval metadata fails closed.
- The cloud queue shows at most eight missions. Absence in an incomplete queue
  is insufficient proof; it times out without a receipt. Approval may still be
  proven when the exact target is visible and its reviewed request is consumed.
- Safari can throw while accessing the `sessionStorage` property itself; that
  access is now inside the storage recovery boundary.
- Arbitrary upstream error text is not echoed in the decision status.

## Verification

`node mission-console-selftest.js` runs the existing actions and v174 replay
regressions plus the v175 receipt suite. The receipt suite executes the shipped
`act()` module with mock HTTP/DOM/storage boundaries and a virtual clock. It
checks pending proof, both successful actions, missing Worker receipt, unchanged
durable state, stale/wrong REQ/ID/label, malformed/offline/unhealthy/truncated
telemetry, private Worker payloads, proof-object binding, bounded storage,
malformed recovery, denied storage and failed refresh.

These are software tests. Physical iPhone Safari/PWA and Windows acceptance has
not been performed. No real YouTube or Shopify PUBLIC operation is included.

## Next step

v176: add a small session-only decision trail next to Mission Queue with an
explicit clear control, so receipts remain reviewable after status-line updates.
Stored entries remain non-authoritative; no retry/approve/publish buttons may be
derived from them. Keep physical device checks separate.
