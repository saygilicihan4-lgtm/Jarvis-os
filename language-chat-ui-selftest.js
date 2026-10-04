'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {createClient}=require('./public/language-chat');
const missionActions=require('./public/mission-actions');
(async()=>{
  let calls=[],states=[],replies=[],playMode='success',finishTurn;
  const response={ok:true,state:'audio-ready',receipt:'r1',locale:'de-DE',voice:'de-DE-ConradNeural',reply:'Hallo',audio:'SUQz',mime:'audio/mpeg'};
  const request=async(data,signal)=>{
    calls.push(data);
    if(data.action==='create')return{ok:true,sessionId:'session'};
    if(data.action==='turn'&&playMode==='delayed')return new Promise(resolve=>finishTurn=()=>resolve(response));
    if(data.action==='turn')return response;
    return{ok:true};
  };
  const client=createClient({request,play:async()=>{if(playMode==='failure')throw new Error('autoplay_blocked')},onState:s=>states.push(s),onReply:x=>replies.push(x)});
  await client.run();assert.equal(client.busy,false);assert.equal(calls.filter(x=>x.played===true).length,1);assert.ok(states.includes('completed'));
  calls=[];states=[];playMode='failure';await client.run();
  assert.equal(calls.some(x=>x.played===true),false,'failed playback never reports success');assert.equal(calls.filter(x=>x.played===false).length,1);
  assert.ok(states.includes('error'));
  calls=[];states=[];replies=[];playMode='delayed';const pending=client.run();
  assert.equal(client.busy,true);await client.cancel();finishTurn();await pending;
  assert.equal(replies.length,0,'late response after cancellation cannot play or display');assert.equal(calls.some(x=>x.played===true),false);
  assert.equal(client.busy,false);
  const confirm=createClient({request:async d=>d.action==='create'?{sessionId:'s'}:{ok:true,state:'confirm-language'},play:async()=>assert.fail('ambiguous language must not play')});
  await confirm.run();assert.equal(confirm.busy,false);

  // v170: mobile Mission Queue actions are only derived from sanitized durable
  // mission telemetry. PUBLIC approval carries the exact v169 80-bit REQ marker;
  // the cloud/mobile UI never manufactures a fresh approval fingerprint.
  const missionId='M-AAAAAAAAAAAA';
  const req='0123456789abcdefabcd';
  const approvalMission={
    id:missionId,
    label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ '+req,
    status:'waiting_dependency',
    step:{name:'youtube_publish',status:'blocked',error:{dependency:'approval'}}
  };
  assert.equal(missionActions.cleanMissionId(missionId),missionId);
  assert.equal(missionActions.cleanMissionId('M-bad'), '');
  assert.equal(missionActions.requestFingerprintFromLabel(approvalMission.label),req);
  assert.deepEqual(missionActions.approvalDescriptor(approvalMission),{
    id:missionId,req,message:'onayla '+missionId+' req '+req
  });
  assert.equal(missionActions.approvalDescriptor({...approvalMission,label:'ONAY · REQ 0123456789'}),null,'legacy 40-bit REQ must not create an approval button');
  assert.equal(missionActions.approvalDescriptor({...approvalMission,status:'queued'}),null,'non-waiting mission must not expose approve');
  assert.equal(missionActions.approvalDescriptor({...approvalMission,step:{error:{dependency:'shopify'}}}),null,'non-approval dependency must not expose approve');
  assert.equal(missionActions.cancelDescriptor({...approvalMission,status:'completed'}),null,'terminal mission cannot be cancelled');
  assert.deepEqual(missionActions.cancelDescriptor({...approvalMission,status:'queued'}),{id:missionId,message:'görevi iptal et '+missionId});
  const decorated=missionActions.decorateMissionCard('<div class="task local-mission"><small>safe</small></div>',approvalMission);
  assert.ok(decorated.includes('data-jarvis-mission-action="approve"'));
  assert.ok(decorated.includes('data-jarvis-mission-action="cancel"'));
  assert.ok(decorated.includes('data-jarvis-mission-req="'+req+'"'));
  assert.equal((decorated.match(/data-jarvis-mission-action=/g)||[]).length,2);
  assert.equal(missionActions.decorateMissionCard(decorated,approvalMission),decorated,'card decoration must be idempotent');

  const relayCalls=[];let clock=0,poll=0;
  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const relay=await missionActions.relayMessage('onayla '+missionId+' req '+req,{
    timeoutMs:5000,
    now:()=>{clock+=100;return clock},
    wait:async()=>{},
    fetchImpl:async(url,options={})=>{
      relayCalls.push({url,options});
      if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'relay-1',status:'queued'});
      poll++;
      return poll===1?fakeResponse(true,200,{status:'claimed'}):fakeResponse(true,200,{status:'ready',result:{ok:true,message:'AÇIK ONAY UYGULANDI'}});
    }
  });
  assert.equal(relay.ok,true);assert.equal(relay.result.message,'AÇIK ONAY UYGULANDI');
  assert.equal(relayCalls[0].options.credentials,'same-origin');
  assert.equal(JSON.parse(relayCalls[0].options.body).message,'onayla '+missionId+' req '+req);
  assert.equal(relayCalls.filter(x=>x.url==='/api/mobile-brain/relay-1').length,2);

  const languageBootstrap=fs.readFileSync('public/language-chat.js','utf8');
  assert.ok(languageBootstrap.includes("script.src='/mission-actions.js'"),'mobile mission action script is not loaded');
  assert.ok(languageBootstrap.includes('JarvisMissionActions.install(root)'),'mission action installer is not invoked');

  // Exercise the actual page's playback adapter with a fake HTMLAudioElement.
  const html=fs.readFileSync('public/index.html','utf8');
  const start=html.indexOf('function playLanguageConversationAudio('),end=html.indexOf('async function runLanguageChat()',start);
  assert.ok(start>0&&end>start);
  const audios=[],revoked=[],timers=[];let mode='ended';
  class Audio{
    constructor(){audios.push(this)}
    pause(){this.paused=true}
    play(){
      if(mode==='throw')throw new Error('sync_play_failure');
      if(mode==='reject')return Promise.reject(new Error('blocked'));
      if(mode==='ended')queueMicrotask(()=>this.onended?.());
      return Promise.resolve();
    }
  }
  const scope={Audio,Uint8Array,Blob,atob,Promise,Error,URL:{createObjectURL:()=>String(audios.length),revokeObjectURL:url=>revoked.push(url)},
    document:{body:{classList:{add(){},remove(){}}}},setTimeout:fn=>{const t={fn};timers.push(t);return t},clearTimeout:t=>t.cleared=true};
  vm.runInNewContext(html.slice(start,end),scope);
  await scope.playLanguageConversationAudio(response,new AbortController().signal);
  assert.equal(revoked.length,1);assert.equal(audios[0].paused,true);
  mode='reject';await assert.rejects(scope.playLanguageConversationAudio(response,new AbortController().signal),/blocked/);
  mode='throw';await assert.rejects(scope.playLanguageConversationAudio(response,new AbortController().signal),/sync_play_failure/);
  mode='wait';const controller=new AbortController();const playing=scope.playLanguageConversationAudio(response,controller.signal);controller.abort();
  await assert.rejects(playing,/cancelled/);assert.equal(revoked.length,4);assert.ok(timers.every(t=>t.cleared));
  const waiting=scope.playLanguageConversationAudio(response,new AbortController().signal);timers.at(-1).fn();await assert.rejects(waiting,/timeout/);
  assert.ok(html.includes("if(document.hidden)languageChatClient?.cancel()"));
  assert.ok(html.includes("if(!ok)languageChatClient?.cancel()"));
  assert.ok(html.includes('languageChatStarting=true'));
  console.log('LANGUAGE CHAT UI SELFTEST PASS · speech lifecycle + v170 mobile mission approve/cancel relay guards');
})().catch(error=>{console.error(error);process.exitCode=1});
