(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{
    root.JarvisMobileConversationFollowup=api;
    const boot=(attempt=0)=>{
      if(api.install(root))return true;
      if(attempt<30)setTimeout(()=>boot(attempt+1),100);
      return false;
    };
    if(root&&root.document){
      if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot(0),0),{once:true});
      else setTimeout(()=>boot(0),0);
    }
  }
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MOBILE_RE=/iPhone|iPad|iPod|Android/i;
  function isMobile(root){return !!(root&&MOBILE_RE.test(String(root.navigator&&root.navigator.userAgent||'')))}
  function install(root){
    if(!root||!root.document||!isMobile(root))return false;
    if(root.__jarvisMobileConversationFollowupInstalled)return true;
    const originalRelay=root.playJarvisMobileRelay;
    const originalSchedule=root.scheduleVoiceConversationFollowup;
    if(typeof originalRelay!=='function'||typeof originalSchedule!=='function'||typeof root.armMobileConversationFollowup!=='function')return false;

    let latestSpeech=Promise.resolve(true);
    let generation=0;
    let pendingArmTimer=null;

    root.playJarvisMobileRelay=function(...args){
      let speech;
      try{speech=Promise.resolve(originalRelay.apply(this,args))}
      catch(error){speech=Promise.reject(error)}
      latestSpeech=speech;
      root.__jarvisMobileConversationSpeechPromise=speech;
      return speech;
    };

    root.scheduleVoiceConversationFollowup=function(spokenText){
      if(!isMobile(root))return originalSchedule.call(this,spokenText);
      const ticket=++generation;
      clearTimeout(pendingArmTimer);
      pendingArmTimer=null;
      const speech=latestSpeech;
      Promise.resolve(speech).then(()=>{
        if(ticket!==generation)return false;
        pendingArmTimer=setTimeout(()=>{
          pendingArmTimer=null;
          if(ticket!==generation)return;
          const armed=root.armMobileConversationFollowup(150);
          if(!armed){
            const voice=root.document.getElementById&&root.document.getElementById('voiceState');
            if(voice)voice.textContent='VOICE: TAP VOICE TO CONTINUE';
          }
        },150);
        return true;
      }).catch(()=>{
        if(ticket!==generation)return false;
        const voice=root.document.getElementById&&root.document.getElementById('voiceState');
        if(voice)voice.textContent='VOICE: TAP VOICE TO CONTINUE';
        return false;
      });
      return true;
    };

    root.__jarvisMobileConversationFollowupInstalled=true;
    return true;
  }
  return{MOBILE_RE,isMobile,install};
});
