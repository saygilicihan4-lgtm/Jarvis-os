'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {EventEmitter}=require('events');
let handler;
const context=vm.createContext({
  require(name){
    if(name==='http')return {createServer(fn){handler=fn;return {listen(){}};}};
    if(['web-push','pg','@simplewebauthn/server'].includes(name))return {};
    return require(name);
  },
  __dirname,Buffer,URL,Date,console:{log(){},error(){}},
  process:{env:{JARVIS_TOKEN:'selftest-token',JARVIS_DEVICE_SECRET:'selftest-device-secret',JARVIS_STATE_SECRET:'selftest-state-secret'}},
  setInterval(){return 0;},clearInterval(){},setTimeout,clearTimeout
});
vm.runInContext(fs.readFileSync(require.resolve('./server.js'),'utf8'),context,{filename:'server.js'});
function request(url,{method='GET',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=new EventEmitter();Object.assign(req,{url,method,headers:{host:'jarvis.test',...headers},socket:{remoteAddress:'192.0.2.10'},destroy(){reject(Error('request destroyed'));}});
    const result={headers:{}};
    const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},writeHead(status,h){result.status=status;Object.assign(result.headers,h||{});},end(b){try{result.body=b?JSON.parse(b):null}catch{result.body=b}resolve(result);}};
    try{handler(req,res);if(body!==undefined)req.emit('data',JSON.stringify(body));req.emit('end');}catch(e){reject(e);}
  });
}
function deviceHeaders(deviceId='pc',extra={}){
  context.testDevicePayload={deviceId,exp:Date.now()+60000,v:1,...extra};
  return {authorization:'Device '+vm.runInContext('signDevicePayload(testDevicePayload)',context),'x-jarvis-device-id':deviceId};
}
function signedSnapshot({revision=10,tasks=[],audit=[],accountPolicies={},devices={}}={}){
  context.snapPayload={schemaVersion:3,revision,savedAt:new Date().toISOString(),tasks,audit,accountPolicies,devices};
  return vm.runInContext("({...snapPayload,signature:snapshotSignature(snapPayload)})",context);
}
async function run(){
  const legacy=signedSnapshot({
    revision:20,
    tasks:[{id:1,uid:'J-11111111-1111-1111-1111-111111111111',command:'system status',status:'completed'}],
    accountPolicies:{'pc|github':{deviceId:'pc',accountType:'github',agents:['DEVELOPER'],actions:['write']}},
    devices:{pc:{name:'Old PC',approved:true,roles:['DEVELOPER','COMMERCE'],allowedCapabilities:['dangerous-old-cap']},ghost:{name:'Old Ghost',approved:true,roles:['COMMERCE'],allowedCapabilities:['shopify_publish_v1']}}
  });

  // A signed backup proves integrity only. It must never authenticate its own caller.
  let r=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('pc'),body:legacy});
  assert.strictEqual(r.status,403,'snapshot-approved device must not bootstrap restore authority');
  assert.strictEqual(vm.runInContext('state.tasks.length',context),0,'denied restore is atomic');

  // Explicitly revoked live authority remains revoked even when the backup says approved.
  vm.runInContext("state.workers.devices.pc={name:'PC',approved:false,roles:[],allowedCapabilities:[],credentialIssuedAt:'live'}",context);
  r=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('pc'),body:legacy});
  assert.strictEqual(r.status,403,'revoked device cannot use an old backup to revive itself');
  assert.strictEqual(vm.runInContext('state.workers.devices.pc.approved',context),false);

  // Fresh pairing/current approval is the only authority accepted for restore.
  vm.runInContext("state.workers.devices.pc={name:'Fresh PC',approved:true,roles:['DEVELOPER'],allowedCapabilities:['system_status'],capabilities:['system_status'],credentialIssuedAt:'fresh-generation'};state.stateRevision=1",context);
  r=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('pc'),body:legacy});
  assert.strictEqual(r.status,200,JSON.stringify(r.body));
  assert.strictEqual(r.body.authorityRestored,false);
  assert.strictEqual(vm.runInContext('state.workers.devices.pc.approved',context),true);
  assert.strictEqual(vm.runInContext('JSON.stringify(state.workers.devices.pc.roles)',context),'["DEVELOPER"]','backup cannot expand current roles');
  assert.strictEqual(vm.runInContext('JSON.stringify(state.workers.devices.pc.allowedCapabilities)',context),'["system_status"]','backup cannot expand current capability scope');
  assert.strictEqual(vm.runInContext('state.workers.devices.ghost.approved',context),false,'backup-only devices restore disabled');
  assert.strictEqual(vm.runInContext('Object.keys(state.accountPolicies).length',context),0,'account authority requires explicit reapproval after restore');
  assert.strictEqual(vm.runInContext('state.tasks.length',context),1,'non-authority task data is restored');

  // A malformed signed backup must fail before any live state mutation.
  vm.runInContext("state.tasks=[];state.audit=[];state.accountPolicies={};state.stateRevision=1;state.workers.devices={pc:{name:'Fresh PC',approved:true,roles:['DEVELOPER'],allowedCapabilities:['system_status'],capabilities:['system_status'],credentialIssuedAt:'fresh-generation'}}",context);
  const malformed=signedSnapshot({revision:30,tasks:[{id:99}],devices:{pc:null}});
  r=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('pc'),body:malformed});
  assert.strictEqual(r.status,400);
  assert.strictEqual(vm.runInContext('state.tasks.length',context),0,'malformed restore must not partially apply tasks');
  assert.strictEqual(vm.runInContext('state.stateRevision',context),1,'malformed restore must not advance revision');
  assert.strictEqual(vm.runInContext('state.workers.devices.pc.approved',context),true);

  // Header/token actor mismatch is never downgraded to browser/admin fallback.
  const mismatch=await request('/api/state/restore',{method:'POST',headers:{...deviceHeaders('pc'),'x-jarvis-device-id':'other'},body:legacy});
  assert.strictEqual(mismatch.status,401);

  console.log('STATE RESTORE SECURITY SELFTEST PASS');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
