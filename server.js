const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const webpush=require('web-push');
const {Pool}=require('pg');
const {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}=require('@simplewebauthn/server');

const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const TOKEN=process.env.JARVIS_TOKEN||'';
const DEVICE_SECRET=process.env.JARVIS_DEVICE_SECRET||'';
const STATE_SECRET=process.env.JARVIS_STATE_SECRET||'';
const BOOTSTRAP_PAIR_HASH=process.env.JARVIS_BOOTSTRAP_PAIR_HASH||'';
const BOOTSTRAP_PAIR_EXP=Number(process.env.JARVIS_BOOTSTRAP_PAIR_EXP||0);
const VAPID_PUBLIC=String(process.env.JARVIS_VAPID_PUBLIC_KEY||'').trim();
const VAPID_PRIVATE=String(process.env.JARVIS_VAPID_PRIVATE_KEY||'').trim();
const VAPID_SUBJECT=String(process.env.JARVIS_VAPID_SUBJECT||'mailto:jarvis@localhost').trim();
const DATABASE_URL=String(process.env.DATABASE_URL||'').trim();
const db=DATABASE_URL?new Pool({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}):null;
let dbReady=false;
async function initDurableMemory(){
 if(!db){log('DB_CONFIG','DATABASE_URL missing; volatile mode');return;}
 log('DB_CONNECT','DATABASE_URL present; PostgreSQL connection starting');
 const timer=setTimeout(()=>log('DB_CONNECT_TIMEOUT','PostgreSQL init still pending after 8s'),8000);
 try{
 await db.query('CREATE TABLE IF NOT EXISTS jarvis_push_subscriptions(id text PRIMARY KEY,endpoint text NOT NULL,p256dh text NOT NULL,auth text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),last_success_at timestamptz)');
 await db.query('CREATE TABLE IF NOT EXISTS jarvis_reminders(id uuid PRIMARY KEY,title text NOT NULL,remind_at timestamptz NOT NULL,sent boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,delivered integer NOT NULL DEFAULT 0)');
 await db.query('CREATE TABLE IF NOT EXISTS jarvis_webauthn_credentials(id text PRIMARY KEY,public_key bytea NOT NULL,counter bigint NOT NULL DEFAULT 0,transports jsonb NOT NULL DEFAULT \'[]\'::jsonb,device_type text,backed_up boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz)');
 await db.query("CREATE TABLE IF NOT EXISTS jarvis_persistence_probe(id text PRIMARY KEY,boot_count integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now())");
 const probe=await db.query("INSERT INTO jarvis_persistence_probe(id,boot_count,updated_at) VALUES('cloud-memory',1,now()) ON CONFLICT(id) DO UPDATE SET boot_count=jarvis_persistence_probe.boot_count+1,updated_at=now() RETURNING boot_count");
 log('DB_PERSISTENCE','boot_count='+probe.rows[0].boot_count);
 const ps=await db.query('SELECT * FROM jarvis_push_subscriptions');state.pushSubscriptions={};for(const x of ps.rows)state.pushSubscriptions[x.id]={endpoint:x.endpoint,keys:{p256dh:x.p256dh,auth:x.auth},createdAt:x.created_at,lastSuccessAt:x.last_success_at};
 const rs=await db.query('SELECT * FROM jarvis_reminders ORDER BY remind_at');state.reminders=rs.rows.map(x=>({id:x.id,title:x.title,when:new Date(x.remind_at).toISOString(),sent:x.sent,createdAt:x.created_at,sentAt:x.sent_at,delivered:x.delivered}));
 dbReady=true;log('DB_READY','durable reminders='+state.reminders.length+' push='+Object.keys(state.pushSubscriptions).length);
 if(state.reminders.length)log('DB_RESTORE_REMINDERS','restored='+state.reminders.length);
 if(Object.keys(state.pushSubscriptions).length)log('DB_RESTORE_PUSH','restored='+Object.keys(state.pushSubscriptions).length);
 } finally { clearTimeout(timer); }
}
async function persistPush(id,s){if(!dbReady)throw new Error('database not ready');await db.query('INSERT INTO jarvis_push_subscriptions(id,endpoint,p256dh,auth,last_success_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,last_success_at=EXCLUDED.last_success_at',[id,s.endpoint,s.keys.p256dh,s.keys.auth,s.lastSuccessAt])}
async function persistReminder(r){if(!dbReady)throw new Error('database not ready');await db.query('INSERT INTO jarvis_reminders(id,title,remind_at,sent,sent_at,delivered) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,remind_at=EXCLUDED.remind_at,sent=EXCLUDED.sent,sent_at=EXCLUDED.sent_at,delivered=EXCLUDED.delivered',[r.id,r.title,r.when,!!r.sent,r.sentAt||null,r.delivered||0])}

if(VAPID_PUBLIC&&VAPID_PRIVATE){try{webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC,VAPID_PRIVATE)}catch(e){console.error('[JARVIS] VAPID CONFIG ERROR:',e.message)}}
let bootstrapPairUsed=false;
const PHONE_SESSION_SECRET=crypto.createHmac('sha256',DEVICE_SECRET||STATE_SECRET||TOKEN||'jarvis-dev-fallback').update('jarvis:phone-session:v2').digest();
let phoneCode=String(crypto.randomInt(0,100000000)).padStart(8,'0');
let phoneCodeExp=Date.now()+5*60*1000;
let phoneCodeUsed=false;
function cookieMap(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2))}
function setJarvisSessionCookie(req,res){
  const exp=Date.now()+30*24*60*60*1000,token=signPhoneSession(req,exp);
  res.setHeader('set-cookie','jarvis_session='+encodeURIComponent(token)+'; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax');
  return exp;
}
function clientIp(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}
function ipTag(req){return crypto.createHmac('sha256',PHONE_SESSION_SECRET).update('ip:'+clientIp(req)).digest('base64url').slice(0,16)}
function signPhoneSession(req,exp){const body=Buffer.from(JSON.stringify({scope:'admin-ui',exp,ip:ipTag(req),v:2})).toString('base64url');return body+'.'+crypto.createHmac('sha256',PHONE_SESSION_SECRET).update(body).digest('base64url')}
function validPhoneSession(req){
 const t=cookieMap(req).jarvis_session;if(!t||!t.includes('.'))return false;
 try{
  const [body,sig]=t.split('.'),expected=crypto.createHmac('sha256',PHONE_SESSION_SECRET).update(body).digest(),got=Buffer.from(sig,'base64url');
  if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return false;
  const p=JSON.parse(Buffer.from(body,'base64url').toString());
  if(p.scope!=='admin-ui'||p.exp<=Date.now())return false;
  req.jarvisSessionRisk={ipChanged:!!p.ip&&p.ip!==ipTag(req)};
  return true;
 }catch{return false}
}
const BOOTSTRAP_DEVICE_ID=process.env.JARVIS_BOOTSTRAP_DEVICE_ID||'';
const BOOTSTRAP_DEVICE_EXP=Number(process.env.JARVIS_BOOTSTRAP_DEVICE_EXP||0);
// DEVICE_AUTH_CHAIN_V2_2
const state={
  tasks:[],
  audit:[],
  accountPolicies:{},
  pairingCodes:{},
  pushSubscriptions:{},
  reminders:[],
  webauthnChallenges:{registration:new Map(),authentication:new Map()},
  stateRevision:0,
  workers:{pc:{name:null,version:null,lastSeen:null,capabilities:[],memory:null},devices:{}}
};

