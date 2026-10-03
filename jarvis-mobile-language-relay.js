'use strict';
const crypto=require('crypto');
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const TONES=new Set(['balanced','casual','playful','warm','focused','work','serious','excited','gentle']);
function cleanDeviceId(value){
  const id=String(value||'');
  return /^[A-Za-z0-9_.-]{1,80}$/.test(id)?id:null;
}
function createRelay({now=Date.now,randomId=()=>crypto.randomUUID(),ttlMs=120000,maxItems=128,maxAudioChars=900000}={}){
  if(typeof now!=='function'||typeof randomId!=='function')throw new Error('relay_clock_required');
  if(!Number.isFinite(ttlMs)||ttlMs<1000)throw new Error('relay_ttl_invalid');
  if(!Number.isInteger(maxItems)||maxItems<1||maxItems>4096)throw new Error('relay_capacity_invalid');
  if(!Number.isInteger(maxAudioChars)||maxAudioChars<1024)throw new Error('relay_audio_limit_invalid');
  const rows=new Map();
  function cleanup(){
    const cutoff=now()-ttlMs;let removed=0;
    for(const [id,row] of rows){
      if(!row||Number(row.createdAtMs||0)<cutoff){rows.delete(id);removed++}
    }
    return removed;
  }
  function enqueue({text,tone='balanced',locale}={}){
    cleanup();
    if(rows.size>=maxItems)return{ok:false,reason:'relay_capacity_reached'};
    const cleanText=String(text||'').replace(/\s+/g,' ').trim().slice(0,700);
    const cleanLocale=lang.normalizeLocale(locale);
    if(!cleanText)return{ok:false,reason:'text_required'};
    if(!cleanLocale)return{ok:false,reason:'valid_locale_required'};
    const cleanTone=TONES.has(String(tone||''))?String(tone):'balanced';
    const id=String(randomId());
    if(!id||id.length>128||rows.has(id))return{ok:false,reason:'relay_id_invalid'};
    rows.set(id,{id,text:cleanText,tone:cleanTone,locale:cleanLocale,status:'queued',createdAtMs:now(),claimedBy:null,claimedAtMs:null,claimToken:null,audio:null,error:null,readyAtMs:null,cancelledAtMs:null});
    return{ok:true,id,status:'queued',locale:cleanLocale};
  }
  function claim(deviceId){
    cleanup();
    const worker=cleanDeviceId(deviceId);
    if(!worker)return{ok:false,reason:'valid_device_required',request:null};
    const row=[...rows.values()].find(x=>x.status==='queued');
    if(!row)return{ok:true,request:null};
    const claimToken=String(randomId());
    if(!claimToken||claimToken.length>128)return{ok:false,reason:'claim_token_invalid',request:null};
    row.status='claimed';row.claimedBy=worker;row.claimedAtMs=now();row.claimToken=claimToken;
    return{ok:true,request:{id:row.id,text:row.text,tone:row.tone,locale:row.locale,claimToken}};
  }
  function complete(deviceId,{id,claimToken,ok,audio,error,locale}={}){
    cleanup();
    const worker=cleanDeviceId(deviceId),row=rows.get(String(id||''));
    if(!worker)return{ok:false,reason:'valid_device_required'};
    if(!row)return{ok:false,reason:'relay_request_not_found'};
    if(row.status!=='claimed')return{ok:false,reason:'relay_request_not_claimed',status:row.status};
    if(row.claimedBy!==worker)return{ok:false,reason:'result_device_mismatch'};
    if(typeof claimToken!=='string'||!claimToken||claimToken!==row.claimToken)return{ok:false,reason:'stale_claim_token'};
    if(ok===true){
      const resultLocale=lang.normalizeLocale(locale);
      if(!resultLocale||resultLocale!==row.locale)return{ok:false,reason:'result_locale_mismatch'};
      if(typeof audio!=='string'||!audio.length)return{ok:false,reason:'audio_required'};
      if(audio.length>maxAudioChars)return{ok:false,reason:'audio_too_large'};
      row.status='ready';row.audio=audio;row.error=null;row.readyAtMs=now();
    }else{
      row.status='failed';row.audio=null;row.error=String(error||'tts_generation_failed').slice(0,240);row.readyAtMs=now();
    }
    row.claimToken=null;
    return{ok:true,status:row.status,locale:row.locale};
  }
  function cancel(id){
    cleanup();
    const row=rows.get(String(id||''));
    if(!row)return{ok:false,reason:'relay_request_not_found'};
    if(['ready','failed','cancelled'].includes(row.status))return{ok:false,reason:'relay_request_terminal',status:row.status};
    row.status='cancelled';row.audio=null;row.error=null;row.claimToken=null;row.cancelledAtMs=now();
    return{ok:true,status:'cancelled'};
  }
  function get(id){
    cleanup();
    const row=rows.get(String(id||''));
    if(!row)return null;
    return{...row};
  }
  return{VERSION,enqueue,claim,complete,cancel,get,cleanup,size:()=>rows.size};
}
module.exports={VERSION,createRelay,cleanDeviceId};
