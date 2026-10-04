'use strict';

const crypto=require('crypto');

function isoMs(value){
  const n=typeof value==='number'?value:Date.parse(String(value||''));
  return Number.isFinite(n)?n:0;
}
function cleanSource(value){
  const s=String(value||'unknown').replace(/[^a-z0-9_.:-]/gi,'').slice(0,40);
  return s||'unknown';
}
function rowToRecord(row){
  return{
    idHash:String(row.id_hash||row.idHash||''),
    issuedAt:new Date(row.issued_at||row.issuedAt).toISOString(),
    expiresAt:new Date(row.expires_at||row.expiresAt).toISOString(),
    revokedAt:row.revoked_at||row.revokedAt?new Date(row.revoked_at||row.revokedAt).toISOString():null,
    source:cleanSource(row.source),
    ipTag:row.ip_tag==null&&row.ipTag==null?null:String(row.ip_tag??row.ipTag).slice(0,32),
    lastSeenAt:row.last_seen_at||row.lastSeenAt?new Date(row.last_seen_at||row.lastSeenAt).toISOString():null
  };
}

function createPgSessionStore(db){
  if(!db||typeof db.query!=='function')throw new Error('database client required');
  return{
    async init(){
      await db.query('CREATE TABLE IF NOT EXISTS jarvis_admin_sessions(id_hash text PRIMARY KEY,issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,source text NOT NULL,ip_tag text,last_seen_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())');
      await db.query("CREATE TABLE IF NOT EXISTS jarvis_admin_session_policy(id text PRIMARY KEY,legacy_allowed boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now())");
      await db.query("INSERT INTO jarvis_admin_session_policy(id,legacy_allowed,updated_at) VALUES('admin',true,now()) ON CONFLICT(id) DO NOTHING");
      const policy=await db.query("SELECT legacy_allowed FROM jarvis_admin_session_policy WHERE id='admin'");
      const sessions=await db.query("SELECT id_hash,issued_at,expires_at,revoked_at,source,ip_tag,last_seen_at FROM jarvis_admin_sessions WHERE expires_at > now()-interval '7 days' ORDER BY issued_at DESC LIMIT 200");
      return{legacyAllowed:policy.rows.length?policy.rows[0].legacy_allowed!==false:true,sessions:sessions.rows.map(rowToRecord)};
    },
    async create(record){
      await db.query('INSERT INTO jarvis_admin_sessions(id_hash,issued_at,expires_at,revoked_at,source,ip_tag,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id_hash) DO NOTHING',[record.idHash,record.issuedAt,record.expiresAt,record.revokedAt,record.source,record.ipTag,record.lastSeenAt]);
    },
    async revoke(idHash,revokedAt){
      await db.query('UPDATE jarvis_admin_sessions SET revoked_at=$2 WHERE id_hash=$1 AND revoked_at IS NULL',[idHash,revokedAt]);
    },
    async revokeOthers(currentIdHash,revokedAt){
      await db.query('UPDATE jarvis_admin_sessions SET revoked_at=$2 WHERE id_hash<>$1 AND revoked_at IS NULL AND expires_at>now()',[currentIdHash,revokedAt]);
    },
    async disableLegacy(){
      // Monotonic migration: once v2 cookies are disabled, no API path may revive them.
      await db.query("UPDATE jarvis_admin_session_policy SET legacy_allowed=false,updated_at=now() WHERE id='admin' AND legacy_allowed<>false");
    }
  };
}

