'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const records=new Map();let failWrites=false,failLoad=false;
const db={async query(sql,values){
 if(sql.startsWith('CREATE TABLE'))return{rows:[]};
 if(sql.includes('jarvis_persistence_probe'))return{rows:[{boot_count:1}]};
 if(sql.startsWith('SELECT device_id,policy')){if(failLoad)throw Error('database unavailable');return{rows:[...records].map(([device_id,policy])=>({device_id,policy}))}}
 if(sql.startsWith('INSERT INTO jarvis_device_policies')){if(failWrites)throw Error('write failed');records.set(values[0],JSON.parse(values[1]));return{rows:[]}}
 return{rows:[]};
}};
async function boot(){
 let handler;const c=vm.createContext({
 require(name){
  if(name==='http')return{createServer(fn){handler=fn;return{listen(){}}}};
  if(name==='pg')return{Pool:class{constructor(){return db}}};
  if(name==='web-push'||name==='@simplewebauthn/server')return{};
  if(name==='./jarvis-session-lifecycle')return{createPgSessionStore:()=>({}),createSessionLifecycle:()=>({init:async()=>({durable:true,legacyPolicy:'allow',managedSessions:0})})};
  return require(name);
 },__dirname,Buffer,URL,Date,console:{log(){},error(){}},setInterval(){},clearInterval(){},setTimeout,clearTimeout,
 process:{env:{DATABASE_URL:'postgres://localhost/test',JARVIS_TOKEN:'test-owner',JARVIS_DEVICE_SECRET:'test-device',JARVIS_STATE_SECRET:'test-state'}}});
 vm.runInContext(fs.readFileSync('server.js','utf8'),c);
 for(let i=0;i<30&&!vm.runInContext('deviceRegistryReady',c);i++)await Promise.resolve();
 async function request(url,method='GET',body,headers={authorization:'Bearer test-owner'}){
  return new Promise((resolve,reject)=>{
   const req=new EventEmitter();Object.assign(req,{url,method,headers:{host:'test.invalid',...headers},socket:{remoteAddress:'192.0.2.1'}});
   const r={headers:{}};const res={setHeader(k,v){r.headers[k]=v},writeHead(status){r.status=status},end(b){r.body=JSON.parse(b);resolve(r)}};
   try{handler(req,res);if(body!==undefined)req.emit('data',JSON.stringify(body));req.emit('end')}catch(e){reject(e)}
  });
 }
 return{c,request};
}
(async()=>{
 let app=await boot();const code=await app.request('/api/pairing/create','POST',{});assert.equal(code.status,200);
 const paired=await app.request('/api/pairing/exchange','POST',{code:code.body.code,deviceId:'pc',name:'My PC',capabilities:['system_status']},{});
 assert.equal(paired.status,200);assert.equal(paired.body.durable,true);assert.equal(records.get('pc').approved,true);
 const headers={authorization:'Device '+paired.body.token,'x-jarvis-device-id':'pc'};
 app=await boot();assert.equal(vm.runInContext('state.workers.devices.pc.lastSeen',app.c),null);
 const linked=await app.request('/api/worker/heartbeat','POST',{deviceId:'pc',version:'2.104.0',capabilities:['system_status']},headers);assert.equal(linked.status,200);
 const revoke=await app.request('/api/devices/pc/revoke','POST');assert.equal(revoke.status,200);assert.equal(records.get('pc').approved,false);
 app=await boot();const denied=await app.request('/api/worker/heartbeat','POST',{deviceId:'pc'},headers);assert.equal(denied.status,403);assert.equal(denied.body.code,'DEVICE_NOT_APPROVED','even a fresh bootstrap token cannot restore a revoked policy');
 // A failed write must never emit a valid pairing credential or approved state.
 failWrites=true;const fresh=await app.request('/api/pairing/create','POST',{});
 const failed=await app.request('/api/pairing/exchange','POST',{code:fresh.body.code,deviceId:'new-pc'},{});assert.equal(failed.status,503);assert.equal(failed.body.token,undefined);assert.equal(vm.runInContext("state.workers.devices['new-pc']",app.c),undefined);
 failWrites=false;failLoad=true;app=await boot();
 const blocked=await app.request('/api/worker/heartbeat','POST',{deviceId:'pc'},headers);assert.equal(blocked.status,503);assert.equal(blocked.body.code,'DEVICE_POLICY_STORE_UNAVAILABLE');
 console.log('DEVICE REGISTRY HTTP PASS: pairing acknowledgement, restart heartbeat, durable revocation, failed save and failed load');
})().catch(e=>{console.error(e);process.exitCode=1});
