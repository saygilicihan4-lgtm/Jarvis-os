'use strict';
const fs=require('fs');
function replaceOnce(file,oldText,newText,label){
  let s=fs.readFileSync(file,'utf8');const i=s.indexOf(oldText);
  if(i<0)throw new Error(label+': anchor not found');
  if(s.indexOf(oldText,i+oldText.length)>=0)throw new Error(label+': anchor not unique');
  s=s.slice(0,i)+newText+s.slice(i+oldText.length);fs.writeFileSync(file,s);
}
replaceOnce('server.js',
"const {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}=require('@simplewebauthn/server');",
"const {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}=require('@simplewebauthn/server');\nconst {createSessionLifecycle,createPgSessionStore}=require('./jarvis-session-lifecycle');",
'module import');
replaceOnce('server.js',
"const PHONE_SESSION_SECRET=crypto.createHmac('sha256',DEVICE_SECRET||STATE_SECRET||TOKEN||'jarvis-dev-fallback').update('jarvis:phone-session:v2').digest();",
"const PHONE_SESSION_SECRET=crypto.createHmac('sha256',DEVICE_SECRET||STATE_SECRET||TOKEN||'jarvis-dev-fallback').update('jarvis:phone-session:v2').digest();\nconst sessionLifecycle=createSessionLifecycle({secret:PHONE_SESSION_SECRET,store:db?createPgSessionStore(db):null});",
'lifecycle init');
replaceOnce('server.js',
" const rs=await db.query('SELECT * FROM jarvis_reminders ORDER BY remind_at');state.reminders=rs.rows.map(x=>({id:x.id,title:x.title,when:new Date(x.remind_at).toISOString(),sent:x.sent,createdAt:x.created_at,sentAt:x.sent_at,delivered:x.delivered}));\n dbReady=true;log('DB_READY','durable reminders='+state.reminders.length+' push='+Object.keys(state.pushSubscriptions).length);",
" const rs=await db.query('SELECT * FROM jarvis_reminders ORDER BY remind_at');state.reminders=rs.rows.map(x=>({id:x.id,title:x.title,when:new Date(x.remind_at).toISOString(),sent:x.sent,createdAt:x.created_at,sentAt:x.sent_at,delivered:x.delivered}));\n const sessionStoreStatus=await sessionLifecycle.init();\n dbReady=true;log('DB_READY','durable reminders='+state.reminders.length+' push='+Object.keys(state.pushSubscriptions).length);\n log('SESSION_STORE','durable='+sessionStoreStatus.durable+' legacyAllowed='+sessionStoreStatus.legacyAllowed+' sessions='+sessionStoreStatus.managedSessions);",
'durable init');
const oldCookie=`function setJarvisSessionCookie(req,res){
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
}`;
const newCookie=`function clientIp(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}
function ipTag(req){return crypto.createHmac('sha256',PHONE_SESSION_SECRET).update('ip:'+clientIp(req)).digest('base64url').slice(0,16)}
function signPhoneSessionPayload(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+crypto.createHmac('sha256',PHONE_SESSION_SECRET).update(body).digest('base64url')}
// Legacy v2 signer is intentionally retained for migration/selftests. New
// issuance below always uses managed v3 sessions with a revocable SID.
function signPhoneSession(req,exp){return signPhoneSessionPayload({scope:'admin-ui',exp,ip:ipTag(req),v:2})}
async function setJarvisSessionCookie(req,res,source){
  const issued=await sessionLifecycle.issue({source,ipTag:ipTag(req)});
  const token=signPhoneSessionPayload({scope:'admin-ui',sid:issued.sid,iat:issued.issuedAtMs,exp:issued.expiresAtMs,ip:ipTag(req),v:3});
  res.setHeader('set-cookie','jarvis_session='+encodeURIComponent(token)+'; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax');
  return issued;
}
function clearJarvisSessionCookie(res){res.setHeader('set-cookie','jarvis_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax')}
function validPhoneSession(req){
 const t=cookieMap(req).jarvis_session;if(!t||!t.includes('.'))return false;
 try{
  const [body,sig]=t.split('.'),expected=crypto.createHmac('sha256',PHONE_SESSION_SECRET).update(body).digest(),got=Buffer.from(sig,'base64url');
  if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return false;
  const p=JSON.parse(Buffer.from(body,'base64url').toString());
  if(p.scope!=='admin-ui'||!Number.isFinite(p.exp)||p.exp<=Date.now())return false;
  if(p.v===2){
    if(!sessionLifecycle.acceptsLegacy())return false;
    req.jarvisSession={version:2,legacy:true,idHash:null,source:'legacy-v2',expiresAt:new Date(p.exp).toISOString()};
  }else if(p.v===3){
    const managed=sessionLifecycle.validate({sid:p.sid,iat:p.iat,exp:p.exp});if(!managed)return false;
    req.jarvisSession={version:3,legacy:false,idHash:managed.idHash,source:managed.source,issuedAt:managed.issuedAt,expiresAt:managed.expiresAt,durable:managed.durable};
  }else return false;
  req.jarvisSessionRisk={ipChanged:!!p.ip&&p.ip!==ipTag(req)};
  return true;
 }catch{return false}
}`;
replaceOnce('server.js',oldCookie,newCookie,'cookie lifecycle');
replaceOnce('server.js',
"        const exp=setJarvisSessionCookie(req,res);\n        return json(res,200,{ok:true,verified:true,session:true,expiresAt:new Date(exp).toISOString()});",
"        let issued;\n        try{issued=await setJarvisSessionCookie(req,res,'passkey')}catch(e){if(e&&e.code==='SESSION_STORE_UNAVAILABLE')return json(res,503,{error:'durable session storage unavailable'});throw e}\n        return json(res,200,{ok:true,verified:true,session:true,durable:issued.durable,expiresAt:new Date(issued.expiresAtMs).toISOString()});",
'passkey managed session');
const oldExchange=`  if(pathname==='/api/session/exchange'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const code=String(d.code||'').replace(/\D/g,'');
      const issuer=phoneCodeIssuer&&deviceWorker(phoneCodeIssuer.deviceId);
      if(phoneCodeUsed||Date.now()>=phoneCodeExp||!issuer||issuer.approved!==true||(issuer.credentialIssuedAt||null)!==phoneCodeIssuer.credentialIssuedAt){
        clearPhoneCode();return json(res,403,{error:'invalid or expired session code'});
      }
      if(!/^\d{8}$/.test(code)||code!==phoneCode)return json(res,403,{error:'invalid or expired session code'});
      clearPhoneCode();
      const exp=setJarvisSessionCookie(req,res);
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({ok:true,expiresAt:new Date(exp).toISOString()}));
    });
  }`;
