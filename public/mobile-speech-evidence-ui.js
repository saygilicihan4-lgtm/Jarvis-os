(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mobile-language-chat'),require('./mobile-speech-evidence-status'));
  else root.JarvisMobileSpeechEvidenceUi=factory(root&&root.JarvisMobileLanguageChat,root&&root.JarvisMobileSpeechEvidenceStatus);
})(typeof globalThis==='object'?globalThis:this,function(chat,status){
  'use strict';
  function ready(){return !!(chat&&status&&typeof chat.canonicalLocale==='function'&&typeof status.render==='function')}
  function newestLocale(storage,nowMs=Date.now()){
    if(!ready())return null;
    const rows=[];
    for(const x of chat.readSttCaptureEvidence(storage,nowMs)||[])rows.push({locale:x.requestedLocale,at:Number(x.capturedAt)||0});
    for(const x of chat.readTtsEvidence(storage,nowMs)||[])rows.push({locale:x.requestedLocale,at:Number(x.verifiedAt)||0});
    for(const x of chat.readNegativeTtsEvidence(storage,nowMs)||[])rows.push({locale:x.requestedLocale,at:Number(x.observedAt)||0});
    rows.sort((a,b)=>b.at-a.at);
    return rows[0]&&chat.canonicalLocale(rows[0].locale)||null;
  }
  function chooseLocale({input,storage,nowMs=Date.now(),fallback='tr-TR'}={}){
    if(!ready())return null;
    const typed=chat.canonicalLocale(input&&input.value),preferred=chat.readPreference(storage),recent=newestLocale(storage,nowMs);
    return typed||preferred||recent||chat.canonicalLocale(fallback)||null;
  }
  function ensureBadge(doc){
    if(!doc||!ready())return null;
    let el=doc.getElementById('jarvisMobileSpeechEvidenceStatus');
    if(el)return el;
    const picker=doc.getElementById('jarvisMobileLocalePicker');
    const anchor=picker||doc.getElementById('languageChatStatus');
    if(!anchor||!anchor.parentNode||typeof doc.createElement!=='function')return null;
    el=doc.createElement('span');
    el.id='jarvisMobileSpeechEvidenceStatus';
    el.setAttribute('role','status');
    el.setAttribute('aria-label','Mobil konuşma kanıt durumu');
    el.style.cssText='display:block;margin-top:5px;font-size:9px;opacity:.82;color:#9bdce8;max-width:min(92vw,760px);white-space:normal';
    if(picker&&picker.parentNode===anchor.parentNode&&picker.nextSibling)anchor.parentNode.insertBefore(el,picker.nextSibling);
    else anchor.parentNode.appendChild(el);
    return el;
  }
  function refresh(doc,{storage,nowMs=Date.now(),fallback='tr-TR'}={}){
    if(!doc||!ready())return false;
    const el=ensureBadge(doc);if(!el)return false;
    const input=doc.getElementById('jarvisMobileLocaleInput');
    const locale=chooseLocale({input,storage,nowMs,fallback});
    if(!locale){el.textContent='KANIT · locale yok';return false}
    const summary=status.render(el,locale,{storage,nowMs});
    if(!summary)return false;
    el.textContent='KANIT · '+el.textContent+' · Otomatik STT/dil öğrenimi kapalı';
    el.dataset.automaticLearning='false';
    return summary;
  }
  function install(doc=root&&root.document,{storage,intervalMs=2000,fallback='tr-TR'}={}){
    if(!doc||!root||!ready()||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return false;
    const run=()=>refresh(doc,{storage,nowMs:Date.now(),fallback});
    const el=ensureBadge(doc);if(!el)return false;
    run();
    const input=doc.getElementById('jarvisMobileLocaleInput');
    const button=doc.querySelector&&doc.querySelector('#jarvisMobileLocalePicker button');
    if(input&&!input.dataset.jarvisEvidenceBound){input.dataset.jarvisEvidenceBound='1';input.addEventListener('input',run);input.addEventListener('change',run)}
    if(button&&!button.dataset.jarvisEvidenceBound){button.dataset.jarvisEvidenceBound='1';button.addEventListener('click',()=>setTimeout(run,0))}
    const chatStatus=doc.getElementById('languageChatStatus');
    if(chatStatus&&root.MutationObserver&&!chatStatus.dataset.jarvisEvidenceObserved){
      chatStatus.dataset.jarvisEvidenceObserved='1';
      const observer=new root.MutationObserver(run);observer.observe(chatStatus,{childList:true,characterData:true,subtree:true});
    }
    if(!root.__jarvisMobileSpeechEvidenceTimer){
      root.__jarvisMobileSpeechEvidenceTimer=setInterval(run,Math.max(1000,Math.min(10000,Number(intervalMs)||2000)));
    }
    return true;
  }
  return{ready,newestLocale,chooseLocale,ensureBadge,refresh,install};
});
