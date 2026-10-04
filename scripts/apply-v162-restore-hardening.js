'use strict';
const fs=require('fs');

function replaceOnce(file,oldText,newText,label){
  let s=fs.readFileSync(file,'utf8');
  const first=s.indexOf(oldText);
  if(first<0)throw new Error(label+': anchor not found in '+file);
  if(s.indexOf(oldText,first+oldText.length)>=0)throw new Error(label+': anchor not unique in '+file);
  s=s.slice(0,first)+newText+s.slice(first+oldText.length);
  fs.writeFileSync(file,s);
}

const oldSnapshot=`function snapshotSignature(payload){
  if(!STATE_SECRET)throw new Error('state secret unavailable');
  return crypto.createHmac('sha256',STATE_SECRET).update(JSON.stringify(payload)).digest('hex');
}
function persistentSnapshot(){
  const payload={...snapshotPayload(),schemaVersion:3};
  return{...payload,signature:snapshotSignature(payload)};
}
function verifySnapshot(s){
  if(!s||s.schemaVersion!==3||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.tasks)||typeof s.accountPolicies!=='object'||typeof s.devices!=='object')throw new Error('invalid signed snapshot');
  const {signature,...payload}=s,got=Buffer.from(String(signature||''),'hex'),expected=Buffer.from(snapshotSignature(payload),'hex');
  if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))throw new Error('snapshot signature check failed');
  return payload;
}
function restoreSnapshot(s){
  const p=verifySnapshot(s);
  if(p.revision<state.stateRevision)throw new Error('stale snapshot refused');
  state.tasks=p.tasks.slice(-500);
  state.audit=Array.isArray(p.audit)?p.audit.slice(-300):[];
  state.accountPolicies=p.accountPolicies||{};
  state.stateRevision=p.revision;
  for(const [id,d] of Object.entries(p.devices)){
    const live=state.workers.devices[id]||{};
    state.workers.devices[id]={...live,name:d.name||live.name||id,approved:!!d.approved,roles:Array.isArray(d.roles)?d.roles:[],allowedCapabilities:Array.isArray(d.allowedCapabilities)?d.allowedCapabilities:[]};
  }
}`;

const newSnapshot=`function snapshotSignature(payload){
  if(!STATE_SECRET)throw new Error('state secret unavailable');
  return crypto.createHmac('sha256',STATE_SECRET).update(JSON.stringify(payload)).digest('hex');
}
function persistentSnapshot(){
  const payload={...snapshotPayload(),schemaVersion:3};
  return{...payload,signature:snapshotSignature(payload)};
}
function snapshotRecord(x){return !!x&&typeof x==='object'&&!Array.isArray(x)}
function verifySnapshot(s){
  if(!s||s.schemaVersion!==3||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.tasks)||!snapshotRecord(s.accountPolicies)||!snapshotRecord(s.devices))throw new Error('invalid signed snapshot');
  for(const [id,d] of Object.entries(s.devices)){
    if(!/^[A-Za-z0-9_.-]{1,80}$/.test(id)||!snapshotRecord(d)||typeof d.approved!=='boolean')throw new Error('invalid signed snapshot device');
    if(d.name!==undefined&&typeof d.name!=='string')throw new Error('invalid signed snapshot device');
    if(d.roles!==undefined&&(!Array.isArray(d.roles)||d.roles.some(x=>typeof x!=='string')))throw new Error('invalid signed snapshot device');
    if(d.allowedCapabilities!==undefined&&(!Array.isArray(d.allowedCapabilities)||d.allowedCapabilities.some(x=>typeof x!=='string')))throw new Error('invalid signed snapshot device');
  }
  const {signature,...payload}=s,got=Buffer.from(String(signature||''),'hex'),expected=Buffer.from(snapshotSignature(payload),'hex');
  if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))throw new Error('snapshot signature check failed');
  return payload;
}
function restoredDevices(p,{actorDeviceId=null,bootstrapActor=false}={}){
  const next=Object.fromEntries(Object.entries(state.workers.devices).map(([id,w])=>[id,{...w}]));
  for(const [id,d] of Object.entries(p.devices)){
    const hasLive=Object.prototype.hasOwnProperty.call(state.workers.devices,id);
    if(hasLive){
      const live=state.workers.devices[id];
      // Authorization state is live authority. A backup may restore metadata,
      // never turn an explicit denial back into approval or widen live scope.
      next[id]={...live,name:String(d.name||live.name||id).slice(0,100)};
      continue;
    }
    const actorApproved=bootstrapActor&&id===actorDeviceId;
    next[id]={
      name:String(d.name||id).slice(0,100),version:null,lastSeen:null,capabilities:[],memory:null,
      approved:actorApproved,
      roles:Array.isArray(d.roles)?d.roles.slice(0,3):[],
      allowedCapabilities:Array.isArray(d.allowedCapabilities)?d.allowedCapabilities.slice(0,50):[],
      authMode:actorApproved?'signed':'restored-unapproved',
      credentialIssuedAt:actorApproved?now():null
    };
  }
  if(bootstrapActor&&actorDeviceId&&!next[actorDeviceId]){
    next[actorDeviceId]={name:actorDeviceId,version:null,lastSeen:null,capabilities:[],memory:null,approved:true,roles:['DEVELOPER'],allowedCapabilities:[],authMode:'signed',credentialIssuedAt:now()};
  }
  return next;
}
function restoreSnapshot(s,options={}){
  const p=verifySnapshot(s);
  if(p.revision<state.stateRevision)throw new Error('stale snapshot refused');
  // Build every replacement before mutating live state. A malformed but signed
  // backup must fail atomically instead of leaving a half-restored authority set.
  const nextTasks=p.tasks.slice(-500);
  const nextAudit=Array.isArray(p.audit)?p.audit.slice(-300):[];
  const nextPolicies={...p.accountPolicies};
  const nextDevices=restoredDevices(p,options);
  state.tasks=nextTasks;
  state.audit=nextAudit;
  state.accountPolicies=nextPolicies;
  state.workers.devices=nextDevices;
  state.stateRevision=p.revision;
  return p;
}`;
replaceOnce('server.js',oldSnapshot,newSnapshot,'snapshot hardening');

