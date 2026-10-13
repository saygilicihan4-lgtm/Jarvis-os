'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/index.html','utf8');
function extract(source,begin,end,c){const a=source.indexOf(begin),b=source.indexOf(end,a);assert(a>=0&&b>a,begin);vm.runInContext(source.slice(a,b),c)}
const c=vm.createContext({applyLearnedSpeechAlias:x=>({value:x}),activeLanguage:'tr-TR'});
extract(html,'function normalizeJarvisSpeech(text){','function rememberJarvisSpeechEcho(',c);
extract(html,'function canonicalJarvisCommand(input){','function recognitionCandidates(e){',c);
extract(html,'function isFreeFirstToolCommand(command){','function renderSelfUpdateState(',c);
extract(html,'function detectLanguage(text){','function browserSpeak(',c);
for(const [raw,expected]of [
 ['YouTube görevini aç','youtube aç'],['yutube aç','youtube aç'],['YouTube Studio aç','youtube studio aç'],
 ['Shopify admin aç','shopify admin aç'],['PC: Shopify mağazasını aç','PC: Shopify mağazasını aç'],
 ['sesi aç','sesi aç'],['sesi yükselt','sesi yükselt'],['sistem durmu','sistem durumu'],
 ['ücretsiz YouTube aracı aç','ücretsiz YouTube aracı aç'],
 ['YouTube taslak yükle Film.MP4','YouTube taslak yükle Film.MP4'],
 ['Shorts oluştur: YouTube için robotlar ve uzay','Shorts oluştur: YouTube için robotlar ve uzay'],
 ['YouTube hakkında bilgi ver','YouTube hakkında bilgi ver'],
 ['Bluetooth hoparlör neden çalışmıyor','Bluetooth hoparlör neden çalışmıyor'],
 ['Shopify ürün taslağı ekle: {"title":"VAROVA","image":"https://example.test/A.jpg"}','Shopify ürün taslağı ekle: {"title":"VAROVA","image":"https://example.test/A.jpg"}'],
 ['YouTube aç ve sesi yükselt','YouTube aç ve sesi yükselt'],['Notlarımı sil','Notlarımı sil'],
 ['Bilinmeyen uygulamayı aç','Bilinmeyen uygulamayı aç'],['devam et','devam et']
])assert.equal(c.canonicalJarvisCommand(raw),expected,raw);
for(const [raw,command]of [
 ['Jarvis Jarvis',''],['jarvisjarvis',''],['jar vis sistem durumu','sistem durumu'],['jarvissistem durumu','sistem durumu'],
 ['Jarvis, Shorts oluştur: A.B! YouTube','Shorts oluştur: A.B! YouTube'],
 ['Hey Jarvis Shopify ürün taslağı ekle: {"title":"VAROVA"}','Shopify ürün taslağı ekle: {"title":"VAROVA"}']
]){const r=c.parseJarvisWake(raw);assert.equal(r.wake,true);assert.equal(r.command,command,raw)}
assert.equal(c.parseJarvisWake('YouTube aç').wake,false);
assert.equal(c.detectLanguage('sistem durumu'),'tr-TR');assert.equal(c.detectLanguage('hello please open browser'),'en-US');
for(const raw of ['PC: Shopify mağazasını aç','YouTube görevini aç','sistem durumu','YouTube Studio aç','Shorts oluştur: uzay','YouTube taslak yükle Film.MP4'])assert.equal(c.isDeterministicWorkerCommand(raw),true,raw);
assert.equal(c.isDeterministicWorkerCommand('Bugün nasılsın?'),false);
// Exercise the real send function: mobile navigation cannot be intercepted by chat.
(async()=>{
 let queued=[];const route=vm.createContext({cmd:{value:''},languageChatClient:null,primeMobileSpeech(){},tryDirectLocalPcControl:async()=>false,localVisionCommand:async()=>false,
 isFreeFirstToolCommand:c.isFreeFirstToolCommand,isDeterministicWorkerCommand:c.isDeterministicWorkerCommand,isMobileJarvis:()=>true,
 api:async(url,opts)=>{assert.equal(url,'/api/tasks');queued.push(JSON.parse(opts.body))},load:async()=>{},consoleStatus:{},navigator:{userAgent:'iPhone'},
 askJarvisBrain:async()=>{throw Error('Known command incorrectly intercepted by conversational brain')}});
 extract(html,'async function send(){','async function approve(id)',route);
 for(const command of ['Shopify mağazasını aç','PC: YouTube Studio aç','Shorts oluştur: YouTube robot hikayesi']){route.cmd.value=command;await route.send();assert.equal(queued.at(-1).command,command);assert.equal(route.cmd.value,'')}
 // A local execution failure must not rerun through cloud.
 const local=vm.createContext({navigator:{userAgent:'Windows'},isMobileJarvis:()=>false,isDirectLocalPcCommand:()=>true,AbortController,setTimeout,clearTimeout,
 fetch:async()=>({ok:true,json:async()=>({ok:false,message:'Not installed'})}),consoleStatus:{},coreSubtitle:{},cmd:{value:'X aç'}});
 extract(html,'async function executeDirectLocalPcControl(command,','async function finalizeLocalToolReply(',local);
 assert.equal(await local.tryDirectLocalPcControl('X aç'),true);assert.match(local.consoleStatus.textContent,/Not installed/);
 // Model readiness is more than an HTTP listener; preserve a fallback when loading.
 const health=vm.createContext({navigator:{userAgent:'Windows'},isMobileJarvis:()=>false,AbortController,setTimeout,clearTimeout,
 localSttHealthState:{},localSttAvailable:null,fetch:async()=>({ok:true,json:async()=>({ok:true,loaded:false,microphone:'Mic'})})});
 extract(html,'async function localSttHealth(){','async function listenWithLocalStt(',health);
 assert.equal(await health.localSttHealth(),false);health.fetch=async()=>({ok:true,json:async()=>({ok:true,loaded:true,microphone:'Mic'})});assert.equal(await health.localSttHealth(),true);
 // Push-to-talk works with local STT even without browser recognition.
 const voice=vm.createContext({privacyMode:false,localSttController:null,localVoiceGeneration:0,manualLocalVoicePending:false,manualVoiceUntil:0,listening:false,recognition:null,Date,
 navigator:{userAgent:'Windows'},isMobileJarvis:()=>false,voiceState:{},listenWithLocalStt:async()=>true});
 extract(html,'async function toggleVoice(){','function detectLanguage(text)',voice);await voice.toggleVoice();assert.equal(voice.manualVoiceUntil,0);
 console.log('COMMAND RELIABILITY PASS: preserved intents/payloads, dedicated routing, mobile queue, local failure, model readiness and native push-to-talk');
})().catch(e=>{console.error(e);process.exitCode=1});
