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

  // v171: mobile durable mission actions require both a Worker receipt and a
  // fresh state transition. A relay response alone is never success proof.
  const missionId='M-AAAAAAAAAAAA',req='0123456789abcdefabcd';
  const approvalMission={
    id:missionId,
    label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ '+req,
    status:'waiting_dependency',
    step:{name:'youtube_publish',status:'blocked',attempts:1,dependency:'approval'},
    artifacts:[]
  };
  assert.equal(missionActions.cleanMissionId(missionId),missionId);
  assert.equal(missionActions.requestFingerprintFromLabel(approvalMission.label),req);
  assert.deepEqual(missionActions.approvalDescriptor(approvalMission),{id:missionId,req});
  assert.deepEqual(missionActions.actionDescriptor(approvalMission,'approve'),{id:missionId,req,action:'approve',message:'onayla '+missionId+' req '+req});
  assert.deepEqual(missionActions.actionDescriptor(approvalMission,'cancel'),{id:missionId,req,action:'cancel',message:'iptal et '+missionId+' req '+req});
  assert.equal(missionActions.approvalDescriptor({...approvalMission,label:'ONAY · REQ 0123456789'}),null,'legacy 40-bit REQ must fail closed');
  assert.equal(missionActions.approvalDescriptor({...approvalMission,status:'queued'}),null,'non-waiting mission must not expose approval controls');
  assert.equal(missionActions.approvalDescriptor({...approvalMission,step:{...approvalMission.step,status:'pending'}}),null,'non-blocked mission must not expose approval controls');
  assert.equal(missionActions.approvalDescriptor({...approvalMission,step:{...approvalMission.step,dependency:'shopify'}}),null,'non-approval dependency must fail closed');
  const decorated=missionActions.decorateMissionCard('<div class="task local-mission"><small>safe</small></div>',approvalMission);
  assert.ok(decorated.includes('data-jarvis-mission-action="approve"'));
  assert.ok(decorated.includes('data-jarvis-mission-action="cancel"'));
  assert.ok(decorated.includes('data-jarvis-mission-req="'+req+'"'));
  assert.equal((decorated.match(/data-jarvis-mission-action=/g)||[]).length,2);
  assert.equal(missionActions.decorateMissionCard(decorated,approvalMission),decorated,'card decoration must be idempotent');

  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const stateOf=queue=>({workers:{pc:{missions:{queue}}}});
  const fresh=await missionActions.resolveFreshAction(missionId,req,'approve',{
    fetchImpl:async url=>{assert.equal(url,'/api/state');return fakeResponse(true,200,stateOf([approvalMission]))}
  });
  assert.equal(fresh.message,'onayla '+missionId+' req '+req);
  await assert.rejects(
    missionActions.resolveFreshAction(missionId,req,'approve',{fetchImpl:async()=>fakeResponse(true,200,stateOf([{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}]))}),
    /mission_action_stale/
  );
  await assert.rejects(
    missionActions.resolveFreshAction(missionId,req,'approve',{fetchImpl:async()=>fakeResponse(true,200,stateOf([approvalMission,{...approvalMission}]))}),
    /mission_action_ambiguous/
  );

  assert.equal(missionActions.workerReceiptMatches({reply:'AÇIK ONAY UYGULANDI · mission queued'},'approve'),true);
  assert.equal(missionActions.workerReceiptMatches({actionResult:{message:'MISSION İPTAL EDİLDİ · cancelled'}},'cancel'),true);
  assert.equal(missionActions.workerReceiptMatches({reply:'Komut alındı'},'approve'),false,'generic Worker reply is not approval proof');

  let proofClock=0,proofPoll=0;
  const approveProof=await missionActions.waitForStateProof('approve',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf(proofPoll++===0?[approvalMission]:[]))
  });
  assert.equal(approveProof.state,'approval_request_consumed');
  proofClock=0;
  const cancelProof=await missionActions.waitForStateProof('cancel',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf([]))
  });
  assert.equal(cancelProof.state,'mission_closed');

  let relayClock=0,relayPoll=0;
  const verified=await missionActions.relayAndVerify(missionActions.actionDescriptor(approvalMission,'approve'),{
    now:()=>{relayClock+=100;return relayClock},wait:async()=>{},relayTimeoutMs:5000,proofTimeoutMs:5000,
    fetchImpl:async(url,options={})=>{
      if(url==='/api/mobile-brain'){
        assert.equal(options.credentials,'same-origin');
        assert.equal(JSON.parse(options.body).message,'onayla '+missionId+' req '+req);
        return fakeResponse(true,202,{id:'relay-1',status:'queued'});
      }
      if(url==='/api/mobile-brain/relay-1')return fakeResponse(true,200,{status:'ready',result:{ok:true,reply:'AÇIK ONAY UYGULANDI · mission devam'}});
      if(url==='/api/state'){relayPoll++;return fakeResponse(true,200,stateOf(relayPoll===1?[approvalMission]:[]))}
      throw new Error('unexpected url '+url);
    }
  });
  assert.equal(verified.ok,true);assert.equal(verified.proof.state,'approval_request_consumed');

  relayClock=0;
  await assert.rejects(
    missionActions.relayAndVerify(missionActions.actionDescriptor(approvalMission,'approve'),{
      now:()=>{relayClock+=100;return relayClock},wait:async()=>{},relayTimeoutMs:5000,proofTimeoutMs:5000,
      fetchImpl:async url=>url==='/api/mobile-brain'
        ?fakeResponse(true,202,{id:'relay-2'})
        :fakeResponse(true,200,{status:'ready',result:{ok:true,reply:'Komut alındı'}})
    }),
    /mission_action_worker_receipt_missing/,
    'state proof is not attempted without the authoritative Worker receipt'
  );

  let stuckClock=0;
  await assert.rejects(
    missionActions.relayAndVerify(missionActions.actionDescriptor(approvalMission,'approve'),{
      now:()=>{stuckClock+=500;return stuckClock},wait:async()=>{},relayTimeoutMs:5000,proofTimeoutMs:1200,
      fetchImpl:async url=>{
        if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'relay-3'});
        if(url==='/api/mobile-brain/relay-3')return fakeResponse(true,200,{status:'ready',result:{reply:'AÇIK ONAY UYGULANDI'}});
        if(url==='/api/state')return fakeResponse(true,200,stateOf([approvalMission]));
        throw new Error('unexpected url '+url);
      }
    }),
    /mission_approval_state_unconfirmed/,
    'Worker receipt without state transition must fail closed'
  );

  const languageBootstrap=fs.readFileSync('public/language-chat.js','utf8');
  assert.ok(languageBootstrap.includes("script.src='/mission-actions.js'"),'mobile mission action proof module is not loaded');
  assert.ok(languageBootstrap.includes('JarvisMissionActions.install(root)'),'mission action installer is not invoked');
  const server=fs.readFileSync('server.js','utf8'),worker=fs.readFileSync('worker.js','utf8');
  assert.ok(server.includes("if(pathname==='/api/mobile-brain'&&req.method==='POST')"),'authenticated mobile-brain relay endpoint missing');
  assert.ok(worker.includes("const r=await api('/api/worker/mobile-brain-next')"),'Worker does not claim mobile-brain relay');
  assert.ok(worker.includes('let result=await runNativeAgent(q.message,{maxRounds:4})'),'mobile action no longer passes through native agent safety tools');
  assert.ok(worker.includes("message:'AÇIK ONAY UYGULANDI · '"),'approval Worker receipt marker missing');
  assert.ok(worker.includes("'MISSION İPTAL EDİLDİ'"),'cancel Worker receipt marker missing');

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
  console.log('LANGUAGE CHAT UI SELFTEST PASS · speech lifecycle + v171 Worker receipt and durable mission state proof');
})().catch(error=>{console.error(error);process.exitCode=1});
