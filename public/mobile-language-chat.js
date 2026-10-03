(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisMobileLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DEFAULT_CAPTURE_TIMEOUT_MS=20000;
  function safeLanguageHint(text){
    const s=String(text||'');
    // Only emit a locale candidate for scripts that are strong enough to be
    // useful as a confirmation hint. Ambiguous script families (Latin,
    // Cyrillic, Arabic, Han-only, Devanagari, etc.) intentionally return null.
    // This is never persisted as language-learning evidence.
    if(/[\u3040-\u30ff]/.test(s))return'ja-JP';
    if(/[\uac00-\ud7af]/.test(s))return'ko-KR';
    if(/[\u0370-\u03ff]/.test(s))return'el-GR';
    if(/[\u0e00-\u0e7f]/.test(s))return'th-TH';
    if(/[\u0530-\u058f]/.test(s))return'hy-AM';
    if(/[\u10a0-\u10ff]/.test(s))return'ka-GE';
    return null;
  }
  function cleanHistory(value){
    if(!Array.isArray(value))return[];
    return value.slice(-8).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string'&&x.content.trim()).map(x=>({role:x.role,content:x.content.replace(/\s+/g,' ').trim().slice(0,1800)}));
  }
  function captureWithTimeout(capture,locale,controller,timeoutMs){
    const signal=controller.signal,limit=Number.isFinite(timeoutMs)?Math.max(5,Math.min(60000,timeoutMs)):DEFAULT_CAPTURE_TIMEOUT_MS;
    return new Promise((resolve,reject)=>{
      let settled=false,timedOut=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',onAbort);fn(value)};
      const onAbort=()=>finish(reject,new Error(timedOut?'browser_stt_timeout':'mobile_language_cancelled'));
      const timer=setTimeout(()=>{if(settled)return;timedOut=true;controller.abort()},limit);
      signal.addEventListener('abort',onAbort,{once:true});
      if(signal.aborted){onAbort();return}
      Promise.resolve().then(()=>capture(locale,signal)).then(value=>finish(resolve,value),error=>finish(reject,error instanceof Error?error:new Error(String(error||'browser_stt_failed'))));
    });
  }
  function createClient({capture,request,play,onState=()=>{},onReply=()=>{},hint=safeLanguageHint,captureTimeoutMs=DEFAULT_CAPTURE_TIMEOUT_MS}={}){
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
          text=String(await captureWithTimeout(capture,locale,active,captureTimeoutMs)||'').replace(/\s+/g,' ').trim().slice(0,1800);
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
        const message=String(error&&error.message||error),timedOut=message==='browser_stt_timeout';
        if(!active.signal.aborted||timedOut)onState('error',{error:message});
        return{ok:false,cancelled:active.signal.aborted&&!timedOut,error:message,learning:false,deviceE2eVerified:false};
      }finally{
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    function cancel(){
      pending=null;
      controller?.abort();
      return{ok:true,cancelled:true,pendingCleared:true};
    }
    function clearPending(){const had=!!pending;pending=null;return{ok:true,cleared:had}}
    return{run,cancel,clearPending,get busy(){return busy},get pendingLocale(){return pending?.locale||null},get history(){return cleanHistory(history)}};
  }
  return{DEFAULT_CAPTURE_TIMEOUT_MS,safeLanguageHint,cleanHistory,captureWithTimeout,createClient};
});
