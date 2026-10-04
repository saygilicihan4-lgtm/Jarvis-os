'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {EventEmitter}=require('events');

let handler,fakeDb;
class FakePool{
  constructor(){fakeDb=this;this.sessions=new Map();this.legacyAllowed=true;this.bootCount=0}
  async query(sql,params=[]){
    const q=String(sql).replace(/\s+/g,' ').trim();
    if(q.startsWith('CREATE TABLE IF NOT EXISTS'))return{rows:[]};
    if(q.includes('jarvis_persistence_probe')&&q.startsWith('INSERT INTO'))return{rows:[{boot_count:++this.bootCount}]};
    if(q==='SELECT * FROM jarvis_push_subscriptions')return{rows:[]};
    if(q==='SELECT * FROM jarvis_reminders ORDER BY remind_at')return{rows:[]};
    if(q.startsWith("INSERT INTO jarvis_admin_session_policy"))return{rows:[]};
    if(q.startsWith("SELECT legacy_allowed FROM jarvis_admin_session_policy"))return{rows:[{legacy_allowed:this.legacyAllowed}]};
    if(q.startsWith('SELECT id_hash,issued_at,expires_at,revoked_at,source,ip_tag,last_seen_at FROM jarvis_admin_sessions')){
      return{rows:[...this.sessions.values()].map(r=>({id_hash:r.idHash,issued_at:r.issuedAt,expires_at:r.expiresAt,revoked_at:r.revokedAt,source:r.source,ip_tag:r.ipTag,last_seen_at:r.lastSeenAt}))};
    }
    if(q.startsWith('INSERT INTO jarvis_admin_sessions')){
      const [idHash,issuedAt,expiresAt,revokedAt,source,ipTag,lastSeenAt]=params;
      if(!this.sessions.has(idHash))this.sessions.set(idHash,{idHash,issuedAt,expiresAt,revokedAt,source,ipTag,lastSeenAt});
      return{rows:[]};
    }
    if(q.startsWith('UPDATE jarvis_admin_sessions SET revoked_at=$2 WHERE id_hash=$1')){
      const [id,at]=params,r=this.sessions.get(id);if(r&&!r.revokedAt)r.revokedAt=at;return{rows:[]};
    }
    if(q.startsWith('UPDATE jarvis_admin_sessions SET revoked_at=$2 WHERE id_hash<>$1')){
      const [current,at]=params;for(const r of this.sessions.values())if(r.idHash!==current&&!r.revokedAt&&Date.parse(r.expiresAt)>Date.now())r.revokedAt=at;return{rows:[]};
    }
    if(q.startsWith("UPDATE jarvis_admin_session_policy SET legacy_allowed=false")){this.legacyAllowed=false;return{rows:[]};}
    throw new Error('unexpected fake SQL: '+q.slice(0,140));
  }
}
const context=vm.createContext({
  require(name){
    if(name==='http')return{createServer(fn){handler=fn;return{listen(){}}}};
    if(name==='pg')return{Pool:FakePool};
    if(name==='web-push')return{};
    if(name==='@simplewebauthn/server')return{};
    return require(name);
  },
  __dirname,Buffer,URL,Date,console:{log(){},error(){}},
  process:{env:{DATABASE_URL:'postgres://fake',JARVIS_TOKEN:'selftest-token',JARVIS_DEVICE_SECRET:'selftest-device-secret',JARVIS_STATE_SECRET:'selftest-state-secret'}},
  setInterval(){return 0;},clearInterval(){},setTimeout,clearTimeout
});
vm.runInContext(fs.readFileSync(require.resolve('./server.js'),'utf8'),context,{filename:'server.js'});

function request(url,{method='GET',headers={},ip='192.0.2.10',body,beforeBody}={}){
  return new Promise((resolve,reject)=>{
    const req=new EventEmitter();Object.assign(req,{url,method,headers:{host:'jarvis.test',...headers},socket:{remoteAddress:ip},destroy(){reject(Error('request destroyed'));}});
    const result={headers:{}};
    const res={setHeader(k,v){result.headers[String(k).toLowerCase()]=v;},writeHead(status,h){result.status=status;Object.assign(result.headers,h||{});},end(b){try{result.body=b?JSON.parse(b):null}catch{result.body=b}resolve(result);}};
    try{handler(req,res);if(beforeBody)beforeBody();if(body!==undefined)req.emit('data',JSON.stringify(body));req.emit('end');}catch(e){reject(e)}
  });
}
function deviceHeaders(deviceId='pc',extra={}){
  context.testDevicePayload={deviceId,exp:Date.now()+60000,v:1,...extra};
  return{authorization:'Device '+vm.runInContext('signDevicePayload(testDevicePayload)',context),'x-jarvis-device-id':deviceId};
}
function legacyCookie(exp=Date.now()+60000){
  context.testExpiry=exp;
  return 'jarvis_session='+encodeURIComponent(vm.runInContext("signPhoneSession({headers:{},socket:{remoteAddress:'192.0.2.10'}},testExpiry)",context));
}
async function ready(){for(let i=0;i<100;i++){if(vm.runInContext('dbReady',context))return;await new Promise(r=>setTimeout(r,5));}throw new Error('fake durable init timeout')}
async function createManagedCookie(){
  const c=await request('/api/session/create',{method:'POST',headers:deviceHeaders()});assert.strictEqual(c.status,200,JSON.stringify(c.body));
  const x=await request('/api/session/exchange',{method:'POST',body:{code:c.body.code}});assert.strictEqual(x.status,200,JSON.stringify(x.body));assert.strictEqual(x.body.durable,true);
  const cookie=x.headers['set-cookie'].split(';')[0];assert(/^jarvis_session=/.test(cookie));return cookie;
}

