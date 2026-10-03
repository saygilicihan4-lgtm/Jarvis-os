'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
(async()=>{
  const now=2_000_000,store=storage();
  const receipt=mobile.recordSttCaptureEvidence(store,'tr-TR',now);
  assert(receipt);assert.equal(receipt.requestedLocale,'tr-TR');assert.equal(receipt.captureObserved,true);assert.equal(receipt.nonEmptyTranscript,true);
  assert.equal(receipt.transcriptStored,false);assert.equal(receipt.sttVerified,false);assert.equal(receipt.languageVerified,false);assert.equal(receipt.evidence,'browser_nonempty_transcript');
  assert.equal(receipt.expiresAt-now,mobile.STT_CAPTURE_EVIDENCE_TTL_MS);assert.equal('transcript' in receipt,false);assert.equal('text' in receipt,false);
  const raw=store.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY);assert(raw&&!raw.includes('merhaba'),'stored receipt must not contain transcript content');
  assert.equal(mobile.getSttCaptureEvidence('tr-TR',store,now+mobile.STT_CAPTURE_EVIDENCE_TTL_MS)?.captureObserved,true,'receipt valid through exact TTL boundary');
  assert.equal(mobile.getSttCaptureEvidence('tr-TR',store,now+mobile.STT_CAPTURE_EVIDENCE_TTL_MS+1),null,'expired receipt fails closed');
  assert.equal(store.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY),null,'expired receipt is purged');

  const tampered=storage({[mobile.STT_CAPTURE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',capturedAt:now,expiresAt:now+123,source:'browser-speech'}])});
  assert.deepEqual(mobile.readSttCaptureEvidence(tampered,now),[],'tampered TTL is rejected');assert.equal(tampered.getItem(mobile.STT_CAPTURE_EVIDENCE_KEY),null);
  const future=storage({[mobile.STT_CAPTURE_EVIDENCE_KEY]:JSON.stringify([{requestedLocale:'tr-TR',capturedAt:now+1,expiresAt:now+1+mobile.STT_CAPTURE_EVIDENCE_TTL_MS,source:'browser-speech'}])});
  assert.deepEqual(mobile.readSttCaptureEvidence(future,now),[],'future-dated capture evidence is rejected');
  assert.equal(mobile.recordSttCaptureEvidence(storage(),'../../bad',now),null,'invalid locale is rejected');

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

  console.log('MOBILE STT CAPTURE EVIDENCE SELFTEST PASS · non-empty browser capture is privacy-safe, locale-bound, TTL-limited, and never promoted to STT/language verification');
})().catch(error=>{console.error(error);process.exitCode=1});
