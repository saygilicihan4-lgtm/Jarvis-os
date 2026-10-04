(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const ROOT_ID='jarvisMobileCanonical';
  const STYLE_ID='jarvisMobileVisualFitV189';
  const VERSION='1.0';

  function mobilePortrait(){
    try{return !!host.matchMedia('(max-width: 860px) and (orientation: portrait)').matches}catch(_){return false}
  }
  function locale(){
    return String(doc.getElementById('jarvisReferenceCockpit')?.dataset.locale||doc.documentElement.lang||'tr-TR');
  }
  function syncViewport(){
    const h=Math.max(1,Math.round(host.visualViewport?.height||host.innerHeight||doc.documentElement.clientHeight||1));
    const w=Math.max(1,Math.round(host.visualViewport?.width||host.innerWidth||doc.documentElement.clientWidth||1));
    doc.documentElement.style.setProperty('--jm-screen-h',h+'px');
    doc.documentElement.style.setProperty('--jm-screen-w',w+'px');
    const root=doc.getElementById(ROOT_ID);
    if(root){
      root.dataset.fitVersion=VERSION;
      root.dataset.locale=locale();
      root.dataset.bakedOverlay=/^tr(?:-|$)/i.test(locale())?'1':'0';
    }
  }
  function installStyle(){
    if(doc.getElementById(STYLE_ID))return;
    const style=doc.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media (max-width:860px) and (orientation:portrait){
        html,body{margin:0!important;width:100%!important;min-width:100%!important;height:100%!important;min-height:100%!important;background:#02060a!important;overscroll-behavior:none!important}
        body[data-reference-cockpit-mobile="1"]{overflow:hidden!important;position:fixed!important;inset:0!important;width:100vw!important;height:var(--jm-screen-h,100dvh)!important;touch-action:manipulation!important}
        #${ROOT_ID}{inset:0!important;width:100vw!important;width:var(--jm-screen-w,100vw)!important;height:100dvh!important;height:var(--jm-screen-h,100dvh)!important;background:#02060a!important;overflow:hidden!important;contain:layout paint size!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important}
        #${ROOT_ID} .jm-blur{display:none!important}
        #${ROOT_ID} .jm-vignette{display:none!important}
        #${ROOT_ID} .jm-frame{left:0!important;top:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;transform:none!important;background-position:center!important;background-size:100% 100%!important;background-repeat:no-repeat!important;box-shadow:none!important;filter:contrast(1.045) saturate(1.025)!important;image-rendering:auto!important;-webkit-transform:translateZ(0)!important;transform:translateZ(0)!important}
        #${ROOT_ID} .jm-frame:after{opacity:.28!important}
        #${ROOT_ID} .jm-copy{background-position:center!important;background-size:100% 100%!important;background-repeat:no-repeat!important;opacity:.10!important;mix-blend-mode:screen!important;image-rendering:auto!important}
        #${ROOT_ID}[data-state="speaking"] .jm-copy.jarvis{opacity:.48!important}
        #${ROOT_ID}[data-state="listening"] .jm-copy.jarvis{opacity:.38!important}
        #${ROOT_ID}[data-core="nova"] .jm-copy.nova,#${ROOT_ID}[data-core="orion"] .jm-copy.orion{opacity:.42!important}
        #${ROOT_ID}[data-baked-overlay="1"] .jm-clock,#${ROOT_ID}[data-baked-overlay="1"] .jm-live-panel,#${ROOT_ID}[data-baked-overlay="1"] .jm-pc-dot{display:none!important}
        #${ROOT_ID} .jm-hot{outline:none!important;border:0!important;background:transparent!important;box-shadow:none!important;-webkit-appearance:none!important;appearance:none!important;-webkit-tap-highlight-color:transparent!important;touch-action:manipulation!important;color:transparent!important}
        #${ROOT_ID} .jm-hot:hover,#${ROOT_ID} .jm-hot:focus,#${ROOT_ID} .jm-hot:focus-visible,#${ROOT_ID} .jm-hot:active{outline:none!important;border:0!important;background:transparent!important;box-shadow:none!important;color:transparent!important;-webkit-tap-highlight-color:transparent!important}
        @media (hover:none) and (pointer:coarse){
          #${ROOT_ID} .jm-hot,#${ROOT_ID} .jm-hot:hover,#${ROOT_ID} .jm-hot:focus,#${ROOT_ID} .jm-hot:focus-visible,#${ROOT_ID} .jm-hot:active{outline:none!important;background:transparent!important;box-shadow:none!important;filter:none!important}
        }
      }
    `;
    (doc.head||doc.documentElement).appendChild(style);
  }
  function bindTouchBlur(root){
    if(!root||root.dataset.touchBlurBound==='1')return;
    root.dataset.touchBlurBound='1';
    const clearFocus=event=>{
      const button=event.target&&event.target.closest&&event.target.closest('.jm-hot');
      if(!button)return;
      host.setTimeout(()=>{try{button.blur()}catch(_){}},0);
    };
    root.addEventListener('pointerup',clearFocus,true);
    root.addEventListener('touchend',clearFocus,{capture:true,passive:true});
    root.addEventListener('click',clearFocus,true);
  }
  function boot(attempt=0){
    if(!mobilePortrait())return false;
    installStyle();syncViewport();
    const root=doc.getElementById(ROOT_ID);
    if(!root&&attempt<160){host.setTimeout(()=>boot(attempt+1),50);return false}
    if(root){bindTouchBlur(root);syncViewport();}
    return !!root;
  }

  host.addEventListener('resize',syncViewport,{passive:true});
  host.addEventListener('orientationchange',()=>host.setTimeout(syncViewport,80),{passive:true});
  if(host.visualViewport)host.visualViewport.addEventListener('resize',syncViewport,{passive:true});
  doc.addEventListener('jarvis:language-changed',syncViewport);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
