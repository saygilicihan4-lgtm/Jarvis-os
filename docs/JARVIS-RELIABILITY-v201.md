# v201: first paint, explicit listening and honest diagnostics

Base inspected live: ed7861885a468650a73c0397a7632dde20530f75. No open PR at start.

## Findings and changes

- The enhanced cockpit was loaded through several asynchronous scripts and a late stylesheet. Older layers could paint first. Critical first-paint CSS now hides those layers behind a neutral loading screen until the enhanced DOM is installed. The login remains available. A 12-second fallback releases the old interface if initialization fails, marked `data-cockpit-error=load_timeout`; this is recovery, not successful initialization.
- Desktop push-to-talk previously started recognition without bypassing passive wake-word filtering. An explicit button gesture now opens a bounded 30-second manual window. Passive listening still requires its wake word. End, error, stop and startup failure clear the window. Privacy and all existing command authorization remain intact.
- Recognition failures were only displayed in the hidden legacy UI, and `onend` immediately replaced errors with READY. Permission, audio capture, no-speech, network and unsupported errors now remain visible in the enhanced prompt until another recognition attempt changes them.
- Connection details now explain worker connectivity, display the last heartbeat/version when provided by the authenticated state, and expose the voice and command status. No device is marked online just because its browser is open. The phone dot identifies the current mobile client only; a desktop cannot infer a remote phone connection. Internet availability uses fresh successful dashboard evidence, not only navigator.onLine.
- All three idle spheres have more visible, staggered motion on desktop and phone. Reduced-motion accessibility preferences are respected.

## Unresolved physical/runtime evidence

The user's screenshot shows PC offline and commands waiting for a tool/worker. It does not establish why the Windows worker stopped or whether pairing, launcher, network or service credentials failed. Browser presence cannot replace an authenticated worker heartbeat. No credentials were requested or copied, no authorization bypass was added, and no local Windows launcher was executed remotely.

There was no physical iPhone/Windows microphone, sound output, PC task execution or HY300 test. Speech fixtures prove routing, not microphone capture or acoustic quality. A whole-project completion percentage has no defensible denominator yet.

Human projection v200 remains isolated on its work branch; this fix does not claim a celebrity face/voice or publish the unverified human renderer. No paid API, external scan, YouTube PUBLIC or Shopify PUBLIC action was added.

## Regression evidence

Follow-up after CI: the permission fixture had changed only a label while leaving the real desktop wake loop armed. It now invokes the production recognition error/end handlers. Animation moved from filtered SVG transforms to an HTML wrapper; the test waits for actual transform progression instead of sampling a single 160 ms interval. A superseded legacy WebGL renderer now releases its loop, buffer, program and canvas; hidden tabs pause its loop. Lifecycle tests cover pause, resume, disposal and restart prevention. These remove demonstrated unnecessary rendering work, but do not establish the sole cause of the user's HP browser hang.

The 700 ms localhost wake poll and 2500 ms dashboard poll also lacked in-flight guards. Slow or stalled requests could accumulate. Both scheduled paths now allow at most one pending request, have abort deadlines and skip hidden tabs. A transient dashboard network failure no longer logs out the browser; an actual ACCESS DENIED response still does. Production-function tests cover non-overlap and hidden-tab behavior. Freshness indicators continue to expire rather than displaying invented online state.

- `node cockpit-reliability-selftest.js`: executes extracted production handlers for passive/manual routing, manual expiry, privacy and startup failure.
- `npm test`, `npm run security:check`: existing isolated regressions.
- `tests/mobile-reference-browser.cjs`: delayed-loader first-paint test, desktop transform progression, reduced motion, visible permission error, connection diagnostics, existing portrait/landscape/desktop geometry and action dispatch checks. CI runs Chromium and WebKit; no physical-device claim.
