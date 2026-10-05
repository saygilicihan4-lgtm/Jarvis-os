(function(root){
  'use strict';
  if(!root||!root.document)return;
  const doc=root.document;
  const VERSION='1.0';
  const PREF_KEY='jarvisMobileLanguagePreferenceV1';
  const RTL=new Set(['ar','fa','he','ur','ps','sd','ug','yi']);
  const KEYS=['smart','listening','online','advisor','executor','specialist','strategy','ideas','risk','planning','chat','mission','pcControl','youtubeCreate','shopifyManage','appDev','automation','research','technical','codeDev','data','expert','quick','newTask','youtube','shopify','files','apps','browser','settings','speakPrompt','talk','listen','think','apply','done','activeTasks','viewAll','notifications','connections','phone','cloud','internet','projectDev','mailCheck','draftReady','systemUpdated','ideaReady'];
  const EN=['SMART ASSISTANT','Listening…','Systems Online','ADVISOR','EXECUTION','SPECIALIST','Strategy & Analysis','Idea Development','Risk Assessment','Planning & Optimization','Conversation','Mission Execution','Computer Control','YouTube Content Creation','Shopify Product Management','App Development','Automation & Tasks','Deep Research','Technical Analysis','Code & Development','Data Analysis','Specialist Modes','QUICK ACCESS','New Task','YouTube','Shopify','Files','Apps','Browser','Settings','Say it to speak','Speak','Listen','Think','Apply','Completed','ACTIVE TASKS','View All','RECENT NOTIFICATIONS','CONNECTIONS','Phone','Cloud','Internet','Project Development','Mail Check','Product draft prepared','System update completed','New idea ready'];
  const TR=['AKILLI ASİSTANINIZ','Dinliyorum…','Sistemler Çevrimiçi','DANIŞMAN','İCRA','UZMAN','Strateji & Analiz','Fikir Geliştirme','Risk Değerlendirme','Planlama & Optimizasyon','Sizinle Sohbet','Görev Yürütme','Bilgisayar Yönetimi','YouTube İçerik Üretimi','Shopify Ürün Yönetimi','Uygulama Geliştirme','Otomasyon & Görevler','Derin Araştırma','Teknik Analiz','Kod & Geliştirme','Veri Analizi','Özel Uzmanlık Modları','HIZLI ERİŞİM','Yeni Görev','YouTube','Shopify','Dosyalar','Uygulamalar','Tarayıcı','Ayarlar','Konuşmak için söyleyin','Konuş','Dinle','Düşün','Uygula','Tamamlandı','AKTİF GÖREVLER','Tümünü Gör','SON BİLDİRİMLER','BAĞLANTILAR','Telefon','Bulut','İnternet','Proje Geliştirme','Mail Kontrolü','Ürün taslağı hazırlandı','Sistem güncellemesi tamamlandı','Yeni fikir önerisi hazır'];
  KEYS.push('ready','speaking','thinking','executing','offline','connecting','unknown','unavailable','noTasks','noNotifications','pending','waitingPc','waitingDependency','failed');
  EN.push('Ready','Speaking…','Thinking…','Executing…','Offline','Connecting…','Unknown','No live data','No active tasks','No notifications','Pending','Waiting for PC','Waiting for dependency','Failed');
  TR.push('Hazırım','Konuşuyorum…','Düşünüyorum…','Uyguluyorum…','Çevrimdışı','Bağlanıyor…','Bilinmiyor','Canlı veri yok','Aktif görev yok','Bildirim yok','Bekliyor','PC bekleniyor','Bağımlılık bekleniyor','Başarısız');
  const packs=new Map();
  const makePack=values=>Object.freeze(Object.fromEntries(KEYS.map((k,i)=>[k,String(values[i]||EN[i]||k)])));
  packs.set('en',makePack(EN));packs.set('tr',makePack(TR));
  let activeLocale=null,lastPreference=null,translationBusy=false;

  function canonical(value){
    if(typeof value!=='string')return null;const input=value.trim().replace(/_/g,'-');
    if(!input||input.length>64||!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(input))return null;
    try{return Intl.getCanonicalLocales(input)[0]||null}catch(_){return null}
  }
  function languageOf(locale){return String(locale||'en').split('-')[0].toLowerCase()}
  function currentLocale(){
    let stored=null;try{stored=canonical(root.localStorage&&root.localStorage.getItem(PREF_KEY))}catch(_){}
    return stored||canonical(doc.documentElement.lang)||canonical(root.navigator&&root.navigator.language)||'en-US';
  }
  function safePack(locale,values){
    if(!Array.isArray(values)||values.length!==KEYS.length)return null;
    const out=[];for(const value of values){const s=String(value||'').replace(/[\r\n]+/g,' ').trim().slice(0,90);if(!s)return null;out.push(s)}
    const pack=makePack(out);packs.set(languageOf(locale),pack);return pack;
  }
  function parseArrayReply(reply){
    const raw=String(reply||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
    try{return JSON.parse(raw)}catch(_){const a=raw.indexOf('['),b=raw.lastIndexOf(']');if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch(__){}}return null}
  }
  async function browserTranslatorPack(locale){
    const api=root.Translator;if(!api||typeof api.create!=='function')return null;
    try{
      const translator=await api.create({sourceLanguage:'en',targetLanguage:languageOf(locale)}),out=[];
      for(const text of EN)out.push(await translator.translate(text));
      try{translator.destroy&&translator.destroy()}catch(_){}
      return safePack(locale,out);
    }catch(_){return null}
  }
  async function localWorkerPack(locale){
    if(typeof root.fetch!=='function')return null;
    const prompt='Translate this JARVIS interface string array from English to '+locale+'. Return ONLY a JSON array with exactly '+EN.length+' translated strings in the same order. Keep JARVIS, NOVA, ORION, YouTube, Shopify and PC unchanged. No markdown or explanation. '+JSON.stringify(EN);
    if(prompt.length>1800)return null;
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
    try{
      const started=await root.fetch('/api/mobile-language',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({text:prompt,locale,inputSource:'typed',history:[]}),signal:ctl.signal});
      if(!started.ok)return null;const meta=await started.json().catch(()=>null);if(!meta||!meta.id)return null;
      const until=Date.now()+12000;
      while(Date.now()<until){
        await new Promise(r=>setTimeout(r,450));
        const poll=await root.fetch('/api/mobile-language/'+encodeURIComponent(meta.id),{credentials:'same-origin',signal:ctl.signal});
        if(!poll.ok)return null;const data=await poll.json().catch(()=>null);if(!data)return null;
        if(data.status==='failed')return null;
        if(data.status==='ready')return safePack(locale,parseArrayReply(data.result&&data.result.reply));
      }
      return null;
    }catch(_){return null}finally{clearTimeout(timer)}
  }
  async function ensurePack(locale){
    const lang=languageOf(locale);if(packs.has(lang))return packs.get(lang);if(translationBusy)return packs.get('en');translationBusy=true;
    try{return await browserTranslatorPack(locale)||await localWorkerPack(locale)||packs.get('en')}finally{translationBusy=false}
  }
  function t(key){const pack=packs.get(languageOf(activeLocale))||packs.get('en');return pack[key]||packs.get('en')[key]||key}
  function div(cls,text){const n=doc.createElement('div');n.className=cls;if(text!=null)n.textContent=text;return n}
  function li(text){const n=doc.createElement('li');n.textContent=text;return n}
  function box(layer,cls){const n=div('ref-i18n-box '+cls);layer.appendChild(n);return n}
  function list(items){const u=doc.createElement('ul');for(const text of items)u.appendChild(li(text));return u}
  function paintStatic(layer){
    layer.innerHTML='';layer.dir=RTL.has(languageOf(activeLocale))?'rtl':'ltr';
    const smart=box(layer,'brand-tag');smart.textContent=t('smart');
    const listening=box(layer,'listen-label');listening.textContent=t('listening');
    const clock=box(layer,'clock');clock.innerHTML='<strong></strong><small></small>';
    const online=box(layer,'online');online.innerHTML='<i></i><span></span>';online.querySelector('span').textContent=t('online');
    const coreLabels=[['nova','NOVA','advisor'],['jarvis','JARVIS','executor'],['orion','ORION','specialist']];
    for(const [cls,name,role] of coreLabels){const n=box(layer,'core-label '+cls);n.innerHTML='<strong>'+name+'</strong><small></small>';n.querySelector('small').textContent=t(role)}
    const caps=[['nova-cap',['strategy','ideas','risk','planning','chat']],['jarvis-cap',['mission','pcControl','youtubeCreate','shopifyManage','appDev','automation']],['orion-cap',['research','technical','codeDev','data','expert']]];
    for(const [cls,keys] of caps){const n=box(layer,'cap '+cls);n.appendChild(list(keys.map(t)))}
    const quick=box(layer,'quick');quick.appendChild(div('ref-i18n-title',t('quick')));quick.appendChild(list(['newTask','youtube','shopify','files','apps','browser','settings'].map(t)));
    const prompt=box(layer,'prompt');prompt.innerHTML='<strong>JARVIS</strong><small></small>';prompt.querySelector('small').textContent=t('speakPrompt');
    const actions=box(layer,'actions');for(const key of ['talk','listen','think','apply','done'])actions.appendChild(div('action-label',t(key)));
    const tasks=box(layer,'tasks');tasks.appendChild(div('ref-i18n-title',t('activeTasks')));tasks.appendChild(list(['YouTube Shorts','shopifyManage','projectDev','mailCheck'].map(k=>t(k)||k)));
    const notes=box(layer,'notes');notes.appendChild(div('ref-i18n-title',t('notifications')));notes.appendChild(list(['draftReady','systemUpdated','ideaReady'].map(t)));
    const links=box(layer,'links');links.appendChild(div('ref-i18n-title',t('connections')));links.appendChild(list(['PC','phone','cloud','internet'].map(k=>k==='PC'?'PC':t(k))));
    updateClock(layer);
  }
  function updateClock(layer=doc.querySelector('#jarvisReferenceCockpit .ref-i18n-layer')){
    if(!layer)return;const target=layer.querySelector('.clock');if(!target)return;const now=new Date(),locale=activeLocale||'en-US';
    try{target.querySelector('strong').textContent=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);target.querySelector('small').textContent=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(now)}catch(_){target.querySelector('strong').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});target.querySelector('small').textContent=now.toLocaleDateString()}
  }
  function installStyle(){
    if(doc.getElementById('jarvisReferenceCockpitI18nStyle'))return;const s=doc.createElement('style');s.id='jarvisReferenceCockpitI18nStyle';s.textContent=`
      #jarvisReferenceCockpit .ref-i18n-layer{position:absolute;inset:0;z-index:10;pointer-events:none;color:#edfaff;font-family:Arial,Helvetica,sans-serif;text-shadow:0 0 8px rgba(0,0,0,.95)}
      .ref-i18n-box{position:absolute;background:linear-gradient(90deg,rgba(1,9,16,.90),rgba(2,12,21,.80),rgba(1,9,16,.90));border:1px solid rgba(49,192,255,.12);box-shadow:inset 0 0 18px rgba(0,165,255,.03);overflow:hidden}
      .brand-tag{left:3.2%;top:4.7%;width:17.5%;height:2.25%;border:0;background:rgba(1,7,13,.88);font-size:clamp(7px,.72vw,11px);letter-spacing:.34em;text-align:center;padding-top:.28%}
      .listen-label{left:43.0%;top:2.35%;width:14%;height:2.35%;border:0;background:rgba(1,7,13,.82);font-size:clamp(8px,.82vw,13px);text-align:center;padding-top:.35%}
      .clock{left:70.7%;top:1.0%;width:9.5%;height:4.8%;border:0;background:rgba(1,7,13,.84);text-align:center}.clock strong{display:block;font-size:clamp(15px,2vw,29px);font-weight:400}.clock small{font-size:clamp(7px,.75vw,11px)}
      .online{left:82.7%;top:4.1%;width:15.1%;height:2.5%;border:0;background:rgba(1,7,13,.86);font-size:clamp(7px,.72vw,11px);display:flex;align-items:center;gap:7px;padding:0 4%}.online i{width:7px;height:7px;border-radius:50%;background:#20ff7c;box-shadow:0 0 9px #20ff7c;flex:none}
      .core-label{width:15%;height:5.1%;top:11.7%;text-align:center;border:0;background:linear-gradient(rgba(2,9,16,.90),rgba(2,9,16,.68),transparent);padding-top:.2%}.core-label strong{display:block;font-size:clamp(14px,2.05vw,29px);letter-spacing:.08em}.core-label small{font-size:clamp(8px,.95vw,14px)}.core-label.nova{left:12.8%;color:#74e6ff}.core-label.jarvis{left:42.2%;color:#ffd184}.core-label.orion{left:72.7%;color:#dc91ff}
      .cap{top:42.7%;height:13.4%;padding:1.0% 1.4%;background:rgba(2,10,18,.89)}.cap ul,.quick ul,.tasks ul,.notes ul,.links ul{margin:0;padding:0;list-style:none}.cap li{font-size:clamp(7px,.78vw,12px);line-height:1.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nova-cap{left:9.4%;width:22.4%;color:#dffaff}.jarvis-cap{left:40.4%;width:19.4%;color:#fff1d6}.orion-cap{left:72.5%;width:22.1%;color:#f2e3ff}
      .quick{left:2.7%;top:57.2%;width:22.2%;height:25.8%;padding:1.0% 1.6%;background:rgba(2,10,18,.91)}.ref-i18n-title{font-size:clamp(8px,.95vw,14px);letter-spacing:.04em;margin-bottom:4%}.quick li{font-size:clamp(8px,.85vw,13px);line-height:2.15}
      .prompt{left:40.9%;top:72.1%;width:18.1%;height:7.9%;border:0;background:rgba(2,8,14,.91);text-align:center;padding-top:1.2%}.prompt strong{display:block;color:#ffe0a6;font-size:clamp(14px,1.7vw,25px);letter-spacing:.08em}.prompt small{font-size:clamp(8px,.78vw,12px)}
      .actions{left:27.6%;top:88.0%;width:52.1%;height:3.8%;display:grid;grid-template-columns:repeat(5,1fr);gap:1.6%;border:0;background:transparent}.action-label{text-align:center;font-size:clamp(7px,.75vw,11px);padding-top:5%;background:rgba(2,8,14,.76);border-radius:6px}
      .tasks{left:72.4%;top:57.5%;width:25.8%;height:14.4%;padding:1% 1.6%;background:rgba(2,10,18,.91)}.tasks li{font-size:clamp(7px,.72vw,11px);line-height:1.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .notes{left:72.4%;top:73.0%;width:25.8%;height:13.7%;padding:1% 1.6%;background:rgba(2,10,18,.91)}.notes li{font-size:clamp(7px,.69vw,10px);line-height:1.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .links{left:76.8%;top:89.1%;width:21.4%;height:8.9%;padding:.7% 1.2%;background:rgba(2,10,18,.91)}.links .ref-i18n-title{margin-bottom:5%}.links ul{display:grid;grid-template-columns:repeat(4,1fr);gap:2%;text-align:center}.links li{font-size:clamp(6px,.62vw,10px)}
      @media(max-aspect-ratio:3/4){.ref-i18n-layer{font-size:92%}}
    `;(doc.head||doc.documentElement).appendChild(s)
  }
  function repairModalClicks(){
    doc.addEventListener('click',event=>{
      const button=event.target&&event.target.closest&&event.target.closest('#jarvisReferenceCockpit .ref-modal .ref-actions button');if(!button)return;
      const row=button.parentElement,buttons=row?[...row.querySelectorAll('button')]:[],index=buttons.indexOf(button),modal=button.closest('.ref-modal'),ta=modal&&modal.querySelector('textarea');
      if(ta&&index===1&&typeof root.toggleVoice==='function'){event.preventDefault();event.stopImmediatePropagation();root.toggleVoice();ta.focus();return}
      if(ta&&index===2&&typeof root.send==='function'){event.preventDefault();event.stopImmediatePropagation();const cmd=doc.getElementById('cmd');if(cmd)cmd.value=ta.value;modal.classList.remove('open');root.send()}
    },true)
  }
  async function setLocale(locale,{translate=true}={}){
    const normalized=canonical(locale)||'en-US';activeLocale=normalized;const lang=languageOf(normalized);
    if(translate&&!packs.has(lang))await ensurePack(normalized);
    const cockpit=doc.getElementById('jarvisReferenceCockpit');if(!cockpit)return normalized;cockpit.dataset.locale=normalized;cockpit.dataset.dir=RTL.has(lang)?'rtl':'ltr';
    let layer=cockpit.querySelector('.ref-i18n-layer');if(!layer){layer=div('ref-i18n-layer');cockpit.querySelector('.ref-frame')?.appendChild(layer)}
    if(layer)paintStatic(layer);doc.documentElement.lang=normalized;doc.documentElement.dir=RTL.has(lang)?'rtl':'ltr';doc.dispatchEvent(new root.CustomEvent('jarvis:cockpit-locale',{detail:{locale:normalized}}));return normalized;
  }
  function install(attempt=0){
    const cockpit=doc.getElementById('jarvisReferenceCockpit');if(!cockpit){if(attempt<80)setTimeout(()=>install(attempt+1),100);return false}
    installStyle();repairModalClicks();setLocale(currentLocale());lastPreference=currentLocale();
    setInterval(()=>{const next=currentLocale();if(next!==lastPreference){lastPreference=next;setLocale(next)}else updateClock()},2000);
    doc.addEventListener('jarvis:language-changed',event=>{const locale=event&&event.detail&&event.detail.locale;if(locale)setLocale(locale)});
    doc.addEventListener('jarvis:conversation-state',event=>{const d=event&&event.detail||{},locale=d.locale||d.nextLocale||d.ttsLocale;if(locale)setLocale(locale)});
    return true;
  }
  function register(locale,dict){const normalized=canonical(locale);if(!normalized||!dict||typeof dict!=='object')return false;const base=packs.get('en'),values=KEYS.map(k=>String(dict[k]||base[k]||'').trim());return !!safePack(normalized,values)}
  root.JarvisCockpitI18n=Object.freeze({VERSION,KEYS,canonical,currentLocale,setLocale,register,install,t});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>install(0),{once:true});else install(0);
})(typeof window!=='undefined'?window:null);
