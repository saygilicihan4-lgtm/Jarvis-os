const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const TOKEN=process.env.JARVIS_TOKEN||'';
const DEVICE_SECRET=process.env.JARVIS_DEVICE_SECRET||'';
const STATE_SECRET=process.env.JARVIS_STATE_SECRET||'';
const BOOTSTRAP_PAIR_HASH=process.env.JARVIS_BOOTSTRAP_PAIR_HASH||'';
const BOOTSTRAP_PAIR_EXP=Number(process.env.JARVIS_BOOTSTRAP_PAIR_EXP||0);
let bootstrapPairUsed=false;
const BOOTSTRAP_DEVICE_ID=process.env.JARVIS_BOOTSTRAP_DEVICE_ID||'';
const BOOTSTRAP_DEVICE_EXP=Number(process.env.JARVIS_BOOTSTRAP_DEVICE_EXP||0);
// DEVICE_AUTH_CHAIN_V2_2
const state={
  tasks:[],
  audit:[],
  accountPolicies:{},
  pairingCodes:{},
  stateRevision:0,
  workers:{pc:{name:null,version:null,lastSeen:null,capabilities:[],memory:null},devices:{}}
};

function now(){return new Date().toISOString()}
function touchState(){state.stateRevision++;}
function log(type,message){
  state.audit.push({at:now(),type,message});
  if(state.audit.length>300)state.audit.shift();
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
  return h===('Bearer '+TOKEN)||req.headers['x-jarvis-token']===TOKEN;
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
function pcOnline(){return workerOnline(state.workers.pc)}
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
  return{
    accountPolicies:Object.values(state.accountPolicies).map(p=>({...p,secretStored:false})),
    tasks:state.tasks,
    audit:state.audit,
    workers:{
      pc:{
        name:state.workers.pc.name,
        version:state.workers.pc.version,
        lastSeen:state.workers.pc.lastSeen,
        capabilities:state.workers.pc.capabilities,
        memory:state.workers.pc.memory,
        online:pcOnline()
      },
      devices:publicDevices()
    }
  };
}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const pathname=u.pathname;

  if(pathname==='/api/health'){
    const devices=Object.values(state.workers.devices),approved=devices.filter(w=>w.approved),online=approved.filter(workerOnline),signed=approved.filter(w=>w.authMode==='signed');
    const latest=online.slice().sort((a,b)=>String(b.lastSeen||'').localeCompare(String(a.lastSeen||'')))[0]||null;
    return json(res,200,{ok:true,name:'JARVIS OS',version:'0.2.0',zeroCostFirst:true,auth:!!TOKEN,pcWorker:pcOnline(),devices:{approved:approved.length,online:online.length,signed:signed.length,latestVersion:latest&&latest.version||null,latestSeen:latest&&latest.lastSeen||null}});
  }

  if(pathname.startsWith('/api/')&&pathname!=='/api/pairing/exchange'){
    const ident=workerIdentity(req),workerRoute=pathname.startsWith('/api/worker/')||pathname==='/api/state/snapshot'||pathname==='/api/state/restore';
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
        memory:d.memory&&typeof d.memory==='object'?{
          records:Number(d.memory.records)||0,
          bytes:Number(d.memory.bytes)||0,
          lastAt:d.memory.lastAt?String(d.memory.lastAt):null
        }:null
      };
      const deviceId=d.deviceId?String(d.deviceId).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80):null;
      if(deviceId){
        const previous=state.workers.devices[deviceId];
        state.workers.devices[deviceId]={...snapshot,approved:previous?!!previous.approved:false,roles:previous&&previous.roles||[],allowedCapabilities:previous&&previous.allowedCapabilities||[]};
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

server.listen(PORT,'0.0.0.0',()=>{
  log('BOOT','JARVIS OS v0.2 started');
  console.log('JARVIS OS listening on '+PORT);
});
