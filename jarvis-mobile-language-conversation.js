'use strict';
const lang=require('./jarvis-language-core');
const {createOutput}=require('./jarvis-language-turn-output');
const {createRouter}=require('./jarvis-tts-locale-router');
const triCore=require('./jarvis-tri-core-personality');
const relay=require('./jarvis-mobile-language-relay');
const VERSION='1.3';

function verifiedConsulted(generated,selected){
  const allowed=new Set(Array.isArray(selected&&selected.consultWith)?selected.consultWith:[]),out=[];
  for(const id of Array.isArray(generated&&generated.consultedWith)?generated.consultedWith:[]){
    if(!allowed.has(id)||!triCore.PROFILES[id])throw new Error('tri_core_consultation_contract_mismatch');
    if(!out.includes(id))out.push(id);
  }
  return out.slice(0,2);
}
function createEngine({output=createOutput(),voiceRouter=createRouter()}={}){
  async function turn({text,locale,inputSource='browser-speech',history=[]}={},options={}){
    const normalized=lang.normalizeLocale(locale),clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1800);
    if(!normalized)return{ok:false,state:'unsupported',reason:'invalid_locale',deviceE2eVerified:false};
    if(!clean)return{ok:false,state:'invalid',reason:'text_required',deviceE2eVerified:false};
    if(!['browser-speech','typed'].includes(String(inputSource||'')))return{ok:false,state:'invalid',reason:'input_source_not_allowed',deviceE2eVerified:false};
    const voice=await voiceRouter.resolve(normalized);
    if(!voice.ok)return{ok:false,state:'unsupported',reason:voice.reason,locale:normalized,...(voice.ttsCandidates?{ttsCandidates:voice.ttsCandidates}:{}),deviceE2eVerified:false};
    const ttsLocale=lang.normalizeLocale(voice.ttsLocale||voice.locale||normalized);
    if(!ttsLocale)return{ok:false,state:'unsupported',reason:'invalid_runtime_tts_locale',locale:normalized,deviceE2eVerified:false};
    const localeResolution=voice.localeResolution||(ttsLocale===normalized?'exact':null);
    const evidenceLevel=voice.evidenceLevel||'runtime_inventory';
    const crossLocale=ttsLocale!==normalized;
    if(!localeResolution||(crossLocale&&(normalized.includes('-')||ttsLocale.split('-')[0]!==normalized||localeResolution!=='unique_runtime_language_match'||evidenceLevel!=='runtime_inventory')))
      return{ok:false,state:'unsupported',reason:'runtime_tts_locale_evidence_mismatch',locale:normalized,deviceE2eVerified:false};
    const speech={ok:true,locale:normalized,sttLocale:null,ttsLocale,cost:0,fallbackUsed:false,ttsProvider:'edge-tts',voice:voice.voice,
      localeResolution,evidenceLevel};
    const context={locale:normalized,language:normalized.split('-')[0],source:'mobile_client_requested',sessionOnly:true};
    const selected=triCore.select(clean);
    const generated=await output.generate({text:clean,context,speech,history:relay.sanitizeHistory(history),core:selected,signal:options.signal});
    if(generated.locale!==normalized)throw new Error('reply_locale_mismatch');
    if(generated.core&&generated.core!==selected.core)throw new Error('tri_core_contract_mismatch');
    if(generated.authority&&generated.authority!=='shared_guardrail_only')throw new Error('tri_core_contract_mismatch');
    const consultedWith=verifiedConsulted(generated,selected);
    return{ok:true,state:'reply-ready',reply:generated.reply,locale:normalized,ttsLocale,localeResolution,voice:voice.voice,provider:'edge-tts',inputSource:String(inputSource),
      core:selected.core,role:selected.role,coreSource:selected.source,consultWith:consultedWith,consultationMode:'local_advisory_only',authority:'shared_guardrail_only',
      learning:false,languageEvidence:'client-requested-locale',speechEvidence:evidenceLevel,deviceE2eVerified:false};
  }
  return{turn};
}
module.exports={VERSION,verifiedConsulted,createEngine};
