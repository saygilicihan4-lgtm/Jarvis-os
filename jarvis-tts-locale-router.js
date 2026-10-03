'use strict';
const cp=require('child_process');
const lang=require('./jarvis-language-core');
const discovery=require('./jarvis-speech-provider-discovery');
const VERSION='1.1';
const INVENTORY_SCRIPT='import asyncio,json,edge_tts; print(json.dumps(asyncio.run(edge_tts.list_voices())))';

function defaultRunner(){
  const cmd=process.platform==='win32'?'py':'python3';
  return new Promise(resolve=>cp.execFile(cmd,['-c',INVENTORY_SCRIPT],{encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:2*1024*1024},(error,stdout)=>
    resolve(error?{ok:false,reason:'runtime_voice_inventory_unavailable'}:{ok:true,stdout})));
}
function rankVoice(v,locale){
  if(locale==='tr-TR'&&v.id==='tr-TR-AhmetNeural')return 0;
  if(String(v.gender||'').toLowerCase()==='male')return 1;
  return 2;
}
function createRouter({runner=defaultRunner,now=Date.now,ttlMs=240000}={}){
  let cache=null;
  async function inventory({force=false}={}){
    if(!force&&cache&&now()-cache.at>=0&&now()-cache.at<=ttlMs)return cache;
    const result=await runner();
    if(!result||!result.ok)return{ok:false,reason:result&&result.reason||'runtime_voice_inventory_unavailable'};
    try{
      const voices=discovery.parseVoiceInventory(result.stdout,'edge-tts');
      if(!voices.length)return{ok:false,reason:'runtime_voice_inventory_empty'};
      cache={ok:true,at:now(),voices,source:'runtime_voice_inventory'};
      return cache;
    }catch(_){return{ok:false,reason:'runtime_voice_inventory_invalid'}}
  }
  async function resolve(locale,options={}){
    const normalized=lang.normalizeLocale(locale);
    if(!normalized)return{ok:false,reason:'invalid_locale'};
    const data=await inventory(options);
    if(!data.ok)return{ok:false,reason:data.reason,locale:normalized};
    let ttsLocale=normalized,localeResolution='exact';
    let matches=data.voices.filter(v=>v.locale===normalized);
    if(!matches.length&&!normalized.includes('-')){
      const candidates=[...new Set(data.voices.map(v=>v.locale).filter(x=>x&&x.split('-')[0]===normalized))].sort();
      if(candidates.length>1)return{ok:false,reason:'runtime_tts_locale_ambiguous',locale:normalized,ttsCandidates:candidates,source:data.source};
      if(candidates.length===1){ttsLocale=candidates[0];localeResolution='unique_runtime_language_match';matches=data.voices.filter(v=>v.locale===ttsLocale)}
    }
    matches=matches.sort((a,b)=>rankVoice(a,ttsLocale)-rankVoice(b,ttsLocale)||a.id.localeCompare(b.id));
    if(!matches.length)return{ok:false,reason:'tts_locale_not_in_runtime_inventory',locale:normalized,source:data.source};
    return{ok:true,locale:normalized,ttsLocale,localeResolution,evidenceLevel:'runtime_inventory',voice:matches[0].id,provider:'edge-tts',cost:0,source:data.source,deviceE2eVerified:false};
  }
  function clear(){cache=null}
  return{inventory,resolve,clear};
}
module.exports={VERSION,createRouter,rankVoice};