const newExchange=`  if(pathname==='/api/session/exchange'&&req.method==='POST'){
    return readJson(req,async(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const code=String(d.code||'').replace(/\D/g,'');
      const issuer=phoneCodeIssuer&&deviceWorker(phoneCodeIssuer.deviceId);
      if(phoneCodeUsed||Date.now()>=phoneCodeExp||!issuer||issuer.approved!==true||(issuer.credentialIssuedAt||null)!==phoneCodeIssuer.credentialIssuedAt){
        clearPhoneCode();return json(res,403,{error:'invalid or expired session code'});
      }
      if(!/^\d{8}$/.test(code)||code!==phoneCode)return json(res,403,{error:'invalid or expired session code'});
      // Consume before async persistence so concurrent replay cannot mint two sessions.
      phoneCodeUsed=true;
      try{
        const issued=await setJarvisSessionCookie(req,res,'one-time-code');clearPhoneCode();
        res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
        return res.end(JSON.stringify({ok:true,durable:issued.durable,expiresAt:new Date(issued.expiresAtMs).toISOString()}));
      }catch(e){clearPhoneCode();return json(res,e&&e.code==='SESSION_STORE_UNAVAILABLE'?503:500,{error:e&&e.code==='SESSION_STORE_UNAVAILABLE'?'durable session storage unavailable':'session issuance failed'})}
    });
  }`;
