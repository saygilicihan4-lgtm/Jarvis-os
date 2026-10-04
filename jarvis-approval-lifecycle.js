'use strict';

const crypto=require('crypto');
const {approvalSurfaceForStepName}=require('./jarvis-approval-intent');
const APPROVAL_TTL_MS=15*60*1000;
const BINDING_VERSION=1;

function currentStep(mission){
  const index=mission&&mission.currentStep;
  return Number.isInteger(index)&&index>=0&&Array.isArray(mission.steps)?mission.steps[index]||null:null;
}
function isApprovalStep(step){return !!approvalSurfaceForStepName(step&&step.name)}
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
function payloadHash(mission){
  const step=currentStep(mission);
  if(!isApprovalStep(step))throw new Error('Approval step required');
  // Bind local execution data, not mutable scheduling/history timestamps. This is
  // NOT an attestation of a live site's DOM, account, or remote object contents.
  const payload={
    version:BINDING_VERSION,id:mission.id,type:mission.type,
    index:mission.currentStep,step:step.name,input:mission.input||{},artifacts:mission.artifacts||{},
    priorSteps:mission.steps.slice(0,mission.currentStep).map(s=>({name:s.name,status:s.status,artifact:s.artifact||null}))
  };
  return crypto.createHash('sha256').update(canonical(payload),'utf8').digest('hex');
}
function timestamp(value){
  if(typeof value!=='string')return NaN;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&new Date(ms).toISOString()===value?ms:NaN;
}
function approvalRequestFingerprint(value){
  const s=String(value||'').trim();
  return s?crypto.createHash('sha256').update(s,'utf8').digest('hex').slice(0,10):'';
}
function requestedFingerprintFromReason(value){
  const reason=String(value||'');
  if(!reason.includes('|req:'))return{present:false,valid:true,value:null};
  const matches=[...reason.matchAll(/\|req:([^|]+)/g)].map(x=>String(x[1]||'').toLowerCase());
  if(matches.length!==1||!/^[a-f0-9]{10}$/.test(matches[0]))return{present:true,valid:false,value:null};
  return{present:true,valid:true,value:matches[0]};
}
function revokeApproval(mission,reason='revoked',nowMs=Date.now()){
  const step=currentStep(mission);
  if(!isApprovalStep(step))return;
  const meta=step.meta||(step.meta={});
  if(meta.approvedAt||meta.approvalPayloadSha256){
    meta.approvalRevokedAt=new Date(nowMs).toISOString();
    meta.approvalRevokedReason=String(reason).replace(/[^a-z0-9_]/gi,'_').slice(0,80);
  }
  for(const key of ['approvedAt','approvalKind','approvalSurface','approvalTargetReason',
    'approvalPayloadSha256','approvalBindingVersion','approvalRequestId','approvalRequestSha256','approvalRequestedAt'])delete meta[key];
}
function requestApproval(mission,nowMs=Date.now()){
  const step=currentStep(mission);
  if(!isApprovalStep(step))return;
  step.meta={...(step.meta||{}),approvalRequestId:crypto.randomUUID(),approvalRequestSha256:payloadHash(mission),approvalRequestedAt:new Date(nowMs).toISOString()};
}
function grantApproval(mission,{surface='',targetReason='',nowMs=Date.now()}={}){
  const step=currentStep(mission);
  const reject=code=>({ok:false,code});
  if(!isApprovalStep(step)||!step.meta||step.meta.requiresApproval!==true||
    mission.status!=='waiting_dependency'||step.status!=='blocked'||
    !step.error||step.error.dependency!=='approval'||mission.control&&mission.control.requested){
    return reject('APPROVAL_NOT_PENDING');
  }
  if(surface!==approvalSurfaceForStepName(step.name))return reject('APPROVAL_SURFACE_MISMATCH');
  const requestedFingerprint=requestedFingerprintFromReason(targetReason);
  if(!requestedFingerprint.valid)return reject('APPROVAL_REQUEST_FINGERPRINT_INVALID');
  if(requestedFingerprint.present&&requestedFingerprint.value!==approvalRequestFingerprint(step.meta.approvalRequestId)){
    return reject('APPROVAL_REQUEST_FINGERPRINT_MISMATCH');
  }
  const requested=timestamp(step.meta.approvalRequestedAt);
  const hash=payloadHash(mission);
  if(!Number.isFinite(nowMs))return reject('APPROVAL_INVALID_CLOCK');
  if(step.meta.approvalRequestSha256!==hash||!Number.isFinite(requested)||requested>nowMs||nowMs-requested>=APPROVAL_TTL_MS){
    revokeApproval(mission,'review_changed_or_expired',nowMs);
    requestApproval(mission,nowMs);
    return reject('APPROVAL_REVIEW_REQUIRED');
  }
  step.meta={...step.meta,approvedAt:new Date(nowMs).toISOString(),approvalKind:'explicit_user',
    approvalSurface:surface,approvalTargetReason:targetReason,
    approvalPayloadSha256:hash,approvalBindingVersion:BINDING_VERSION};
  // Revocation history remains in mission.history; a new grant has fresh metadata.
  delete step.meta.approvalRevokedAt;
  delete step.meta.approvalRevokedReason;
  return{ok:true};
}
function validateApproval(mission,{nowMs=Date.now()}={}){
  const step=currentStep(mission),meta=step&&step.meta||{};
  const reject=code=>({ok:false,code});
  if(!isApprovalStep(step)||meta.requiresApproval!==true||mission.status!=='running'||step.status!=='running'||
    mission.control&&mission.control.requested)return reject('APPROVAL_NOT_ACTIVE');
  if(meta.approvalKind!=='explicit_user'||meta.approvalBindingVersion!==BINDING_VERSION||
    meta.approvalSurface!==approvalSurfaceForStepName(step.name))return reject('APPROVAL_UNBOUND');
  const approved=timestamp(meta.approvedAt),requested=timestamp(meta.approvalRequestedAt);
  if(!Number.isFinite(nowMs)||!Number.isFinite(approved)||!Number.isFinite(requested)||
    approved<requested||approved>nowMs)return reject('APPROVAL_INVALID_TIME');
  if(nowMs-approved>=APPROVAL_TTL_MS)return reject('APPROVAL_EXPIRED');
  if(meta.approvalPayloadSha256!==meta.approvalRequestSha256||meta.approvalPayloadSha256!==payloadHash(mission)){
    return reject('APPROVAL_PAYLOAD_CHANGED');
  }
  return{ok:true,approvedAt:meta.approvedAt,payloadSha256:meta.approvalPayloadSha256};
}

module.exports={APPROVAL_TTL_MS,BINDING_VERSION,isApprovalStep,payloadHash,approvalRequestFingerprint,revokeApproval,requestApproval,grantApproval,validateApproval};
