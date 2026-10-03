'use strict';
const crypto=require('crypto');
const {createRelay}=require('./jarvis-mobile-tts-relay');
const VERSION='1.0';
function cookieMap(req){
  const out={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i<1)continue;try{out[decodeURIComponent(part.slice(0,i).trim())]=decodeURIComponent(part.slice(i+1).trim())}catch(_){}}
  return out;
}
function clientIp(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim()}
function sessionSecret({deviceSecret='',stateSecret='',token=''}){return crypto.createHmac('sha256',deviceSecret||stateSecret||token||'jarvis-dev-fallback').update('jarvis:phone-session:v2').digest()}
function ipTag(req,secrets){return crypto.createHmac('sha256',sessionSecret(secrets)).update('ip:'+clientIp(req)).digest('base64url').slice(0,16)}
function signPhoneSession(req,exp,secrets){const body=Buffer.from(JSON.stringify({scope:'admin-ui',exp,ip:ipTag(req,secrets),v:2})).toString('base64url');return body+'.'+crypto.createHmac('sha256',sessionSecret(secrets)).update(body).digest('base64url')}
function validPhoneSession(req,secrets){
  const token=cookieMap(req).jarvis_session;if(!token||!token.includes('.'))return false;
  try{
    const [body,sig]=token.split('.'),expected=crypto.createHmac('sha256',sessionSecret(secrets)).update(body).digest(),got=Buffer.from(sig,'base64url');
    if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return false;
    const p=JSON.parse(Buffer.from(body,'base64url').toString());return p.scope==='admin-ui'&&p.v===2&&Number.isFinite(p.exp)&&p.exp>Date.now();
  }catch(_){return false}
}
function verifyDeviceToken(raw,deviceSecret){
  if(!deviceSecret||!raw||!raw.includes('.'))return null;
  try{
    const [body,sig]=raw.split('.'),expected=crypto.createHmac('sha256',deviceSecret).update(body).digest(),got=Buffer.from(sig,'base64url');
    if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;
    const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(p.v!==1||!p.deviceId||!Number.isFinite(p.exp)||p.exp<Date.now())return null;return p;
  }catch(_){return null}
}
function json(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function readJson(req,max=1_000_000){return new Promise((resolve,reject)=>{let body='';let rejected=false;req.on('data',chunk=>{if(rejected)return;body+=chunk;if(body.length>max){rejected=true;reject(Object.assign(new Error('payload_too_large'),{status:413}));try{req.destroy()}catch(_){}}});req.on('end',()=>{if(rejected)return;try{resolve(JSON.parse(body||'{}'))}catch(_){reject(Object.assign(new Error('bad_json'),{status:400}))}});req.on('error',reject)})}
function createHttp({relay=createRelay(),token=String(process.env.JARVIS_TOKEN||''),deviceSecret=String(process.env.JARVIS_DEVICE_SECRET||''),stateSecret=String(process.env.JARVIS_STATE_SECRET||''),port=Number(process.env.PORT||3000),fetchImpl=fetch,approvalValidator}={}){
  const secrets={deviceSecret,stateSecret,token};
  const phoneAuthorized=req=>validPhoneSession(req,secrets)||(!!token&&((req.headers.authorization||'')==='Bearer '+token||req.headers['x-jarvis-token']===token));
  async function defaultApproval(req,deviceId){
    try{
      const r=await fetchImpl('http://127.0.0.1:'+port+'/api/state/snapshot',{headers:{authorization:String(req.headers.authorization||''),'x-jarvis-device-id':deviceId},signal:AbortSignal.timeout(2500)});
      try{await r.body?.cancel?.()}catch(_){}return r.ok;
    }catch(_){return false}
  }
  const approved=approvalValidator||defaultApproval;
  async function signedWorker(req){
    const auth=String(req.headers.authorization||''),ident=auth.startsWith('Device ')?verifyDeviceToken(auth.slice(7),deviceSecret):verifyDeviceToken(String(req.headers['x-jarvis-device-token']||''),deviceSecret);
    if(!ident)return{ok:false,code:401,error:'signed device credential required'};
    const headerId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
    if(!headerId||headerId!==ident.deviceId)return{ok:false,code:401,error:'device identity mismatch'};
    if(!await approved(req,headerId))return{ok:false,code:403,error:'device revoked or not approved'};
    return{ok:true,deviceId:headerId};
  }
  function handles(pathname){return pathname==='/api/mobile-tts-v2'||pathname==='/api/mobile-tts-v2/status'||/^\/api\/mobile-tts-v2\/[0-9a-f-]+$/i.test(pathname)||pathname==='/api/worker/mobile-tts-v2-next'||pathname==='/api/worker/mobile-tts-v2-result'}
  async function handle(req,res){
    const pathname=new URL(req.url,'http://jarvis.local').pathname;
    if(!handles(pathname))return false;
    if(pathname.startsWith('/api/worker/')){
      const auth=await signedWorker(req);if(!auth.ok){json(res,auth.code,{error:auth.error});return true}
      if(pathname==='/api/worker/mobile-tts-v2-next'&&req.method==='GET'){json(res,200,relay.claim(auth.deviceId));return true}
      if(pathname==='/api/worker/mobile-tts-v2-result'&&req.method==='POST'){
        try{
          const body=await readJson(req),result=relay.complete(auth.deviceId,body);
          if(!result.ok){const code=result.reason==='request_not_found'?404:result.reason==='audio_too_large'?413:409;json(res,code,{error:result.reason,status:result.status||null});return true}
          json(res,200,{ok:true,status:result.request.status,locale:result.request.locale,deviceE2eVerified:false});return true;
        }catch(e){json(res,e.status||400,{error:e.message||'bad request'});return true}
      }
      json(res,405,{error:'method not allowed'});return true;
    }
    if(!phoneAuthorized(req)){json(res,401,{error:'trusted session required'});return true}
    if(pathname==='/api/mobile-tts-v2/status'&&req.method==='GET'){json(res,200,relay.status());return true}
    if(pathname==='/api/mobile-tts-v2'&&req.method==='POST'){
      try{const body=await readJson(req),result=relay.create(body);if(!result.ok){json(res,400,{error:result.reason});return true}json(res,202,{ok:true,id:result.request.id,status:result.request.status,locale:result.request.locale,deviceE2eVerified:false});return true}
      catch(e){json(res,e.status||400,{error:e.message||'bad request'});return true}
    }
    const match=pathname.match(/^\/api\/mobile-tts-v2\/([0-9a-f-]+)$/i);
    if(match&&req.method==='GET'){const row=relay.get(match[1]);if(!row){json(res,404,{error:'tts request not found'});return true}json(res,200,{ok:row.status!=='failed'&&row.status!=='cancelled',...row,mime:row.status==='ready'?'audio/mpeg':undefined,deviceE2eVerified:false});return true}
    if(match&&req.method==='DELETE'){const result=relay.cancel(match[1]);if(!result.ok){json(res,result.reason==='request_not_found'?404:409,{error:result.reason});return true}json(res,200,{ok:true,status:'cancelled',deviceE2eVerified:false});return true}
    json(res,405,{error:'method not allowed'});return true;
  }
  function wrap(downstream){return function(req,res){const pathname=new URL(req.url,'http://jarvis.local').pathname;if(!handles(pathname))return downstream(req,res);Promise.resolve(handle(req,res)).catch(()=>{if(!res.headersSent)json(res,500,{error:'mobile_tts_v2_internal_error'});else try{res.end()}catch(_){}})}}
  return{relay,handle,wrap,phoneAuthorized,signedWorker};
}
module.exports={VERSION,cookieMap,clientIp,signPhoneSession,validPhoneSession,verifyDeviceToken,createHttp};
