'use strict';
const assert=require('assert');
const {createSessionLifecycle}=require('./jarvis-session-lifecycle');

class FakeStore{
  constructor(shared){this.shared=shared||{legacyAllowed:true,sessions:new Map()};this.fail=false}
  async init(){if(this.fail)throw new Error('store down');return{legacyAllowed:this.shared.legacyAllowed,sessions:[...this.shared.sessions.values()].map(x=>({...x}))}}
  async create(r){if(this.fail)throw new Error('store down');this.shared.sessions.set(r.idHash,{...r})}
  async revoke(id,at){if(this.fail)throw new Error('store down');const r=this.shared.sessions.get(id);if(r&&!r.revokedAt)r.revokedAt=at}
  async revokeOthers(current,at){if(this.fail)throw new Error('store down');for(const r of this.shared.sessions.values())if(r.idHash!==current&&!r.revokedAt)r.revokedAt=at}
  async setLegacyAllowed(v){if(this.fail)throw new Error('store down');this.shared.legacyAllowed=!!v}
}

(async()=>{
  let t=1_790_000_000_000;
  const clock=()=>t,secret=Buffer.from('v163-session-secret');
  const shared={legacyAllowed:true,sessions:new Map()},store=new FakeStore(shared);
  const a=createSessionLifecycle({secret,store,clock});
  let st=await a.init();
  assert.strictEqual(st.durable,true);
  assert.strictEqual(st.legacyAllowed,true);

  const first=await a.issue({source:'one-time-code',ipTag:'ip-a'});
  const second=await a.issue({source:'passkey',ipTag:'ip-b'});
  assert.strictEqual(a.validate({sid:first.sid,iat:first.issuedAtMs,exp:first.expiresAtMs}).source,'one-time-code');
  assert.strictEqual(a.list(first.idHash).filter(x=>x.status==='active').length,2);
  assert.strictEqual(a.list(first.idHash).find(x=>x.id===first.idHash).current,true);

  // A restart reloads the same managed sessions from durable storage.
  const b=createSessionLifecycle({secret,store:new FakeStore(shared),clock});
  await b.init();
  assert.strictEqual(b.validate({sid:first.sid,iat:first.issuedAtMs,exp:first.expiresAtMs}).idHash,first.idHash);
  assert.strictEqual(b.validate({sid:second.sid,iat:second.issuedAtMs,exp:second.expiresAtMs}).idHash,second.idHash);

  // Individual revocation survives another restart and blocks replay.
  const revoked=await b.revoke(second.idHash);
  assert.strictEqual(revoked.changed,true);
  assert.strictEqual(b.validate({sid:second.sid,iat:second.issuedAtMs,exp:second.expiresAtMs}),null);
  const c=createSessionLifecycle({secret,store:new FakeStore(shared),clock});
  await c.init();
  assert.strictEqual(c.validate({sid:second.sid,iat:second.issuedAtMs,exp:second.expiresAtMs}),null,'revocation survives restart');
  assert.ok(c.validate({sid:first.sid,iat:first.issuedAtMs,exp:first.expiresAtMs}),'other session remains active');

  // Legacy v2 compatibility remains explicit until a managed session disables it.
  assert.strictEqual(c.acceptsLegacy(),true);
  await c.setLegacyAllowed(false);
  assert.strictEqual(c.acceptsLegacy(),false);
  const d=createSessionLifecycle({secret,store:new FakeStore(shared),clock});
  await d.init();
  assert.strictEqual(d.acceptsLegacy(),false,'legacy disable survives restart');

  // New managed sessions still work after legacy disable and can revoke all peers.
  const third=await d.issue({source:'passkey'}),fourth=await d.issue({source:'one-time-code'});
  const rr=await d.revokeOthers(third.idHash);
  assert.ok(rr.count>=1);
  assert.ok(d.validate({sid:third.sid,iat:third.issuedAtMs,exp:third.expiresAtMs}));
  assert.strictEqual(d.validate({sid:fourth.sid,iat:fourth.issuedAtMs,exp:fourth.expiresAtMs}),null);

  // Expiry fails closed without deleting evidence immediately.
  t=third.expiresAtMs+1;
  assert.strictEqual(d.validate({sid:third.sid,iat:third.issuedAtMs,exp:third.expiresAtMs}),null);

  // Configured durable storage that cannot initialize fails closed for legacy proof.
  const badStore=new FakeStore(shared);badStore.fail=true;
  const failed=createSessionLifecycle({secret,store:badStore,clock});
  await assert.rejects(()=>failed.init(),/store down/);
  assert.strictEqual(failed.acceptsLegacy(),false);
  await assert.rejects(()=>failed.issue({source:'passkey'}),e=>e&&e.code==='SESSION_STORE_UNAVAILABLE');

  // Volatile compatibility can issue a session for local/selftest deployments, but
  // security mutations refuse to pretend they are durable.
  const volatile=createSessionLifecycle({secret,clock});await volatile.init();
  const v=await volatile.issue({source:'one-time-code'});
  assert.ok(volatile.validate({sid:v.sid,iat:v.issuedAtMs,exp:v.expiresAtMs}));
  await assert.rejects(()=>volatile.setLegacyAllowed(false),e=>e&&e.code==='SESSION_STORE_UNAVAILABLE');

  console.log('SESSION LIFECYCLE SELFTEST PASS');
})().catch(e=>{console.error(e);process.exit(1)});
