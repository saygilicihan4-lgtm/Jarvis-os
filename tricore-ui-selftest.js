'use strict';

const fs=require('fs');
const assert=require('assert');
const tri=require('./public/tri-core.js');
const personality=require('./jarvis-tri-core-personality.js');
const hologram=require('./public/tri-core-hologram.js');

const css=fs.readFileSync('public/style.css','utf8');
const routerSource=fs.readFileSync('public/tri-core.js','utf8');
const personalitySource=fs.readFileSync('jarvis-tri-core-personality.js','utf8');
const deliberationSource=fs.readFileSync('jarvis-tri-core-deliberation.js','utf8');
const hologramSource=fs.readFileSync('public/tri-core-hologram.js','utf8');
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
assert.strictEqual(directJarvis.core,'jarvis');assert(directJarvis.consultWith.includes('orion'),'explicit JARVIS may plan ORION consultation without changing authority');
const autoOrion=personality.select('Stack trace ve memory leak için derin teknik analiz yap');
assert.strictEqual(autoOrion.core,'orion');assert.strictEqual(autoOrion.source,'automatic');
const autoNova=personality.select('Sence iki alternatiften hangisi daha mantıklı?');assert.strictEqual(autoNova.core,'nova');
const autoJarvis=personality.select('YouTube taslağı hazırla ve görevi başlat');assert.strictEqual(autoJarvis.core,'jarvis');
const prompt=personality.promptFor(directJarvis,'tr-TR');
assert(prompt.includes('not independent agents'),'prompt must deny independent-agent authority');
assert(prompt.includes('one Mission Engine, Worker and approval/authorization chain'),'shared authority chain missing from prompt');
assert(prompt.includes('conversation channel has no tools or computer actions'),'conversation tool boundary missing');
assert(prompt.includes('ORION (UZMAN)'),'consultation lens missing from generated prompt');
assert(prompt.includes('when they actually completed'),'prompt must not fabricate consultation completion');

assert(!/\bfetch\s*\(/.test(routerSource),'presentation router must not call network');
assert(!routerSource.includes('localStorage'),'presentation router must not persist command text locally');
assert(!routerSource.includes('sessionStorage'),'presentation router must not persist command text in session storage');
assert(!/\bexecute\s*[:=(]/i.test(routerSource),'presentation router must not expose execution authority');
assert(!/\bapprove\s*[:=(]/i.test(routerSource),'presentation router must not expose approval authority');
assert(!/\bfetch\s*\(/.test(personalitySource),'personality selector must stay local/pure');
assert(!personalitySource.includes('localStorage')&&!personalitySource.includes('sessionStorage'),'personality selector must not persist user text');
assert(outputSource.includes("require('./jarvis-tri-core-deliberation')"),'local conversation output must use real deliberation runtime');
assert(outputSource.includes('deliberator.consult'),'real consultation call missing');
assert(outputSource.includes('advisoryBlock(deliberation.notes)'),'completed advisory notes must feed final synthesis');
assert(deliberationSource.includes('loopback_deliberation_required'),'deliberation loopback gate missing');
assert(deliberationSource.includes('[REDACTED_CODE]'),'session-code redaction missing');
assert(!deliberationSource.includes('localStorage')&&!deliberationSource.includes('sessionStorage'),'deliberation must not persist user input or notes');
assert(!deliberationSource.includes('console.log')&&!deliberationSource.includes('console.error'),'deliberation must not log user input or notes');

assert(desktopConversationSource.includes('const selected=triCore.select(capture.text)'),'desktop conversation must select deterministic tri-core metadata before generation');
assert(mobileConversationSource.includes('const selected=triCore.select(clean)'),'mobile conversation must select deterministic tri-core metadata before generation');
assert(desktopConversationSource.includes('verifiedConsulted(generated,selected)'),'desktop must validate completed consultations against deterministic plan');
assert(mobileConversationSource.includes('verifiedConsulted(generated,selected)'),'mobile must validate completed consultations against deterministic plan');
assert(desktopConversationSource.includes('consultWith:consultedWith'),'desktop UI may show only completed consultations');
assert(mobileConversationSource.includes('consultWith:consultedWith'),'mobile UI may show only completed consultations');
assert(desktopConversationSource.includes("authority:'shared_guardrail_only'"),'desktop result authority marker missing');
assert(mobileConversationSource.includes("authority:'shared_guardrail_only'"),'mobile result authority marker missing');
assert(!/core:generated\.core/.test(desktopConversationSource),'model/output metadata must not choose desktop authority role');
assert(!/core:generated\.core/.test(mobileConversationSource),'model/output metadata must not choose mobile authority role');

assert(loaderSource.includes("script.src='/tri-core.js'"),'tri-core browser loader missing');
assert(!loaderSource.includes('/tri-core-webgl.js'),'duplicate renderer loader must not return');
assert(loaderSource.includes('consultWith'),'conversation state must preserve consultation lenses');
assert(loaderSource.includes('jarvis:conversation-state'),'real conversation state bridge missing');
assert(loaderSource.includes('__jarvisTriCoreMobileBridgeV179'),'mobile tri-core bridge missing');
assert(loaderSource.includes("const ALLOWED=new Set(['jarvis','nova','orion'])"),'mobile bridge must allow only known core IDs');
assert(loaderSource.includes("authority:'shared_guardrail_only'"),'mobile visual bridge must pin shared authority marker');
const mobileBridge=loaderSource.split('// v179 mobile tri-core bridge.')[1].split(";(function(root){\n  'use strict';\n  if(!root||!root.document||!/iPhone|iPad|iPod|Android/i.test")[0];
assert(!/src\.(transcript|reply|text|mission)/.test(mobileBridge),'mobile visual bridge must not copy transcript, reply or mission input');
assert(routerSource.includes('jarvisCoreState'),'reactive core state dataset missing');
assert(routerSource.includes('jarvisCoreCollab'),'consultation collaboration state missing');
assert(routerSource.includes('jarvis:conversation-state'),'router must bind real conversation state events');
assert(routerSource.includes("script.src='/tri-core-hologram.js'"),'single hologram renderer must be owned by tri-core router');
assert(routerSource.includes("doc.body.dataset.jarvisCore=selected.id"),'active role dataset missing');

assert.strictEqual(typeof hologram.install,'function');
assert.deepStrictEqual(hologram.ROLE_INDEX,{nova:0,jarvis:1,orion:2});
assert.deepStrictEqual(hologram.STATE_INDEX,{idle:0,waiting:1,listening:2,thinking:3,speaking:4,working:5,error:6});
assert(hologramSource.includes("getContext('webgl'"),'native WebGL renderer missing');
assert(hologramSource.includes("prefers-reduced-motion: reduce"),'WebGL reduced-motion support missing');
assert(hologramSource.includes('deviceMemory')&&hologramSource.includes('hardwareConcurrency'),'low-hardware fallback missing');
assert(hologramSource.includes('uConsult'),'cross-core data-flow shader input missing');
assert(hologramSource.includes('uState'),'reactive system-state shader input missing');
assert(hologramSource.includes("dataset.jarvisCoreFx='lite'"),'CSS fallback marker missing');
assert(!/\bfetch\s*\(/.test(hologramSource),'WebGL renderer must not make network calls');
assert(!hologramSource.includes('localStorage')&&!hologramSource.includes('sessionStorage'),'WebGL renderer must not persist sensitive state');

require('./tri-core-deliberation-selftest.js');
require('./tri-core-live-state-selftest.js');
console.log('TRI-CORE v181 PERSONALITY + REAL DELIBERATION + LIVE COGNITIVE HOLOGRAM SELFTEST PASS');
