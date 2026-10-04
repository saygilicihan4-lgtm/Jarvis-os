(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function createClient({request,play,onState=()=>{},onReply=()=>{}}){
    let sessionId=null,controller=null,busy=false;
    async function run(){
      if(busy)return{ok:false,state:'busy'};
      busy=true;controller=new AbortController();const active=controller;
      let receipt=null,acknowledged=false;
      onState('preparing');
      try{
        if(!sessionId){const created=await request({action:'create'},active.signal);sessionId=created.sessionId;if(!sessionId)throw new Error('session_create_failed')}
        active.signal.throwIfAborted();
        const result=await request({action:'turn',sessionId},active.signal);
        receipt=result.receipt||null;
        active.signal.throwIfAborted();
        if(result.state==='confirm-language'){onState('confirm-language',result);return result}
        if(!result.ok||result.state!=='audio-ready')throw new Error(result.reason||result.error||'speech_language_unavailable');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        const completed=await request({action:'acknowledge',sessionId,receipt,played:true},active.signal);
        acknowledged=true;onState('completed',completed);return completed;
      }catch(error){
        if(!active.signal.aborted)onState('error',{error:String(error.message||error)});
        if(/session_expired|session_not_found/.test(String(error.message||error)))sessionId=null;
        return{ok:false,cancelled:active.signal.aborted,error:String(error.message||error)};
      }finally{
        if(receipt&&!acknowledged&&sessionId)try{await request({action:'acknowledge',sessionId,receipt,played:false})}catch(_){}
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    async function cancel(){
      controller?.abort();
      if(sessionId)try{await request({action:'cancel',sessionId})}catch(_){}
    }
    return{run,cancel,get busy(){return busy}};
  }
  return{createClient};
});

;(function(root){
  'use strict';
  if(!root||!root.document||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return;
  function loadScript(id,src){
    return new Promise((resolve,reject)=>{
      if(root.document.getElementById(id)){
        const ready=id==='jarvisMobileSpeechEvidenceCoreScript'
          ?root.JarvisMobileSpeechEvidenceStatus
          :id==='jarvisMobileSpeechEvidenceUiScript'
            ?root.JarvisMobileSpeechEvidenceUi
            :id==='jarvisMobileConversationFollowupScript'
              ?root.JarvisMobileConversationFollowup
              :null;
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
      if(!root.JarvisMobileConversationFollowup)await loadScript('jarvisMobileConversationFollowupScript','/mobile-conversation-followup.js');
      const evidenceOk=!!(root.JarvisMobileSpeechEvidenceUi&&root.JarvisMobileSpeechEvidenceUi.install(root.document));
      const followupOk=!!(root.JarvisMobileConversationFollowup&&root.JarvisMobileConversationFollowup.install(root));
      if(!followupOk&&attempt<20)setTimeout(()=>boot(attempt+1),100);
      return evidenceOk&&followupOk;
    }catch(_){return false}
  }
  setTimeout(()=>boot(0),0);
})(typeof globalThis==='object'?globalThis:this);
