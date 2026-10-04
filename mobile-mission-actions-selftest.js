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
  const stateOf=queue=>({workers:{pc:{missions:{queue}}}});
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

  // v172: Worker text is an explicit receipt, not merely a generic ready reply.
  assert.equal(missionActions.workerReceiptMatches({message:'AÇIK ONAY UYGULANDI · completed'},'approve'),true);
  assert.equal(missionActions.workerReceiptMatches({reply:'MISSION İPTAL EDİLDİ · cancelled'},'cancel'),true);
  assert.equal(missionActions.workerReceiptMatches({actionResult:{message:'AÇIK ONAY UYGULANDI · nested'}},'approve'),true);
  assert.equal(missionActions.workerReceiptMatches({actionResults:[{message:'MISSION İPTAL EDİLDİ · nested'}]},'cancel'),true);
  assert.equal(missionActions.workerReceiptMatches({reply:'Komut alındı.'},'approve'),false,'generic Worker reply is not approval proof');

  // Approval proof succeeds only when the old exact mission+REQ approval request disappears.
  let proofClock=0,approvalStatePoll=0;
  const approvalProof=await missionActions.waitForActionProof('approve',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf(approvalStatePoll++===0?[approvalMission]:[]))
  });
  assert.equal(approvalProof.state,'approval_request_consumed');

  // A new REQ for the same mission also proves the reviewed request was consumed.
  proofClock=0;
  const refreshedMission={...approvalMission,label:'ONAY · YOUTUBE PUBLIC · Demo · 15 DK · REQ fedcba9876543210abcd'};
  const refreshedProof=await missionActions.waitForActionProof('approve',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf([refreshedMission]))
  });
  assert.equal(refreshedProof.state,'approval_request_consumed');
  assert.equal(refreshedProof.missionPresent,true);

  // Cancel proof requires the mission to leave the open durable queue.
  proofClock=0;
  const cancelProof=await missionActions.waitForActionProof('cancel',missionId,req,{
    now:()=>{proofClock+=100;return proofClock},wait:async()=>{},timeoutMs:5000,
    fetchImpl:async()=>fakeResponse(true,200,stateOf([]))
  });
  assert.equal(cancelProof.state,'mission_closed');

  // Full approval path: relay receipt + state transition are both required.
  const relayCalls=[];let relayPoll=0,statePoll=0,clock=0;
  const verifiedApproval=await missionActions.runActionWithProof('approve',resolved,{
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

  // Full cancel path requires its distinct Worker receipt and queue disappearance.
  let cancelClock=0,cancelStatePoll=0;
  const verifiedCancel=await missionActions.runActionWithProof('cancel',resolved,{
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

  // Generic Worker success cannot create authority or a green UI result.
  let missingReceiptClock=0;
  await assert.rejects(
    missionActions.runActionWithProof('approve',resolved,{
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

  // Even a valid Worker receipt is insufficient while the exact old REQ remains active.
  let stuckClock=0;
  await assert.rejects(
    missionActions.runActionWithProof('approve',resolved,{
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

  let sent=false;
  await assert.rejects(
    missionActions.resolveFreshMission(req,{
      fetchImpl:async()=>{
        sent=true;
        return fakeResponse(true,200,stateOf([{...approvalMission,label:'ONAY · REQ fedcba9876543210abcd'}]));
      }
    }),
    /mission_approval_stale/
  );
  assert.equal(sent,true,'freshness check must consult current state');

  console.log('MOBILE MISSION ACTIONS SELFTEST PASS · preflight REQ + Worker receipt + post-action durable state proof');
})().catch(error=>{console.error(error);process.exitCode=1});