(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisMobileLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function safeLanguageHint(text){
    const s=String(text||'');
    if(/[ğĞıİşŞöÖüÜ]/.test(s))return'tr-TR';
    if(/[а-яё]/i.test(s))return'ru-RU';
    if(/[\u0600-\u06ff]/.test(s))return'ar-SA';
    if(/[\u3040-\u30ff]/.test(s))return'ja-JP';
    if(/[\uac00-\ud7af]/.test(s))return'ko-KR';
    if(/[ßẞ]/.test(s))return'de-DE';
    if(/[ñÑ¿¡]/.test(s))return'es-ES';
    if(/[ãÃõÕ]/.test(s))return'pt-BR';
    return null;
  }
  function cleanHistory(value){
    if(!Array.isArray(value))return[];
    return value.slice(-8).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string'&&x.content.trim()).map(x=>({role:x.role,content:x.content.replace(/\s+/g,' ').trim().slice(0,1800)}));
  }
  function createClient({capture,request,play,onState=()=>{},onReply=()=>{},hint=safeLanguageHint}={}){
    let busy=false,pending=null,history=[],controller=null;
    async function run({locale}={}){
      if(busy)return{ok:false,state:'busy'};
      if(typeof locale!=='string'||!locale)return{ok:false,state:'invalid',reason:'locale_required'};
      busy=true;controller=new AbortController();const active=controller;
      let text,targetLocale=locale,inputSource='browser-speech';
      try{
        if(pending){
          text=pending.text;targetLocale=pending.locale;inputSource=pending.inputSource;pending=null;
          onState('language-confirmed',{locale:targetLocale,transcript:text});
        }else{
          onState('listening',{locale});
          text=String(await capture(locale,active.signal)||'').replace(/\s+/g,' ').trim().slice(0,1800);
          active.signal.throwIfAborted();
          if(!text)throw new Error('empty_transcript');
          const candidate=hint(text,locale);
          if(candidate&&candidate!==locale){
            pending={text,locale:candidate,inputSource};
            const out={ok:true,state:'confirm-language',locale:candidate,transcript:text,learning:false,deviceE2eVerified:false};
            onState('confirm-language',out);return out;
          }
        }
        onState('thinking',{locale:targetLocale,transcript:text});
        const result=await request({text,locale:targetLocale,inputSource,history:cleanHistory(history)},active.signal);
        active.signal.throwIfAborted();
        if(!result||result.ok!==true||result.state!=='reply-ready')throw new Error(result?.reason||result?.error||'mobile_language_reply_unavailable');
        if(result.locale!==targetLocale)throw new Error('mobile_reply_locale_mismatch');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        history=cleanHistory([...history,{role:'user',content:text},{role:'assistant',content:result.reply}]);
        const completed={...result,state:'completed',nextLocale:targetLocale,historyCommitted:true,learning:false,deviceE2eVerified:false};
        onState('completed',completed);return completed;
      }catch(error){
        if(!active.signal.aborted)onState('error',{error:String(error.message||error)});
        return{ok:false,cancelled:active.signal.aborted,error:String(error.message||error),learning:false,deviceE2eVerified:false};
      }finally{
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    function cancel(){controller?.abort();return{ok:true,cancelled:true}}
    function clearPending(){pending=null}
    return{run,cancel,clearPending,get busy(){return busy},get pendingLocale(){return pending?.locale||null},get history(){return cleanHistory(history)}};
  }
  return{safeLanguageHint,cleanHistory,createClient};
});
