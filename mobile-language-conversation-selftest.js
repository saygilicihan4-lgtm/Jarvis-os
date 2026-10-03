'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const relay=require('./jarvis-mobile-language-relay');
const {createEngine}=require('./jarvis-mobile-language-conversation');
const mobile=require('./public/mobile-language-chat');
function memoryStorage(seed={}){
  const map=new Map(Object.entries(seed));
  return{getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(String(key),String(value)),removeItem:key=>map.delete(key),dump:()=>Object.fromEntries(map)};
}

(async()=>{
  let clock=1000;
  const request=relay.createRequest({id:'q1',text:'  Guten   Tag  ',locale:'de-de',inputSource:'browser-speech',history:[{role:'system',content:'drop me'},{role:'user',content:'hello'}],now:()=>clock});
  assert.equal(request.locale,'de-DE');assert.equal(request.text,'Guten Tag');assert.deepEqual(request.history,[{role:'user',content:'hello'}]);
  assert.equal(relay.claim(request,'worker-a',{now:()=>++clock}).ok,true);
  assert.deepEqual(relay.verifyResult(request,{workerId:'worker-b',locale:'de-DE'}),{ok:false,reason:'worker_claim_mismatch'});
  assert.deepEqual(relay.verifyResult(request,{workerId:'worker-a',locale:'tr-TR'}),{ok:false,reason:'locale_mismatch'});
  assert.equal(relay.verifyResult(request,{workerId:'worker-a',locale:'de-DE'}).ok,true);
  request.status='ready';
  assert.deepEqual(relay.verifyResult(request,{workerId:'worker-a',locale:'de-DE'}),{ok:false,reason:'request_not_claimed_or_terminal'});
  const late=relay.createRequest({id:'q2',text:'Merhaba',locale:'tr-TR',now:()=>clock});relay.claim(late,'worker-a');relay.cancel(late);
  assert.deepEqual(relay.verifyResult(late,{workerId:'worker-a',locale:'tr-TR'}),{ok:false,reason:'request_not_claimed_or_terminal'});

  let leaseClock=10_000;
  const staleClaim=relay.createRequest({id:'q-lease',text:'Hallo',locale:'de-DE',now:()=>leaseClock});
  assert.equal(relay.claim(staleClaim,'worker-a',{now:()=>leaseClock}).ok,true);
  leaseClock+=relay.CLAIM_LEASE_MS;
  assert.equal(staleClaim.status,'claimed','claim remains valid through exact lease boundary');
  leaseClock+=1;
  assert.equal(staleClaim.status,'failed','expired Worker claim fails closed instead of remaining stuck');
  assert.equal(staleClaim.error,'worker_claim_expired');
  assert.deepEqual(relay.verifyResult(staleClaim,{workerId:'worker-a',locale:'de-DE'}),{ok:false,reason:'request_not_claimed_or_terminal'},'late same-Worker result cannot revive expired claim');
  const staleQueue=relay.createRequest({id:'q-queue',text:'Bonjour',locale:'fr-FR',now:()=>leaseClock});
  leaseClock+=relay.QUEUE_TTL_MS+1;
  assert.equal(staleQueue.status,'failed','abandoned queued request expires');
  assert.equal(staleQueue.error,'request_expired');
  assert.deepEqual(relay.claim(staleQueue,'worker-a',{now:()=>leaseClock}),{ok:false,reason:'request_not_queued'},'expired queue item cannot be claimed');

  let generated=null;
  const engine=createEngine({
    voiceRouter:{resolve:async locale=>locale==='de-DE'?{ok:true,voice:'de-DE-ConradNeural'}:{ok:false,reason:'tts_locale_not_in_runtime_inventory'}},
    output:{generate:async input=>{generated=input;return{reply:'Hallo!',locale:input.context.locale}}}
  });
  const reply=await engine.turn({text:'Guten Tag',locale:'de-DE',inputSource:'browser-speech',history:[{role:'assistant',content:'Hallo'}]});
  assert.equal(reply.ok,true);assert.equal(reply.state,'reply-ready');assert.equal(reply.locale,'de-DE');assert.equal(reply.voice,'de-DE-ConradNeural');
  assert.equal(reply.learning,false);assert.equal(reply.languageEvidence,'client-requested-locale');assert.equal(reply.deviceE2eVerified,false);
  assert.equal(generated.context.source,'mobile_client_requested');assert.equal(generated.context.sessionOnly,true);assert.equal(generated.speech.ttsLocale,'de-DE');assert.equal(generated.speech.sttLocale,null);
  assert.equal(typeof generated.signal,'undefined');
  const unsupported=await engine.turn({text:'Bonjour',locale:'fr-FR',inputSource:'browser-speech'});
  assert.equal(unsupported.ok,false);assert.equal(unsupported.reason,'tts_locale_not_in_runtime_inventory');

  assert.equal(mobile.safeLanguageHint('Привет'),null,'generic Cyrillic must not be guessed as Russian');
  assert.equal(mobile.safeLanguageHint('مرحبا'),null,'generic Arabic script must not be guessed as ar-SA');
  assert.equal(mobile.safeLanguageHint('Merhaba, nasılsın?'),null,'Latin-script Turkish must not be region-guessed from characters alone');
  assert.equal(mobile.safeLanguageHint('Hello there'),null,'plain Latin text cannot be treated as automatic language evidence');
  assert.equal(mobile.safeLanguageHint('你好'),null,'Han-only text is ambiguous with Japanese and must not be region-guessed');
  assert.equal(mobile.safeLanguageHint('こんにちは'),'ja-JP');
  assert.equal(mobile.safeLanguageHint('안녕하세요'),'ko-KR');
  assert.equal(mobile.safeLanguageHint('Καλημέρα'),'el-GR');
  assert.equal(mobile.safeLanguageHint('สวัสดี'),'th-TH');
  assert.equal(mobile.safeLanguageHint('Բարեւ'),'hy-AM');
  assert.equal(mobile.safeLanguageHint('გამარჯობა'),'ka-GE');
  assert.equal(mobile.canonicalLocale('de_de'),'de-DE');
  const corrupt=memoryStorage({[mobile.PREFERENCE_KEY]:'../../bad'});
  assert.equal(mobile.readPreference(corrupt),null);assert.equal(corrupt.getItem(mobile.PREFERENCE_KEY),null,'corrupt preference is removed');

  let captures=0,calls=[],plays=0,states=[];
  const preferenceStore=memoryStorage();
  const client=mobile.createClient({
    storage:preferenceStore,
    capture:async()=>{captures++;return'こんにちは'},
    request:async(data)=>{calls.push(data);return{ok:true,state:'reply-ready',reply:'こんにちは',locale:data.locale,learning:false}},
    play:async()=>{plays++},onState:(state,detail)=>states.push({state,detail})
  });
  const first=await client.run({locale:'tr-TR'});
  assert.equal(first.state,'confirm-language');assert.equal(first.locale,'ja-JP');assert.equal(calls.length,0,'candidate mismatch must not silently send or switch');assert.equal(plays,0);
  assert.equal(preferenceStore.getItem(mobile.PREFERENCE_KEY),null,'candidate alone must never persist a preference');
  const second=await client.run({locale:'tr-TR'});
  assert.equal(second.state,'completed');assert.equal(second.nextLocale,'ja-JP');assert.equal(captures,1,'explicit second tap reuses held transcript');assert.equal(calls.length,1);assert.equal(calls[0].locale,'ja-JP');
  assert.equal(calls[0].inputSource,'browser-speech');assert.equal(client.history.length,2);assert.equal(second.learning,false);
  assert.equal(second.preferenceSaved,true);assert.equal(second.preferenceEvidence,'explicit-confirmation-plus-playback');assert.equal(client.preferredLocale,'ja-JP');
  assert.equal(preferenceStore.getItem(mobile.PREFERENCE_KEY),'ja-JP','only successful explicit switch persists');
  assert.equal(JSON.stringify(preferenceStore.dump()).includes('こんにちは'),false,'preference storage must not contain transcript or reply');

  let resumedCaptureLocale=null;
  const resumed=mobile.createClient({storage:preferenceStore,capture:async locale=>{resumedCaptureLocale=locale;return'こんにちは'},
    request:async data=>({ok:true,state:'reply-ready',reply:'こんにちは',locale:data.locale}),play:async()=>{}});
  const resumedResult=await resumed.run({locale:'tr-TR'});
  assert.equal(resumedCaptureLocale,'ja-JP','stored explicit preference becomes the next mobile capture locale');
  assert.equal(resumedResult.nextLocale,'ja-JP');assert.equal(resumedResult.preferenceSaved,false,'using a stored preference is not new learning evidence');

  const failedStore=memoryStorage();let failCapture=0;
  const failedSwitch=mobile.createClient({storage:failedStore,capture:async()=>{failCapture++;return'こんにちは'},
    request:async data=>({ok:true,state:'reply-ready',reply:'こんにちは',locale:data.locale}),play:async()=>{throw new Error('autoplay_blocked')}});
  assert.equal((await failedSwitch.run({locale:'tr-TR'})).state,'confirm-language');
  const failedSwitchResult=await failedSwitch.run({locale:'tr-TR'});
  assert.equal(failedSwitchResult.ok,false);assert.equal(failedStore.getItem(mobile.PREFERENCE_KEY),null,'unplayed explicit switch must not persist');

  const cancelStore=memoryStorage();let cancelCaptures=0;
  const privacyClient=mobile.createClient({storage:cancelStore,capture:async()=>{cancelCaptures++;return'こんにちは'},request:async data=>({ok:true,state:'reply-ready',reply:'こんにちは',locale:data.locale}),play:async()=>{}});
  assert.equal((await privacyClient.run({locale:'tr-TR'})).state,'confirm-language');assert.equal(privacyClient.pendingLocale,'ja-JP');
  assert.equal(privacyClient.cancel().pendingCleared,true);assert.equal(privacyClient.pendingLocale,null,'privacy/auth cancellation clears held transcript candidate');
  assert.equal((await privacyClient.run({locale:'tr-TR'})).state,'confirm-language');assert.equal(cancelCaptures,2,'after privacy cancellation the old transcript cannot be reused');
  assert.equal(cancelStore.getItem(mobile.PREFERENCE_KEY),null);

  let captureAborted=false,timeoutStates=[];
  const timeoutClient=mobile.createClient({storage:memoryStorage(),captureTimeoutMs:15,
    capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{captureAborted=true;reject(new Error('capture_aborted'))},{once:true})),
    request:async()=>{throw new Error('request_must_not_run')},play:async()=>{},onState:(state,detail)=>timeoutStates.push({state,detail})
  });
  const timeoutResult=await timeoutClient.run({locale:'tr-TR'});
  assert.equal(timeoutResult.ok,false);assert.equal(timeoutResult.cancelled,false);assert.equal(timeoutResult.error,'browser_stt_timeout');
  assert.equal(captureAborted,true,'capture timeout must abort underlying browser speech recognition');assert.equal(timeoutClient.busy,false);assert.equal(timeoutClient.history.length,0);
  assert(timeoutStates.some(x=>x.state==='error'&&x.detail.error==='browser_stt_timeout'),'capture timeout must surface a truthful error state');

  let manualAbortSeen=false;
  const cancelClient=mobile.createClient({storage:memoryStorage(),captureTimeoutMs:1000,
    capture:(_locale,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{manualAbortSeen=true;reject(new Error('capture_aborted'))},{once:true})),
    request:async()=>{throw new Error('request_must_not_run')},play:async()=>{}});
  const running=cancelClient.run({locale:'tr-TR'});await new Promise(r=>setTimeout(r,5));cancelClient.cancel();const manualResult=await running;
  assert.equal(manualResult.cancelled,true);assert.equal(manualResult.error,'mobile_language_cancelled');assert.equal(manualAbortSeen,true,'manual cancellation must abort capture immediately');

  const failed=mobile.createClient({capture:async()=> 'Merhaba',request:async data=>({ok:true,state:'reply-ready',reply:'Merhaba',locale:data.locale}),play:async()=>{throw new Error('autoplay_blocked')}});
  const failedResult=await failed.run({locale:'tr-TR'});
  assert.equal(failedResult.ok,false);assert.equal(failed.history.length,0,'unplayed mobile reply cannot enter conversation history');

  const html=fs.readFileSync('public/index.html','utf8'),worker=fs.readFileSync('worker.js','utf8'),server=fs.readFileSync('server.js','utf8');
  assert(html.includes('/mobile-language-chat.js'),'mobile client script must be loaded');
  assert(html.includes('JarvisMobileLanguageChat.createClient'),'mobile UI must use safe conversation client');
  assert(html.includes('mobileLanguageCapture'),'phone speech result must have an isolated capture path');
  assert(html.includes("if(isMobileJarvis()){await runMobileLanguageChat();return}"),'mobile multilingual button must route to mobile client');
  assert(html.includes('mobileLanguageChatClient?.cancel()'),'privacy/background/auth paths must be able to cancel mobile conversation');
  assert(!html.includes("if(!/Windows/i.test(navigator.userAgent)||isMobileJarvis()){\n  languageChatBtn.disabled=true"),'mobile multilingual button must not retain old PC-only disable gate');
  assert(server.includes('/api/mobile-language'),'cloud server must expose mobile language queue');
  assert(server.includes('mobileLanguageRelay.verifyResult'),'server must bind result to claimant and locale');
  assert(worker.includes('serviceMobileLanguage'),'worker must service the mobile language queue');
  assert(worker.includes('jarvis-mobile-language-conversation'),'worker must use locale-frozen conversation engine');
  assert(worker.includes('setInterval(()=>serviceMobileLanguage().catch(()=>{}),650)'),'mobile language relay must use conversational polling cadence');
  console.log('MOBILE LANGUAGE CONVERSATION SELFTEST PASS · explicit playback-gated preference, capture timeout, privacy-safe pending clear, ambiguity-safe locale, claimant lease, no STT learning claim');
})().catch(error=>{console.error(error);process.exitCode=1});
