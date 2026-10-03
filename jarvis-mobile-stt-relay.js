'use strict';
const crypto=require('crypto');
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const MAX_AUDIO_CHARS=760000;
const QUEUE_TTL_MS=120000;
const CLAIM_LEASE_MS=45000;
function cleanDeviceId(v){return String(v||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)}
function createRelay({now=Date.now,maxAudioChars=MAX_AUDIO_CHARS,queueTtlMs=QUEUE_TTL_MS,claimLeaseMs=CLAIM_LEASE_MS}={}){
  const requests=new Map();let workerSeenAt=0;
  function refresh(row){
    if(!row)return row;const age=now()-row.createdAtMs;
    if(['queued','claimed'].includes(row.status)&&age>queueTtlMs){row.status='failed';row.error='request_expired';row.audio=null;row.readyAtMs=now()}
    if(row.status==='claimed'&&now()-row.claimedAtMs>claimLeaseMs){row.status='failed';row.error='worker_claim_expired';row.audio=null;row.readyAtMs=now()}
    return row;
  }
  function cleanup(){for(const [id,row] of requests){refresh(row);if(now()-row.createdAtMs>queueTtlMs*2)requests.delete(id)}}
  function create({audio,preferredLocale=null,currentLocale=null}={}){
    cleanup();const data=String(audio||''),preferred=preferredLocale==null?null:lang.normalizeLocale(preferredLocale),current=lang.normalizeLocale(currentLocale);
    if(!data||data.length>maxAudioChars||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))return{ok:false,reason:'invalid_audio'};
    if(preferredLocale!=null&&!preferred)return{ok:false,reason:'invalid_preferred_locale'};
    if(!current)return{ok:false,reason:'invalid_current_locale'};
    const id=crypto.randomUUID(),row={id,audio:data,preferredLocale:preferred,currentLocale:current,status:'queued',createdAtMs:now(),claimedAtMs:null,claimedBy:null,result:null,error:null,readyAtMs:null};
    requests.set(id,row);return{ok:true,id,status:'queued'};
  }
  function claim(deviceId){
    cleanup();const worker=cleanDeviceId(deviceId);if(!worker)return{ok:false,reason:'valid_device_required'};workerSeenAt=now();
    const row=[...requests.values()].map(refresh).find(x=>x.status==='queued');if(!row)return{ok:true,request:null};
    row.status='claimed';row.claimedBy=worker;row.claimedAtMs=now();return{ok:true,request:{id:row.id,audio:row.audio,preferredLocale:row.preferredLocale,currentLocale:row.currentLocale}};
  }
  function complete(deviceId,payload={}){
    cleanup();const row=refresh(requests.get(String(payload.id||''))),worker=cleanDeviceId(deviceId);
    if(!row)return{ok:false,reason:'request_not_found'};
    if(row.status!=='claimed')return{ok:false,reason:'request_not_active',status:row.status};
    if(!worker||row.claimedBy!==worker)return{ok:false,reason:'claim_owner_mismatch'};
    const evidence=payload.evidence&&typeof payload.evidence==='object'?payload.evidence:{};
    if(payload.ok===true){
      const text=String(payload.text||'').replace(/\s+/g,' ').trim().slice(0,1800),locale=lang.normalizeLocale(payload.locale);
      if(!text)return{ok:false,reason:'transcript_required'};
      if(!locale)return{ok:false,reason:'result_locale_required'};
      if(String(payload.engine||'')!=='faster-whisper')return{ok:false,reason:'engine_evidence_required'};
      if(String(evidence.inventorySource||'')!=='loaded_model_inventory')return{ok:false,reason:'model_inventory_evidence_required'};
      const automatic=evidence.mode==='automatic';
      const confidence=Number(evidence.confidence),reliable=evidence.reliable===true&&evidence.final===true;
      if(automatic&&(!reliable||!Number.isFinite(confidence)||confidence<0.85||confidence>1))return{ok:false,reason:'automatic_detection_evidence_insufficient'};
      row.status='ready';row.result={text,locale,engine:'faster-whisper',inputSource:'phone-local-stt',evidence:{mode:automatic?'automatic':'configured',confidence:automatic?confidence:0,reliable,final:evidence.final===true,inventorySource:'loaded_model_inventory',ttsInventorySource:String(evidence.ttsInventorySource||'')==='runtime_voice_inventory'?'runtime_voice_inventory':null,utteranceId:String(evidence.utteranceId||'').slice(0,128)},deviceE2eVerified:false};row.audio=null;row.readyAtMs=now();
    }else{row.status='failed';row.error=String(payload.error||'local_stt_failed').slice(0,240);row.audio=null;row.readyAtMs=now()}
    return{ok:true,status:row.status};
  }
  function get(id){cleanup();const row=refresh(requests.get(String(id)));if(!row)return null;return{status:row.status,result:row.result,error:row.error,readyAtMs:row.readyAtMs,deviceE2eVerified:false}}
  function cancel(id){const row=refresh(requests.get(String(id)));if(!row)return{ok:false,reason:'request_not_found'};if(!['queued','claimed'].includes(row.status))return{ok:false,reason:'request_not_active'};row.status='cancelled';row.audio=null;row.error='cancelled';row.readyAtMs=now();return{ok:true,status:'cancelled'}}
  function status(){cleanup();return{ok:true,version:VERSION,workerOnline:workerSeenAt>0&&now()-workerSeenAt<15000,queued:[...requests.values()].filter(x=>x.status==='queued').length,deviceE2eVerified:false}}
  return{create,claim,complete,get,cancel,status,cleanup};
}
module.exports={VERSION,MAX_AUDIO_CHARS,QUEUE_TTL_MS,CLAIM_LEASE_MS,cleanDeviceId,createRelay};
