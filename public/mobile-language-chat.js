(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisMobileLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const PREFERENCE_KEY='jarvis.mobile.language.preference.v1';
  function canonicalLocale(value){
    const raw=String(value||'').trim().replace(/_/g,'-');
    if(!raw||raw.length>35)return null;
    try{
      if(typeof Intl==='object'&&Intl&&typeof Intl.getCanonicalLocales==='function'){
        const list=Intl.getCanonicalLocales(raw);
        const locale=list.length===1?list[0]:null;
        return locale&&/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)?locale:null;
      }
    }catch(_){return null}
    if(!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(raw))return null;
    return raw.split('-').map((part,index)=>{
      if(index===0)return part.toLowerCase();
      if(part.length===2)return part.toUpperCase();
      if(part.length===4)return part.slice(0,1).toUpperCase()+part.slice(1).toLowerCase();
      return part;
    }).join('-');
  }
  function defaultStorage(){
    try{return typeof localStorage!=='undefined'?localStorage:null}catch(_){return null}
  }
  function createPreferenceStore(storage,{now=Date.now}={}){
    const target=storage===undefined?defaultStorage():storage;
    function read(){
      if(!target||typeof target.getItem!=='function')return null;
      try{
        const raw=target.getItem(PREFERENCE_KEY);
        if(!raw)return null;
        const row=JSON.parse(raw),locale=canonicalLocale(row?.locale),confirmedAt=Number(row?.confirmedAt);
        if(!row||row.version!==1||row.source!=='explicit-confirmation'||!locale||!Number.isSafeInteger(confirmedAt)||confirmedAt<=0)return null;
        return{version:1,locale,source:'explicit-confirmation',confirmedAt};
      }catch(_){return null}
    }
    function write(locale){
      const normalized=canonicalLocale(locale);
      if(!normalized)return{ok:false,reason:'invalid_locale'};
      if(!target||typeof target.setItem!=='function')return{ok:false,reason:'storage_unavailable'};
      const confirmedAt=Math.floor(Number(now()));
      if(!Number.isSafeInteger(confirmedAt)||confirmedAt<=0)return{ok:false,reason:'invalid_clock'};
      const preference={version:1,locale:normalized,source:'explicit-confirmation',confirmedAt};
      try{target.setItem(PREFERENCE_KEY,JSON.stringify(preference));return{ok:true,preference}}
      catch(_){return{ok:false,reason:'storage_write_failed'}}
    }
    function clear(){
      if(!target||typeof target.removeItem!=='function')return{ok:false,reason:'storage_unavailable'};
      try{target.removeItem(PREFERENCE_KEY);return{ok:true}}catch(_){return{ok:false,reason:'storage_clear_failed'}}
    }
    return{read,write,clear,key:PREFERENCE_KEY};
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
  function createClient({capture,request,play,onState=()=>{},onReply=()=>{},hint=safeLanguageHint,preferenceStore=createPreferenceStore()}={}){
    let busy=false,pending=null,history=[],controller=null;
    function preferredLocale(){
      try{return canonicalLocale(preferenceStore?.read?.()?.locale)}catch(_){return null}
    }
    async function run({locale}={}){
      if(busy)return{ok:false,state:'busy'};
      locale=preferredLocale()||canonicalLocale(locale);
      if(!locale)return{ok:false,state:'invalid',reason:'locale_required'};
      busy=true;controller=new AbortController();const active=controller;
      let text,targetLocale=locale,inputSource='browser-speech',confirmedExplicitly=false;
      try{
        if(pending){
          text=pending.text;targetLocale=pending.locale;inputSource=pending.inputSource;pending=null;confirmedExplicitly=true;
          onState('language-confirmed',{locale:targetLocale,transcript:text});
        }else{
          onState('listening',{locale});
          text=String(await capture(locale,active.signal)||'').replace(/\s+/g,' ').trim().slice(0,1800);
          active.signal.throwIfAborted();
          if(!text)throw new Error('empty_transcript');
          const candidate=canonicalLocale(hint(text,locale));
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
        if(canonicalLocale(result.locale)!==targetLocale)throw new Error('mobile_reply_locale_mismatch');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        history=cleanHistory([...history,{role:'user',content:text},{role:'assistant',content:result.reply}]);
        let devicePreferenceSaved=false;
        if(confirmedExplicitly){
          try{devicePreferenceSaved=preferenceStore?.write?.(targetLocale)?.ok===true}catch(_){devicePreferenceSaved=false}
        }
        const completed={...result,state:'completed',nextLocale:targetLocale,historyCommitted:true,learning:false,deviceE2eVerified:false,
          devicePreferenceSaved,devicePreferenceSource:confirmedExplicitly?'explicit-confirmation':null};
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
    function clearPreference(){try{return preferenceStore?.clear?.()||{ok:false,reason:'storage_unavailable'}}catch(_){return{ok:false,reason:'storage_clear_failed'}}}
    return{run,cancel,clearPending,clearPreference,get busy(){return busy},get pendingLocale(){return pending?.locale||null},
      get preferredLocale(){return preferredLocale()},get history(){return cleanHistory(history)}};
  }
  return{PREFERENCE_KEY,canonicalLocale,createPreferenceStore,safeLanguageHint,cleanHistory,createClient};
});
