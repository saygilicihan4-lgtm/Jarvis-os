'use strict';
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const TERMINAL=new Set(['ready','failed','cancelled']);
const SOURCES=new Set(['browser-speech','typed']);

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
function createRequest({id,text,locale,inputSource='browser-speech',history=[],now=Date.now}={}){
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1800),normalized=normalizeLocale(locale),source=String(inputSource||'');
  if(!id)throw new Error('request_id_required');
  if(!clean)throw new Error('text_required');
  if(!normalized)throw new Error('locale_required');
  if(!SOURCES.has(source))throw new Error('input_source_not_allowed');
  return{id,text:clean,locale:normalized,inputSource:source,history:sanitizeHistory(history),status:'queued',createdAtMs:now(),claimedBy:null,claimedAtMs:null,result:null,error:null};
}
function claim(request,workerId,{now=Date.now}={}){
  const id=String(workerId||'').trim();
  if(!request||request.status!=='queued')return{ok:false,reason:'request_not_queued'};
  if(!id)return{ok:false,reason:'worker_id_required'};
  request.status='claimed';request.claimedBy=id;request.claimedAtMs=now();return{ok:true,request};
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
module.exports={VERSION,normalizeLocale,sanitizeHistory,createRequest,claim,verifyResult,cancel};
