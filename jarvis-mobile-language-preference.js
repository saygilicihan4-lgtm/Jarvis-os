'use strict';
const lang=require('./jarvis-language-core');
const VERSION='1.0';
const SOURCES=new Set(['explicit','learned','none']);

function deriveFromProfile(profile={},voiceResolution={}, {now=Date.now}={}){
  const explicit=lang.normalizeLocale(profile.explicitLocale);
  const learned=lang.normalizeLocale(profile.learnedLocale);
  const locale=explicit||learned||null;
  const source=explicit?'explicit':learned?'learned':'none';
  if(!locale){
    return{version:1,locale:null,source:'none',usable:false,provider:null,voice:null,cost:0,phoneSttVerified:false,learningOnPhone:false,observedAtMs:now()};
  }
  const voiceLocale=lang.normalizeLocale(voiceResolution.locale);
  const exactTts=voiceResolution&&voiceResolution.ok===true&&voiceLocale===locale&&typeof voiceResolution.voice==='string'&&voiceResolution.voice.trim();
  return{version:1,locale,source,usable:!!exactTts,provider:exactTts?String(voiceResolution.provider||'edge-tts'):null,
    voice:exactTts?String(voiceResolution.voice):null,cost:0,phoneSttVerified:false,learningOnPhone:false,observedAtMs:now()};
}

function acceptWorkerSnapshot(input={},workerId,{now=Date.now}={}){
  const deviceId=String(workerId||'').trim();
  if(!deviceId)return{ok:false,reason:'worker_id_required'};
  const source=String(input.source||'none');
  if(!SOURCES.has(source))return{ok:false,reason:'invalid_preference_source'};
  const locale=lang.normalizeLocale(input.locale);
  if(source==='none'&&locale)return{ok:false,reason:'none_source_must_not_have_locale'};
  if(source!=='none'&&!locale)return{ok:false,reason:'preference_locale_required'};
  const usable=source!=='none'&&input.usable===true;
  const voice=usable&&typeof input.voice==='string'&&input.voice.trim()?String(input.voice).slice(0,160):null;
  const provider=usable&&typeof input.provider==='string'&&input.provider.trim()?String(input.provider).slice(0,80):null;
  if(usable&&(!voice||!provider))return{ok:false,reason:'usable_preference_requires_voice_proof'};
  return{ok:true,snapshot:{version:1,locale:source==='none'?null:locale,source,usable:!!usable,provider,voice,cost:0,
    phoneSttVerified:false,learningOnPhone:false,workerId:deviceId.slice(0,80),receivedAtMs:now()}};
}

function publicSnapshot(snapshot,{now=Date.now,maxAgeMs=45000}={}){
  if(!snapshot||typeof snapshot!=='object')return{ok:true,available:false,reason:'not_published',phoneSttVerified:false,learningOnPhone:false};
  const ageMs=Math.max(0,now()-Number(snapshot.receivedAtMs||0));
  if(!Number.isFinite(ageMs)||ageMs>maxAgeMs)return{ok:true,available:false,reason:'stale',ageMs:Number.isFinite(ageMs)?ageMs:null,phoneSttVerified:false,learningOnPhone:false};
  const locale=lang.normalizeLocale(snapshot.locale),source=String(snapshot.source||'none');
  const available=source!=='none'&&!!locale;
  return{ok:true,available,usable:available&&snapshot.usable===true,locale:available?locale:null,source:available?source:'none',
    provider:available&&snapshot.usable===true?snapshot.provider:null,voice:available&&snapshot.usable===true?snapshot.voice:null,cost:0,
    ageMs,phoneSttVerified:false,learningOnPhone:false,deviceE2eVerified:false};
}

module.exports={VERSION,deriveFromProfile,acceptWorkerSnapshot,publicSnapshot};
