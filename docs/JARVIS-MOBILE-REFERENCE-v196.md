# Mobile reference cockpit v196

The v190 mobile screen used coarse CSS rings, fixed example CPU/RAM/disk values,
and underspecified tap targets. The unfinished reference branch restored a flat
screenshot with percentage hotspots. This change enhances the existing native
stage with a responsive DOM layout and decorative crops from the owner's supplied
canonical reference (1221 × 1288 JPEG, unmodified).

## Behavior

- Blue NOVA, orange JARVIS and purple ORION retain the reference's detailed sphere
  artwork. Independent glow, orbit and waveform layers respond to conversation
  state and respect reduced motion. No generated images or paid services.
- All labels, menus, microphone controls, activity panels and connection controls
  are HTML. Artwork crops exclude text and have no pointer handlers. All 16
  controls proxy the existing actions; v195 security capture remains on the same
  stage. No new execution, approval, publish or session-minting authority.
- The shared locale catalog drives every home-screen label. Turkish and English
  work offline. Registered/local-translation packs and RTL use the existing
  language mechanism; unsupported locales retain the existing English fallback.
- Grid layout uses visualViewport dimensions/offsets and iOS safe areas. No fixed
  screenshot coordinate overlays. Touch highlighting is disabled; keyboard focus
  remains visible on pointer/keyboard devices. Command dialogs stack above the
  cockpit, trap keyboard focus and return it when closed.
- Live tasks and audit messages use the existing authenticated /api/state poll.
  Missing telemetry is shown as an em dash, never a fabricated percentage.
  PC state is boolean-bound; unknown internet connectivity stays unknown. The
  current server does not publish CPU/RAM/disk percentages, so those remain —.
- The native fallback also stops displaying fabricated example metrics.
- Image responses have explicit MIME types. No changes to the security boundary
  or public publication workflows.

## Evidence and limits

Local Chromium 133 browser automation passed at 390×844, 390×664, 320×568 and
430×932. At each size it checks all 16 visible controls at three interior points,
actual modal activation, exact-once microphone dispatch, v195 settings access,
TR/EN/registered Arabic labels, RTL geometry, missing telemetry and reduced motion.
Additional checks cover dynamic viewport resize, a simulated keyboard visual
viewport, animated speaking state and the actual index.html loader with fixture
API responses. Representative image: evidence/mobile-reference-v196.png.

The screenshot uses an isolated local test server, an offline PC and no tasks.
It is not evidence of a physical iPhone, Windows microphone, passkey, or real
mission execution. The test's safe-area reservations simulate 47 px / 34 px;
real iOS hardware acceptance remains outstanding.

`npm test` and the existing cockpit, viewport, approval and security contract
checks passed locally. Reference Cockpit CI adds Chromium and WebKit jobs using
Playwright 1.58.2 and uploads browser screenshots. Exact-head CI and deployment
results are recorded in the PR/release report, not inferred from these checks.

## Run

    npm ci --ignore-scripts
    npx playwright install --with-deps chromium webkit
    node tests/mobile-reference-browser.cjs

Optional: JARVIS_TEST_BROWSER selects an engine; JARVIS_SCREENSHOTS selects a
local output directory. Local Chromium-only environments can set
JARVIS_CHROMIUM_PATH to a compatible installed executable. CI uses Playwright's
pinned engines without that override.
