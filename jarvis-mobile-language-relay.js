'use strict';
const lang=require('./jarvis-language-core');
const VERSION='1.1';
const TERMINAL=new Set(['ready','failed','cancelled']);
const SOURCES=new Set(['browser-speech','typed']);
const CLAIM_LEASE_MS=90_000;
const QUEUE_TTL_MS=5*60_000;

function normalizeLocale(value){return lang.normalizeLocale(value)}
function sanitizeHistory(value){
  if(!Array.isArray(value))return[];
  const out=[];
  for(const row of value.slice(-8)){
    if(!row||!['user','assistant'].includes(row.role))continue;
    const content=String(row.content||'').replace(/\s+/g,' ').trim().slice(0,1800);
    if(content)out.push({role:row.role,content});
  }
  return out;
}
function attachLeaseStatus(request,clock){
  Object.defineProperty(request,'__relayStatus',{value:'queued',writable:true,enumerable:false,configurable:false});
  Object.defineProperty(request,'__relayClock',{value:clock,enumerable:false,configurable:false});
  Object.defineProperty(request,'status',{
    enumerable:true,configurable:false,
    get(){
      const nowMs=request.__relayClock(),status=request.__relayStatus;
      if(status==='claimed'&&Number.isFinite(request.claimedAtMs)&&nowMs-request.claimedAtMs>CLAIM_LEASE_MS){
        request.__relayStatus='failed';request.failedAtMs=nowMs;request.result=null;request.error='worker_claim_expired';
      }else if(status==='queued'&&Number.isFinite(request.createdAtMs)&&nowMs-request.createdAtMs>QUEUE_TTL_MS){
        request.__relayStatus='failed';request.failedAtMs=nowMs;request.result=null;request.error='request_expired';
      }
      return request.__relayStatus;
    },
    set(value){request.__relayStatus=String(value||'')}
  });
  return request;
}
function createRequest({id,text,locale,inputSource='browser-speech',history=[],now=Date.now}={}){
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1800),normalized=normalizeLocale(locale),source=String(inputSource||'');
  if(!id)throw new Error('request_id_required');
  if(!clean)throw new Error('text_required');
  if(!normalized)throw new Error('locale_required');
  if(!SOURCES.has(source))throw new Error('input_source_not_allowed');
  const createdAtMs=now();
  if(!Number.isFinite(createdAtMs))throw new Error('request_clock_invalid');
  return attachLeaseStatus({id,text:clean,locale:normalized,inputSource:source,history:sanitizeHistory(history),createdAtMs,claimedBy:null,claimedAtMs:null,result:null,error:null},now);
}
function claim(request,workerId,{now=Date.now}={}){
  const id=String(workerId||'').trim();
  if(!request||request.status!=='queued')return{ok:false,reason:'request_not_queued'};
  if(!id)return{ok:false,reason:'worker_id_required'};
  const claimedAtMs=now();
  if(!Number.isFinite(claimedAtMs))return{ok:false,reason:'claim_clock_invalid'};
  request.status='claimed';request.claimedBy=id;request.claimedAtMs=claimedAtMs;return{ok:true,request};
}
function verifyResult(request,{workerId,locale}={}){
  if(!request)return{ok:false,reason:'request_not_found'};
  if(request.status!=='claimed'||TERMINAL.has(request.status))return{ok:false,reason:'request_not_claimed_or_terminal'};
  const id=String(workerId||'').trim();
  if(!id||id!==request.claimedBy)return{ok:false,reason:'worker_claim_mismatch'};
  const normalized=normalizeLocale(locale);
  if(!normalized||normalized!==request.locale)return{ok:false,reason:'locale_mismatch'};
  return{ok:true,locale:normalized};
}
function cancel(request,{now=Date.now}={}){
  if(!request)return{ok:false,reason:'request_not_found'};
  if(TERMINAL.has(request.status))return{ok:false,reason:'request_terminal'};
  request.status='cancelled';request.cancelledAtMs=now();request.result=null;request.error='cancelled';return{ok:true,status:'cancelled'};
}
function isTerminal(request){return !!request&&TERMINAL.has(request.status)}

module.exports={VERSION,CLAIM_LEASE_MS,QUEUE_TTL_MS,normalizeLocale,sanitizeHistory,createRequest,claim,verifyResult,cancel,isTerminal};
