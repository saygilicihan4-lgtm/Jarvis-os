(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisTriCore=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';

  // v178: role selection is presentation/advice metadata only.
  // Actual actions still flow through the existing Mission Engine / Worker / approval chain.
  const PROFILES=Object.freeze({
    jarvis:Object.freeze({id:'jarvis',name:'JARVIS',role:'İCRA',tone:'operational',color:'#ff9a2f',authority:'shared_guardrail_only'}),
    nova:Object.freeze({id:'nova',name:'NOVA',role:'DANIŞMAN',tone:'calm_advisory',color:'#65e6ff',authority:'shared_guardrail_only'}),
    orion:Object.freeze({id:'orion',name:'ORION',role:'UZMAN',tone:'deep_specialist',color:'#c65cff',authority:'shared_guardrail_only'})
  });

  const EXPLICIT={
    nova:/\b(nova|danışman|danisman)\b/i,
    orion:/\b(orion|uzman modu|uzman)\b/i,
    jarvis:/^(?:hey\s+)?jarvis\b\s*[:,-]?/i
  };
  const SPECIALIST=/(kök neden|kok neden|root cause|derin analiz|teknik analiz|teknik incele|debug|hata ayıkla|hata ayikla|kod incele|code review|güvenlik analiz|guvenlik analiz|mimari analiz|veri analiz|benchmark|araştır|arastir|kanıtla|kanitla|forensic|profiling|memory leak|race condition|regresyon)/i;
  const ADVISOR=/(sence|ne dersin|fikrini|fikir|tavsiye|öneri|oneri|strateji|seçenek|secenek|karşılaştır|karsilastir|artı eksi|arti eksi|riskleri|risk değerlendir|risk degerlendir|mantıklı mı|mantikli mi|karar ver|planla|önceliklendir|onceliklendir|değerlendir|degerlendir)/i;
  const EXECUTOR=/(devam et|uygula|entegre et|yap\b|oluştur|olustur|hazırla|hazirla|aç\b|ac\b|kapat|çalıştır|calistir|başlat|baslat|gönder|gonder|yükle|yukle|düzenle|duzenle|ekle|kaldır|kaldir|sil\b|kur\b|deploy|merge|commit|youtube|shopify|dosya|klasör|klasor|bilgisayar|pc\b|uygulama geliştir|uygulama gelistir)/i;

  function normalize(text){return String(text==null?'':text).replace(/\s+/g,' ').trim().slice(0,1200)}
  function classify(text){
    const value=normalize(text);
    if(!value)return'nova';
    if(EXPLICIT.nova.test(value))return'nova';
    if(EXPLICIT.orion.test(value))return'orion';
    // A plain JARVIS address only wins when no explicit NOVA/ORION was named.
    if(EXPLICIT.jarvis.test(value)){
      const rest=value.replace(EXPLICIT.jarvis,'').trim();
      if(SPECIALIST.test(rest))return'orion';
      if(ADVISOR.test(rest)&&!EXECUTOR.test(rest))return'nova';
      return'jarvis';
    }
    if(SPECIALIST.test(value))return'orion';
    if(ADVISOR.test(value)&&!EXECUTOR.test(value))return'nova';
    if(EXECUTOR.test(value))return'jarvis';
    return'nova';
  }

  function profile(role){return PROFILES[PROFILES[role]?role:'nova']}
  function statusText(role){
    const p=profile(role);
    if(p.id==='jarvis')return'JARVIS · İCRA MODU · Görev yürütme hazır';
    if(p.id==='orion')return'ORION · UZMAN MODU · Derin analiz hazır';
    return'NOVA · DANIŞMAN MODU · Strateji ve değerlendirme hazır';
  }

  function ensureStyle(doc){
    if(!doc||doc.getElementById('jarvisTriCoreRoleStyle'))return;
    const style=doc.createElement('style');
    style.id='jarvisTriCoreRoleStyle';
    style.textContent=[
      'body[data-jarvis-core="jarvis"] .core{box-shadow:0 0 28px rgba(255,154,47,.95),0 0 105px rgba(255,154,47,.38),inset 0 0 38px rgba(255,154,47,.28)}',
      'body[data-jarvis-core="jarvis"] .core-stage::before,body[data-jarvis-core="jarvis"] .core-stage::after{opacity:.52}',
      'body[data-jarvis-core="nova"] .core-stage::before{opacity:1;box-shadow:0 0 30px rgba(101,230,255,.95),0 0 105px rgba(0,184,255,.42),inset 0 0 38px rgba(0,184,255,.20)}',
      'body[data-jarvis-core="nova"] .core{opacity:.70}',
      'body[data-jarvis-core="nova"] .core-stage::after{opacity:.42}',
      'body[data-jarvis-core="orion"] .core-stage::after{opacity:1;box-shadow:0 0 30px rgba(198,92,255,.98),0 0 110px rgba(143,69,255,.45),inset 0 0 38px rgba(143,69,255,.22)}',
      'body[data-jarvis-core="orion"] .core{opacity:.70}',
      'body[data-jarvis-core="orion"] .core-stage::before{opacity:.42}',
      '@media(prefers-reduced-motion:reduce){body[data-jarvis-core] .core-stage::before,body[data-jarvis-core] .core-stage::after,body[data-jarvis-core] .core{transition:none!important}}'
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
    if(subtitle){subtitle.textContent=statusText(selected.id);subtitle.dataset.triCoreRole=selected.id}
    try{
      doc.dispatchEvent(new host.CustomEvent('jarvis:core-selected',{detail:{role:selected.id,reason:String(reason||'local').slice(0,32)}}));
    }catch(_){}
    return selected;
  }

  function install(targetRoot){
    const host=targetRoot&&targetRoot.document?targetRoot:(typeof window!=='undefined'?window:null);
    const doc=host&&host.document;
    if(!doc||!doc.body)return false;
    if(doc.body.dataset.jarvisTriCoreInstalled==='1')return true;
    doc.body.dataset.jarvisTriCoreInstalled='1';
    ensureStyle(doc);
    const input=doc.getElementById('cmd');
    if(input){
      const refresh=()=>apply(classify(input.value),host,'command-input');
      input.addEventListener('input',refresh,{passive:true});
      input.addEventListener('focus',refresh,{passive:true});
      refresh();
    }else apply('nova',host,'boot');
    doc.addEventListener('jarvis:tri-core-hint',event=>{
      const hint=event&&event.detail&&event.detail.role;
      if(PROFILES[hint])apply(hint,host,'trusted-ui-hint');
    });
    return true;
  }

  return Object.freeze({PROFILES,classify,profile,statusText,apply,install});
});
