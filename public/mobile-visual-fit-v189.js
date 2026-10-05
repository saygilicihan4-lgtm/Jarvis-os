(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const VERSION='4.0';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  function active(){try{return !!host.matchMedia(MEDIA).matches}catch(_){return false}}
  function ensureReference(attempt=0){
    if(!active()||doc.getElementById('jarvisMobileReferenceV195Script'))return;
    if(!doc.getElementById('jarvisNativeMobileV190')){if(attempt<220)host.setTimeout(()=>ensureReference(attempt+1),40);return}
    const script=doc.createElement('script');script.id='jarvisMobileReferenceV195Script';script.src='/mobile-reference-v195.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);
  }
  function ensureSessionSecurity(attempt=0){
    ensureReference();
    if(!active())return false;
    if(doc.getElementById('jarvisMobileSessionSecurityV195Script'))return true;
    if(!doc.getElementById('jarvisNativeMobileV190')&&attempt<220){host.setTimeout(()=>ensureSessionSecurity(attempt+1),40);return false}
    const script=doc.createElement('script');script.id='jarvisMobileSessionSecurityV195Script';script.src='/mobile-session-security-v195.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  function ensureViewport(attempt=0){
    if(!active())return false;
    const existing=doc.getElementById('jarvisMobileViewportV192Script');
    if(existing){ensureSessionSecurity(0);return true}
    if(!doc.getElementById('jarvisNativeMobileV190')&&attempt<220){host.setTimeout(()=>ensureViewport(attempt+1),40);return false}
    const script=doc.createElement('script');script.id='jarvisMobileViewportV192Script';script.src='/mobile-viewport-v192.js';script.async=false;
    script.addEventListener('load',()=>ensureSessionSecurity(0),{once:true});
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  function boot(attempt=0){
    if(!active())return false;
    if(!doc.getElementById('jarvisMobileCanonical')&&attempt<180){host.setTimeout(()=>boot(attempt+1),50);return false}
    let script=doc.getElementById('jarvisMobileNativeV190Script');
    if(!script){
      script=doc.createElement('script');script.id='jarvisMobileNativeV190Script';script.src='/mobile-native-v190.js';script.async=false;
      script.addEventListener('load',()=>ensureViewport(0),{once:true});
      (doc.head||doc.documentElement).appendChild(script);
    }else ensureViewport(0);
    return true;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
