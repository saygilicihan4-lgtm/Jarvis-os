'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const missionActions=require('./public/mission-actions');

(async()=>{
  const missionId='M-AAAAAAAAAAAA';
  const otherMissionId='M-BBBBBBBBBBBB';
  const req='0123456789abcdefabcd';
  const approvalMission={
    id:missionId,
    label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ '+req,
    status:'waiting_dependency',
    step:{name:'youtube_publish',status:'blocked',attempts:1,dependency:'approval'},
    artifacts:[]
  };
  const otherMission={
    ...approvalMission,
    id:otherMissionId,
    label:'ONAY · SHOPIFY PUBLIC · Other · 15 DK · REQ '+req
  };

  assert.equal(missionActions.reqFromText(approvalMission.label),req);
  assert.equal(missionActions.reqFromText('ONAY · REQ 0123456789'),'','legacy 40-bit fingerprint must not authorize mobile controls');
  assert.equal(missionActions.cleanMissionId(missionId),missionId);
  assert.equal(missionActions.cleanMissionId('M-bad'),'');
  assert.equal(missionActions.approvalDependency(approvalMission),true);
  assert.equal(missionActions.approvalDependency({...approvalMission,status:'queued'}),false);
  assert.equal(missionActions.approvalDependency({...approvalMission,step:{...approvalMission.step,status:'running'}}),false);
  assert.equal(missionActions.approvalDependency({...approvalMission,step:{...approvalMission.step,dependency:'shopify'}}),false);
  assert.equal(missionActions.activeMission({...approvalMission,status:'completed'}),false);

  const resolved=missionActions.resolveMissionFromQueue([approvalMission],req);
  assert.equal(resolved.id,missionId);
  assert.equal(resolved.req,req);
  assert.equal(missionActions.commandFor('approve',resolved),'onayla '+missionId+' req '+req);
  assert.equal(missionActions.commandFor('cancel',resolved),'iptal et '+missionId+' req '+req);
  assert.throws(()=>missionActions.commandFor('publish',resolved),/mission_action_unknown/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],'0123456789'),/mission_approval_fingerprint_invalid/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}],req),/mission_approval_stale/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission,{...approvalMission}],req),/mission_approval_ambiguous/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([{...approvalMission,id:'M-bad'}],req),/mission_id_invalid/);

  // v173: exact ID + rendered label disambiguates identical REQ values without
  // trusting queue/DOM position. Any stale component fails closed.
  const exact=missionActions.resolveMissionFromQueue([otherMission,approvalMission],req,{missionId,label:approvalMission.label});
  assert.equal(exact.id,missionId);
  assert.equal(exact.label,approvalMission.label);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId:otherMissionId,label:approvalMission.label}),/mission_approval_stale/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId,label:'Different label'}),/mission_approval_stale/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId:'M-bad',label:approvalMission.label}),/mission_action_target_invalid/);

  const rawCard='<div class="task local-mission"><div class="task-head"><b>x</b></div></div>';
  const boundHtml=missionActions.bindMissionCardHtml(rawCard,approvalMission);
  assert.ok(boundHtml.includes('data-jarvis-mission-id="'+missionId+'"'));
  assert.equal(missionActions.bindMissionCardHtml(boundHtml,approvalMission),boundHtml,'card id binding must be idempotent');
  assert.equal(missionActions.bindMissionCardHtml(rawCard,{...approvalMission,id:'M-bad'}),rawCard,'invalid mission id must not enter DOM markup');

  let rendered=0;
  const installRoot={
    location:{search:''},
    document:{getElementById:id=>id==='tasks'?{}:null,querySelectorAll:()=>[]},
    localMissionCard:()=>rawCard,
    renderMissionQueue(){rendered++},
    setTimeout(){return 1}
  };
  assert.equal(missionActions.install(installRoot),true);
  assert.equal(rendered,1,'install must re-render after binding mission IDs');
  assert.ok(installRoot.localMissionCard(approvalMission).includes('data-jarvis-mission-id="'+missionId+'"'));

  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const stateOf=queue=>({workers:{pc:{online:true,missions:{ok:true,openCount:queue.length,queue}}}});
  const stateCalls=[];
  const fresh=await missionActions.resolveFreshMission(req,{
    fetchImpl:async(url,options)=>{
      stateCalls.push({url,options});
      return fakeResponse(true,200,stateOf([approvalMission]));
    }
  });
  assert.equal(fresh.id,missionId);
  assert.equal(stateCalls.length,1);
  assert.equal(stateCalls[0].url,'/api/state');
  assert.equal(stateCalls[0].options.credentials,'same-origin');
  assert.equal(stateCalls[0].options.cache,'no-store');

  const exactState=stateOf([otherMission,approvalMission]);
  const exactFresh=await missionActions.resolveFreshMission(req,{
    missionId,label:approvalMission.label,
    fetchImpl:async()=>fakeResponse(true,200,exactState)
  });
  assert.equal(exactFresh.id,missionId,'fresh exact target must survive queue reordering');

  const labelNode={textContent:approvalMission.label};
  const approvalCard={
    textContent:approvalMission.label,
    dataset:{jarvisMissionId:missionId},style:{},scrolled:null,
    querySelector(selector){return selector==='.task-head b'?labelNode:null},
    querySelectorAll(){return[]},
    scrollIntoView(options){this.scrolled=options||true}
  };
  const otherLabelNode={textContent:otherMission.label};
  const otherCard={
    textContent:otherMission.label,
    dataset:{jarvisMissionId:otherMissionId},style:{},
    querySelector(selector){return selector==='.task-head b'?otherLabelNode:null},
    querySelectorAll(){return[]},scrollIntoView(){}
  };
  const statusNode={textContent:''};
  const fakeRoot={
    location:{search:'?mission='+missionId},
    document:{
      querySelectorAll(selector){return selector==='.local-mission'?[approvalCard,otherCard]:[]},
      getElementById(id){return id==='consoleStatus'?statusNode:null}
    },
    setTimeout(){return 1}
  };
  assert.equal(missionActions.missionIdFromSearch('?mission='+missionId),missionId);
  assert.equal(missionActions.missionIdFromSearch('?mission=M-bad'),'');
  assert.equal(missionActions.missionIdFromLocation(fakeRoot),missionId);
  const focused=await missionActions.focusMissionById(missionId,{
    targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,exactState)
  });
  assert.equal(focused.id,missionId);
  assert.equal(focused.card,approvalCard,'data-bound mission ID must win independently of queue order');
  assert.equal(approvalCard.dataset.jarvisMissionFocused,'1');
  assert.deepEqual(approvalCard.scrolled,{behavior:'smooth',block:'center'});
  await assert.rejects(
    missionActions.focusMissionById('M-CCCCCCCCCCCC',{targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,exactState)}),
    /mission_deeplink_stale/
  );
  labelNode.textContent='Different mission label';
  await assert.rejects(
    missionActions.focusMissionById(missionId,{targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,exactState)}),
    /mission_deeplink_card_mismatch/
  );
  labelNode.textContent=approvalMission.label;

  // v172 proof contract remains mandatory after the v173 exact-card preflight.
  assert.equal(missionActions.workerReceiptMatches({message:'AÇIK ONAY UYGULANDI · completed'},'approve'),true);
  assert.equal(missionActions.workerReceiptMatches({reply:'MISSION İPTAL EDİLDİ · cancelled'},'cancel'),true);
  assert.equal(missionActions.workerReceiptMatches({actionResult:{message:'AÇIK ONAY UYGULANDI · nested'}},'approve'),true);
  assert.equal(missionActions.workerReceiptMatches({actionResults:[{message:'MISSION İPTAL EDİLDİ · nested'}]},'cancel'),true);
  assert.equal(missionActions.workerReceiptMatches({reply:'Komut alındı.'},'approve'),false,'generic Worker reply is not approval proof');

  let proofClock=0,approvalStatePoll=0;
  const approvalProof=await missionActions.waitForActionProof('approve',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf(approvalStatePoll++===0?[approvalMission]:[]))
  });
  assert.equal(approvalProof.state,'approval_request_consumed');

  proofClock=0;
  const refreshedMission={...approvalMission,label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ fedcba9876543210abcd'};
  const refreshedProof=await missionActions.waitForActionProof('approve',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf([refreshedMission]))
  });
  assert.equal(refreshedProof.state,'approval_request_consumed');
  assert.equal(refreshedProof.missionPresent,true);

  proofClock=0;
  const cancelProof=await missionActions.waitForActionProof('cancel',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf([]))
  });
  assert.equal(cancelProof.state,'mission_closed');

  const relayCalls=[];let relayPoll=0,statePoll=0,clock=0;
  const verifiedApproval=await missionActions.runActionWithProof('approve',exact,{
    relayTimeoutMs:5000,proofTimeoutMs:5000,
    now:()=>{clock+=100;return clock},wait:async()=>{},
    fetchImpl:async(url,options={})=>{
      relayCalls.push({url,options});
      if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'abcd1234-abcd'});
      if(url==='/api/mobile-brain/abcd1234-abcd'){
        relayPoll++;
        return relayPoll===1
          ?fakeResponse(true,200,{status:'claimed'})
          :fakeResponse(true,200,{status:'ready',result:{ok:true,reply:'AÇIK ONAY UYGULANDI · mission completed'}});
      }
      if(url==='/api/state'){
        statePoll++;
        return fakeResponse(true,200,stateOf(statePoll===1?[approvalMission]:[]));
      }
      throw new Error('unexpected url '+url);
    }
  });
  assert.equal(verifiedApproval.ok,true);
  assert.equal(verifiedApproval.proof.state,'approval_request_consumed');
  assert.equal(relayCalls[0].options.credentials,'same-origin');
  assert.equal(relayCalls[0].options.cache,'no-store');
  assert.equal(JSON.parse(relayCalls[0].options.body).message,'onayla '+missionId+' req '+req);

  let cancelClock=0,cancelStatePoll=0;
  const verifiedCancel=await missionActions.runActionWithProof('cancel',exact,{
    relayTimeoutMs:5000,proofTimeoutMs:5000,
    now:()=>{cancelClock+=100;return cancelClock},wait:async()=>{},
    fetchImpl:async(url)=>{
      if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'dcba4321-dcba'});
      if(url==='/api/mobile-brain/dcba4321-dcba')return fakeResponse(true,200,{status:'ready',result:{actionResult:{message:'MISSION İPTAL EDİLDİ · cancelled'}}});
      if(url==='/api/state'){
        cancelStatePoll++;
        return fakeResponse(true,200,stateOf(cancelStatePoll===1?[approvalMission]:[]));
      }
      throw new Error('unexpected url '+url);
    }
  });
  assert.equal(verifiedCancel.ok,true);
  assert.equal(verifiedCancel.proof.state,'mission_closed');

  let missingReceiptClock=0;
  await assert.rejects(
    missionActions.runActionWithProof('approve',exact,{
      relayTimeoutMs:5000,proofTimeoutMs:5000,
      now:()=>{missingReceiptClock+=100;return missingReceiptClock},wait:async()=>{},
      fetchImpl:async url=>{
        if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'feed1234-feed'});
        if(url==='/api/mobile-brain/feed1234-feed')return fakeResponse(true,200,{status:'ready',result:{ok:true,reply:'Komut alındı.'}});
        throw new Error('state proof must not run without Worker receipt');
      }
    }),
    /mission_action_worker_receipt_missing/
  );

  let stuckClock=0;
  await assert.rejects(
    missionActions.runActionWithProof('approve',exact,{
      relayTimeoutMs:5000,proofTimeoutMs:1200,
      now:()=>{stuckClock+=500;return stuckClock},wait:async()=>{},
      fetchImpl:async url=>{
        if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'cafe1234-cafe'});
        if(url==='/api/mobile-brain/cafe1234-cafe')return fakeResponse(true,200,{status:'ready',result:{message:'AÇIK ONAY UYGULANDI · queued'}});
        if(url==='/api/state')return fakeResponse(true,200,stateOf([approvalMission]));
        throw new Error('unexpected url '+url);
      }
    }),
    /mission_approval_state_unconfirmed/
  );

  let consulted=false;
  await assert.rejects(
    missionActions.resolveFreshMission(req,{
      missionId,label:approvalMission.label,
      fetchImpl:async()=>{
        consulted=true;
        return fakeResponse(true,200,stateOf([{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}]));
      }
    }),
    /mission_approval_stale/
  );
  assert.equal(consulted,true,'freshness check must consult current state');

  const serviceWorker=fs.readFileSync('./public/sw.js','utf8');
  assert.doesNotThrow(()=>new Function(serviceWorker));
  const helperSource=serviceWorker.slice(0,serviceWorker.indexOf("self.addEventListener('push'"));
  const helpers=new Function(helperSource+';return {missionIdFromTag,completedMissionTitle,safeNotificationUrl};')();
  assert.equal(helpers.missionIdFromTag('jarvis-mission-'+missionId),missionId);
  assert.equal(helpers.missionIdFromTag('jarvis-mission-bad'),'');
  assert.equal(helpers.safeNotificationUrl('/','jarvis-mission-'+missionId,'JARVIS · Görev doğrulama bekliyor'),'/?mission='+missionId);
  assert.equal(helpers.safeNotificationUrl('/','jarvis-mission-'+missionId,'JARVIS · Görev bağlantı bekliyor'),'/?mission='+missionId);
  assert.equal(helpers.safeNotificationUrl('/','jarvis-mission-'+missionId,'JARVIS · Kalıcı görev tamamlandı'),'/');
  assert.equal(helpers.safeNotificationUrl('/reminders','jarvis-reminder','Hatırlatma'),'/reminders');
  assert.equal(helpers.safeNotificationUrl('https://evil.example','jarvis-reminder','Hatırlatma'),'/');
  assert.equal(helpers.safeNotificationUrl('//evil.example','jarvis-reminder','Hatırlatma'),'/');
  assert.equal(helpers.safeNotificationUrl('/'+String.fromCharCode(92)+'evil.example','jarvis-reminder','Hatırlatma'),'/', 'backslash URL must fail closed');
  assert.equal(helpers.safeNotificationUrl('/ok\r\nInjected','jarvis-reminder','Hatırlatma'),'/', 'CRLF URL must fail closed');
  assert.ok(serviceWorker.includes('safeNotificationUrl(data.url,event.notification.tag'),'notification click must re-validate stored URL + tag');

  console.log('MOBILE MISSION ACTIONS SELFTEST PASS · v173 exact ID+label+REQ + Worker receipt + durable state proof + safe deep links');
})().catch(error=>{console.error(error);process.exitCode=1});
