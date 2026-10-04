(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function emitConversationState(state,detail){
    try{
      const host=typeof globalThis==='object'?globalThis:null,doc=host&&host.document;
      if(!doc||typeof host.CustomEvent!=='function')return;
      const mapped=({preparing:'thinking',playing:'speaking',completed:'idle',error:'error',idle:'idle','confirm-language':'waiting'})[state]||state;
      const consultWith=Array.isArray(detail&&detail.consultWith)?detail.consultWith.filter(x=>['jarvis','nova','orion'].includes(x)).slice(0,2):[];
      doc.dispatchEvent(new host.CustomEvent('jarvis:conversation-state',{detail:{state:mapped,core:detail&&detail.core||null,role:detail&&detail.role||null,consultWith,authority:detail&&detail.authority||'shared_guardrail_only'}}));
    }catch(_){}
  }
  function createClient({request,play,onState=()=>{},onReply=()=>{}}){
    let sessionId=null,controller=null,busy=false;
    const state=(name,detail)=>{emitConversationState(name,detail);onState(name,detail)};
    async function run(){
      if(busy)return{ok:false,state:'busy'};
      busy=true;controller=new AbortController();const active=controller;
      let receipt=null,acknowledged=false;
      state('preparing');
      try{
        if(!sessionId){const created=await request({action:'create'},active.signal);sessionId=created.sessionId;if(!sessionId)throw new Error('session_create_failed')}
        active.signal.throwIfAborted();
        const result=await request({action:'turn',sessionId},active.signal);
        receipt=result.receipt||null;
        active.signal.throwIfAborted();
        if(result.state==='confirm-language'){state('confirm-language',result);return result}
        if(!result.ok||result.state!=='audio-ready')throw new Error(result.reason||result.error||'speech_language_unavailable');
        onReply(result);state('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        const completed=await request({action:'acknowledge',sessionId,receipt,played:true},active.signal);
        acknowledged=true;state('completed',{...completed,core:result.core,role:result.role,consultWith:result.consultWith,authority:result.authority});return completed;
      }catch(error){
        if(!active.signal.aborted)state('error',{error:String(error.message||error)});
        if(/session_expired|session_not_found/.test(String(error.message||error)))sessionId=null;
        return{ok:false,cancelled:active.signal.aborted,error:String(error.message||error)};
      }finally{
        if(receipt&&!acknowledged&&sessionId)try{await request({action:'acknowledge',sessionId,receipt,played:false})}catch(_){}
        if(controller===active){controller=null;busy=false;state('idle')}
      }
    }
    async function cancel(){
      controller?.abort();
      if(sessionId)try{await request({action:'cancel',sessionId})}catch(_){}
      emitConversationState('idle');
    }
    return{run,cancel,get busy(){return busy}};
  }
  return{createClient,emitConversationState};
});

;(function(root){
  'use strict';
  if(!root||!root.document||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return;
  function loadScript(id,src){
    return new Promise((resolve,reject)=>{
      if(root.document.getElementById(id)){
        const ready=id==='jarvisMobileSpeechEvidenceCoreScript'?root.JarvisMobileSpeechEvidenceStatus:root.JarvisMobileSpeechEvidenceUi;
        if(ready){resolve(true);return}
      }
      const script=root.document.createElement('script');script.id=id;script.src=src;script.async=false;
      script.onload=()=>resolve(true);script.onerror=()=>reject(new Error('script_load_failed:'+src));
      (root.document.head||root.document.documentElement).appendChild(script);
    });
  }
  async function boot(attempt=0){
    if(!root.JarvisMobileLanguageChat){
      if(attempt<20)setTimeout(()=>boot(attempt+1),100);
      return false;
    }
    try{
      if(!root.JarvisMobileSpeechEvidenceStatus)await loadScript('jarvisMobileSpeechEvidenceCoreScript','/mobile-speech-evidence-status.js');
      if(!root.JarvisMobileSpeechEvidenceUi)await loadScript('jarvisMobileSpeechEvidenceUiScript','/mobile-speech-evidence-ui.js');
      return !!(root.JarvisMobileSpeechEvidenceUi&&root.JarvisMobileSpeechEvidenceUi.install(root.document));
    }catch(_){return false}
  }
  setTimeout(()=>boot(0),0);
})(typeof globalThis==='object'?globalThis:this);

;(function(root){
  'use strict';
  if(!root||!root.document||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return;
  function bootMissionActions(attempt=0){
    if(root.JarvisMissionActions){
      try{return !!root.JarvisMissionActions.install(root)}catch(_){return false}
    }
    let script=root.document.getElementById('jarvisMissionActionsScript');
    if(!script){
      script=root.document.createElement('script');
      script.id='jarvisMissionActionsScript';script.src='/mission-actions.js';script.async=false;
      script.onload=()=>{try{root.JarvisMissionActions&&root.JarvisMissionActions.install(root)}catch(_){}};
      (root.document.head||root.document.documentElement).appendChild(script);
    }
    if(attempt<30)setTimeout(()=>bootMissionActions(attempt+1),100);
    return false;
  }
  setTimeout(()=>bootMissionActions(0),0);
})(typeof globalThis==='object'?globalThis:this);

// v179: load one local tri-core role/state router. The router owns the single
// zero-cost hologram renderer and neither surface can execute or approve actions.
;(function(root){
  'use strict';
  if(!root||!root.document)return;
  function install(){
    try{return !!(root.JarvisTriCore&&root.JarvisTriCore.install(root))}catch(_){return false}
  }
  function boot(attempt=0){
    if(install())return true;
    let script=root.document.getElementById('jarvisTriCoreScript');
    if(!script){
      script=root.document.createElement('script');
      script.id='jarvisTriCoreScript';script.src='/tri-core.js';script.async=false;
      script.onload=()=>install();
      (root.document.head||root.document.documentElement).appendChild(script);
    }
    if(attempt<30)setTimeout(()=>boot(attempt+1),100);
    return false;
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});
  else setTimeout(()=>boot(0),0);
})(typeof globalThis==='object'?globalThis:this);
