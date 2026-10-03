const fs=require('fs'),path=require('path');const lang=require('./jarvis-language-core');const VERSION='1.0';
function storePath(root=__dirname){return path.join(root,'.jarvis-memory','language-profile.json')}
function load(root){try{return JSON.parse(fs.readFileSync(storePath(root),'utf8'))}catch{return{version:1,explicitLocale:null,learnedLocale:null,observations:{}}}}
function save(p,root){const f=storePath(root);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(p,null,2));return p}
function setExplicit(locale,root){const p=load(root);p.explicitLocale=lang.normalizeLocale(locale);p.updatedAt=new Date().toISOString();return save(p,root)}
function observe(locale,{confidence=0,root=__dirname}={}){const n=lang.normalizeLocale(locale),p=load(root);if(!n||confidence<0.8)return{ok:false,reason:'low_confidence_or_invalid',profile:p};const o=p.observations[n]||{count:0};o.count++;o.lastConfidence=confidence;p.observations[n]=o;if(!p.explicitLocale&&o.count>=3)p.learnedLocale=n;p.updatedAt=new Date().toISOString();save(p,root);return{ok:true,learnedLocale:p.learnedLocale,profile:p}}
function resolve({requested,detected,systemLocale,root=__dirname}={}){const p=load(root);return lang.resolveLanguage({requested:requested||p.explicitLocale,detected,profileLocale:p.learnedLocale,systemLocale})}
function resetLearned(root){const p=load(root);p.learnedLocale=null;p.observations={};return save(p,root)}
module.exports={VERSION,load,setExplicit,observe,resolve,resetLearned};