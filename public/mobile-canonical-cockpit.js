(function(root){
  'use strict';
  if(!root||!root.document)return;
  const doc=root.document;
  const VERSION='2.0';
  const ROOT_ID='jarvisMobileCanonical';
  const STYLE_ID='jarvisMobileCanonicalStyle';
  const MEDIA='screen'; // v197: one cockpit in portrait, landscape and desktop.
  const PARTS=[
    '/jarvis-mobile-cockpit-v185-01.b64',
    '/jarvis-mobile-cockpit-v185-02.b64',
    '/jarvis-mobile-cockpit-v185-03.b64',
    '/jarvis-mobile-cockpit-v185-04.b64'
  ];
  const EXPECTED_B64=75968;
  const EXPECTED_BYTES=56974;
  let artUrl='';
  let installPromise=null;

  function el(tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function sourceLayer(){return doc.querySelector('#jarvisReferenceCockpit .ref-i18n-layer')}
  function sourceText(selector,fallback=''){const n=sourceLayer()?.querySelector(selector);const t=String(n?.textContent||'').trim();return t||fallback}
  function sourceItems(selector,fallback=[]){const out=[...(sourceLayer()?.querySelectorAll(selector)||[])].map(n=>String(n.textContent||'').trim()).filter(Boolean);return out.length?out:fallback}
  function locale(){return String(doc.getElementById('jarvisReferenceCockpit')?.dataset.locale||doc.documentElement.lang||'tr-TR')}
  function isTurkish(){return /^tr(?:-|$)/i.test(locale())}
  function isRtl(){return doc.getElementById('jarvisReferenceCockpit')?.dataset.dir==='rtl'||doc.documentElement.dir==='rtl'}
  function lineText(node){return String(node?.innerText||node?.textContent||'').replace(/\s+/g,' ').trim()}
  function liveItems(id,selector,limit){const host=doc.getElementById(id);if(!host)return[];return [...host.querySelectorAll(selector)].map(lineText).filter(Boolean).slice(0,limit)}
  function clickLegacy(action){const target=doc.querySelector('#jarvisReferenceCockpit .ref-hotspot[data-a="'+action+'"]');if(target){target.click();return true}return false}
  function safeOnline(text){return /online|ready|connected|authorized|trusted/i.test(String(text||''))}

  async function loadArt(){
    if(artUrl)return artUrl;
    const parts=await Promise.all(PARTS.map(async path=>{
      const res=await root.fetch(path,{cache:'force-cache',credentials:'same-origin'});
      if(!res.ok)throw new Error('asset_part_'+res.status);
      return (await res.text()).replace(/\s+/g,'');
    }));
    const b64=parts.join('');
    if(b64.length!==EXPECTED_B64)throw new Error('asset_length_'+b64.length);
    const bin=root.atob(b64),bytes=new Uint8Array(bin.length);
    if(bytes.length!==EXPECTED_BYTES)throw new Error('asset_bytes_'+bytes.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const ascii=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
    if(ascii(0,4)!=='RIFF'||ascii(8,12)!=='WEBP')throw new Error('asset_magic');
    artUrl=root.URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
    return artUrl;
  }

  function installStyle(url){
    let s=doc.getElementById(STYLE_ID);if(s)s.remove();s=el('style');s.id=STYLE_ID;
    const safeUrl=String(url).replace(/"/g,'%22');
    s.textContent=`
      :root{--jm-cyan:#45dfff;--jm-amber:#ff9c31;--jm-violet:#c34fff;--jm-green:#29ff8e}
      #${ROOT_ID}{display:none;position:fixed;inset:0;z-index:60;background:#02060a;overflow:hidden;color:#eefaff;font-family:Arial,Helvetica,sans-serif;-webkit-tap-highlight-color:transparent;--jm-art:url("${safeUrl}")}
      body[data-reference-cockpit-mobile="1"] #jarvisReferenceCockpit .ref-frame{display:none!important}
      body[data-reference-cockpit-mobile="1"] #${ROOT_ID}{display:block}
      #${ROOT_ID} *{box-sizing:border-box}
      .jm-blur{position:absolute;inset:-9%;background:var(--jm-art) center/cover no-repeat;filter:blur(30px) brightness(.33) saturate(1.08);transform:scale(1.08);opacity:.92}
      .jm-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 0 42%,rgba(0,0,0,.2) 72%,rgba(0,0,0,.65) 100%);pointer-events:none}
      .jm-frame{position:absolute;left:50%;top:50%;width:min(100vw,calc(100dvh * 941 / 1672));aspect-ratio:941/1672;transform:translate(-50%,-50%);background:var(--jm-art) center/100% 100% no-repeat;overflow:hidden;isolation:isolate;box-shadow:0 0 48px rgba(0,0,0,.88)}
      .jm-frame:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:15;background:linear-gradient(115deg,rgba(255,255,255,.018),transparent 23% 78%,rgba(255,255,255,.018));mix-blend-mode:screen}
      .jm-copy{position:absolute;inset:0;background:var(--jm-art) center/100% 100% no-repeat;pointer-events:none;z-index:3;will-change:transform,filter,opacity;opacity:.36;mix-blend-mode:screen}
      .jm-copy.nova{clip-path:circle(15.6% at 18.8% 24.8%);transform-origin:18.8% 24.8%;animation:jmNovaIdle 5.8s ease-in-out infinite}
      .jm-copy.jarvis{clip-path:circle(19.2% at 49.2% 24.9%);transform-origin:49.2% 24.9%;animation:jmJarvisIdle 4.8s ease-in-out infinite}
      .jm-copy.orion{clip-path:circle(15.6% at 81.3% 24.8%);transform-origin:81.3% 24.8%;animation:jmOrionIdle 6.2s ease-in-out infinite}
      .jm-ring{position:absolute;z-index:5;border-radius:50%;border:1px solid currentColor;box-shadow:0 0 18px currentColor,inset 0 0 16px rgba(255,255,255,.05);pointer-events:none;opacity:.18;animation:jmSpin 13s linear infinite}
      .jm-ring:before{content:"";position:absolute;inset:13%;border:1px dashed currentColor;border-radius:50%;animation:jmSpin 8s linear infinite reverse}
      .jm-ring.nova{left:6.8%;top:15.8%;width:24.2%;aspect-ratio:1;color:var(--jm-cyan)}
      .jm-ring.jarvis{left:33.4%;top:13.7%;width:31.8%;aspect-ratio:1;color:var(--jm-amber)}
      .jm-ring.orion{left:69.0%;top:15.8%;width:24.2%;aspect-ratio:1;color:var(--jm-violet)}
      #${ROOT_ID}[data-state="speaking"] .jm-copy.jarvis{animation:jmSpeak .82s ease-in-out infinite alternate;opacity:.66;filter:brightness(1.22) saturate(1.2) drop-shadow(0 0 11px rgba(255,156,49,.75))}
      #${ROOT_ID}[data-state="speaking"] .jm-ring.jarvis{opacity:.55;animation-duration:3.2s;box-shadow:0 0 26px var(--jm-amber),inset 0 0 22px rgba(255,156,49,.18)}
      #${ROOT_ID}[data-state="listening"] .jm-copy.jarvis{animation:jmListen 1.15s ease-in-out infinite alternate;opacity:.55;filter:brightness(1.15) saturate(1.12)}
      #${ROOT_ID}[data-state="listening"] .jm-ring.jarvis,#${ROOT_ID}[data-state="thinking"] .jm-ring.jarvis{opacity:.48;animation-duration:2.4s}
      #${ROOT_ID}[data-core="nova"] .jm-copy.nova,#${ROOT_ID}[data-core="nova"] .jm-ring.nova{opacity:.64;filter:brightness(1.22) saturate(1.2) drop-shadow(0 0 13px rgba(69,223,255,.85))}
      #${ROOT_ID}[data-core="orion"] .jm-copy.orion,#${ROOT_ID}[data-core="orion"] .jm-ring.orion{opacity:.64;filter:brightness(1.22) saturate(1.2) drop-shadow(0 0 13px rgba(195,79,255,.85))}
      #${ROOT_ID}[data-collab="1"] .jm-ring{opacity:.5}
      .jm-wave{position:absolute;left:35.1%;top:5.7%;width:28.7%;height:4.1%;z-index:6;display:flex;align-items:center;justify-content:center;gap:.45%;pointer-events:none;opacity:.54}
      .jm-wave i{display:block;width:1.15%;min-width:1px;height:18%;background:#55e0ff;border-radius:3px;box-shadow:0 0 5px #22caff;animation:jmWave 1.65s ease-in-out infinite;transform-origin:center}.jm-wave i:nth-child(3n){animation-delay:-.4s}.jm-wave i:nth-child(4n){animation-delay:-.85s}.jm-wave i:nth-child(5n){animation-delay:-1.15s}
      #${ROOT_ID}[data-state="listening"] .jm-wave i,#${ROOT_ID}[data-state="speaking"] .jm-wave i{animation-duration:.55s;opacity:1}
      .jm-hot{position:absolute;z-index:25;border:0;background:transparent;color:transparent;padding:0;margin:0;cursor:pointer;outline:0;border-radius:8px;-webkit-tap-highlight-color:transparent}
      .jm-hot:focus-visible,.jm-hot:hover{box-shadow:inset 0 0 0 1px rgba(73,216,255,.48),0 0 17px rgba(0,187,255,.18);background:rgba(0,170,255,.025)}
      .jm-hot[data-a="newTask"]{left:4%;top:53.6%;width:25.5%;height:3.4%}.jm-hot[data-a="youtube"]{left:4%;top:56.9%;width:25.5%;height:3.4%}.jm-hot[data-a="shopify"]{left:4%;top:60.2%;width:25.5%;height:3.4%}.jm-hot[data-a="files"]{left:4%;top:63.5%;width:25.5%;height:3.4%}.jm-hot[data-a="apps"]{left:4%;top:66.8%;width:25.5%;height:3.4%}.jm-hot[data-a="browser"]{left:4%;top:70.1%;width:25.5%;height:3.4%}.jm-hot[data-a="settings"]{left:4%;top:73.4%;width:25.5%;height:3.4%}
      .jm-hot[data-a="mic"]{left:41.2%;top:62.1%;width:17.0%;height:9.6%;border-radius:50%}.jm-hot[data-a="tasks"]{left:64%;top:49.4%;width:33.2%;height:13.3%}.jm-hot[data-a="feed"]{left:64%;top:63.3%;width:33.2%;height:13.4%}.jm-hot[data-a="connections"]{left:61.5%;top:88.6%;width:36.2%;height:9.6%}
      .jm-hot[data-a="talk"]{left:12.0%;top:78.0%;width:14.5%;height:8.0%}.jm-hot[data-a="listen"]{left:27.0%;top:78.0%;width:14.0%;height:8.0%}.jm-hot[data-a="think"]{left:41.7%;top:77.7%;width:14.6%;height:8.4%}.jm-hot[data-a="apply"]{left:56.7%;top:78.0%;width:14.5%;height:8.0%}.jm-hot[data-a="done"]{left:71.6%;top:78.0%;width:15.0%;height:8.0%}
      .jm-clock{position:absolute;z-index:18;right:4.4%;top:2.25%;width:29%;padding:1.2% 1.5%;text-align:right;background:linear-gradient(90deg,transparent,rgba(2,8,14,.58) 30%);text-shadow:0 1px 8px #000;pointer-events:none}.jm-clock b{display:block;font-size:clamp(18px,5.3vw,28px);font-weight:500;line-height:1}.jm-clock small{display:block;font-size:clamp(7px,2.05vw,10px);margin-top:3px}.jm-clock em{display:block;font-size:clamp(7px,2vw,10px);font-style:normal;margin-top:6px}.jm-clock em:before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--jm-green);box-shadow:0 0 8px var(--jm-green);margin-right:5px}
      .jm-live-panel{display:none;position:absolute;z-index:19;background:linear-gradient(180deg,rgba(3,13,23,.92),rgba(1,7,13,.94));border:1px solid rgba(69,223,255,.34);box-shadow:0 0 14px rgba(0,0,0,.6),inset 0 0 17px rgba(69,223,255,.035);padding:1.1% 1.3%;overflow:hidden;pointer-events:none}.jm-live-panel.show{display:block}.jm-live-panel.tasks{left:64.5%;top:49.6%;width:32.1%;height:12.9%}.jm-live-panel.notes{left:64.5%;top:63.5%;width:32.1%;height:12.4%}.jm-live-title{font-size:clamp(8px,2.3vw,12px);margin-bottom:4%;letter-spacing:.03em}.jm-live-list{margin:0;padding:0;list-style:none}.jm-live-list li{font-size:clamp(6px,1.62vw,9px);line-height:1.35;padding:2.6% 0;border-bottom:1px solid rgba(255,255,255,.08);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.jm-live-list li:last-child{border-bottom:0}
      .jm-pc-dot{position:absolute;z-index:20;left:67.2%;top:96.1%;width:1.35%;aspect-ratio:1;border-radius:50%;background:#ff5e6d;box-shadow:0 0 7px #ff5e6d;pointer-events:none}.jm-pc-dot.online{background:var(--jm-green);box-shadow:0 0 7px var(--jm-green)}
      .jm-i18n{display:none;position:absolute;inset:0;z-index:17;pointer-events:none}.jm-i18n.show{display:block}.jm-i18n [data-t]{position:absolute;background:rgba(2,8,15,.82);border:1px solid rgba(69,223,255,.22);box-shadow:0 0 8px rgba(0,0,0,.45);padding:.45% .7%;font-size:clamp(6px,1.72vw,9px);line-height:1.35;color:#f1fbff;overflow:hidden}.jm-i18n.rtl [data-t]{direction:rtl;text-align:right}.jm-i18n .listen{left:35.7%;top:3.2%;width:27.3%;text-align:center}.jm-i18n .nova-role{left:10.2%;top:14.5%;width:17%;text-align:center}.jm-i18n .jarvis-role{left:40.7%;top:13.7%;width:17%;text-align:center}.jm-i18n .orion-role{left:72.3%;top:14.5%;width:17%;text-align:center}
      .jm-i18n .cap-nova{left:5%;top:36.2%;width:24.7%;height:11.6%}.jm-i18n .cap-jarvis{left:36.6%;top:36.1%;width:25.0%;height:11.7%}.jm-i18n .cap-orion{left:70%;top:36.2%;width:24.8%;height:11.6%}.jm-i18n .quick{left:3%;top:49.5%;width:28.2%;height:26.2%}.jm-i18n .actions{left:11.3%;top:78.1%;width:75.6%;height:7.8%;display:grid;grid-template-columns:repeat(5,1fr);gap:.3%;align-items:end;background:transparent;border:0;box-shadow:none}.jm-i18n .actions span{background:rgba(2,8,15,.84);padding:5% 2%;text-align:center}.jm-i18n ul{margin:0;padding-left:1.1em}.jm-i18n li{margin-bottom:2.5%}.jm-i18n .prompt{left:34.4%;top:70.3%;width:29.9%;text-align:center}.jm-i18n .links-title{left:63.5%;top:89%;width:31.7%;text-align:center}.jm-i18n .brand-tag{left:4.8%;top:5.15%;width:24.2%;text-align:center;background:rgba(2,8,15,.64);border:0}.jm-i18n .online{right:4.8%;top:5.3%;width:27%;text-align:right;background:rgba(2,8,15,.64);border:0}
      @keyframes jmSpin{to{transform:rotate(360deg)}}@keyframes jmNovaIdle{0%,100%{transform:scale(1.001)}50%{transform:scale(1.010)}}@keyframes jmJarvisIdle{0%,100%{transform:scale(1.002)}50%{transform:scale(1.012)}}@keyframes jmOrionIdle{0%,100%{transform:scale(1.001)}50%{transform:scale(1.009)}}@keyframes jmSpeak{from{transform:scale(1.04)}to{transform:scale(1.07)}}@keyframes jmListen{from{transform:scale(1.018)}to{transform:scale(1.04)}}@keyframes jmWave{0%,100%{transform:scaleY(.42);opacity:.42}50%{transform:scaleY(3.2);opacity:1}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID} .jm-copy,#${ROOT_ID} .jm-ring,#${ROOT_ID} .jm-ring:before,#${ROOT_ID} .jm-wave i{animation:none!important;transition:none!important}}
    `;
    (doc.head||doc.documentElement).appendChild(s);
  }

  function hotspot(frame,action,label){const b=el('button','jm-hot');b.type='button';b.dataset.a=action;b.setAttribute('aria-label',label);b.title=label;b.onclick=()=>clickLegacy(action);frame.appendChild(b);return b}
  function setList(ul,items){ul.innerHTML='';for(const item of items){const li=el('li','',item);ul.appendChild(li)}}

  function build(url){
    let existing=doc.getElementById(ROOT_ID);if(existing)existing.remove();installStyle(url);
    const rootEl=el('section');rootEl.id=ROOT_ID;rootEl.dataset.version=VERSION;rootEl.setAttribute('aria-label','JARVIS approved mobile cockpit');rootEl.setAttribute('aria-hidden','true');
    rootEl.append(el('div','jm-blur'),el('div','jm-vignette'));
    const frame=el('div','jm-frame');rootEl.appendChild(frame);
    frame.append(el('div','jm-copy nova'),el('div','jm-copy jarvis'),el('div','jm-copy orion'),el('div','jm-ring nova'),el('div','jm-ring jarvis'),el('div','jm-ring orion'));
    const wave=el('div','jm-wave');for(let i=0;i<30;i++)wave.appendChild(el('i'));frame.appendChild(wave);
    const clock=el('div','jm-clock');clock.innerHTML='<b></b><small></small><em></em>';frame.appendChild(clock);
    const tasks=el('div','jm-live-panel tasks');tasks.innerHTML='<div class="jm-live-title"></div><ul class="jm-live-list"></ul>';frame.appendChild(tasks);
    const notes=el('div','jm-live-panel notes');notes.innerHTML='<div class="jm-live-title"></div><ul class="jm-live-list"></ul>';frame.appendChild(notes);
    frame.appendChild(el('i','jm-pc-dot'));
    const i18n=el('div','jm-i18n');
    i18n.innerHTML='<div data-t class="brand-tag"></div><div data-t class="listen"></div><div data-t class="online"></div><div data-t class="nova-role"></div><div data-t class="jarvis-role"></div><div data-t class="orion-role"></div><div data-t class="cap-nova"></div><div data-t class="cap-jarvis"></div><div data-t class="cap-orion"></div><div data-t class="quick"></div><div data-t class="prompt"></div><div class="actions"></div><div data-t class="links-title"></div>';
    frame.appendChild(i18n);
    const actions={newTask:'Yeni Görev',youtube:'YouTube',shopify:'Shopify',files:'Dosyalar',apps:'Uygulamalar',browser:'Tarayıcı',settings:'Ayarlar',mic:'Konuş',talk:'Konuş',listen:'Dinle',think:'Düşün',apply:'Uygula',done:'Tamamlandı',tasks:'Aktif Görevler',feed:'Son Bildirimler',connections:'Bağlantılar'};
    Object.entries(actions).forEach(([a,l])=>hotspot(frame,a,l));
    (doc.getElementById('jarvisReferenceCockpit')||doc.body).appendChild(rootEl);
    return rootEl;
  }

  function syncState(rootEl){
    if(!rootEl)return;
    rootEl.dataset.state=doc.body.classList.contains('speaking')?'speaking':(doc.body.dataset.jarvisCoreState||'idle');
    rootEl.dataset.core=doc.body.dataset.jarvisCore||'jarvis';
    rootEl.dataset.collab=doc.body.dataset.jarvisCoreCollab||'0';
  }
  function syncClock(rootEl){
    const node=rootEl?.querySelector('.jm-clock');if(!node)return;
    const now=new Date(),loc=locale();
    try{node.querySelector('b').textContent=new Intl.DateTimeFormat(loc,{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);node.querySelector('small').textContent=new Intl.DateTimeFormat(loc,{day:'numeric',month:'long',year:'numeric'}).format(now)}catch(_){node.querySelector('b').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});node.querySelector('small').textContent=now.toLocaleDateString()}
    node.querySelector('em').textContent=sourceText('.online span',/^tr/i.test(loc)?'Sistemler Çevrimiçi':'Systems Online');
  }
  function syncLive(rootEl){
    if(!rootEl)return;
    const taskItems=liveItems('tasks','.task',4),noteItems=liveItems('audit','.log',4);
    const task=rootEl.querySelector('.jm-live-panel.tasks'),notes=rootEl.querySelector('.jm-live-panel.notes');
    task.querySelector('.jm-live-title').textContent=sourceText('.tasks .ref-i18n-title',isTurkish()?'AKTİF GÖREVLER':'ACTIVE TASKS');
    notes.querySelector('.jm-live-title').textContent=sourceText('.notes .ref-i18n-title',isTurkish()?'SON BİLDİRİMLER':'RECENT NOTIFICATIONS');
    setList(task.querySelector('ul'),taskItems);setList(notes.querySelector('ul'),noteItems);
    task.classList.toggle('show',taskItems.length>0);notes.classList.toggle('show',noteItems.length>0);
    const pc=doc.getElementById('pcState');rootEl.querySelector('.jm-pc-dot').classList.toggle('online',safeOnline(pc?.textContent));
  }
  function htmlList(items){return '<ul>'+items.map(v=>'<li>'+String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</li>').join('')+'</ul>'}
  function syncI18n(rootEl){
    const layer=rootEl?.querySelector('.jm-i18n');if(!layer)return;
    const tr=isTurkish();layer.classList.toggle('show',!tr);layer.classList.toggle('rtl',isRtl());rootEl.dir=isRtl()?'rtl':'ltr';if(tr)return;
    layer.querySelector('.brand-tag').textContent=sourceText('.brand-tag','SMART ASSISTANT');layer.querySelector('.listen').textContent=sourceText('.listen-label','Listening…');layer.querySelector('.online').textContent=sourceText('.online span','Systems Online');
    layer.querySelector('.nova-role').textContent=sourceText('.core-label.nova small','ADVISOR');layer.querySelector('.jarvis-role').textContent=sourceText('.core-label.jarvis small','EXECUTOR');layer.querySelector('.orion-role').textContent=sourceText('.core-label.orion small','SPECIALIST');
    layer.querySelector('.cap-nova').innerHTML=htmlList(sourceItems('.cap.nova-cap li',['Strategy & Analysis','Idea Development','Risk Assessment','Planning & Optimization','Conversation']));layer.querySelector('.cap-jarvis').innerHTML=htmlList(sourceItems('.cap.jarvis-cap li',['Task Execution','Computer Control','YouTube Creation','Shopify Management','App Development','Automation & Tasks']));layer.querySelector('.cap-orion').innerHTML=htmlList(sourceItems('.cap.orion-cap li',['Deep Research','Technical Analysis','Code & Development','Data Analysis','Specialist Modes']));
    layer.querySelector('.quick').innerHTML=htmlList(sourceItems('.quick li',['New Task','YouTube','Shopify','Files','Apps','Browser','Settings']));layer.querySelector('.prompt').textContent=sourceText('.prompt small','Speak to begin');layer.querySelector('.links-title').textContent=sourceText('.links .ref-i18n-title','CONNECTIONS');
    const labels=sourceItems('.actions .action-label',['Talk','Listen','Think','Apply','Done']),host=layer.querySelector('.actions');host.innerHTML='';labels.slice(0,5).forEach(t=>host.appendChild(el('span','',t)));
  }
  function applyMedia(rootEl,mq){const active=!!mq.matches;doc.body.dataset.referenceCockpitMobile=active?'1':'0';rootEl.setAttribute('aria-hidden',active?'false':'true')}

  async function install(){
    if(installPromise)return installPromise;
    installPromise=(async()=>{
      const cockpit=doc.getElementById('jarvisReferenceCockpit');if(!cockpit)throw new Error('reference_cockpit_missing');
      const url=await loadArt(),rootEl=build(url),mq=root.matchMedia?root.matchMedia(MEDIA):{matches:false,addEventListener(){}};
      applyMedia(rootEl,mq);mq.addEventListener?.('change',()=>applyMedia(rootEl,mq));syncState(rootEl);syncClock(rootEl);syncLive(rootEl);syncI18n(rootEl);
      if(typeof root.MutationObserver==='function'){
        const bodyObserver=new root.MutationObserver(()=>{syncState(rootEl);syncLive(rootEl)});bodyObserver.observe(doc.body,{attributes:true,attributeFilter:['class','data-jarvis-core','data-jarvis-core-state','data-jarvis-core-collab']});
        const cockpitObserver=new root.MutationObserver(()=>{syncClock(rootEl);syncI18n(rootEl);syncLive(rootEl)});cockpitObserver.observe(cockpit,{attributes:true,attributeFilter:['data-locale','data-dir']});
      }
      doc.addEventListener('jarvis:language-changed',()=>setTimeout(()=>{syncClock(rootEl);syncI18n(rootEl);syncLive(rootEl)},30));doc.addEventListener('jarvis:conversation-state',()=>syncState(rootEl));
      root.setInterval(()=>{syncClock(rootEl);syncLive(rootEl)},2500);
      doc.body.dataset.mobileCockpitAsset='ready';return true;
    })().catch(err=>{doc.body.dataset.mobileCockpitAsset='error';doc.body.dataset.referenceCockpitMobile='0';installPromise=null;try{console.warn('JARVIS mobile cockpit asset fallback',err?.message||err)}catch(_){}return false});
    return installPromise;
  }

  root.JarvisMobileCanonical=Object.freeze({VERSION,MEDIA,PARTS,EXPECTED_B64,EXPECTED_BYTES,install});
  function boot(attempt=0){if(doc.getElementById('jarvisReferenceCockpit')){install();return}if(attempt<100)root.setTimeout(()=>boot(attempt+1),80)}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
