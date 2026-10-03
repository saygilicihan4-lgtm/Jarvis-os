'use strict';
const VERSION='1.0';
const ALIASES=Object.freeze({tr:'tr-TR',en:'en-US',de:'de-DE',fr:'fr-FR',es:'es-ES',it:'it-IT',pt:'pt-BR',ru:'ru-RU',ar:'ar-SA',ja:'ja-JP',ko:'ko-KR',zh:'zh-CN',hi:'hi-IN'});
// Canonicalization preserves scripts/variants; syntax alone proves no speech support.
function normalizeLocale(value){
  if(typeof value!=='string')return null;
  const input=value.trim().replace(/_/g,'-');
  if(!input||input.length>64||!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(input))return null;
  try{
    const locale=Intl.getCanonicalLocales(ALIASES[input.toLowerCase()]||input)[0];
    return locale==='und'?null:locale;
  }catch(_){return null}
}
function validConfidence(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1}
function resolveLanguage({requested,detected,profileLocale,systemLocale}={}){
  for(const [source,value] of [['requested',requested],['detected',detected],['profile',profileLocale],['system',systemLocale]]){
    const locale=normalizeLocale(value);
    if(locale)return{ok:true,locale,language:locale.split('-')[0],source};
  }
  return{ok:true,locale:'en-US',language:'en',source:'fallback'};
}
function speechPlan(input={}){
  const result=resolveLanguage(input);
  return{...result,sttLocale:result.locale,ttsLocale:result.locale,fallbackAllowed:true,requireExplicitFallbackNotice:true};
}
module.exports={VERSION,ALIASES,normalizeLocale,validConfidence,resolveLanguage,speechPlan};
