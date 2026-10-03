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
  const recorded=mobile.recordTtsEvidence(store,exact,'tr-TR','tr-TR',now);
  assert(recorded);assert.equal(recorded.requestedLocale,'tr-TR');assert.equal(recorded.ttsVerified,true);assert.equal(recorded.sttVerified,false);
  assert.equal(recorded.evidence,'runtime_inventory_plus_playback');assert.equal(recorded.expiresAt-now,mobile.TTS_EVIDENCE_TTL_MS);
  assert.equal(mobile.getTtsEvidence('tr-TR',store,now+mobile.TTS_EVIDENCE_TTL_MS)?.voice,'tr-TR-AhmetNeural','receipt remains valid through exact TTL boundary');
  assert.equal(mobile.getTtsEvidence('tr-TR',store,now+mobile.TTS_EVIDENCE_TTL_MS+1),null,'expired receipt must fail closed');
  assert.equal(store.getItem(mobile.TTS_EVIDENCE_KEY),null,'expired evidence should be purged');

  const bareStore=storage();
  const bare={provider:'edge-tts',voice:'nl-NL-ColetteNeural',localeResolution:'unique_runtime_language_match',speechEvidence:'runtime_inventory'};
  assert(mobile.recordTtsEvidence(bareStore,bare,'nl','nl-NL',now),'unique runtime bare-language mapping may be recorded');
  assert.equal(mobile.getTtsEvidence('nl',bareStore,now).ttsLocale,'nl-NL');
  assert.equal(mobile.recordTtsEvidence(bareStore,bare,'nl-BE','nl-NL',now),null,'regional substitution must never become evidence');
  assert.equal(mobile.recordTtsEvidence(bareStore,{...bare,speechEvidence:'config'},'nl','nl-NL',now),null,'non-runtime inventory evidence must be rejected');
  assert.equal(mobile.recordTtsEvidence(bareStore,{...bare,provider:'windows-sapi'},'nl','nl-NL',now),null,'mobile Edge relay receipt cannot be forged from another provider');

  const tampered=storage({[mobile.TTS_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',ttsLocale:'tr-TR',provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',verifiedAt:now,expiresAt:now+123}])});
  assert.deepEqual(mobile.readTtsEvidence(tampered,now),[],'tampered TTL is rejected');assert.equal(tampered.getItem(mobile.TTS_EVIDENCE_KEY),null);
  const future=storage({[mobile.TTS_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',ttsLocale:'tr-TR',provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',verifiedAt:now+6000,expiresAt:now+6000+mobile.TTS_EVIDENCE_TTL_MS}])});
  assert.deepEqual(mobile.readTtsEvidence(future,now),[],'future-dated evidence is rejected');

  const failedStore=storage();
  const failed=mobile.createClient({storage:failedStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{throw new Error('autoplay_blocked')}});
  const failedResult=await failed.run({locale:'tr-TR'});assert.equal(failedResult.ok,false);assert.deepEqual(mobile.readTtsEvidence(failedStore,now),[],'failed playback must not create capability evidence');

  const successStore=storage();let played=0;
  const success=mobile.createClient({storage:successStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{played++}});
  const successResult=await success.run({locale:'tr-TR'});assert.equal(successResult.state,'completed');assert.equal(played,1);assert.equal(successResult.runtimeTtsVerified,true);assert.equal(successResult.sttVerified,false);
  assert.equal(success.runtimeTtsEvidence.length,1);assert.equal(success.selectLocale('tr-TR').runtimeTtsEvidence.ttsVerified,true,'fresh evidence may be surfaced on explicit selection');
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
  assert.equal(mobile.getTtsEvidence('tr-TR',rejectedStore,now),null,'explicit unsupported runtime response must immediately remove stale positive receipt');

  const ambiguousStore=storage();assert(mobile.recordTtsEvidence(ambiguousStore,bare,'nl','nl-NL',now));
  const ambiguous=mobile.createClient({storage:ambiguousStore,now:()=>now,capture:async()=> 'hallo',request:async data=>({ok:false,state:'unsupported',reason:'runtime_tts_locale_ambiguous',locale:data.locale}),play:async()=>{}});
  const ambiguousResult=await ambiguous.run({locale:'nl'});
  assert.equal(ambiguousResult.runtimeTtsEvidenceInvalidated,true);assert.equal(mobile.getTtsEvidence('nl',ambiguousStore,now),null,'new runtime ambiguity must revoke prior unique-language evidence');

  const networkStore=storage();assert(mobile.recordTtsEvidence(networkStore,exact,'tr-TR','tr-TR',now));
  const network=mobile.createClient({storage:networkStore,now:()=>now,capture:async()=> 'merhaba',request:async()=>{throw new Error('network_down')},play:async()=>{}});
  const networkResult=await network.run({locale:'tr-TR'});
  assert.equal(networkResult.runtimeTtsEvidenceInvalidated,false);assert(mobile.getTtsEvidence('tr-TR',networkStore,now),'temporary network failure must not prove TTS capability disappeared');

  const forgedReasonStore=storage();assert(mobile.recordTtsEvidence(forgedReasonStore,exact,'tr-TR','tr-TR',now));
  const forgedReason=mobile.createClient({storage:forgedReasonStore,now:()=>now,capture:async()=> 'merhaba',request:async()=>{throw new Error('tts_locale_not_in_runtime_inventory')},play:async()=>{}});
  const forgedReasonResult=await forgedReason.run({locale:'tr-TR'});
  assert.equal(forgedReasonResult.runtimeTtsEvidenceInvalidated,false);assert(mobile.getTtsEvidence('tr-TR',forgedReasonStore,now),'matching error text without an unsupported runtime response must not revoke evidence');

  const inventoryStore=storage();assert(mobile.recordTtsEvidence(inventoryStore,exact,'tr-TR','tr-TR',now));
  const inventory=mobile.createClient({storage:inventoryStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:false,state:'unsupported',reason:'runtime_voice_inventory_unavailable',locale:data.locale}),play:async()=>{}});
  const inventoryResult=await inventory.run({locale:'tr-TR'});
  assert.equal(inventoryResult.runtimeTtsEvidenceInvalidated,false);assert(mobile.getTtsEvidence('tr-TR',inventoryStore,now),'temporary inventory probe failure must not revoke prior positive capability evidence');

  const autoplayStore=storage();assert(mobile.recordTtsEvidence(autoplayStore,exact,'tr-TR','tr-TR',now));
  const autoplay=mobile.createClient({storage:autoplayStore,now:()=>now,capture:async()=> 'merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba.',locale:data.locale,ttsLocale:data.locale,provider:'edge-tts',voice:'tr-TR-AhmetNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'}),play:async()=>{throw new Error('autoplay_blocked')}});
  const autoplayResult=await autoplay.run({locale:'tr-TR'});
  assert.equal(autoplayResult.runtimeTtsEvidenceInvalidated,false);assert(mobile.getTtsEvidence('tr-TR',autoplayStore,now),'autoplay failure is not negative runtime capability evidence');

  const cancelStore=storage();assert(mobile.recordTtsEvidence(cancelStore,exact,'tr-TR','tr-TR',now));let cancelSeen=false;
  const cancel=mobile.createClient({storage:cancelStore,now:()=>now,capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{cancelSeen=true;reject(new Error('capture_aborted'))},{once:true})),request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const pendingCancel=cancel.run({locale:'tr-TR'});await new Promise(resolve=>setTimeout(resolve,5));cancel.cancel();const cancelResult=await pendingCancel;
  assert.equal(cancelSeen,true);assert.equal(cancelResult.cancelled,true);assert.equal(cancelResult.runtimeTtsEvidenceInvalidated,false);assert(mobile.getTtsEvidence('tr-TR',cancelStore,now),'user cancellation must preserve prior TTS evidence');

  const emptyList=listMock();mobile.renderLocaleOptions(emptyList,storage(),now);
  assert(emptyList.children.length===mobile.COMMON_LOCALES.length);assert(emptyList.children.every(x=>x.label.includes('TTS ?')),'static suggestions must not be presented as supported');
  const verifiedList=listMock();mobile.renderLocaleOptions(verifiedList,successStore,now);
  const tr=verifiedList.children.find(x=>x.value==='tr-TR');assert(tr&&tr.label.includes('TTS ✓ son 5 dk'),'fresh runtime+playback receipt may be shown as recently verified');
  const en=verifiedList.children.find(x=>x.value==='en-US');assert(en&&en.label.includes('TTS ?'),'unverified locale stays unknown');

  console.log('MOBILE RUNTIME CATALOG SELFTEST PASS · positive TTS evidence is revoked only by provenance-bound definitive runtime locale negatives');
})().catch(error=>{console.error(error);process.exitCode=1});
