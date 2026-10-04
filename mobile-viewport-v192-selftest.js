'use strict';
const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('public/mobile-viewport-v192.js','utf8');

assert(src.includes("const VERSION='1.0'"),'viewport patch version missing');
assert(src.includes('host.visualViewport'),'visualViewport sizing missing');
assert(src.includes("--jv-mobile-vh"),'dynamic viewport height variable missing');
assert(src.includes("--jv-mobile-vw"),'dynamic viewport width variable missing');
assert(src.includes('height:var(--jv-mobile-vh,100dvh)!important'),'native cockpit must override 100lvh with live visual viewport height');
assert(src.includes('width:var(--jv-mobile-vw,100vw)!important'),'native cockpit must follow live visual viewport width');
assert(src.includes("visualViewport.addEventListener('resize'"),'visual viewport resize listener missing');
assert(src.includes("visualViewport.addEventListener('scroll'"),'visual viewport toolbar/scroll listener missing');
assert(src.includes('safe-area')===false,'viewport patch must preserve native v190 safe-area ownership rather than duplicate it');
assert(src.includes('text-rendering:geometricPrecision'),'native text crispness rule missing');
assert(src.includes('-webkit-font-smoothing:antialiased'),'iOS font smoothing rule missing');
assert(src.includes('pointer:coarse'),'touch-only focus suppression missing');
assert(src.includes('button.blur()'),'post-tap focus clearing missing');
assert(src.includes('#${ROOT_ID}>.jm-frame')&&src.includes('visibility:hidden!important'),'legacy raster layer must remain hidden behind native cockpit');
assert(!src.includes('localStorage')&&!src.includes('sessionStorage'),'viewport patch must not persist state');
assert(!src.includes('approve_mission_action')&&!src.includes('shopify_publish')&&!src.includes('youtube_publish'),'viewport patch must not gain execution or publish authority');

console.log('MOBILE VIEWPORT v192 SELFTEST PASS · visualViewport exact fit + crisp native DOM + touch focus cleanup + no authority escalation');
