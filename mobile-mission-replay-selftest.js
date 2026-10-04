'use strict';
const assert=require('assert/strict');
const fs=require('fs');

(async()=>{
  assert.equal(typeof Request,'function','Node 20 Request global required');
  assert.equal(typeof Response,'function','Node 20 Response global required');
  const serviceWorker=fs.readFileSync('./public/sw.js','utf8');
  assert.doesNotThrow(()=>new Function(serviceWorker),'service worker syntax invalid');
  const helperSource=serviceWorker.slice(0,serviceWorker.indexOf("self.addEventListener('push'"));
  const helpers=new Function(helperSource+';return {MISSION_ACTION_REPLAY_TTL_MS,missionActionReplayKeyFromMessage,missionActionReplayKey,pruneMissionActionReplay,clearMissionActionReplay,coalesceMissionActionRequest};')();
  const missionId='M-AAAAAAAAAAAA';
  const req='0123456789abcdefabcd';
  const approve='onayla '+missionId+' req '+req;
  const cancel='iptal et '+missionId+' req '+req;

  assert.equal(helpers.MISSION_ACTION_REPLAY_TTL_MS,45000);
  assert.equal(helpers.missionActionReplayKeyFromMessage(approve),'mission-action:approve:'+missionId+':'+req);
  assert.equal(helpers.missionActionReplayKeyFromMessage('  ONAYLA   '+missionId+'   REQ   '+req.toUpperCase()+'  '),'mission-action:approve:'+missionId+':'+req);
  assert.equal(helpers.missionActionReplayKeyFromMessage(cancel),'mission-action:cancel:'+missionId+':'+req);
  assert.equal(helpers.missionActionReplayKeyFromMessage('merhaba jarvis'),'');
  assert.equal(helpers.missionActionReplayKeyFromMessage('onayla '+missionId+' req 0123456789'),'','legacy 40-bit REQ must not enter replay cache');

  const makeRequest=message=>new Request('https://jarvis.local/api/mobile-brain',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message})
  });
  assert.equal(await helpers.missionActionReplayKey(makeRequest(approve)),'mission-action:approve:'+missionId+':'+req);

  helpers.clearMissionActionReplay();
  let networkCalls=0;
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const networkFetch=async request=>{
    networkCalls++;
    await gate;
    const body=await request.clone().json();
    return new Response(JSON.stringify({id:'abcd1234-abcd',status:'queued',echo:body.message}),{
      status:202,headers:{'content-type':'application/json'}
    });
  };
  const p1=helpers.coalesceMissionActionRequest(makeRequest(approve),networkFetch,1000);
  const p2=helpers.coalesceMissionActionRequest(makeRequest(approve),networkFetch,1001);
  await Promise.resolve();await Promise.resolve();
  assert.equal(networkCalls,1,'same mission+REQ across clients must create one network request');
  release();
  const [r1,r2]=await Promise.all([p1,p2]);
  assert.equal(r1.status,202);assert.equal(r2.status,202);
  assert.deepEqual(await r1.json(),await r2.json(),'coalesced callers must receive the same accepted request receipt');

  const cached=await helpers.coalesceMissionActionRequest(makeRequest(approve),networkFetch,2000);
  assert.equal(cached.status,202);
  assert.equal(networkCalls,1,'successful mission action must remain coalesced inside replay TTL');

  let cancelCalls=0;
  const cancelResponse=await helpers.coalesceMissionActionRequest(makeRequest(cancel),async()=>{
    cancelCalls++;return new Response(JSON.stringify({id:'dcba4321-dcba',status:'queued'}),{status:202});
  },2001);
  assert.equal(cancelResponse.status,202);
  assert.equal(cancelCalls,1,'approve and cancel must use distinct replay keys');

  let normalCalls=0;
  const normalFetch=async()=>{normalCalls++;return new Response('{}',{status:202})};
  await helpers.coalesceMissionActionRequest(makeRequest('merhaba jarvis'),normalFetch,3000);
  await helpers.coalesceMissionActionRequest(makeRequest('merhaba jarvis'),normalFetch,3001);
  assert.equal(normalCalls,2,'normal mobile brain chat must never be replay-cached');

  helpers.clearMissionActionReplay();
  let errorCalls=0;
  const failingFetch=async()=>{errorCalls++;return new Response(JSON.stringify({error:'PC Worker offline'}),{status:409})};
  const failed1=await helpers.coalesceMissionActionRequest(makeRequest(approve),failingFetch,4000);
  const failed2=await helpers.coalesceMissionActionRequest(makeRequest(approve),failingFetch,4001);
  assert.equal(failed1.status,409);assert.equal(failed2.status,409);
  assert.equal(errorCalls,2,'failed relay attempts must not poison replay cache');

  helpers.clearMissionActionReplay();
  let ttlCalls=0;
  const ttlFetch=async()=>{ttlCalls++;return new Response('{}',{status:202})};
  await helpers.coalesceMissionActionRequest(makeRequest(approve),ttlFetch,10000);
  await helpers.coalesceMissionActionRequest(makeRequest(approve),ttlFetch,10000+helpers.MISSION_ACTION_REPLAY_TTL_MS-1);
  assert.equal(ttlCalls,1,'accepted action must remain cached before TTL');
  await helpers.coalesceMissionActionRequest(makeRequest(approve),ttlFetch,10000+helpers.MISSION_ACTION_REPLAY_TTL_MS);
  assert.equal(ttlCalls,2,'replay cache must expire at bounded TTL; Worker stale-REQ guard remains final authority');

  console.log('MOBILE MISSION REPLAY SELFTEST PASS · same action coalesced · failures retryable · bounded TTL · normal chat untouched');
})().catch(error=>{console.error(error);process.exitCode=1});