const oldRestore=`  if(pathname==='/api/state/restore'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      const live=deviceWorker(deviceId),cloudEmpty=state.stateRevision===0&&state.tasks.length===0&&Object.keys(state.accountPolicies).length===0&&!Object.values(state.workers.devices).some(x=>x.approved);
      try{
        const verified=verifySnapshot(d),snapDevice=verified.devices&&verified.devices[deviceId];
        const normalApproved=!!(live&&live.approved);
        const bootstrapApproved=cloudEmpty&&!!(snapDevice&&snapDevice.approved);
        if(!normalApproved&&!bootstrapApproved)return json(res,403,{error:'approved device required'});
        if(!cloudEmpty)return json(res,409,{error:'cloud state not empty; restore refused'});
        restoreSnapshot(d);
        log('STATE_RESTORE',deviceId+(bootstrapApproved?' signed bootstrap restore':' local snapshot restore'));
        touchState();
        return json(res,200,{ok:true,bootstrap:bootstrapApproved,tasks:state.tasks.length,policies:Object.keys(state.accountPolicies).length,revision:state.stateRevision});
      }catch(e){return json(res,400,{error:e.message})}
    });
  }`;

const newRestore=`  if(pathname==='/api/state/restore'&&req.method==='POST'){
    // STATE_RESTORE_AUTHORITY_V162: snapshot integrity is not requester identity.
    // Re-check the signed actor after the request body is consumed so expiry or
    // revocation during upload fails closed.
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const rawDeviceId=String(req.headers['x-jarvis-device-id']||'');
      const deviceId=rawDeviceId.replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      const ident=workerIdentity(req);
      if(!ident||ident.exp<=Date.now()||!deviceId||rawDeviceId!==deviceId||ident.deviceId!==deviceId)return json(res,401,{error:'signed device identity required'});
      const live=deviceWorker(deviceId);
      const dataEmpty=state.stateRevision===0&&state.tasks.length===0&&Object.keys(state.accountPolicies).length===0;
      const claimBootstrap=Number.isFinite(ident.bootstrapUntil)&&Date.now()<ident.bootstrapUntil;
      const envBootstrap=BOOTSTRAP_DEVICE_ID===deviceId&&Date.now()<BOOTSTRAP_DEVICE_EXP;
      const bootstrapApproved=!live&&dataEmpty&&(claimBootstrap||envBootstrap);
      if(live&&live.approved!==true)return json(res,403,{error:'device revoked or not approved'});
      if(!live&&!bootstrapApproved)return json(res,403,{error:'approved signed device required'});
      if(!dataEmpty)return json(res,409,{error:'cloud state not empty; restore refused'});
      try{
        restoreSnapshot(d,{actorDeviceId:deviceId,bootstrapActor:bootstrapApproved});
        log('STATE_RESTORE',deviceId+(bootstrapApproved?' external bootstrap restore':' approved device restore'));
        touchState();
        return json(res,200,{ok:true,bootstrap:bootstrapApproved,tasks:state.tasks.length,policies:Object.keys(state.accountPolicies).length,revision:state.stateRevision});
      }catch(e){return json(res,400,{error:e.message})}
    });
  }`;
