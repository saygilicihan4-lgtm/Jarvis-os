'use strict';
const crypto=require('crypto');
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const TONES=new Set(['balanced','casual','playful','warm','focused','work','serious','excited','gentle']);
function cleanDeviceId(value){return String(value||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)}
function createRelay({now=Date.now,requestTtlMs=120000,claimTtlMs=45000,maxAudioChars=900000}={}){
  const requests=new Map();
  let lastWorkerSeenMs=0;
  function expire(row){return !row||now()-row.createdAtMs>requestTtlMs}
  function cleanup(){for(const [id,row] of requests)if(expire(row))requests.delete(id)}
  function create({id=crypto.randomUUID(),text,tone='balanced',locale}={}){
    cleanup();
    const cleanText=String(text||'').replace(/\s+/g,' ').trim().slice(0,700),cleanLocale=lang.normalizeLocale(locale);
    if(!cleanText)return{ok:false,reason:'text_required'};
    if(!cleanLocale)return{ok:false,reason:'valid_locale_required'};
    const row={id:String(id),text:cleanText,tone:TONES.has(String(tone))?String(tone):'balanced',locale:cleanLocale,status:'queued',createdAtMs:now(),claimedBy:null,claimedAtMs:null,audio:null,provider:null,voice:null,error:null,readyAtMs:null};
    requests.set(row.id,row);return{ok:true,request:publicRow(row)};
  }
  function publicRow(row){
    if(!row)return null;
    const out={id:row.id,status:row.status,locale:row.locale,createdAtMs:row.createdAtMs,claimedAtMs:row.claimedAtMs,readyAtMs:row.readyAtMs,provider:row.provider,voice:row.voice,error:row.error};
    if(row.status==='ready')out.audio=row.audio;
    return out;
  }
  function get(id){cleanup();return publicRow(requests.get(String(id)))}
  function cancel(id){
    const row=requests.get(String(id));if(!row)return{ok:false,reason:'request_not_found'};
    if(['ready','failed','cancelled'].includes(row.status))return{ok:false,reason:'request_already_closed',request:publicRow(row)};
    row.status='cancelled';row.audio=null;row.error='cancelled';row.readyAtMs=now();return{ok:true,request:publicRow(row)};
  }
  function requeueStaleClaims(){
    for(const row of requests.values())if(row.status==='claimed'&&Number.isFinite(row.claimedAtMs)&&now()-row.claimedAtMs>claimTtlMs){row.status='queued';row.claimedBy=null;row.claimedAtMs=null}
  }
  function claim(deviceId){
    cleanup();requeueStaleClaims();
    const id=cleanDeviceId(deviceId);if(!id)return{ok:false,reason:'valid_device_required'};
    lastWorkerSeenMs=now();
    const row=[...requests.values()].find(x=>x.status==='queued');
    if(!row)return{ok:true,request:null};
    row.status='claimed';row.claimedBy=id;row.claimedAtMs=now();
    return{ok:true,request:{id:row.id,text:row.text,tone:row.tone,locale:row.locale,claimedAtMs:row.claimedAtMs}};
  }
  function complete(deviceId,{id,locale,ok,audio,provider,voice,error}={}){
    cleanup();
    const worker=cleanDeviceId(deviceId),row=requests.get(String(id||''));
    if(!row)return{ok:false,reason:'request_not_found'};
    if(expire(row))return{ok:false,reason:'request_expired'};
    if(row.status!=='claimed')return{ok:false,reason:'request_not_active',status:row.status};
    if(!worker||row.claimedBy!==worker)return{ok:false,reason:'claim_owner_mismatch'};
    const resultLocale=lang.normalizeLocale(locale);
    if(!resultLocale||resultLocale!==row.locale)return{ok:false,reason:'result_locale_mismatch'};
    if(ok===true){
      if(typeof audio!=='string'||!audio.length)return{ok:false,reason:'audio_required'};
      if(audio.length>maxAudioChars)return{ok:false,reason:'audio_too_large'};
      const cleanProvider=String(provider||'').trim();if(cleanProvider!=='edge-tts')return{ok:false,reason:'provider_evidence_required'};
      const cleanVoice=String(voice||'').trim().slice(0,200);if(!cleanVoice||!cleanVoice.startsWith(row.locale+'-')||!cleanVoice.endsWith('Neural'))return{ok:false,reason:'voice_evidence_required'};
      row.status='ready';row.audio=audio;row.provider=cleanProvider;row.voice=cleanVoice;row.error=null;row.readyAtMs=now();
    }else{
      row.status='failed';row.audio=null;row.provider=String(provider||'').trim().slice(0,80)||null;row.voice=String(voice||'').trim().slice(0,200)||null;row.error=String(error||'tts_generation_failed').slice(0,240);row.readyAtMs=now();
    }
    return{ok:true,request:publicRow(row)};
  }
  function status(){cleanup();return{ok:true,version:VERSION,queued:[...requests.values()].filter(x=>x.status==='queued').length,claimed:[...requests.values()].filter(x=>x.status==='claimed').length,workerOnline:lastWorkerSeenMs>0&&now()-lastWorkerSeenMs<15000,lastWorkerSeenMs:lastWorkerSeenMs||null,deviceE2eVerified:false}}
  return{create,get,cancel,claim,complete,status,cleanup};
}
module.exports={VERSION,createRelay,cleanDeviceId};
