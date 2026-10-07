// Optional human projection scene. No paid TTS/AI endpoints and no microphone capture.
const HEAD='https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@b3e277b3b46f88e557bf28a2c5612a5b04e075c3/';
const AUDIO='https://cdn.jsdelivr.net/gh/met4citizen/HeadAudio@d3af5f9ff86ab6b2b1913d411a4e1922ec101953/';
const MODEL='https://raw.githubusercontent.com/met4citizen/TalkingHead/b3e277b3b46f88e557bf28a2c5612a5b04e075c3/avatars/mpfb.glb';
const $=id=>document.getElementById(id),tr=!(new URLSearchParams(location.search).get('lang')||'tr').startsWith('en');
const words=tr?{load:'İnsan modelini yükle',listen:'Konuşmayı başlat',mirror:'Aynala',full:'Tam ekran',clean:'Kontrolleri gizle',restore:'Kontrolleri göster',loading:'Model yükleniyor…',ready:'İnsan modeli hazır. Ses bekleniyor; Türkçe dudak doğruluğu doğrulanmadı.',error:'Model/animasyon yüklenemedi. Ağ ve WebGL desteğini kontrol edin.',audio:'Sesten tahmin edilen ağız şekilleri · Türkçe doğruluğu doğrulanmadı',stopped:'Ses durdu · Ağız nötr',unsupported:'Ses analizi kullanılamıyor; JARVIS ses çıkışı değişmedi.'}:{load:'Load human model',listen:'Start listening',mirror:'Mirror',full:'Full screen',clean:'Hide controls',restore:'Show controls',loading:'Loading model…',ready:'Human model ready. Waiting for audio; Turkish lip accuracy unverified.',error:'Model/animation failed to load. Check network and WebGL support.',audio:'Audio-predicted mouth shapes · Turkish accuracy unverified',stopped:'Audio stopped · Mouth neutral',unsupported:'Audio analysis unavailable; JARVIS playback unchanged.'};
document.documentElement.lang=tr?'tr':'en';
$('status').textContent=tr?'İsteğe bağlı indirme: model yaklaşık 37 MB + kitaplıklar. Fotoğrafınız 3D modele dönüştürülmez.':'Optional download: model about 37 MB + libraries. Your photo is not converted to a 3D model.';
for(const [id,k]of [['start','load'],['listen','listen'],['mirror','mirror'],['full','full'],['clean','clean'],['restore','restore']])$(id).textContent=words[k];
if(!tr){document.querySelector('header small').textContent='AI character · Not a celebrity · Not a volumetric hologram';$('stage').setAttribute('aria-label','3D human avatar');}
let head,analyzer,loading=false,active=true,generation=0,playTicket=0,cleanup=()=>{},source=null,mute=null;
function status(k){$('status').textContent=words[k]||k}
function neutral(){if(analyzer){analyzer.visemeActive=-1;analyzer.visemeAlphas.fill(0)}if(head)for(const [key,value]of Object.entries(head.mtAvatar||{})){if(key.startsWith('viseme_'))Object.assign(value,{newvalue:0,needsUpdate:true})}}
function stopSource(){playTicket++;if(source){try{source.stop();source.disconnect()}catch(_){}source=null}neutral()}
function stop(){generation++;cleanup();cleanup=()=>{};stopSource();status('stopped')}
async function start(){if(loading||head)return;loading=true;$('start').disabled=true;status('loading');
 try{
  const [{TalkingHead},{HeadAudio}]=await Promise.all([import(HEAD+'modules/talkinghead.mjs'),import(AUDIO+'dist/headaudio.min.mjs')]);
  head=new TalkingHead($('stage'),{ttsEndpoint:null,lipsyncModules:[],modelFPS:24,modelPixelRatio:1/Math.max(1,window.devicePixelRatio||1),cameraView:'head',cameraRotateEnable:true,avatarIdleHeadMove:matchMedia('(prefers-reduced-motion: reduce)').matches?0:.15});
  if(!active||document.hidden)head.stop();
  await head.showAvatar({url:MODEL,body:'F',avatarMood:'neutral'});
  if(!active||document.hidden)head.stop();
  const workletResponse=await fetch(AUDIO+'dist/headworklet.min.mjs');
  if(!workletResponse.ok)throw Error('audio worklet download failed');
  const workletURL=URL.createObjectURL(new Blob([await workletResponse.text()],{type:'application/javascript'}));
  try{await head.audioCtx.audioWorklet.addModule(workletURL)}finally{URL.revokeObjectURL(workletURL)}
  // Encoded TTS starts with speech, not a microphone's quiet calibration period.
  analyzer=new HeadAudio(head.audioCtx,{parameterData:{silMode:0,vadGateActiveDb:-40,vadGateInactiveDb:-55},processorOptions:{visemeEventsEnabled:true}});
  // Upstream's truthiness check omits viseme index zero; handle numeric IDs explicitly.
  analyzer.onviseme=e=>{if(Number.isInteger(e.viseme)&&e.viseme>=0&&e.viseme<=14)analyzer.visemeActive=e.viseme===14?-1:e.viseme};
  await analyzer.loadModel(AUDIO+'dist/model-en-mixed.bin');
  analyzer.onvalue=(key,value)=>{if(source&&head.mtAvatar[key])Object.assign(head.mtAvatar[key],{newvalue:value,needsUpdate:true})};
  head.opt.update=dt=>analyzer.update(dt);
  mute=head.audioCtx.createGain();mute.gain.value=0;mute.connect(head.audioCtx.destination);
  if(active&&!document.hidden)await head.audioCtx.resume();else{head.stop();await head.audioCtx.suspend()}
  status('ready');$('stage').dataset.ready='true';
 }catch(e){console.error('human_avatar_load_failed',e);status('error');try{head?.stop();head?.renderer?.dispose();head?.renderer?.forceContextLoss();await head?.audioCtx?.close()}catch(_){}head=null;analyzer=null;$('stage').replaceChildren();$('start').disabled=false;
 }finally{loading=false}
}
async function bindAudio(media,bytes){stop();if(!active||!head||!analyzer||!(bytes?.byteLength>0)||bytes.byteLength>6000000)return;
 const id=generation,src=media.src;
 try{const buffer=await head.audioCtx.decodeAudioData(new Uint8Array(bytes).slice().buffer);if(id!==generation||media.src!==src||buffer.duration>120)return;
  const run=async()=>{stopSource();const ticket=playTicket;if(!active||id!==generation||media.src!==src||media.paused||media.ended||media.seeking||document.hidden)return;
   await head.audioCtx.resume();if(!active||document.hidden||ticket!==playTicket||id!==generation||media.src!==src||media.paused||media.ended||media.seeking)return;
   source=head.audioCtx.createBufferSource();source.buffer=buffer;source.playbackRate.value=media.playbackRate;source.connect(analyzer);source.connect(mute);
   const current=source;current.onended=()=>{if(source===current){source=null;current.disconnect();neutral();status('stopped')}};
   source.start(0,Math.min(media.currentTime,buffer.duration));status('audio');};
  const safeRun=()=>{void run().catch(()=>{if(id===generation){stopSource();status('unsupported')}})};
  const pause=()=>{stopSource();status('stopped')};const handlers={play:safeRun,playing:safeRun,pause,ended:pause,error:pause,emptied:pause,seeking:pause,seeked:safeRun,ratechange:safeRun};
  for(const [event,fn]of Object.entries(handlers))media.addEventListener(event,fn);
  cleanup=()=>{for(const [event,fn]of Object.entries(handlers))media.removeEventListener(event,fn)};
  await run();
 }catch(_){if(id===generation){stopSource();status('unsupported')}}
}
$('start').onclick=start;$('mirror').onclick=()=>$('stage').classList.toggle('mirror');
$('listen').onclick=()=>{try{if(!window.parent.JarvisHumanAvatar?.listen())$('voiceStatus').textContent=tr?'JARVIS mikrofonuna ulaşılamadı. Ana ekranda mikrofonu deneyin.':'JARVIS microphone unavailable. Try the main screen microphone.'}catch(_){$('voiceStatus').textContent=tr?'Mikrofon bağlantısı kurulamadı.':'Microphone connection failed.'}};
let lastVoice='';const voiceTimer=setInterval(()=>{if(document.hidden)return;try{const state=window.parent.JarvisHumanAvatar?.voiceStatus();if(!state)return;const value=[state.voice,state.command].filter(Boolean).join(' · ').slice(0,300);if(value&&value!==lastVoice){lastVoice=value;$('voiceStatus').textContent=value}}catch(_){}},650);
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(_){status(tr?'Tam ekran bu tarayıcıda kullanılamıyor.':'Full screen unavailable in this browser.')}};
$('clean').onclick=()=>$('layout').classList.add('clean');$('restore').onclick=()=>$('layout').classList.remove('clean');
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('layout').classList.remove('clean')});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();head?.stop();void head?.audioCtx?.suspend()}else if(active)head?.start()});
window.addEventListener('pagehide',()=>{clearInterval(voiceTimer);stop();head?.stop();void head?.audioCtx?.close()});
window.JarvisHumanStage=Object.freeze({bindAudio,stop:()=>{active=false;stop();head?.stop();void head?.audioCtx?.suspend()},resume:()=>{active=true;if(!document.hidden)head?.start()},
 diagnostics:()=>({ready:!!analyzer,active,analyzing:!!source,visemes:Object.fromEntries(Object.entries(head?.mtAvatar||{}).filter(([k])=>k.startsWith('viseme_')).map(([k,v])=>[k,Number(v.applied)||0]))})});
