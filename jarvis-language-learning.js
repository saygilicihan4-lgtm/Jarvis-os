'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const lang=require('./jarvis-language-core');
const VERSION='1.1';
function storePath(root=__dirname){return path.join(root,'.jarvis-memory','language-profile.json')}
function empty(){return{version:2,explicitLocale:null,learnedLocale:null,observations:{},candidate:null,candidateCount:0}}
function load(root){
  try{
    const raw=JSON.parse(fs.readFileSync(storePath(root),'utf8'));
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return empty();
    return{...empty(),explicitLocale:lang.normalizeLocale(raw.explicitLocale),learnedLocale:lang.normalizeLocale(raw.learnedLocale),
      candidate:lang.normalizeLocale(raw.candidate),candidateCount:Number.isSafeInteger(raw.candidateCount)?Math.max(0,Math.min(3,raw.candidateCount)):0,
      updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null};
  }catch(_){return empty()}
}
function save(profile,root){
  const file=storePath(root),tmp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  fs.mkdirSync(path.dirname(file),{recursive:true});
  try{
    fs.writeFileSync(tmp,JSON.stringify(profile,null,2),{encoding:'utf8',mode:0o600});
    fs.renameSync(tmp,file);
  }finally{try{fs.unlinkSync(tmp)}catch(_){}}
  return profile;
}
function setExplicit(locale,root){
  const normalized=lang.normalizeLocale(locale);
  if(locale!==null&&!normalized)throw new Error('invalid_language_preference');
  const p=load(root);
  p.explicitLocale=normalized;p.candidate=null;p.candidateCount=0;
  p.updatedAt=new Date().toISOString();
  return save(p,root);
}
function observe(locale,{confidence=0,root=__dirname}={}){
  const n=lang.normalizeLocale(locale),p=load(root);
  if(!n||!lang.validConfidence(confidence)||confidence<0.9)return{ok:false,reason:'low_confidence_or_invalid',profile:p};
  if(p.explicitLocale)return{ok:false,reason:'explicit_preference_locked',profile:p};
  p.candidateCount=p.candidate===n?Math.min(3,p.candidateCount+1):1;p.candidate=n;
  if(p.candidateCount>=3)p.learnedLocale=n;
  p.updatedAt=new Date().toISOString();save(p,root);
  return{ok:true,learnedLocale:p.learnedLocale,profile:p};
}
function clearCandidate(root){
  const p=load(root);
  if(!p.candidate&&!p.candidateCount)return p;
  p.candidate=null;p.candidateCount=0;return save(p,root);
}
function resolve({requested,detected,systemLocale,root=__dirname}={}){
  const p=load(root);
  return lang.resolveLanguage({requested:lang.normalizeLocale(requested)||p.explicitLocale,detected,profileLocale:p.learnedLocale,systemLocale});
}
function resetLearned(root){const p=load(root);p.learnedLocale=null;p.candidate=null;p.candidateCount=0;p.observations={};return save(p,root)}
module.exports={VERSION,load,setExplicit,observe,resolve,resetLearned,clearCandidate};
