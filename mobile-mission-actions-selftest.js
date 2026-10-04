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

  const exact=missionActions.resolveMissionFromQueue([otherMission,approvalMission],req,{missionId,label:approvalMission.label});
  assert.equal(exact.id,missionId,'exact ID + label must resolve independently of queue order');
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId:otherMissionId,label:approvalMission.label}),/mission_approval_stale/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId,label:'Different label'}),/mission_approval_stale/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission],req,{missionId:'M-bad',label:approvalMission.label}),/mission_action_target_invalid/);
  assert.throws(()=>missionActions.resolveMissionFromQueue([approvalMission,{...approvalMission}],req,{missionId,label:approvalMission.label}),/mission_approval_ambiguous/);

  const rawCard='<div class="task local-mission"><div class="task-head"><b>x</b></div></div>';
  const boundHtml=missionActions.bindMissionCardHtml(rawCard,approvalMission);
  assert.ok(boundHtml.includes('data-jarvis-mission-id="'+missionId+'"'),'renderer must bind strict mission id into the card');
  assert.equal(missionActions.bindMissionCardHtml(boundHtml,approvalMission),boundHtml,'card id binding must be idempotent');
  assert.equal(missionActions.bindMissionCardHtml(rawCard,{...approvalMission,id:'M-bad'}),rawCard,'invalid mission id must never enter DOM markup');

  let rendered=0;
  const installRoot={
    location:{search:''},
    document:{getElementById:id=>id==='tasks'?{}:null,querySelectorAll:()=>[]},
    localMissionCard:()=>rawCard,
    renderMissionQueue(){rendered++},
    setTimeout(){return 1}
  };
  assert.equal(missionActions.install(installRoot),true);
  assert.equal(rendered,1,'install must re-render once after wrapping the mission card renderer');
  assert.ok(installRoot.localMissionCard(approvalMission).includes('data-jarvis-mission-id="'+missionId+'"'));

  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const statePayload={workers:{pc:{missions:{queue:[otherMission,approvalMission]}}}};
  const stateCalls=[];
  const fresh=await missionActions.resolveFreshMission(req,{
    missionId,label:approvalMission.label,
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

  const labelNode={textContent:approvalMission.label};
  const statusNode={textContent:''};
  const approvalCard={
    textContent:approvalMission.label,
    dataset:{jarvisMissionId:missionId},style:{},scrolled:null,
    querySelector(selector){return selector==='.task-head b'?labelNode:null},
    querySelectorAll(){return[]},
    scrollIntoView(options){this.scrolled=options||true}
  };
  const otherLabel={textContent:otherMission.label};
  const otherCard={
    textContent:otherMission.label,
    dataset:{jarvisMissionId:otherMissionId},style:{},
    querySelector(selector){return selector==='.task-head b'?otherLabel:null},
    querySelectorAll(){return[]},scrollIntoView(){}
  };
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

  // Queue order intentionally differs from DOM order. Exact data-bound ID must win.
  const focused=await missionActions.focusMissionById(missionId,{
    targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,statePayload)
  });
  assert.equal(focused.id,missionId);
  assert.equal(focused.card,approvalCard);
  assert.equal(approvalCard.dataset.jarvisMissionFocused,'1');
  assert.deepEqual(approvalCard.scrolled,{behavior:'smooth',block:'center'});
  await assert.rejects(
    missionActions.focusMissionById('M-CCCCCCCCCCCC',{targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,statePayload)}),
    /mission_deeplink_stale/
  );
  labelNode.textContent='Different mission label';
  await assert.rejects(
    missionActions.focusMissionById(missionId,{targetRoot:fakeRoot,fetchImpl:async()=>fakeResponse(true,200,statePayload)}),
    /mission_deeplink_card_mismatch/,
    'deep link must reject a stale label even when mission id matches'
  );
  labelNode.textContent=approvalMission.label;

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

  let consulted=false;
  await assert.rejects(
    missionActions.resolveFreshMission(req,{
      missionId,label:approvalMission.label,
      fetchImpl:async()=>{
        consulted=true;
        return fakeResponse(true,200,{workers:{pc:{missions:{queue:[{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}]}}}});
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
  assert.ok(serviceWorker.includes('safeNotificationUrl(data.url,event.notification.tag'),'notification click must re-validate the stored URL + tag');

  console.log('MOBILE MISSION ACTIONS SELFTEST PASS · v172 exact ID+REQ+label binding · order-independent deep link · safe URL policy');
})().catch(error=>{console.error(error);process.exitCode=1});