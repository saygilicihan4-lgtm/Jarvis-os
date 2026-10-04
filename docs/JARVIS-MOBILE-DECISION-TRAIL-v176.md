# v176 — Visible session decision trail

Mission Queue now has a small “Son kararlar” panel, using the existing v175
sanitized session receipts. It shows the newest eight first, retains timestamps,
proof type and result, and survives replacement of the mission cards. Identical
data does not rebuild the list on every queue refresh.

The panel explicitly describes records as the result at the time of the action,
not current task status. Persisted rows say “KAYIT”; reading them does not re-run
proof, authorize a decision or perform any request. The only control clears this
receipt storage key. It cannot approve, cancel, replay, publish or affect missions.
Failed deletion keeps the rows visible and reports failure. A fresh page can
rehydrate this tab's sessionStorage; this remains editable local display data,
not a tamper-proof audit log or a permanent history.

All data reaches the DOM through textContent. Invalid/extra stored fields still
pass through the v175 sanitizer. Optional DOM failures cannot overturn successful
action proof. Reinstallation replaces the owned panel without duplicating IDs.

Validation: `node mission-console-selftest.js` includes
`mobile-mission-trail-selftest.js`. It exercises bounded/newest-first rendering,
same-data refresh, queue replacement, module reinstallation, malicious storage,
local-only clearing, failed deletion, blocked storage, missing/broken DOM and
the shipped async `act()` success/failure path into the visible trail. All prior
v173 target binding, v174 replay and v175 receipt tests remain in this chain.

The UI regression uses a deterministic DOM boundary in Node. Physical iPhone,
Safari/PWA and Windows acceptance is still pending. No real PUBLIC action or
paid service is part of this change.
