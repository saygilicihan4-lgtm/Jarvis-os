'use strict';
const assert=require('assert/strict');
const chat=require('./public/mobile-language-chat');
const status=require('./public/mobile-speech-evidence-status');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k)}}
(()=>{
  const now=3_000_000,store=storage();
  const unknown=status.summarize('tr-TR',{storage:store,nowMs:now});
  assert.equal(unknown.tts.state,'unknown');assert.equal(unknown.tts.freshness,null);assert.equal(unknown.stt.state,'unknown');assert.equal(unknown.stt.freshness,null);assert.equal(unknown.preference.saved,false);
  assert.equal(unknown.sttSupportVerified,false);assert.equal(unknown.preferenceProvenanceVerified,false);assert.equal(unknown.languageVerified,false);assert.equal(unknown.deviceE2eVerified,false);

  const ttsResult={provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'};
  const positiveReceipt=chat.recordTtsEvidence(store,ttsResult,'tr-TR','tr-TR',now);
  const captureReceipt=chat.recordSttCaptureEvidence(store,'tr-TR','merhaba dünya',now);
  assert(positiveReceipt);assert(captureReceipt);
  assert.equal(chat.savePreference(store,'tr-TR'),true);
  const combined=status.summarize('tr-TR',{storage:store,nowMs:now});
  assert.equal(combined.tts.state,'verified');assert.equal(combined.tts.verified,true);
  assert.equal(combined.tts.freshness.observedAt,positiveReceipt.verifiedAt);assert.equal(combined.tts.freshness.expiresAt,positiveReceipt.expiresAt);assert.equal(combined.tts.freshness.remainingMs,positiveReceipt.expiresAt-now);assert.equal(combined.tts.freshness.temporary,true);
  assert.equal(combined.stt.state,'capture-observed');assert.equal(combined.stt.captureObserved,true);
  assert.equal(combined.stt.freshness.observedAt,captureReceipt.capturedAt);assert.equal(combined.stt.freshness.expiresAt,captureReceipt.expiresAt);assert.equal(combined.stt.freshness.remainingMs,chat.STT_CAPTURE_EVIDENCE_TTL_MS);assert.equal(combined.stt.freshness.temporary,true);
  assert.equal(combined.stt.sttVerified,false);assert.equal(combined.stt.languageVerified,false);
  assert.equal(combined.preference.saved,true);assert.equal(combined.preference.evidence,'device-local-locale-preference');assert.equal(combined.preference.provenanceVerified,false);
  const combinedText=status.format(combined);
  assert(combinedText.includes('TTS ✓ runtime + playback · geçici kanıt'));
  assert(combinedText.includes('STT capture ◇ gözlendi · geçici kanıt'));
  assert(combinedText.includes('dil doğruluğu doğrulanmadı'));
  assert(combinedText.includes('Tercih ◇ cihazda kayıtlı · provenance doğrulanmadı'));
  assert(!combinedText.includes('STT ✓'),'capture observation must never become an STT support checkmark');
  assert(!combinedText.includes('dil doğrulandı'),'capture observation must never claim language correctness');
  assert(!combinedText.includes('Tercih ✓ açık seçim + playback'),'locale-only storage must not fabricate preference provenance');

  const negative={ok:false,state:'unsupported',locale:'tr-TR',reason:'tts_locale_not_in_runtime_inventory'};
  const negativeReceipt=chat.recordNegativeTtsEvidence(store,negative,'tr-TR',now+1000);
  assert(negativeReceipt);
  const newerNegative=status.summarize('tr-TR',{storage:store,nowMs:now+1000});
  assert.equal(newerNegative.tts.state,'unsupported','newer definite runtime negative must override older positive display state');
  assert.equal(newerNegative.tts.freshness.observedAt,negativeReceipt.observedAt);assert.equal(newerNegative.tts.freshness.expiresAt,negativeReceipt.expiresAt);assert.equal(newerNegative.tts.freshness.remainingMs,negativeReceipt.expiresAt-(now+1000));
  assert.equal(newerNegative.stt.captureObserved,true,'TTS negative must not erase independent STT capture observation');
  assert.equal(newerNegative.preference.saved,true,'TTS runtime status must not rewrite device-local preference state');
  assert.equal(newerNegative.preference.provenanceVerified,false,'stored locale alone must never prove explicit/playback provenance');

  const nlStore=storage();
  const ambiguous={ok:false,state:'unsupported',locale:'nl',reason:'runtime_tts_locale_ambiguous',ttsCandidates:['nl-NL','nl-BE']};
  const ambiguousReceipt=chat.recordNegativeTtsEvidence(nlStore,ambiguous,'nl',now);
  assert(ambiguousReceipt);
  const nl=status.summarize('nl',{storage:nlStore,nowMs:now});assert.equal(nl.tts.state,'ambiguous');assert(nl.tts.freshness);
  assert(status.format(nl).includes('TTS ! bölge belirsiz · geçici kanıt'));

  const ttlStore=storage();
  const ttlReceipt=chat.recordSttCaptureEvidence(ttlStore,'tr-TR','yalnız ttl testi',now);
  assert(ttlReceipt);
  const atExpiry=status.summarize('tr-TR',{storage:ttlStore,nowMs:ttlReceipt.expiresAt});
  assert.equal(atExpiry.stt.state,'capture-observed','receipt remains valid at the exact expiry boundary');
  assert.equal(atExpiry.stt.freshness.remainingMs,0,'exact expiry boundary must expose zero remaining lifetime');
  const expiredCapture=status.summarize('tr-TR',{storage:ttlStore,nowMs:ttlReceipt.expiresAt+1});
  assert.equal(expiredCapture.stt.state,'unknown','expired STT capture receipt must not remain visible');
  assert.equal(expiredCapture.stt.freshness,null,'expired STT capture must not keep stale freshness metadata');
  assert.equal(expiredCapture.stt.sttVerified,false);

  chat.savePreference(store,'en-US');
  const preferenceMismatch=status.summarize('tr-TR',{storage:store,nowMs:now+1000});
  assert.equal(preferenceMismatch.preference.saved,false);assert.equal(preferenceMismatch.preference.locale,'en-US');assert.equal(preferenceMismatch.preference.provenanceVerified,false);

  const element={textContent:'',dataset:{}};
  const rendered=status.render(element,'tr-TR',{storage:store,nowMs:now+1000});
  assert(rendered);assert.equal(element.dataset.locale,'tr-TR');assert.equal(element.dataset.sttVerified,'false');assert.equal(element.dataset.preferenceProvenanceVerified,'false');assert.equal(element.dataset.languageVerified,'false');assert.equal(element.dataset.deviceE2eVerified,'false');
  assert.equal(element.dataset.ttsState,'unsupported');assert.equal(element.dataset.preferenceState,'not-saved');
  assert.equal(element.dataset.ttsEvidenceObservedAt,String(negativeReceipt.observedAt));assert.equal(element.dataset.ttsEvidenceExpiresAt,String(negativeReceipt.expiresAt));assert.equal(element.dataset.ttsEvidenceRemainingMs,String(negativeReceipt.expiresAt-(now+1000)));
  assert.equal(element.dataset.sttEvidenceObservedAt,String(captureReceipt.capturedAt));assert.equal(element.dataset.sttEvidenceExpiresAt,String(captureReceipt.expiresAt));assert.equal(element.dataset.sttEvidenceRemainingMs,String(captureReceipt.expiresAt-(now+1000)));
  assert(!element.textContent.includes('STT ✓'));assert(!element.textContent.includes('dil doğrulandı'));assert(!element.textContent.includes('Tercih ✓ açık seçim + playback'));

  const ttlElement={textContent:'',dataset:{}};
  status.render(ttlElement,'tr-TR',{storage:storage(),nowMs:now});
  assert.equal(ttlElement.dataset.sttEvidenceObservedAt,'');assert.equal(ttlElement.dataset.sttEvidenceExpiresAt,'');assert.equal(ttlElement.dataset.sttEvidenceRemainingMs,'','unknown state must actively clear stale freshness dataset fields');

  assert.deepEqual(status.freshnessFor({verifiedAt:now,expiresAt:now+10},now+5),{observedAt:now,expiresAt:now+10,remainingMs:5,temporary:true});
  assert.equal(status.freshnessFor({verifiedAt:now+1,expiresAt:now+10},now),null,'future evidence must never gain freshness metadata');
  assert.equal(status.freshnessFor({verifiedAt:now,expiresAt:now-1},now),null,'expired evidence must never gain freshness metadata');
  assert.equal(status.freshnessFor({transcript:'secret',capturedAt:now,expiresAt:now+10},now).remainingMs,10,'freshness metadata must depend only on timestamps, never transcript contents');

  assert.equal(status.summarize('../../bad',{storage:store,nowMs:now}),null);
  assert.equal(status.render(null,'tr-TR',{storage:store,nowMs:now}),false);
  console.log('MOBILE SPEECH EVIDENCE STATUS SELFTEST PASS · temporary TTS/STT freshness is explicit, stale dataset fields clear, and no STT/language/preference provenance overclaim is introduced');
})();