function createSessionLifecycle({secret,store=null,clock=()=>Date.now()}={}){
  if(!secret)throw new Error('session lifecycle secret required');
  const records=new Map();
  const configured=!!store;
  let ready=!configured;
  let durable=false;
  // Configured durable stores fail closed until the persisted migration policy is loaded.
  let legacyAllowed=!configured;

  function idHash(sid){
    return crypto.createHmac('sha256',secret).update('jarvis:session-id:'+String(sid||'')).digest('hex');
  }
  function requireDurable(){
    if(!configured||!ready||!durable){const e=new Error('durable session storage unavailable');e.code='SESSION_STORE_UNAVAILABLE';throw e}
  }
  function purge(){
    const cutoff=clock()-7*24*60*60*1000;
    for(const [id,r] of records)if(isoMs(r.expiresAt)<cutoff)records.delete(id);
  }
  async function init(){
    if(!configured){ready=true;durable=false;legacyAllowed=true;return status()}
    ready=false;durable=false;legacyAllowed=false;
    const loaded=await store.init();
    records.clear();
    for(const raw of Array.isArray(loaded.sessions)?loaded.sessions:[]){
      const r=rowToRecord(raw);if(r.idHash)records.set(r.idHash,r);
    }
    legacyAllowed=loaded.legacyAllowed!==false;
    ready=true;durable=true;purge();
    return status();
  }
  async function issue({source='unknown',ipTag=null,ttlMs=30*24*60*60*1000}={}){
    if(configured&&!ready){const e=new Error('durable session storage unavailable');e.code='SESSION_STORE_UNAVAILABLE';throw e}
    const issuedAtMs=clock(),expiresAtMs=issuedAtMs+Math.max(60_000,Math.min(30*24*60*60*1000,Number(ttlMs)||0));
    const sid=crypto.randomBytes(32).toString('base64url'),hash=idHash(sid);
    const record={idHash:hash,issuedAt:new Date(issuedAtMs).toISOString(),expiresAt:new Date(expiresAtMs).toISOString(),revokedAt:null,source:cleanSource(source),ipTag:ipTag?String(ipTag).slice(0,32):null,lastSeenAt:null};
    // Persist before exposing the signed cookie: a configured store never creates an
    // untracked session if durable storage is unavailable.
    if(configured)await store.create(record);
    records.set(hash,record);purge();
    return{sid,idHash:hash,issuedAtMs,expiresAtMs,durable:configured&&durable,source:record.source};
  }
  function validate({sid,iat,exp}={}){
    if(!ready||!sid||!Number.isFinite(iat)||!Number.isFinite(exp)||exp<=clock())return null;
    const hash=idHash(sid),r=records.get(hash);if(!r||r.revokedAt)return null;
    if(Math.abs(isoMs(r.issuedAt)-iat)>1000||Math.abs(isoMs(r.expiresAt)-exp)>1000)return null;
    r.lastSeenAt=new Date(clock()).toISOString();
    return{idHash:hash,source:r.source,issuedAt:r.issuedAt,expiresAt:r.expiresAt,durable:configured&&durable};
  }
  function acceptsLegacy(){return ready&&legacyAllowed}
  function status(){
    return{
      configured,
      ready,
      durable:configured&&durable,
      legacyAllowed:ready&&legacyAllowed,
      legacyPolicy:!ready?'unavailable':(legacyAllowed?'accept-existing-v2-until-expiry':'disabled'),
      managedSessions:records.size
    };
  }
  function list(currentIdHash=null){
    purge();const t=clock();
    return [...records.values()].sort((a,b)=>isoMs(b.issuedAt)-isoMs(a.issuedAt)).map(r=>({
      id:r.idHash,current:!!currentIdHash&&r.idHash===currentIdHash,source:r.source,issuedAt:r.issuedAt,expiresAt:r.expiresAt,revokedAt:r.revokedAt,lastSeenAt:r.lastSeenAt,
      status:r.revokedAt?'revoked':isoMs(r.expiresAt)<=t?'expired':'active'
    }));
  }
  async function revoke(idHashValue){
    requireDurable();const r=records.get(String(idHashValue||''));if(!r)return{found:false,changed:false};
    if(r.revokedAt)return{found:true,changed:false};
    const at=new Date(clock()).toISOString();
    // Write durable revocation first; only then change the in-memory authorization view.
    await store.revoke(r.idHash,at);r.revokedAt=at;return{found:true,changed:true,revokedAt:at};
  }
  async function revokeOthers(currentIdHash){
    requireDurable();const current=String(currentIdHash||'');if(!current||!records.has(current))throw new Error('current managed session required');
    const at=new Date(clock()).toISOString();await store.revokeOthers(current,at);let count=0;
    for(const r of records.values())if(r.idHash!==current&&!r.revokedAt&&isoMs(r.expiresAt)>clock()){r.revokedAt=at;count++}
    return{count,revokedAt:at};
  }
  async function disableLegacy(){
    requireDurable();
    if(!legacyAllowed)return{legacyAllowed:false,durable:true,legacyPolicy:'disabled',changed:false};
    await store.disableLegacy();
    legacyAllowed=false;
    return{legacyAllowed:false,durable:true,legacyPolicy:'disabled',changed:true};
  }
  return{init,issue,validate,acceptsLegacy,status,list,revoke,revokeOthers,disableLegacy,idHash};
}

module.exports={createSessionLifecycle,createPgSessionStore};
