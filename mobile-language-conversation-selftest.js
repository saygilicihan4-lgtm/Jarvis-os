'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const relay=require('./jarvis-mobile-language-relay');
const {createEngine}=require('./jarvis-mobile-language-conversation');
const mobile=require('./public/mobile-language-chat');

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

  let generated=null;
  const engine=createEngine({
    voiceRouter:{resolve:async locale=>locale==='de-DE'?{ok:true,voice:'de-DE-ConradNeural'}:{ok:false,reason:'tts_locale_not_in_runtime_inventory'}},
    output:{generate:async input=>{generated=input;return{reply:'Hallo!',locale:input.context.locale}}}
  });
  const reply=await engine.turn({text:'Guten Tag',locale:'de-DE',inputSource:'browser-speech',history:[{role:'assistant',content:'Hallo'}]});
  assert.equal(reply.ok,true);assert.equal(reply.state,'reply-ready');assert.equal(reply.locale,'de-DE');assert.equal(reply.voice,'de-DE-ConradNeural');
  assert.equal(reply.learning,false);assert.equal(reply.languageEvidence,'explicit-mobile-locale');assert.equal(reply.deviceE2eVerified,false);
  assert.equal(generated.context.source,'mobile_explicit');assert.equal(generated.speech.ttsLocale,'de-DE');assert.equal(generated.speech.sttLocale,null);
  assert.equal(typeof generated.signal,'undefined');
  const unsupported=await engine.turn({text:'Bonjour',locale:'fr-FR',inputSource:'browser-speech'});
  assert.equal(unsupported.ok,false);assert.equal(unsupported.reason,'tts_locale_not_in_runtime_inventory');

  assert.equal(mobile.safeLanguageHint('Merhaba, nasılsın?'),'tr-TR');
  assert.equal(mobile.safeLanguageHint('Привет'),'ru-RU');
  assert.equal(mobile.safeLanguageHint('مرحبا'),'ar-SA');
  assert.equal(mobile.safeLanguageHint('こんにちは'),'ja-JP');
  assert.equal(mobile.safeLanguageHint('안녕하세요'),'ko-KR');
  assert.equal(mobile.safeLanguageHint('Straße'),'de-DE');
  assert.equal(mobile.safeLanguageHint('Hello there'),null,'plain Latin text cannot be treated as automatic language evidence');

  let captures=0,calls=[],plays=0,states=[];
  const client=mobile.createClient({
    capture:async()=>{captures++;return'Привет'},
    request:async(data)=>{calls.push(data);return{ok:true,state:'reply-ready',reply:'Здравствуйте',locale:data.locale,learning:false}},
    play:async()=>{plays++},onState:(state,detail)=>states.push({state,detail})
  });
  let first=await client.run({locale:'tr-TR'});
  assert.equal(first.state,'confirm-language');assert.equal(first.locale,'ru-RU');assert.equal(calls.length,0,'heuristic mismatch must not silently send or switch');assert.equal(plays,0);
  let second=await client.run({locale:'tr-TR'});
  assert.equal(second.state,'completed');assert.equal(second.nextLocale,'ru-RU');assert.equal(captures,1,'explicit second tap reuses held transcript');assert.equal(calls.length,1);assert.equal(calls[0].locale,'ru-RU');
  assert.equal(calls[0].inputSource,'browser-speech');assert.equal(client.history.length,2);assert.equal(second.learning,false);

  let failingCalls=[];
  const failed=mobile.createClient({capture:async()=> 'Merhaba',request:async data=>{failingCalls.push(data);return{ok:true,state:'reply-ready',reply:'Merhaba',locale:data.locale}},play:async()=>{throw new Error('autoplay_blocked')}});
  const failedResult=await failed.run({locale:'tr-TR'});
  assert.equal(failedResult.ok,false);assert.equal(failed.history.length,0,'unplayed mobile reply cannot enter conversation history');

  const html=fs.readFileSync('public/index.html','utf8'),worker=fs.readFileSync('worker.js','utf8'),server=fs.readFileSync('server.js','utf8');
  assert(html.includes('/mobile-language-chat.js'),'mobile client script must be loaded');
  assert(html.includes('JarvisMobileLanguageChat.createClient'),'mobile UI must use safe conversation client');
  assert(html.includes('mobileLanguageCapture'),'phone speech result must have an isolated capture path');
  assert(server.includes('/api/mobile-language'),'cloud server must expose mobile language queue');
  assert(server.includes('mobileLanguageRelay.verifyResult'),'server must bind result to claimant and locale');
  assert(worker.includes('serviceMobileLanguage'),'worker must service the mobile language queue');
  assert(worker.includes('jarvis-mobile-language-conversation'),'worker must use locale-frozen conversation engine');
  console.log('MOBILE LANGUAGE CONVERSATION SELFTEST PASS · explicit locale, confirmation gate, claimant binding, playback-gated history, no STT learning claim');
})().catch(error=>{console.error(error);process.exitCode=1});
