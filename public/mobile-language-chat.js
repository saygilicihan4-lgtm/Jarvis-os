(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMobileLanguageChat=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const PREFERENCE_KEY='jarvisMobileLanguagePreferenceV1';
  const TTS_EVIDENCE_KEY='jarvisMobileTtsEvidenceV1';
  const TTS_NEGATIVE_EVIDENCE_KEY='jarvisMobileTtsNegativeEvidenceV1';
  const TTS_EVIDENCE_TTL_MS=5*60*1000;
  const TTS_NEGATIVE_EVIDENCE_TTL_MS=60*1000;
  const DEFAULT_CAPTURE_TIMEOUT_MS=20000;
  const RUNTIME_TTS_INVALIDATION_REASONS=new Set(['tts_locale_not_in_runtime_inventory','runtime_tts_locale_ambiguous']);
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
  function cleanEvidenceEntry(entry,nowMs){
    if(!entry||typeof entry!=='object')return null;
    const requestedLocale=canonicalLocale(entry.requestedLocale),ttsLocale=canonicalLocale(entry.ttsLocale);
    const verifiedAt=Number(entry.verifiedAt),expiresAt=Number(entry.expiresAt);
    const localeResolution=String(entry.localeResolution||'');
    const provider=String(entry.provider||'').slice(0,60),voice=String(entry.voice||'').slice(0,200);
    if(!requestedLocale||!ttsLocale||!Number.isFinite(verifiedAt)||!Number.isFinite(expiresAt))return null;
    if(verifiedAt>nowMs||expiresAt!==verifiedAt+TTS_EVIDENCE_TTL_MS||nowMs<verifiedAt||nowMs>expiresAt)return null;
    if(provider!=='edge-tts'||!voice||!['exact','unique_runtime_language_match'].includes(localeResolution))return null;
    if(ttsLocale!==requestedLocale){
      if(requestedLocale.includes('-')||ttsLocale.split('-')[0]!==requestedLocale||localeResolution!=='unique_runtime_language_match')return null;
    }else if(localeResolution!=='exact')return null;
    return{requestedLocale,ttsLocale,provider,voice,localeResolution,verifiedAt,expiresAt,ttsVerified:true,sttVerified:false,evidence:'runtime_inventory_plus_playback',deviceE2eVerified:false};
  }
  function readTtsEvidence(storage=defaultStorage(),nowMs=Date.now()){
    if(!validStorage(storage)||!Number.isFinite(nowMs))return[];
    try{
      const raw=JSON.parse(storage.getItem(TTS_EVIDENCE_KEY)||'[]');
      const entries=(Array.isArray(raw)?raw:[]).map(x=>cleanEvidenceEntry(x,nowMs)).filter(Boolean).sort((a,b)=>b.verifiedAt-a.verifiedAt).slice(0,32);
      if(entries.length)storage.setItem(TTS_EVIDENCE_KEY,JSON.stringify(entries));else storage.removeItem(TTS_EVIDENCE_KEY);
      return entries;
    }catch(_){try{storage.removeItem(TTS_EVIDENCE_KEY)}catch(__){}return[]}
  }
  function getTtsEvidence(locale,storage=defaultStorage(),nowMs=Date.now()){
    const normalized=canonicalLocale(locale);if(!normalized)return null;
    return readTtsEvidence(storage,nowMs).find(x=>x.requestedLocale===normalized)||null;
  }
  function recordTtsEvidence(storage,result,requestedLocale,playbackLocale,nowMs=Date.now()){
    if(!validStorage(storage)||!Number.isFinite(nowMs)||!result||result.speechEvidence!=='runtime_inventory')return null;
    const requested=canonicalLocale(requestedLocale),ttsLocale=canonicalLocale(playbackLocale),provider=String(result.provider||''),voice=String(result.voice||'');
    const localeResolution=String(result.localeResolution||'');
    if(!requested||!ttsLocale||provider!=='edge-tts'||!voice)return null;
    const candidate=cleanEvidenceEntry({requestedLocale:requested,ttsLocale,provider,voice,localeResolution,verifiedAt:nowMs,expiresAt:nowMs+TTS_EVIDENCE_TTL_MS},nowMs);
    if(!candidate)return null;
    try{
      const remaining=readTtsEvidence(storage,nowMs).filter(x=>x.requestedLocale!==requested);
      storage.setItem(TTS_EVIDENCE_KEY,JSON.stringify([candidate,...remaining].slice(0,32)));
      return candidate;
    }catch(_){return null}
  }
  function invalidateTtsEvidence(storage,locale,nowMs=Date.now()){
    const normalized=canonicalLocale(locale);
    if(!validStorage(storage)||!normalized||!Number.isFinite(nowMs))return false;
    try{
      const entries=readTtsEvidence(storage,nowMs),remaining=entries.filter(x=>x.requestedLocale!==normalized);
      if(remaining.length===entries.length)return false;
      if(remaining.length)storage.setItem(TTS_EVIDENCE_KEY,JSON.stringify(remaining));else storage.removeItem(TTS_EVIDENCE_KEY);
      return true;
    }catch(_){return false}
  }
  function shouldInvalidateTtsEvidence(reason){return RUNTIME_TTS_INVALIDATION_REASONS.has(String(reason||''))}
  function cleanNegativeEvidenceEntry(entry,nowMs){
    if(!entry||typeof entry!=='object')return null;
    const requestedLocale=canonicalLocale(entry.requestedLocale),reason=String(entry.reason||'');
    const observedAt=Number(entry.observedAt),expiresAt=Number(entry.expiresAt);
    if(!requestedLocale||!shouldInvalidateTtsEvidence(reason)||!Number.isFinite(observedAt)||!Number.isFinite(expiresAt))return null;
    if(observedAt>nowMs||expiresAt!==observedAt+TTS_NEGATIVE_EVIDENCE_TTL_MS||nowMs<observedAt||nowMs>expiresAt)return null;
    let state='unsupported',ttsCandidates=[];
    if(reason==='runtime_tts_locale_ambiguous'){
      if(requestedLocale.includes('-'))return null;
      ttsCandidates=[...new Set((Array.isArray(entry.ttsCandidates)?entry.ttsCandidates:[]).map(canonicalLocale).filter(Boolean).filter(x=>x.split('-')[0]===requestedLocale))].sort().slice(0,8);
      if(ttsCandidates.length<2)return null;
      state='ambiguous';
    }
    return{requestedLocale,reason,state,ttsCandidates,observedAt,expiresAt,ttsVerified:false,sttVerified:false,evidence:'unsupported_runtime_response',deviceE2eVerified:false};
  }
  function readNegativeTtsEvidence(storage=defaultStorage(),nowMs=Date.now()){
    if(!validStorage(storage)||!Number.isFinite(nowMs))return[];
    try{
      const raw=JSON.parse(storage.getItem(TTS_NEGATIVE_EVIDENCE_KEY)||'[]');
      const entries=(Array.isArray(raw)?raw:[]).map(x=>cleanNegativeEvidenceEntry(x,nowMs)).filter(Boolean).sort((a,b)=>b.observedAt-a.observedAt).slice(0,32);
      if(entries.length)storage.setItem(TTS_NEGATIVE_EVIDENCE_KEY,JSON.stringify(entries));else storage.removeItem(TTS_NEGATIVE_EVIDENCE_KEY);
      return entries;
    }catch(_){try{storage.removeItem(TTS_NEGATIVE_EVIDENCE_KEY)}catch(__){}return[]}
  }
  function getNegativeTtsEvidence(locale,storage=defaultStorage(),nowMs=Date.now()){
    const normalized=canonicalLocale(locale);if(!normalized)return null;
    return readNegativeTtsEvidence(storage,nowMs).find(x=>x.requestedLocale===normalized)||null;
  }
  function clearNegativeTtsEvidence(storage,locale,nowMs=Date.now()){
    const normalized=canonicalLocale(locale);
    if(!validStorage(storage)||!normalized||!Number.isFinite(nowMs))return false;
    try{
      const entries=readNegativeTtsEvidence(storage,nowMs),remaining=entries.filter(x=>x.requestedLocale!==normalized);
      if(remaining.length===entries.length)return false;
      if(remaining.length)storage.setItem(TTS_NEGATIVE_EVIDENCE_KEY,JSON.stringify(remaining));else storage.removeItem(TTS_NEGATIVE_EVIDENCE_KEY);
      return true;
    }catch(_){return false}
  }
  function recordNegativeTtsEvidence(storage,result,requestedLocale,nowMs=Date.now()){
    if(!validStorage(storage)||!Number.isFinite(nowMs)||!result||result.ok!==false||result.state!=='unsupported')return null;
    const requested=canonicalLocale(requestedLocale),reason=String(result.reason||result.error||'');
    if(!requested||!shouldInvalidateTtsEvidence(reason))return null;
    const candidate=cleanNegativeEvidenceEntry({requestedLocale:requested,reason,ttsCandidates:result.ttsCandidates,observedAt:nowMs,expiresAt:nowMs+TTS_NEGATIVE_EVIDENCE_TTL_MS},nowMs);
    if(!candidate)return null;
    try{
      const remaining=readNegativeTtsEvidence(storage,nowMs).filter(x=>x.requestedLocale!==requested);
      storage.setItem(TTS_NEGATIVE_EVIDENCE_KEY,JSON.stringify([candidate,...remaining].slice(0,32)));
      return candidate;
    }catch(_){return null}
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
  function resolvePlaybackLocale(result,targetLocale){
    const requested=canonicalLocale(targetLocale),declared=result&&result.ttsLocale==null?requested:canonicalLocale(result&&result.ttsLocale);
    if(!requested||!declared)throw new Error('mobile_tts_locale_invalid');
    if(declared===requested)return declared;
    const uniqueBareMatch=!requested.includes('-')&&declared.split('-')[0]===requested&&result.localeResolution==='unique_runtime_language_match'&&result.speechEvidence==='runtime_inventory';
    if(!uniqueBareMatch)throw new Error('mobile_tts_locale_evidence_mismatch');
    return declared;
  }
  function renderLocaleOptions(list,storage=defaultStorage(),nowMs=Date.now()){
    if(!list)return false;
    while(list.firstChild)list.removeChild(list.firstChild);
    const positives=new Map(readTtsEvidence(storage,nowMs).map(x=>[x.requestedLocale,x]));
    const negatives=new Map(readNegativeTtsEvidence(storage,nowMs).map(x=>[x.requestedLocale,x]));
    for(const [value,label] of COMMON_LOCALES){
      const option=(list.ownerDocument||root&&root.document).createElement('option');option.value=value;
      const positive=positives.get(value),negative=negatives.get(value);
      const negativeIsNewer=negative&&(!positive||negative.observedAt>=positive.verifiedAt);
      if(negativeIsNewer&&negative.state==='unsupported')option.label=label+' · TTS ✕ son 1 dk · runtime desteklemiyor';
      else if(negativeIsNewer&&negative.state==='ambiguous')option.label=label+' · TTS ! son 1 dk · bölge seçin';
      else if(positive)option.label=label+' · TTS ✓ son 5 dk';
      else option.label=label+' · TTS ? ilk kullanımda kontrol';
      list.appendChild(option);
    }
    return true;
  }
  function createClient({capture,request,play,onState=()=>{},onReply=()=>{},hint=safeLanguageHint,storage=defaultStorage(),captureTimeoutMs=DEFAULT_CAPTURE_TIMEOUT_MS,now=Date.now}={}){
    let busy=false,pending=null,history=[],controller=null,preferredLocale=readPreference(storage),explicitLocale=canonicalLocale(stagedExplicitLocale);
    async function run({locale}={}){
      if(busy)return{ok:false,state:'busy'};
      const requestedLocale=canonicalLocale(locale);
      if(!requestedLocale)return{ok:false,state:'invalid',reason:'locale_required'};
      busy=true;controller=new AbortController();const active=controller;
      const selectedLocale=canonicalLocale(explicitLocale);
      let text,targetLocale=selectedLocale||preferredLocale||requestedLocale,inputSource='browser-speech',confirmedSwitch=false,preferenceEvidence=null,runtimeTtsNegativeResult=null;
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
        if(!result||result.ok!==true||result.state!=='reply-ready'){
          const reason=result?.reason||result?.error||'mobile_language_reply_unavailable';
          if(result&&result.ok===false&&result.state==='unsupported'&&shouldInvalidateTtsEvidence(reason))runtimeTtsNegativeResult=result;
          throw new Error(reason);
        }
        if(canonicalLocale(result.locale)!==targetLocale)throw new Error('mobile_reply_locale_mismatch');
        const playbackLocale=resolvePlaybackLocale(result,targetLocale);
        onReply(result);onState('playing',{...result,ttsLocale:playbackLocale});
        await play({...result,locale:playbackLocale,conversationLocale:targetLocale,ttsLocale:playbackLocale},active.signal);
        active.signal.throwIfAborted();
        const nowMs=Number(now());
        clearNegativeTtsEvidence(storage,targetLocale,nowMs);
        const runtimeTtsEvidence=recordTtsEvidence(storage,result,targetLocale,playbackLocale,nowMs);
        if(root&&root.document)renderLocaleOptions(root.document.getElementById('jarvisMobileLocaleList'),storage,nowMs);
        history=cleanHistory([...history,{role:'user',content:text},{role:'assistant',content:result.reply}]);
        let preferenceSaved=false;
        if(selectedLocale){
          preferenceSaved=savePreference(storage,targetLocale);
          if(preferenceSaved){preferredLocale=targetLocale;explicitLocale=null;if(stagedExplicitLocale===targetLocale)stagedExplicitLocale=null}
          preferenceEvidence=preferenceSaved?'explicit-picker-plus-playback':null;
        }else if(confirmedSwitch){
          preferenceSaved=savePreference(storage,targetLocale);if(preferenceSaved)preferredLocale=targetLocale;
        }
        const completed={...result,state:'completed',nextLocale:targetLocale,ttsLocale:playbackLocale,historyCommitted:true,learning:false,automaticLearning:false,
          preferenceSaved,preferenceLocale:preferredLocale,preferenceEvidence:preferenceSaved?preferenceEvidence:null,
          runtimeTtsVerified:!!runtimeTtsEvidence,runtimeTtsEvidence,runtimeTtsNegativeEvidence:null,sttVerified:false,deviceE2eVerified:false};
        onState('completed',completed);return completed;
      }catch(error){
        const rawMessage=String(error&&error.message||error),timedOut=rawMessage==='browser_stt_timeout';
        const cancelled=active.signal.aborted&&!timedOut,message=cancelled?'mobile_language_cancelled':rawMessage;
        const nowMs=Number(now());
        const provenanceMatches=!cancelled&&runtimeTtsNegativeResult&&String(runtimeTtsNegativeResult.reason||runtimeTtsNegativeResult.error||'')===message;
        const runtimeTtsEvidenceInvalidated=!!(provenanceMatches&&invalidateTtsEvidence(storage,targetLocale,nowMs));
        const runtimeTtsNegativeEvidence=provenanceMatches?recordNegativeTtsEvidence(storage,runtimeTtsNegativeResult,targetLocale,nowMs):null;
        if((runtimeTtsEvidenceInvalidated||runtimeTtsNegativeEvidence)&&root&&root.document)renderLocaleOptions(root.document.getElementById('jarvisMobileLocaleList'),storage,nowMs);
        if(!cancelled)onState('error',{error:message,runtimeTtsEvidenceInvalidated,runtimeTtsNegativeEvidence});
        return{ok:false,cancelled,error:message,learning:false,preferenceSaved:false,preferenceLocale:preferredLocale,runtimeTtsVerified:false,runtimeTtsEvidenceInvalidated,runtimeTtsNegativeEvidence,sttVerified:false,deviceE2eVerified:false};
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
      const nowMs=Number(now());
      return{ok:true,locale:normalized,persisted:false,evidence:'explicit-user-selection-pending-playback',runtimeTtsEvidence:getTtsEvidence(normalized,storage,nowMs),runtimeTtsNegativeEvidence:getNegativeTtsEvidence(normalized,storage,nowMs)};
    }
    function forgetPreference(){preferredLocale=null;explicitLocale=null;stagedExplicitLocale=null;return clearPreference(storage)}
    const client={run,cancel,clearPending,selectLocale,forgetPreference,get busy(){return busy},get pendingLocale(){return pending?.locale||null},
      get selectedLocale(){return explicitLocale},get preferredLocale(){return preferredLocale},get runtimeTtsEvidence(){return readTtsEvidence(storage,Number(now()))},get runtimeTtsNegativeEvidence(){return readNegativeTtsEvidence(storage,Number(now()))},get history(){return cleanHistory(history)}};
    activeClient=client;return client;
  }
  function requestExplicitLocale(locale){
    const normalized=canonicalLocale(locale);if(!normalized)return{ok:false,reason:'invalid_locale'};
    if(activeClient)return activeClient.selectLocale(normalized);
    stagedExplicitLocale=normalized;
    return{ok:true,locale:normalized,persisted:false,evidence:'explicit-user-selection-pending-playback',runtimeTtsEvidence:getTtsEvidence(normalized),runtimeTtsNegativeEvidence:getNegativeTtsEvidence(normalized)};
  }
  function installLocalePicker(doc=root&&root.document){
    if(!doc||!root||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return false;
    if(doc.getElementById('jarvisMobileLocalePicker'))return true;
    const chatButton=doc.getElementById('languageChatBtn');if(!chatButton||!chatButton.parentNode)return false;
    const wrap=doc.createElement('span');wrap.id='jarvisMobileLocalePicker';wrap.style.cssText='display:inline-flex;gap:5px;align-items:center;margin-left:7px;vertical-align:middle';
    const input=doc.createElement('input');input.id='jarvisMobileLocaleInput';input.setAttribute('list','jarvisMobileLocaleList');input.setAttribute('aria-label','Konuşma dili BCP-47 kodu');input.placeholder='Dil: tr-TR';input.maxLength=35;input.autocapitalize='off';input.autocomplete='off';input.style.cssText='width:110px;background:#061018;color:#b9f4ff;border:1px solid rgba(101,230,255,.45);border-radius:5px;padding:6px;font-size:11px';
    const list=doc.createElement('datalist');list.id='jarvisMobileLocaleList';renderLocaleOptions(list,defaultStorage(),Date.now());
    const button=doc.createElement('button');button.type='button';button.textContent='DİL';button.className='send';button.style.cssText='padding:6px 8px;font-size:10px';
    button.addEventListener('click',()=>{
      const result=requestExplicitLocale(input.value),status=doc.getElementById('languageChatStatus');
      if(!status)return;
      if(!result.ok){status.textContent=result.reason==='mobile_language_busy'?'Konuşma sürerken dil değiştirilemez.':'Geçerli bir dil kodu girin (örn. tr-TR, en-US).';return}
      const negative=result.runtimeTtsNegativeEvidence;
      if(result.runtimeTtsEvidence){status.textContent='Dil isteği: '+result.locale+' · TTS son 5 dk içinde runtime + playback ile doğrulandı; STT tarayıcıya bağlı.';return}
      if(negative&&negative.state==='unsupported'){status.textContent='Dil isteği: '+result.locale+' · TTS son 1 dk içinde runtime tarafından desteklenmedi; daha sonra yeniden denenebilir.';return}
      if(negative&&negative.state==='ambiguous'){
        const choices=negative.ttsCandidates.length?' ('+negative.ttsCandidates.join(', ')+')':'';
        status.textContent='Dil isteği: '+result.locale+' · TTS bölgesi belirsiz; bölge kodu seçin'+choices+'.';return;
      }
      status.textContent='Dil isteği: '+result.locale+' · TTS ilk başarılı yanıtta runtime kontrol edilecek; STT tarayıcıya bağlı.';
    });
    wrap.append(input,button,list);chatButton.parentNode.appendChild(wrap);return true;
  }
  if(root&&root.document){const start=()=>installLocalePicker(root.document);if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else setTimeout(start,0)}
  return{PREFERENCE_KEY,TTS_EVIDENCE_KEY,TTS_NEGATIVE_EVIDENCE_KEY,TTS_EVIDENCE_TTL_MS,TTS_NEGATIVE_EVIDENCE_TTL_MS,DEFAULT_CAPTURE_TIMEOUT_MS,COMMON_LOCALES,RUNTIME_TTS_INVALIDATION_REASONS,canonicalLocale,safeLanguageHint,cleanHistory,readPreference,savePreference,clearPreference,
    cleanEvidenceEntry,readTtsEvidence,getTtsEvidence,recordTtsEvidence,invalidateTtsEvidence,shouldInvalidateTtsEvidence,cleanNegativeEvidenceEntry,readNegativeTtsEvidence,getNegativeTtsEvidence,recordNegativeTtsEvidence,clearNegativeTtsEvidence,captureWithTimeout,resolvePlaybackLocale,renderLocaleOptions,createClient,requestExplicitLocale,installLocalePicker};
});