function now(){return new Date().toISOString()}
function touchState(){state.stateRevision++;}
function log(type,message){
  state.audit.push({at:now(),type,message});
  if(state.audit.length>300)state.audit.shift();
  if(String(type).startsWith('DB_')) console.log('[JARVIS] '+type+': '+String(message));
}
function json(res,code,obj){
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(obj));
}
function readJson(req,cb){
  let b='';
  req.on('data',x=>{b+=x;if(b.length>1_000_000)req.destroy()});
  req.on('end',()=>{try{cb(null,JSON.parse(b||'{}'))}catch(e){cb(e)}});
}
function authorized(req){
  if(!TOKEN)return true;
  const h=req.headers.authorization||'';
  return h===('Bearer '+TOKEN)||req.headers['x-jarvis-token']===TOKEN||validPhoneSession(req);
}
function deviceTokenPayload(deviceId,ttlMs=7*24*60*60*1000,extra={}){
  return{deviceId,exp:Date.now()+ttlMs,v:1,...extra};
}
function signDevicePayload(p){
  if(!DEVICE_SECRET)throw new Error('device secret unavailable');
  const body=Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig=crypto.createHmac('sha256',DEVICE_SECRET).update(body).digest('base64url');
  return body+'.'+sig;
}
function verifyDeviceToken(token){
  if(!DEVICE_SECRET||!token||!token.includes('.'))return null;
  try{
    const [body,sig]=token.split('.'),expected=crypto.createHmac('sha256',DEVICE_SECRET).update(body).digest();
    const got=Buffer.from(sig,'base64url');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;
    const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(p.v!==1||!p.deviceId||!Number.isFinite(p.exp)||p.exp<Date.now())return null;
    return p;
  }catch(e){return null}
}
function workerIdentity(req){
  const raw=String(req.headers.authorization||'');
  if(raw.startsWith('Device '))return verifyDeviceToken(raw.slice(7));
  const x=String(req.headers['x-jarvis-device-token']||'');return verifyDeviceToken(x);
}
function agentFor(c){
  c=String(c||'').toLowerCase();
  if(/shopify|ürün|stok|sipariş|varova/.test(c))return'COMMERCE';
  if(/video|short|reels|youtube/.test(c))return'CREATOR';
  if(requiredCapability(c))return'DEVELOPER';
  if(/kod|uygulama|site|deploy|github|dosya|klasör|bilgisayar|pc:|proje oluştur|proje olustur|yeni proje/.test(c))return'DEVELOPER';
  if(/araştır|bul|incele/.test(c))return'RESEARCH';
  if(/reklam|büyü|satış|seo/.test(c))return'GROWTH';
  return'CORE';
}
function risky(c){
  return /(öde|satın al|reklam bütçe|para gönder|iade|refund|sözleşme imzala|sil|delete|format)/i.test(String(c||''));
}
function remoteAgent(a){return['DEVELOPER','CREATOR','COMMERCE'].includes(a)}
function requiredCapability(command){
  const c=String(command||'').toLowerCase().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  if(deterministicPlan(command))return'transaction_journal_v3';
  if(/^(optimizasyonu uygula|optimizasyon uygula|apply optimization)/.test(c))return'strategy_rollback';
  if(/^(optimizasyon durumu|strategy selection|en iyi strateji)/.test(c))return'strategy_selection';
  if(/^(öğrenme durumu|ogrenme durumu|strategy metrics|learning status)/.test(c))return'strategy_metrics';
  if(/^(hafıza durumu|hafiza durumu|memory status)/.test(c))return'local_memory';
  if(/^(işlemleri listele|islemleri listele|process list|çalışan işlemler|calisan islemler)/.test(c))return'process_list_v1';
  if(/^(disk durumu|disk status|depolama durumu)/.test(c))return'disk_status_v1';
  if(/^(ağ durumu|ag durumu|network status|internet durumu)/.test(c))return'network_status_v1';
  if(/^(yerel ai durumu|local ai status|ai readiness)/.test(c))return'local_ai_readiness_v1';
  if(/^(sistem durumu|system status|pc durumu)/.test(c))return'system_status';
  if(/^(dosyaları listele|dosya listesi|list files)/.test(c))return'list_files';
  if(/^(dosya oluştur|dosya olustur|write file)/.test(c))return'write_file';
  if(/^(dosya oku|read file)/.test(c))return'read_file';
  if(/^(not al)/.test(c))return'write_note';
  if(/^(proje paketi oluştur|proje paketi olustur|workspace bundle)/.test(c))return'workspace_bundle';
  if(/^(klasör oluştur|klasor olustur|make folder|proje klasörü oluştur|proje klasoru olustur)/.test(c))return'make_folder';
  if(/^(proje oluştur|proje olustur|yeni proje|project create)/.test(c))return'project_scaffold';
  return null;
}
function deterministicPlan(command){
  const raw=String(command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  const m=raw.match(/^(?:çalışma alanı hazırla|calisma alani hazirla|workspace hazırla|workspace hazirla)\s+([^:]+)(?::\s*(.*))?$/i);
  if(!m)return null;
  const name=m[1].trim().replace(/[<>:"|?*]/g,'-').slice(0,80);
  if(!name||name==='.'||name==='..')return null;
  const desc=(m[2]||'JARVIS kontrollü görev çalışma alanı.').trim().slice(0,1000);
  return{
    version:1,
    steps:[
      {action:'make_folder',path:name},
      {action:'write_file',path:name+'/README.md',content:'# '+name+'\n\n'+desc+'\n'},
      {action:'write_file',path:name+'/TASKS.md',content:'# Tasks\n\n- [ ] Plan\n- [ ] Execute\n- [ ] Verify\n'},
      {action:'verify_file',path:name+'/README.md'},
      {action:'verify_file',path:name+'/TASKS.md'}
    ]
  };
}
function deviceAllows(w,agent,need){
  if(!w||!w.approved||!workerOnline(w))return false;
  const roles=Array.isArray(w.roles)&&w.roles.length?w.roles:['DEVELOPER'];
  const allowed=Array.isArray(w.allowedCapabilities)&&w.allowedCapabilities.length?w.allowedCapabilities:w.capabilities;
  return roles.includes(agent)&&w.capabilities.includes(need)&&allowed.includes(need);
}
function workerSupports(command,deviceId=null,agent='DEVELOPER'){
  const need=requiredCapability(command);
  if(!need)return{ok:false,need:null};
  if(deviceId)return{ok:deviceAllows(deviceWorker(deviceId),agent,need),need};
  const devices=Object.values(state.workers.devices);
  if(devices.some(w=>deviceAllows(w,agent,need)))return{ok:true,need};
  return{ok:state.workers.pc.capabilities.includes(need)&&pcOnline(),need};
}
function chooseDevice(command,agent='DEVELOPER'){
  const need=requiredCapability(command);
  if(!need)return null;
  const eligible=Object.entries(state.workers.devices)
    .filter(([,w])=>deviceAllows(w,agent,need))
    .sort((a,b)=>new Date(b[1].lastSeen)-new Date(a[1].lastSeen));
  return eligible.length?eligible[0][0]:null;
}
function normalizeAccountType(x){const v=String(x||'').toLowerCase();return['github','shopify'].includes(v)?v:null}
function accountActionFor(command){
  const c=String(command||'').toLowerCase();
  if(/github/.test(c)){
    if(/delete|sil/.test(c))return{type:'github',action:'delete'};
    if(/deploy|push|commit|oluştur|olustur|create|update|güncelle/.test(c))return{type:'github',action:'write'};
    return{type:'github',action:'read'};
  }
  if(/shopify|varova|ürün|stok|sipariş/.test(c)){
    if(/delete|sil/.test(c))return{type:'shopify',action:'delete'};
    if(/refund|iade/.test(c))return{type:'shopify',action:'refund'};
    if(/oluştur|olustur|update|güncelle|stok gir|yayınla|yayinla/.test(c))return{type:'shopify',action:'write'};
    return{type:'shopify',action:'read'};
  }
  return null;
}
function accountPolicyAllows(deviceId,agent,command){
  const a=accountActionFor(command);if(!a)return{ok:true,account:null};
  if(!deviceId)return{ok:false,account:a,reason:'Hesap görevi için hedef cihaz gerekli'};
  const key=deviceId+'|'+a.type, p=state.accountPolicies[key];
  if(!p)return{ok:false,account:a,reason:a.type+' hesap erişim politikası tanımlı değil'};
  if(!p.agents.includes(agent)||!p.actions.includes(a.action))return{ok:false,account:a,reason:'Hesap politikası bu ajan/eyleme izin vermiyor'};
  return{ok:true,account:a};
}
function taskById(id){return state.tasks.find(t=>t.id===Number(id))}
function taskByUid(uid){return state.tasks.find(t=>t.uid===String(uid||''))}
function taskLookup(id,uid){return uid?taskByUid(uid):taskById(id)}
function workerOnline(w){const t=w&&w.lastSeen;return !!t&&(Date.now()-new Date(t).getTime()<15000)}
function pcOnline(){return workerOnline(state.workers.pc)||Object.values(state.workers.devices).some(w=>w.approved&&workerOnline(w))}
function deviceWorker(id){return id&&state.workers.devices[id]||null}
function deviceOnline(id){return workerOnline(deviceWorker(id))}
function publicDevices(){
  return Object.fromEntries(Object.entries(state.workers.devices).map(([id,w])=>[id,{name:w.name,version:w.version,lastSeen:w.lastSeen,capabilities:w.capabilities,memory:w.memory,approved:!!w.approved,roles:w.roles||[],allowedCapabilities:w.allowedCapabilities||[],authMode:w.authMode||'legacy',credentialIssuedAt:w.credentialIssuedAt||null,online:workerOnline(w)}]));
}
function prepareTask(t,approved=false){
  if(risky(t.command)&&!approved){
    t.status='waiting_approval';
    t.message='Yüksek riskli/geri döndürülemez eylem: açık onay gerekli.';
    log('GUARDRAIL','#'+t.id+' onaya alındı');
    return;
  }
  if(remoteAgent(t.agent)){
    const requested=t.targetDeviceId||null;
    const support=workerSupports(t.command,requested,t.agent);
    const anyOnline=pcOnline()||Object.values(state.workers.devices).some(w=>w.approved&&workerOnline(w));
    if(requested&&!deviceWorker(requested)){
      t.status='needs_tool';t.message='Hedef bilgisayar kayıtlı değil: '+requested;log('ROUTE_FAIL','#'+t.id+' '+t.message);return;
    }
    if(requested&&deviceWorker(requested)&&!deviceWorker(requested).approved){
      t.status='waiting_approval';t.message='Hedef bilgisayar henüz cihaz onayı bekliyor.';log('DEVICE_WAIT','#'+t.id+' '+requested);return;
    }
    if(anyOnline&&!support.ok){
      t.status='needs_tool';
      t.message=support.need?'Bağlı PC Worker bu yeteneği desteklemiyor: '+support.need+' · Worker güncellemesi gerekli.':'Bu görev için güvenli PC aracı henüz tanımlı değil.';
      log('TOOL_MISSING','#'+t.id+' '+t.message);
      return;
    }
    t.status='waiting_worker';
    t.targetDeviceId=requested||chooseDevice(t.command,t.agent)||null;
    const accountCheck=accountPolicyAllows(t.targetDeviceId,t.agent,t.command);
    if(!accountCheck.ok){
      t.status='waiting_approval';t.message='Hesap erişimi bekliyor: '+accountCheck.reason;log('ACCOUNT_GUARD','#'+t.id+' '+t.message);return;
    }
    t.message=t.targetDeviceId?'Hedef PC bekleniyor: '+t.targetDeviceId:'Uygun PC Worker bekleniyor.';
    log('ROUTE','#'+t.id+' '+(t.targetDeviceId?'hedef '+t.targetDeviceId:'uygun Worker')+' kuyruğuna gönderildi');
    return;
  }
  if(/self.?heal|hata testi|retry/i.test(t.command)){
    return runLocalSelfHeal(t);
  }
  t.status='needs_tool';
  t.message='Bu görev için henüz gerçek araç bağlı değil; tamamlandı sayılmadı.';
  log('TOOL_MISSING','#'+t.id+' araç bekliyor');
}
function runLocalSelfHeal(t){
  t.status='running';
  log('EXECUTE','#'+t.id+' local self-heal testi');
  setTimeout(()=>{
    t.attempts++;
    if(t.attempts===1){
      t.status='retrying';
      t.message='İlk strateji başarısız (kontrollü test). Alternatif strateji deneniyor.';
      log('DIAGNOSE','#'+t.id+' strateji değiştirildi');
      return setTimeout(()=>runLocalSelfHeal(t),300);
    }
    t.status='completed';
    t.message='Self-healing döngüsü ikinci stratejide doğrulandı.';
    log('VERIFY','#'+t.id+' self-heal doğrulandı');
  },250);
}
function snapshotPayload(){
  return{
    schemaVersion:2,
    revision:state.stateRevision,
    savedAt:now(),
    tasks:state.tasks.slice(-500),
    audit:state.audit.slice(-300),
    accountPolicies:state.accountPolicies,
    devices:Object.fromEntries(Object.entries(state.workers.devices).map(([id,w])=>[id,{name:w.name,approved:!!w.approved,roles:w.roles||[],allowedCapabilities:w.allowedCapabilities||[]}]))
  };
}
function snapshotSignature(payload){
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
}
function publicState(){
  const signedPc=Object.values(state.workers.devices).filter(w=>w.approved&&workerOnline(w)).sort((a,b)=>new Date(b.lastSeen)-new Date(a.lastSeen))[0];
  const pc=signedPc||state.workers.pc;
  return{
    accountPolicies:Object.values(state.accountPolicies).map(p=>({...p,secretStored:false})),
    tasks:state.tasks,
    audit:state.audit,
    remoteControl:{pcOnline:pcOnline(),queued:state.tasks.filter(x=>x.status==='waiting_worker').length,running:state.tasks.filter(x=>x.status==='claimed').length},
    assistant:{pushConfigured:!!process.env.JARVIS_VAPID_PUBLIC_KEY,pushSubscriptions:Object.keys(state.pushSubscriptions).length,reminders:state.reminders.length},
    workers:{
      pc:{
        name:pc.name,
        version:pc.version,
        lastSeen:pc.lastSeen,
        capabilities:pc.capabilities||[],
        memory:pc.memory||null,
        online:workerOnline(pc)
      },
      devices:publicDevices()
    }
  };
}

async function dispatchDueReminders(){
  if(!VAPID_PUBLIC||!VAPID_PRIVATE)return;
  const due=state.reminders.filter(r=>!r.sent&&new Date(r.when).getTime()<=Date.now());
  for(const r of due){
    let delivered=0;
    const payload=JSON.stringify({title:'JARVIS Hatırlatma',body:r.title,url:'/',tag:'jarvis-reminder-'+r.id});
    for(const [id,sub] of Object.entries(state.pushSubscriptions)){
      try{
        await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},payload,{TTL:3600});
        sub.lastSuccessAt=now();delivered++;
      }catch(e){
        if(e&&[404,410].includes(e.statusCode))delete state.pushSubscriptions[id];
        log('PUSH_FAIL',id+' '+String(e&&e.statusCode||e&&e.message||'send failed').slice(0,120));
      }
    }
    if(delivered>0){r.sent=true;r.sentAt=now();r.delivered=delivered;touchState();persistReminder(r).catch(e=>log('DB_REMINDER_ERROR',String(e.message||e).slice(0,120)));log('REMINDER_PUSH',r.id+' delivered '+delivered)}
  }
}
setInterval(()=>dispatchDueReminders().catch(e=>log('PUSH_LOOP_ERROR',String(e.message||e).slice(0,120))),30000);
// Also sweep immediately after durable state restore/startup so a Render restart
// cannot add an unnecessary 30-second delay to an already-due reminder.
const startupPushSweep=setInterval(()=>{
  if(!dbReady)return;
  clearInterval(startupPushSweep);
  dispatchDueReminders().catch(e=>log('PUSH_STARTUP_ERROR',String(e.message||e).slice(0,120)));
},1000);

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const pathname=u.pathname;

  // WEBAUTHN_V1: server-verified passkey enrollment. Enrollment requires an
  // already trusted JARVIS session; it does not weaken the existing auth path.
  const rpID=String(req.headers.host||'').split(':')[0];
  const expectedOrigin='https://'+rpID;
  const challengeKey=()=>crypto.createHash('sha256').update(String(cookieMap(req).jarvis_session||clientIp(req))).digest('hex');

  if(pathname==='/api/webauthn/diagnostics'&&req.method==='GET'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    db.query('SELECT count(*)::int AS count,max(last_used_at) AS last_used,max(created_at) AS last_created FROM jarvis_webauthn_credentials').then(q=>json(res,200,{ok:true,count:Number(q.rows[0].count),lastCreated:q.rows[0].last_created||null,lastUsed:q.rows[0].last_used||null,rpID,expectedOrigin})).catch(()=>json(res,503,{error:'durable storage unavailable'}));
    return;
  }

  if(pathname==='/api/webauthn/status'&&req.method==='GET'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    db.query("SELECT count(*)::int AS count FROM jarvis_webauthn_credentials WHERE public_key IS NOT NULL").then(q=>json(res,200,{ok:true,enrolled:Number(q.rows[0].count)>0,count:Number(q.rows[0].count),policy:'server-verified'})).catch(()=>json(res,503,{error:'durable storage unavailable'}));
    return;
  }

  if(pathname==='/api/webauthn/register/options'&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    Promise.resolve(generateRegistrationOptions({
      rpName:'JARVIS OS',rpID,
      userName:'jarvis-owner',userDisplayName:'JARVIS Owner',
      attestationType:'none',
      authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'},
      supportedAlgorithmIDs:[-7,-257],
    })).then(options=>{
      state.webauthnChallenges.registration.set(challengeKey(),{challenge:options.challenge,expires:Date.now()+5*60*1000});
      return json(res,200,options);
    }).catch(e=>json(res,500,{error:'registration options failed'}));
    return;
  }

  if(pathname==='/api/webauthn/register/verify'&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    const pending=state.webauthnChallenges.registration.get(challengeKey());
    if(!pending||pending.expires<Date.now())return json(res,400,{error:'registration challenge expired'});
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      Promise.resolve(verifyRegistrationResponse({response:d,expectedChallenge:pending.challenge,expectedOrigin,expectedRPID:rpID,requireUserVerification:true}))
      .then(async v=>{
        if(!v.verified||!v.registrationInfo){log('WEBAUTHN_REGISTER_REJECT','verification returned unverified');return json(res,403,{error:'passkey verification failed'})}
        const a=v.registrationInfo.credential;
        await db.query('INSERT INTO jarvis_webauthn_credentials(id,public_key,counter,transports,device_type,backed_up,last_used_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(id) DO UPDATE SET public_key=EXCLUDED.public_key,counter=EXCLUDED.counter,transports=EXCLUDED.transports,device_type=EXCLUDED.device_type,backed_up=EXCLUDED.backed_up,last_used_at=now()',[a.id,Buffer.from(a.publicKey),Number(a.counter||0),JSON.stringify(a.transports||[]),String(v.registrationInfo.credentialDeviceType||''),!!v.registrationInfo.credentialBackedUp]);
        state.webauthnChallenges.registration.delete(challengeKey());
        log('WEBAUTHN_REGISTER','server-verified passkey enrolled');
        return json(res,200,{ok:true,verified:true,stored:true});
      }).catch(e=>{log('WEBAUTHN_REGISTER_FAIL',String(e.message||e).slice(0,120));return json(res,403,{error:'passkey verification failed'})});
    });
  }

  if(pathname==='/api/webauthn/auth/options'&&req.method==='POST'){
    // Passkey authentication is the recovery path when the trusted session cookie is absent.
    // Do not require an existing session here; verification below still requires a registered credential and UV.

    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    db.query('SELECT id,transports FROM jarvis_webauthn_credentials ORDER BY created_at').then(async q=>{
      if(!q.rows.length)return json(res,409,{error:'no passkey enrolled'});
      const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:q.rows.map(x=>({id:x.id,transports:Array.isArray(x.transports)?x.transports:[]}))});
      state.webauthnChallenges.authentication.set(challengeKey(),{challenge:options.challenge,expires:Date.now()+5*60*1000});
      return json(res,200,options);
    }).catch(e=>json(res,500,{error:'authentication options failed'}));
    return;
  }

  if(pathname==='/api/webauthn/auth/verify'&&req.method==='POST'){

    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    const pending=state.webauthnChallenges.authentication.get(challengeKey());
    if(!pending||pending.expires<Date.now())return json(res,400,{error:'authentication challenge expired'});
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      db.query('SELECT id,public_key,counter,transports FROM jarvis_webauthn_credentials WHERE id=$1',[String(d.id||'')]).then(async q=>{
        if(!q.rows.length)return json(res,403,{error:'unknown passkey'});
        const a=q.rows[0];
        const v=await verifyAuthenticationResponse({response:d,expectedChallenge:pending.challenge,expectedOrigin,expectedRPID:rpID,credential:{id:a.id,publicKey:new Uint8Array(a.public_key),counter:Number(a.counter),transports:Array.isArray(a.transports)?a.transports:[]},requireUserVerification:true});
        if(!v.verified)return json(res,403,{error:'passkey verification failed'});
        await db.query('UPDATE jarvis_webauthn_credentials SET counter=$2,last_used_at=now() WHERE id=$1',[a.id,Number(v.authenticationInfo.newCounter)]);
        state.webauthnChallenges.authentication.delete(challengeKey());
        log('WEBAUTHN_AUTH','server-verified passkey assertion accepted');
        const exp=setJarvisSessionCookie(req,res);
        return json(res,200,{ok:true,verified:true,session:true,expiresAt:new Date(exp).toISOString()});
      }).catch(e=>{log('WEBAUTHN_AUTH_FAIL',String(e.message||e).slice(0,120));return json(res,403,{error:'passkey verification failed'})});
    });
  }

  if(pathname==='/api/session/bootstrap'&&req.method==='GET'){
    if(validPhoneSession(req))return json(res,200,{ok:true,existing:true});
    // Never mint an admin session from User-Agent alone. New browsers/devices
    // must use the one-time session exchange generated by an approved signed Worker.
    log('PHONE_SESSION_BOOTSTRAP_DENY','untrusted browser requested session bootstrap');
    return json(res,401,{error:'trusted session required',pairingRequired:true});
  }

  if(pathname==='/api/session/lan-bootstrap'&&req.method==='POST'){
    // Same public egress alone is NOT sufficient. We also require an approved,
    // recently-online signed PC Worker whose heartbeat came through that same
    // network tag. This gives convenient home-Wi-Fi entry without making IP
    // address itself the credential.
    const tag=ipTag(req);
    const trusted=Object.values(state.workers.devices).find(w=>
      w&&w.approved&&w.authMode==='signed'&&workerOnline(w)&&w.networkTag===tag
    );
    if(!trusted){
      log('LAN_SESSION_BOOTSTRAP_DENY','no signed online worker on matching network');
      return json(res,401,{error:'trusted local network worker required'});
    }
    const exp=setJarvisSessionCookie(req,res);
    log('LAN_SESSION_BOOTSTRAP','same-network signed worker presence accepted');
    return json(res,200,{ok:true,networkTrusted:true,expiresAt:new Date(exp).toISOString()});
  }

  if(pathname==='/api/db/status'&&req.method==='GET'){
    return json(res,200,{configured:!!db,ready:dbReady,persistent:dbReady,reminders:state.reminders.length,pushSubscriptions:Object.keys(state.pushSubscriptions).length,reminderStorage:dbReady?'postgresql':'unavailable',pushStorage:dbReady?'postgresql':'unavailable'});
  }

  if(pathname==='/api/health'){
    const devices=Object.values(state.workers.devices),approved=devices.filter(w=>w.approved),online=approved.filter(workerOnline),signed=approved.filter(w=>w.authMode==='signed');
    const latest=online.slice().sort((a,b)=>String(b.lastSeen||'').localeCompare(String(a.lastSeen||'')))[0]||null;
    return json(res,200,{ok:true,name:'JARVIS OS',version:'0.2.0',zeroCostFirst:true,auth:!!TOKEN,pcWorker:pcOnline(),devices:{approved:approved.length,online:online.length,signed:signed.length,latestVersion:latest&&latest.version||null,latestSeen:latest&&latest.lastSeen||null}});
  }

  if(pathname.startsWith('/api/')&&!['/api/pairing/exchange','/api/session/exchange','/api/session/bootstrap','/api/webauthn/auth/options','/api/webauthn/auth/verify'].includes(pathname)){
    const ident=workerIdentity(req),workerRoute=pathname.startsWith('/api/worker/')||pathname==='/api/state/snapshot'||pathname==='/api/state/restore'||pathname==='/api/session/create';
    if(workerRoute&&ident){
      const signedWorker=deviceWorker(ident.deviceId);if(signedWorker)signedWorker.authMode='signed';
      const headerId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      if(headerId!==ident.deviceId)return json(res,401,{error:'device identity mismatch'});
      if(pathname!=='/api/state/restore'){
        let dw=deviceWorker(ident.deviceId);
        const claimBootstrap=Number.isFinite(ident.bootstrapUntil)&&Date.now()<ident.bootstrapUntil;
        const envBootstrap=BOOTSTRAP_DEVICE_ID===ident.deviceId&&Date.now()<BOOTSTRAP_DEVICE_EXP;
        if((!dw||!dw.approved)&&(claimBootstrap||envBootstrap)){
          state.workers.devices[ident.deviceId]={name:ident.deviceId,version:null,lastSeen:null,capabilities:[],memory:null,approved:true,roles:['DEVELOPER'],allowedCapabilities:[],authMode:'signed',credentialIssuedAt:now()};
          dw=deviceWorker(ident.deviceId);touchState();log('DEVICE_BOOTSTRAP',ident.deviceId+' signed bootstrap approval restored');
        }
        if(!dw||!dw.approved)return json(res,403,{error:'device revoked or not approved'});
      }
    }else if(!authorized(req))return json(res,401,{error:'unauthorized'});
  }

  if(pathname==='/api/push/public-key'&&req.method==='GET'){
    const publicKey=String(process.env.JARVIS_VAPID_PUBLIC_KEY||'').trim();
    return json(res,publicKey?200:503,{ok:!!publicKey,publicKey:publicKey||null});
  }
  if(pathname==='/api/push/subscribe'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const endpoint=String(d.endpoint||''),keys=d.keys||{};
      if(!/^https:\/\//.test(endpoint)||!keys.p256dh||!keys.auth)return json(res,400,{error:'invalid push subscription'});
      const id=crypto.createHash('sha256').update(endpoint).digest('hex').slice(0,24);
      const sub={endpoint,keys:{p256dh:String(keys.p256dh),auth:String(keys.auth)},createdAt:now(),lastSuccessAt:null};
      persistPush(id,sub).then(()=>{
        state.pushSubscriptions[id]=sub;touchState();log('PUSH_SUBSCRIBE','phone push subscription durably registered '+id);
        return json(res,200,{ok:true,id,durable:true});
      }).catch(e=>{log('DB_PUSH_ERROR',String(e.message||e).slice(0,120));return json(res,503,{error:'durable storage unavailable'})});
    });
  }
  if(pathname==='/api/push/background-test'&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!dbReady)return json(res,503,{error:'durable storage unavailable'});
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const seconds=Math.max(30,Math.min(600,Number(d&&d.seconds)||60));
      const r={id:crypto.randomUUID(),title:'Cihan Bey, JARVIS arka plan bildirimi çalışıyor.',when:new Date(Date.now()+seconds*1000).toISOString(),sent:false,createdAt:now(),sentAt:null,delivered:0};
      persistReminder(r).then(()=>{
        state.reminders.push(r);state.reminders=state.reminders.slice(-500);touchState();
        log('BACKGROUND_PUSH_TEST',r.id+' scheduled '+seconds+'s durable');
        return json(res,201,{ok:true,durable:true,id:r.id,when:r.when,seconds});
      }).catch(e=>{log('DB_REMINDER_ERROR',String(e.message||e).slice(0,120));return json(res,503,{error:'durable storage unavailable'})});
    });
  }

  if(pathname==='/api/push/test'&&req.method==='POST'){
    if(!VAPID_PUBLIC||!VAPID_PRIVATE)return json(res,503,{error:'push not configured'});
    const ids=Object.keys(state.pushSubscriptions);
    if(!ids.length)return json(res,409,{error:'no push subscription'});
    const payload=JSON.stringify({title:'JARVIS TEST',body:'Cihan Bey, telefon bildirim bağlantısı çalışıyor.',url:'/',tag:'jarvis-push-test'});
    Promise.allSettled(ids.map(async id=>{
      const sub=state.pushSubscriptions[id];
      try{await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},payload,{TTL:300});sub.lastSuccessAt=now();return true}
      catch(e){if(e&&[404,410].includes(e.statusCode))delete state.pushSubscriptions[id];throw e}
    })).then(results=>{
      const ok=results.filter(x=>x.status==='fulfilled').length;
      log('PUSH_TEST','delivered '+ok+'/'+results.length);
    });
    return json(res,202,{ok:true,queued:ids.length});
  }

  if(pathname==='/api/reminders'&&req.method==='GET'){
    return json(res,200,{reminders:state.reminders.slice().sort((a,b)=>a.when.localeCompare(b.when))});
  }
  if(pathname==='/api/reminders'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const title=String(d.title||'').trim().slice(0,180),when=new Date(d.when);
      if(!title||!Number.isFinite(when.getTime()))return json(res,400,{error:'title and valid when required'});
      const r={id:crypto.randomUUID(),title,when:when.toISOString(),sent:false,createdAt:now()};
      persistReminder(r).then(()=>{
        state.reminders.push(r);state.reminders=state.reminders.slice(-500);touchState();log('REMINDER_CREATE',r.id+' '+r.when+' durable');
        return json(res,201,{ok:true,durable:true,reminder:r});
      }).catch(e=>{log('DB_REMINDER_ERROR',String(e.message||e).slice(0,120));return json(res,503,{error:'durable storage unavailable'})});
    });
  }

  if(pathname==='/api/session/create'&&req.method==='POST'){
    phoneCode=String(crypto.randomInt(0,100000000)).padStart(8,'0');
    phoneCodeExp=Date.now()+5*60*1000;phoneCodeUsed=false;
    log('PHONE_SESSION_CREATE','approved signed device generated one-time phone session code');
    return json(res,200,{code:phoneCode,expiresAt:new Date(phoneCodeExp).toISOString(),expiresInSeconds:300});
  }

  if(pathname==='/api/session/exchange'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const code=String(d.code||'').replace(/\D/g,'');
      if(phoneCodeUsed||Date.now()>phoneCodeExp||code!==phoneCode)return json(res,403,{error:'invalid or expired session code'});
      phoneCodeUsed=true;phoneCode='';
      const exp=setJarvisSessionCookie(req,res);
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({ok:true,expiresAt:new Date(exp).toISOString()}));
    });
  }

  if(pathname==='/api/pairing/create'&&req.method==='POST'){
    const code=crypto.randomBytes(4).toString('hex').toUpperCase(),expiresAt=Date.now()+5*60*1000;
    state.pairingCodes[code]={expiresAt,used:false};
    for(const [k,v] of Object.entries(state.pairingCodes))if(v.used||v.expiresAt<Date.now())delete state.pairingCodes[k];
    log('PAIRING_CREATE','tek kullanımlık cihaz eşleştirme kodu üretildi');
    return json(res,200,{code,expiresAt:new Date(expiresAt).toISOString(),expiresInSeconds:300});
  }
  if(pathname==='/api/pairing/exchange'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const code=String(d.code||'').trim().toUpperCase(),deviceId=String(d.deviceId||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      let p=state.pairingCodes[code];
      if(!p&&BOOTSTRAP_PAIR_HASH&&!bootstrapPairUsed&&Date.now()<BOOTSTRAP_PAIR_EXP){
        const got=crypto.createHash('sha256').update(code).digest('hex');
        const a=Buffer.from(got,'hex'),b=Buffer.from(BOOTSTRAP_PAIR_HASH,'hex');
        if(a.length===b.length&&crypto.timingSafeEqual(a,b))p={expiresAt:BOOTSTRAP_PAIR_EXP,used:false,bootstrap:true};
      }
      if(!p||p.used||p.expiresAt<Date.now())return json(res,403,{error:'invalid or expired pairing code'});
      if(!deviceId)return json(res,400,{error:'deviceId required'});
      p.used=true;if(p.bootstrap)bootstrapPairUsed=true;
      const caps=Array.isArray(d.capabilities)?d.capabilities.map(String).slice(0,50):[];
      state.workers.devices[deviceId]={name:String(d.name||deviceId).slice(0,100),version:d.version?String(d.version):null,lastSeen:now(),capabilities:caps,memory:null,approved:true,roles:['DEVELOPER'],allowedCapabilities:caps,authMode:'signed',credentialIssuedAt:now()};
      touchState();
      const token=signDevicePayload(deviceTokenPayload(deviceId,7*24*60*60*1000,{pairedAt:Date.now(),bootstrapUntil:Date.now()+15*60*1000}));
      log('PAIRING_EXCHANGE',deviceId+' tek kullanımlık kodla eşleştirildi');
      delete state.pairingCodes[code];
      return json(res,200,{ok:true,deviceId,token,expiresInSeconds:604800});
    });
  }

  if(pathname==='/api/state'&&req.method==='GET'){
    return json(res,200,publicState());
  }
  if(pathname==='/api/state/snapshot'&&req.method==='GET'){
    return json(res,200,persistentSnapshot());
  }
  if(pathname==='/api/state/restore'&&req.method==='POST'){
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
  }

  const deviceApprove=pathname.match(/^\/api\/devices\/([A-Za-z0-9_.-]+)\/approve$/);
  if(deviceApprove&&req.method==='POST'){
    const id=deviceApprove[1],w=state.workers.devices[id];
    if(!w)return json(res,404,{error:'device not found'});
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const validRoles=['DEVELOPER','CREATOR','COMMERCE'];
      const roles=Array.isArray(d.roles)?d.roles.filter(x=>validRoles.includes(x)).slice(0,3):['DEVELOPER'];
      const requestedCaps=Array.isArray(d.allowedCapabilities)?d.allowedCapabilities.map(String):[];
      const allowedCapabilities=(requestedCaps.length?requestedCaps:w.capabilities).filter(x=>w.capabilities.includes(x)).slice(0,50);
      w.approved=true;w.roles=roles.length?roles:['DEVELOPER'];w.allowedCapabilities=allowedCapabilities;touchState();
      log('DEVICE_APPROVE',id+' onaylandı · roller '+w.roles.join(','));
      return json(res,200,{ok:true,deviceId:id,name:w.name,approved:true,roles:w.roles,allowedCapabilities:w.allowedCapabilities});
    });
  }
  const deviceScope=pathname.match(/^\/api\/devices\/([A-Za-z0-9_.-]+)\/scope$/);
  if(deviceScope&&req.method==='POST'){
    const id=deviceScope[1],w=state.workers.devices[id];
    if(!w)return json(res,404,{error:'device not found'});
    if(!w.approved)return json(res,409,{error:'device not approved'});
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const validRoles=['DEVELOPER','CREATOR','COMMERCE'];
      if(Array.isArray(d.roles)){const roles=d.roles.filter(x=>validRoles.includes(x)).slice(0,3);if(!roles.length)return json(res,400,{error:'at least one valid role required'});w.roles=roles}
      if(Array.isArray(d.allowedCapabilities)){w.allowedCapabilities=d.allowedCapabilities.map(String).filter(x=>w.capabilities.includes(x)).slice(0,50)}
      touchState();
      log('DEVICE_SCOPE',id+' kapsam güncellendi · '+(w.roles||[]).join(','));
      return json(res,200,{ok:true,deviceId:id,roles:w.roles||[],allowedCapabilities:w.allowedCapabilities||[]});
    });
  }

  const deviceRevoke=pathname.match(/^\/api\/devices\/([A-Za-z0-9_.-]+)\/revoke$/);
  if(deviceRevoke&&req.method==='POST'){
    const id=deviceRevoke[1],w=state.workers.devices[id];
    if(!w)return json(res,404,{error:'device not found'});
    w.approved=false;touchState();
    log('DEVICE_REVOKE',id+' cihazının yetkisi kaldırıldı');
    return json(res,200,{ok:true,deviceId:id,approved:false});
  }

  if(pathname==='/api/account-policies'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const deviceId=String(d.deviceId||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80),w=deviceWorker(deviceId);
      const accountType=normalizeAccountType(d.accountType);
      if(!deviceId||!w||!w.approved)return json(res,400,{error:'approved device required'});
      if(!accountType)return json(res,400,{error:'supported accountType required'});
      const validAgents=['DEVELOPER','CREATOR','COMMERCE'];
      const validActions=['read','write','delete','refund'];
      const agents=(Array.isArray(d.agents)?d.agents:[]).filter(x=>validAgents.includes(x));
      const actions=(Array.isArray(d.actions)?d.actions:[]).filter(x=>validActions.includes(x));
      if(!agents.length||!actions.length)return json(res,400,{error:'agents and actions required'});
      const key=deviceId+'|'+accountType;
      state.accountPolicies[key]={deviceId,accountType,agents:[...new Set(agents)],actions:[...new Set(actions)],updatedAt:now()};touchState();
      log('ACCOUNT_POLICY',deviceId+' '+accountType+' · '+actions.join(','));
      return json(res,200,{ok:true,...state.accountPolicies[key],secretStored:false});
    });
  }
  const accountRevoke=pathname.match(/^\/api\/account-policies\/([A-Za-z0-9_.-]+)\/(github|shopify)$/);
  if(accountRevoke&&req.method==='DELETE'){
    const key=accountRevoke[1]+'|'+accountRevoke[2];
    const existed=!!state.accountPolicies[key];delete state.accountPolicies[key];if(existed)touchState();
    log('ACCOUNT_REVOKE',key+' kaldırıldı');
    return json(res,200,{ok:true,existed});
  }

  if(pathname==='/api/tasks'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const command=String(d.command||'').trim();
      if(!command)return json(res,400,{error:'command required'});
      const t={
        id:state.tasks.length+1,
        source:String(d.source||'phone-web').slice(0,40),
        uid:'J-'+crypto.randomUUID().toUpperCase(),
        command,
        agent:agentFor(command),
        status:'queued',
        attempts:0,
        maxRetries:3,
        message:'',
        createdAt:now(),
        claimedAt:null,
        completedAt:null,
        targetDeviceId:d.targetDeviceId?String(d.targetDeviceId).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80):null
      };
      const plan=deterministicPlan(command);
      if(plan){t.plan=plan;t.agent='DEVELOPER';}
      state.tasks.push(t);touchState();
      log(plan?'PLAN':'QUEUE','#'+t.id+(plan?' güvenli '+plan.steps.length+' adımlı plan oluşturuldu':' kuyruğa alındı'));
      prepareTask(t,false);
      return json(res,201,t);
    });
  }

  const approve=pathname.match(/^\/api\/tasks\/(\d+)\/approve$/);
  if(approve&&req.method==='POST'){
    const t=taskById(approve[1]);
    if(!t)return json(res,404,{error:'task not found'});
    if(t.status!=='waiting_approval')return json(res,409,{error:'task is not waiting approval'});
    log('APPROVE','#'+t.id+' kullanıcı tarafından onaylandı');
    prepareTask(t,true);
    return json(res,200,t);
  }

  const cancel=pathname.match(/^\/api\/tasks\/(\d+)\/cancel$/);
  if(cancel&&req.method==='POST'){
    const t=taskById(cancel[1]);
    if(!t)return json(res,404,{error:'task not found'});
    if(['completed','cancelled'].includes(t.status))return json(res,409,{error:'task already closed'});
    t.status='cancelled';touchState();
    t.message='Kullanıcı tarafından iptal edildi.';
    t.completedAt=now();
    log('CANCEL','#'+t.id+' iptal edildi');
    return json(res,200,t);
  }

  if(pathname==='/api/worker/heartbeat'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const snapshot={
        name:String(d.name||'PC Worker'),
        version:d.version?String(d.version):null,
        lastSeen:now(),
        capabilities:Array.isArray(d.capabilities)?d.capabilities.slice(0,50):[],
        networkTag:ipTag(req),
        memory:d.memory&&typeof d.memory==='object'?{
          records:Number(d.memory.records)||0,
          bytes:Number(d.memory.bytes)||0,
          lastAt:d.memory.lastAt?String(d.memory.lastAt):null
        }:null
      };
      const deviceId=d.deviceId?String(d.deviceId).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80):null;
      if(deviceId){
        const previous=state.workers.devices[deviceId];
        state.workers.devices[deviceId]={...snapshot,approved:previous?!!previous.approved:false,roles:previous&&previous.roles||[],allowedCapabilities:previous&&previous.allowedCapabilities||[],authMode:previous&&previous.authMode||'signed',credentialIssuedAt:previous&&previous.credentialIssuedAt||now()};
      }else state.workers.pc=snapshot;
      return json(res,200,{ok:true,at:snapshot.lastSeen,deviceId,approved:deviceId?!!state.workers.devices[deviceId].approved:true});
    });
  }

  if(pathname==='/api/worker/next'&&req.method==='GET'){
    const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
    if(deviceId){
      const dw=state.workers.devices[deviceId];
      if(!dw)return json(res,403,{error:'device not registered'});
      dw.lastSeen=now();
      if(!dw.approved)return json(res,403,{error:'device awaiting approval',deviceId});
    }else state.workers.pc.lastSeen=now();
    const CLAIM_TTL_MS=90_000;
    for(const stale of state.tasks.filter(x=>x.status==='claimed'&&x.claimedAt)){
      if(Date.now()-new Date(stale.claimedAt).getTime()>CLAIM_TTL_MS){
        if(stale.attempts<stale.maxRetries){
          stale.status='waiting_worker';
          if(!stale.plan){stale.targetDeviceId=null;stale.claimedDeviceId=null}
          stale.message=stale.plan?'PC bağlantısı kesildi; checkpoint sahibi hedef PC bekleniyor.':'PC bağlantısı kesildi; görev uygun başka PC için yeniden kuyruğa alındı.';
          log('RESUME','#'+stale.id+' '+stale.message);
        }else{
          stale.status='failed';
          stale.message='PC bağlantısı sırasında maksimum yeniden deneme sınırına ulaşıldı.';
          stale.completedAt=now();
          log('FAILED','#'+stale.id+' kesinti retry sınırına ulaştı');
        }
      }
    }
    const queued=state.tasks.filter(x=>x.status==='waiting_worker');
    let t=null;
    for(const candidate of queued){
      if(candidate.targetDeviceId&&candidate.targetDeviceId!==deviceId)continue;
      if(!candidate.targetDeviceId&&deviceId){
        const selected=chooseDevice(candidate.command,candidate.agent);
        if(selected&&selected!==deviceId)continue;
        if(selected)candidate.targetDeviceId=selected;
      }
      const support=workerSupports(candidate.command,deviceId||null,candidate.agent);
      const accountCheck=accountPolicyAllows(deviceId||null,candidate.agent,candidate.command);
      if(!accountCheck.ok){candidate.status='waiting_approval';candidate.message='Hesap erişimi bekliyor: '+accountCheck.reason;log('ACCOUNT_GUARD','#'+candidate.id+' '+candidate.message);continue}
      if(support.ok){t=candidate;break}
      if(support.need){
        candidate.status='needs_tool';
        candidate.message='Bağlı PC Worker bu yeteneği desteklemiyor: '+support.need+' · Worker güncellemesi gerekli.';
        log('TOOL_MISSING','#'+candidate.id+' '+candidate.message);
      }else{
        candidate.status='needs_tool';
        candidate.message='Bu görev için güvenli PC aracı henüz tanımlı değil.';
        log('TOOL_MISSING','#'+candidate.id+' '+candidate.message);
      }
    }
    if(!t)return json(res,200,{task:null});
    t.status='claimed';
    t.claimedAt=now();
    t.attempts++;
    t.claimedDeviceId=deviceId||'legacy-pc';
    t.message='PC Worker görevi aldı: '+t.claimedDeviceId;
    log('CLAIM','#'+t.id+' '+t.claimedDeviceId+' aldı (deneme '+t.attempts+')');
    return json(res,200,{task:t});
  }

  if(pathname==='/api/worker/rehydrate'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80),w=deviceWorker(deviceId);
      if(!w||!w.approved)return json(res,403,{error:'approved device required'});
      const uid=String(d.uid||'');
      if(!/^J-[A-F0-9-]{36}$/.test(uid))return json(res,400,{error:'valid task uid required'});
      const existing=taskByUid(uid);if(existing)return json(res,200,{ok:true,existing:true,task:existing});
      const command=String(d.command||'').trim(),plan=deterministicPlan(command);
      if(!command||risky(command)||!plan)return json(res,403,{error:'only low-risk deterministic plans may rehydrate'});
      const suppliedPlan=d.plan;
      if(!suppliedPlan||JSON.stringify(suppliedPlan)!==JSON.stringify(plan))return json(res,409,{error:'deterministic plan mismatch'});
      const t={id:state.tasks.length+1,uid,command,agent:'DEVELOPER',status:'waiting_worker',attempts:0,maxRetries:3,message:'Render restart sonrası güvenli checkpoint görevi geri yüklendi.',createdAt:String(d.createdAt||now()),claimedAt:null,completedAt:null,targetDeviceId:deviceId,plan};
      state.tasks.push(t);touchState();log('REHYDRATE','#'+t.id+' '+uid+' · '+deviceId);
      return json(res,201,{ok:true,existing:false,task:t});
    });
  }

  if(pathname==='/api/worker/device-token'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const deviceId=String(d.deviceId||req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80),w=deviceWorker(deviceId);
      if(!w||!w.approved)return json(res,403,{error:'approved device required'});
      if(!DEVICE_SECRET)return json(res,503,{error:'device identity unavailable'});
      const token=signDevicePayload(deviceTokenPayload(deviceId));
      w.authMode='signed';w.credentialIssuedAt=now();
      log('DEVICE_TOKEN',deviceId+' scoped credential issued');
      return json(res,200,{deviceId,token,expiresInSeconds:604800});
    });
  }

  if(pathname==='/api/worker/result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const t=taskLookup(d.id,d.uid);
      if(!t)return json(res,404,{error:'task not found'});
      if(d.uid&&Number.isFinite(Number(d.id))&&t.id!==Number(d.id))return json(res,409,{error:'task id/uid mismatch'});
      const resultDevice=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'legacy-pc';
      if(t.claimedDeviceId&&t.claimedDeviceId!==resultDevice)return json(res,409,{error:'result device mismatch'});
      if(t.status==='cancelled')return json(res,409,{error:'task cancelled'});
      if(d.ok){
        t.status='completed';
        t.message=String(d.message||'PC Worker görevi tamamladı.');
        t.completedAt=now();
        log('VERIFY','#'+t.id+' PC Worker sonucu doğrulandı');
      }else{
        const retryable=d.retryable===true&&t.attempts<t.maxRetries;
        t.status=retryable?'waiting_worker':'failed';
        t.message=String(d.message||'PC Worker görevi başarısız oldu.');
        if(!retryable)t.completedAt=now();
        log(retryable?'RETRY':'FAILED','#'+t.id+' '+t.message);
      }
      return json(res,200,t);
    });
  }

  if(req.method!=='GET'){
    res.writeHead(405);return res.end('method not allowed');
  }

  let rel=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\/+/, '');
  let file=path.resolve(PUBLIC,rel);
  if(!(file===path.resolve(PUBLIC,'index.html')||file.startsWith(PUBLIC+path.sep))){
    res.writeHead(403);return res.end('blocked');
  }
  fs.readFile(file,(err,data)=>{
    if(err&&!path.extname(rel)){
      file=path.join(PUBLIC,'index.html');
      return fs.readFile(file,(e,d)=>{
        if(e){res.writeHead(404);return res.end('not found')}
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
        res.end(d);
      });
    }
    if(err){res.writeHead(404);return res.end('not found')}
    const ext=path.extname(file);
    const type=ext==='.css'?'text/css; charset=utf-8':ext==='.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
    res.end(data);
  });
});

initDurableMemory().catch(e=>{const code=e&&e.code?String(e.code):'NO_CODE';log('DB_INIT_ERROR',code+' '+String(e&&e.message||e).slice(0,160));});
server.listen(PORT,'0.0.0.0',()=>{
  log('BOOT','JARVIS OS v0.2 started');
  console.log('JARVIS OS listening on '+PORT);
  console.log('[JARVIS] PHONE SESSION: one-time codes available only through approved signed Worker');
});
