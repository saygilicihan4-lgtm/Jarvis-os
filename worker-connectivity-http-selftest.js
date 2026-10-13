'use strict';
// Execute the production HTTP handler. No listener, external services or real credentials.
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {EventEmitter}=require('events');
let handler;
let clockNow=null;
const context=vm.createContext({
  require(name){
    if(name==='http')return {createServer(fn){handler=fn;return {listen(){}};}};
    if(['web-push','pg','@simplewebauthn/server'].includes(name))return {};
    return require(name);
  },
  __dirname,Buffer,URL,Date:class extends Date{constructor(...args){super(...(args.length?args:[clockNow===null?Date.now():clockNow]));}static now(){return clockNow===null?Date.now():clockNow;}},console:{log(){},error(){}},
  process:{env:{JARVIS_TOKEN:'selftest-only-token',JARVIS_DEVICE_SECRET:'selftest-only-device-secret',JARVIS_STATE_SECRET:'selftest-only-state-secret',JARVIS_BOOTSTRAP_DEVICE_ID:'env-pc',JARVIS_BOOTSTRAP_DEVICE_EXP:String(Date.now()+600000)}},
  setInterval(){return 0;},clearInterval(){},setTimeout,clearTimeout
});
vm.runInContext(fs.readFileSync(require.resolve('./server.js'),'utf8'),context,{filename:'server.js'});
function request(url,{method='GET',headers={},ip='192.0.2.10',body,beforeBody}={}){
  return new Promise((resolve,reject)=>{
    const req=new EventEmitter();Object.assign(req,{url,method,headers:{host:'jarvis.test',...headers},socket:{remoteAddress:ip},destroy(){reject(Error('request destroyed'));}});
    const result={headers:{}};
    const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},writeHead(status,h){result.status=status;Object.assign(result.headers,h);},end(b){result.body=JSON.parse(b);resolve(result);}};
    try{handler(req,res);if(beforeBody)beforeBody();if(body!==undefined)req.emit('data',JSON.stringify(body));req.emit('end');}catch(e){reject(e);}
  });
}
function deviceHeaders(id='pc'){
  context.payload={deviceId:id,exp:Date.now()+3600000,v:1};
  return {authorization:'Device '+vm.runInContext('signDevicePayload(payload)',context),'x-jarvis-device-id':id};
}
const worker=fs.readFileSync('worker.js','utf8');
const capContext=vm.createContext({});
vm.runInContext(worker.slice(worker.indexOf('const CAPS='),worker.indexOf('const TTS_ENABLED='))+';this.caps=CAPS;',capContext);
async function run(){
  clockNow=Date.now();
  vm.runInContext("state.workers.devices.pc={approved:true,authMode:'signed',roles:['DEVELOPER'],capabilities:[],allowedCapabilities:[]}",context);
  const caps=Array.from(capContext.caps);
  assert(caps.length>160,'exercise the real capability inventory beyond the old truncation');
  const headers=deviceHeaders();
  const heartbeat=await request('/api/worker/heartbeat',{method:'POST',headers,body:{deviceId:'pc',version:'2.104.0',capabilities:caps,metrics:{cpu:42,ram:50,disk:25}}});
  assert.equal(heartbeat.status,200);
  assert.equal(vm.runInContext('state.workers.devices.pc.capabilities.length',context),caps.length);
  assert.equal(vm.runInContext("workerSupports('ücretsiz araştırma aracı aç','pc').ok",context),true);
  assert.equal(vm.runInContext("workerSupports('jarvis kendini düzelt','pc').ok",context),true);
  assert.equal(vm.runInContext("requiredCapability('PC: YouTube Studio aç')",context),'browser_operator_v1');
  assert.equal(vm.runInContext("requiredCapability('Shopify admin aç')",context),'browser_operator_v1');
  const browserHeaders={authorization:'Bearer selftest-only-token'};
  const task=await request('/api/tasks',{method:'POST',headers:browserHeaders,body:{command:'ücretsiz araştırma aracı aç',source:'phone-web'}});
  assert.equal(task.status,201);assert.equal(task.body.status,'waiting_worker');
  const claimed=await request('/api/worker/next',{headers});assert.equal(claimed.body.task.uid,task.body.uid);
  const uid=task.body.uid;
  clockNow+=80000;
  const renewed=await request('/api/worker/heartbeat',{method:'POST',headers,body:{deviceId:'pc',version:'2.104.0',capabilities:caps,activeTaskUid:uid}});
  assert.equal(renewed.status,200);
  const lease=vm.runInContext('state.tasks[0].claimedAt',context);assert.equal(new Date(lease).getTime(),clockNow);
  clockNow+=20000;
  await request('/api/worker/next',{headers});assert.equal(vm.runInContext('state.tasks[0].attempts',context),1,'live long task is not reclaimed after original 90s');
  vm.runInContext("state.workers.devices.other={approved:true,authMode:'signed',roles:['DEVELOPER'],capabilities:[],allowedCapabilities:[]}",context);
  await request('/api/worker/heartbeat',{method:'POST',headers:deviceHeaders('other'),body:{deviceId:'other',activeTaskUid:uid}});
  assert.equal(vm.runInContext('state.tasks[0].claimedAt',context),lease,'different Worker cannot renew owner claim');
  const spoof=await request('/api/worker/heartbeat',{method:'POST',headers,body:{deviceId:'other',activeTaskUid:uid}});
  assert.equal(spoof.status,401,'signed identity cannot overwrite another device');
  vm.runInContext("state.workers.devices.other.approved=false",context);
  clockNow+=16000;
  const state=vm.runInContext('publicState()',context);assert.equal(state.workers.pc.online,false);assert.equal(state.workers.pc.version,'2.104.0','offline display retains the latest approved PC version');
  context.future=new Date(clockNow+60000).toISOString();assert.equal(vm.runInContext('workerOnline({lastSeen:future})',context),false,'future heartbeat is not live');
  vm.runInContext("state.workers.devices.pc.approved=false",context);
  const denied=await request('/api/worker/heartbeat',{method:'POST',headers,body:{deviceId:'pc',capabilities:caps}});assert.equal(denied.status,403);assert.equal(denied.body.code,'DEVICE_NOT_APPROVED');
  console.log('WORKER CONNECTIVITY HTTP PASS: full real capabilities, mobile free-tool queue, dedicated browser route, owned claim renewal, identity isolation and honest offline state');
}
run().catch(e=>{console.error(e);process.exitCode=1});
