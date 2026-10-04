(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisTriCore=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';

  // v179: role selection controls presentation/personality metadata only.
  // Actual actions still flow through the one Mission Engine / Worker / approval chain.
  const PROFILES=Object.freeze({
    jarvis:Object.freeze({id:'jarvis',name:'JARVIS',role:'İCRA',tone:'operational',color:'#ff9a2f',authority:'shared_guardrail_only'}),
    nova:Object.freeze({id:'nova',name:'NOVA',role:'DANIŞMAN',tone:'calm_advisory',color:'#65e6ff',authority:'shared_guardrail_only'}),
    orion:Object.freeze({id:'orion',name:'ORION',role:'UZMAN',tone:'deep_specialist',color:'#c65cff',authority:'shared_guardrail_only'})
  });
  const STATES=Object.freeze(['idle','listening','thinking','speaking','working','error','waiting']);
  const DIRECT=/^\s*(?:hey\s+)?(jarvis|nova|orion)\b\s*[:,-]?\s*/i;
  const SPECIALIST=/(kök neden|kok neden|root cause|derin analiz|teknik analiz|teknik incele|debug|hata ayıkla|hata ayikla|kod incele|code review|güvenlik analiz|guvenlik analiz|mimari analiz|veri analiz|benchmark|araştır|arastir|kanıtla|kanitla|forensic|profiling|memory leak|race condition|regresyon|stack trace|latency|threat model|tehdit modeli)/i;
  const ADVISOR=/(sence|ne dersin|fikrini|fikir|tavsiye|öneri|oneri|strateji|seçenek|secenek|karşılaştır|karsilastir|artı eksi|arti eksi|riskleri|risk değerlendir|risk degerlendir|mantıklı mı|mantikli mi|karar ver|planla|önceliklendir|onceliklendir|değerlendir|degerlendir|trade-?off|alternatif)/i;
  const EXECUTOR=/(devam et|uygula|entegre et|yap\b|oluştur|olustur|hazırla|hazirla|aç\b|ac\b|kapat|çalıştır|calistir|başlat|baslat|gönder|gonder|yükle|yukle|düzenle|duzenle|ekle|kaldır|kaldir|sil\b|kur\b|deploy|merge|commit|youtube|shopify|dosya|klasör|klasor|bilgisayar|pc\b|uygulama geliştir|uygulama gelistir|otomasyon|mission|görev|gorev)/i;

  function normalize(text){return String(text==null?'':text).replace(/\s+/g,' ').trim().slice(0,1800)}
  function explicit(text){const value=normalize(text),match=value.match(DIRECT);return match?{role:String(match[1]).toLowerCase(),text:value.slice(match[0].length).trim()}:null}
  function classify(text){
    const value=normalize(text),direct=explicit(value);
    if(direct)return direct.role;
    if(!value)return'nova';
    if(SPECIALIST.test(value))return'orion';
    if(ADVISOR.test(value)&&!EXECUTOR.test(value))return'nova';
    if(EXECUTOR.test(value))return'jarvis';
    return'nova';
  }

  function profile(role){return PROFILES[PROFILES[role]?role:'nova']}
  function validState(state){return STATES.includes(String(state||'').toLowerCase())?String(state).toLowerCase():'idle'}
  function stateLabel(state){
    return({idle:'HAZIR',listening:'DİNLİYOR',thinking:'DÜŞÜNÜYOR',speaking:'KONUŞUYOR',working:'ÇALIŞIYOR',error:'HATA',waiting:'BEKLİYOR'})[validState(state)];
  }
  function statusText(role,state='idle'){
    const p=profile(role),label=stateLabel(state);
    if(p.id==='jarvis')return'JARVIS · İCRA · '+label;
    if(p.id==='orion')return'ORION · UZMAN · '+label;
    return'NOVA · DANIŞMAN · '+label;
  }

  function ensureStyle(doc){
    if(!doc||doc.getElementById('jarvisTriCoreRoleStyle'))return;
    const style=doc.createElement('style');
    style.id='jarvisTriCoreRoleStyle';
    style.textContent=[
      'body[data-jarvis-core="jarvis"] .core{box-shadow:0 0 28px rgba(255,154,47,.95),0 0 105px rgba(255,154,47,.38),inset 0 0 38px rgba(255,154,47,.28)}',
      'body[data-jarvis-core="jarvis"] .core-stage::before,body[data-jarvis-core="jarvis"] .core-stage::after{opacity:.42}',
      'body[data-jarvis-core="nova"] .core-stage::before{opacity:1;box-shadow:0 0 30px rgba(101,230,255,.95),0 0 105px rgba(0,184,255,.42),inset 0 0 38px rgba(0,184,255,.20)}',
      'body[data-jarvis-core="nova"] .core{opacity:.58}',
      'body[data-jarvis-core="nova"] .core-stage::after{opacity:.36}',
      'body[data-jarvis-core="orion"] .core-stage::after{opacity:1;box-shadow:0 0 30px rgba(198,92,255,.98),0 0 110px rgba(143,69,255,.45),inset 0 0 38px rgba(143,69,255,.22)}',
      'body[data-jarvis-core="orion"] .core{opacity:.58}',
      'body[data-jarvis-core="orion"] .core-stage::before{opacity:.36}',
      '#jarvisTriCoreWebgl{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:.9;mix-blend-mode:screen}',
      'body[data-jarvis-core-state="listening"] .core,body[data-jarvis-core-state="speaking"] .core{animation-duration:1.15s;filter:brightness(1.18)}',
      'body[data-jarvis-core-state="thinking"] .hud-ring,body[data-jarvis-core-state="thinking"] .arc{animation-duration:3.6s!important}',
      'body[data-jarvis-core-state="working"] .core::after{opacity:1;box-shadow:0 0 22px rgba(255,255,255,.52)}',
      'body[data-jarvis-core-state="working"] .ticks{opacity:.8}',
      'body[data-jarvis-core-state="waiting"] .core-stage{filter:saturate(.72);opacity:.78}',
      'body[data-jarvis-core-state="error"] .core-stage{filter:hue-rotate(305deg) saturate(1.45)}',
      'body[data-jarvis-core-state="error"] .core{box-shadow:0 0 34px rgba(255,59,78,.95),0 0 120px rgba(255,59,78,.38),inset 0 0 40px rgba(255,59,78,.2)}',
      '@media(prefers-reduced-motion:reduce){body[data-jarvis-core] .core-stage::before,body[data-jarvis-core] .core-stage::after,body[data-jarvis-core] .core,body[data-jarvis-core] .hud-ring,body[data-jarvis-core] .arc,body[data-jarvis-core] .ticks{animation-duration:0.001ms!important;animation-iteration-count:1!important;transition:none!important}}'
    ].join('\n');
    (doc.head||doc.documentElement).appendChild(style);
  }

  function apply(role,targetRoot,reason){
    const host=targetRoot&&targetRoot.document?targetRoot:(typeof window!=='undefined'?window:null);
    const doc=host&&host.document;
    if(!doc||!doc.body)return profile(role);
    const selected=profile(role);
    ensureStyle(doc);
    doc.body.dataset.jarvisCore=selected.id;
    doc.body.dataset.jarvisCoreRole=selected.role.toLowerCase();
    const subtitle=doc.getElementById('coreSubtitle');
    if(subtitle){subtitle.textContent=statusText(selected.id,doc.body.dataset.jarvisCoreState||'idle');subtitle.dataset.triCoreRole=selected.id}
    try{doc.dispatchEvent(new host.CustomEvent('jarvis:core-selected',{detail:{role:selected.id,reason:String(reason||'local').slice(0,32),authority:'shared_guardrail_only'}}))}catch(_){}
    return selected;
  }
  function setState(state,targetRoot,reason){
    const host=targetRoot&&targetRoot.document?targetRoot:(typeof window!=='undefined'?window:null),doc=host&&host.document;
    const next=validState(state);
    if(!doc||!doc.body)return next;
    doc.body.dataset.jarvisCoreState=next;
    const role=doc.body.dataset.jarvisCore||'nova',subtitle=doc.getElementById('coreSubtitle');
    if(subtitle)subtitle.textContent=statusText(role,next);
    try{doc.dispatchEvent(new host.CustomEvent('jarvis:core-state',{detail:{state:next,role,reason:String(reason||'system').slice(0,40)}}))}catch(_){}
    return next;
  }
  function inferState(text){
    const value=normalize(text).toLocaleLowerCase('tr-TR');
    if(!value)return'idle';
    if(/failed|error|hata|başarısız|basarisiz|unavailable|reddedildi/.test(value))return'error';
    if(/dinliyor|listening|stt listening|command window open|wake word armed/.test(value))return'listening';
    if(/düşünüyor|dusunuyor|thinking|analiz ediyor|analyzing/.test(value))return'thinking';
    if(/konuşuyor|konusuyor|speaking|playing|voice: talking/.test(value))return'speaking';
    if(/çalışıyor|calisiyor|working|executing|running|gönderiliyor|gonderiliyor|upload|deploy|queued|mission running/.test(value))return'working';
    if(/bekliyor|waiting|standby|pending/.test(value))return'waiting';
    return'idle';
  }
  function install(targetRoot){
    const host=targetRoot&&targetRoot.document?targetRoot:(typeof window!=='undefined'?window:null);
    const doc=host&&host.document;
    if(!doc||!doc.body)return false;
    if(doc.body.dataset.jarvisTriCoreInstalled==='1')return true;
    doc.body.dataset.jarvisTriCoreInstalled='1';
    ensureStyle(doc);setState('idle',host,'boot');
    const input=doc.getElementById('cmd');
    if(input){
      const refresh=()=>apply(classify(input.value),host,'command-input');
      input.addEventListener('input',refresh,{passive:true});input.addEventListener('focus',refresh,{passive:true});refresh();
    }else apply('nova',host,'boot');
    doc.addEventListener('jarvis:tri-core-hint',event=>{
      const hint=event&&event.detail&&event.detail.role,state=event&&event.detail&&event.detail.state;
      if(PROFILES[hint])apply(hint,host,'trusted-ui-hint');
      if(state)setState(state,host,'trusted-ui-hint');
    });
    doc.addEventListener('jarvis:conversation-state',event=>{
      const detail=event&&event.detail||{};
      if(PROFILES[detail.core])apply(detail.core,host,'conversation');
      if(detail.state)setState(detail.state,host,'conversation');
    });
    const watched=['consoleStatus','voiceState','languageChatStatus'].map(id=>doc.getElementById(id)).filter(Boolean);
    if(typeof host.MutationObserver==='function'&&watched.length){
      const observer=new host.MutationObserver(()=>{
        if(doc.body.classList.contains('speaking')){setState('speaking',host,'dom-speaking');return}
        const state=inferState(watched.map(el=>el.textContent||'').join(' '));
        if(state!=='idle'||doc.body.dataset.jarvisCoreState==='error')setState(state,host,'dom-status');
      });
      watched.forEach(el=>observer.observe(el,{childList:true,characterData:true,subtree:true}));
      observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
    }
    return true;
  }

  return Object.freeze({PROFILES,STATES,normalize,explicit,classify,profile,validState,stateLabel,statusText,inferState,apply,setState,install});
});
