'use strict';

const fs=require('fs');
const assert=require('assert');
const tri=require('./public/tri-core.js');
const personality=require('./jarvis-tri-core-personality.js');
const webgl=require('./public/tri-core-webgl.js');

const css=fs.readFileSync('public/style.css','utf8');
const routerSource=fs.readFileSync('public/tri-core.js','utf8');
const personalitySource=fs.readFileSync('jarvis-tri-core-personality.js','utf8');
const webglSource=fs.readFileSync('public/tri-core-webgl.js','utf8');
const loaderSource=fs.readFileSync('public/language-chat.js','utf8');
const outputSource=fs.readFileSync('jarvis-language-turn-output.js','utf8');
const desktopConversationSource=fs.readFileSync('jarvis-language-conversation.js','utf8');
const mobileConversationSource=fs.readFileSync('jarvis-mobile-language-conversation.js','utf8');

assert(css.includes('v177 TRI-CORE VISUAL SHELL'),'tri-core marker missing');
assert(css.includes('content:"NOVA\\A DANIŞMAN"'),'NOVA advisor core missing');
assert(css.includes('content:"ORION\\A UZMAN"'),'ORION specialist core missing');
assert(css.includes('--amber:#ff9a2f'),'JARVIS amber identity missing');
assert(css.includes('--violet:#c65cff'),'ORION violet identity missing');
assert(css.includes('--cyan:#65e6ff'),'NOVA blue identity missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'base reduced-motion fallback missing');
assert(css.includes('pointer-events:none'),'visual-only side cores must not capture input');
assert(css.includes('The side cores are visual-only in v177 and do not grant new authority.'),'authority boundary marker missing');

assert.strictEqual(tri.classify('YouTube short hazırla'),'jarvis','execution request should select JARVIS');
assert.strictEqual(tri.classify('Bu fikir mantıklı mı, riskleri değerlendir'),'nova','advisory request should select NOVA');
assert.strictEqual(tri.classify("Bu memory leak'in kök nedenini teknik olarak analiz et"),'orion','deep technical request should select ORION');
assert.strictEqual(tri.classify('Nova, iki seçeneği karşılaştır'),'nova','explicit NOVA selection missing');
assert.strictEqual(tri.classify('Orion uzman modu: güvenlik analizi yap'),'orion','explicit ORION selection missing');
assert.strictEqual(tri.classify('Jarvis: mağaza için ürün taslağı hazırla'),'jarvis','explicit JARVIS selection missing');
assert.strictEqual(tri.classify('Jarvis sence bu fikir mantıklı mı?'),'jarvis','explicit JARVIS must override automatic advisory routing');
assert.strictEqual(tri.classify('Jarvis bu race condition kök nedenini analiz et'),'jarvis','explicit JARVIS must override automatic specialist routing');
assert.strictEqual(tri.inferState('VOICE: LOCAL STT LISTENING'),'listening');
assert.strictEqual(tri.inferState('mission running'),'working');
assert.strictEqual(tri.inferState('analysis failed'),'error');
assert(tri.STATES.includes('thinking')&&tri.STATES.includes('speaking')&&tri.STATES.includes('waiting'),'reactive state contract incomplete');

assert.deepStrictEqual(
  [tri.PROFILES.jarvis.color,tri.PROFILES.nova.color,tri.PROFILES.orion.color],
  ['#ff9a2f','#65e6ff','#c65cff'],
  'tri-core color contract changed'
);
for(const p of Object.values(tri.PROFILES))assert.strictEqual(p.authority,'shared_guardrail_only','UI role must not gain independent authority');
for(const p of Object.values(personality.PROFILES))assert.strictEqual(p.authority,'shared_guardrail_only','conversation role must not gain independent authority');

const directNova=personality.select('Nova, iki seçeneği riskleriyle karşılaştır');
assert.strictEqual(directNova.core,'nova');assert.strictEqual(directNova.source,'explicit');assert(!/^nova\b/i.test(directNova.cleanText),'explicit persona prefix should be stripped before model input');
const directJarvis=personality.select('Jarvis, bu race condition kök nedenini incele');
assert.strictEqual(directJarvis.core,'jarvis');assert(directJarvis.consultWith.includes('orion'),'explicit JARVIS may consult ORION lens without changing authority');
const autoOrion=personality.select('Stack trace ve memory leak için derin teknik analiz yap');
assert.strictEqual(autoOrion.core,'orion');assert.strictEqual(autoOrion.source,'automatic');
const autoNova=personality.select('Sence iki alternatiften hangisi daha mantıklı?');assert.strictEqual(autoNova.core,'nova');
const autoJarvis=personality.select('YouTube taslağı hazırla ve görevi başlat');assert.strictEqual(autoJarvis.core,'jarvis');
const prompt=personality.promptFor(directJarvis,'tr-TR');
assert(prompt.includes('not independent agents'),'prompt must deny independent-agent authority');
assert(prompt.includes('one Mission Engine, Worker and approval/authorization chain'),'shared authority chain missing from prompt');
assert(prompt.includes('conversation channel has no tools or computer actions'),'conversation tool boundary missing');
assert(prompt.includes('ORION (UZMAN)'),'consultation lens missing from generated prompt');

assert(!/\bfetch\s*\(/.test(routerSource),'presentation router must not call network');
assert(!routerSource.includes('localStorage'),'presentation router must not persist command text locally');
assert(!routerSource.includes('sessionStorage'),'presentation router must not persist command text in session storage');
assert(!/\bexecute\s*[:=(]/i.test(routerSource),'presentation router must not expose execution authority');
assert(!/\bapprove\s*[:=(]/i.test(routerSource),'presentation router must not expose approval authority');
assert(!/\bfetch\s*\(/.test(personalitySource),'personality selector must stay local/pure');
assert(!personalitySource.includes('localStorage')&&!personalitySource.includes('sessionStorage'),'personality selector must not persist user text');
assert(outputSource.includes("require('./jarvis-tri-core-personality')"),'local conversation output must use tri-core personality contract');
assert(desktopConversationSource.includes('tri_core_contract_mismatch'),'desktop conversation must fail closed on role contract mismatch');
assert(mobileConversationSource.includes('tri_core_contract_mismatch'),'mobile conversation must fail closed on role contract mismatch');
assert(desktopConversationSource.includes("authority:'shared_guardrail_only'"),'desktop result authority marker missing');
assert(mobileConversationSource.includes("authority:'shared_guardrail_only'"),'mobile result authority marker missing');

assert(loaderSource.includes("script.src='/tri-core.js'"),'tri-core browser loader missing');
assert(loaderSource.includes("script.src='/tri-core-webgl.js'"),'tri-core WebGL loader missing');
assert(loaderSource.includes('jarvis:conversation-state'),'real conversation state bridge missing');
assert(routerSource.includes('data-jarvis-core-state')||routerSource.includes('jarvisCoreState'),'reactive core state dataset missing');
assert(routerSource.includes('jarvis:conversation-state'),'router must bind real conversation state events');
assert(routerSource.includes("doc.body.dataset.jarvisCore=selected.id"),'active role dataset missing');

assert.strictEqual(typeof webgl.install,'function');assert.strictEqual(typeof webgl.destroy,'function');
assert.deepStrictEqual(webgl.ORDER,['nova','jarvis','orion']);
assert(webglSource.includes("getContext('webgl'"),'native WebGL renderer missing');
assert(webglSource.includes("prefers-reduced-motion: reduce"),'WebGL reduced-motion support missing');
assert(webglSource.includes('deviceMemory')&&webglSource.includes('hardwareConcurrency'),'low-hardware fallback missing');
assert(webglSource.includes('gl.LINE_STRIP'),'multi-layer energy rings missing');
assert(webglSource.includes("['thinking','working']"),'data bridge must be limited to real analysis/work states');
assert(!/\bfetch\s*\(/.test(webglSource),'WebGL renderer must not make network calls');
assert(!webglSource.includes('localStorage')&&!webglSource.includes('sessionStorage'),'WebGL renderer must not persist sensitive state');

console.log('TRI-CORE v179 PERSONALITY + REACTIVE WEBGL SELFTEST PASS');
