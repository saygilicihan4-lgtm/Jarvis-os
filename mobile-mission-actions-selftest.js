'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const missionActions=require('./public/mission-actions');

(async()=>{
  const missionId='M-AAAAAAAAAAAA';
  const req='0123456789abcdefabcd';
  const approvalMission={
    id:missionId,
    label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ '+req,
    status:'waiting_dependency',
    step:{name:'youtube_publish',status:'blocked',attempts:1,dependency:'approval'},
    artifacts:[]
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
  assert.equal(missionActions.resolveMissionFromQueue([approvalMission],req,missionId).id,missionId);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,'M-BBBBBBBBBBBB'),/mission_approval_stale/);

  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const statePayload={workers:{pc:{missions:{queue:[approvalMission]}}}};
  const stateCalls=[];
  const fresh=await missionActions.resolveFreshMission(req,{
    fetchImpl:async(url,options)=>{
      stateCalls.push({url,options});
      return fakeResponse(true,200,statePayload);
    }
  });
  assert.equal(fresh.id,missionId);
  assert.equal(stateCalls.length,1);
  assert.equal(stateCalls[0].url,'/api/state');
  assert.equal(stateCalls[0].options.credentials,'same-origin');
  assert.equal(stateCalls[0].options.cache,'no-store');

  // v172: bind the rendered card to the same current queue row before relay.
  const labelNode={textContent:approvalMission.label};
  const statusNode={textContent:''};
  const card={
    textContent:approvalMission.label,
    dataset:{},style:{},scrolled:null,
    querySelector(selector){return selector==='.task-head b'?labelNode:null},
    querySelectorAll(){return[]},
    scrollIntoView(options){this.scrolled=options||true}
  };
  const fakeRoot={
    location:{search:'?mission='+missionId},
    document:{
      querySelectorAll(selector){return selector==='.local-mission'?[card]:[]},
      getElementById(id){return id==='consoleStatus'?statusNode:null}
    },
    setTimeout(){return 1}
  };
  const bound=missionActions.missionForCard([approvalMission],card,fakeRoot);
  assert.equal(bound.id,missionId);
  const cardFresh=await missionActions.resolveFreshMission(req,{
    targetRoot:fakeRoot,card,
    fetchImpl:async()=>fakeResponse(true,200,statePayload)
  });
  assert.equal(cardFresh.id,missionId);
  labelNode.textContent='Different mission label';
  await assert.rejects(
    missionActions.resolveFreshMission(req,{targetRoot:fakeRoot,card,fetchImpl:async()=>fakeResponse(true,200,statePayload)}),
    /mission_approval_stale/,
    'stale or reordered rendered card must fail before relay'
  );
  labelNode.textContent=approvalMission.label;
  assert.equal(missionActions.missionIdFromSearch('?mission='+missionId),missionId);
  assert.equal(missionActions.missionIdFromSearch('?mission=M-bad'),'');
  assert.equal(missionActions.missionIdFromLocation(fakeRoot),missionId);
  const focused=await missionActions.focusMissionById(missionId,{
    targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,statePayload)
  });
  assert.equal(focused.id,missionId);
  assert.equal(focused.index,0);
  assert.equal(card.dataset.jarvisMissionId,missionId);
  assert.equal(card.dataset.jarvisMissionFocused,'1');
  assert.deepEqual(card.scrolled,{behavior:'smooth',block:'center'});
  await assert.rejects(
    missionActions.focusMissionById('M-BBBBBBBBBBBB',{targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,statePayload)}),
    /mission_deeplink_stale/
  );

  const relayCalls=[];let poll=0,clock=0;
  const relayResult=await missionActions.runMobileBrain('onayla '+missionId+' req '+req,{
    timeoutMs:5000,
    now:()=>{clock+=100;return clock},
    wait:async()=>{},
    fetchImpl:async(url,options={})=>{
      relayCalls.push({url,options});
      if(url==='/api/mobile-brain')return fakeResponse(true,202,{id:'abcd1234-abcd'});
      poll++;
      return poll===1
        ?fakeResponse(true,200,{status:'claimed'})
        :fakeResponse(true,200,{status:'ready',result:{ok:true,message:'AÇIK ONAY UYGULANDI'}});
    }
  });
  assert.equal(relayResult.message,'AÇIK ONAY UYGULANDI');
  assert.equal(relayCalls[0].options.credentials,'same-origin');
  assert.equal(relayCalls[0].options.cache,'no-store');
  assert.equal(JSON.parse(relayCalls[0].options.body).message,'onayla '+missionId+' req '+req);
  assert.equal(relayCalls.filter(call=>call.url==='/api/mobile-brain/abcd1234-abcd').length,2);

  let sent=false;
  await assert.rejects(
    missionActions.resolveFreshMission(req,{
      fetchImpl:async()=>{
        sent=true;
        return fakeResponse(true,200,{workers:{pc:{missions:{queue:[{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}]}}}});
      }
    }),
    /mission_approval_stale/
  );
  assert.equal(sent,true,'freshness check must consult current state');

  // Service Worker deep-links only active mission notifications. Completed
  // missions are no longer in the open queue, so they correctly fall back home.
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

  console.log('MOBILE MISSION ACTIONS SELFTEST PASS · v172 exact card binding + active mission notification deep links');
})().catch(error=>{console.error(error);process.exitCode=1});