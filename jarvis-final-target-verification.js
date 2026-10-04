const crypto=require('crypto');

const FINAL_TARGET_VERIFICATION_VERSION='1.3';
const DEFAULT_TTL_MS=15000;
const PROVIDERS={
  youtube:{hosts:new Set(['studio.youtube.com'])},
  shopify:{hosts:new Set(['admin.shopify.com'])}
};
function clean(v,max=240){return String(v==null?'':v).trim().slice(0,max)}
function normalize(v){return clean(v).normalize('NFKC').toLocaleLowerCase('en-US')}
function resourceId(v){return clean(v,160).normalize('NFKC')}
function hostOf(raw){try{const u=new URL(clean(raw,2000));return u.protocol==='https:'?u.hostname.toLowerCase():''}catch(_){return''}}
function exactEvidence(haystack,expected){
  const want=normalize(expected);if(!want)return true;
  if(Array.isArray(haystack))return haystack.some(x=>normalize(x)===want);
  return normalize(haystack)===want;
}
function hashJson(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function evidenceHash(value){const v=normalize(value);return v?crypto.createHash('sha256').update(v).digest('hex'):''}
function exactHash(value){const v=clean(value,320).normalize('NFKC');return v?crypto.createHash('sha256').update(v).digest('hex'):''}
function safeEvidence(snapshot={}){
  const e=snapshot.targetEvidence||{};
  return{
    account:[e.account,e.accountEmail,e.accountId].filter(Boolean).map(x=>clean(x)),
    target:[e.target,e.channel,e.channelId,e.store,e.storeId,e.storeDomain].filter(Boolean).map(x=>clean(x))
  };
}
function safePathPart(v,max=160){
  try{return decodeURIComponent(String(v||'')).replace(/[\r\n\t]/g,'').trim().slice(0,max)}catch(_){return''}
}
function resourceEvidence(provider,rawUrl){
  const p=normalize(provider);let u;
  try{u=new URL(clean(rawUrl,2000))}catch(_){return{kind:'',id:''}}
  if(u.protocol!=='https:')return{kind:'',id:''};
  const parts=u.pathname.split('/').filter(Boolean).map(x=>safePathPart(x));
  if(p==='youtube'&&u.hostname.toLowerCase()==='studio.youtube.com'){
    const vi=parts.indexOf('video');if(vi>=0&&parts[vi+1])return{kind:'video',id:resourceId(parts[vi+1])};
    const ci=parts.indexOf('channel');if(ci>=0&&parts[ci+1])return{kind:'channel',id:resourceId(parts[ci+1])};
  }
  if(p==='shopify'&&u.hostname.toLowerCase()==='admin.shopify.com'){
    const storeIndex=parts.indexOf('store'),storeId=storeIndex>=0?parts[storeIndex+1]:'';
    const kinds=new Set(['products','orders','customers','collections','discounts']);
    for(let i=Math.max(0,storeIndex+2);i<parts.length-1;i++){
      if(kinds.has(parts[i]))return{kind:parts[i].replace(/s$/,''),id:resourceId(parts[i+1]),store:resourceId(storeId)};
    }
    if(storeId)return{kind:'store',id:resourceId(storeId),store:resourceId(storeId)};
  }
  return{kind:'',id:''};
}
function resourceFingerprint(provider,snapshot={}){
  const r=resourceEvidence(provider,snapshot.url);return r.kind&&r.id?exactHash(normalize(r.kind)+':'+resourceId(r.id)):'';
}
function tabFingerprint(snapshot={}){
  const e=snapshot.tabEvidence||{};
  const targetId=clean(e.targetId||e.id,320).normalize('NFKC');
  return targetId?exactHash(targetId):'';
}
function canonicalControl(control={}){
  return{
    tag:normalize(control.tag),type:normalize(control.type),name:normalize(control.name),id:normalize(control.id),
    autocomplete:normalize(control.autocomplete),placeholder:normalize(control.placeholder),aria:normalize(control.aria),text:normalize(control.text)
  };
}
function canonicalForms(snapshot={}){
  const forms=Array.isArray(snapshot.forms)?snapshot.forms:[];
  return forms.slice(0,12).map(form=>({
    action:clean(form&&form.action,2000),
    controls:(Array.isArray(form&&form.controls)?form.controls:[]).slice(0,60).map(canonicalControl)
  }));
}
function formFingerprint(snapshot={}){
  const forms=canonicalForms(snapshot);return forms.length?hashJson(forms):'';
}
function surfaceFingerprint(snapshot={}){
  const e=snapshot.surfaceEvidence||{};
  const stable={sameOriginFrames:Number(e.sameOriginFrames)||0,openShadowRoots:Number(e.openShadowRoots)||0,crossOriginFrames:Boolean(e.crossOriginFrames)};
  return hashJson(stable);
}
function evidenceFingerprint(snapshot={},provider=''){
  const e=safeEvidence(snapshot);
  return{
    accountHash:e.account[0]?evidenceHash(e.account[0]):'',
    targetHash:e.target[0]?evidenceHash(e.target[0]):'',
    resourceHash:resourceFingerprint(provider,snapshot),
    tabHash:tabFingerprint(snapshot),
    formHash:formFingerprint(snapshot),
    surfaceHash:surfaceFingerprint(snapshot)
  };
}
function expectedResourceMatches(contractResource,resource){
  const want=clean(contractResource,320).normalize('NFKC');if(!want)return true;
  const id=resourceId(resource.id),kind=normalize(resource.kind),colon=want.indexOf(':');
  if(colon>=0)return normalize(want.slice(0,colon))===kind&&resourceId(want.slice(colon+1))===id;
  return resourceId(want)===id;
}
function verifyFinalTarget(contract={},snapshot={},opts={}){
  const provider=normalize(contract.provider),cfg=PROVIDERS[provider];
  if(!cfg)return fail('provider_unsupported');
  const host=hostOf(snapshot.url);
  if(!cfg.hosts.has(host))return fail('host_mismatch',{provider,host});
  const action=normalize(contract.expectedAction);
  if(!action)return fail('action_missing',{provider,host});
  const ev=safeEvidence(snapshot),resource=resourceEvidence(provider,snapshot.url),resourceHash=resourceFingerprint(provider,snapshot),tabHash=tabFingerprint(snapshot),formHash=formFingerprint(snapshot),surfaceHash=surfaceFingerprint(snapshot);
  if(contract.expectedAccount&&!exactEvidence(ev.account,contract.expectedAccount))return fail('account_mismatch',{provider,host,action});
  if(contract.expectedAccountHash&&!ev.account.some(x=>evidenceHash(x)===normalize(contract.expectedAccountHash)))return fail('account_mismatch',{provider,host,action});
  if(contract.expectedTarget&&!exactEvidence(ev.target,contract.expectedTarget))return fail('target_mismatch',{provider,host,action});
  if(contract.expectedTargetHash&&!ev.target.some(x=>evidenceHash(x)===normalize(contract.expectedTargetHash)))return fail('target_mismatch',{provider,host,action});
  if(contract.expectedResource&&!expectedResourceMatches(contract.expectedResource,resource))return fail('resource_mismatch',{provider,host,action,resourceKind:resource.kind||''});
  if(contract.expectedResourceHash&&resourceHash!==normalize(contract.expectedResourceHash))return fail('resource_mismatch',{provider,host,action,resourceKind:resource.kind||''});
  if(contract.expectedResourceKind&&normalize(contract.expectedResourceKind)!==normalize(resource.kind))return fail('resource_kind_mismatch',{provider,host,action});
  if(contract.expectedTabHash&&tabHash!==normalize(contract.expectedTabHash))return fail('tab_mismatch',{provider,host,action});
  if(contract.expectedFormHash&&formHash!==normalize(contract.expectedFormHash))return fail('form_mismatch',{provider,host,action});
  if(contract.expectedSurfaceHash&&surfaceHash!==normalize(contract.expectedSurfaceHash))return fail('surface_mismatch',{provider,host,action});
  const now=Number.isFinite(opts.nowMs)?opts.nowMs:Date.now(),ttl=Math.max(1000,Math.min(Number(opts.ttlMs)||DEFAULT_TTL_MS,30000));
  const binding={
    provider,host,action,
    account:normalize(contract.expectedAccount)||normalize(contract.expectedAccountHash),
    target:normalize(contract.expectedTarget)||normalize(contract.expectedTargetHash),
    resourceHash,tabHash,url:clean(snapshot.url,2000),formHash,surfaceHash
  };
  const digest=hashJson(binding);
  return{ok:true,version:FINAL_TARGET_VERIFICATION_VERSION,provider,host,action,bindingHash:digest,resourceHash,resourceKind:resource.kind||'',tabHash,formHash,surfaceHash,verifiedAt:new Date(now).toISOString(),expiresAt:new Date(now+ttl).toISOString(),approvalGranted:false};
}
function fail(reason,extra={}){return{ok:false,version:FINAL_TARGET_VERIFICATION_VERSION,reason,...extra,approvalGranted:false}}
function assertReceipt(receipt,contract={},snapshot={},opts={}){
  const now=Number.isFinite(opts.nowMs)?opts.nowMs:Date.now();
  if(!receipt||receipt.ok!==true)throw codeError('FINAL_TARGET_UNVERIFIED');
  if(!Date.parse(receipt.expiresAt)||Date.parse(receipt.expiresAt)<now)throw codeError('FINAL_TARGET_STALE');
  const fresh=verifyFinalTarget(contract,snapshot,{nowMs:now,ttlMs:1000});
  if(!fresh.ok||fresh.bindingHash!==receipt.bindingHash)throw codeError('FINAL_TARGET_CHANGED');
  return true;
}
function codeError(code){const e=new Error(code);e.code=code;return e}
module.exports={FINAL_TARGET_VERIFICATION_VERSION,DEFAULT_TTL_MS,evidenceFingerprint,resourceEvidence,resourceFingerprint,tabFingerprint,canonicalForms,formFingerprint,surfaceFingerprint,verifyFinalTarget,assertReceipt};
