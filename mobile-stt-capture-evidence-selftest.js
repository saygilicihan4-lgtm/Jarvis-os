'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
(async()=>{
  const now=2_000_000,store=storage();
  const receipt=mobile.recordSttCaptureEvidence(store,'tr-TR','merhaba',now);
  assert(receipt);assert.equal(receipt.requestedLocale,'tr-TR');assert.equal(receipt.captureObserved,true);assert.equal(receipt.nonEmptyTranscript,true);
  assert.equal(receipt.transcriptStored,false);assert.equal(receipt.sttVerified,false);assert.equal(receipt.languageVerified,false);assert.equal(receipt.evidence,'browser_nonempty_transcript');
  assert.equal(receipt.expiresAt-now,mobile.STT_CAPTURE_EVIDENCE_TTL_MS);assert.equal('transcript' in receipt,false);assert.equal('text' in receipt,false);
  const raw=store.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY);assert(raw&&!raw.includes('merhaba'),'stored receipt must not contain transcript content');
  assert.equal(mobile.getSttCaptureEvidence('tr-TR',store,now+mobile.STT_CAPTURE_EVIDENCE_TTL_MS)?.captureObserved,true,'receipt valid through exact TTL boundary');
  assert.equal(mobile.getSttCaptureEvidence('tr-TR',store,now+mobile.STT_CAPTURE_EVIDENCE_TTL_MS+1),null,'expired receipt fails closed');
  assert.equal(store.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY),null,'expired receipt is purged');

  assert.equal(mobile.recordSttCaptureEvidence(storage(),'tr-TR','   ',now),null,'empty transcript cannot fabricate capture evidence');
  assert.equal(mobile.recordSttCaptureEvidence(storage(),'../../bad','merhaba',now),null,'invalid locale is rejected');

  const tampered=storage({[mobile.STT_CAPTURE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',capturedAt:now,expiresAt:now+123,source:'browser-speech'}])});
  assert.deepEqual(mobile.readSttCaptureEvidence(tampered,now),[],'tampered TTL is rejected');assert.equal(tampered.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY),null);
  const future=storage({[mobile.STT_CAPTURE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',capturedAt:now+1,expiresAt:now+1+mobile.STT_CAPTURE_EVIDENCE_TTL_MS,source:'browser-speech'}])});
  assert.deepEqual(mobile.readSttCaptureEvidence(future,now),[],'future-dated capture evidence is rejected');

  const captureStore=storage();
  const client=mobile.createClient({storage:captureStore,now:()=>now,capture:async()=> '  merhaba dünya  ',request:async()=>{throw new Error('network_down')},play:async()=>{throw new Error('play_must_not_run')}});
  const result=await client.run({locale:'tr-TR'});assert.equal(result.ok,false);assert.equal(result.error,'network_down');
  const captured=mobile.getSttCaptureEvidence('tr-TR',captureStore,now);assert(captured,'non-empty browser capture should survive downstream request failure');
  assert.equal(captured.sttVerified,false);assert.equal(captured.languageVerified,false);assert.equal('transcript' in captured,false);

  const switchStore=storage();
  const switchClient=mobile.createClient({storage:switchStore,now:()=>now,capture:async()=> 'こんにちは',hint:()=> 'ja-JP',request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const switchResult=await switchClient.run({locale:'en-US'});assert.equal(switchResult.state,'confirm-language');
  assert(mobile.getSttCaptureEvidence('en-US',switchStore,now),'capture evidence stays bound to recognizer locale used for the capture');
  assert.equal(mobile.getSttCaptureEvidence('ja-JP',switchStore,now),null,'language hint must not fabricate capture evidence for hinted locale');

  const emptyStore=storage();
  const emptyClient=mobile.createClient({storage:emptyStore,now:()=>now,capture:async()=> '   ',request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const emptyResult=await emptyClient.run({locale:'tr-TR'});assert.equal(emptyResult.error,'empty_transcript');assert.deepEqual(mobile.readSttCaptureEvidence(emptyStore,now),[],'empty transcript must not create evidence');

  const timeoutStore=storage();
  const timeoutClient=mobile.createClient({storage:timeoutStore,now:()=>now,captureTimeoutMs:5,capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})),request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const timeoutResult=await timeoutClient.run({locale:'tr-TR'});assert.equal(timeoutResult.error,'browser_stt_timeout');assert.deepEqual(mobile.readSttCaptureEvidence(timeoutStore,now),[],'timeout must not create evidence');

  const cancelStore=storage();
  const cancelClient=mobile.createClient({storage:cancelStore,now:()=>now,capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})),request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const pending=cancelClient.run({locale:'tr-TR'});await new Promise(resolve=>setTimeout(resolve,5));cancelClient.cancel();const cancelResult=await pending;
  assert.equal(cancelResult.cancelled,true);assert.deepEqual(mobile.readSttCaptureEvidence(cancelStore,now),[],'manual cancel must not create evidence');

  const lateTimeoutStore=storage();let lateTimeoutResolved=false;
  const lateTimeoutClient=mobile.createClient({storage:lateTimeoutStore,now:()=>now,captureTimeoutMs:5,capture:()=>new Promise(resolve=>setTimeout(()=>{lateTimeoutResolved=true;resolve('gecikmiş transcript')},18)),request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const lateTimeoutResult=await lateTimeoutClient.run({locale:'tr-TR'});assert.equal(lateTimeoutResult.error,'browser_stt_timeout');
  await new Promise(resolve=>setTimeout(resolve,25));assert.equal(lateTimeoutResolved,true,'stale capture promise should actually resolve after timeout for this race test');
  assert.deepEqual(mobile.readSttCaptureEvidence(lateTimeoutStore,now),[],'late capture resolution after timeout must be quarantined and never mint evidence');

  const staleStore=storage();let staleResolve=null,staleCalls=0;
  const staleClient=mobile.createClient({storage:staleStore,now:()=>now,capture:()=>{staleCalls++;if(staleCalls===1)return new Promise(resolve=>{staleResolve=resolve});return Promise.resolve('bonjour')},request:async()=>{throw new Error('network_down')},play:async()=>{}});
  const stalePending=staleClient.run({locale:'en-US'});await new Promise(resolve=>setTimeout(resolve,5));staleClient.cancel();const staleCancelled=await stalePending;
  assert.equal(staleCancelled.cancelled,true);assert.equal(typeof staleResolve,'function');assert.equal(mobile.getSttCaptureEvidence('en-US',staleStore,now),null,'cancelled first capture must not leave evidence');
  const freshResult=await staleClient.run({locale:'fr-FR'});assert.equal(freshResult.error,'network_down');assert(mobile.getSttCaptureEvidence('fr-FR',staleStore,now),'fresh second capture should create evidence for its own locale');
  staleResolve('late english transcript');await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(mobile.getSttCaptureEvidence('en-US',staleStore,now),null,'late result from cancelled capture must not contaminate a later run');
  assert(mobile.getSttCaptureEvidence('fr-FR',staleStore,now),'stale callback must not erase or replace the later valid receipt');
  const staleRaw=staleStore.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY)||'';assert(!staleRaw.includes('late english transcript')&&!staleRaw.includes('bonjour'),'race receipts must remain transcript-free');

  const index=fs.readFileSync(require.resolve('./public/index.html'),'utf8');
  const captureStart=index.indexOf('function captureMobileLanguageTranscript(locale,signal)');
  const captureEnd=index.indexOf('function waitMobileLanguagePoll',captureStart);
  assert(captureStart>=0&&captureEnd>captureStart,'production browser capture adapter must exist');
  const productionCapture=index.slice(captureStart,captureEnd);
  assert(productionCapture.includes("if(!recognition)return Promise.reject(new Error('browser_stt_unsupported'))"),'production capture must fail closed without browser recognizer');
  assert(productionCapture.includes('recognition.lang=locale;recognition.start()'),'production capture must bind the requested locale before starting the recognizer');
  assert(productionCapture.includes('try{recognition.abort()}catch(_){}'),'production cancel must abort the active browser recognizer');
  assert(productionCapture.includes("slot.reject(new Error('mobile_language_cancelled'))"),'production cancel must reject the dedicated capture slot rather than resolve text');

  const endStart=index.indexOf('recognition.onend=()=>{');
  const errorStart=index.indexOf('recognition.onerror=e=>',endStart);
  assert(endStart>=0&&errorStart>endStart,'production SpeechRecognition onend/onerror handlers must exist');
  const productionEnd=index.slice(endStart,errorStart);
  assert(productionEnd.includes('if(mobileLanguageCapture)'),'no-final onend must inspect the dedicated mobile capture slot');
  assert(productionEnd.includes("slot.reject(new Error('browser_stt_no_final_result'))"),'no-final onend must reject instead of manufacturing a transcript');
  assert.equal(productionEnd.includes('slot.resolve('),false,'no-final onend must never resolve transcript content');

  const resultStart=index.indexOf('recognition.onresult=async e=>',errorStart);
  assert(resultStart>errorStart,'production SpeechRecognition onresult handler must follow onerror');
  const productionError=index.slice(errorStart,resultStart);
  assert(productionError.includes('if(mobileLanguageCapture)'),'recognizer errors must inspect the dedicated mobile capture slot');
  assert(productionError.includes("slot.reject(new Error('browser_stt_'+err.toLowerCase()))"),'recognizer errors must reject with browser STT provenance');
  assert.equal(productionError.includes('slot.resolve('),false,'recognizer error path must never resolve transcript content');

  const resultEnd=index.indexOf('function ',resultStart+20);
  const productionResult=index.slice(resultStart,resultEnd>resultStart?resultEnd:resultStart+5000);
  assert(productionResult.includes('if(e.results[e.results.length-1].isFinal)'),'mobile capture must wait for a final browser recognition result');
  assert(productionResult.includes('if(mobileLanguageCapture)'),'final browser result must resolve through the dedicated mobile capture slot');
  assert(productionResult.includes('slot.resolve(captured)'),'dedicated mobile capture slot must receive the recognizer transcript');

  const clientStart=index.indexOf('JarvisMobileLanguageChat.createClient({');
  const clientEnd=index.indexOf('});',clientStart);
  assert(clientStart>=0&&clientEnd>clientStart,'production mobile language client wiring must exist');
  const productionClient=index.slice(clientStart,clientEnd);
  assert(productionClient.includes('capture:captureMobileLanguageTranscript'),'production evidence path must stay wired to the browser SpeechRecognition adapter, not an arbitrary text source');

  console.log('MOBILE STT CAPTURE EVIDENCE SELFTEST PASS · browser final-result provenance is required; stale timeout/cancel callbacks are quarantined and cannot fabricate or replace STT evidence');
})().catch(error=>{console.error(error);process.exitCode=1});