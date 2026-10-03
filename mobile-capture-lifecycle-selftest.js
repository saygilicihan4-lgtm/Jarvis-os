'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,maxMs=250){const end=Date.now()+maxMs;while(Date.now()<end){if(fn())return true;await sleep(1)}return false}
(async()=>{
  let timeoutAbort=false;
  const timed=mobile.createClient({storage:storage(),captureTimeoutMs:12,
    capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{timeoutAbort=true;reject(new Error('capture_abort_noise'))},{once:true})),
    request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const timeoutResult=await timed.run({locale:'tr-TR'});
  assert.equal(timeoutResult.cancelled,false);assert.equal(timeoutResult.error,'browser_stt_timeout');assert.equal(timeoutAbort,true);assert.equal(timed.busy,false);assert.equal(timed.history.length,0);

  let captureStarted=false,captureAbort=false;
  const duringCapture=mobile.createClient({storage:storage(),captureTimeoutMs:1000,
    capture:(_locale,signal)=>new Promise((_resolve,reject)=>{captureStarted=true;signal.addEventListener('abort',()=>{captureAbort=true;reject(new Error('browser_abort_noise'))},{once:true})}),
    request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const captureRun=duringCapture.run({locale:'tr-TR'});assert(await waitFor(()=>captureStarted));duringCapture.cancel();const captureResult=await captureRun;
  assert.equal(captureResult.cancelled,true);assert.equal(captureResult.error,'mobile_language_cancelled');assert.equal(captureAbort,true);

  const requestTimeoutStore=storage();let requestTimeoutAbort=false;
  const timedRequest=mobile.createClient({storage:requestTimeoutStore(),requestTimeoutMs:12,
    capture:async()=> 'こんにちは',
    request:(_data,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{requestTimeoutAbort=true;reject(new Error('fetch_abort_noise'))},{once:true})),
    play:async()=>{throw new Error('play_must_not_run')}});
  const requestCandidate=await timedRequest.run({locale:'tr-TR'});assert.equal(requestCandidate.state,'confirm-language');assert.equal(timedRequest.pendingLocale,'ja-JP');
  const requestTimeoutResult=await timedRequest.run({locale:'tr-TR'});
  assert.equal(requestTimeoutResult.cancelled,false);assert.equal(requestTimeoutResult.error,'mobile_language_request_timeout');assert.equal(requestTimeoutAbort,true);
  assert.equal(timedRequest.busy,false);assert.equal(timedRequest.history.length,0,'timed-out request cannot commit conversation history');
  assert.equal(requestTimeoutStore.getItem(mobile.PREFERENCE_KEY),null,'explicit language confirmation without successful request + playback cannot persist preference');

  let requestStarted=false,requestAbort=false;
  const duringRequest=mobile.createClient({storage:storage(),capture:async()=> 'Merhaba',
    request:(_data,signal)=>new Promise((_resolve,reject)=>{requestStarted=true;signal.addEventListener('abort',()=>{requestAbort=true;reject(new Error('fetch_abort_noise'))},{once:true})}),play:async()=>{}});
  const requestRun=duringRequest.run({locale:'tr-TR'});assert(await waitFor(()=>requestStarted));duringRequest.cancel();const requestResult=await requestRun;
  assert.equal(requestResult.cancelled,true);assert.equal(requestResult.error,'mobile_language_cancelled');assert.equal(requestAbort,true);assert.equal(duringRequest.history.length,0);

  let playbackStarted=false,playbackAbort=false;
  const duringPlayback=mobile.createClient({storage:storage(),capture:async()=> 'Merhaba',
    request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba',locale:data.locale}),
    play:(_result,signal)=>new Promise((_resolve,reject)=>{playbackStarted=true;signal.addEventListener('abort',()=>{playbackAbort=true;reject(new Error('playback_abort_noise'))},{once:true})})});
  const playbackRun=duringPlayback.run({locale:'tr-TR'});assert(await waitFor(()=>playbackStarted));duringPlayback.cancel();const playbackResult=await playbackRun;
  assert.equal(playbackResult.cancelled,true);assert.equal(playbackResult.error,'mobile_language_cancelled');assert.equal(playbackAbort,true);assert.equal(duringPlayback.history.length,0,'cancelled playback must not commit history');

  console.log('MOBILE CAPTURE LIFECYCLE SELFTEST PASS · capture/request deadlines + capture/request/playback cancellation are fail-closed and normalized');
})().catch(error=>{console.error(error);process.exitCode=1});
