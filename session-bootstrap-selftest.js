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
  __dirname,Buffer,URL,Date:class extends Date{static now(){return clockNow===null?Date.now():clockNow;}},console:{log(){},error(){}},
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
function cookie(exp=Date.now()+60000){
  context.testExpiry=exp;
  return 'jarvis_session='+encodeURIComponent(vm.runInContext("signPhoneSession({headers:{},socket:{remoteAddress:'192.0.2.10'}},testExpiry)",context));
}
function deviceHeaders(deviceId='pc',exp=Date.now()+60000,extra={}){
  context.testDevicePayload={deviceId,exp,v:1,...extra};
  return {authorization:'Device '+vm.runInContext('signDevicePayload(testDevicePayload)',context),'x-jarvis-device-id':deviceId};
}
function signedSnapshot({revision=1,tasks=[],audit=[],accountPolicies={},devices={}}={}){
  context.testSnapshotPayload={schemaVersion:3,revision,savedAt:new Date().toISOString(),tasks,audit,accountPolicies,devices};
  return vm.runInContext('({...testSnapshotPayload,signature:snapshotSignature(testSnapshotPayload)})',context);
}
async function run(){
  const unissued=await request('/api/session/exchange',{method:'POST',body:{code:'00000000'}});
  assert.strictEqual(unissued.status,403);assert(!unissued.headers['set-cookie']);
  vm.runInContext("state.workers.devices.pc={approved:true,authMode:'signed',lastSeen:new Date().toISOString(),networkTag:ipTag({headers:{},socket:{remoteAddress:'192.0.2.10'}})}",context);
  for(const headers of [{},{'user-agent':'iPhone'},{cookie:'jarvis_session=forged.token'},{cookie:'jarvis_session=%E0%A4%A'},{cookie:cookie(Date.now()-1000)}]){
    const r=await request('/api/session/lan-bootstrap',{method:'POST',headers});
    assert.strictEqual(r.status,401,'same IP and signed Worker are not browser identity');
    assert.strictEqual(r.body.pairingRequired,true);assert(!r.headers['set-cookie']);
  }
  for(const spoof of ['cf-connecting-ip','x-forwarded-for']){
    const r=await request('/api/session/lan-bootstrap',{method:'POST',ip:'198.51.100.20',headers:{[spoof]:'192.0.2.10'}});
    assert.strictEqual(r.status,401,'proxy header is not an authentication factor');assert(!r.headers['set-cookie']);
  }
  const valid=cookie();
  vm.runInContext('state.workers.devices={}',context);
  for(const [url,method] of [['/api/session/bootstrap','GET'],['/api/session/lan-bootstrap','POST']]){
    const r=await request(url,{method,ip:'198.51.100.20',headers:{cookie:valid}});
    assert.strictEqual(r.status,200,'existing session survives IP change and offline Worker');
    assert.strictEqual(r.body.existing,true);assert(!r.headers['set-cookie'],'bootstrap does not extend expiry');
    const denied=await request(url,{method});assert.strictEqual(denied.status,401);assert(!denied.headers['set-cookie']);
    const malformed=await request(url,{method,headers:{cookie:'jarvis_session=%'}});assert.strictEqual(malformed.status,401);assert(!malformed.headers['set-cookie']);
  }
  const anonymousCreate=await request('/api/session/create',{method:'POST'});assert.strictEqual(anonymousCreate.status,401);
  const browserCreate=await request('/api/session/create',{method:'POST',headers:{cookie:valid}});
  assert.strictEqual(browserCreate.status,401,'browser cookie cannot directly issue a recovery code');
  vm.runInContext("state.workers.devices.pc={approved:true,credentialIssuedAt:'generation-1'}",context);
  const signed=deviceHeaders();
  for(const headers of [{authorization:'Bearer selftest-only-token'},deviceHeaders('missing'),deviceHeaders('pc',Date.now()-1),{...signed,'x-jarvis-device-id':'other'},{...signed,'x-jarvis-device-id':'pc!'}, {authorization:'Device invalid','x-jarvis-device-id':'pc'}]){
    const denied=await request('/api/session/create',{method:'POST',headers});assert.strictEqual(denied.status,401);assert(!denied.body.code);
  }
  async function create(){const r=await request('/api/session/create',{method:'POST',headers:signed});assert.strictEqual(r.status,200);assert(/^\d{8}$/.test(r.body.code));return r.body.code;}
  async function exchange(code){return request('/api/session/exchange',{method:'POST',body:{code}});}
  let code=await create();
  const deniedReplacement=await request('/api/session/create',{method:'POST',headers:{cookie:valid}});
  assert.strictEqual(deniedReplacement.status,401,'unauthorized issuance cannot replace the pending code');
  const wrong=await exchange(code==='87654321'?'12345678':'87654321');assert.strictEqual(wrong.status,403);assert(!wrong.headers['set-cookie']);
  const exchanged=await exchange(code);
  assert.strictEqual(exchanged.status,200);assert(/HttpOnly; Secure; SameSite=Lax/.test(exchanged.headers['set-cookie']));
  const restored=await request('/api/session/bootstrap',{ip:'198.51.100.25',headers:{cookie:exchanged.headers['set-cookie'].split(';')[0]}});assert.strictEqual(restored.status,200);
  const replay=await exchange(code);assert.strictEqual(replay.status,403);assert(!replay.headers['set-cookie']);
  code=await create();
  const revoke=await request('/api/devices/pc/revoke',{method:'POST',headers:{cookie:valid}});assert.strictEqual(revoke.status,200);
  // Even a still-valid bootstrap token must not auto-approve a revoked issuer here.
  const revokedCreate=await request('/api/session/create',{method:'POST',headers:deviceHeaders('pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000})});assert.strictEqual(revokedCreate.status,401);
  vm.runInContext('state.workers.devices.pc.approved=true',context);
  const revoked=await exchange(code);assert.strictEqual(revoked.status,403);assert(!revoked.headers['set-cookie'],'reapproval never restores a revoked code');
  code=await create();vm.runInContext("state.workers.devices.pc.credentialIssuedAt='generation-2'",context);
  assert.strictEqual((await exchange(code)).status,403,'credential rotation invalidates the code');
  code=await create();vm.runInContext('phoneCodeExp=Date.now()',context);
  assert.strictEqual((await exchange(code)).status,403,'expiry boundary fails closed');
  const short=await request('/api/session/create',{method:'POST',headers:deviceHeaders('pc',Date.now()+5000)});
  assert.strictEqual(short.status,200);assert(short.body.expiresInSeconds<=5,'code never outlives issuer token');
  const xHeaders=deviceHeaders();xHeaders['x-jarvis-device-token']=xHeaders.authorization.slice(7);delete xHeaders.authorization;
  assert.strictEqual((await request('/api/session/create',{method:'POST',headers:xHeaders})).status,200,'alternate signed header stays supported');
  code=await create();vm.runInContext('delete state.workers.devices.pc',context);
  const deletedIssuer=await exchange(code);assert.strictEqual(deletedIssuer.status,403);assert(!deletedIssuer.headers['set-cookie']);
  vm.runInContext("state.workers.devices.pc={approved:true,credentialIssuedAt:'original'};state.workers.devices.other={approved:true,credentialIssuedAt:'other-original'}",context);
  const cookieToken=await request('/api/worker/device-token',{method:'POST',headers:{cookie:valid,'x-jarvis-device-id':'pc'},body:{deviceId:'pc'}});
  const crossToken=await request('/api/worker/device-token',{method:'POST',headers:deviceHeaders('pc'),body:{deviceId:'other'}});
  vm.runInContext('state.workers.devices.pc.approved=false',context);
  const revive=await request('/api/worker/device-token',{method:'POST',headers:deviceHeaders('pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000}),body:{deviceId:'pc'}});
  console.log('Credential boundary status:',JSON.stringify({browser:cookieToken.status,crossDevice:crossToken.status,revokedBootstrap:revive.status}));
  assert.strictEqual(cookieToken.status,401,'browser cookie must not mint a PC credential');
  assert.strictEqual(crossToken.status,401,'signed PC cannot mint another device credential');
  assert.strictEqual(revive.status,403,'bootstrap claim cannot override an explicit revocation');
  assert.strictEqual(vm.runInContext('state.workers.devices.pc.approved',context),false);
  assert.strictEqual(vm.runInContext('state.workers.devices.other.credentialIssuedAt',context),'other-original');
  const tokenRequest=(headers,body={deviceId:'pc'},beforeBody)=>request('/api/worker/device-token',{method:'POST',headers,body,beforeBody});
  vm.runInContext("state.workers.devices.pc={approved:true,credentialIssuedAt:'original'}",context);
  const pcHeaders=deviceHeaders();
  for(const [headers,body] of [
    [{...pcHeaders,'x-jarvis-device-id':'pc!'},{deviceId:'pc'}],
    [pcHeaders,{deviceId:'pc!'}],[pcHeaders,{deviceId:42}],
    [{...pcHeaders,'x-jarvis-device-id':'other'},{deviceId:'other'}],
    [{authorization:'Device invalid','x-jarvis-token':'selftest-only-token','x-jarvis-device-id':'pc'},{deviceId:'pc'}]
  ]){const r=await tokenRequest(headers,body);assert.strictEqual(r.status,401);assert(!r.body.token);}
  assert.strictEqual(vm.runInContext('state.workers.devices.pc.credentialIssuedAt',context),'original','denied requests never rotate credentials');
  for(const headers of [pcHeaders,{'x-jarvis-device-token':pcHeaders.authorization.slice(7),'x-jarvis-device-id':'pc'},{authorization:'Bearer selftest-only-token','x-jarvis-device-id':'pc'},{'x-jarvis-token':'selftest-only-token','x-jarvis-device-id':'pc'}]){
    const r=await tokenRequest(headers);assert.strictEqual(r.status,200,'self-renewal and explicit legacy-admin migration remain supported');
    context.issuedTestToken=r.body.token;
    assert.strictEqual(vm.runInContext('verifyDeviceToken(issuedTestToken).deviceId',context),'pc');
    assert(!vm.runInContext('JSON.stringify(state.audit)',context).includes(r.body.token),'audit never stores credential');
  }
  const revokedDuringBody=await tokenRequest(pcHeaders,{deviceId:'pc'},()=>vm.runInContext('state.workers.devices.pc.approved=false',context));
  assert.strictEqual(revokedDuringBody.status,403);assert(!revokedDuringBody.body.token);
  vm.runInContext('state.workers.devices.pc.approved=true',context);
  const expires=Date.now()+60000;
  try{
    const expiredDuringBody=await tokenRequest(deviceHeaders('pc',expires),{deviceId:'pc'},()=>{clockNow=expires;});
    assert.strictEqual(expiredDuringBody.status,401);assert(!expiredDuringBody.body.token);
  }finally{clockNow=null;}
  const fresh=deviceHeaders('new-pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000});
  assert.strictEqual((await tokenRequest(fresh,{deviceId:'new-pc'})).status,200,'absent-state bootstrap still works');
  vm.runInContext('state.workers.devices["env-pc"]={approved:false}',context);
  assert.strictEqual((await tokenRequest(deviceHeaders('env-pc'),{deviceId:'env-pc'})).status,403,'environment bootstrap cannot override denial');
  vm.runInContext('delete state.workers.devices["env-pc"]',context);
  assert.strictEqual((await tokenRequest(deviceHeaders('env-pc'),{deviceId:'env-pc'})).status,200,'environment bootstrap recovers absent state');

  // v162 restore authority: a valid backup proves integrity, never requester identity.
  vm.runInContext('state.tasks=[];state.audit=[];state.accountPolicies={};state.stateRevision=0;state.workers.devices={}',context);
  let restoreBody=signedSnapshot({revision:1,tasks:[{id:777,command:'restored'}],devices:{'restore-pc':{name:'restore-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:[]}}});
  const snapshotOnly=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('restore-pc'),body:restoreBody});
  assert.strictEqual(snapshotOnly.status,403,'snapshot approval is not actor authorization');
  assert.strictEqual(vm.runInContext('state.tasks.length',context),0,'denied restore does not mutate tasks');

  // Even an otherwise valid bootstrap claim cannot override a live explicit denial.
  vm.runInContext("state.workers.devices={'restore-pc':{name:'restore-pc',approved:false,roles:['DEVELOPER'],allowedCapabilities:[],credentialIssuedAt:'revoked'}};state.stateRevision=0",context);
  const revokedBootstrap=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('restore-pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000}),body:restoreBody});
  assert.strictEqual(revokedBootstrap.status,403,'bootstrap cannot revive an explicitly revoked actor');
  assert.strictEqual(vm.runInContext("state.workers.devices['restore-pc'].approved",context),false);

  // An externally anchored bootstrap may restore fresh data, but backup grants for
  // other machines remain unapproved and a current denial wins over old approval.
  vm.runInContext("state.tasks=[];state.audit=[];state.accountPolicies={};state.stateRevision=0;state.workers.devices={'revoked-pc':{name:'revoked-pc',approved:false,roles:['DEVELOPER'],allowedCapabilities:['current-scope'],credentialIssuedAt:'revoked-gen'}}",context);
  restoreBody=signedSnapshot({revision:2,tasks:[{id:1,command:'restored-safe'}],devices:{
    'restore-pc':{name:'restore-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:[]},
    'revoked-pc':{name:'revoked-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:['backup-scope']},
    'legacy-pc':{name:'legacy-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:['backup-scope']}
  }});
  const restoreResult=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('restore-pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000}),body:restoreBody});
  assert.strictEqual(restoreResult.status,200,'external signed bootstrap can restore fresh data');
  assert.strictEqual(vm.runInContext("state.workers.devices['restore-pc'].approved",context),true,'bootstrap authority applies only to actor');
  assert.strictEqual(vm.runInContext("state.workers.devices['revoked-pc'].approved",context),false,'live revocation survives restore');
  assert.strictEqual(vm.runInContext("state.workers.devices['revoked-pc'].allowedCapabilities[0]",context),'current-scope','live scope is not widened by backup');
  assert.strictEqual(vm.runInContext("state.workers.devices['legacy-pc'].approved",context),false,'backup cannot approve another device');

  // Structurally bad but correctly signed input must fail before any live mutation.
  vm.runInContext("state.tasks=[];state.accountPolicies={};state.audit=[{type:'SENTINEL',message:'keep'}];state.stateRevision=0;state.workers.devices={'guard':{name:'guard',approved:false,roles:[],allowedCapabilities:[]}}",context);
  const malformedSigned=signedSnapshot({revision:4,audit:[{type:'BACKUP'}],devices:{bad:null}});
  const atomic=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('atom-pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000}),body:malformedSigned});
  assert.strictEqual(atomic.status,400,'malformed signed backup rejected');
  assert.strictEqual(vm.runInContext('state.stateRevision',context),0,'failed restore leaves revision untouched');
  assert.strictEqual(vm.runInContext("state.audit[0].type",context),'SENTINEL','failed restore leaves audit untouched');
  assert.strictEqual(vm.runInContext("state.workers.devices['guard'].approved",context),false,'failed restore leaves revocation untouched');
  assert.strictEqual(vm.runInContext("Object.prototype.hasOwnProperty.call(state.workers.devices,'atom-pc')",context),false,'failed restore does not create actor');

  // Authorization is re-read after body consumption; a concurrent revoke wins.
  vm.runInContext("state.tasks=[];state.audit=[];state.accountPolicies={};state.stateRevision=0;state.workers.devices={'race-pc':{name:'race-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:[],credentialIssuedAt:'race'}}",context);
  const raceBody=signedSnapshot({revision:1,devices:{'race-pc':{name:'race-pc',approved:true,roles:['DEVELOPER'],allowedCapabilities:[]}}});
  const race=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('race-pc'),body:raceBody,beforeBody:()=>vm.runInContext("state.workers.devices['race-pc'].approved=false",context)});
  assert.strictEqual(race.status,403,'revocation during restore body fails closed');
  assert.strictEqual(vm.runInContext('state.stateRevision',context),0);

  const html=fs.readFileSync(require.resolve('./public/index.html'),'utf8');
  const bootstrap=html.slice(html.indexOf('async function bootstrapSession(){'),html.indexOf('async function languageConversationRequest'));
  assert(!bootstrap.includes('/api/session/lan-bootstrap'),'UI must not treat network presence as login');
  assert(bootstrap.includes('if(await tryTrustedSession())return;'),'phone and desktop both reuse a valid session');
  assert(bootstrap.indexOf('if(await tryTrustedSession())return;')<bootstrap.indexOf('const unlocked=await requireLocalDeviceUnlock(true)'));
  for(const userAgent of ['iPhone','Desktop']){
    for(const existing of [true,false]){
      const calls=[];
      const ui=vm.createContext({navigator:{userAgent},authmsg:{textContent:''},consoleStatus:{textContent:''},
        async fetch(url){calls.push(url);return {ok:existing};},
        async load(){calls.push('load');},setAuthenticated(v){calls.push('authenticated:'+v);},setAccessMode(v){calls.push('mode:'+v);},
        async refreshDeviceLockStatus(){},async resyncExistingPush(){},
        async requireLocalDeviceUnlock(){calls.push('passkey');return false;}
      });
      vm.runInContext(bootstrap,ui);await vm.runInContext('bootstrapSession()',ui);
      assert.strictEqual(calls[0],'/api/session/bootstrap');
      assert(calls.includes('authenticated:'+existing));
      assert.strictEqual(calls.includes('passkey'),!existing&&userAgent==='iPhone');
      if(!existing)assert(!calls.includes('load'),'failed proof never loads authenticated UI');
    }
  }
  console.log('SESSION BOOTSTRAP SELFTEST PASS (production HTTP handler; fake services)');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
