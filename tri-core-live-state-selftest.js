'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const cognitive=require('./jarvis-tri-core-cognitive-state');
const relay=require('./jarvis-mobile-language-relay');
const desktop=require('./jarvis-language-conversation');
const mobile=require('./jarvis-mobile-language-conversation');
const browser=require('./public/language-chat.js');

(async()=>{
  const malicious={phase:'consulting',primary:'jarvis',consulting:['orion','orion','jarvis','evil'],completed:['nova'],revision:7,authority:'evil',transcript:'TOPSECRET',reply:'LEAK',note:'HIDDEN',token:'TOKEN',missionInput:'MISSION'};
  const safe=cognitive.sanitize(malicious);
  assert.deepEqual(Object.keys(safe).sort(),['authority','completed','consulting','phase','primary','revision']);
  assert.deepEqual([...safe.consulting],['orion']);assert.deepEqual([...safe.completed],['nova']);assert.equal(safe.authority,'shared_guardrail_only');
  assert.equal(safe.transcript,undefined);assert.equal(safe.reply,undefined);assert.equal(safe.note,undefined);assert.equal(safe.token,undefined);assert.equal(safe.missionInput,undefined);
  assert.equal(cognitive.isPublicShape(safe),true);assert.equal(cognitive.uiState('consulting'),'thinking');assert.equal(cognitive.uiState('synthesizing'),'thinking');
  const newer=cognitive.next(safe,{phase:'synthesizing',primary:'jarvis',completed:['orion']});assert.equal(newer.revision,8);

  let nowMs=1_000;
  const request=relay.createRequest({id:'r1',text:'secret request text',locale:'tr-TR',history:[{role:'user',content:'private history'}],now:()=>nowMs});
  const initial=relay.getCognitive(request);assert.equal(initial.phase,'waiting');assert.equal(initial.revision,0);assert.equal(JSON.stringify(initial).includes('secret request text'),false);
  assert.equal(relay.updateCognitive(request,{workerId:'pc-a',state:safe}).ok,false,'unclaimed request must reject cognitive update');
  assert.equal(relay.claim(request,'pc-a',{now:()=>++nowMs}).ok,true);
  assert.equal(relay.updateCognitive(request,{workerId:'pc-b',state:safe}).reason,'worker_claim_mismatch');
  const updated=relay.updateCognitive(request,{workerId:'pc-a',state:malicious});assert.equal(updated.ok,true);assert.equal(updated.cognitive.phase,'consulting');assert.deepEqual([...updated.cognitive.consulting],['orion']);
  assert.deepEqual(Object.keys(updated.cognitive).sort(),['authority','completed','consulting','phase','primary','revision']);
  for(const forbidden of ['TOPSECRET','LEAK','HIDDEN','TOKEN','MISSION'])assert(!JSON.stringify(updated.cognitive).includes(forbidden),'relay leaked '+forbidden);
  const previousRevision=updated.cognitive.revision;
  const updated2=relay.updateCognitive(request,{workerId:'pc-a',state:{phase:'synthesizing',primary:'jarvis',completed:['orion']}});assert(updated2.cognitive.revision>previousRevision,'server-side relay revision must increase monotonically');

  const captured=[];const callback=mobile.safeStateCallback(value=>captured.push(value));callback(malicious);
  assert.equal(captured.length,1);assert.deepEqual(Object.keys(captured[0]).sort(),['authority','completed','consulting','phase','primary','revision']);assert(!JSON.stringify(captured[0]).includes('TOPSECRET'));

  let releaseGenerate,enteredGenerate;
  const generateEntered=new Promise(resolve=>{enteredGenerate=resolve});
  const runtime={
    create:()=>({sessionId:'session-1'}),probe:async()=>({ok:true}),
    listen:async()=>({speech:{ok:true},decision:{ok:true,candidateCount:1,candidateLocale:'tr-TR'},context:{locale:'tr-TR'},text:'Jarvis bu race condition kök nedenini analiz et'}),
    begin:()=>({ok:true,turnId:'turn-1',context:{locale:'tr-TR'},speech:{voice:'tr-TR-AhmetNeural'}}),
    complete:()=>({ok:true}),discardCapture:()=>({ok:true})
  };
  const output={
    generate:async args=>{args.onCognitiveState({phase:'consulting',primary:'jarvis',consulting:['orion'],completed:[],transcript:'MUST_DROP'});enteredGenerate();await new Promise(resolve=>{releaseGenerate=resolve});args.onCognitiveState({phase:'synthesizing',primary:'jarvis',completed:['orion']});return{reply:'Tek yanıt',locale:'tr-TR',core:'jarvis',authority:'shared_guardrail_only',consultedWith:['orion']};},
    render:async()=>({audio:'AA==',locale:'tr-TR',voice:'tr-TR-AhmetNeural'})
  };
  const conversation=desktop.createConversation({runtime,output,now:()=>nowMs});conversation.create({requested:'tr-TR'});
  const turnPromise=conversation.turn('session-1');await generateEntered;
  const live=conversation.state('session-1');assert.equal(live.state,'cognitive-state');assert.equal(live.cognitive.phase,'consulting');assert.equal(live.cognitive.primary,'jarvis');assert.deepEqual([...live.cognitive.consulting],['orion']);assert.equal(JSON.stringify(live.cognitive).includes('MUST_DROP'),false);
  releaseGenerate();const turn=await turnPromise;assert.equal(turn.state,'audio-ready');assert.deepEqual(turn.consultWith,['orion']);assert.equal(conversation.state('session-1').cognitive.phase,'waiting');
  conversation.acknowledge('session-1',{receipt:turn.receipt,played:true});assert.equal(conversation.state('session-1').cognitive.phase,'idle');

  const browserSafe=browser.cognitiveDetail(malicious);assert.equal(browserSafe.state,'thinking');assert.equal(browserSafe.core,'jarvis');assert.deepEqual(browserSafe.consultWith,['orion','nova']);assert.equal(browserSafe.authority,'shared_guardrail_only');assert.equal(browserSafe.transcript,undefined);

  const worker=fs.readFileSync('worker.js','utf8'),server=fs.readFileSync('server.js','utf8'),index=fs.readFileSync('public/index.html','utf8'),chat=fs.readFileSync('public/language-chat.js','utf8'),contract=fs.readFileSync('jarvis-tri-core-cognitive-state.js','utf8');
  assert(worker.includes("case 'state':result=conversation.state(sessionId);break;"),'desktop Worker state action missing');
  assert(worker.includes("api('/api/worker/mobile-language-state'"),'mobile Worker state transport missing');
  assert(worker.includes("authority:'shared_guardrail_only'"),'Worker cognitive payload authority pin missing');
  const workerStateSegment=worker.slice(worker.indexOf('const pushCognitive=raw=>'),worker.indexOf("await api('/api/worker/mobile-language-result",worker.indexOf('const pushCognitive=raw=>')));
  assert(workerStateSegment&&!/JSON\.stringify\([^)]*(transcript|reply|note|mission|token)/i.test(workerStateSegment),'Worker state transport must not serialize sensitive fields');
  assert(server.includes("pathname==='/api/worker/mobile-language-state'"),'server Worker state endpoint missing');
  assert(server.includes('mobileLanguageRelay.updateCognitive(r,{workerId:deviceId,state:d.state})'),'server must re-sanitize state through relay');
  assert(server.includes('const cognitive=mobileLanguageRelay.getCognitive(r);'),'mobile poll must expose safe cognitive snapshot');
  assert(index.includes('function applyMobileTriCoreCognitive(value)'),'mobile browser cognitive mapper missing');
  const mobileMapper=index.slice(index.indexOf('function applyMobileTriCoreCognitive'),index.indexOf('async function mobileLanguageConversationRequest'));
  assert(mobileMapper&&!/(transcript|reply|note|missionInput|token)/.test(mobileMapper),'mobile mapper must not consume sensitive fields');
  assert(chat.includes("request({action:'state',sessionId}"),'desktop browser live state polling missing');
  assert(!contract.includes('localStorage')&&!contract.includes('sessionStorage')&&!contract.includes('console.log'),'cognitive state contract must be ephemeral and silent');
  console.log('TRI-CORE v181 LIVE COGNITIVE STATE TRANSPORT SELFTEST PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
