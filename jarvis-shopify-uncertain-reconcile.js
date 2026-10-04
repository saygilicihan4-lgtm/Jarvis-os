'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const SHOPIFY_UNCERTAIN_RECONCILE_VERSION='1.0';
const SHOPIFY_PUBLIC_ACTION='PUBLISH_PRODUCT';
const RECEIPT_STATE='shopify_publish_uncertain';

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function clone(x){return JSON.parse(JSON.stringify(x))}
function privacyHash(value){
  const s=String(value==null?'':value).trim().normalize('NFKC').toLowerCase();
  return s?crypto.createHash('sha256').update(s,'utf8').digest('hex'):'';
}
function normalizeShopDomain(value){
  let s=String(value||'').trim().toLowerCase();
  s=s.replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  if(!s)return'';
  if(!s.includes('.'))s+='.myshopify.com';
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s))throw coded('SHOPIFY_RECONCILE_STORE_INVALID');
  return s;
}
function validProductGid(id){return /^gid:\/\/shopify\/Product\/\d+$/.test(String(id||'').trim())}
function validPublicationGid(id){return /^gid:\/\/shopify\/Publication\/\d+$/.test(String(id||'').trim())}
function validMissionId(id){return /^M-[A-Z0-9-]{12,80}$/.test(String(id||'').trim())}
function validSha(value){return /^[a-f0-9]{64}$/.test(String(value||'').trim())}
function coded(code,message=code){const e=new Error(message);e.code=code;return e}
function receiptDir(workspace){return ensureDir(path.join(path.resolve(workspace),'commerce-receipts'))}
function receiptFile(workspace,missionId){
  const id=String(missionId||'').trim();
  if(!validMissionId(id))throw coded('SHOPIFY_RECONCILE_MISSION_INVALID');
  return path.join(receiptDir(workspace),'shopify-uncertain-'+id+'.json');
}
function atomicWrite(file,obj){
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(obj,null,2),'utf8');
  fs.renameSync(tmp,file);
}
function safeEvidence(input={}){
  const missionId=String(input.missionId||'').trim();
  const productId=String(input.productId||'').trim();
  const publicationId=String(input.publicationId||'').trim();
  const storeHash=String(input.storeHash||'').trim();
  const bindingHash=String(input.bindingHash||'').trim();
  const approvalPayloadSha256=String(input.approvalPayloadSha256||'').trim();
  const action=String(input.action||SHOPIFY_PUBLIC_ACTION).trim();
  const stage=String(input.stage||'unknown').trim().slice(0,96);
  if(!validMissionId(missionId))throw coded('SHOPIFY_RECONCILE_MISSION_INVALID');
  if(!validProductGid(productId))throw coded('SHOPIFY_RECONCILE_PRODUCT_INVALID');
  if(!validPublicationGid(publicationId))throw coded('SHOPIFY_RECONCILE_PUBLICATION_INVALID');
  if(!validSha(storeHash))throw coded('SHOPIFY_RECONCILE_STORE_PROOF_INVALID');
  if(!validSha(bindingHash))throw coded('SHOPIFY_RECONCILE_BINDING_INVALID');
  if(!validSha(approvalPayloadSha256))throw coded('SHOPIFY_RECONCILE_APPROVAL_PROOF_INVALID');
  if(action!==SHOPIFY_PUBLIC_ACTION)throw coded('SHOPIFY_RECONCILE_ACTION_INVALID');
  return{
    schema:1,
    engine:'JARVIS_SHOPIFY_UNCERTAIN_RECONCILE',
    version:SHOPIFY_UNCERTAIN_RECONCILE_VERSION,
    state:RECEIPT_STATE,
    action,
    missionId,
    stage,
    productId,
    publicationId,
    storeHash,
    bindingHash,
    approvalPayloadSha256,
    replayAllowed:false
  };
}
function writeEvidence(workspace,input={}){
  const evidence=safeEvidence(input);
  const file=receiptFile(workspace,evidence.missionId);
  const previous=readEvidence(workspace,evidence.missionId,{required:false});
  const now=new Date().toISOString();
  const row={...evidence,createdAt:previous&&previous.createdAt||now,updatedAt:now};
  atomicWrite(file,row);
  return{file,evidence:clone(row)};
}
function readEvidence(workspace,missionId,{required=true}={}){
  const file=receiptFile(workspace,missionId);
  if(!fs.existsSync(file)){
    if(required)throw coded('SHOPIFY_RECONCILE_EVIDENCE_MISSING');
    return null;
  }
  let row;
  try{row=JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){throw coded('SHOPIFY_RECONCILE_EVIDENCE_CORRUPT')}
  const clean=safeEvidence(row);
  if(row.schema!==1||row.engine!=='JARVIS_SHOPIFY_UNCERTAIN_RECONCILE'||row.version!==SHOPIFY_UNCERTAIN_RECONCILE_VERSION||row.state!==RECEIPT_STATE||row.replayAllowed!==false){
    throw coded('SHOPIFY_RECONCILE_EVIDENCE_INVALID');
  }
  return{...clean,createdAt:String(row.createdAt||''),updatedAt:String(row.updatedAt||'')};
}
function loadMission(workspace,missionId){
  const file=path.join(path.resolve(workspace),'.jarvis-missions',String(missionId)+'.json');
  if(!fs.existsSync(file))throw coded('SHOPIFY_RECONCILE_MISSION_MISSING');
  let mission;
  try{mission=JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){throw coded('SHOPIFY_RECONCILE_MISSION_CORRUPT')}
  if(!mission||mission.schema!==1||mission.engine!=='JARVIS_MISSION_ENGINE'||mission.id!==missionId||mission.type!=='shopify_product'||!Array.isArray(mission.steps)){
    throw coded('SHOPIFY_RECONCILE_MISSION_INVALID');
  }
  const currentIndex=Number(mission.currentStep);
  const step=Number.isInteger(currentIndex)?mission.steps[currentIndex]:null;
  if(mission.status!=='needs_verification'||!step||step.name!=='shopify_publish'||step.status!=='uncertain'){
    throw coded('SHOPIFY_RECONCILE_MISSION_NOT_UNCERTAIN');
  }
  return mission;
}
function draftProof(mission){
  const step=mission.steps.find(x=>x&&x.name==='shopify_draft');
  if(!step||step.status!=='completed')throw coded('SHOPIFY_RECONCILE_DRAFT_MISSING');
  const artifact=step.artifact||(mission.artifacts&&mission.artifacts.shopify_draft)||null;
  const productId=String(artifact&&artifact.product&&artifact.product.id||'').trim();
  const storeHash=String(artifact&&artifact.product&&artifact.product._jarvisStoreHash||artifact&&artifact.shopHash||'').trim();
  if(!validProductGid(productId)||!validSha(storeHash))throw coded('SHOPIFY_RECONCILE_DRAFT_PROOF_INVALID');
  return{productId,storeHash};
}
function assertEvidenceBoundToMission(evidence,mission){
  if(!evidence||evidence.missionId!==mission.id)throw coded('SHOPIFY_RECONCILE_MISSION_MISMATCH');
  const draft=draftProof(mission);
  if(evidence.productId!==draft.productId)throw coded('SHOPIFY_RECONCILE_PRODUCT_MISMATCH');
  if(evidence.storeHash!==draft.storeHash)throw coded('SHOPIFY_RECONCILE_STORE_MISMATCH');
  return draft;
}
function classifyRemote(evidence,data){
  const remoteShop=normalizeShopDomain(data&&data.shop&&data.shop.myshopifyDomain||'');
  if(privacyHash(remoteShop)!==evidence.storeHash)throw coded('SHOPIFY_RECONCILE_STORE_MISMATCH');
  const product=data&&data.product||null;
  if(!product||String(product.id||'').trim()!==evidence.productId)throw coded('SHOPIFY_RECONCILE_PRODUCT_MISMATCH');
  const publications=data&&data.publications&&data.publications.nodes||[];
  const publication=publications.find(x=>String(x&&x.id||'').trim()===evidence.publicationId)||null;
  if(!publication||!/^online store$/i.test(String(publication.name||'').trim()))throw coded('SHOPIFY_RECONCILE_PUBLICATION_MISMATCH');
  const active=String(product.status||'').toUpperCase()==='ACTIVE';
  const published=product.publishedOnPublication===true;
  let classification='UNKNOWN_INCONSISTENT';
  if(active&&published)classification='VERIFIED_PUBLISHED';
  else if(active&&!published)classification='ACTIVE_NOT_PUBLISHED';
  else if(!active&&!published)classification='NOT_ACTIVE_NOT_PUBLISHED';
  return{
    ok:true,
    classification,
    canAutoResolve:classification==='VERIFIED_PUBLISHED',
    canAutoRetry:false,
    replayAllowed:false,
    action:evidence.action,
    missionId:evidence.missionId,
    productId:evidence.productId,
    publicationId:evidence.publicationId,
    storeHash:evidence.storeHash,
    bindingHash:evidence.bindingHash,
    status:String(product.status||''),
    published,
    verifiedAt:new Date().toISOString(),
    approvalGranted:false
  };
}
async function reconcile(workspace,missionId,opts={}){
  const evidence=readEvidence(workspace,missionId);
  const mission=typeof opts.loadMission==='function'?opts.loadMission(workspace,missionId):loadMission(workspace,missionId);
  assertEvidenceBoundToMission(evidence,mission);
  const resolveCredentials=opts.resolveCredentials;
  const request=opts.request;
  if(typeof resolveCredentials!=='function'||typeof request!=='function')throw coded('SHOPIFY_RECONCILE_ADAPTER_REQUIRED');
  const creds=resolveCredentials(workspace);
  if(!creds||!creds.ready)throw coded('SHOPIFY_NOT_CONNECTED');
  const shop=normalizeShopDomain(creds.shop||'');
  if(privacyHash(shop)!==evidence.storeHash)throw coded('SHOPIFY_RECONCILE_STORE_MISMATCH');
  const query=`query JarvisShopifyUncertainReconcile($productId: ID!, $publicationId: ID!) {
    shop { myshopifyDomain }
    product(id: $productId) {
      id
      title
      status
      publishedOnPublication(publicationId: $publicationId)
    }
    publications(first: 50) { nodes { id name } }
  }`;
  if(/\bmutation\b/i.test(query))throw coded('SHOPIFY_RECONCILE_READ_ONLY_VIOLATION');
  const data=await request(creds,query,{productId:evidence.productId,publicationId:evidence.publicationId});
  return classifyRemote(evidence,data);
}

module.exports={
  SHOPIFY_UNCERTAIN_RECONCILE_VERSION,SHOPIFY_PUBLIC_ACTION,RECEIPT_STATE,
  privacyHash,normalizeShopDomain,receiptFile,safeEvidence,writeEvidence,readEvidence,
  loadMission,draftProof,assertEvidenceBoundToMission,classifyRemote,reconcile
};
