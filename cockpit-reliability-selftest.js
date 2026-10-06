'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/index.html','utf8');
function context(){
 const c={Date,manualVoiceUntil:0,listening:false,privacyMode:false,desktopWakeWordEnabled:true,wakeWordConversationUntil:0,wakeWordAwaitingCommand:false,mobileLanguageCapture:null,bargeInMode:false,activeLanguage:'tr-TR',LANGUAGE_NAMES:{tr:'Türkçe'},voiceState:{},consoleStatus:{},cmd:{},window:{},sent:0,
 recognition:{start(){c.started=true},stop(){c.stopped=true}},exitPrivacyMode(){},chooseRecognitionCandidate:()=>({text:'sistem durumu',repaired:'sistem durumu',parsed:{wake:false}}),maybeLearnVoiceCorrection:async()=>false,canonicalJarvisCommand:x=>x,detectLanguage:()=> 'tr-TR',send:()=>c.sent++,setTimeout:fn=>fn()};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function toggleVoice(){'),html.indexOf('function detectLanguage(text)')),c);
 const begin=html.indexOf('recognition.onresult=async e=>{');
 vm.runInContext(html.slice(begin,html.indexOf("\n}\ntoken.value",begin)),c);return c;
}
(async()=>{
 const e={results:[{isFinal:true}]};
 let c=context();await c.recognition.onresult(e);assert.equal(c.sent,0,'passive desktop requires wake word');
 c=context();c.toggleVoice();assert.equal(c.started,true);await c.recognition.onresult(e);assert.equal(c.sent,1,'button accepts command without wake word');
 c=context();c.listening=true;c.toggleVoice();assert.equal(c.stopped,undefined,'button upgrades passive listening');await c.recognition.onresult(e);assert.equal(c.sent,1);
 c=context();c.toggleVoice();c.listening=true;c.toggleVoice();assert.equal(c.stopped,true);assert.equal(c.manualVoiceUntil,0);
 c=context();c.toggleVoice();c.manualVoiceUntil=Date.now()-1;await c.recognition.onresult(e);assert.equal(c.sent,0,'expired manual window fails closed');
 c=context();c.toggleVoice();c.privacyMode=true;await c.recognition.onresult(e);assert.equal(c.sent,0,'privacy still blocks');
 c=context();c.recognition.start=()=>{throw new Error('test')};c.toggleVoice();assert.equal(c.manualVoiceUntil,0);assert.match(c.voiceState.textContent,/VOICE:/);
 c=context();c.desktopWakeWordEnabled=false;c.setVoiceMode=()=>{c.voiceState.textContent='VOICE: READY'};
 const endStart=html.indexOf('recognition.onend=()=>{');vm.runInContext(html.slice(endStart,html.indexOf('recognition.onerror=e=>',endStart)),c);
 c.voiceState.textContent='VOICE: NOT-ALLOWED';c.manualVoiceUntil=Date.now()+30000;c.recognition.onend();
 assert.equal(c.voiceState.textContent,'VOICE: NOT-ALLOWED','end must retain permission error');assert.equal(c.manualVoiceUntil,0);
 assert(html.indexOf('html:not([data-cockpit-ready])')<html.indexOf('<body>'),'boot protection must precede first body paint');
 const renderer=require('./public/tri-core-hologram.js'),frames=new Map(),events={};let frameId=0,removed=false,deleted=0,draws=0;
 const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,drawArrays:()=>draws++,deleteBuffer:()=>deleted++,deleteProgram:()=>deleted++},{get:(o,k)=>o[k]||(()=>({}))});
 const canvas={setAttribute(){},getContext:()=>gl,addEventListener(){},remove(){removed=true}};
 const stage={prepend(){},getBoundingClientRect:()=>({width:100,height:100})};
 const doc={hidden:false,body:{dataset:{}},querySelector:()=>stage,getElementById:()=>null,createElement:()=>canvas,addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const host={document:doc,navigator:{hardwareConcurrency:8,deviceMemory:8},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>frames.delete(id)};
 assert.equal(renderer.install(host),true);assert.equal(draws,1);assert.equal(frames.size,1);
 doc.hidden=true;events.visibilitychange();assert.equal(frames.size,0,'hidden page stops GPU loop');
 doc.hidden=false;events.visibilitychange();assert.equal(draws,2);assert.equal(frames.size,1);
 doc.body.dataset.referenceCockpit='1';events['jarvis:cockpit-ready']();
 assert.equal(frames.size,0);assert.equal(removed,true);assert.equal(deleted,2,'superseded buffers/program disposed');assert.equal(renderer.install(host),false,'cannot restart obsolete renderer');
 console.log('COCKPIT RELIABILITY PASS: production manual/passive recognition routing, expiry, privacy, startup failure, first-paint guard');
})().catch(e=>{console.error(e);process.exitCode=1});
