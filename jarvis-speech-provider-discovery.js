'use strict';
const cp=require('child_process'),caps=require('./jarvis-speech-capabilities'),lang=require('./jarvis-language-core');
const VERSION='1.1';
function run(cmd,args,timeout=15000){
  return new Promise(resolve=>cp.execFile(cmd,args,{encoding:'utf8',timeout,windowsHide:true,maxBuffer:2*1024*1024},(error,stdout)=>
    resolve(error?{ok:false,reason:'provider_probe_failed'}:{ok:true,stdout})));
}
function parseEdgeVoices(text){
  const locales=new Set();
  for(const line of String(text||'').split(/\r?\n/)){
    const m=line.match(/\b([a-z]{2,3}-[A-Z]{2})-[A-Za-z0-9]+Neural\b/);
    if(m)locales.add(lang.normalizeLocale(m[1]));
  }
  return[...locales].filter(Boolean).sort();
}
function parseVoiceInventory(text,provider){
  const rows=JSON.parse(String(text).replace(/^\uFEFF/,''));
  if(!Array.isArray(rows))throw new Error('voice_inventory_array_required');
  return rows.filter(x=>x&&x.Enabled!==false).map(x=>({id:provider==='edge-tts'?x.ShortName:x.Name,locale:lang.normalizeLocale(provider==='edge-tts'?x.Locale:x.Culture),gender:x.Gender}))
    .filter(x=>typeof x.id==='string'&&x.id.length>0&&x.id.length<=200&&x.locale&&
      (provider!=='edge-tts'||(/^[A-Za-z0-9-]+Neural$/.test(x.id)&&x.id.startsWith(x.locale+'-'))));
}
async function discoverVoiceProvider(provider,{registry=caps,runner=run,platform=process.platform}={}){
  registry.remove(provider);
  let result;
  if(provider==='edge-tts'){
    result=await runner(platform==='win32'?'py':'python3',['-c','import asyncio,json,edge_tts; print(json.dumps(asyncio.run(edge_tts.list_voices())))']);
  }else if(provider==='windows-sapi'&&platform==='win32'){
    const script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $v=@($s.GetInstalledVoices() | ForEach-Object { [pscustomobject]@{Name=$_.VoiceInfo.Name; Culture=$_.VoiceInfo.Culture.Name; Gender=[string]$_.VoiceInfo.Gender; Enabled=$_.Enabled} }); ConvertTo-Json -InputObject $v -Compress } finally { $s.Dispose() }";
    result=await runner('powershell.exe',['-NoProfile','-NonInteractive','-Command',script]);
  }else return{ok:false,provider,reason:'provider_unavailable_on_platform'};
  if(!result.ok)return{ok:false,provider,reason:result.reason};
  try{
    const voices=parseVoiceInventory(result.stdout,provider),locales=[...new Set(voices.map(v=>v.locale))].sort();
    if(!voices.length)return{ok:false,provider,reason:'no_tts_locales_discovered'};
    registry.registerProvider(provider,{ttsLocales:locales,voices,offline:provider==='windows-sapi',cost:0,evidence:{source:'runtime_voice_inventory'}});
    return{ok:true,provider,ttsLocales:locales,count:voices.length,source:'runtime_voice_inventory',offline:provider==='windows-sapi',deviceE2eVerified:false};
  }catch(_){return{ok:false,provider,reason:'invalid_voice_inventory'}}
}
function discoverEdgeTts(options){return discoverVoiceProvider('edge-tts',options)}
function discoverSystemTts(options){return discoverVoiceProvider('windows-sapi',options)}
function registerStt(name,locales){
  const clean=[...new Set((Array.isArray(locales)?locales:[]).map(lang.normalizeLocale).filter(Boolean))];
  if(!name||!clean.length)return{ok:false,reason:'stt_capability_evidence_required'};
  // Legacy explicit configuration can answer supports(), but cannot pass select().
  caps.registerProvider(name,{sttLocales:clean});
  return{ok:true,provider:name,sttLocales:clean,source:'explicit_runtime_configuration'};
}
function registerLocalStt(health,{registry=caps}={}){
  const provider='faster-whisper';registry.remove(provider);
  const evidence=health&&health.language_capabilities;
  if(!health||health.ok!==true||health.loaded!==true||health.engine!==provider||!evidence||evidence.source!=='loaded_model_inventory'||!Array.isArray(evidence.languages))
    return{ok:false,provider,reason:'loaded_stt_inventory_required'};
  const languages=[...new Set(evidence.languages.filter(x=>typeof x==='string'&&/^[a-z]{2,3}$/.test(x)))];
  if(!languages.length)return{ok:false,provider,reason:'empty_stt_inventory'};
  registry.registerProvider(provider,{sttLanguages:languages,offline:true,cost:0,evidence:{source:'loaded_model_inventory'}});
  return{ok:true,provider,sttLanguages:languages,source:'loaded_model_inventory',automaticDetection:evidence.automatic_detection===true,deviceE2eVerified:false};
}
async function discoverLocalStt({port=8768,registry=caps,fetchImpl=fetch}={}){
  registry.remove('faster-whisper');
  if(!Number.isInteger(port)||port<1||port>65535)return{ok:false,reason:'invalid_stt_port'};
  try{
    const response=await fetchImpl('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(3000)});
    if(!response.ok)return{ok:false,reason:'stt_health_unavailable'};
    return registerLocalStt(await response.json(),{registry});
  }catch(_){return{ok:false,reason:'stt_health_unavailable'}}
}
module.exports={VERSION,parseEdgeVoices,parseVoiceInventory,discoverEdgeTts,discoverSystemTts,registerStt,registerLocalStt,discoverLocalStt};
