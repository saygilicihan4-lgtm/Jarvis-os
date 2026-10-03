'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
function listMock(){
  const children=[];
  const doc={createElement:()=>({value:'',label:''})};
  return{ownerDocument:doc,children,get firstChild(){return children[0]||null},removeChild(node){const i=children.indexOf(node);if(i>=0)children.splice(i,1)},appendChild(node){children.push(node)}};
}
(async()=>{
  const now=1_000_000,store=storage();
  const exact={provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'};
  const bare={provider:'edge-tts',voice:'nl-NL-ColetteNeural',localeResolution:'unique_runtime_language_match',speechEvidence:'runtime_inventory'};

  const recorded=mobile.recordTtsEvidence(store,exact,'tr-TR','tr-TR',now);
  assert(recorded);assert.equal(recorded.requestedLocale,'tr-TR');assert.equal(recorded.ttsVerified,true);assert.equal(recorded.sttVerified,false);
  assert.equal(recorded.evidence,'runtime_inventory_plus_playback');assert.equal(recorded.expiresAt-now,mobile.TTS_EVIDENCE_TTL_MS);
  assert.equal(mobile.getTtsEvidence('tr-TR',store,now+mobile.TTS_EVIDENCE_TTL_MS)?.voice,'tr-TR-AhmetNeural','receipt remains valid through exact TTL boundary');
  assert.equal(mobile.getTtsEvidence('tr-TR',store,now+mobile.TTS_EVIDENCE_TTL_MS+1),null,'expired receipt must fail closed');
  assert.equal(store.getItem(mobile.TTS_EVIDENCE_KEY),null,'expired evidence should be purged');

  const bareStore=storage();
  assert(mobile.recordTtsEvidence(bareStore,bare,'nl','nl-NL',now),'unique runtime bare-language mapping may be recorded');
  assert.equal(mobile.getTtsEvidence('nl',bareStore,now).ttsLocale,'nl-NL');
  assert.equal(mobile.recordTtsEvidence(bareStore,bare,'nl-BE','nl-NL',now),null,'regional substitution must never become positive evidence');
  assert.equal(mobile.recordTtsEvidence(bareStore,{...bare,speechEvidence:'config'},'nl','nl-NL',now),null,'non-runtime inventory evidence must be rejected');
  assert.equal(mobile.recordTtsEvidence(bareStore,{...bare,provider:'windows-sapi'},'nl','nl-NL',now),null,'mobile Edge relay receipt cannot be forged from another provider');

  const negativeStore=storage();
  const unsupportedReply={ok:false,state:'unsupported',reason:'tts_locale_not_in_runtime_inventory',locale:'fr-FR'};
  const unsupportedEvidence=mobile.recordNegativeTtsEvidence(negativeStore,unsupportedReply,'fr-FR',now);
  assert(unsupportedEvidence);assert.equal(unsupportedEvidence.state,'unsupported');assert.equal(unsupportedEvidence.ttsVerified,false);assert.equal(unsupportedEvidence.sttVerified,false);
  assert.equal(unsupportedEvidence.evidence,'unsupported_runtime_response');assert.equal(unsupportedEvidence.expiresAt-now,mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS);
  assert.deepEqual(unsupportedEvidence.ttsCandidates,[]);assert.equal('transcript' in unsupportedEvidence,false);assert.equal('reply' in unsupportedEvidence,false);
  assert(mobile.getNegativeTtsEvidence('fr-FR',negativeStore,now+mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS),'negative evidence remains valid through exact TTL boundary');
  assert.equal(mobile.getNegativeTtsEvidence('fr-FR',negativeStore,now+mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS+1),null,'negative evidence expires after one minute');
  assert.equal(negativeStore.getItem(mobile.TTS_NEGATIVE_EVIDENCE_KEY),null,'expired negative evidence should be purged');

  const ambiguousEvidenceStore=storage();
  const ambiguousReply={ok:false,state:'unsupported',reason:'runtime_tts_locale_ambiguous',locale:'nl',ttsCandidates:['nl-NL','nl-BE','de-DE','../../bad','nl-NL']};
  const ambiguousEvidence=mobile.recordNegativeTtsEvidence(ambiguousEvidenceStore,ambiguousReply,'nl',now);
  assert(ambiguousEvidence);assert.equal(ambiguousEvidence.state,'ambiguous');assert.deepEqual(ambiguousEvidence.ttsCandidates,['nl-BE','nl-NL']);
  assert.equal(mobile.recordNegativeTtsEvidence(ambiguousEvidenceStore,{...ambiguousReply,ttsCandidates:['nl-NL']},'nl',now),null,'ambiguity requires at least two valid same-language runtime candidates');
  assert.equal(mobile.recordNegativeTtsEvidence(ambiguousEvidenceStore,{...ambiguousReply,locale:'nl-BE'},'nl-BE',now),null,'region-bearing locale cannot be stored as ambiguous bare-language evidence');

  const negativeTamper=storage({[mobile.TTS_NEGATIVE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'fr-FR',reason:'tts_locale_not_in_runtime_inventory',observedAt:now,expiresAt:now+123}])});
  assert.deepEqual(mobile.readNegativeTtsEvidence(negativeTamper,now),[],'tampered negative TTL is rejected');assert.equal(negativeTamper.getItem(mobile.TTS_NEGATIVE_EVIDENCE_KEY),null);
  const negativeFuture=storage({[mobile.TTS_NEGATIVE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'fr-FR',reason:'tts_locale_not_in_runtime_inventory',observedAt:now+1,expiresAt:now+1+mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS}])});
  assert.deepEqual(mobile.readNegativeTtsEvidence(negativeFuture,now),[],'future-dated negative evidence is rejected');

  const tampered=storage({[mobile.TTS_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',ttsLocale:'tr-TR',provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',verifiedAt:now,expiresAt:now+123}])});
  assert.deepEqual(mobile.readTtsEvidence(tampered,now),[],'tampered positive TTL is rejected');assert.equal(tampered.getItem(mobile.TTS_EVIDENCE_KEY),null);
  const future=storage({[mobile.TTS_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',ttsLocale:'tr-TR',provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',verifiedAt:now+1,expiresAt:now+1+mobile.TTS_EVIDENCE_TTL_MS}])});
  assert.deepEqual(mobile.readTtsEvidence(future,now),[],'future-dated positive evidence is rejected');

  const failedStore=storage();
  const failed=mobile.createClient({storage:failedStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{throw new Error('autoplay_blocked')}});
  const failedResult=await failed.run({locale:'tr-TR'});assert.equal(failedResult.ok,false);assert.deepEqual(mobile.readTtsEvidence(failedStore,now),[],'failed playback must not create positive evidence');assert.deepEqual(mobile.readNegativeTtsEvidence(failedStore,now),[],'failed playback must not create negative evidence');

  const successStore=storage();let played=0;
  const success=mobile.createClient({storage:successStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{played++}});
  const successResult=await success.run({locale:'tr-TR'});assert.equal(successResult.state,'completed');assert.equal(played,1);assert.equal(successResult.runtimeTtsVerified,true);assert.equal(successResult.sttVerified,false);
  assert.equal(success.runtimeTtsEvidence.length,1);assert.equal(success.selectLocale('tr-TR').runtimeTtsEvidence.ttsVerified,true,'fresh positive evidence may be surfaced on explicit selection');
  success.forgetPreference();

  assert.equal(mobile.shouldInvalidateTtsEvidence('tts_locale_not_in_runtime_inventory'),true);
  assert.equal(mobile.shouldInvalidateTtsEvidence('runtime_tts_locale_ambiguous'),true);
  assert.equal(mobile.shouldInvalidateTtsEvidence('runtime_voice_missing'),false);
  assert.equal(mobile.shouldInvalidateTtsEvidence('runtime_voice_inventory_unavailable'),false);
  assert.equal(mobile.shouldInvalidateTtsEvidence('runtime_voice_inventory_invalid'),false);
  assert.equal(mobile.shouldInvalidateTtsEvidence('network_down'),false);
  assert.equal(mobile.shouldInvalidateTtsEvidence('autoplay_blocked'),false);
  assert.equal(mobile.shouldInvalidateTtsEvidence('mobile_language_cancelled'),false);

  const rejectedStore=storage();assert(mobile.recordTtsEvidence(rejectedStore,exact,'tr-TR','tr-TR',now));
  const rejected=mobile.createClient({storage:rejectedStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:false,state:'unsupported',reason:'tts_locale_not_in_runtime_inventory',locale:data.locale}),play:async()=>{throw new Error('play_must_not_run')}});
  const rejectedResult=await rejected.run({locale:'tr-TR'});
  assert.equal(rejectedResult.ok,false);assert.equal(rejectedResult.error,'tts_locale_not_in_runtime_inventory');assert.equal(rejectedResult.runtimeTtsEvidenceInvalidated,true);
  assert.equal(mobile.getTtsEvidence('tr-TR',rejectedStore,now),null,'unsupported runtime response must remove stale positive receipt');
  assert.equal(rejectedResult.runtimeTtsNegativeEvidence.state,'unsupported');assert(mobile.getNegativeTtsEvidence('tr-TR',rejectedStore,now),'definitive unsupported response creates short-lived negative receipt');

  const ambiguousStore=storage();assert(mobile.recordTtsEvidence(ambiguousStore,bare,'nl','nl-NL',now));
  const ambiguous=mobile.createClient({storage:ambiguousStore,now:()=>now,capture:async()=> 'hallo',request:async data=>({ok:false,state:'unsupported',reason:'runtime_tts_locale_ambiguous',locale:data.locale,ttsCandidates:['nl-NL','nl-BE']}),play:async()=>{}});
  const ambiguousResult=await ambiguous.run({locale:'nl'});
  assert.equal(ambiguousResult.runtimeTtsEvidenceInvalidated,true);assert.equal(mobile.getTtsEvidence('nl',ambiguousStore,now),null,'runtime ambiguity revokes prior unique-language evidence');
  assert.equal(ambiguousResult.runtimeTtsNegativeEvidence.state,'ambiguous');assert.deepEqual(ambiguousResult.runtimeTtsNegativeEvidence.ttsCandidates,['nl-BE','nl-NL']);
  const ambiguousSelection=ambiguous.selectLocale('nl');assert.equal(ambiguousSelection.runtimeTtsNegativeEvidence.state,'ambiguous');assert.deepEqual(ambiguousSelection.runtimeTtsNegativeEvidence.ttsCandidates,['nl-BE','nl-NL']);ambiguous.forgetPreference();

  const recoveredStore=storage();assert(mobile.recordNegativeTtsEvidence(recoveredStore,unsupportedReply,'fr-FR',now));
  const recovered=mobile.createClient({storage:recoveredStore,now:()=>now+1000,capture:async()=> 'bonjour',request:async data=>({ok:true,state:'reply-ready',reply:'Bonjour.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'fr-FR-DeniseNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{}});
  const recoveredResult=await recovered.run({locale:'fr-FR'});assert.equal(recoveredResult.state,'completed');assert(recoveredResult.runtimeTtsEvidence,'successful runtime playback writes new positive evidence');assert.equal(mobile.getNegativeTtsEvidence('fr-FR',recoveredStore,now+1000),null,'successful positive evidence clears prior negative receipt');
  assert(mobile.getTtsEvidence('fr-FR',recoveredStore,now+1000),'positive receipt exists after recovery');

  const networkStore=storage();assert(mobile.recordTtsEvidence(networkStore,exact,'tr-TR','tr-TR',now));
  const network=mobile.createClient({storage:networkStore,now:()=>now,capture:async()=> 'merhaba',request:async()=>{throw new Error('network_down')},play:async()=>{}});
  const networkResult=await network.run({locale:'tr-TR'});
  assert.equal(networkResult.runtimeTtsEvidenceInvalidated,false);assert.equal(networkResult.runtimeTtsNegativeEvidence,null);assert(mobile.getTtsEvidence('tr-TR',networkStore,now),'temporary network failure must preserve prior positive evidence');

  const forgedReasonStore=storage();assert(mobile.recordTtsEvidence(forgedReasonStore,exact,'tr-TR','tr-TR',now));
  const forgedReason=mobile.createClient({storage:forgedReasonStore,now:()=>now,capture:async()=> 'merhaba',request:async()=>{throw new Error('tts_locale_not_in_runtime_inventory')},play:async()=>{}});
  const forgedReasonResult=await forgedReason.run({locale:'tr-TR'});
  assert.equal(forgedReasonResult.runtimeTtsEvidenceInvalidated,false);assert.equal(forgedReasonResult.runtimeTtsNegativeEvidence,null);assert(mobile.getTtsEvidence('tr-TR',forgedReasonStore,now),'matching error text without unsupported runtime provenance must preserve evidence');

  const inventoryStore=storage();assert(mobile.recordTtsEvidence(inventoryStore,exact,'tr-TR','tr-TR',now));
  const inventory=mobile.createClient({storage:inventoryStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:false,state:'unsupported',reason:'runtime_voice_inventory_unavailable',locale:data.locale}),play:async()=>{}});
  const inventoryResult=await inventory.run({locale:'tr-TR'});
  assert.equal(inventoryResult.runtimeTtsEvidenceInvalidated,false);assert.equal(inventoryResult.runtimeTtsNegativeEvidence,null);assert(mobile.getTtsEvidence('tr-TR',inventoryStore,now),'temporary inventory probe failure must preserve prior positive evidence');

  const autoplayStore=storage();assert(mobile.recordTtsEvidence(autoplayStore,exact,'tr-TR','tr-TR',now));
  const autoplay=mobile.createClient({storage:autoplayStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{throw new Error('autoplay_blocked')}});
  const autoplayResult=await autoplay.run({locale:'tr-TR'});
  assert.equal(autoplayResult.runtimeTtsEvidenceInvalidated,false);assert.equal(autoplayResult.runtimeTtsNegativeEvidence,null);assert(mobile.getTtsEvidence('tr-TR',autoplayStore,now),'autoplay failure is not negative runtime capability evidence');

  const cancelStore=storage();assert(mobile.recordTtsEvidence(cancelStore,exact,'tr-TR','tr-TR',now));let cancelSeen=false;
  const cancel=mobile.createClient({storage:cancelStore,now:()=>now,capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{cancelSeen=true;reject(new Error('capture_aborted'))},{once:true})),request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const pendingCancel=cancel.run({locale:'tr-TR'});await new Promise(resolve=>setTimeout(resolve,5));cancel.cancel();const cancelResult=await pendingCancel;
  assert.equal(cancelSeen,true);assert.equal(cancelResult.cancelled,true);assert.equal(cancelResult.runtimeTtsEvidenceInvalidated,false);assert.equal(cancelResult.runtimeTtsNegativeEvidence,null);assert(mobile.getTtsEvidence('tr-TR',cancelStore,now),'user cancellation preserves prior positive evidence');

  const emptyList=listMock();mobile.renderLocaleOptions(emptyList,storage(),now);
  assert(emptyList.children.length===mobile.COMMON_LOCALES.length);assert(emptyList.children.every(x=>x.label.includes('TTS ?')),'static suggestions must not be presented as supported');
  const verifiedList=listMock();mobile.renderLocaleOptions(verifiedList,successStore,now);
  const tr=verifiedList.children.find(x=>x.value==='tr-TR');assert(tr&&tr.label.includes('TTS ✓ son 5 dk'),'fresh positive receipt may be shown as recently verified');
  const en=verifiedList.children.find(x=>x.value==='en-US');assert(en&&en.label.includes('TTS ?'),'unverified locale stays unknown');
  const unsupportedListStore=storage();assert(mobile.recordNegativeTtsEvidence(unsupportedListStore,{ok:false,state:'unsupported',reason:'tts_locale_not_in_runtime_inventory'},'fr-FR',now));
  const unsupportedList=listMock();mobile.renderLocaleOptions(unsupportedList,unsupportedListStore,now);
  const fr=unsupportedList.children.find(x=>x.value==='fr-FR');assert(fr&&fr.label.includes('TTS ✕ son 1 dk')&&fr.label.includes('runtime desteklemiyor'),'fresh definitive unsupported state is distinct from unknown');

  console.log('MOBILE RUNTIME CATALOG SELFTEST PASS · positive/negative TTS evidence is provenance-bound, TTL-limited, mutually clearing, and ambiguity is distinct from unsupported');
})().catch(error=>{console.error(error);process.exitCode=1});
