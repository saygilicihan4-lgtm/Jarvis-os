(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMobileLanguageChat=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const PREFERENCE_KEY='jarvisMobileLanguagePreferenceV1';
  const DEFAULT_CAPTURE_TIMEOUT_MS=20000;
  function canonicalLocale(value){
    if(typeof value!=='string')return null;
    const input=value.trim().replace(/_/g,'-');
    if(!input||input.length>64||!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(input))return null;
    try{const locale=Intl.getCanonicalLocales(input)[0];return locale==='und'?null:locale}catch(_){return null}
  }
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
  function defaultStorage(){
    try{return root&&root.localStorage&&typeof root.localStorage.getItem==='function'?root.localStorage:null}catch(_){return null}
  }
  function validStorage(storage){return !!storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'&&typeof storage.removeItem==='function'}
  function readPreference(storage=defaultStorage()){
    if(!validStorage(storage))return null;
    try{
      const locale=canonicalLocale(storage.getItem(PREFERENCE_KEY));
      if(!locale&&storage.getItem(PREFERENCE_KEY)!=null)storage.removeItem(PREFERENCE_KEY);
      return locale;
    }catch(_){return null}
  }
  function savePreference(storage,locale){
    const normalized=canonicalLocale(locale);
    if(!validStorage(storage)||!normalized)return false;
    try{storage.setItem(PREFERENCE_KEY,normalized);return true}catch(_){return false}
  }
  function clearPreference(storage=defaultStorage()){
    if(!validStorage(storage))return false;
    try{storage.removeItem(PREFERENCE_KEY);return true}catch(_){return false}
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
  function createClient({capture,request,play,onState=()=>{},onReply=()=>{},hint=safeLanguageHint,storage=defaultStorage(),captureTimeoutMs=DEFAULT_CAPTURE_TIMEOUT_MS}={}){
    let busy=false,pending=null,history=[],controller=null,preferredLocale=readPreference(storage);
    async function run({locale}={}){
      if(busy)return{ok:false,state:'busy'};
      const requestedLocale=canonicalLocale(locale);
      if(!requestedLocale)return{ok:false,state:'invalid',reason:'locale_required'};
      busy=true;controller=new AbortController();const active=controller;
      let text,targetLocale=preferredLocale||requestedLocale,inputSource='browser-speech',confirmedSwitch=false;
      try{
        if(pending){
          text=pending.text;targetLocale=pending.locale;inputSource=pending.inputSource;pending=null;confirmedSwitch=true;
          onState('language-confirmed',{locale:targetLocale,transcript:text,explicit:true});
        }else{
          onState('listening',{locale:targetLocale,preferenceUsed:!!preferredLocale});
          text=String(await captureWithTimeout(capture,targetLocale,active,captureTimeoutMs)||'').replace(/\s+/g,' ').trim().slice(0,1800);
          active.signal.throwIfAborted();
          if(!text)throw new Error('empty_transcript');
          const candidate=canonicalLocale(hint(text,targetLocale));
          if(candidate&&candidate!==targetLocale){
            pending={text,locale:candidate,inputSource};
            const out={ok:true,state:'confirm-language',locale:candidate,transcript:text,learning:false,preferenceSaved:false,deviceE2eVerified:false};
            onState('confirm-language',out);return out;
          }
        }
        onState('thinking',{locale:targetLocale,transcript:text});
        const result=await request({text,locale:targetLocale,inputSource,history:cleanHistory(history)},active.signal);
        active.signal.throwIfAborted();
        if(!result||result.ok!==true||result.state!=='reply-ready')throw new Error(result?.reason||result?.error||'mobile_language_reply_unavailable');
        if(canonicalLocale(result.locale)!==targetLocale)throw new Error('mobile_reply_locale_mismatch');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        history=cleanHistory([...history,{role:'user',content:text},{role:'assistant',content:result.reply}]);
        let preferenceSaved=false;
        if(confirmedSwitch){preferenceSaved=savePreference(storage,targetLocale);if(preferenceSaved)preferredLocale=targetLocale}
        const completed={...result,state:'completed',nextLocale:targetLocale,historyCommitted:true,learning:false,automaticLearning:false,
          preferenceSaved,preferenceLocale:preferredLocale,preferenceEvidence:preferenceSaved?'explicit-confirmation-plus-playback':null,deviceE2eVerified:false};
        onState('completed',completed);return completed;
      }catch(error){
        const message=String(error&&error.message||error),timedOut=message==='browser_stt_timeout';
        if(!active.signal.aborted||timedOut)onState('error',{error:message});
        return{ok:false,cancelled:active.signal.aborted&&!timedOut,error:message,learning:false,preferenceSaved:false,deviceE2eVerified:false};
      }finally{
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    function cancel(){controller?.abort();pending=null;return{ok:true,cancelled:true,pendingCleared:true}}
    function clearPending(){pending=null}
    function forgetPreference(){preferredLocale=null;return clearPreference(storage)}
    return{run,cancel,clearPending,forgetPreference,get busy(){return busy},get pendingLocale(){return pending?.locale||null},
      get preferredLocale(){return preferredLocale},get history(){return cleanHistory(history)}};
  }
  return{PREFERENCE_KEY,DEFAULT_CAPTURE_TIMEOUT_MS,canonicalLocale,safeLanguageHint,cleanHistory,readPreference,savePreference,clearPreference,captureWithTimeout,createClient};
});
