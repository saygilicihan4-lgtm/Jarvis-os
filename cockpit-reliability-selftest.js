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
 console.log('COCKPIT RELIABILITY PASS: production manual/passive recognition routing, expiry, privacy, startup failure, first-paint guard');
})().catch(e=>{console.error(e);process.exitCode=1});