replaceOnce('server.js',oldExchange,newExchange,'code managed session');
const routeAnchor=`  if(pathname==='/api/db/status'&&req.method==='GET'){
    return json(res,200,{configured:!!db,ready:dbReady,persistent:dbReady,reminders:state.reminders.length,pushSubscriptions:Object.keys(state.pushSubscriptions).length,reminderStorage:dbReady?'postgres':'unavailable'});
  }`;
const sessionRoutes=`  if(pathname==='/api/sessions'&&req.method==='GET'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    const current=req.jarvisSession||{},store=sessionLifecycle.status();
    return json(res,200,{ok:true,durable:store.durable,storeReady:store.ready,legacy:{allowed:store.legacyAllowed,individualRevocationPossible:false,disableRequiresManagedSession:true},current:{managed:current.version===3,legacy:current.version===2,id:current.idHash||null,source:current.source||null,expiresAt:current.expiresAt||null,ipChanged:!!(req.jarvisSessionRisk&&req.jarvisSessionRisk.ipChanged)},sessions:sessionLifecycle.list(current.idHash||null)});
  }
  if(pathname==='/api/sessions/revoke-others'&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!req.jarvisSession||req.jarvisSession.version!==3)return json(res,409,{error:'managed v3 session required; recover with one-time code or passkey first'});
    sessionLifecycle.revokeOthers(req.jarvisSession.idHash).then(r=>{log('SESSION_REVOKE_OTHERS','count='+r.count);return json(res,200,{ok:true,...r})}).catch(e=>json(res,e&&e.code==='SESSION_STORE_UNAVAILABLE'?503:400,{error:String(e.message||e)}));return;
  }
  const sessionRevoke=pathname.match(/^\/api\/sessions\/([a-f0-9]{64})\/revoke$/);
  if(sessionRevoke&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!req.jarvisSession||req.jarvisSession.version!==3)return json(res,409,{error:'managed v3 session required; recover with one-time code or passkey first'});
    return readJson(req,async(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const id=sessionRevoke[1],isCurrent=id===req.jarvisSession.idHash;
      if(isCurrent&&d.confirmCurrent!==true)return json(res,409,{error:'confirmCurrent=true required to revoke this session'});
      try{const r=await sessionLifecycle.revoke(id);if(!r.found)return json(res,404,{error:'session not found'});if(isCurrent)clearJarvisSessionCookie(res);log('SESSION_REVOKE',(isCurrent?'current ':'')+id.slice(0,12));return json(res,200,{ok:true,current:isCurrent,...r})}
      catch(e){return json(res,e&&e.code==='SESSION_STORE_UNAVAILABLE'?503:400,{error:String(e.message||e)})}
    });
  }
  const legacyPolicy=pathname.match(/^\/api\/sessions\/legacy\/(disable|enable)$/);
  if(legacyPolicy&&req.method==='POST'){
    if(!validPhoneSession(req))return json(res,401,{error:'trusted session required'});
    if(!req.jarvisSession||req.jarvisSession.version!==3)return json(res,409,{error:'managed v3 session required; recover with one-time code or passkey first'});
    return readJson(req,async(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});if(d.confirm!==true)return json(res,409,{error:'confirm=true required'});
      const allowed=legacyPolicy[1]==='enable';
      try{const r=await sessionLifecycle.setLegacyAllowed(allowed);log('SESSION_LEGACY_POLICY',allowed?'enabled':'disabled');return json(res,200,{ok:true,...r})}
      catch(e){return json(res,e&&e.code==='SESSION_STORE_UNAVAILABLE'?503:400,{error:String(e.message||e)})}
    });
  }

${routeAnchor}`;
replaceOnce('server.js',routeAnchor,sessionRoutes,'session routes');
replaceOnce('jarvis-session-lifecycle.js',
"      await db.query(\"UPDATE jarvis_admin_session_policy SET legacy_allowed=$2,updated_at=now() WHERE id='admin'\",['admin',!!allowed]);",
"      await db.query(\"UPDATE jarvis_admin_session_policy SET legacy_allowed=$1,updated_at=now() WHERE id='admin'\",[!!allowed]);",
'policy parameter');
console.log('v163 integration patch applied');
