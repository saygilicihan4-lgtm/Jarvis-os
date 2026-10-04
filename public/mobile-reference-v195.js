(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const ROOT_ID='jarvisMobileCanonical';
  const NATIVE_ID='jarvisNativeMobileV190';
  const STYLE_ID='jarvisMobileReferenceV195Style';
  const VERSION='1.0';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  const ACTIONS=['newTask','youtube','shopify','files','apps','browser','settings','mic','tasks','feed','connections','talk','listen','think','apply','done'];
  let raf=0;

  function active(){try{return !!host.matchMedia(MEDIA).matches}catch(_){return false}}
  function viewport(){
    const vv=host.visualViewport;
    const w=Math.max(1,Math.round(Number(vv&&vv.width)||Number(host.innerWidth)||doc.documentElement.clientWidth||1));
    const h=Math.max(1,Math.round(Number(vv&&vv.height)||Number(host.innerHeight)||doc.documentElement.clientHeight||1));
    return{w,h};
  }
  function installStyle(){
    if(doc.getElementById(STYLE_ID))return;
    const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media (max-width:860px) and (orientation:portrait){
        html,body{margin:0!important;padding:0!important;background:#02060a!important;overflow:hidden!important}
        body[data-reference-cockpit-mobile="1"]{position:fixed!important;inset:0!important;width:var(--jv-mobile-vw,100vw)!important;height:var(--jv-mobile-vh,100dvh)!important;overflow:hidden!important;background:#02060a!important}
        #${ROOT_ID}{display:block!important;position:fixed!important;left:0!important;top:0!important;width:var(--jv-mobile-vw,100vw)!important;height:var(--jv-mobile-vh,100dvh)!important;overflow:hidden!important;background:#02060a!important;contain:layout paint size!important}
        #${NATIVE_ID}{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
        #${ROOT_ID}>.jm-blur,#${ROOT_ID}>.jm-vignette{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
        #${ROOT_ID}>.jm-frame{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:absolute!important;left:0!important;top:max(env(safe-area-inset-top),0px)!important;right:auto!important;bottom:auto!important;width:100%!important;height:calc(100% - max(env(safe-area-inset-top),0px) - max(env(safe-area-inset-bottom),0px))!important;aspect-ratio:auto!important;transform:none!important;background-position:center!important;background-size:100% 100%!important;background-repeat:no-repeat!important;box-shadow:none!important;overflow:hidden!important;isolation:isolate!important}
        #${ROOT_ID} .jm-copy{display:block!important;visibility:visible!important;opacity:.34!important;pointer-events:none!important;background-position:center!important;background-size:100% 100%!important;background-repeat:no-repeat!important}
        #${ROOT_ID} .jm-ring,#${ROOT_ID} .jm-wave{visibility:visible!important;pointer-events:none!important}
        #${ROOT_ID} .jm-hot{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;outline:none!important;background:transparent!important;box-shadow:none!important;border:0!important;cursor:pointer!important;z-index:90!important}
        #${ROOT_ID} .jm-hot:focus,#${ROOT_ID} .jm-hot:focus-visible,#${ROOT_ID} .jm-hot:active{outline:none!important;box-shadow:none!important;background:rgba(55,214,255,.035)!important}
        #${ROOT_ID} .jm-clock{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;right:2.4%!important;top:1.2%!important;width:31%!important;padding:1.2% 1.7%!important;background:linear-gradient(90deg,rgba(2,8,14,.18),rgba(2,8,14,.94) 28%,rgba(2,8,14,.98))!important;border-radius:8px!important}
        #${ROOT_ID} .jm-live-panel.show,#${ROOT_ID} .jm-pc-dot{visibility:visible!important;opacity:1!important;pointer-events:none!important}
        #${ROOT_ID} .jm-live-panel{background:linear-gradient(180deg,rgba(2,11,20,.96),rgba(1,6,12,.97))!important;border-color:rgba(69,223,255,.44)!important}
        #${ROOT_ID} .jm-i18n.show{visibility:visible!important;opacity:1!important;pointer-events:none!important}
        #${ROOT_ID} .jm-hot[data-a="newTask"]{left:2.2%!important;top:51.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="youtube"]{left:2.2%!important;top:55.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="shopify"]{left:2.2%!important;top:59.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="files"]{left:2.2%!important;top:63.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="apps"]{left:2.2%!important;top:67.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="browser"]{left:2.2%!important;top:71.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="settings"]{left:2.2%!important;top:75.7%!important;width:29.2%!important;height:4.2%!important}
        #${ROOT_ID} .jm-hot[data-a="mic"]{left:35.2%!important;top:56.1%!important;width:29.6%!important;height:16.5%!important;border-radius:50%!important}
        #${ROOT_ID} .jm-hot[data-a="tasks"]{left:64.0%!important;top:50.2%!important;width:34.0%!important;height:13.7%!important}
        #${ROOT_ID} .jm-hot[data-a="feed"]{left:64.0%!important;top:64.2%!important;width:34.0%!important;height:13.3%!important}
        #${ROOT_ID} .jm-hot[data-a="connections"]{left:54.2%!important;top:89.0%!important;width:43.8%!important;height:10.2%!important}
        #${ROOT_ID} .jm-hot[data-a="talk"]{left:4.0%!important;top:79.0%!important;width:18.0%!important;height:8.2%!important}
        #${ROOT_ID} .jm-hot[data-a="listen"]{left:23.0%!important;top:79.0%!important;width:18.0%!important;height:8.2%!important}
        #${ROOT_ID} .jm-hot[data-a="think"]{left:42.0%!important;top:78.7%!important;width:17.0%!important;height:8.7%!important}
        #${ROOT_ID} .jm-hot[data-a="apply"]{left:60.0%!important;top:79.0%!important;width:17.5%!important;height:8.2%!important}
        #${ROOT_ID} .jm-hot[data-a="done"]{left:78.0%!important;top:79.0%!important;width:18.0%!important;height:8.2%!important}
      }
    `;
    (doc.head||doc.documentElement).appendChild(s);
  }
  function sync(){
    raf=0;if(!active())return false;
    const v=viewport();
    doc.documentElement.style.setProperty('--jv-mobile-vw',v.w+'px');
    doc.documentElement.style.setProperty('--jv-mobile-vh',v.h+'px');
    const root=doc.getElementById(ROOT_ID),native=doc.getElementById(NATIVE_ID);
    if(native){native.hidden=true;native.setAttribute('aria-hidden','true')}
    if(!root)return false;
    root.dataset.referenceVersion=VERSION;root.dataset.hitTargets=String(root.querySelectorAll('.jm-hot[data-a]').length);root.setAttribute('aria-hidden','false');
    const frame=root.querySelector(':scope > .jm-frame');if(frame)frame.setAttribute('aria-hidden','false');
    for(const action of ACTIONS){const b=root.querySelector('.jm-hot[data-a="'+action+'"]');if(b){b.tabIndex=0;b.removeAttribute('aria-hidden');}}
    return true;
  }
  function schedule(){if(raf)return;raf=host.requestAnimationFrame?host.requestAnimationFrame(sync):host.setTimeout(sync,16)}
  function bind(){
    const root=doc.getElementById(ROOT_ID);if(!root||root.dataset.referenceTouchBound==='1')return;
    root.dataset.referenceTouchBound='1';
    root.addEventListener('pointerup',event=>{const b=event.target&&event.target.closest&&event.target.closest('.jm-hot[data-a]');if(!b)return;host.setTimeout(()=>{try{b.blur()}catch(_){}},0)},true);
  }
  function boot(attempt=0){
    if(!active())return false;
    installStyle();
    const root=doc.getElementById(ROOT_ID),frame=root&&root.querySelector(':scope > .jm-frame');
    if((!root||!frame)&&attempt<240){host.setTimeout(()=>boot(attempt+1),35);return false}
    bind();sync();return !!frame;
  }
  host.addEventListener('resize',schedule,{passive:true});
  host.addEventListener('orientationchange',()=>host.setTimeout(schedule,80),{passive:true});
  if(host.visualViewport){host.visualViewport.addEventListener('resize',schedule,{passive:true});host.visualViewport.addEventListener('scroll',schedule,{passive:true})}
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)schedule()});
  doc.addEventListener('jarvis:language-changed',schedule);
  host.JarvisMobileReferenceV195=Object.freeze({VERSION,MEDIA,ACTIONS,viewport,sync});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
