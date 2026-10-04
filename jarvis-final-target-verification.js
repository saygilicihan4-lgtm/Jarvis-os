const crypto=require('crypto');

const FINAL_TARGET_VERIFICATION_VERSION='1.0';
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
function safeEvidence(snapshot={}){
  const e=snapshot.targetEvidence||{};
  return{
    account:[e.account,e.accountEmail,e.accountId].filter(Boolean).map(x=>clean(x)),
    target:[e.target,e.channel,e.channelId,e.store,e.storeId,e.storeDomain].filter(Boolean).map(x=>clean(x))
  };
}
function verifyFinalTarget(contract={},snapshot={},opts={}){
  const provider=normalize(contract.provider),cfg=PROVIDERS[provider];
  if(!cfg)return fail('provider_unsupported');
  const host=hostOf(snapshot.url);
  if(!cfg.hosts.has(host))return fail('host_mismatch',{provider,host});
  const action=normalize(contract.expectedAction);
  if(!action)return fail('action_missing',{provider,host});
  const ev=safeEvidence(snapshot);
  if(contract.expectedAccount&&!exactEvidence(ev.account,contract.expectedAccount))return fail('account_mismatch',{provider,host,action});
  if(contract.expectedTarget&&!exactEvidence(ev.target,contract.expectedTarget))return fail('target_mismatch',{provider,host,action});
  const now=Number.isFinite(opts.nowMs)?opts.nowMs:Date.now(),ttl=Math.max(1000,Math.min(Number(opts.ttlMs)||DEFAULT_TTL_MS,30000));
  const binding={provider,host,action,account:normalize(contract.expectedAccount),target:normalize(contract.expectedTarget),url:clean(snapshot.url,2000)};
  const digest=crypto.createHash('sha256').update(JSON.stringify(binding)).digest('hex');
  return{ok:true,version:FINAL_TARGET_VERIFICATION_VERSION,provider,host,action,bindingHash:digest,verifiedAt:new Date(now).toISOString(),expiresAt:new Date(now+ttl).toISOString(),approvalGranted:false};
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
module.exports={FINAL_TARGET_VERIFICATION_VERSION,DEFAULT_TTL_MS,verifyFinalTarget,assertReceipt};
