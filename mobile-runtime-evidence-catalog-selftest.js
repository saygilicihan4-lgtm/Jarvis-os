'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
(async()=>{
  let now=1_000_000;
  const store=storage();
  const result={ok:true,state:'reply-ready',reply:'Hello',locale:'en-US',ttsLocale:'en-US',localeResolution:'exact',speechEvidence:'runtime_inventory',provider:'edge-tts',voice:'en-US-GuyNeural'};
  const client=mobile.createClient({storage:store,now:()=>now,capture:async()=> 'hello',request:async()=>result,play:async()=>{}});
  client.selectLocale('en-US');const completed=await client.run({locale:'tr-TR'});
  assert.equal(completed.state,'completed');assert.equal(completed.runtimeTtsVerified,true);assert.equal(completed.sttVerified,false);
  assert.equal(completed.runtimeTtsEvidence.requestedLocale,'en-US');assert.equal(completed.runtimeTtsEvidence.ttsLocale,'en-US');
  assert.equal(completed.runtimeTtsEvidence.evidence,'runtime_inventory_plus_playback');assert.equal(completed.runtimeTtsEvidence.deviceE2eVerified,false);
  let evidence=mobile.getTtsEvidence('en-US',store,now);assert(evidence);assert.equal(evidence.ttsVerified,true);assert.equal(evidence.sttVerified,false);
  now+=mobile.TTS_EVIDENCE_TTL_MS;assert(mobile.getTtsEvidence('en-US',store,now),'exact TTL boundary remains fresh');
  now+=1;assert.equal(mobile.getTtsEvidence('en-US',store,now),null,'evidence must expire after five minutes');

  now=2_000_000;
  const noEvidenceStore=storage();
  const noEvidenceClient=mobile.createClient({storage:noEvidenceStore,now:()=>now,capture:async()=> 'hello',request:async()=>({...result,speechEvidence:'client_claim'}),play:async()=>{}});
  noEvidenceClient.selectLocale('en-US');const noEvidence=await noEvidenceClient.run({locale:'tr-TR'});
  assert.equal(noEvidence.state,'completed');assert.equal(noEvidence.runtimeTtsVerified,false);assert.equal(mobile.getTtsEvidence('en-US',noEvidenceStore,now),null,'non-runtime evidence must never enter catalog');

  const autoplayStore=storage();
  const autoplay=mobile.createClient({storage:autoplayStore,now:()=>now,capture:async()=> 'hello',request:async()=>result,play:async()=>{throw new Error('autoplay_blocked')}});
  autoplay.selectLocale('en-US');const autoplayResult=await autoplay.run({locale:'tr-TR'});
  assert.equal(autoplayResult.ok,false);assert.equal(mobile.getTtsEvidence('en-US',autoplayStore,now),null,'failed playback must not prove TTS');

  const bareStore=storage();
  const bareResult={...result,locale:'nl',ttsLocale:'nl-NL',localeResolution:'unique_runtime_language_match',voice:'nl-NL-MaartenNeural'};
  const bare=mobile.createClient({storage:bareStore,now:()=>now,capture:async()=> 'hallo',request:async()=>bareResult,play:async()=>{}});
  bare.selectLocale('nl');const bareCompleted=await bare.run({locale:'tr-TR'});
  assert.equal(bareCompleted.runtimeTtsVerified,true);const bareEvidence=mobile.getTtsEvidence('nl',bareStore,now);
  assert.equal(bareEvidence.ttsLocale,'nl-NL');assert.equal(bareEvidence.localeResolution,'unique_runtime_language_match');

  const tampered=storage({[mobile.TTS_EVIDENCE_KEY]:JSON.stringify([
    {requestedLocale:'nl-BE',ttsLocale:'nl-NL',provider:'edge-tts',voice:'x',localeResolution:'unique_runtime_language_match',verifiedAt:now,expiresAt:now+mobile.TTS_EVIDENCE_TTL_MS},
    {requestedLocale:'tr-TR',ttsLocale:'tr-TR',provider:'fake',voice:'x',localeResolution:'exact',verifiedAt:now,expiresAt:now+mobile.TTS_EVIDENCE_TTL_MS},
    {requestedLocale:'en-US',ttsLocale:'en-US',provider:'edge-tts',voice:'x',localeResolution:'exact',verifiedAt:now+6000,expiresAt:now+6000+mobile.TTS_EVIDENCE_TTL_MS}
  ])});
  assert.deepEqual(mobile.readTtsEvidence(tampered,now),[],'forged region/provider/future evidence must be discarded');
  assert.equal(tampered.getItem(mobile.TTS_EVIDENCE_KEY),null,'invalid evidence storage must be cleaned');

  const replaceStore=storage();
  assert(mobile.recordTtsEvidence(replaceStore,result,'en-US','en-US',now));
  const newer={...result,voice:'en-US-AndrewNeural'};assert(mobile.recordTtsEvidence(replaceStore,newer,'en-US','en-US',now+100));
  evidence=mobile.readTtsEvidence(replaceStore,now+100);assert.equal(evidence.length,1);assert.equal(evidence[0].voice,'en-US-AndrewNeural');

  const labels=[];
  const fakeDoc={createElement:()=>({value:'',label:''})};
  const fakeList={ownerDocument:fakeDoc,children:[],get firstChild(){return this.children[0]||null},removeChild(){this.children.shift()},appendChild(x){this.children.push(x)}};
  mobile.renderLocaleOptions(fakeList,replaceStore,now+100);for(const x of fakeList.children)labels.push([x.value,x.label]);
  assert(labels.find(([v])=>v==='en-US')[1].includes('TTS ✓ son 5 dk'));
  assert(labels.find(([v])=>v==='tr-TR')[1].includes('TTS ? ilk kullanımda kontrol'));

  console.log('MOBILE RUNTIME EVIDENCE CATALOG SELFTEST PASS · TTS-only receipts require runtime inventory + playback, expire in 5m, and never claim STT/E2E');
})().catch(error=>{console.error(error);process.exitCode=1});
