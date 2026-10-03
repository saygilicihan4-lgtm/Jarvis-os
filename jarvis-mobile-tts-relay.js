'use strict';
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const TERMINAL=new Set(['ready','failed','cancelled']);

function normalizeLocale(value){return lang.normalizeLocale(value)}
function createRequest({id,text,tone='balanced',locale,now=Date.now}={}){
  const normalized=normalizeLocale(locale),cleanText=String(text||'').replace(/\s+/g,' ').trim().slice(0,700);
  if(!id)throw new Error('request_id_required');
  if(!cleanText)throw new Error('text_required');
  if(!normalized)throw new Error('locale_required');
  return{id, text:cleanText, tone:String(tone||'balanced'), locale:normalized, status:'queued', createdAtMs:now(), claimedBy:null, claimedAtMs:null, audio:null, error:null};
}
function claim(request,workerId,{now=Date.now}={}){
  const id=String(workerId||'').trim();
  if(!request||request.status!=='queued')return{ok:false,reason:'request_not_queued'};
  if(!id)return{ok:false,reason:'worker_id_required'};
  request.status='claimed';request.claimedBy=id;request.claimedAtMs=now();
  return{ok:true,request};
}
function verifyResult(request,{workerId,locale}={}){
  if(!request)return{ok:false,reason:'request_not_found'};
  if(TERMINAL.has(request.status)||request.status!=='claimed')return{ok:false,reason:'request_not_claimed_or_terminal'};
  const id=String(workerId||'').trim();
  if(!id||id!==request.claimedBy)return{ok:false,reason:'worker_claim_mismatch'};
  const normalized=normalizeLocale(locale);
  if(!normalized||normalized!==request.locale)return{ok:false,reason:'locale_mismatch'};
  return{ok:true,locale:normalized};
}
function cancel(request,{now=Date.now}={}){
  if(!request)return{ok:false,reason:'request_not_found'};
  if(TERMINAL.has(request.status))return{ok:false,reason:'request_terminal'};
  request.status='cancelled';request.cancelledAtMs=now();request.audio=null;request.error='cancelled';
  return{ok:true,status:'cancelled'};
}
function isTerminal(request){return !!request&&TERMINAL.has(request.status)}

module.exports={VERSION,normalizeLocale,createRequest,claim,verifyResult,cancel,isTerminal};
