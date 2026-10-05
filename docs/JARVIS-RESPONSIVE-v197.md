# Responsive cockpit v197

Fixes the portrait-only activation chain that exposed the legacy poster cockpit
on phone rotation and desktop. The existing native stage, translations, session
security and action proxies now run on all screen orientations. No execution,
publication, session-revocation or paid-service authority is added.

Portrait layout is preserved. Landscape and desktop use six columns pairing
each NOVA/JARVIS/ORION sphere with its own translated capability card. Short
landscape viewports use two rows of quick actions and side-by-side live panels.
All modes retain visualViewport sizing, safe-area padding and reduced motion.
Rotation retains the DOM and event bindings rather than rebuilding the cockpit.

Browser regression coverage: 390x844, 390x664, 320x568, 430x932, 844x390,
667x375, 932x430, 1366x768 and 1920x1080; initial landscape boot; rotation in
both directions; 16 controls and hit targets; translated/RTL labels; adjacent
capability geometry; session panel; live data; genuine desktop app boot/mouse
interaction; viewport/keyboard changes. API writes are forbidden in fixtures.
Chromium and WebKit run in the existing Reference Cockpit CI matrix.

These automated checks are not physical iPhone or Windows acceptance tests.
Capability lists describe roles, not proof that a task is currently running.
Missing telemetry stays unknown rather than displaying invented percentages.
