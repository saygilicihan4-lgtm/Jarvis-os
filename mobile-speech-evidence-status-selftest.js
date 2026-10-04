'use strict';
const assert=require('assert/strict');
const chat=require('./public/mobile-language-chat');
const status=require('./public/mobile-speech-evidence-status');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k)}}
(()=>{
  const now=3_000_000,store=storage();
  const unknown=status.summarize('tr-TR',{storage:store,nowMs:now});
  assert.equal(unknown.tts.state,'unknown');assert.equal(unknown.stt.state,'unknown');assert.equal(unknown.preference.saved,false);
  assert.equal(unknown.sttSupportVerified,false);assert.equal(unknown.languageVerified,false);assert.equal(unknown.deviceE2eVerified,false);

  const ttsResult={provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'};
  assert(chat.recordTtsEvidence(store,ttsResult,'tr-TR','tr-TR',now));
  assert(chat.recordSttCaptureEvidence(store,'tr-TR','merhaba dünya',now));
  assert.equal(chat.savePreference(store,'tr-TR'),true);
  const combined=status.summarize('tr-TR',{storage:store,nowMs:now});
  assert.equal(combined.tts.state,'verified');assert.equal(combined.tts.verified,true);
  assert.equal(combined.stt.state,'capture-observed');assert.equal(combined.stt.captureObserved,true);
  assert.equal(combined.stt.sttVerified,false);assert.equal(combined.stt.languageVerified,false);
  assert.equal(combined.preference.saved,true);assert.equal(combined.preference.evidence,'explicit-playback-gated-preference');
  const combinedText=status.format(combined);
  assert(combinedText.includes('TTS ✓ runtime + playback'));
  assert(combinedText.includes('STT capture ◇ gözlendi'));
  assert(combinedText.includes('dil doğruluğu doğrulanmadı'));
  assert(!combinedText.includes('STT ✓'),'capture observation must never become an STT support checkmark');
  assert(!combinedText.includes('dil doğrulandı'),'capture observation must never claim language correctness');

  const negative={ok:false,state:'unsupported',locale:'tr-TR',reason:'tts_locale_not_in_runtime_inventory'};
  assert(chat.recordNegativeTtsEvidence(store,negative,'tr-TR',now+1000));
  const newerNegative=status.summarize('tr-TR',{storage:store,nowMs:now+1000});
  assert.equal(newerNegative.tts.state,'unsupported','newer definite runtime negative must override older positive display state');
  assert.equal(newerNegative.stt.captureObserved,true,'TTS negative must not erase independent STT capture observation');
  assert.equal(newerNegative.preference.saved,true,'TTS runtime status must not rewrite explicit preference state');

  const nlStore=storage();
  const ambiguous={ok:false,state:'unsupported',locale:'nl',reason:'runtime_tts_locale_ambiguous',ttsCandidates:['nl-NL','nl-BE']};
  assert(chat.recordNegativeTtsEvidence(nlStore,ambiguous,'nl',now));
  const nl=status.summarize('nl',{storage:nlStore,nowMs:now});assert.equal(nl.tts.state,'ambiguous');
  assert(status.format(nl).includes('TTS ! bölge belirsiz'));

  const expiredCapture=status.summarize('tr-TR',{storage:store,nowMs:now+chat.STT_CAPTURE_EVIDENCE_TTL_MS+1});
  assert.equal(expiredCapture.stt.state,'unknown','expired STT capture receipt must not remain visible');
  assert.equal(expiredCapture.stt.sttVerified,false);

  chat.savePreference(store,'en-US');
  const preferenceMismatch=status.summarize('tr-TR',{storage:store,nowMs:now+1000});
  assert.equal(preferenceMismatch.preference.saved,false);assert.equal(preferenceMismatch.preference.locale,'en-US');

  const element={textContent:'',dataset:{}};
  const rendered=status.render(element,'tr-TR',{storage:store,nowMs:now+1000});
  assert(rendered);assert.equal(element.dataset.locale,'tr-TR');assert.equal(element.dataset.sttVerified,'false');assert.equal(element.dataset.languageVerified,'false');assert.equal(element.dataset.deviceE2eVerified,'false');
  assert.equal(element.dataset.ttsState,'unsupported');assert.equal(element.dataset.preferenceState,'not-saved');
  assert(!element.textContent.includes('STT ✓'));assert(!element.textContent.includes('dil doğrulandı'));

  assert.equal(status.summarize('../../bad',{storage:store,nowMs:now}),null);
  assert.equal(status.render(null,'tr-TR',{storage:store,nowMs:now}),false);
  console.log('MOBILE SPEECH EVIDENCE STATUS SELFTEST PASS · TTS, STT capture and explicit preference remain separately evidenced with no false STT/language support claim');
})();
