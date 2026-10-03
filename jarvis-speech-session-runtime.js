'use strict';
const crypto=require('crypto');
const lang=require('./jarvis-language-core'),learning=require('./jarvis-language-learning');
const sessions=require('./jarvis-session-language'),caps=require('./jarvis-speech-capabilities'),discovery=require('./jarvis-speech-provider-discovery');
const VERSION='1.0';
function createRuntime({root=__dirname,systemLocale='tr-TR',sttPort=8768,fetchImpl=fetch,now=Date.now,probeVoices}={}){
  if(!Number.isInteger(sttPort)||sttPort<1||sttPort>65535)throw new Error('invalid_stt_port');
  const registry=caps.createRegistry({now}),records=new Map(),seenUtterances=new Set();
  let listening=false,probing=null;
  function get(id){
    const row=records.get(id);
    if(!row)throw new Error('language_session_not_found');
    if(now()-row.updatedAt>1800000){records.delete(id);throw new Error('language_session_expired')}
    row.updatedAt=now();return row;
  }
  function create({requested}={}){
    if(requested!=null&&!lang.normalizeLocale(requested))throw new Error('invalid_locale');
    for(const [id,row] of records)if(now()-row.updatedAt>1800000)records.delete(id);
    if(records.size>=32)throw new Error('language_session_limit');
    const id=crypto.randomUUID();
    records.set(id,{session:sessions.createSession({requested,systemLocale,root}),sequence:0,updatedAt:now(),evidence:null,
      utterances:new Set(),captured:false,busy:false,turn:null,blockedSpeech:null});
    return{ok:true,sessionId:id,...status(id)};
  }
  function status(id){
    const row=get(id),context=sessions.resolve(row.session,{root,systemLocale});
    return{ok:true,context,speech:row.blockedSpeech||registry.select({locale:context.locale}),pendingLocale:row.session.pending?.locale||null,
      activeTurn:!!row.session.activeTurn,deviceE2eVerified:false};
  }
  async function probe(){
    if(probing)return probing;
    probing=(async()=>{
      const voiceResults=probeVoices?await probeVoices(registry):await Promise.all([
        discovery.discoverEdgeTts({registry}),discovery.discoverSystemTts({registry})]);
      const stt=await discovery.discoverLocalStt({port:sttPort,registry,fetchImpl});
      return{ok:stt.ok,stt,tts:voiceResults,deviceE2eVerified:false};
    })();
    try{return await probing}finally{probing=null}
  }
  async function listen(id){
    const row=get(id);
    if(listening||row.busy||row.session.activeTurn)throw new Error('language_turn_busy');
    listening=true;row.busy=true;row.evidence=null;row.captured=false;row.blockedSpeech=null;
    try{
      const stt=await discovery.discoverLocalStt({port:sttPort,registry,fetchImpl});
      const explicit=row.session.requested||learning.load(root).explicitLocale;
      if(!stt.ok||(!explicit&&!stt.automaticDetection))throw new Error('automatic_language_detection_unavailable');
      if(explicit&&!registry.supports('faster-whisper','stt',explicit))throw new Error('stt_language_not_in_loaded_model');
      const response=await fetchImpl('http://127.0.0.1:'+sttPort+'/listen',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:explicit||'auto'}),signal:AbortSignal.timeout(20000)
      });
      const result=await response.json();
      if(!response.ok||result.ok!==true||result.engine!=='faster-whisper'||typeof result.text!=='string'||!result.text.trim())throw new Error('stt_capture_failed');
      const evidence=result.meta?.language_detection,utteranceId=result.meta?.utterance_id;
      if(typeof utteranceId!=='string'||utteranceId.length<1||utteranceId.length>128||seenUtterances.has(utteranceId))throw new Error('duplicate_or_missing_utterance');
      // Process-wide dedupe prevents a repeated provider response from being
      // counted again simply by creating another session. Fail closed at cap.
      if(seenUtterances.size>=4096)throw new Error('language_runtime_observation_limit');
      seenUtterances.add(utteranceId);
      row.utterances.add(utteranceId);
      if(row.utterances.size>128)throw new Error('language_session_utterance_limit');
      const locale=lang.normalizeLocale(evidence?.language),speechPlan=registry.select({locale});
      if(!explicit&&locale&&evidence?.mode==='automatic'&&evidence.reliable===true&&evidence.final===true&&
        lang.validConfidence(evidence.confidence)&&evidence.confidence>=0.85&&!speechPlan.ok)row.blockedSpeech=speechPlan;
      const decision=sessions.observe(row.session,{locale,confidence:evidence?.confidence,sequence:++row.sequence,
        automatic:!explicit&&evidence?.mode==='automatic'&&evidence.reliable===true,final:evidence?.final===true,speechPlan,root});
      row.evidence=decision.ok?{locale,confidence:evidence.confidence}:null;row.captured=true;
      if(!row.evidence)learning.clearCandidate(root);
      return{ok:true,text:result.text.trim().slice(0,6000),decision,...status(id)};
    }catch(error){
      sessions.resetCandidate(row.session);learning.clearCandidate(root);throw error;
    }finally{listening=false;row.busy=false;row.updatedAt=now()}
  }
  function begin(id){
    const row=get(id);
    if(row.busy||row.session.activeTurn)throw new Error('language_turn_busy');
    if(!row.captured)throw new Error('fresh_capture_required');
    if(row.blockedSpeech)return{...row.blockedSpeech};
    const explicit=row.session.requested||learning.load(root).explicitLocale;
    const locale=explicit||row.session.pending?.locale||sessions.resolve(row.session,{root,systemLocale}).locale;
    const speech=registry.select({locale});
    if(!speech.ok){sessions.resetCandidate(row.session);learning.clearCandidate(root);return speech}
    const turnId=crypto.randomUUID(),context=sessions.beginTurn(row.session,{id:turnId,root,systemLocale});
    row.captured=false;row.turn={id:turnId,evidence:row.evidence,context};row.evidence=null;
    return{ok:true,turnId,context,speech};
  }
  function complete(id,{turnId,successful=false}={}){
    const row=get(id),turn=row.turn;
    const ended=sessions.endTurn(row.session,turnId);
    if(!ended.ok)return ended;
    row.turn=null;
    const evidence=turn?.evidence;
    // Completion is the caller's receipt, not a claim of device E2E success.
    // No transcript, code, permissions or execution policy is persisted.
    if(successful===true&&evidence&&evidence.locale===turn.context.locale&&registry.select({locale:evidence.locale}).ok){
      const learned=learning.observe(evidence.locale,{confidence:evidence.confidence,root});
      if(!learned.ok)learning.clearCandidate(root);
      return{ok:true,learning:learned.ok,learnedLocale:learned.profile.learnedLocale,deviceE2eVerified:false};
    }
    learning.clearCandidate(root);
    if(successful!==true)sessions.resetCandidate(row.session);
    return{ok:true,learning:false,deviceE2eVerified:false};
  }
  function setPreference(locale){return{ok:true,profile:learning.setExplicit(locale,root)}}
  function resetLearned(){return{ok:true,profile:learning.resetLearned(root)}}
  return{create,status,probe,listen,begin,complete,setPreference,resetLearned};
}
module.exports={VERSION,createRuntime};
