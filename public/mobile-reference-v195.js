/* v196: responsive reference artwork + real DOM controls. No execution authority. */
(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document,VERSION='2.0',STAGE_ID='jarvisNativeMobileV190';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  const ACTIONS=['newTask','youtube','shopify','files','apps','browser','settings','mic','tasks','feed','connections','talk','listen','think','apply','done'];
  const PATHS={
    newTask:'M12 4v16M4 12h16',youtube:'M9 7l8 5-8 5z',shopify:'M5 7h14l2 14H3L5 7zM8 8V6a4 4 0 018 0v2M15 11c-6-3-7 3-2 3s4 6-3 3',
    files:'M3 6h7l2 3h9v12H3zM3 6V3h7l2 3h8v3',apps:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    browser:'M12 2a10 10 0 100 20 10 10 0 000-20M2 12h20M12 2c-6 6-6 14 0 20M12 2c6 6 6 14 0 20',
    settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM12 8a4 4 0 100 8 4 4 0 000-8',
    mic:'M8 5a4 4 0 018 0v7a4 4 0 01-8 0zM5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8',
    talk:'M2 10v4M6 6v12M10 2v20M14 5v14M18 8v8M22 10v4',listen:'M2 10v4M6 7v10M10 3l-2 18M14 3l2 18M18 7v10M22 10v4',
    think:'M9 20c-4 3-7-1-6-4-4-3-1-7 1-7-1-4 3-7 6-4 3-3 7 0 6 3 5 1 5 6 2 8 1 4-3 6-6 4M12 5v15M6 9l3 2-1 4M18 10l-3 2 1 4',
    apply:'M4 7h16M4 12h16M4 17h16M8 4v6M16 9v6M10 14v6',done:'M4 12l5 6L21 4',
    pc:'M2 3h20v14H2zM12 17v4M7 21h10',phone:'M7 2h10v20H7zM10 19h4',cloud:'M6 19a5 5 0 010-10 6 6 0 0112-1 6 6 0 010 11z',internet:'M12 2a10 10 0 100 20 10 10 0 000-20M2 12h20M12 2c-6 6-6 14 0 20M12 2c6 6 6 14 0 20'
  };
  const CAPS={nova:['strategy','ideas','risk','planning','chat'],jarvis:['mission','pcControl','youtubeCreate','shopifyManage','appDev','automation'],orion:['research','technical','codeDev','data','expert']};
  const CROPS={nova:[72,204,350],jarvis:[391,184,430],orion:[809,202,350]};
  let stage=null,layout=null,installed=false,raf=0,timer=0,lastState=null,lastStateAt=0,lastLocale='',returnFocus=null,observer=null;
  function mobile(){return host.matchMedia(MEDIA).matches}
  function t(key){return host.JarvisCockpitI18n?.t(key)||key}
  function el(tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(PATHS[name]||PATHS.done)+'"/></svg>'}
  function label(node,key){node.dataset.i18n=key;node.textContent=t(key);return node}
  function button(action,key,cls=''){const n=el('button','jr-button '+cls);n.type='button';n.dataset.a=action;n.innerHTML=icon(action);n.appendChild(label(el('span'),key));return n}
  function artCrop(name){const [x,y,size]=CROPS[name];return '<svg class="jr-sphere-art" viewBox="'+x+' '+y+' '+size+' '+size+'" aria-hidden="true" focusable="false"><image href="/mobile-reference-art.jpg" width="1221" height="1288"/></svg>'}
  function viewport(){const v=host.visualViewport;return {width:v?.width||host.innerWidth,height:v?.height||host.innerHeight,left:v?.offsetLeft||0,top:v?.offsetTop||0,scale:v?.scale||1}}
  function percent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):null}
  function viewportSync(){
    raf=0;if(!stage||!mobile())return;
    const v=viewport(),s=doc.documentElement.style;
    s.setProperty('--jv-mobile-vw',v.width+'px');s.setProperty('--jv-mobile-vh',v.height+'px');
    s.setProperty('--jr-left',v.left+'px');s.setProperty('--jr-top',v.top+'px');
    stage.dataset.compact=String(v.height<650);stage.dataset.viewportWidth=String(v.width);stage.dataset.viewportHeight=String(v.height);
  }
  function schedule(){if(!raf)raf=host.requestAnimationFrame(viewportSync)}
  function panelTitle(action,key){const b=button(action,key,'jr-panel-title');b.innerHTML='';b.appendChild(label(el('span'),key));b.appendChild(el('small','', '↗'));return b}
  function build(){
    layout=el('div','jr-layout');layout.dir='ltr';
    for(const [name,x,w] of [['left',0,87],['right',1140,81]]){
      const scenery=el('div','jr-environment '+name);scenery.setAttribute('aria-hidden','true');scenery.innerHTML='<svg viewBox="'+x+' 80 '+w+' 585" preserveAspectRatio="none"><defs><clipPath id="jr-wall-'+name+'"><rect x="'+x+'" y="80" width="'+w+'" height="585"/></clipPath></defs><image clip-path="url(#jr-wall-'+name+')" href="/mobile-reference-art.jpg" width="1221" height="1288"/></svg>';stage.appendChild(scenery);
    }
    const header=el('header','jr-header');
    const brand=el('div','jr-brand');brand.append(el('b','','JARVIS'),label(el('small'),'smart'));
    const wave=el('div','jr-listening');wave.append(label(el('span','jr-state-label'),'ready'));const bars=el('div','jr-wave');bars.setAttribute('aria-hidden','true');
    for(let i=0;i<37;i++){const b=el('i');b.style.setProperty('--bar',String(18+Math.abs(Math.sin(i*7.13)*Math.cos(i*.45))*82)+'%');b.style.animationDelay=String(i*-.09)+'s';bars.appendChild(b)}wave.appendChild(bars);
    const status=el('div','jr-status');status.innerHTML='<time class="jr-time"></time><span class="jr-date"></span><span class="jr-online"><i class="jr-dot"></i><span></span></span>';
    header.append(brand,wave,status);layout.appendChild(header);
    const cores=el('div','jr-cores');cores.setAttribute('aria-label','NOVA · JARVIS · ORION');
    for(const [name,role] of [['nova','advisor'],['jarvis','executor'],['orion','specialist']]){
      const core=el('section','jr-core '+name),title=el('div','jr-core-title');title.append(el('b','',name.toUpperCase()),label(el('small'),role));
      const sphere=el('div','jr-sphere');sphere.setAttribute('aria-hidden','true');sphere.innerHTML=artCrop(name)+'<div class="jr-sparks"></div><div class="jr-orbit"></div><div class="jr-orbit second"></div><div class="jr-beam"></div>';
      core.append(title,sphere);cores.appendChild(core);
    }layout.appendChild(cores);
    const caps=el('div','jr-capabilities');for(const [name,keys] of Object.entries(CAPS)){const card=el('section','jr-card '+name),ul=el('ul');for(const key of keys){const li=label(el('li'),key);ul.appendChild(li)}card.appendChild(ul);caps.appendChild(card)}layout.appendChild(caps);
    const work=el('div','jr-work'),quick=el('section','jr-panel jr-quick');quick.appendChild(label(el('h2'),'quick'));const nav=el('nav');nav.setAttribute('aria-label',t('quick'));nav.dataset.i18nAria='quick';
    for(const key of ACTIONS.slice(0,7))nav.appendChild(button(key,key,'jn-btn'));quick.appendChild(nav);
    const center=el('div','jr-center');center.innerHTML='<div class="jr-projector" aria-hidden="true">'+[0,1,2].map(i=>'<svg style="--level:'+i+'" viewBox="280 735 605 122" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="jr-deck-'+i+'"><rect x="280" y="742" width="605" height="88"/></clipPath></defs><image clip-path="url(#jr-deck-'+i+')" href="/mobile-reference-art.jpg" width="1221" height="1288"/></svg>').join('')+'</div>';
    const mic=button('mic','talk','jr-mic');mic.setAttribute('aria-pressed','false');mic.querySelector('span').className='jr-sr-only';center.append(mic,el('b','jr-center-brand','JARVIS'),label(el('small','jr-prompt'),'speakPrompt'));
    const right=el('div','jr-right');for(const [a,key] of [['tasks','activeTasks'],['feed','notifications']]){const p=el('section','jr-panel');p.appendChild(panelTitle(a,key));const list=el('div','jr-live');list.dataset.live=a;p.appendChild(list);right.appendChild(p)}
    work.append(quick,center,right);layout.appendChild(work);
    const actions=el('nav','jr-actions');for(const key of ['talk','listen','think','apply','done'])actions.appendChild(button(key,key));layout.appendChild(actions);
    const footer=el('footer','jr-footer'),meters=el('section','jr-panel jr-meters');meters.setAttribute('aria-label','PC CPU RAM DISK');
    for(const key of ['cpu','ram','disk']){const m=el('div','jr-meter');m.dataset.metric=key;m.append(el('span','',key.toUpperCase()),el('b','','—'));meters.appendChild(m)}
    const connections=button('connections','connections','jr-panel jr-connections');connections.innerHTML='';connections.appendChild(label(el('h2'),'connections'));const links=el('div','jr-links');
    for(const key of ['pc','phone','cloud','internet']){const item=el('div','jr-link');item.innerHTML=icon(key);item.appendChild(key==='pc'?el('span','','PC'):label(el('span'),key));const dot=el('i','jr-dot');dot.dataset.connection=key;item.appendChild(dot);links.appendChild(item)}connections.appendChild(links);footer.append(meters,connections);layout.appendChild(footer);
    const old=stage.querySelector('.jn-layer');if(old)old.remove();stage.prepend(layout);stage.classList.add('jr-enhanced');stage.dataset.referenceVersion=VERSION;
  }
  function localeSync(){
    if(!layout)return;const locale=doc.documentElement.lang||'tr-TR';lastLocale=locale;
    for(const n of layout.querySelectorAll('[data-i18n]'))n.textContent=t(n.dataset.i18n);
    for(const n of layout.querySelectorAll('[data-i18n-aria]'))n.setAttribute('aria-label',t(n.dataset.i18nAria));
    layout.dataset.dir=doc.documentElement.dir||'ltr';clock();stateSync();liveSync();
  }
  function clock(){try{const loc=doc.documentElement.lang||'tr-TR';layout.querySelector('.jr-time').textContent=new Intl.DateTimeFormat(loc,{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());layout.querySelector('.jr-date').textContent=new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',year:'numeric'}).format(new Date())}catch(_){}}
  function stateSync(){
    if(!stage)return;const state=doc.body.classList.contains('speaking')?'speaking':doc.body.dataset.jarvisCoreState||'idle';
    stage.dataset.state=state;stage.dataset.core=doc.body.dataset.jarvisCore||'jarvis';
    layout.querySelector('.jr-state-label').textContent=t({listening:'listening',speaking:'speaking',thinking:'thinking',executing:'executing'}[state]||'ready');
    layout.querySelector('[data-a="mic"]').setAttribute('aria-pressed',String(state==='listening'));
    for(const b of layout.querySelectorAll('.jr-actions button'))b.dataset.active=String(({speaking:'talk',listening:'listen',thinking:'think',executing:'apply',done:'done'})[state]===b.dataset.a);
  }
  function rows(node,items,kind){
    node.replaceChildren();if(!items.length){node.appendChild(el('p','jr-empty',t(kind==='tasks'?'noTasks':'noNotifications')));return}
    for(const item of items.slice(0,3)){
      const row=el('div','jr-live-row'),line=el('span','jr-live-label',String(item.label||item.command||item.message||item.title||''));line.title=line.textContent;row.appendChild(line);
      const p=percent(item.progress);if(p!==null){const bar=el('progress');bar.max=100;bar.value=p;bar.setAttribute('aria-label',line.textContent);row.appendChild(bar)}
      else if(kind==='tasks'){const status=String(item.status||'');const key={pending:'pending',running:'executing',claimed:'executing',waiting_worker:'waitingPc',waiting_dependency:'waitingDependency',queued:'pending',failed:'failed'}[status];if(key)row.appendChild(el('small','',t(key)))}
      else if(item.at){const time=new Date(item.at);if(!Number.isNaN(time.valueOf()))row.appendChild(el('small','',new Intl.DateTimeFormat(doc.documentElement.lang||'tr',{hour:'2-digit',minute:'2-digit'}).format(time)))}
      node.appendChild(row);
    }
  }
  function connection(key,value){const n=layout.querySelector('[data-connection="'+key+'"]');n.dataset.online=value===null?'unknown':String(value);n.title=t(value===null?'unknown':value?'online':'offline')}
  function liveSync(){
    if(!layout)return;const fresh=lastState&&Date.now()-lastStateAt<12000,pc=fresh?lastState.workers?.pc:null;
    const active=x=>!['completed','done','cancelled','canceled'].includes(x.status);
    const tasks=fresh?(pc?.missions?.queue||[]).filter(active).concat((lastState.tasks||[]).filter(active)):[];
    rows(layout.querySelector('[data-live="tasks"]'),tasks,'tasks');rows(layout.querySelector('[data-live="feed"]'),fresh?[...(lastState.audit||[])].reverse():[],'feed');
    connection('pc',fresh?pc?.online===true:null);connection('phone',true);connection('cloud',fresh?true:null);connection('internet',host.navigator.onLine===false?false:null);
    const online=layout.querySelector('.jr-online');online.querySelector('span').textContent=t(fresh?'online':host.navigator.onLine===false?'offline':'connecting');online.querySelector('i').dataset.online=fresh?'true':'unknown';
    for(const key of ['cpu','ram','disk']){const n=layout.querySelector('[data-metric="'+key+'"]'),value=pc?.online===true?percent(pc.metrics?.[key]):null;n.querySelector('b').textContent=value===null?'—':value+'%';n.style.setProperty('--value',value===null?'0%':value+'%');n.title=value===null?t('unavailable'):key.toUpperCase()+' '+value+'%'}
  }
  function proxy(action){
    const b=doc.querySelector('#jarvisMobileCanonical .jm-hot[data-a="'+action+'"]');
    if(!b||b.disabled)return false;b.click();return true;
  }
  function bind(){
    stage.addEventListener('click',e=>{const b=e.target.closest?.('.jr-button[data-a]');if(!b||!layout.contains(b))return;returnFocus=b;
      // Keep the v195 capture listener's session-security authority boundary.
      const action=b.dataset.a;if(!proxy(action)){const n=layout.querySelector('.jr-state-label');n.textContent=t('unavailable')}
      if(e.detail>0)b.blur();
    });
    // Legacy command/details modals are siblings of the mobile root. Raise them
    // above it, restore focus and trap keyboard focus while the dialog is open.
    const modal=doc.querySelector('#jarvisReferenceCockpit > .ref-modal');
    if(modal){observer=new host.MutationObserver(()=>{
      const open=modal.classList.contains('open');stage.inert=open;
      modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',modal.querySelector('h3')?.textContent||'JARVIS');
      if(!open&&returnFocus){returnFocus.focus({preventScroll:true});returnFocus=null}
    });observer.observe(modal,{attributes:true,attributeFilter:['class']});
    modal.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...modal.querySelectorAll('button,textarea,input,[tabindex="0"]')].filter(n=>!n.disabled);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus()}})}
  }
  function install(){
    if(installed||!mobile())return installed;stage=doc.getElementById(STAGE_ID);if(!stage)return false;
    build();installed=true;bind();localeSync();viewportSync();
    doc.addEventListener('jarvis:cockpit-locale',localeSync);
    doc.addEventListener('jarvis:conversation-state',stateSync);
    doc.addEventListener('jarvis:dashboard-state',e=>{lastState=e.detail;lastStateAt=Date.now();liveSync()});
    new host.MutationObserver(stateSync).observe(doc.body,{attributes:true,attributeFilter:['class','data-jarvis-core','data-jarvis-core-state']});
    host.addEventListener('resize',schedule,{passive:true});host.addEventListener('orientationchange',schedule,{passive:true});
    host.visualViewport?.addEventListener('resize',schedule,{passive:true});host.visualViewport?.addEventListener('scroll',schedule,{passive:true});
    host.addEventListener('online',liveSync);host.addEventListener('offline',liveSync);
    timer=host.setInterval(()=>{if(doc.hidden)return;if(lastLocale!==doc.documentElement.lang)localeSync();clock();stateSync();liveSync()},2000);
    return true;
  }
  function boot(attempt=0){if(!mobile())return;if(!install()&&attempt<220)host.setTimeout(()=>boot(attempt+1),40)}
  function load(){const link=el('link');link.rel='stylesheet';link.href='/mobile-reference-v196.css';link.onload=()=>boot();link.onerror=()=>{doc.body.dataset.mobileReferenceError='style_unavailable'};doc.head.appendChild(link)}
  host.JarvisMobileReferenceV195=Object.freeze({VERSION,MEDIA,ACTIONS,viewport,percent,install,get installed(){return installed}});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',load,{once:true});else load();
})(typeof window!=='undefined'?window:null);
