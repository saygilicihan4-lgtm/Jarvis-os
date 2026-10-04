(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const VERSION='2.0';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  function boot(attempt=0){
    let active=false;try{active=!!host.matchMedia(MEDIA).matches}catch(_){}
    if(!active)return false;
    if(doc.getElementById('jarvisMobileNativeV190Script'))return true;
    if(!doc.getElementById('jarvisMobileCanonical')&&attempt<180){host.setTimeout(()=>boot(attempt+1),50);return false}
    const script=doc.createElement('script');script.id='jarvisMobileNativeV190Script';script.src='/mobile-native-v190.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(0),{once:true});else boot(0);
})(typeof window!=='undefined'?window:null);
