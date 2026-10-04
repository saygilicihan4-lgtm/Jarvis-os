const crypto=require('crypto');

const FINAL_TARGET_VERIFICATION_VERSION='1.1';
const DEFAULT_TTL_MS=15000;
const PROVIDERS={
  youtube:{hosts:new Set(['studio.youtube.com'])},
  shopify:{hosts:new Set(['admin.shopify.com'])}
};
function clean(v,max=240){return String(v==null?'':v).trim().slice(0,max)}
function normalize(v){return clean(v).normalize('NFKC').toLocaleLowerCase('en-US')}
function hostOf(raw){try{const u=new URL(clean(raw,2000));return u.protocol==='https:'?u.hostname.toLowerCase():''}catch(_){return''}}
function exactEvidence(haystack,expected){
  const want=normalize(expected);if(!want)return true;
  if(Array.isArray(haystack))return haystack.some(x=>normalize(x)===want);
  return normalize(haystack)===want;
}
function hashJson(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function evidenceHash(value){const v=normalize(value);return v?crypto.createHash('sha256').update(v).digest('hex'):''}
function safeEvidence(snapshot={}){
  const e=snapshot.targetEvidence||{};
  return{
    account:[e.account,e.accountEmail,e.accountId].filter(Boolean).map(x=>clean(x)),
    target:[e.target,e.channel,e.channelId,e.store,e.storeId,e.storeDomain].filter(Boolean).map(x=>clean(x))
  };
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
function evidenceFingerprint(snapshot={}){
  const e=safeEvidence(snapshot);
  return{
    accountHash:e.account[0]?evidenceHash(e.account[0]):'',
    targetHash:e.target[0]?evidenceHash(e.target[0]):'',
    formHash:formFingerprint(snapshot),
    surfaceHash:surfaceFingerprint(snapshot)
  };
}
function verifyFinalTarget(contract={},snapshot={},opts={}){
  const provider=normalize(contract.provider),cfg=PROVIDERS[provider];
  if(!cfg)return fail('provider_unsupported');
  const host=hostOf(snapshot.url);
  if(!cfg.hosts.has(host))return fail('host_mismatch',{provider,host});
  const action=normalize(contract.expectedAction);
  if(!action)return fail('action_missing',{provider,host});
  const ev=safeEvidence(snapshot),formHash=formFingerprint(snapshot),surfaceHash=surfaceFingerprint(snapshot);
  if(contract.expectedAccount&&!exactEvidence(ev.account,contract.expectedAccount))return fail('account_mismatch',{provider,host,action});
  if(contract.expectedAccountHash&&!ev.account.some(x=>evidenceHash(x)===contract.expectedAccountHash))return fail('account_mismatch',{provider,host,action});
  if(contract.expectedTarget&&!exactEvidence(ev.target,contract.expectedTarget))return fail('target_mismatch',{provider,host,action});
  if(contract.expectedTargetHash&&!ev.target.some(x=>evidenceHash(x)===contract.expectedTargetHash))return fail('target_mismatch',{provider,host,action});
  if(contract.expectedFormHash&&formHash!==clean(contract.expectedFormHash,64))return fail('form_mismatch',{provider,host,action});
  if(contract.expectedSurfaceHash&&surfaceHash!==clean(contract.expectedSurfaceHash,64))return fail('surface_mismatch',{provider,host,action});
  const now=Number.isFinite(opts.nowMs)?opts.nowMs:Date.now(),ttl=Math.max(1000,Math.min(Number(opts.ttlMs)||DEFAULT_TTL_MS,30000));
  const binding={
    provider,host,action,
    account:normalize(contract.expectedAccount)||clean(contract.expectedAccountHash,64),
    target:normalize(contract.expectedTarget)||clean(contract.expectedTargetHash,64),
    url:clean(snapshot.url,2000),formHash,surfaceHash
  };
  const digest=hashJson(binding);
  return{ok:true,version:FINAL_TARGET_VERIFICATION_VERSION,provider,host,action,bindingHash:digest,formHash,surfaceHash,verifiedAt:new Date(now).toISOString(),expiresAt:new Date(now+ttl).toISOString(),approvalGranted:false};
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
module.exports={FINAL_TARGET_VERIFICATION_VERSION,DEFAULT_TTL_MS,evidenceFingerprint,canonicalForms,formFingerprint,surfaceFingerprint,verifyFinalTarget,assertReceipt};
