(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMobileLanguageChat=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const PREFERENCE_KEY='jarvisMobileLanguagePreferenceV1';
  const DEFAULT_CAPTURE_TIMEOUT_MS=20000;
  const COMMON_LOCALES=[
    ['tr-TR','Türkçe'],['en-US','English (US)'],['en-GB','English (UK)'],['de-DE','Deutsch'],['fr-FR','Français'],
    ['es-ES','Español'],['it-IT','Italiano'],['pt-BR','Português (Brasil)'],['pt-PT','Português (Portugal)'],['nl-NL','Nederlands'],
    ['pl-PL','Polski'],['ru-RU','Русский'],['uk-UA','Українська'],['ar-SA','العربية'],['hi-IN','हिन्दी'],
    ['ja-JP','日本語'],['ko-KR','한국어'],['zh-CN','中文 (简体)'],['zh-TW','中文 (繁體)'],['id-ID','Bahasa Indonesia']
  ];
  let activeClient=null,stagedExplicitLocale=null;
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
    let busy=false,pending=null,history=[],controller=null,preferredLocale=readPreference(storage),explicitLocale=canonicalLocale(stagedExplicitLocale);
    async function run({locale}={}){
      if(busy)return{ok:false,state:'busy'};
      const requestedLocale=canonicalLocale(locale);
      if(!requestedLocale)return{ok:false,state:'invalid',reason:'locale_required'};
      busy=true;controller=new AbortController();const active=controller;
      const selectedLocale=canonicalLocale(explicitLocale);
      let text,targetLocale=selectedLocale||preferredLocale||requestedLocale,inputSource='browser-speech',confirmedSwitch=false,preferenceEvidence=null;
      try{
        if(pending){
          text=pending.text;targetLocale=pending.locale;inputSource=pending.inputSource;pending=null;confirmedSwitch=true;preferenceEvidence='explicit-confirmation-plus-playback';
          onState('language-confirmed',{locale:targetLocale,transcript:text,explicit:true});
        }else{
          onState('listening',{locale:targetLocale,preferenceUsed:!!preferredLocale,explicitSelection:!!selectedLocale});
          text=String(await captureWithTimeout(capture,targetLocale,active,captureTimeoutMs)||'').replace(/\s+/g,' ').trim().slice(0,1800);
          active.signal.throwIfAborted();
          if(!text)throw new Error('empty_transcript');
          const candidate=canonicalLocale(hint(text,targetLocale));
          if(!selectedLocale&&candidate&&candidate!==targetLocale){
            pending={text,locale:candidate,inputSource};
            const out={ok:true,state:'confirm-language',locale:candidate,transcript:text,learning:false,preferenceSaved:false,deviceE2eVerified:false};
            onState('confirm-language',out);return out;
          }
        }
        onState('thinking',{locale:targetLocale,transcript:text,explicitSelection:!!selectedLocale});
        const result=await request({text,locale:targetLocale,inputSource,history:cleanHistory(history)},active.signal);
        active.signal.throwIfAborted();
        if(!result||result.ok!==true||result.state!=='reply-ready')throw new Error(result?.reason||result?.error||'mobile_language_reply_unavailable');
        if(canonicalLocale(result.locale)!==targetLocale)throw new Error('mobile_reply_locale_mismatch');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        history=cleanHistory([...history,{role:'user',content:text},{role:'assistant',content:result.reply}]);
        let preferenceSaved=false;
        if(selectedLocale){
          preferenceSaved=savePreference(storage,targetLocale);
          if(preferenceSaved){preferredLocale=targetLocale;explicitLocale=null;if(stagedExplicitLocale===targetLocale)stagedExplicitLocale=null}
          preferenceEvidence=preferenceSaved?'explicit-picker-plus-playback':null;
        }else if(confirmedSwitch){
          preferenceSaved=savePreference(storage,targetLocale);if(preferenceSaved)preferredLocale=targetLocale;
        }
        const completed={...result,state:'completed',nextLocale:targetLocale,historyCommitted:true,learning:false,automaticLearning:false,
          preferenceSaved,preferenceLocale:preferredLocale,preferenceEvidence:preferenceSaved?preferenceEvidence:null,deviceE2eVerified:false};
        onState('completed',completed);return completed;
      }catch(error){
        const rawMessage=String(error&&error.message||error),timedOut=rawMessage==='browser_stt_timeout';
        const cancelled=active.signal.aborted&&!timedOut,message=cancelled?'mobile_language_cancelled':rawMessage;
        if(!cancelled)onState('error',{error:message});
        return{ok:false,cancelled,error:message,learning:false,preferenceSaved:false,preferenceLocale:preferredLocale,deviceE2eVerified:false};
      }finally{
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    function cancel(){controller?.abort();pending=null;return{ok:true,cancelled:true,pendingCleared:true}}
    function clearPending(){pending=null}
    function selectLocale(locale){
      if(busy)return{ok:false,reason:'mobile_language_busy'};
      const normalized=canonicalLocale(locale);if(!normalized)return{ok:false,reason:'invalid_locale'};
      pending=null;explicitLocale=normalized;stagedExplicitLocale=normalized;
      return{ok:true,locale:normalized,persisted:false,evidence:'explicit-user-selection-pending-playback'};
    }
    function forgetPreference(){preferredLocale=null;explicitLocale=null;stagedExplicitLocale=null;return clearPreference(storage)}
    const client={run,cancel,clearPending,selectLocale,forgetPreference,get busy(){return busy},get pendingLocale(){return pending?.locale||null},
      get selectedLocale(){return explicitLocale},get preferredLocale(){return preferredLocale},get history(){return cleanHistory(history)}};
    activeClient=client;return client;
  }
  function requestExplicitLocale(locale){
    const normalized=canonicalLocale(locale);if(!normalized)return{ok:false,reason:'invalid_locale'};
    stagedExplicitLocale=normalized;
    if(activeClient){const result=activeClient.selectLocale(normalized);if(!result.ok)return result}
    return{ok:true,locale:normalized,persisted:false,evidence:'explicit-user-selection-pending-playback'};
  }
  function installLocalePicker(doc=root&&root.document){
    if(!doc||!root||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return false;
    if(doc.getElementById('jarvisMobileLocalePicker'))return true;
    const chatButton=doc.getElementById('languageChatBtn');if(!chatButton||!chatButton.parentNode)return false;
    const wrap=doc.createElement('span');wrap.id='jarvisMobileLocalePicker';wrap.style.cssText='display:inline-flex;gap:5px;align-items:center;margin-left:7px;vertical-align:middle';
    const input=doc.createElement('input');input.id='jarvisMobileLocaleInput';input.setAttribute('list','jarvisMobileLocaleList');input.setAttribute('aria-label','Konuşma dili BCP-47 kodu');input.placeholder='Dil: tr-TR';input.maxLength=35;input.autocapitalize='off';input.autocomplete='off';input.style.cssText='width:110px;background:#061018;color:#b9f4ff;border:1px solid rgba(101,230,255,.45);border-radius:5px;padding:6px;font-size:11px';
    const list=doc.createElement('datalist');list.id='jarvisMobileLocaleList';for(const [value,label] of COMMON_LOCALES){const option=doc.createElement('option');option.value=value;option.label=label;list.appendChild(option)}
    const button=doc.createElement('button');button.type='button';button.textContent='DİL';button.className='send';button.style.cssText='padding:6px 8px;font-size:10px';
    button.addEventListener('click',()=>{
      const result=requestExplicitLocale(input.value);
      const status=doc.getElementById('languageChatStatus');
      if(status)status.textContent=result.ok?'Dil isteği: '+result.locale+' · başarılı ses yanıtından sonra kaydedilecek.':'Geçerli bir dil kodu girin (örn. tr-TR, en-US).';
    });
    wrap.append(input,button,list);chatButton.parentNode.appendChild(wrap);return true;
  }
  if(root&&root.document){const start=()=>installLocalePicker(root.document);if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else setTimeout(start,0)}
  return{PREFERENCE_KEY,DEFAULT_CAPTURE_TIMEOUT_MS,COMMON_LOCALES,canonicalLocale,safeLanguageHint,cleanHistory,readPreference,savePreference,clearPreference,captureWithTimeout,createClient,requestExplicitLocale,installLocalePicker};
});
