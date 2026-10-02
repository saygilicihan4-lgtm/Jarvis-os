const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const VERSION='1.0';
const PBKDF2_ITERATIONS=210000;
const KEY_BYTES=32;
const DIGEST='sha256';
const MAX_FAILURES=5;
const LOCK_MS=5*60*1000;

function statePath(workspace){return path.join(workspace,'.jarvis-memory','bluetooth-pairing.json')}
function readState(workspace){
  try{return JSON.parse(fs.readFileSync(statePath(workspace),'utf8'))}catch(_){return{version:VERSION,devices:{}}}
}
function writeState(workspace,state){
  const file=statePath(workspace); fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(state,null,2),'utf8'); fs.renameSync(tmp,file); return file;
}
function normalizeId(id){return String(id||'').trim().slice(0,180)}
function derive(password,salt){return crypto.pbkdf2Sync(String(password||''),salt,PBKDF2_ITERATIONS,KEY_BYTES,DIGEST)}
function safeEqual(a,b){return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function pair(workspace,{deviceId,password,label}={}){
  const id=normalizeId(deviceId),pw=String(password||'');
  if(!id)throw new Error('BLUETOOTH_DEVICE_ID_REQUIRED');
  if(pw.length<8)throw new Error('BLUETOOTH_PASSWORD_MIN_8');
  const state=readState(workspace),salt=crypto.randomBytes(16),hash=derive(pw,salt);
  state.devices[id]={label:String(label||'Bluetooth device').slice(0,80),salt:salt.toString('base64'),hash:hash.toString('base64'),failed:0,lockedUntil:0,pairedAt:new Date().toISOString()};
  writeState(workspace,state);
  return{ok:true,deviceId:id,label:state.devices[id].label};
}
function authenticate(workspace,{deviceId,password}={}){
  const id=normalizeId(deviceId),state=readState(workspace),row=state.devices[id];
  if(!row)return{ok:false,reason:'not_paired'};
  const now=Date.now();
  if(Number(row.lockedUntil||0)>now)return{ok:false,reason:'locked',retryAfterMs:Number(row.lockedUntil)-now};
  let ok=false;
  try{ok=safeEqual(derive(password,Buffer.from(row.salt,'base64')),Buffer.from(row.hash,'base64'))}catch(_){}
  if(!ok){
    row.failed=Number(row.failed||0)+1;
    if(row.failed>=MAX_FAILURES){row.lockedUntil=now+LOCK_MS;row.failed=0}
    writeState(workspace,state);
    return{ok:false,reason:row.lockedUntil>now?'locked':'bad_password'};
  }
  row.failed=0;row.lockedUntil=0;row.lastAuthenticatedAt=new Date().toISOString();writeState(workspace,state);
  return{ok:true,deviceId:id,label:row.label};
}
function authorizeCommand(auth,{action}={}){
  if(!auth||!auth.ok)return{ok:false,reason:'authentication_required'};
  const a=String(action||'').toLowerCase();
  if(/publish|approve|payment|secret|token|credential|shutdown|reboot|delete/.test(a))return{ok:false,reason:'protected_action_requires_primary_approval'};
  return{ok:true};
}
function listDevices(workspace){const s=readState(workspace);return Object.entries(s.devices||{}).map(([deviceId,x])=>({deviceId,label:x.label,pairedAt:x.pairedAt,lastAuthenticatedAt:x.lastAuthenticatedAt||null,locked:Number(x.lockedUntil||0)>Date.now()}))}
module.exports={VERSION,PBKDF2_ITERATIONS,MAX_FAILURES,LOCK_MS,pair,authenticate,authorizeCommand,listDevices};
