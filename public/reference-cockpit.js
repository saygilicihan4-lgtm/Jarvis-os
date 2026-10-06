(function(root){
  'use strict';
  if(!root||!root.document)return;
  const doc=root.document;
  const VERSION='1.0';
  const ASSET='/jarvis-reference-cockpit.jpg';
  const ROOT_ID='jarvisReferenceCockpit';
  const STYLE_ID='jarvisReferenceCockpitStyle';
  const ACTIONS={
    newTask:'Yeni görev oluştur',youtube:'YouTube görevini aç',shopify:'Shopify ürün görevini aç',files:'Dosyalarımı aç',apps:'Uygulamalarımı göster',browser:'Tarayıcıyı aç',settings:'JARVIS ayarlarını göster'
  };

  function installStyle(){
    if(doc.getElementById(STYLE_ID))return;
    const style=doc.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      :root{--ref-cyan:#25c8ff;--ref-amber:#ff9b2f;--ref-violet:#c04dff;--ref-ok:#24ff8d}
      body[data-reference-cockpit="1"]{margin:0!important;background:#02060a!important;overflow:hidden!important}
      body[data-reference-cockpit="1"]>.app,body[data-reference-cockpit="1"]>.console{display:none!important}
      #${ROOT_ID}{position:fixed;inset:0;z-index:30;background:#02060a;overflow:hidden;isolation:isolate;color:#fff;font-family:Arial,Helvetica,sans-serif}
      #${ROOT_ID}::before{content:"";position:absolute;inset:-5%;background:url('${ASSET}') center/cover no-repeat;filter:blur(24px) brightness(.42) saturate(1.08);transform:scale(1.07);opacity:.82}
      #${ROOT_ID}::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 31%,transparent 0 31%,rgba(0,0,0,.18) 72%,rgba(0,0,0,.56) 100%);pointer-events:none}
      .ref-frame{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,calc(100vh * .948));height:min(100vh,calc(100vw / .948));aspect-ratio:1221/1288;background:url('${ASSET}') center/100% 100% no-repeat;overflow:hidden;box-shadow:0 0 80px rgba(0,0,0,.8);isolation:isolate}
      .ref-frame::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.035),transparent 18% 82%,rgba(255,255,255,.025));mix-blend-mode:screen;z-index:8}
      .ref-copy{position:absolute;inset:0;background:url('${ASSET}') center/100% 100% no-repeat;pointer-events:none;z-index:3;will-change:transform,filter,opacity}
      .ref-copy.nova{clip-path:circle(16.7% at 20.2% 28.2%);transform-origin:20.2% 28.2%;animation:refNovaBreathe 5.8s ease-in-out infinite}
      .ref-copy.jarvis{clip-path:circle(20.2% at 49.7% 28.5%);transform-origin:49.7% 28.5%;animation:refJarvisBreathe 4.8s ease-in-out infinite}
      .ref-copy.orion{clip-path:circle(16.7% at 80.1% 28.2%);transform-origin:80.1% 28.2%;animation:refOrionBreathe 6.2s ease-in-out infinite}
      .ref-ring{position:absolute;border-radius:50%;pointer-events:none;z-index:4;opacity:.42;mix-blend-mode:screen;will-change:transform,filter,opacity}
      .ref-ring::before,.ref-ring::after{content:"";position:absolute;border-radius:50%;inset:5%;border:1px solid currentColor;box-shadow:0 0 16px currentColor,inset 0 0 15px color-mix(in srgb,currentColor 35%,transparent);animation:refSpin 12s linear infinite}
      .ref-ring::after{inset:18%;border-style:dashed;animation-direction:reverse;animation-duration:8.5s;opacity:.72}
      .ref-ring.nova{left:6.2%;top:13.2%;width:28.2%;aspect-ratio:1;color:var(--ref-cyan);filter:drop-shadow(0 0 9px rgba(37,200,255,.68))}
      .ref-ring.jarvis{left:31.1%;top:10.3%;width:37.2%;aspect-ratio:1;color:var(--ref-amber);filter:drop-shadow(0 0 12px rgba(255,155,47,.72))}
      .ref-ring.orion{left:65.8%;top:13.2%;width:28.2%;aspect-ratio:1;color:var(--ref-violet);filter:drop-shadow(0 0 9px rgba(192,77,255,.68))}
      .ref-wave{position:absolute;left:39.3%;top:3.3%;width:21.7%;height:5.8%;z-index:6;display:flex;align-items:center;justify-content:center;gap:.45%;pointer-events:none;opacity:.64}
      .ref-wave i{display:block;width:1.2%;min-width:1px;height:18%;border-radius:3px;background:#54dfff;box-shadow:0 0 6px #21c8ff;animation:refWave 1.75s ease-in-out infinite;transform-origin:center}
      .ref-wave i:nth-child(3n){animation-delay:-.45s}.ref-wave i:nth-child(4n){animation-delay:-.9s}.ref-wave i:nth-child(5n){animation-delay:-1.2s}
      .ref-hotspot{position:absolute;z-index:12;border:0;background:transparent;color:transparent;padding:0;cursor:pointer;border-radius:12px;outline:0;-webkit-tap-highlight-color:transparent}
      .ref-hotspot:hover,.ref-hotspot:focus-visible{box-shadow:inset 0 0 0 1px rgba(73,216,255,.52),0 0 18px rgba(0,187,255,.2);background:rgba(0,170,255,.025)}
      .ref-hotspot.mic:hover,.ref-hotspot.mic:focus-visible{box-shadow:0 0 38px rgba(255,155,47,.34),inset 0 0 0 1px rgba(255,191,91,.45);background:rgba(255,155,47,.035)}
      .ref-hotspot[data-a="newTask"]{left:4.1%;top:59.0%;width:19%;height:3.6%}.ref-hotspot[data-a="youtube"]{left:4.1%;top:62.7%;width:19%;height:3.5%}.ref-hotspot[data-a="shopify"]{left:4.1%;top:66.4%;width:19%;height:3.5%}.ref-hotspot[data-a="files"]{left:4.1%;top:70.1%;width:19%;height:3.5%}.ref-hotspot[data-a="apps"]{left:4.1%;top:73.8%;width:19%;height:3.5%}.ref-hotspot[data-a="browser"]{left:4.1%;top:77.5%;width:19%;height:3.5%}.ref-hotspot[data-a="settings"]{left:4.1%;top:81.2%;width:19%;height:3.5%}
      .ref-hotspot.mic{left:43.8%;top:66.5%;width:12.5%;height:13.3%;border-radius:50%}
      .ref-hotspot[data-a="talk"]{left:28.0%;top:84.6%;width:10.2%;height:8.4%}.ref-hotspot[data-a="listen"]{left:38.3%;top:84.6%;width:10.2%;height:8.4%}.ref-hotspot[data-a="think"]{left:48.6%;top:84.6%;width:10.2%;height:8.4%}.ref-hotspot[data-a="apply"]{left:58.9%;top:84.6%;width:10.2%;height:8.4%}.ref-hotspot[data-a="done"]{left:69.2%;top:84.6%;width:10.2%;height:8.4%}
      .ref-hotspot[data-a="tasks"]{left:72.1%;top:57.4%;width:26.1%;height:14.4%}.ref-hotspot[data-a="feed"]{left:72.1%;top:73.0%;width:26.1%;height:13.8%}.ref-hotspot[data-a="connections"]{left:77.0%;top:88.6%;width:21.4%;height:9.9%}
      .ref-modal{position:absolute;z-index:40;inset:0;display:none;align-items:center;justify-content:center;padding:4%;background:rgba(0,5,11,.67);backdrop-filter:blur(9px)}
      .ref-modal.open{display:flex}.ref-card{width:min(640px,92%);max-height:74%;overflow:auto;border:1px solid rgba(59,210,255,.45);background:linear-gradient(180deg,rgba(4,18,31,.96),rgba(2,7,13,.97));box-shadow:0 0 50px rgba(0,177,255,.18),inset 0 0 28px rgba(0,177,255,.04);padding:20px;clip-path:polygon(2% 0,98% 0,100% 4%,100% 96%,98% 100%,2% 100%,0 96%,0 4%)}
      .ref-card h3{margin:0 0 13px;color:#e8f8ff;letter-spacing:.12em}.ref-card pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace;color:#bfeeff;opacity:.92}.ref-card textarea{width:100%;min-height:120px;resize:vertical;border:1px solid rgba(52,205,255,.34);background:#020a11;color:#eaffff;padding:12px;font:14px/1.4 ui-monospace,monospace;outline:none}.ref-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:12px}.ref-actions button{border:1px solid rgba(64,214,255,.45);background:rgba(0,151,219,.14);color:#eaffff;padding:10px 16px;font-weight:700;cursor:pointer}.ref-actions .primary{border-color:rgba(255,170,57,.58);background:rgba(255,148,33,.17)}
      #${ROOT_ID}[data-state="speaking"] .ref-copy.jarvis{animation:refSpeak .82s ease-in-out infinite alternate;filter:brightness(1.18) saturate(1.15)}
      #${ROOT_ID}[data-state="speaking"] .ref-ring.jarvis{opacity:.88;filter:drop-shadow(0 0 22px rgba(255,155,47,.95));animation:refRingSpeak .9s ease-in-out infinite alternate}
      #${ROOT_ID}[data-state="speaking"] .ref-wave i{animation-duration:.46s;opacity:1}
      #${ROOT_ID}[data-state="listening"] .ref-copy.jarvis{animation:refListen 1.4s ease-in-out infinite alternate;filter:brightness(1.10) saturate(1.08)}
      #${ROOT_ID}[data-state="listening"] .ref-wave i{animation-duration:.72s;opacity:1}
      #${ROOT_ID}[data-state="thinking"] .ref-ring.jarvis::before,#${ROOT_ID}[data-state="thinking"] .ref-ring.jarvis::after{animation-duration:2.2s}
      #${ROOT_ID}[data-core="nova"] .ref-copy.nova,#${ROOT_ID}[data-core="nova"] .ref-ring.nova{filter:brightness(1.22) saturate(1.2) drop-shadow(0 0 15px rgba(37,200,255,.75));opacity:.94}
      #${ROOT_ID}[data-core="orion"] .ref-copy.orion,#${ROOT_ID}[data-core="orion"] .ref-ring.orion{filter:brightness(1.22) saturate(1.2) drop-shadow(0 0 15px rgba(192,77,255,.75));opacity:.94}
      #${ROOT_ID}[data-core="jarvis"] .ref-copy.jarvis,#${ROOT_ID}[data-core="jarvis"] .ref-ring.jarvis{opacity:.94}
      #${ROOT_ID}[data-collab="1"] .ref-ring{opacity:.82}.ref-status-pulse{position:absolute;right:13.9%;top:4.65%;z-index:7;width:.75%;aspect-ratio:1;border-radius:50%;background:var(--ref-ok);box-shadow:0 0 8px var(--ref-ok),0 0 18px rgba(36,255,141,.6);animation:refStatus 2s ease-in-out infinite}
      @keyframes refSpin{to{transform:rotate(360deg)}}@keyframes refNovaBreathe{0%,100%{transform:scale(1.002)}50%{transform:scale(1.012)}}@keyframes refJarvisBreathe{0%,100%{transform:scale(1.002)}50%{transform:scale(1.014)}}@keyframes refOrionBreathe{0%,100%{transform:scale(1.002)}50%{transform:scale(1.011)}}@keyframes refSpeak{from{transform:scale(1.028)}to{transform:scale(1.058)}}@keyframes refListen{from{transform:scale(1.012)}to{transform:scale(1.029)}}@keyframes refRingSpeak{from{transform:scale(1)}to{transform:scale(1.035)}}@keyframes refWave{0%,100%{transform:scaleY(.55);opacity:.55}50%{transform:scaleY(3.4);opacity:1}}@keyframes refStatus{0%,100%{opacity:.62;transform:scale(.9)}50%{opacity:1;transform:scale(1.18)}}
      @media(prefers-reduced-motion:reduce){.ref-copy,.ref-ring,.ref-ring::before,.ref-ring::after,.ref-wave i,.ref-status-pulse{animation:none!important;transition:none!important}}
    `;
    (doc.head||doc.documentElement).appendChild(style);
  }

  function el(tag,cls,attrs={}){const n=doc.createElement(tag);if(cls)n.className=cls;for(const [k,v] of Object.entries(attrs)){if(k==='text')n.textContent=v;else n.setAttribute(k,v)}return n}
  function hotspot(frame,a,label,cls=''){const b=el('button','ref-hotspot '+cls,{'data-a':a,'aria-label':label,title:label});frame.appendChild(b);return b}
  function commandModal(root){
    const modal=el('div','ref-modal',{'aria-hidden':'true'}),card=el('div','ref-card');modal.appendChild(card);root.appendChild(modal);
    function close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');card.innerHTML=''}
    function openComposer(prefill=''){
      card.innerHTML='';card.appendChild(el('h3','',{text:'JARVIS · KOMUT'}));const ta=el('textarea','',{'aria-label':'JARVIS komutu',placeholder:'Ne yapmamı istersiniz?'});ta.value=prefill;card.appendChild(ta);
      const actions=el('div','ref-actions'),cancel=el('button','',{text:'KAPAT'}),voice=el('button','',{text:'DİNLE'}),send=el('button','primary',{text:'UYGULA'});actions.append(cancel,voice,send);card.appendChild(actions);
      cancel.onclick=close;voice.onclick=()=>{try{root.toggleVoice&&root.toggleVoice()}catch(_){};ta.focus()};send.onclick=()=>{const target=doc.getElementById('cmd');if(target)target.value=ta.value;if(typeof root.send==='function'){close();root.send()}else ta.focus()};
      modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},30);
    }
    function openText(title,text){card.innerHTML='';card.appendChild(el('h3','',{text:title}));card.appendChild(el('pre','',{text:text||'Henüz veri yok.'}));const actions=el('div','ref-actions'),closeBtn=el('button','primary',{text:'KAPAT'});closeBtn.onclick=close;actions.appendChild(closeBtn);card.appendChild(actions);modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
    modal.addEventListener('click',e=>{if(e.target===modal)close()});root.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    return{openComposer,openText,close};
  }

  function readPanel(id){const n=doc.getElementById(id);if(!n)return'';return String(n.innerText||n.textContent||'').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000)}
  function install(){
    if(doc.getElementById(ROOT_ID))return true;installStyle();doc.body.dataset.referenceCockpit='1';
    const rootEl=el('main','',{});rootEl.id=ROOT_ID;rootEl.dataset.version=VERSION;rootEl.dataset.state=doc.body.dataset.jarvisCoreState||'idle';rootEl.dataset.core=doc.body.dataset.jarvisCore||'jarvis';rootEl.dataset.collab=doc.body.dataset.jarvisCoreCollab||'0';
    const frame=el('section','ref-frame',{'aria-label':'JARVIS referans kokpit arayüzü'});rootEl.appendChild(frame);
    frame.append(el('div','ref-copy nova'),el('div','ref-copy jarvis'),el('div','ref-copy orion'),el('div','ref-ring nova'),el('div','ref-ring jarvis'),el('div','ref-ring orion'));
    const wave=el('div','ref-wave',{'aria-hidden':'true'});for(let i=0;i<28;i++)wave.appendChild(el('i'));frame.appendChild(wave);frame.appendChild(el('span','ref-status-pulse',{'aria-hidden':'true'}));
    const modal=commandModal(rootEl);
    for(const [a,label] of Object.entries({newTask:'Yeni Görev',youtube:'YouTube',shopify:'Shopify',files:'Dosyalar',apps:'Uygulamalar',browser:'Tarayıcı',settings:'Ayarlar'}))hotspot(frame,a,label).onclick=()=>modal.openComposer(ACTIONS[a]);
    hotspot(frame,'mic','Konuş','mic').onclick=()=>{try{if(typeof root.toggleVoice==='function')root.toggleVoice();else modal.openComposer('')}catch(_){modal.openComposer('')}};
    hotspot(frame,'talk','Konuş').onclick=()=>modal.openComposer('');
    hotspot(frame,'listen','Dinle').onclick=()=>{try{if(typeof root.toggleVoice==='function')root.toggleVoice();else modal.openComposer('')}catch(_){modal.openComposer('')}};
    hotspot(frame,'think','Düşün').onclick=()=>{try{doc.dispatchEvent(new root.CustomEvent('jarvis:tri-core-hint',{detail:{role:'nova',state:'thinking',authority:'shared_guardrail_only'}}))}catch(_){}modal.openComposer('Bunu ayrıntılı düşün: ')};
    hotspot(frame,'apply','Uygula').onclick=()=>{const target=doc.getElementById('cmd');if(target&&String(target.value||'').trim()&&typeof root.send==='function')root.send();else modal.openComposer('')};
    hotspot(frame,'done','Tamamlandı').onclick=()=>modal.openText('AKTİF GÖREVLER',readPanel('tasks'));
    hotspot(frame,'tasks','Aktif Görevler').onclick=()=>modal.openText('AKTİF GÖREVLER',readPanel('tasks'));
    hotspot(frame,'feed','Son Bildirimler').onclick=()=>modal.openText('SON BİLDİRİMLER',readPanel('audit'));
    hotspot(frame,'connections','Bağlantılar').onclick=()=>modal.openText('BAĞLANTILAR',root.JarvisMobileReferenceV195?.diagnostics?.()||[doc.getElementById('pcState')?.textContent,doc.getElementById('systemState')?.textContent,doc.getElementById('remoteMode')?.textContent].filter(Boolean).join('\n'));
    doc.body.appendChild(rootEl);
    function sync(){rootEl.dataset.state=doc.body.classList.contains('speaking')?'speaking':(doc.body.dataset.jarvisCoreState||'idle');rootEl.dataset.core=doc.body.dataset.jarvisCore||'jarvis';rootEl.dataset.collab=doc.body.dataset.jarvisCoreCollab||'0'}
    sync();if(typeof root.MutationObserver==='function'){const observer=new root.MutationObserver(sync);observer.observe(doc.body,{attributes:true,attributeFilter:['class','data-jarvis-core','data-jarvis-core-state','data-jarvis-core-collab']})}
    doc.addEventListener('jarvis:core-state',sync);doc.addEventListener('jarvis:core-selected',sync);doc.addEventListener('jarvis:conversation-state',sync);
    return true;
  }
  function boot(){try{install()}catch(e){doc.body.dataset.referenceCockpit='error'}}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  root.JarvisReferenceCockpit=Object.freeze({VERSION,ASSET,install});
})(typeof window!=='undefined'?window:null);
