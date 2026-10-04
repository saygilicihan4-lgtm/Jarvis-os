'use strict';
const fs=require('fs');
const crypto=require('crypto');
const assert=require('assert');

const mobile=fs.readFileSync('public/mobile-canonical-cockpit.js','utf8');
const holo=fs.readFileSync('public/tri-core-hologram.js','utf8');
const parts=[1,2,3,4].map(n=>fs.readFileSync(`public/jarvis-mobile-cockpit-v185-0${n}.b64`,'utf8').replace(/\s+/g,''));
const joined=parts.join('');
const art=Buffer.from(joined,'base64');

assert.strictEqual(joined.length,75968,'approved mobile cockpit base64 length drifted');
assert.strictEqual(art.length,56974,'approved mobile cockpit byte length drifted');
assert.strictEqual(art.subarray(0,4).toString('ascii'),'RIFF','approved cockpit RIFF header missing');
assert.strictEqual(art.subarray(8,12).toString('ascii'),'WEBP','approved cockpit WEBP header missing');
assert.strictEqual(crypto.createHash('sha256').update(art).digest('hex'),'a6f13c1570db28cfce4db5b158ff0be981bf4a8f91be6d5f11c42f9661e2624a','approved cockpit image bytes drifted');

assert(mobile.includes("const VERSION='2.0'"),'v185 canonical implementation version missing');
assert(mobile.includes("const MEDIA='(max-width: 860px) and (orientation: portrait)'"),'portrait mobile activation contract missing');
assert(mobile.includes('aspect-ratio:941/1672'),'approved 941x1672 aspect ratio missing');
for(let n=1;n<=4;n++)assert(mobile.includes(`/jarvis-mobile-cockpit-v185-0${n}.b64`),`asset chunk ${n} loader missing`);
assert(mobile.includes("ascii(0,4)!=='RIFF'")&&mobile.includes("ascii(8,12)!=='WEBP'"),'runtime asset integrity guard missing');
assert(mobile.includes('jm-copy nova')&&mobile.includes('jm-copy jarvis')&&mobile.includes('jm-copy orion'),'reactive tri-core art layers missing');
assert(mobile.includes('@keyframes jmSpeak{from{transform:scale(1.04)}to{transform:scale(1.07)}}'),'JARVIS speaking growth must remain 4-7 percent');
assert(mobile.includes('data-state="listening"')&&mobile.includes('data-state="speaking"')&&mobile.includes('data-state="thinking"'),'conversation-reactive states missing');
assert(mobile.includes('data-core="nova"')&&mobile.includes('data-core="orion"'),'NOVA/ORION active-color reactions missing');
assert(mobile.includes('prefers-reduced-motion:reduce'),'reduced-motion guard missing');
assert(mobile.includes('sourceLayer()')&&mobile.includes('jarvis:language-changed'),'dynamic multilingual overlay bridge missing');
assert(mobile.includes("dataset.dir==='rtl'")||mobile.includes("documentElement.dir==='rtl'"),'RTL bridge missing');
assert(mobile.includes('clickLegacy(action)'),'approved art controls must proxy established cockpit actions');
assert(mobile.includes('.ref-hotspot[data-a='),'legacy approval-safe hotspot proxy missing');
assert(mobile.includes("credentials:'same-origin'"),'asset retrieval must remain same-origin');
assert(mobile.includes("dataset.mobileCockpitAsset='error'")&&mobile.includes("dataset.referenceCockpitMobile='0'"),'safe visual fallback missing');
assert(!mobile.includes('localStorage')&&!mobile.includes('sessionStorage'),'presentation must not persist secrets/state');
assert(!mobile.includes('approve_mission_action')&&!mobile.includes('shopify_publish')&&!mobile.includes('youtube_publish'),'presentation must not gain publish/approval authority');
assert(holo.includes("script.src='/mobile-canonical-cockpit.js'"),'tri-core runtime must load canonical mobile cockpit');
assert(holo.includes('Presentation-only: authority remains on the legacy cockpit/mission bridges.'),'authority boundary note missing');

console.log('MOBILE CANONICAL COCKPIT v185 SELFTEST PASS · approved portrait bytes + exact aspect + reactive holograms + i18n/RTL + legacy authority proxy');
