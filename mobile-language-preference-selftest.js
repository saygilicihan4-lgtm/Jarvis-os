'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const pref=require('./jarvis-mobile-language-preference');
const mobile=require('./public/mobile-language-chat');

(()=>{
  let now=100000;
  const explicit=pref.deriveFromProfile({explicitLocale:'de-de',learnedLocale:'tr-TR'},{ok:true,locale:'de-DE',voice:'de-DE-ConradNeural',provider:'edge-tts'},{now:()=>now});
  assert.equal(explicit.locale,'de-DE');assert.equal(explicit.source,'explicit');assert.equal(explicit.usable,true);assert.equal(explicit.phoneSttVerified,false);assert.equal(explicit.learningOnPhone,false);
  const learned=pref.deriveFromProfile({learnedLocale:'ja-JP'},{ok:true,locale:'ja-JP',voice:'ja-JP-KeitaNeural',provider:'edge-tts'},{now:()=>now});
  assert.equal(learned.locale,'ja-JP');assert.equal(learned.source,'learned');assert.equal(learned.usable,true);
  const unsupported=pref.deriveFromProfile({learnedLocale:'fr-FR'},{ok:false,locale:'fr-FR',reason:'tts_locale_not_in_runtime_inventory'},{now:()=>now});
  assert.equal(unsupported.locale,'fr-FR');assert.equal(unsupported.usable,false);assert.equal(unsupported.voice,null);
  const none=pref.deriveFromProfile({}, {}, {now:()=>now});
  assert.equal(none.locale,null);assert.equal(none.source,'none');assert.equal(none.usable,false);

  const accepted=pref.acceptWorkerSnapshot(explicit,'worker-a',{now:()=>now});
  assert.equal(accepted.ok,true);assert.equal(accepted.snapshot.workerId,'worker-a');assert.equal(accepted.snapshot.phoneSttVerified,false);
  assert.deepEqual(pref.acceptWorkerSnapshot({source:'learned',locale:'en-US',usable:true,voice:null,provider:'edge-tts'},'worker-a',{now:()=>now}),{ok:false,reason:'usable_preference_requires_voice_proof'});
  assert.equal(pref.publicSnapshot(accepted.snapshot,{now:()=>now+1000}).available,true);
  assert.equal(pref.publicSnapshot(accepted.snapshot,{now:()=>now+50000}).available,false);
  assert.equal(pref.publicSnapshot(accepted.snapshot,{now:()=>now+50000}).reason,'stale');

  const publicExplicit=pref.publicSnapshot(accepted.snapshot,{now:()=>now+1000});
  assert.equal(mobile.selectInitialLocale({current:'tr-TR',preference:publicExplicit}),'de-DE');
  assert.equal(mobile.selectInitialLocale({current:'tr-TR',preference:publicExplicit,sessionLocked:true}),'tr-TR');
  assert.equal(mobile.selectInitialLocale({current:'tr-TR',preference:{...publicExplicit,usable:false}}),'tr-TR');
  assert.equal(mobile.selectInitialLocale({current:'tr-TR',preference:{...publicExplicit,phoneSttVerified:true}}),'tr-TR');
  assert.equal(mobile.selectInitialLocale({current:'tr-TR',preference:{...publicExplicit,source:'system'}}),'tr-TR');

  const moduleText=fs.readFileSync('jarvis-mobile-language-preference.js','utf8');
  const server=fs.readFileSync('server.js','utf8'),worker=fs.readFileSync('worker.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
  assert(!moduleText.includes('.observe('),'preference bridge must never learn from phone observations');
  assert(server.includes('mobileLanguagePreference:null'),'server must keep one bounded preference snapshot, not a growing history');
  assert(server.includes("pathname==='/api/mobile-language-preference'"),'phone must have a read-only preference endpoint');
  assert(server.includes("pathname==='/api/worker/mobile-language-preference'"),'worker must publish preference evidence');
  assert(server.includes('state.mobileLanguageRequests.delete(id)'),'mobile language relay queue must be garbage-collected');
  assert(worker.includes("require('./jarvis-language-learning')"),'worker must read the existing gated PC language profile');
  assert(worker.includes('languageLearning.load(WORKSPACE)'),'worker must read, not relearn, the PC profile');
  assert(worker.includes('mobileTtsVoiceRouter.resolve(locale)'),'worker must gate the synced locale on exact runtime TTS inventory');
  assert(worker.includes('publishMobileLanguagePreference'),'worker must publish a bounded preference snapshot');
  assert(html.includes('syncMobileLanguagePreference'),'phone UI must consume the read-only preference before first mobile conversation');
  assert(html.includes('mobileLanguageSessionLocked=true'),'phone session must stop remote preference overrides once conversation starts');
  assert(html.includes('JarvisMobileLanguageChat.selectInitialLocale'),'phone must use proof-gated preference selection');
  console.log('MOBILE LANGUAGE PREFERENCE SELFTEST PASS · read-only PC profile sync, exact TTS proof, freshness gate, session lock, no phone learning');
})();
