'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync('worker.js','utf8');
function extract(begin,end,c){const a=s.indexOf(begin),b=s.indexOf(end,a);assert(a>=0&&b>a);vm.runInContext(s.slice(a,b),c)}
(async()=>{
 let releaseHeartbeat,releaseTask,heartbeats=0,claims=0;
 const c=vm.createContext({Date,console:{log(){},error(){}},NAME:'test',DEVICE_ID:'pc',WORKER_VERSION:'2.104.0',CAPS:[],
 pairDevice:async()=>{},migrateDeviceCredential:async()=>{},restoreAttempted:true,
 memoryStats:()=>({}),systemMetrics:()=>({}),cloudMissionTelemetry:()=>({}),selfUpdateState:()=>({}),
 lastCloudHeartbeatAt:0,mobilePollAuthorized:false,mobileAuthNoticeShown:false,lastAuthRecovery:Date.now(),
 mobileAuthorizationDenied:e=>/awaiting approval/.test(e.message),pauseMobilePollsForAuth:e=>{if(/awaiting approval/.test(e.message)){c.mobilePollAuthorized=false;c.lastCloudHeartbeatAt=0;return true}return false},
 remember(){},phoneSessionCodeShown:true,serviceMobileTts:async()=>{},serviceMobileLanguage:async()=>{},serviceMobileBrain:async()=>{},
 lastStateSync:Date.now(),queueJarvisSpeech(){},
 api:async(route,opts)=>{
  if(route==='/api/worker/heartbeat'){heartbeats++;if(heartbeats===1)await new Promise(r=>releaseHeartbeat=r);return{approved:true}}
  if(route==='/api/worker/next'){claims++;return{task:{id:1,uid:'J-test',command:'sistem durumu'}}}
  if(route==='/api/worker/result')return{ok:true};throw Error(route)
 },execute:async()=>{await new Promise(r=>releaseTask=r);return{ok:true,message:'done'}}});
 extract('async function runCloudHeartbeat(){',"console.log('JARVIS PC Worker",c);
 const first=c.poll();const second=c.poll();await second;assert.equal(heartbeats,0);
 // Advance the async heartbeat startup until fetch begins.
 for(let i=0;i<8&&!releaseHeartbeat;i++)await Promise.resolve();assert.equal(heartbeats,1);
 const duplicate=c.refreshCloudHeartbeat();assert.equal(heartbeats,1,'only one in-flight heartbeat');releaseHeartbeat();await duplicate;
 for(let i=0;i<12&&!releaseTask;i++)await Promise.resolve();assert.equal(claims,1);
 await c.refreshCloudHeartbeat();assert.equal(heartbeats,2,'heartbeat continues while task is blocked');await c.poll();assert.equal(claims,1,'no overlapping task claim');
 assert.equal(vm.runInContext('activeCloudTaskUid',c),'J-test');releaseTask();await first;
 assert.equal(vm.runInContext('cloudTaskPollBusy',c),false);assert.equal(vm.runInContext('activeCloudTaskUid',c),null);
 c.api=async()=>({approved:false});assert.equal(await c.refreshCloudHeartbeat(),false);assert.equal(c.mobilePollAuthorized,false);assert.equal(c.lastCloudHeartbeatAt,0);
 // Test bounded production API waits, including abort while response body hangs.
 let timeout,cleared=0;
 const api=vm.createContext({DEVICE_TOKEN:'test',TOKEN:'',DEVICE_ID:'pc',BASE:'https://example.invalid',AbortController,
 setTimeout(fn,ms){assert.equal(ms,10000);timeout=fn;return 1},clearTimeout(){cleared++},
 fetch:async(url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 extract('async function api(route,options={}){','function deviceTokenExp(',api);const pending=api.api('/heartbeat');timeout();await assert.rejects(pending,/aborted/);assert.equal(cleared,1);
 console.log('WORKER HEARTBEAT SCHEDULER PASS: single heartbeat, non-overlapping claims, liveness during slow task, denied approval and bounded API');
})().catch(e=>{console.error(e);process.exitCode=1});
