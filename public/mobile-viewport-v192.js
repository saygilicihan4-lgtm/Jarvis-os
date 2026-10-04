(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const ROOT_ID='jarvisMobileCanonical';
  const STAGE_ID='jarvisNativeMobileV190';
  const STYLE_ID='jarvisMobileViewportV192Style';
  const VERSION='1.0';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  let raf=0;

  function mobile(){try{return !!host.matchMedia(MEDIA).matches}catch(_){return false}}
  function px(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:fallback}
  function viewport(){
    const vv=host.visualViewport;
    return{
      width:px(vv&&vv.width,px(host.innerWidth,doc.documentElement.clientWidth||1)),
      height:px(vv&&vv.height,px(host.innerHeight,doc.documentElement.clientHeight||1)),
      scale:px(vv&&vv.scale,1)
    };
  }
  function sync(){
    raf=0;if(!mobile())return false;
    const v=viewport(),root=doc.getElementById(ROOT_ID),stage=doc.getElementById(STAGE_ID);
    doc.documentElement.style.setProperty('--jv-mobile-vw',v.width+'px');
    doc.documentElement.style.setProperty('--jv-mobile-vh',v.height+'px');
    doc.documentElement.style.setProperty('--jv-mobile-scale',String(v.scale));
    if(root){root.dataset.viewportVersion=VERSION;root.dataset.viewportWidth=String(Math.round(v.width));root.dataset.viewportHeight=String(Math.round(v.height));}
    if(stage){stage.dataset.viewportVersion=VERSION;stage.dataset.viewportWidth=String(Math.round(v.width));stage.dataset.viewportHeight=String(Math.round(v.height));}
    return !!stage;
  }
  function schedule(){if(raf)return;raf=host.requestAnimationFrame?host.requestAnimationFrame(sync):host.setTimeout(sync,16)}
  function installStyle(){
    if(doc.getElementById(STYLE_ID))return;
    const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media (max-width:860px) and (orientation:portrait){
        html{margin:0!important;padding:0!important;width:100%!important;height:var(--jv-mobile-vh,100dvh)!important;min-height:0!important;overflow:hidden!important;background:#02070b!important}
        body[data-reference-cockpit-mobile="1"]{margin:0!important;padding:0!important;position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:var(--jv-mobile-vw,100vw)!important;height:var(--jv-mobile-vh,100dvh)!important;min-height:0!important;max-height:none!important;overflow:hidden!important;overscroll-behavior:none!important;background:#02070b!important;-webkit-text-size-adjust:100%!important}
        #${ROOT_ID}{position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:var(--jv-mobile-vw,100vw)!important;height:var(--jv-mobile-vh,100dvh)!important;min-height:0!important;max-height:none!important;overflow:hidden!important;background:#02070b!important;contain:layout paint size!important}
        #${STAGE_ID}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow:hidden!important;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;-webkit-tap-highlight-color:transparent!important}
        #${ROOT_ID}>.jm-frame,#${ROOT_ID}>.jm-blur,#${ROOT_ID}>.jm-vignette{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
        #${ROOT_ID} .jm-clock,#${ROOT_ID} .jm-live-panel,#${ROOT_ID} .jm-pc-dot,#${ROOT_ID} .jm-i18n,#${ROOT_ID} .jm-ring,#${ROOT_ID} .jm-copy,#${ROOT_ID} .jm-wave{visibility:hidden!important;pointer-events:none!important}
        #${STAGE_ID} button,#${STAGE_ID} [role="button"]{-webkit-tap-highlight-color:transparent!important;touch-action:manipulation}
        @media (hover:none) and (pointer:coarse){
          #${STAGE_ID} button:focus,#${STAGE_ID} button:focus-visible,#${STAGE_ID} [role="button"]:focus,#${STAGE_ID} [role="button"]:focus-visible{outline:none!important;box-shadow:inherit}
        }
      }
    `;
    (doc.head||doc.documentElement).appendChild(s);
  }
  function bindBlur(stage){
    if(!stage||stage.dataset.viewportTouchBound==='1')return;
    stage.dataset.viewportTouchBound='1';
    stage.addEventListener('pointerup',event=>{
      let coarse=false;try{coarse=!!host.matchMedia('(hover:none) and (pointer:coarse)').matches}catch(_){}
      if(!coarse)return;
      const button=event.target&&event.target.closest&&event.target.closest('button,[role="button"]');
      if(button)host.setTimeout(()=>{try{button.blur()}catch(_){}},0);
    },true);
  }
  function boot(attempt=0){
    if(!mobile())return false;
    installStyle();sync();
    const stage=doc.getElementById(STAGE_ID);
    if(!stage&&attempt<200){host.setTimeout(()=>boot(attempt+1),40);return false}
    if(stage){bindBlur(stage);sync();}
    return !!stage;
  }

  host.addEventListener('resize',schedule,{passive:true});
  host.addEventListener('orientationchange',()=>host.setTimeout(schedule,80),{passive:true});
  if(host.visualViewport){host.visualViewport.addEventListener('resize',schedule,{passive:true});host.visualViewport.addEventListener('scroll',schedule,{passive:true});}
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)schedule()});
  doc.addEventListener('jarvis:language-changed',schedule);
  host.JarvisMobileViewportV192=Object.freeze({VERSION,MEDIA,viewport,sync});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
