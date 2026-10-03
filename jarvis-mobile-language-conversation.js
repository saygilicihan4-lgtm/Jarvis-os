'use strict';
const lang=require('./jarvis-language-core');
const {createOutput}=require('./jarvis-language-turn-output');
const {createRouter}=require('./jarvis-tts-locale-router');
const relay=require('./jarvis-mobile-language-relay');
const VERSION='1.0';

function createEngine({output=createOutput(),voiceRouter=createRouter()}={}){
  async function turn({text,locale,inputSource='browser-speech',history=[]}={},options={}){
    const normalized=lang.normalizeLocale(locale),clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1800);
    if(!normalized)return{ok:false,state:'unsupported',reason:'invalid_locale',deviceE2eVerified:false};
    if(!clean)return{ok:false,state:'invalid',reason:'text_required',deviceE2eVerified:false};
    if(!['browser-speech','typed'].includes(String(inputSource||'')))return{ok:false,state:'invalid',reason:'input_source_not_allowed',deviceE2eVerified:false};
    const voice=await voiceRouter.resolve(normalized);
    if(!voice.ok)return{ok:false,state:'unsupported',reason:voice.reason,locale:normalized,deviceE2eVerified:false};
    const speech={ok:true,locale:normalized,sttLocale:null,ttsLocale:normalized,cost:0,fallbackUsed:false,ttsProvider:'edge-tts',voice:voice.voice};
    const context={locale:normalized,language:normalized.split('-')[0],source:'mobile_client_requested',sessionOnly:true};
    const generated=await output.generate({text:clean,context,speech,history:relay.sanitizeHistory(history),signal:options.signal});
    if(generated.locale!==normalized)throw new Error('reply_locale_mismatch');
    return{ok:true,state:'reply-ready',reply:generated.reply,locale:normalized,voice:voice.voice,provider:'edge-tts',inputSource:String(inputSource),learning:false,languageEvidence:'client-requested-locale',deviceE2eVerified:false};
  }
  return{turn};
}
module.exports={VERSION,createEngine};
