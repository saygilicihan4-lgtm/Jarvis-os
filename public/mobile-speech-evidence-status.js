(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mobile-language-chat'));
  else root.JarvisMobileSpeechEvidenceStatus=factory(root&&root.JarvisMobileLanguageChat);
})(typeof globalThis==='object'?globalThis:this,function(chat){
  'use strict';
  function requireChat(){
    if(!chat||typeof chat.canonicalLocale!=='function')throw new Error('mobile_language_chat_required');
    return chat;
  }
  function freshnessFor(evidence,now){
    if(!evidence||typeof evidence!=='object'||!Number.isFinite(now))return null;
    const observedAt=Number(
      evidence.verifiedAt!=null?evidence.verifiedAt:
      evidence.observedAt!=null?evidence.observedAt:
      evidence.capturedAt
    );
    const expiresAt=Number(evidence.expiresAt);
    if(!Number.isFinite(observedAt)||!Number.isFinite(expiresAt)||observedAt>now||expiresAt<now||expiresAt<observedAt)return null;
    return{observedAt,expiresAt,remainingMs:Math.max(0,expiresAt-now),temporary:true};
  }
  function summarize(locale,{storage,nowMs=Date.now()}={}){
    const api=requireChat(),normalized=api.canonicalLocale(locale);
    if(!normalized||!Number.isFinite(Number(nowMs)))return null;
    const now=Number(nowMs);
    const positive=api.getTtsEvidence(normalized,storage,now);
    const negative=api.getNegativeTtsEvidence(normalized,storage,now);
    const capture=api.getSttCaptureEvidence(normalized,storage,now);
    const preference=api.readPreference(storage);
    const negativeIsNewer=!!(negative&&(!positive||Number(negative.observedAt)>=Number(positive.verifiedAt)));
    let ttsState='unknown',ttsEvidence=null;
    if(negativeIsNewer){
      ttsState=negative.state==='ambiguous'?'ambiguous':'unsupported';
      ttsEvidence=negative;
    }else if(positive){
      ttsState='verified';
      ttsEvidence=positive;
    }
    const preferenceSaved=preference===normalized;
    return{
      locale:normalized,
      observedAt:now,
      tts:{state:ttsState,verified:ttsState==='verified',evidence:ttsEvidence,freshness:freshnessFor(ttsEvidence,now)},
      stt:{state:capture?'capture-observed':'unknown',captureObserved:!!capture,evidence:capture,freshness:freshnessFor(capture,now),sttVerified:false,languageVerified:false},
      preference:{state:preferenceSaved?'saved':'not-saved',saved:preferenceSaved,locale:preference||null,evidence:preferenceSaved?'device-local-locale-preference':null,provenanceVerified:false},
      automaticLearning:false,
      sttSupportVerified:false,
      preferenceProvenanceVerified:false,
      languageVerified:false,
      deviceE2eVerified:false
    };
  }
  function format(summary){
    if(!summary||!summary.locale)return'';
    const tts=summary.tts||{},stt=summary.stt||{},pref=summary.preference||{};
    let ttsText='TTS ? ilk kullanımda kontrol';
    if(tts.state==='verified')ttsText='TTS ✓ runtime + playback · geçici kanıt';
    else if(tts.state==='unsupported')ttsText='TTS ✕ runtime desteklemiyor · geçici kanıt';
    else if(tts.state==='ambiguous')ttsText='TTS ! bölge belirsiz · geçici kanıt';
    const sttText=stt.captureObserved?'STT capture ◇ gözlendi · geçici kanıt · dil doğruluğu doğrulanmadı':'STT capture ? henüz gözlenmedi';
    const prefText=pref.saved?'Tercih ◇ cihazda kayıtlı · provenance doğrulanmadı':'Tercih — kaydedilmedi';
    return summary.locale+' · '+ttsText+' · '+sttText+' · '+prefText;
  }
  function setFreshnessDataset(dataset,prefix,freshness){
    if(!dataset)return;
    dataset[prefix+'EvidenceObservedAt']=freshness?String(freshness.observedAt):'';
    dataset[prefix+'EvidenceExpiresAt']=freshness?String(freshness.expiresAt):'';
    dataset[prefix+'EvidenceRemainingMs']=freshness?String(freshness.remainingMs):'';
  }
  function render(element,locale,options={}){
    if(!element)return false;
    const summary=summarize(locale,options);if(!summary)return false;
    const text=format(summary);
    element.textContent=text;
    if(element.dataset){
      element.dataset.locale=summary.locale;
      element.dataset.ttsState=summary.tts.state;
      element.dataset.sttState=summary.stt.state;
      element.dataset.preferenceState=summary.preference.state;
      element.dataset.sttVerified='false';
      element.dataset.preferenceProvenanceVerified='false';
      element.dataset.languageVerified='false';
      element.dataset.deviceE2eVerified='false';
      setFreshnessDataset(element.dataset,'tts',summary.tts.freshness);
      setFreshnessDataset(element.dataset,'stt',summary.stt.freshness);
    }
    return summary;
  }
  return{summarize,format,render,freshnessFor};
});
