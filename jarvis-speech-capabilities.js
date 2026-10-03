'use strict';
const lang=require('./jarvis-language-core');
const VERSION='1.2';
function createRegistry({now=Date.now}={}){
  const providers=new Map();
  function registerProvider(name,{sttLocales=[],ttsLocales=[],sttLanguages=[],voices=[],offline=false,cost=null,evidence=null}={}){
    if(typeof name!=='string'||!name||name.length>80)throw new Error('provider_name_required');
    const locales=values=>new Set((Array.isArray(values)?values:[]).map(lang.normalizeLocale).filter(Boolean));
    const cleanVoices=(Array.isArray(voices)?voices:[]).filter(v=>v&&typeof v.id==='string'&&v.id.length>0&&v.id.length<=200&&lang.normalizeLocale(v.locale))
      .map(v=>({id:v.id,locale:lang.normalizeLocale(v.locale),gender:String(v.gender||'')}));
    providers.set(name,{stt:locales(sttLocales),tts:locales(ttsLocales),languages:new Set((Array.isArray(sttLanguages)?sttLanguages:[]).filter(x=>typeof x==='string'&&/^[a-z]{2,3}$/.test(x))),
      voices:cleanVoices,offline:offline===true,cost,evidence:evidence&&{...evidence},observedAt:now()});
    return true;
  }
  function fresh(p){return p&&now()-p.observedAt>=0&&now()-p.observedAt<=300000}
  function supports(name,kind,locale){
    const p=providers.get(name),n=lang.normalizeLocale(locale);
    return !!(n&&fresh(p)&&(p[kind]?.has(n)||(kind==='stt'&&p.languages.has(n.split('-')[0]))));
  }
  function resolveRuntimeTtsLocale(provider,locale){
    const n=lang.normalizeLocale(locale);
    if(!n||!provider)return{ok:false,reason:'invalid_locale'};
    if(provider.tts.has(n))return{ok:true,ttsLocale:n,resolution:'exact'};
    // A region-bearing locale is an explicit constraint. Never substitute a
    // sibling region (for example nl-BE -> nl-NL) without user confirmation.
    if(n.includes('-'))return{ok:false,reason:'runtime_tts_locale_not_exact'};
    const matches=[...provider.tts].filter(x=>x.split('-')[0]===n).sort();
    if(matches.length===1)return{ok:true,ttsLocale:matches[0],resolution:'unique_runtime_language_match'};
    if(matches.length>1)return{ok:false,reason:'runtime_tts_language_ambiguous',candidates:matches};
    return{ok:false,reason:'runtime_tts_language_unavailable'};
  }
  function plan({locale,sttProvider,ttsProvider,fallbackLocale='en-US'}={}){
    const n=lang.normalizeLocale(locale),fb=lang.normalizeLocale(fallbackLocale);
    if(!n)return{ok:false,reason:'invalid_locale'};
    const sttOk=supports(sttProvider,'stt',n),ttsOk=supports(ttsProvider,'tts',n);
    if(sttOk&&ttsOk)return{ok:true,locale:n,sttLocale:n,ttsLocale:n,fallbackUsed:false};
    const available=!!fb&&supports(sttProvider,'stt',fb)&&supports(ttsProvider,'tts',fb);
    return{ok:false,reason:'speech_locale_not_fully_supported',locale:n,sttSupported:sttOk,ttsSupported:ttsOk,fallbackAvailable:available,fallbackLocale:available?fb:null,requireExplicitFallbackNotice:true};
  }
  function select({locale,offlineOnly=false}={}){
    const n=lang.normalizeLocale(locale);
    if(!n)return{ok:false,reason:'invalid_locale'};
    const eligible=[...providers].filter(([,p])=>fresh(p)&&p.cost===0&&(!offlineOnly||p.offline));
    const stt=eligible.find(([name,p])=>p.evidence?.source==='loaded_model_inventory'&&supports(name,'stt',n));
    const ttsResolved=eligible.filter(([,p])=>p.evidence?.source==='runtime_voice_inventory')
      .map(([name,p])=>[name,p,resolveRuntimeTtsLocale(p,n)]);
    const tts=ttsResolved.filter(([, ,resolution])=>resolution.ok)
      .sort(([a],[b])=>(a==='edge-tts'?-1:b==='edge-tts'?1:a.localeCompare(b)))[0];
    if(!stt||!tts){
      const ambiguous=ttsResolved.filter(([, ,resolution])=>resolution.reason==='runtime_tts_language_ambiguous');
      const reason=stt&&!tts&&ambiguous.length?'runtime_tts_locale_ambiguous':'runtime_speech_provider_unavailable';
      const candidates=reason==='runtime_tts_locale_ambiguous'?[...new Set(ambiguous.flatMap(([, ,resolution])=>resolution.candidates||[]))].sort():undefined;
      return{ok:false,reason,locale:n,sttSupported:!!stt,ttsSupported:!!tts,textOnly:true,fallbackUsed:false,requireExplicitFallbackNotice:true,
        ...(candidates?{ttsCandidates:candidates}:{})};
    }
    const ttsLocale=tts[2].ttsLocale;
    const rank=v=>v.id==='tr-TR-AhmetNeural'?0:v.gender==='Male'?1:2;
    const voice=tts[1].voices.filter(v=>v.locale===ttsLocale).sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id))[0];
    if(!voice)return{ok:false,reason:'runtime_voice_missing',locale:n,ttsLocale,textOnly:true};
    return{ok:true,locale:n,sttProvider:stt[0],sttLanguage:n.split('-')[0],ttsProvider:tts[0],ttsLocale,voice:voice.id,
      localeResolution:tts[2].resolution,offline:stt[1].offline&&tts[1].offline,cost:0,fallbackUsed:false,evidenceLevel:'runtime_inventory',deviceE2eVerified:false};
  }
  function remove(name){return providers.delete(name)}
  function clear(){providers.clear()}
  return{registerProvider,supports,plan,select,remove,clear};
}
module.exports={VERSION,createRegistry,...createRegistry()};
