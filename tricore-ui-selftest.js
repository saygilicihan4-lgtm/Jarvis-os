'use strict';

const fs=require('fs');
const assert=require('assert');
const tri=require('./public/tri-core.js');

const css=fs.readFileSync('public/style.css','utf8');
const routerSource=fs.readFileSync('public/tri-core.js','utf8');
const loaderSource=fs.readFileSync('public/language-chat.js','utf8');

assert(css.includes('v177 TRI-CORE VISUAL SHELL'),'tri-core marker missing');
assert(css.includes('content:"NOVA\\A DANIŞMAN"'),'NOVA advisor core missing');
assert(css.includes('content:"ORION\\A UZMAN"'),'ORION specialist core missing');
assert(css.includes('--amber:#ff9a2f'),'JARVIS amber identity missing');
assert(css.includes('--violet:#c65cff'),'ORION violet identity missing');
assert(css.includes('--cyan:#65e6ff'),'NOVA blue identity missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'reduced-motion fallback missing');
assert(css.includes('pointer-events:none'),'visual-only side cores must not capture input');
assert(css.includes('The side cores are visual-only in v177 and do not grant new authority.'),'authority boundary marker missing');

const before=css.indexOf('.core-stage::before{');
const after=css.indexOf('.core-stage::after{');
const center=css.indexOf('.core{\n');
assert(before>=0&&after>=0&&center>=0,'tri-core structure missing');

assert.strictEqual(tri.classify('YouTube short hazırla'),'jarvis','execution request should select JARVIS');
assert.strictEqual(tri.classify('Bu fikir mantıklı mı, riskleri değerlendir'),'nova','advisory request should select NOVA');
assert.strictEqual(tri.classify("Bu memory leak'in kök nedenini teknik olarak analiz et"),'orion','deep technical request should select ORION');
assert.strictEqual(tri.classify('Nova, iki seçeneği karşılaştır'),'nova','explicit NOVA selection missing');
assert.strictEqual(tri.classify('Orion uzman modu: güvenlik analizi yap'),'orion','explicit ORION selection missing');
assert.strictEqual(tri.classify('Jarvis: mağaza için ürün taslağı hazırla'),'jarvis','explicit JARVIS execution selection missing');
assert.strictEqual(tri.classify('Jarvis sence bu fikir mantıklı mı?'),'nova','JARVIS address must still allow advisory routing');
assert.strictEqual(tri.classify('Jarvis bu race condition kök nedenini analiz et'),'orion','JARVIS address must still allow specialist routing');

assert.deepStrictEqual(
  [tri.PROFILES.jarvis.color,tri.PROFILES.nova.color,tri.PROFILES.orion.color],
  ['#ff9a2f','#65e6ff','#c65cff'],
  'tri-core color contract changed'
);
assert.strictEqual(tri.PROFILES.jarvis.role,'İCRA');
assert.strictEqual(tri.PROFILES.nova.role,'DANIŞMAN');
assert.strictEqual(tri.PROFILES.orion.role,'UZMAN');
for(const p of Object.values(tri.PROFILES))assert.strictEqual(p.authority,'shared_guardrail_only','role must not gain independent authority');

assert(!/\bfetch\s*\(/.test(routerSource),'presentation router must not call network');
assert(!routerSource.includes('localStorage'),'presentation router must not persist command text locally');
assert(!routerSource.includes('sessionStorage'),'presentation router must not persist command text in session storage');
assert(!/\bexecute\s*[:=(]/i.test(routerSource),'presentation router must not expose execution authority');
assert(!/\bapprove\s*[:=(]/i.test(routerSource),'presentation router must not expose approval authority');
assert(!/\bpublish\s*[:=(]/i.test(routerSource),'presentation router must not expose publish authority');
assert(loaderSource.includes("script.src='/tri-core.js'"),'tri-core browser loader missing');
assert(loaderSource.includes('root.JarvisTriCore.install(root)'),'tri-core install hook missing');
assert(routerSource.includes("doc.body.dataset.jarvisCore=selected.id"),'active role dataset missing');
assert(routerSource.includes('body[data-jarvis-core="orion"]'),'ORION violet active-state style missing');
assert(routerSource.includes('body[data-jarvis-core="nova"]'),'NOVA cyan active-state style missing');
assert(routerSource.includes('body[data-jarvis-core="jarvis"]'),'JARVIS amber active-state style missing');

console.log('TRI-CORE UI + ROLE ROUTER SELFTEST PASS');
