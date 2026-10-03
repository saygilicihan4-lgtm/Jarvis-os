'use strict';
const lang=require('./jarvis-language-core'),learning=require('./jarvis-language-learning');
const VERSION='2.0';
function createSession({requested,systemLocale,root}={}){
  const base=learning.resolve({requested,systemLocale,root});
  return{locale:base.locale,source:base.source,requested:lang.normalizeLocale(requested),candidate:null,candidateCount:0,
    pending:null,activeTurn:null,lastSequence:0,switches:0};
}
function resetCandidate(session){session.candidate=null;session.candidateCount=0;session.pending=null}
function resolve(session,{requested,systemLocale,root}={}){
  if(session.activeTurn)return{...session.activeTurn.context};
  const explicit=lang.normalizeLocale(requested)||session.requested||learning.load(root).explicitLocale;
  if(explicit)return lang.resolveLanguage({requested:explicit});
  return lang.resolveLanguage({detected:session.locale,profileLocale:learning.load(root).learnedLocale,systemLocale});
}
function observe(session,{locale,confidence=0,sequence,automatic=false,final=false,speechPlan,root}={}){
  if(!Number.isSafeInteger(sequence)||sequence<=session.lastSequence)return{ok:false,reason:'stale_or_duplicate_observation'};
  session.lastSequence=sequence;
  const n=lang.normalizeLocale(locale);
  const explicit=session.requested||learning.load(root).explicitLocale;
  let reason=null;
  if(explicit)reason='explicit_preference_locked';
  else if(!automatic||!final)reason='automatic_final_detection_required';
  else if(!n||!lang.validConfidence(confidence)||confidence<0.85)reason='detection_below_session_threshold';
  else if(!speechPlan||speechPlan.ok!==true||speechPlan.locale!==n)reason='speech_capability_unavailable';
  if(reason){resetCandidate(session);return{ok:false,reason,locale:resolve(session,{root}).locale}}
  session.candidateCount=session.candidate===n?Math.min(2,session.candidateCount+1):1;
  session.candidate=n;
  if(session.candidateCount>=2)session.pending={locale:n,confidence,sequence};
  return{ok:true,changed:false,pendingLocale:session.pending?.locale||null,candidateCount:session.candidateCount};
}
function beginTurn(session,{id,root,systemLocale}={}){
  if(session.activeTurn)throw new Error('language_turn_busy');
  if(typeof id!=='string'||!id)throw new Error('turn_id_required');
  const explicit=session.requested||learning.load(root).explicitLocale;
  if(explicit){resetCandidate(session);session.locale=explicit;session.source='requested'}
  else if(session.pending){
    if(session.locale!==session.pending.locale)session.switches++;
    session.locale=session.pending.locale;session.source='session_detection';session.pending=null;
  }
  const context={...resolve(session,{root,systemLocale}),source:session.source,sessionOnly:true};
  session.activeTurn={id,context};
  return{...context};
}
function endTurn(session,id){
  if(!session.activeTurn||session.activeTurn.id!==id)return{ok:false,reason:'stale_or_unknown_turn'};
  session.activeTurn=null;
  return{ok:true};
}
module.exports={VERSION,createSession,resolve,observe,beginTurn,endTurn,resetCandidate};
