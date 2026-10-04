'use strict';
const crypto=require('crypto');
const triCore=require('./jarvis-tri-core-personality');
const VERSION='1.2';
function verifiedConsulted(generated,selected){
  const allowed=new Set(Array.isArray(selected&&selected.consultWith)?selected.consultWith:[]),out=[];
  for(const id of Array.isArray(generated&&generated.consultedWith)?generated.consultedWith:[]){
    if(!allowed.has(id)||!triCore.PROFILES[id])throw new Error('tri_core_consultation_contract_mismatch');
    if(!out.includes(id))out.push(id);
  }
  return out.slice(0,2);
}
function createConversation({runtime,output,now=Date.now}={}){
  const records=new Map();let lastProbe=null;
  function get(id){
    const record=records.get(id);
    if(!record||now()-record.at>1800000)throw new Error('conversation_session_expired');
    record.at=now();return record;
  }
  function create(options){
    for(const [id,row] of records)if(now()-row.at>1800000)records.delete(id);
    const result=runtime.create(options);
    records.set(result.sessionId,{at:now(),busy:false,controller:null,receipt:null,history:[]});
    return result;
  }
  async function turn(id,{signal}={}){
    const row=get(id);
    if(row.receipt&&now()-row.receipt.at>120000){runtime.complete(id,{turnId:row.receipt.turnId,successful:false});row.receipt=null}
    if(row.busy||row.receipt)throw new Error('conversation_turn_busy');
    row.busy=true;row.controller=new AbortController();
    const controller=row.controller,abort=()=>controller.abort();
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(abort,90000);let begun=null;
    try{
      controller.signal.throwIfAborted();
      if(lastProbe===null||now()-lastProbe>240000){await runtime.probe();lastProbe=now()}
      controller.signal.throwIfAborted();
      const capture=await runtime.listen(id,{signal:controller.signal});
      if(!capture.speech.ok&&capture.decision.reason==='speech_capability_unavailable'){
        runtime.discardCapture(id);return{ok:false,state:'unsupported',speech:capture.speech,transcript:capture.text};
      }
      if((capture.decision.ok&&capture.decision.candidateCount===1&&capture.decision.candidateLocale!==capture.context.locale)||
        (!capture.decision.ok&&capture.decision.reason!=='explicit_preference_locked')){
        runtime.discardCapture(id);
        return{ok:true,state:'confirm-language',locale:capture.decision.candidateLocale||null,transcript:capture.text};
      }
      begun=runtime.begin(id);
      if(!begun.ok)return{...begun,state:'unsupported',transcript:capture.text};
      const frozen={context:{...begun.context},speech:{...begun.speech},signal:controller.signal};
      const selected=triCore.select(capture.text);
      const generated=await output.generate({text:capture.text,history:row.history,core:selected,...frozen});
      controller.signal.throwIfAborted();
      if(generated.locale!==frozen.context.locale)throw new Error('reply_locale_mismatch');
      if(generated.core&&generated.core!==selected.core)throw new Error('tri_core_contract_mismatch');
      if(generated.authority&&generated.authority!=='shared_guardrail_only')throw new Error('tri_core_contract_mismatch');
      const consultedWith=verifiedConsulted(generated,selected);
      const rendered=await output.render({reply:generated.reply,...frozen});
      controller.signal.throwIfAborted();
      if(rendered.locale!==frozen.context.locale||rendered.voice!==frozen.speech.voice||!rendered.audio)throw new Error('render_context_mismatch');
      const token=crypto.randomUUID();
      row.receipt={token,turnId:begun.turnId,at:now(),transcript:capture.text,reply:generated.reply};
      return{ok:true,state:'audio-ready',receipt:token,reply:generated.reply,transcript:capture.text,core:selected.core,role:selected.role,
        coreSource:selected.source,consultWith:consultedWith,consultationMode:'local_advisory_only',authority:'shared_guardrail_only',...rendered};
    }catch(error){
      if(begun?.ok)runtime.complete(id,{turnId:begun.turnId,successful:false});
      else runtime.discardCapture(id,{resetCandidate:true});
      throw error;
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);row.busy=false;row.controller=null}
  }
  function acknowledge(id,{receipt,played=false}={}){
    const row=get(id),pending=row.receipt;
    if(!pending||pending.token!==receipt)throw new Error('invalid_playback_receipt');
    row.receipt=null;
    const successful=played===true&&now()-pending.at<=120000;
    const result=runtime.complete(id,{turnId:pending.turnId,successful});
    if(successful&&result.ok)row.history=[...row.history,{role:'user',content:pending.transcript},{role:'assistant',content:pending.reply}].slice(-8);
    return{...result,playbackReported:successful,deviceE2eVerified:false};
  }
  function cancel(id){
    const row=get(id);row.controller?.abort();
    if(row.receipt){runtime.complete(id,{turnId:row.receipt.turnId,successful:false});row.receipt=null}
    if(!row.busy)runtime.discardCapture(id,{resetCandidate:true});
    return{ok:true,cancelled:true};
  }
  return{create,turn,acknowledge,cancel};
}
module.exports={VERSION,verifiedConsulted,createConversation};