(async()=>{
  await ready();
  vm.runInContext("state.workers.devices.pc={name:'PC',approved:true,roles:['DEVELOPER'],allowedCapabilities:[],capabilities:[],credentialIssuedAt:'gen-1'}",context);

  // Legacy v2 remains usable only as an explicit migration window.
  const legacy=legacyCookie();
  let r=await request('/api/sessions/status',{headers:{cookie:legacy}});
  assert.strictEqual(r.status,200);assert.strictEqual(r.body.current.legacy,true);assert.strictEqual(r.body.migrationRequired,true);assert.strictEqual(r.body.legacyPolicy,'accept-existing-v2-until-expiry');
  r=await request('/api/sessions',{headers:{cookie:legacy}});
  assert.strictEqual(r.status,409,'legacy proof cannot enumerate managed session identifiers');

  const first=await createManagedCookie();
  const second=await createManagedCookie();
  r=await request('/api/sessions',{headers:{cookie:first}});
  assert.strictEqual(r.status,200);assert.strictEqual(r.body.durable,true);
  const active=r.body.sessions.filter(x=>x.status==='active');assert.strictEqual(active.length,2);
  const current=active.find(x=>x.current),other=active.find(x=>!x.current);assert(current&&other);

  // Mobile IP movement does not silently invalidate the session, but risk is surfaced.
  r=await request('/api/session/bootstrap',{headers:{cookie:first},ip:'198.51.100.77'});assert.strictEqual(r.status,200);
  r=await request('/api/sessions/status',{headers:{cookie:first},ip:'198.51.100.77'});assert.strictEqual(r.status,200);assert.strictEqual(r.body.current.ipChanged,true);

  // Individual revocation is durable-first and blocks replay immediately.
  r=await request('/api/sessions/'+other.id+'/revoke',{method:'POST',headers:{cookie:first},body:{}});assert.strictEqual(r.status,200);assert.strictEqual(r.body.changed,true);
  r=await request('/api/session/bootstrap',{headers:{cookie:second}});assert.strictEqual(r.status,401,'revoked cookie replay rejected');
  assert(fakeDb.sessions.get(other.id).revokedAt,'revocation persisted before response');

  // Legacy invalidation is one-way at the HTTP boundary and requires explicit text.
  r=await request('/api/sessions/legacy/disable',{method:'POST',headers:{cookie:first},body:{confirm:true}});assert.strictEqual(r.status,409);
  r=await request('/api/sessions/legacy/disable',{method:'POST',headers:{cookie:first},body:{confirm:'DISABLE_LEGACY_SESSIONS'}});assert.strictEqual(r.status,200);assert.strictEqual(r.body.legacyAllowed,false);assert.strictEqual(r.body.changed,true);assert.strictEqual(fakeDb.legacyAllowed,false);
  r=await request('/api/sessions/legacy/disable',{method:'POST',headers:{cookie:first},body:{confirm:'DISABLE_LEGACY_SESSIONS'}});assert.strictEqual(r.status,200);assert.strictEqual(r.body.changed,false,'repeat disable must be idempotent');assert.strictEqual(fakeDb.legacyAllowed,false);
  r=await request('/api/session/bootstrap',{headers:{cookie:legacy}});assert.strictEqual(r.status,401,'legacy cookie rejected after explicit migration cutoff');
  r=await request('/api/sessions/legacy/enable',{method:'POST',headers:{cookie:first},body:{confirm:true}});assert.notStrictEqual(r.status,200,'no HTTP downgrade route may re-enable legacy cookies');

  // Current-session revocation needs an extra explicit guard and clears the cookie.
  r=await request('/api/sessions/'+current.id+'/revoke',{method:'POST',headers:{cookie:first},body:{}});assert.strictEqual(r.status,409);
  r=await request('/api/sessions/'+current.id+'/revoke',{method:'POST',headers:{cookie:first},body:{confirmCurrent:true}});assert.strictEqual(r.status,200);assert.strictEqual(r.body.current,true);assert(/Max-Age=0/.test(r.headers['set-cookie']));
  r=await request('/api/session/bootstrap',{headers:{cookie:first}});assert.strictEqual(r.status,401);

  // Audit records contain only a short hash prefix, never the raw cookie proof.
  const audit=vm.runInContext('JSON.stringify(state.audit)',context);
  assert(!audit.includes(first));assert(!audit.includes(second));
  console.log('SESSION LIFECYCLE HTTP SELFTEST PASS');
})().catch(e=>{console.error(e);process.exit(1)});