replaceOnce('server.js',oldRestore,newRestore,'restore authority');

replaceOnce(
  'session-bootstrap-selftest.js',
  "process:{env:{JARVIS_TOKEN:'selftest-only-token',JARVIS_DEVICE_SECRET:'selftest-only-device-secret',JARVIS_BOOTSTRAP_DEVICE_ID:'env-pc',JARVIS_BOOTSTRAP_DEVICE_EXP:String(Date.now()+600000)}},",
  "process:{env:{JARVIS_TOKEN:'selftest-only-token',JARVIS_DEVICE_SECRET:'selftest-only-device-secret',JARVIS_STATE_SECRET:'selftest-only-state-secret',JARVIS_BOOTSTRAP_DEVICE_ID:'env-pc',JARVIS_BOOTSTRAP_DEVICE_EXP:String(Date.now()+600000)}},",
  'selftest state secret'
);

const helperAnchor=`function deviceHeaders(deviceId='pc',exp=Date.now()+60000,extra={}){
  context.testDevicePayload={deviceId,exp,v:1,...extra};
  return {authorization:'Device '+vm.runInContext('signDevicePayload(testDevicePayload)',context),'x-jarvis-device-id':deviceId};
}`;
const helperNew=helperAnchor+`
function signedSnapshot({revision=1,tasks=[],audit=[],accountPolicies={},devices={}}={}){
  context.testSnapshotPayload={schemaVersion:3,revision,savedAt:new Date().toISOString(),tasks,audit,accountPolicies,devices};
  return vm.runInContext('({...testSnapshotPayload,signature:snapshotSignature(testSnapshotPayload)})',context);
}`;
replaceOnce('session-bootstrap-selftest.js',helperAnchor,helperNew,'snapshot test helper');

const testAnchor=`  vm.runInContext('delete state.workers.devices["env-pc"]',context);
  assert.strictEqual((await tokenRequest(deviceHeaders('env-pc'),{deviceId:'env-pc'})).status,200,'environment bootstrap recovers absent state');
  const html=fs.readFileSync(require.resolve('./public/index.html'),'utf8');`;
const testNew=`  vm.runInContext('delete state.workers.devices["env-pc"]',context);
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
  const restored=await request('/api/state/restore',{method:'POST',headers:deviceHeaders('restore-pc',Date.now()+60000,{bootstrapUntil:Date.now()+60000}),body:restoreBody});
  assert.strictEqual(restored.status,200,'external signed bootstrap can restore fresh data');
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

  const html=fs.readFileSync(require.resolve('./public/index.html'),'utf8');`;
replaceOnce('session-bootstrap-selftest.js',testAnchor,testNew,'restore regression tests');

replaceOnce(
  '.github/workflows/ci.yml',
  '          node --check bootstrap-bridge-selftest.js\n          python -m py_compile jarvis-local-stt-v4.py',
  '          node --check bootstrap-bridge-selftest.js\n          node --check session-bootstrap-selftest.js\n          python -m py_compile jarvis-local-stt-v4.py',
  'CI syntax coverage'
);
replaceOnce(
  '.github/workflows/ci.yml',
  '      - name: Bootstrap bridge selftest\n        run: node bootstrap-bridge-selftest.js\n      - name: PowerShell installer syntax',
  '      - name: Bootstrap bridge selftest\n        run: node bootstrap-bridge-selftest.js\n      - name: Session restore authority selftest\n        run: node session-bootstrap-selftest.js\n      - name: PowerShell installer syntax',
  'CI restore test execution'
);

console.log('v162 restore hardening patch applied');
