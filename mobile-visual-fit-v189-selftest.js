'use strict';
const fs=require('fs');
const assert=require('assert');

const fit=fs.readFileSync('public/mobile-visual-fit-v189.js','utf8');
const holo=fs.readFileSync('public/tri-core-hologram.js','utf8');

assert(fit.includes("const VERSION='1.0'"),'visual-fit version missing');
assert(fit.includes('visualViewport?.height')&&fit.includes('visualViewport?.width'),'iPhone visual viewport sizing missing');
assert(fit.includes('height:var(--jm-screen-h,100dvh)!important'),'full-height mobile viewport override missing');
assert(fit.includes('width:var(--jm-screen-w,100vw)!important'),'full-width mobile viewport override missing');
assert(fit.includes('aspect-ratio:auto!important')&&fit.includes('background-size:100% 100%!important'),'canonical art must fill the mobile viewport and keep hotspots aligned');
assert(fit.includes('.jm-blur{display:none!important}')&&fit.includes('.jm-vignette{display:none!important}'),'letterbox/blur filler must not remain visible on phone');
assert(fit.includes("dataset.bakedOverlay=/^tr(?:-|$)/i.test(locale())?'1':'0'"),'Turkish baked overlay mode missing');
assert(fit.includes('[data-baked-overlay="1"] .jm-clock')&&fit.includes('.jm-live-panel')&&fit.includes('.jm-pc-dot'),'duplicate baked/live overlays must be suppressed for exact Turkish artwork');
assert(fit.includes('.jm-hot:focus-visible')&&fit.includes('.jm-hot:active')&&fit.includes('box-shadow:none!important'),'tap/focus blue-square suppression missing');
assert(fit.includes("root.addEventListener('touchend'")&&fit.includes('button.blur()'),'post-tap focus clearing missing');
assert(fit.includes('opacity:.10!important'),'idle duplicate-art ghosting reduction missing');
assert(!fit.includes('localStorage')&&!fit.includes('sessionStorage'),'visual patch must not persist state or secrets');
assert(!fit.includes('approve_mission_action')&&!fit.includes('shopify_publish')&&!fit.includes('youtube_publish'),'visual patch must not gain approval/publish authority');

const canonicalPos=holo.indexOf("script.src='/mobile-canonical-cockpit.js'");
const fitPos=holo.indexOf("script.src='/mobile-visual-fit-v189.js'");
assert(canonicalPos>=0&&fitPos>canonicalPos,'visual-fit loader must run after canonical cockpit loader');
assert(holo.includes('Presentation-only: fixes viewport/touch rendering and owns no execution authority.'),'visual-fit authority boundary note missing');

console.log('MOBILE VISUAL FIT v189 SELFTEST PASS · edge-to-edge viewport + aligned hotspots + no tap square + no authority escalation');
