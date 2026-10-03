'use strict';
const assert=require('assert');
const fs=require('fs');
const relay=require('./jarvis-mobile-tts-relay');
const {createRouter}=require('./jarvis-tts-locale-router');

(async()=>{
  let clock=1000;
  const req=relay.createRequest({id:'r1',text:' Hello   world ',tone:'warm',locale:'en-us',now:()=>clock});
  assert.strictEqual(req.locale,'en-US');
  assert.strictEqual(req.text,'Hello world');
  assert.strictEqual(relay.claim(req,'worker-a',{now:()=>++clock}).ok,true);
  assert.deepStrictEqual(relay.verifyResult(req,{workerId:'worker-b',locale:'en-US'}),{ok:false,reason:'worker_claim_mismatch'});
  assert.deepStrictEqual(relay.verifyResult(req,{workerId:'worker-a',locale:'tr-TR'}),{ok:false,reason:'locale_mismatch'});
  assert.strictEqual(relay.verifyResult(req,{workerId:'worker-a',locale:'en-us'}).ok,true);
  req.status='ready';
  assert.deepStrictEqual(relay.verifyResult(req,{workerId:'worker-a',locale:'en-US'}),{ok:false,reason:'request_not_claimed_or_terminal'});

  const cancelled=relay.createRequest({id:'r2',text:'Merhaba',locale:'tr-TR',now:()=>clock});
  relay.claim(cancelled,'worker-a',{now:()=>++clock});
  assert.strictEqual(relay.cancel(cancelled,{now:()=>++clock}).ok,true);
  assert.strictEqual(cancelled.status,'cancelled');
  assert.deepStrictEqual(relay.verifyResult(cancelled,{workerId:'worker-a',locale:'tr-TR'}),{ok:false,reason:'request_not_claimed_or_terminal'});

  const voices=[
    {ShortName:'en-US-JennyNeural',Locale:'en-US',Gender:'Female',Enabled:true},
    {ShortName:'en-US-GuyNeural',Locale:'en-US',Gender:'Male',Enabled:true},
    {ShortName:'tr-TR-EmelNeural',Locale:'tr-TR',Gender:'Female',Enabled:true},
    {ShortName:'tr-TR-AhmetNeural',Locale:'tr-TR',Gender:'Male',Enabled:true}
  ];
  let probes=0;
  const router=createRouter({runner:async()=>{probes++;return{ok:true,stdout:JSON.stringify(voices)}},now:()=>clock});
  const en=await router.resolve('en-US');
  assert.strictEqual(en.ok,true);assert.strictEqual(en.voice,'en-US-GuyNeural');assert.strictEqual(en.source,'runtime_voice_inventory');
  const tr=await router.resolve('tr-tr');
  assert.strictEqual(tr.ok,true);assert.strictEqual(tr.voice,'tr-TR-AhmetNeural');
  assert.strictEqual(probes,1,'voice inventory should be cached');
  const unsupported=await router.resolve('de-DE');
  assert.strictEqual(unsupported.ok,false);assert.strictEqual(unsupported.reason,'tts_locale_not_in_runtime_inventory');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(unsupported,'sttSupported'),false,'TTS routing must not assert STT support');

  const server=fs.readFileSync('server.js','utf8'),worker=fs.readFileSync('worker.js','utf8'),ui=fs.readFileSync('public/index.html','utf8');
  assert(server.includes("mobileTtsRelay.verifyResult(r,{workerId:deviceId,locale:d.locale})"),'server must bind result to claimant and locale');
  assert(server.includes("/cancel$/i"),'server must expose cancellation for in-flight mobile TTS');
  assert(worker.includes("mobileTtsVoiceRouter.resolve(locale)"),'worker must resolve exact locale from runtime voice inventory');
  assert(worker.includes("JSON.stringify({id:q.id,locale:q.locale,ok:true,audio})"),'worker must echo synthesized locale');
  assert(ui.includes("body:JSON.stringify({text:String(text||'').trim(),tone,locale})"),'phone UI must preserve requested locale');
  assert(ui.includes("playJarvisMobileRelay(spoken,tone,lang)"),'mobile speech call must forward active language');
  console.log('mobile-tts-relay-selftest: ok');
})().catch(err=>{console.error(err);process.exit(1)});
