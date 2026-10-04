'use strict';
const assert=require('assert/strict');
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

  const fakeResponse=(ok,status,payload)=>({ok,status,json:async()=>payload});
  const stateCalls=[];
  const fresh=await missionActions.resolveFreshMission(req,{
    fetchImpl:async(url,options)=>{
      stateCalls.push({url,options});
      return fakeResponse(true,200,{workers:{pc:{missions:{queue:[approvalMission]}}}});
    }
  });
  assert.equal(fresh.id,missionId);
  assert.equal(stateCalls.length,1);
  assert.equal(stateCalls[0].url,'/api/state');
  assert.equal(stateCalls[0].options.credentials,'same-origin');
  assert.equal(stateCalls[0].options.cache,'no-store');

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

  console.log('MOBILE MISSION ACTIONS SELFTEST PASS · 80-bit REQ · stale/ambiguous fail-closed · same-origin relay');
})().catch(error=>{console.error(error);process.exitCode=1});