const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const childProcess=require('child_process');
const http=require('http');

const BASE=(process.env.JARVIS_URL||'https://jarvis-os-1iuv.onrender.com').replace(/\/$/,'');
const TOKEN=process.env.JARVIS_TOKEN||'';
const PAIR_CODE=process.env.JARVIS_PAIR_CODE||'';
const NAME=process.env.JARVIS_WORKER_NAME||os.hostname();
const DEVICE_FILE=path.join(os.homedir(),'.jarvis-device-id');
function loadDeviceId(){
  if(process.env.JARVIS_DEVICE_ID)return process.env.JARVIS_DEVICE_ID;
  try{const x=fs.readFileSync(DEVICE_FILE,'utf8').trim();if(x)return x}catch(e){}
  const id='PC-'+os.hostname().replace(/[^A-Za-z0-9_.-]/g,'-')+'-'+require('crypto').randomBytes(4).toString('hex');
  fs.writeFileSync(DEVICE_FILE,id,'utf8');return id;
}
const DEVICE_ID=loadDeviceId();
const DEVICE_TOKEN_FILE=path.join(os.homedir(),'.jarvis-device-token');
let DEVICE_TOKEN='';
try{DEVICE_TOKEN=fs.readFileSync(DEVICE_TOKEN_FILE,'utf8').trim()}catch(e){}
const WORKSPACE=path.resolve(process.env.JARVIS_WORKSPACE||path.join(process.cwd(),'jarvis-workspace'));
const MEMORY_DIR=path.join(WORKSPACE,'.jarvis-memory');
const MEMORY_FILE=path.join(MEMORY_DIR,'task-history.jsonl');
const CHECKPOINT_DIR=path.join(MEMORY_DIR,'checkpoints');
const JOURNAL_DIR=path.join(MEMORY_DIR,'journals');
const STRATEGY_FILE=path.join(MEMORY_DIR,'strategy-policy.json');
const CLOUD_STATE_FILE=path.join(MEMORY_DIR,'cloud-state.json');
const WORKER_VERSION='2.54.0';
const CAPS=['system_status','list_files','write_note','write_file','read_file','make_folder','project_scaffold','workspace_bundle','mission_plan','strategy_metrics','strategy_selection','strategy_rollback','resume_checkpoint','multi_device_identity','cloud_state_backup','snapshot_integrity_v2','snapshot_hmac_v3','signed_bootstrap_restore_v1','task_uid_v1','safe_rehydrate_v1','transactional_plan','transaction_crash_recovery_v1','strict_journal_v2','bounded_rollback_v1','transaction_journal_v3','checkpoint_plan_hash_v1','prefix_revalidation_v1','signed_device_credential_v1','device_credential_refresh_v1','pairing_code_v1','restore_before_heartbeat_v1','single_restore_attempt_v1','auth_loss_restore_v1','global_f8_wake_v1','phone_session_code_v1','local_memory','process_list_v1','disk_status_v1','network_status_v1','local_ai_readiness_v1','wake_on_lan_readiness_v1','local_tts_v1','local_tts_bridge_v1','double_clap_wake_v2','helper_autosync_v1','python_clap_listener_v1','double_clap_transient_gate_v2','double_clap_classifier_v3','mobile_tts_relay_v1','creator_tts_v1','desktop_launch_v1','media_control_v1','power_status_v1','local_brain_v1','local_brain_memory_v2','local_brain_eval_v2','local_stt_v1','adaptive_tts_v1','turn_taking_v2','qwen3_local_brain_v1','episodic_memory_v1','stt_hotwords_v1','mobile_brain_relay_v1','mobile_adaptive_tts_v2','expressive_tone_v2','speech_naturalizer_v1','multi_action_plan_v1','workspace_search_v1','dialogue_quality_v2','interruptible_tts_v1','brain_prewarm_v1','latency_runtime_v1','tool_result_reflection_v1','agent_loop_v2','context_continuity_v1','anaphora_resolution_v1','offline_tts_fallback_v1','mobile_handsfree_loop_v1','local_rag_v1','deep_reflection_v1','grounded_workspace_context_v1','qwen35_local_brain_v1','local_multimodal_v1','camera_vision_v1','native_tool_loop_v1','adaptive_tool_chain_v1','safe_workspace_read_v1','selective_reasoning_v1','adaptive_context_v1','adaptive_speech_lexicon_v1','voice_correction_learning_v1'];


const TTS_ENABLED=process.platform==='win32'&&process.env.JARVIS_TTS!=='0';
const TTS_VOICE='tr-TR-AhmetNeural';
const TTS_RATE='-20%';
const TTS_PITCH='-12Hz';
const TTS_VOLUME='-3%';
const MOBILE_TTS_VOLUME='+55%';

// Separate creator voice: intentionally different from JARVIS.
// Used for YouTube Shorts/video narration assets, never for JARVIS replies.
const CREATOR_TTS_VOICE='tr-TR-EmelNeural';
const CREATOR_TTS_RATE='-7%';
const CREATOR_TTS_PITCH='-6Hz';
const CREATOR_TTS_VOLUME='+14%';

// Zero-cost local conversational brain. No paid API is used.
// Default model is intentionally small enough for older Windows laptops.
const LOCAL_BRAIN_URL=String(process.env.JARVIS_LOCAL_BRAIN_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
let LOCAL_BRAIN_MODEL=String(process.env.JARVIS_LOCAL_BRAIN_MODEL||'qwen3.5:2b').trim();
const LOCAL_BRAIN_KEEP_ALIVE=String(process.env.JARVIS_LOCAL_BRAIN_KEEP_ALIVE||'30m').trim();
const LOCAL_BRAIN_CTX=Math.max(4096,Math.min(16384,Number(process.env.JARVIS_LOCAL_BRAIN_CTX)||(
  os.totalmem()>=14*1073741824?12288:os.totalmem()>=7*1073741824?8192:4096
)));
const LOCAL_BRAIN_HISTORY_FILE=path.join(MEMORY_DIR,'brain-history.jsonl');
const LOCAL_BRAIN_FACTS_FILE=path.join(MEMORY_DIR,'brain-facts.jsonl');
const LOCAL_BRAIN_EPISODES_FILE=path.join(MEMORY_DIR,'brain-episodes.jsonl');
const LOCAL_BRAIN_PERSONA_FILE=path.join(MEMORY_DIR,'brain-persona.json');
const SPEECH_LEXICON_FILE=path.join(MEMORY_DIR,'speech-lexicon.json');
const TEST_MODE=process.env.JARVIS_TEST_MODE==='1';
const FORCE_LOCAL_BRIDGE=process.env.JARVIS_LOCAL_BRIDGE_FORCE==='1';
const LOCAL_STT_PORT=Number(process.env.JARVIS_STT_PORT||8768);
const LOCAL_STT_MODEL=String(process.env.JARVIS_STT_MODEL||'base').trim();
let speechQueue=Promise.resolve();
const TTS_LOCK_FILE=path.join(__dirname,'jarvis-tts-active.lock');
let lastQueuedSpeech='';
let lastQueuedSpeechAt=0;
let ttsPendingCount=0;
let ttsSpeaking=false;
let ttsLastStartedAt=0;
let ttsLastEndedAt=0;
let ttsGeneration=0;
let activeTtsPlayback=null;
let brainWarmState={status:'idle',model:null,startedAt:null,readyAt:null,latencyMs:null,error:null};
let episodeSummaryRunning=false;
let lastLocalWakeAt=0;
let localWakeCounter=0;

function runHidden(file,args,timeoutMs=60000){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn(file,args,{windowsHide:true,stdio:'ignore'});
    const finish=(err)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(err)reject(err);else resolve();
    };
    const timer=setTimeout(()=>{try{p.kill()}catch(e){};finish(new Error(file+' zaman aşımına uğradı'))},timeoutMs);
    p.on('error',finish);
    p.on('exit',code=>code===0?finish():finish(new Error(file+' çıkış kodu '+code)));
  });
}
function setTtsLock(active){
  try{
    if(active)fs.writeFileSync(TTS_LOCK_FILE,String(Date.now()),'utf8');
    else if(fs.existsSync(TTS_LOCK_FILE))fs.unlinkSync(TTS_LOCK_FILE);
  }catch(e){}
}
function killChildTree(p){
  if(!p||!p.pid)return;
  try{
    if(process.platform==='win32'){
      childProcess.spawn('taskkill.exe',['/PID',String(p.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).unref();
    }else{
      p.kill('SIGTERM');
    }
  }catch(_){}
}
function stopJarvisSpeech(reason='user'){
  ttsGeneration++;
  lastQueuedSpeech='';
  lastQueuedSpeechAt=0;
  ttsPendingCount=0;
  speechQueue=Promise.resolve();
  if(activeTtsPlayback){
    killChildTree(activeTtsPlayback);
    activeTtsPlayback=null;
  }
  ttsSpeaking=false;
  ttsLastEndedAt=Date.now();
  setTtsLock(false);
  remember({kind:'tts_interrupt',reason:String(reason||'user').slice(0,80),generation:ttsGeneration});
  return{ok:true,stopped:true,generation:ttsGeneration,reason:String(reason||'user')};
}
async function playTtsMp3Cancelable(mp3,generation){
  if(generation!==ttsGeneration)return false;
  const safe=mp3.replace(/'/g,"''");
  const ps="Add-Type -AssemblyName PresentationCore; $p=New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'"+safe+"'); for($i=0;$i -lt 100 -and -not $p.NaturalDuration.HasTimeSpan;$i++){Start-Sleep -Milliseconds 100}; $p.Volume=1.0; $p.Play(); if($p.NaturalDuration.HasTimeSpan){Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds+220)}else{Start-Sleep -Seconds 15}; $p.Close()";
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{
      windowsHide:true,stdio:'ignore'
    });
    activeTtsPlayback=p;
    const finish=(err)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(activeTtsPlayback===p)activeTtsPlayback=null;
      if(generation!==ttsGeneration)return resolve(false);
      if(err)return reject(err);
      resolve(true);
    };
    const timer=setTimeout(()=>{
      killChildTree(p);
      finish(new Error('TTS playback zaman aşımı'));
    },45000);
    p.on('error',finish);
    p.on('exit',code=>{
      if(generation!==ttsGeneration)return finish();
      code===0?finish():finish(new Error('TTS playback çıkış kodu '+code));
    });
  });
}
function ttsProfileForTone(tone='balanced',text=''){
  const t=String(tone||'balanced').toLowerCase();
  const profiles={
    balanced:{rate:'-18%',pitch:'-12Hz',volume:'+0%'},
    casual:{rate:'-13%',pitch:'-9Hz',volume:'+2%'},
    playful:{rate:'-9%',pitch:'-7Hz',volume:'+3%'},
    warm:{rate:'-21%',pitch:'-11Hz',volume:'+2%'},
    focused:{rate:'-14%',pitch:'-13Hz',volume:'+0%'},
    work:{rate:'-14%',pitch:'-13Hz',volume:'+0%'},
    serious:{rate:'-19%',pitch:'-14Hz',volume:'+0%'},
    excited:{rate:'-6%',pitch:'-5Hz',volume:'+3%'},
    gentle:{rate:'-24%',pitch:'-10Hz',volume:'+2%'}
  };
  const p={...(profiles[t]||profiles.balanced)};
  const clean=String(text||'');
  if(/[!?]{2,}|😂|🤣/.test(clean)&&['balanced','casual'].includes(t)){
    p.rate='-10%';p.pitch='-8Hz';p.volume='+3%';
  }
  if(clean.length>420&&t==='balanced')p.rate='-15%';
  return p;
}
function prepareJarvisSpeechText(text,tone='balanced'){
  let s=String(text||'').replace(/\s+/g,' ').trim();
  // Convert UI/technical notation into phrases a Turkish neural voice says naturally.
  s=s
    .replace(/\s*·\s*/g,', ')
    .replace(/\s*—\s*/g,', ')
    .replace(/\bPC\b/gi,'bilgisayar')
    .replace(/\bCPU\b/gi,'işlemci')
    .replace(/\bRAM\b/gi,'ram')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*GB\b/gi,'$1 gigabayt')
    .replace(/%(\s*\d+)/g,'yüzde $1')
    .replace(/\bWi[- ]?Fi\b/gi,'vay fay')
    .replace(/\bv(\d+)\.(\d+)\.(\d+)\b/gi,'sürüm $1 nokta $2 nokta $3')
    .replace(/https?:\/\//gi,'')
    .replace(/\s*\/\s*/g,' bölü ');
  if(tone==='playful'||tone==='excited')s=s.replace(/\.{3,}/g,'…');
  if(tone==='gentle')s=s.replace(/!+/g,'.');
  return s.slice(0,900);
}
function sapiRateForTone(tone='balanced'){
  const t=String(tone||'balanced').toLowerCase();
  if(t==='excited'||t==='playful')return 1;
  if(t==='casual'||t==='focused'||t==='work')return 0;
  if(t==='warm'||t==='serious')return -1;
  if(t==='gentle')return -2;
  return -1;
}
async function speakWindowsSapiFallback(text,tone='balanced',generation=ttsGeneration){
  if(process.platform!=='win32'||generation!==ttsGeneration)return false;
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,900);
  if(!clean)return false;
  const safe=clean.replace(/'/g,"''");
  const rate=sapiRateForTone(tone);
  const ps="Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate="+rate+"; $s.Volume=100; $s.Speak('"+safe+"'); $s.Dispose()";
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{
      windowsHide:true,stdio:'ignore'
    });
    activeTtsPlayback=p;
    const finish=(err)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(activeTtsPlayback===p)activeTtsPlayback=null;
      if(generation!==ttsGeneration)return resolve(false);
      if(err)return reject(err);
      resolve(true);
    };
    const timer=setTimeout(()=>{killChildTree(p);finish(new Error('SAPI TTS zaman aşımı'))},45000);
    p.on('error',finish);
    p.on('exit',code=>{
      if(generation!==ttsGeneration)return finish();
      code===0?finish():finish(new Error('SAPI TTS çıkış kodu '+code));
    });
  });
}
async function speakJarvisNow(text,tone='balanced',generation=ttsGeneration){
  if(!TTS_ENABLED||generation!==ttsGeneration)return;
  const clean=prepareJarvisSpeechText(text,tone);
  if(!clean)return;
  const profile=ttsProfileForTone(tone,clean);
  const mp3=path.join(os.tmpdir(),'jarvis-tts-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');
  ttsSpeaking=true;
  ttsLastStartedAt=Date.now();
  setTtsLock(true);
  try{
    let edgeReady=false;
    try{
      await runHidden('py',[
        '-m','edge_tts',
        '--voice',TTS_VOICE,
        '--rate='+profile.rate,
        '--pitch='+profile.pitch,
        '--volume='+profile.volume,
        '--text',clean,
        '--write-media',mp3
      ],45000);
      edgeReady=fs.existsSync(mp3)&&fs.statSync(mp3).size>512;
    }catch(e){
      console.error('[JARVIS] EDGE TTS FAILED, SAPI FALLBACK:',e.message);
    }
    if(generation!==ttsGeneration)return;
    if(edgeReady)await playTtsMp3Cancelable(mp3,generation);
    else await speakWindowsSapiFallback(clean,tone,generation);
  }finally{
    try{if(fs.existsSync(mp3))fs.unlinkSync(mp3)}catch(e){}
    if(generation===ttsGeneration){
      await new Promise(r=>setTimeout(r,220));
      ttsSpeaking=false;
      ttsLastEndedAt=Date.now();
      setTtsLock(false);
    }
  }
}
async function renderJarvisMp3Base64(text,tone='balanced'){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=prepareJarvisSpeechText(text,tone).slice(0,700);
  if(!clean)throw new Error('text required');
  const profile=ttsProfileForTone(tone,clean);
  const mp3=path.join(os.tmpdir(),'jarvis-mobile-tts-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');
  try{
    await runHidden('py',[
      '-m','edge_tts',
      '--voice',TTS_VOICE,
      '--rate='+profile.rate,
      '--pitch='+profile.pitch,
      '--volume='+MOBILE_TTS_VOLUME,
      '--text',clean,
      '--write-media',mp3
    ],45000);
    const buf=fs.readFileSync(mp3);
    if(!buf.length)throw new Error('empty tts audio');
    return buf.toString('base64');
  }finally{
    try{if(fs.existsSync(mp3))fs.unlinkSync(mp3)}catch(e){}
  }
}
async function renderCreatorVoiceFile(text,name='creator-voice'){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1600);
  if(!clean)throw new Error('text required');
  const dir=path.join(WORKSPACE,'creator-audio');
  fs.mkdirSync(dir,{recursive:true});
  const safeName=String(name||'creator-voice').replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,80)||'creator-voice';
  const out=path.join(dir,safeName+(safeName.toLowerCase().endsWith('.mp3')?'':'.mp3'));
  await runHidden('py',[
    '-m','edge_tts',
    '--voice',CREATOR_TTS_VOICE,
    '--rate='+CREATOR_TTS_RATE,
    '--pitch='+CREATOR_TTS_PITCH,
    '--volume='+CREATOR_TTS_VOLUME,
    '--text',clean,
    '--write-media',out
  ],60000);
  if(!fs.existsSync(out)||fs.statSync(out).size<512)throw new Error('creator audio render failed');
  return out;
}
function queueJarvisSpeech(text,tone='balanced'){
  if(!TTS_ENABLED)return;
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return;
  const now=Date.now();
  if(clean===lastQueuedSpeech && (now-lastQueuedSpeechAt)<15000){
    console.log('[JARVIS] TTS DUPLICATE SUPPRESSED');
    return;
  }
  lastQueuedSpeech=clean;
  lastQueuedSpeechAt=now;
  const generation=ttsGeneration;
  ttsPendingCount++;
  speechQueue=speechQueue
    .then(()=>generation===ttsGeneration?speakJarvisNow(clean,tone,generation):null)
    .catch(e=>console.error('[JARVIS] TTS:',e.message))
    .finally(()=>{ttsPendingCount=Math.max(0,ttsPendingCount-1)});
}

function showJarvisScreen(){
  if(process.platform!=='win32')return;
  const wakeUrl=BASE+'/?wake=clap&t='+Date.now();
  try{
    // Use the Windows default browser so Chrome, Edge, Opera GX, Brave,
    // Firefox, etc. all follow the same trusted-network wake flow.
    childProcess.spawn('cmd.exe',['/c','start','','"'+wakeUrl+'"'],{
      detached:true,windowsHide:true,stdio:'ignore'
    }).unref();
    console.log('[JARVIS] SCREEN: DEFAULT BROWSER OPEN');
  }catch(e){
    console.error('[JARVIS] SCREEN OPEN FAILED:',e.message);
  }
}

function isLocalSafeControlCommand(command){
  const c=String(command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  return /^(?:sistem durumu|system status|pc durumu|disk durumu|disk status|depolama durumu|ağ durumu|ag durumu|network status|internet durumu|pil durumu|batarya durumu|güç durumu|guc durumu|power status|sesi yükselt|sesi yukselt|ses yükselt|ses yukselt|sesi artır|sesi arttır|ses artır|volume up|sesi azalt|ses azalt|sesi kıs|sesi kis|ses kıs|ses kis|volume down|sessize al|sesi kapat|sesi sustur|mute|sesi aç|sesi ac|unmute|oynat|duraklat|devam ettir|oynat duraklat|play pause|play|pause|sonraki|sonraki şarkı|sonraki sarki|sonraki medya|next track|önceki|onceki|önceki şarkı|onceki sarki|previous track|medyayı durdur|medyayi durdur|stop media)$/i.test(c)
    || /^(?:dosyalarda ara|dosyalarda arat|workspace search)\s+.+$/i.test(c)
    || /^(?:aç|ac|open|uygulama aç|uygulama ac|program aç|program ac|site aç|site ac)\s+.+$/i.test(c)
    || /^.+?\s+(?:aç|ac)$/i.test(c);
}
function speechLexiconKey(text){
  return String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9çğıöşü\s.-]/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,240);
}
function defaultSpeechLexicon(){
  return{version:1,updatedAt:null,aliases:{},hotwords:[],history:[]};
}
function readSpeechLexicon(){
  try{
    if(!fs.existsSync(SPEECH_LEXICON_FILE))return defaultSpeechLexicon();
    const x=JSON.parse(fs.readFileSync(SPEECH_LEXICON_FILE,'utf8'));
    const aliases=x&&x.aliases&&typeof x.aliases==='object'&&!Array.isArray(x.aliases)?x.aliases:{};
    return{
      version:1,
      updatedAt:x.updatedAt||null,
      aliases,
      hotwords:Array.isArray(x.hotwords)?x.hotwords.filter(Boolean).slice(-160):[],
      history:Array.isArray(x.history)?x.history.slice(-120):[]
    };
  }catch(_){return defaultSpeechLexicon()}
}
function writeSpeechLexicon(data){
  const clean={
    version:1,
    updatedAt:new Date().toISOString(),
    aliases:data&&data.aliases&&typeof data.aliases==='object'?data.aliases:{},
    hotwords:Array.isArray(data&&data.hotwords)?[...new Set(data.hotwords.map(x=>String(x||'').trim()).filter(Boolean))].slice(-160):[],
    history:Array.isArray(data&&data.history)?data.history.slice(-120):[]
  };
  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  fs.writeFileSync(SPEECH_LEXICON_FILE,JSON.stringify(clean,null,2),'utf8');
  return clean;
}
function learnSpeechAlias(heard,intended,source='voice-correction'){
  const from=speechLexiconKey(heard);
  const target=String(intended||'').replace(/\s+/g,' ').trim().slice(0,240);
  if(!from||from.length<2||!target)return{ok:false,error:'heard and intended required'};
  if(from===speechLexiconKey(target))return{ok:false,error:'correction is identical'};
  const x=readSpeechLexicon();
  x.aliases[from]=target;
  const targetWords=target.split(/\s+/).filter(y=>y.length>=3);
  x.hotwords=[...new Set([...(x.hotwords||[]),target,...targetWords])].slice(-160);
  x.history=[...(x.history||[]),{
    at:new Date().toISOString(),action:'learn',heard:from,intended:target,source:String(source||'voice-correction').slice(0,80)
  }].slice(-120);
  const saved=writeSpeechLexicon(x);
  remember({kind:'speech_lexicon_learn',heard:from,intended:target,source:String(source||'voice-correction').slice(0,80)});
  return{ok:true,heard:from,intended:target,count:Object.keys(saved.aliases).length};
}
function forgetSpeechAlias(heard){
  const key=speechLexiconKey(heard);
  const x=readSpeechLexicon();
  if(!Object.prototype.hasOwnProperty.call(x.aliases,key))return{ok:false,error:'alias not found',heard:key};
  const intended=x.aliases[key];
  delete x.aliases[key];
  x.history=[...(x.history||[]),{
    at:new Date().toISOString(),action:'forget',heard:key,intended
  }].slice(-120);
  const saved=writeSpeechLexicon(x);
  remember({kind:'speech_lexicon_forget',heard:key,intended});
  return{ok:true,heard:key,intended,count:Object.keys(saved.aliases).length};
}
function applySpeechLexicon(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const key=speechLexiconKey(raw);
  if(!key)return raw;
  const x=readSpeechLexicon();
  if(x.aliases[key])return String(x.aliases[key]);
  const entries=Object.entries(x.aliases||{}).sort((a,b)=>b[0].length-a[0].length);
  let normalized=key;
  for(const [from,to] of entries){
    if(from.length<4)continue;
    const escaped=from.replace(/[.*+?^${}()|[\]\\]/g,'\\function brainPersona(){');
    const re=new RegExp('(^|\\s)'+escaped+'(?=\\s|$)','i');
    if(re.test(normalized)){
      normalized=normalized.replace(re,(m,prefix)=>prefix+String(to).toLocaleLowerCase('tr-TR'));
      break;
    }
  }
  return normalized===key?raw:normalized;
}
function handleSpeechLexiconDirective(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const plain=raw.replace(/[?.!,;:]+$/g,'').trim();
  let m=plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:dediğimde|dedigimde|dersem)\s+(.{2,120}?)\s+(?:anla|olarak anla|diye anla)$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:demek|demek istiyorum|demek istedim)\s+(.{2,120})$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s*=\s*(.{2,120})$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:ifadesini|kelimesini)?\s*(.{2,120}?)\s+(?:olarak düzelt|olarak duzelt|olarak anla)$/i);
  if(m){
    const learned=learnSpeechAlias(m[1],m[2],'explicit-teach');
    return learned.ok
      ?{handled:true,type:'chat',reply:'Tamam. "'+m[1].trim()+'" duyduğumda "'+m[2].trim()+'" olarak anlayacağım.',command:null,commands:[],tone:'warm'}
      :{handled:true,type:'chat',reply:'Bu düzeltmeyi kaydedemedim: '+learned.error,command:null,commands:[],tone:'warm'};
  }
  m=plain.match(/^(?:jarvis\s+)?(.{2,100}?)\s+(?:düzeltmesini|duyma düzeltmesini)\s+unut$/i);
  if(m){
    const forgotten=forgetSpeechAlias(m[1]);
    return{handled:true,type:'chat',reply:forgotten.ok?'Tamam, o ses düzeltmesini unuttum.':'Bu ifadeyle eşleşen bir ses düzeltmesi bulamadım.',command:null,commands:[],tone:'warm'};
  }
  if(/^(?:jarvis\s+)?(?:ses|konuşma|konusma)\s+düzeltmelerini\s+(?:göster|soyle|söyle)$/i.test(plain)){
    const x=readSpeechLexicon();
    const entries=Object.entries(x.aliases||{}).slice(-12);
    const reply=entries.length
      ?'Öğrendiğim son ses düzeltmeleri: '+entries.map(([a,b])=>'"'+a+'" → "'+b+'"').join(' · ')
      :'Henüz öğrendiğim özel bir ses düzeltmesi yok.';
    return{handled:true,type:'chat',reply,command:null,commands:[],tone:'focused'};
  }
  return{handled:false};
}
function brainPersona(){
  const defaults={
    version:2,
    name:'JARVIS',
    relationship:'Cihan Bey ile uzun süre çalışan kişisel yapay zeka asistanı',
    warmth:0.82,
    humor:0.68,
    directness:0.84,
    playfulness:0.62,
    verbosity:0.42,
    style:[
      'doğal Türkçe',
      'gerektiğinde kısa ve zeki espri',
      'lafı uzatmadan sohbeti taşı',
      'aynı kalıp açılışları tekrar etme',
      'emir eri gibi değil, akıllı bir yol arkadaşı gibi konuş',
      'kullanıcının enerjisine uyum sağla ama yapmacık olma'
    ]
  };
  try{
    if(fs.existsSync(LOCAL_BRAIN_PERSONA_FILE)){
      const x=JSON.parse(fs.readFileSync(LOCAL_BRAIN_PERSONA_FILE,'utf8'));
      return{...defaults,...x,style:Array.isArray(x.style)?x.style:defaults.style};
    }
  }catch(_){}
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(LOCAL_BRAIN_PERSONA_FILE,JSON.stringify(defaults,null,2),'utf8');
  }catch(_){}
  return defaults;
}
function saveBrainPersona(p){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(LOCAL_BRAIN_PERSONA_FILE,JSON.stringify(p,null,2),'utf8');
  }catch(_){}
}
function clamp01(x){return Math.max(0,Math.min(1,Number(x)||0))}
function updateBrainPersonaFromUserText(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  const p=brainPersona();
  let changed=false;
  const bump=(k,d)=>{const n=clamp01(Number(p[k]||0)+d);if(n!==p[k]){p[k]=n;changed=true}};

  if(/daha (?:eğlenceli|eglenceli|komik|şakacı|sakaci)|gırgır|girgir|şamata|samimi konuş|rahat konuş/.test(s)){bump('humor',0.14);bump('playfulness',0.14);bump('warmth',0.06)}
  if(/daha ciddi|şaka yapma|saka yapma|ciddi konuş/.test(s)){bump('humor',-0.22);bump('playfulness',-0.20);bump('directness',0.08)}
  if(/kısa konuş|kisa konus|uzatma|kısa cevap/.test(s)){bump('verbosity',-0.18);bump('directness',0.08)}
  if(/detaylı anlat|detayli anlat|uzun anlat|ayrıntılı anlat|ayrintili anlat/.test(s)){bump('verbosity',0.18)}
  if(/daha net|direkt konuş|direkt konus|lafı dolandırma|lafi dolandirma/.test(s)){bump('directness',0.12)}
  if(/daha sıcak|daha sicak|daha samimi/.test(s)){bump('warmth',0.12)}

  if(changed){
    p.updatedAt=new Date().toISOString();
    p.version=Math.max(2,Number(p.version)||2);
    saveBrainPersona(p);
    remember({kind:'brain_persona_adjusted',warmth:p.warmth,humor:p.humor,directness:p.directness,playfulness:p.playfulness,verbosity:p.verbosity});
  }
  return p;
}
function brainTokens(text){
  return [...new Set(String(text||'').toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü\s]/gi,' ')
    .split(/\s+/)
    .filter(x=>x.length>=3&&!['bir','bu','şu','icin','için','gibi','ama','daha','sonra','olan','olarak'].includes(x))
  )];
}
function brainSimilarity(query,candidate){
  const q=brainTokens(query),c=new Set(brainTokens(candidate));
  if(!q.length||!c.size)return 0;
  let hit=0;
  for(const t of q)if(c.has(t))hit++;
  return hit/Math.sqrt(q.length*c.size);
}
function readBrainFacts(limit=80){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_FACTS_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_FACTS_FILE,'utf8').split('\n').filter(Boolean)
      .slice(-limit).map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(Boolean);
  }catch(_){return []}
}
function appendBrainFact(text,kind='explicit_preference'){
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,500);
  if(!clean)return;
  const prior=readBrainFacts(120);
  if(prior.some(x=>String(x.text||'').toLocaleLowerCase('tr-TR')===clean.toLocaleLowerCase('tr-TR')))return;
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_FACTS_FILE,JSON.stringify({at:new Date().toISOString(),kind,text:clean})+'\n','utf8');
  }catch(_){}
}
function rewriteBrainFacts(rows){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    const data=(rows||[]).map(x=>JSON.stringify(x)).join('\n');
    fs.writeFileSync(LOCAL_BRAIN_FACTS_FILE,data+(data?'\n':''),'utf8');
    return true;
  }catch(_){return false}
}
function removeBrainFactsMatching(query){
  const q=String(query||'').replace(/\s+/g,' ').trim();
  if(!q)return 0;
  const rows=readBrainFacts(200);
  const kept=[],removed=[];
  for(const x of rows){
    const text=String(x.text||'');
    const same=text.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'))
      || q.toLocaleLowerCase('tr-TR').includes(text.toLocaleLowerCase('tr-TR'))
      || brainSimilarity(q,text)>=0.48;
    (same?removed:kept).push(x);
  }
  if(removed.length)rewriteBrainFacts(kept);
  return removed.length;
}
function handleBrainMemoryDirective(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const plain=raw.replace(/[?.!,;:]+$/g,'').trim();
  let m=plain.match(/^(?:jarvis\s+)?(?:şunu|sunu|bunu)?\s*(?:hatırla|hatirla|aklında tut|aklinda tut)\s*[:,-]?\s*(.+)$/i);
  if(m&&m[1]){
    appendBrainFact(m[1].trim(),'explicit_memory');
    return{handled:true,reply:'Tamam. Bunu yerel hafızama aldım.',command:null,type:'chat'};
  }
  m=plain.match(/^(?:jarvis\s+)?(?:şunu|sunu|bunu)?\s*(?:unut|unut gitsin)\s*[:,-]?\s*(.+)$/i);
  if(m&&m[1]){
    const n=removeBrainFactsMatching(m[1].trim());
    return{handled:true,reply:n?('Tamam, '+n+' hafıza kaydını çıkardım.'):'Bu ifadeyle eşleşen kalıcı bir hafıza kaydı bulamadım.',command:null,type:'chat'};
  }
  if(/^(?:jarvis\s+)?(?:benimle ilgili )?(?:ne hatırlıyorsun|ne hatirliyorsun|neleri hatırlıyorsun|neleri hatirliyorsun)$/i.test(plain)){
    const facts=readBrainFacts(12).slice(-8);
    if(!facts.length)return{handled:true,reply:'Kalıcı yerel hafızamda henüz açık bir tercih kaydı yok.',command:null,type:'chat'};
    const summary=facts.map(x=>String(x.text||'')).filter(Boolean).join(' · ');
    return{handled:true,reply:'Şu an aklımda kalanlar: '+summary.slice(0,850),command:null,type:'chat'};
  }
  return{handled:false};
}
function maybeRememberExplicitPreference(text){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean||clean.length>500)return;
  if(/\b(?:seviyorum|sevmiyorum|istemiyorum|istiyorum|tercih ediyorum|tercihim|bundan sonra|unutma|hatırla|aklında tut|böyle konuş|şöyle konuş)\b/i.test(clean)){
    appendBrainFact(clean,'explicit_preference');
  }
}
function isContextRecallQuery(query){
  const s=String(query||'').toLocaleLowerCase('tr-TR').replace(/[?.!,;:]+/g,' ').replace(/\s+/g,' ').trim();
  return /^(?:devam et|devam|oradan devam et|kaldığımız yerden devam et|kaldigimiz yerden devam et|nerede kalmıştık|nerede kalmistik|ne yapıyorduk|ne yapiyorduk|ne yapacaktık|ne yapacaktik|az önceki|az onceki|önceki konu|onceki konu|ona devam et|onu yap|onu aç|onu ac|ikincisi|ikincisini yap)$/i.test(s)
    || /\b(?:az önce|az once|bir önceki|bir onceki|kaldığımız yer|kaldigimiz yer|devam edelim)\b/i.test(s);
}
function recentEpisodeContext(limit=3){
  return readBrainEpisodes(120).slice(-limit).reverse().map((ep,i)=>{
    const packed=[
      ep.summary,
      ...(Array.isArray(ep.decisions)?ep.decisions:[]),
      ...(Array.isArray(ep.unresolved)?ep.unresolved:[]),
      ...(Array.isArray(ep.topics)?ep.topics:[])
    ].filter(Boolean).join(' · ');
    return{score:1.40-(i*0.10),text:String(ep.summary||packed),role:'episode',packed};
  }).filter(x=>x.text);
}
function relevantBrainMemory(query,limit=5){
  const rows=[];
  try{
    if(fs.existsSync(LOCAL_BRAIN_HISTORY_FILE)){
      const all=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean).slice(-160)
        .map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
      all.forEach((x,i)=>{
        const score=brainSimilarity(query,x.content)+(i/Math.max(1,all.length))*0.08;
        if(score>0.12)rows.push({score,text:String(x.content||''),role:x.role||'unknown'});
      });
    }
  }catch(_){}
  for(const f of readBrainFacts()){
    const score=brainSimilarity(query,f.text)+0.18;
    if(score>0.18)rows.push({score,text:String(f.text||''),role:'memory'});
  }
  for(const ep of readBrainEpisodes(120)){
    const packed=[
      ep.summary,
      ...(Array.isArray(ep.topics)?ep.topics:[]),
      ...(Array.isArray(ep.decisions)?ep.decisions:[]),
      ...(Array.isArray(ep.preferences)?ep.preferences:[]),
      ...(Array.isArray(ep.unresolved)?ep.unresolved:[])
    ].filter(Boolean).join(' · ');
    const score=brainSimilarity(query,packed)+0.10;
    if(score>0.16)rows.push({score,text:String(ep.summary||packed),role:'episode'});
  }
  if(isContextRecallQuery(query)){
    for(const r of recentEpisodeContext(3)){
      rows.push({score:r.score,text:r.text,role:'episode'});
    }
  }
  rows.sort((a,b)=>b.score-a.score);
  const seen=new Set(),out=[];
  for(const r of rows){
    const key=r.role+'|'+r.text.toLocaleLowerCase('tr-TR');
    if(seen.has(key))continue;
    seen.add(key);out.push(r);
    if(out.length>=limit)break;
  }
  return out;
}
function recentBrainHistory(limit=6){
  const all=readLocalBrainHistory(Math.max(limit,6));
  return all.slice(-limit);
}
function inferBrainTurnStyle(text,persona){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  let mode='balanced',temperature=0.68;
  let instruction='Doğal ve akıcı konuş.';
  if(/\b(?:acil|hemen|hızlı|hizli|uzatma|direkt)\b/.test(s)){
    mode='focused';temperature=0.38;instruction='Bu tur hızlı ve net ol; espriyi minimumda tut.';
  }else if(/\b(?:ahah|haha|hehe|gırgır|girgir|şaka|saka|komik|eğlen|eglen)\b/.test(s)||/[😂🤣😄😅]/u.test(s)){
    mode='playful';temperature=0.82;instruction='Bu tur biraz daha oyunbaz ve esprili ol; yine de cevabı işe yarar tut.';
  }else if(/\b(?:canım sıkkın|canim sikkin|moralim bozuk|keyfim yok|yoruldum)\b/.test(s)){
    mode='warm';temperature=0.62;instruction='Bu tur sıcak ve anlayışlı ol; klişe teselli cümleleri kurma, doğal konuş.';
  }else if(/\b(?:iş|is|kod|hata|debug|proje|deploy|rapor|analiz)\b/.test(s)){
    mode='work';temperature=0.48;instruction='Bu tur çözüm odaklı ve teknik olarak net ol; gereksiz şamata yapma.';
  }else if(/^(?:naber|ne haber|napıyorsun|napion|nasılsın|nasilsin|selam|merhaba)\b/.test(s)){
    mode='casual';temperature=0.78;instruction='Gündelik sohbet tonu kullan; kısa, samimi ve hafif eğlenceli cevap ver.';
  }
  const humor=Number(persona&&persona.humor||0.68);
  if(mode==='balanced')temperature=Math.max(0.48,Math.min(0.82,0.56+humor*0.18));
  return{mode,temperature,instruction};
}
function shouldDeepReflect(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  return /\b(?:kapsamlı|kapsamli|derin düşün|derin dusun|detaylı düşün|detayli dusun|analiz et|karşılaştır|karsilastir|artıları ve eksileri|artilari ve eksileri|strateji|nedenlerini incele|mantığını incele|mantigini incele)\b/.test(s);
}
function brainResponseLooksWeak(reply,previous=[]){
  const s=String(reply||'').trim();
  if(s.length<2||s.length>900)return true;
  if(/^(?:buradayım cihan bey[.!]?|size nasıl yardımcı olabilirim[?]?|elbette[.!]?|tabii ki[.!]?)$/i.test(s))return true;
  if((s.match(/Cihan Bey/gi)||[]).length>1)return true;

  const assistant=previous.filter(x=>x.role==='assistant').slice(-5).map(x=>String(x.content||'').trim());
  if(assistant.map(x=>x.toLocaleLowerCase('tr-TR')).includes(s.toLocaleLowerCase('tr-TR')))return true;

  const opener=x=>x.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşüı\s]/gi,' ').split(/\s+/).filter(Boolean).slice(0,3).join(' ');
  const currentOpener=opener(s);
  if(currentOpener&&assistant.filter(x=>opener(x)===currentOpener).length>=2)return true;

  if(/^(?:elbette|tabii ki|memnuniyetle|harika bir soru)[,!.\s]/i.test(s)&&assistant.some(x=>/^(?:elbette|tabii ki|memnuniyetle|harika bir soru)[,!.\s]/i.test(x)))return true;
  return false;
}
function normalizeBrainReply(reply){
  let s=String(reply||'').replace(/\s+/g,' ').trim();
  s=s.replace(/^(?:Elbette|Tabii ki|Tabii),?\s+Cihan Bey[,.]?\s*/i,'');
  if(s.length>900)s=s.slice(0,897)+'...';
  return s||'Buradayım.';
}
function readBrainEpisodes(limit=80){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_EPISODES_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_EPISODES_FILE,'utf8').split('\n').filter(Boolean)
      .slice(-limit).map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(Boolean);
  }catch(_){return []}
}
function appendBrainEpisode(episode){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_EPISODES_FILE,JSON.stringify({
      at:new Date().toISOString(),...episode
    })+'\n','utf8');
    const lines=fs.readFileSync(LOCAL_BRAIN_EPISODES_FILE,'utf8').split('\n').filter(Boolean);
    if(lines.length>240)fs.writeFileSync(LOCAL_BRAIN_EPISODES_FILE,lines.slice(-180).join('\n')+'\n','utf8');
  }catch(_){}
}
async function summarizeBrainEpisodeIfNeeded(){
  if(episodeSummaryRunning)return false;
  let rows=[];
  try{
    if(!fs.existsSync(LOCAL_BRAIN_HISTORY_FILE))return false;
    rows=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean)
      .map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
  }catch(_){return false}
  if(rows.length<72)return false;

  const status=await localBrainStatus();
  if(!status.ready||!status.installed)return false;

  episodeSummaryRunning=true;
  try{
    const chunk=rows.slice(0,28);
    const transcript=chunk.map(x=>(x.role==='user'?'Kullanıcı':'JARVIS')+': '+String(x.content||'')).join('\n').slice(0,9000);
    const schema={
      type:'object',
      properties:{
        summary:{type:'string'},
        topics:{type:'array',items:{type:'string'}},
        decisions:{type:'array',items:{type:'string'}},
        preferences:{type:'array',items:{type:'string'}},
        unresolved:{type:'array',items:{type:'string'}}
      },
      required:['summary','topics','decisions','preferences','unresolved'],
      additionalProperties:false
    };
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.15,top_p:0.8,num_ctx:LOCAL_BRAIN_CTX,num_predict:260},
        messages:[
          {role:'system',content:'Aşağıdaki sohbet bölümünü gelecekte bağlamı korumak için Türkçe ve kısa biçimde özetle. Yalnızca açıkça söylenen bilgileri koru; hassas kişisel özellikler hakkında çıkarım yapma. Kararlar, tercihler ve açık kalan işleri ayrı alanlarda tut.'},
          {role:'user',content:transcript}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.summary)throw new Error('EPISODE_BAD_JSON');

    appendBrainEpisode({
      summary:String(parsed.summary).replace(/\s+/g,' ').trim().slice(0,1600),
      topics:Array.isArray(parsed.topics)?parsed.topics.slice(0,12):[],
      decisions:Array.isArray(parsed.decisions)?parsed.decisions.slice(0,12):[],
      preferences:Array.isArray(parsed.preferences)?parsed.preferences.slice(0,12):[],
      unresolved:Array.isArray(parsed.unresolved)?parsed.unresolved.slice(0,12):[],
      sourceMessages:chunk.length,
      model:LOCAL_BRAIN_MODEL
    });

    const remaining=rows.slice(28);
    fs.writeFileSync(LOCAL_BRAIN_HISTORY_FILE,remaining.map(x=>JSON.stringify(x)).join('\n')+(remaining.length?'\n':''),'utf8');
    remember({kind:'brain_episode_compacted',messages:chunk.length,remaining:remaining.length,model:LOCAL_BRAIN_MODEL});
    return true;
  }catch(e){
    remember({kind:'brain_episode_error',error:String(e.message||e).slice(0,220)});
    return false;
  }finally{
    episodeSummaryRunning=false;
  }
}
function queueBrainEpisodeSummary(){
  if(episodeSummaryRunning)return;
  setTimeout(()=>summarizeBrainEpisodeIfNeeded().catch(()=>{}),60);
}
function readLocalBrainHistory(limit=10){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_HISTORY_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8')
      .split('\n').filter(Boolean).slice(-Math.max(2,limit*2))
      .map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string');
  }catch(_){return []}
}
function appendLocalBrainHistory(role,content){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_HISTORY_FILE,JSON.stringify({
      at:new Date().toISOString(),role,content:String(content||'').slice(0,1600)
    })+'\n','utf8');
    const lines=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean);
    if(lines.length>180)fs.writeFileSync(LOCAL_BRAIN_HISTORY_FILE,lines.slice(-140).join('\n')+'\n','utf8');
    if(role==='assistant')queueBrainEpisodeSummary();
  }catch(_){}
}
async function localBrainStatus(){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),1800);
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/tags',{signal:ctl.signal});
    clearTimeout(timer);
    if(!r.ok)return{ready:false,model:LOCAL_BRAIN_MODEL,error:'HTTP '+r.status};
    const j=await r.json().catch(()=>({}));
    const models=(j.models||[]).map(x=>String(x.name||x.model||''));
    const has=m=>models.some(x=>x===m||x.startsWith(m+':'));

    if(!process.env.JARVIS_LOCAL_BRAIN_MODEL){
      const ramGb=os.totalmem()/1073741824;
      const candidates=ramGb>=14?['qwen3.5:4b','qwen3.5:2b','qwen3.5:0.8b','qwen3:4b','qwen3:1.7b','qwen3:0.6b']
        :ramGb>=7?['qwen3.5:2b','qwen3.5:0.8b','qwen3:1.7b','qwen3:0.6b']
        :['qwen3.5:0.8b','qwen3:0.6b','qwen3.5:2b','qwen3:1.7b'];
      const found=candidates.find(has);
      if(found)LOCAL_BRAIN_MODEL=found;
    }

    const installed=has(LOCAL_BRAIN_MODEL);
    return{
      ready:true,
      installed,
      model:LOCAL_BRAIN_MODEL,
      models:models.slice(0,12),
      ramGb:Number((os.totalmem()/1073741824).toFixed(1)),
      vision:/^qwen3\.5(?::|$)/i.test(LOCAL_BRAIN_MODEL)
    };
  }catch(e){
    clearTimeout(timer);
    return{ready:false,installed:false,model:LOCAL_BRAIN_MODEL,error:String(e.message||e)};
  }
}
async function warmLocalBrain(){
  if(brainWarmState.status==='warming')return brainWarmState;
  brainWarmState={status:'warming',model:LOCAL_BRAIN_MODEL,startedAt:new Date().toISOString(),readyAt:null,latencyMs:null,error:null};
  const started=Date.now();
  try{
    const status=await localBrainStatus();
    if(!status.ready)throw new Error(status.error||'OLLAMA_OFFLINE');
    if(!status.installed)throw new Error('MODEL_NOT_INSTALLED');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0,num_ctx:1024,num_predict:2},
        messages:[
          {role:'system',content:'Bu yalnızca yerel model ısınma testidir. Kısa cevap ver.'},
          {role:'user',content:'OK'}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    brainWarmState={
      status:'ready',
      model:LOCAL_BRAIN_MODEL,
      startedAt:brainWarmState.startedAt,
      readyAt:new Date().toISOString(),
      latencyMs:Date.now()-started,
      error:null
    };
    console.log('[JARVIS] LOCAL BRAIN WARM: '+LOCAL_BRAIN_MODEL+' · '+brainWarmState.latencyMs+'ms');
  }catch(e){
    brainWarmState={
      status:'error',
      model:LOCAL_BRAIN_MODEL,
      startedAt:brainWarmState.startedAt,
      readyAt:null,
      latencyMs:Date.now()-started,
      error:String(e.message||e).slice(0,220)
    };
    console.error('[JARVIS] LOCAL BRAIN WARMUP:',brainWarmState.error);
  }
  return brainWarmState;
}
function extractLocalBrainJson(text){
  const raw=String(text||'').trim();
  try{return JSON.parse(raw)}catch(_){}
  const m=raw.match(/\{[\s\S]*\}/);
  if(m)try{return JSON.parse(m[0])}catch(_){}
  return null;
}
async function callLocalBrain(message){
  const originalText=String(message||'').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!originalText)return{ok:true,type:'chat',reply:'Sizi dinliyorum Cihan Bey.',command:null};

  const lexiconDirective=handleSpeechLexiconDirective(originalText);
  if(lexiconDirective.handled){
    appendLocalBrainHistory('user',originalText);
    appendLocalBrainHistory('assistant',lexiconDirective.reply);
    return{ok:true,...lexiconDirective,model:'local-speech-lexicon',memoryHits:0,personaVersion:brainPersona().version};
  }

  const text=applySpeechLexicon(originalText);

  const memoryDirective=handleBrainMemoryDirective(text);
  if(memoryDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',memoryDirective.reply);
    return{ok:true,...memoryDirective,commands:[],model:'local-memory',memoryHits:0,personaVersion:brainPersona().version,tone:'warm'};
  }

  maybeRememberExplicitPreference(text);
  const adjustedPersona=updateBrainPersonaFromUserText(text);

  const status=await localBrainStatus();
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};

  // Keep enough short-term dialogue turns for natural references such as
  // "az önce", "onu", "ikincisi" even after several tool/command turns.
  const recent=recentBrainHistory(12);
  const memory=relevantBrainMemory(text,6);
  const workspaceCtx=workspaceBrainContext(text,3);
  const persona=adjustedPersona||brainPersona();
  const turnStyle=inferBrainTurnStyle(text,persona);
  const deepRequested=shouldDeepReflect(text);
  const memoryText=memory.length
    ? memory.map(x=>'- '+(x.role==='memory'?'Hatırlanan tercih':x.role==='episode'?'Eski sohbet özeti':'Önceki konuşma')+': '+x.text).join('\n')
    : '- İlgili eski kayıt yok.';

  const system=[
    'Sen JARVIS\'sin; Cihan Bey\'in uzun süreli kişisel yapay zeka asistanısın.',
    'Önceliklerin: doğru anlama, doğal sohbet, güvenli eylem, bağlamı koruma ve sonuç odaklılık.',
    'Türkçe konuş. İnsan gibi ritimli, sıcak, zeki ve rahat konuş; robotik kalıp cümlelerden kaçın.',
    'Gerçek bir insan sohbetindeki gibi bağlama göre bazen kısa karşılık, bazen espri, bazen doğrudan çözüm ver. Her turu aynı kalıpla açma.',
    'Kullanıcı bir şey anlatıyorsa hemen komuta dönüştürmeye çalışma; sohbeti sohbet olarak sürdürebil.',
    'Uygun olduğunda kısa gırgır, ince espri veya karşılık ver. Her cümlede şaka yapma.',
    'Kullanıcı şakalaşıyorsa enerjiyi karşıla; ciddi iş veriyorsa hızla ciddileş.',
    'Cihan Bey hitabını ara sıra kullan; her cevapta tekrarlama.',
    'Kısa soruya kısa cevap ver. Sohbet uzarsa doğal biçimde devam ettir.',
    'Önceki konuşmadaki zamirleri ve eksik ifadeleri bağlamdan çözmeye çalış.',
    'Kullanıcı sadece "devam et", "nerede kalmıştık", "onu yap", "az önceki" gibi bir bağlam ifadesi kullanırsa son konuşma ve Eski sohbet özeti kayıtlarını özellikle kullan. Tek makul referans varsa tekrar sorma; birden fazla makul referans varsa tek kısa netleştirme sorusu sor.',
    'Bilmediğin şeyi uydurma. Gerçek PC eylemi yapılmadıysa yapıldı deme.',
    'Bir bilgisayar eylemi isteniyorsa yalnızca desteklenen güvenli komutlardan birine normalize et.',
    'Kullanıcı aynı cümlede iki veya daha fazla güvenli eylem isterse type=plan kullan ve commands alanına en fazla dört komutu doğru sırayla koy.',
    'Tek eylem için type=command kullan; command alanına tek standart komut yaz ve commands boş dizi olsun.',
    'Sohbet için type=chat kullan; command null ve commands boş dizi olsun.',
    'Desteklenen güvenli komutlar: sistem durumu, disk durumu, ağ durumu, pil durumu, sesi yükselt, sesi azalt, sessize al, oynat, duraklat, sonraki, önceki, medyayı durdur, youtube aç, google aç, github aç, chatgpt aç, opera gx aç, chrome aç, edge aç, not defteri aç, hesap makinesi aç, dosya gezgini aç, görev yöneticisi aç, ayarlar aç, ses ayarları aç, bluetooth ayarları aç, wifi ayarları aç, çalışma alanı aç, dosyalarda ara <arama ifadesi>.',
    'Güvenli katalog dışındaki eylemleri type=chat olarak ele al; açık ve kısa biçimde henüz bağlı olmadığını söyle.',
    'Belirsizse tek kısa soru sor. Gereksiz teyit isteme.',
    'Kullanıcının açık tercihlerini hatırla ancak hassas özellikler hakkında çıkarım yapma.',
    'Yerel ses sözlüğü daha önce yanlış duyulan ifadeleri düzeltebilir. Düzeltilmiş kullanıcı metnini esas al; eski yanlış biçimi geri üretmeye çalışma.',
    'Kişilik ayarları: sıcaklık '+persona.warmth+', mizah '+persona.humor+', doğrudanlık '+persona.directness+', oyunbazlık '+persona.playfulness+'.',
    'Bu tur konuşma modu: '+turnStyle.mode+'. '+turnStyle.instruction,
    'tone alanı seslendirme duygusudur. balanced/casual/playful/warm/focused/work/serious/excited/gentle seçeneklerinden cevabın anlamına en uygun olanı seç.',
    'İlgili yerel hafıza:\n'+memoryText,
    workspaceCtx.context
      ?('Yerel çalışma alanından ilgili bağlam aşağıdadır. Yalnızca gerçekten ilgili olduğunda kullan; kaynakta olmayan bilgiyi uydurma.\n'+workspaceCtx.context)
      :'Yerel çalışma alanından bu istek için ek bağlam yok.',
    'SADECE verilen JSON şemasına uygun cevap üret.'
  ].join(' ');

  const schema={
    type:'object',
    properties:{
      type:{type:'string',enum:['chat','command','plan']},
      reply:{type:'string'},
      command:{anyOf:[{type:'string'},{type:'null'}]},
      commands:{type:'array',items:{type:'string'},maxItems:4},
      tone:{type:'string',enum:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']}
    },
    required:['type','reply','command','commands','tone'],
    additionalProperties:false
  };

  const makeBody=(repairNote='')=>({
    model:LOCAL_BRAIN_MODEL,
    stream:false,
    think:false,
    format:schema,
    keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
    options:{
      temperature:repairNote?0.25:turnStyle.temperature,
      top_p:0.9,
      repeat_penalty:1.10,
      num_ctx:LOCAL_BRAIN_CTX,
      num_predict:Math.round(140+Math.max(0,Math.min(1,Number(persona.verbosity||0.42)))*220)
    },
    messages:[
      {role:'system',content:system+(repairNote?' DÜZELTME: '+repairNote:'')},
      ...recent.map(x=>({role:x.role,content:x.content})),
      {role:'user',content:text}
    ]
  });

  const ask=async(body)=>{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
    try{
      const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body),
        signal:ctl.signal
      });
      clearTimeout(timer);
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
      return extractLocalBrainJson(j&&j.message&&j.message.content);
    }finally{clearTimeout(timer)}
  };

  try{
    let parsed=await ask(makeBody());
    if(!parsed)parsed=await ask(makeBody('Önceki çıktı geçerli JSON değildi. Şemaya eksiksiz uy.'));

    if(!parsed)throw new Error('LOCAL_BRAIN_BAD_JSON');

    let type=parsed.type==='plan'?'plan':parsed.type==='command'?'command':'chat';
    let reply=normalizeBrainReply(parsed.reply);
    let command=parsed.command==null?null:String(parsed.command).trim();
    let commands=Array.isArray(parsed.commands)?parsed.commands.map(x=>String(x||'').trim()).filter(Boolean).slice(0,4):[];
    const allowedTones=new Set(['balanced','casual','playful','warm','focused','work','serious','excited','gentle']);
    let tone=allowedTones.has(String(parsed.tone||''))?String(parsed.tone):turnStyle.mode;

    if(type==='command'){
      commands=[];
      if(!isLocalSafeControlCommand(command)){
        type='chat';command=null;
        reply='Ne demek istediğinizi anladım; fakat bu eylem henüz güvenli yerel araç listeme bağlı değil.';
      }
    }
    if(type==='plan'){
      command=null;
      if(commands.length<2||commands.some(x=>!isLocalSafeControlCommand(x))){
        type='chat';commands=[];
        reply='İsteğinizde birden fazla adım var ama bazı adımlar henüz güvenli yerel araç listemde değil. Desteklediğim kısmı netleştirirseniz uygulayabilirim.';
      }
    }

    if(type==='chat'&&brainResponseLooksWeak(reply,recent)){
      const repaired=await ask(makeBody('Yanıt fazla kalıp, tekrarlı veya cansız. Aynı anlamı daha doğal, insan gibi ve kısa biçimde yeniden yaz.'));
      if(repaired&&repaired.reply){
        reply=normalizeBrainReply(repaired.reply);
        if(allowedTones.has(String(repaired.tone||'')))tone=String(repaired.tone);
      }
    }

    if(type==='chat'&&deepRequested){
      const deepSchema={
        type:'object',
        properties:{
          reply:{type:'string'},
          tone:{type:'string',enum:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']}
        },
        required:['reply','tone'],
        additionalProperties:false
      };
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
      const deepStarted=Date.now();
      try{
        const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            model:LOCAL_BRAIN_MODEL,
            stream:false,
            think:true,
            format:deepSchema,
            keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
            options:{temperature:0.34,top_p:0.88,repeat_penalty:1.10,num_ctx:LOCAL_BRAIN_CTX,num_predict:Math.max(220,Math.round(180+Number(persona.verbosity||0.42)*260))},
            messages:[
              {role:'system',content:[
                'Sen JARVIS yanıt kalite denetleyicisisin.',
                'Aşağıdaki taslak cevabı kullanıcının isteğine göre bir kez iyileştir.',
                'Mantıksal tutarlılığı artır, gereksiz tekrarları çıkar, doğrudan sonuca git.',
                'Yerel kaynak bağlamı verilmişse ona sadık kal. Kaynakta veya konuşmada olmayan somut bilgi uydurma.',
                'Gizli düşünme sürecini anlatma; yalnızca geliştirilmiş nihai cevabı döndür.',
                'SADECE JSON şemasına uy.'
              ].join(' ')},
              {role:'user',content:'İSTEK: '+text+'\nTASLAK: '+reply+'\nYEREL BAĞLAM:\n'+(workspaceCtx.context||'(yok)')}
            ]
          }),
          signal:ctl.signal
        });
        clearTimeout(timer);
        const j=await r.json().catch(()=>({}));
        if(r.ok){
          const refined=extractLocalBrainJson(j&&j.message&&j.message.content);
          if(refined&&refined.reply){
            reply=normalizeBrainReply(refined.reply);
            if(allowedTones.has(String(refined.tone||'')))tone=String(refined.tone);
            remember({kind:'deep_reflection',model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-deepStarted,workspaceSources:workspaceCtx.sources,thinking:true,context:LOCAL_BRAIN_CTX});
          }
        }
      }catch(e){
        clearTimeout(timer);
        remember({kind:'deep_reflection_error',error:String(e.message||e).slice(0,180)});
      }
    }

    appendLocalBrainHistory('user',text);
    if(type==='chat')appendLocalBrainHistory('assistant',reply);
    remember({
      kind:'local_brain_v2',
      type,command:command||null,commands,model:LOCAL_BRAIN_MODEL,
      memoryHits:memory.length,mode:turnStyle.mode,contextRecall:isContextRecallQuery(text),
      workspaceSources:workspaceCtx.sources,deepReflected:deepRequested&&type==='chat'
    });
    return{
      ok:true,type,reply,command,commands,model:LOCAL_BRAIN_MODEL,
      memoryHits:memory.length,personaVersion:persona.version,tone,
      workspaceSources:workspaceCtx.sources,deepReflected:deepRequested&&type==='chat'
    };
  }catch(e){
    return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL};
  }
}

function isLocalVisionModel(model=LOCAL_BRAIN_MODEL){
  return /^qwen3\.5(?::|$)/i.test(String(model||''));
}
function cleanImageBase64(value){
  let s=String(value||'').trim();
  s=s.replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i,'');
  if(!s||s.length>4200000)return null;
  if(!/^[A-Za-z0-9+/=\r\n]+$/.test(s))return null;
  return s.replace(/\s+/g,'');
}
async function analyzeLocalImage(imageBase64,question='Bu görüntüde ne görüyorsun?'){
  const image=cleanImageBase64(imageBase64);
  const q=String(question||'Bu görüntüde ne görüyorsun?').replace(/\s+/g,' ').trim().slice(0,900);
  if(!image)return{ok:false,error:'INVALID_IMAGE'};
  const status=await localBrainStatus();
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};
  if(!isLocalVisionModel(status.model))return{ok:false,error:'VISION_MODEL_REQUIRED',model:status.model};

  const allowedTones=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'];
  const schema={
    type:'object',
    properties:{
      reply:{type:'string'},
      tone:{type:'string',enum:allowedTones},
      observations:{type:'array',items:{type:'string'},maxItems:6}
    },
    required:['reply','tone','observations'],
    additionalProperties:false
  };
  const system=[
    'Sen JARVIS yerel görsel analiz modülüsün.',
    'Görüntü cihazdan yalnızca bu bilgisayardaki yerel modele gönderildi; buluta gönderilmedi.',
    'Türkçe, doğal ve kısa cevap ver.',
    'Yalnızca görüntüde makul biçimde görülebilen şeyleri söyle; emin olmadığın ayrıntıları kesinmiş gibi yazma.',
    'Gerçek kişilerin kimliğini tahmin etme veya isim verme. Hassas özellik çıkarımı yapma.',
    'Metin görünüyorsa okunabilen kısmı aktarabilirsin; okunmuyorsa uydurma.',
    'Kullanıcının sorusuna doğrudan cevap ver ve SADECE JSON şemasına uy.'
  ].join(' ');

  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),60000);
  const started=Date.now();
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.28,top_p:0.86,repeat_penalty:1.06,num_ctx:LOCAL_BRAIN_CTX,num_predict:260},
        messages:[
          {role:'system',content:system},
          {role:'user',content:q,images:[image]}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.reply)throw new Error('VISION_BAD_JSON');
    const reply=normalizeBrainReply(parsed.reply);
    const tone=allowedTones.includes(String(parsed.tone||''))?String(parsed.tone):'focused';
    const observations=Array.isArray(parsed.observations)
      ? parsed.observations.map(x=>String(x||'').trim()).filter(Boolean).slice(0,6)
      : [];
    appendLocalBrainHistory('user','[Yerel görüntü sorusu] '+q);
    appendLocalBrainHistory('assistant',reply);
    remember({kind:'local_vision',model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,observations:observations.length});
    return{ok:true,reply,tone,observations,model:LOCAL_BRAIN_MODEL,localOnly:true,latencyMs:Date.now()-started};
  }catch(e){
    clearTimeout(timer);
    remember({kind:'local_vision_error',model:LOCAL_BRAIN_MODEL,error:String(e.message||e).slice(0,220)});
    return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL};
  }
}
function nativeAgentTools(){
  return[
    {
      type:'function',
      function:{
        name:'system_status',
        description:'Bilgisayarın temel sistem durumunu getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'disk_status',
        description:'Yerel disklerin boş ve toplam alanını getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'network_status',
        description:'Bilgisayarın aktif yerel ağ arayüzlerini getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'power_status',
        description:'Pil ve güç durumunu getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'open_target',
        description:'Yalnızca JARVIS güvenli katalogunda bulunan uygulama, ayar veya siteyi aç.',
        parameters:{
          type:'object',
          properties:{target:{type:'string',description:'Örn. youtube, google, github, chatgpt, opera gx, chrome, edge, not defteri, hesap makinesi, dosya gezgini, görev yöneticisi, ayarlar, ses ayarları, bluetooth ayarları, wifi ayarları, çalışma alanı'}},
          required:['target'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'media_control',
        description:'Windows medya veya ses kontrolü uygula.',
        parameters:{
          type:'object',
          properties:{action:{type:'string',enum:['volume_up','volume_down','mute','play_pause','next','previous','stop']}},
          required:['action'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'workspace_search',
        description:'JARVIS çalışma alanındaki güvenli metin dosyalarında arama yap. Hassas dosyalar otomatik dışlanır.',
        parameters:{
          type:'object',
          properties:{query:{type:'string'}},
          required:['query'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'workspace_read',
        description:'JARVIS çalışma alanındaki güvenli bir metin dosyasını oku. Önce workspace_search ile doğru yolu bul.',
        parameters:{
          type:'object',
          properties:{path:{type:'string'}},
          required:['path'],
          additionalProperties:false
        }
      }
    }
  ];
}
function safeWorkspaceReadForAgent(relPath){
  try{
    const rel=String(relPath||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
    if(!rel)return{ok:false,message:'Dosya yolu boş.'};
    if(isSensitiveWorkspacePath(rel))return{ok:false,message:'Hassas dosya erişimi engellendi.'};
    const file=safeFile(rel);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return{ok:false,message:'Dosya bulunamadı: '+rel};
    const ext=path.extname(file).toLowerCase();
    const allowed=new Set(['.txt','.md','.json','.js','.ts','.tsx','.jsx','.css','.html','.py','.ps1','.bat','.cmd','.yml','.yaml','.csv','.log']);
    if(!allowed.has(ext))return{ok:false,message:'Bu dosya türü yerel ajan okumasına açık değil: '+ext};
    const size=fs.statSync(file).size;
    if(size>768*1024)return{ok:false,message:'Dosya ajan okuması için çok büyük: '+Math.round(size/1024)+' KB'};
    const data=fs.readFileSync(file,'utf8').replace(/\u0000/g,'').slice(0,7000);
    return{ok:true,message:'DOSYA ['+path.relative(WORKSPACE,file)+']:\n'+data};
  }catch(e){
    return{ok:false,message:'Dosya okuma hatası: '+String(e.message||e).slice(0,180)};
  }
}
function nativeToolSignature(name,args){
  let packed='';
  try{packed=JSON.stringify(args||{})}catch(_){packed=String(args||'')}
  return String(name||'')+'|'+packed;
}
async function executeNativeAgentTool(name,args){
  const n=String(name||'').trim();
  const a=args&&typeof args==='object'?args:{};
  let command='';
  if(n==='system_status')command='sistem durumu';
  else if(n==='disk_status')command='disk durumu';
  else if(n==='network_status')command='ağ durumu';
  else if(n==='power_status')command='pil durumu';
  else if(n==='open_target'){
    const target=String(a.target||'').replace(/[\r\n]/g,' ').trim().slice(0,100);
    command=target?target+' aç':'';
  }else if(n==='media_control'){
    const map={
      volume_up:'sesi yükselt',
      volume_down:'sesi azalt',
      mute:'sessize al',
      play_pause:'oynat',
      next:'sonraki',
      previous:'önceki',
      stop:'medyayı durdur'
    };
    command=map[String(a.action||'')]||'';
  }else if(n==='workspace_search'){
    const query=String(a.query||'').replace(/[\r\n]/g,' ').trim().slice(0,240);
    command=query?'dosyalarda ara '+query:'';
  }else if(n==='workspace_read'){
    return safeWorkspaceReadForAgent(a.path);
  }else{
    return{ok:false,message:'Bilinmeyen yerel araç engellendi: '+n};
  }

  if(!command||!isLocalSafeControlCommand(command)){
    return{ok:false,message:'Güvenli olmayan veya geçersiz yerel araç isteği engellendi.'};
  }
  const result=await execute({command});
  return result||{ok:false,message:'Araç sonucu alınamadı.'};
}
async function runNativeAgent(message,{maxRounds=4}={}){
  const originalText=String(message||'').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!originalText)return{ok:true,type:'chat',reply:'Sizi dinliyorum Cihan Bey.',tone:'balanced',actions:[]};

  const lexiconDirective=handleSpeechLexiconDirective(originalText);
  if(lexiconDirective.handled){
    appendLocalBrainHistory('user',originalText);
    appendLocalBrainHistory('assistant',lexiconDirective.reply);
    return{ok:true,type:'chat',reply:lexiconDirective.reply,tone:lexiconDirective.tone||'warm',actions:[],model:'local-speech-lexicon'};
  }

  const text=applySpeechLexicon(originalText);

  const status=await localBrainStatus();
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};

  const persona=updateBrainPersonaFromUserText(text);
  maybeRememberExplicitPreference(text);
  const turnStyle=inferBrainTurnStyle(text,persona);
  const deepRequested=shouldDeepReflect(text);
  const recent=recentBrainHistory(10);
  const memory=relevantBrainMemory(text,5);
  const memoryText=memory.length
    ? memory.map(x=>'- '+(x.role==='memory'?'Hatırlanan tercih':x.role==='episode'?'Eski sohbet özeti':'Önceki konuşma')+': '+x.text).join('\n')
    : '- İlgili eski kayıt yok.';

  const system=[
    'Sen JARVIS\'sin; Cihan Bey\'in kişisel yerel yapay zeka asistanısın.',
    'Doğal Türkçe konuş; kısa soruya kısa cevap, iş sorusuna net cevap ver. Uygun olduğunda kısa espri yap ama yapmacık olma.',
    'Native tool loop da yerel ses sözlüğünden geçirilmiş kullanıcı metnini esas alır; yanlış duyulan eski ifadeyi geri üretme.',
    'Elindeki yerel araçları yalnızca gerçekten gerektiğinde kullan. Araç kullanmadan cevap verebiliyorsan doğrudan cevap ver.',
    'Bir araç sonucuna göre başka bir araca ihtiyaç varsa sonucu gördükten sonra ikinci aracı çağır. Körlemesine peş peşe araç çağırma.',
    'Araç sonuçlarında olmayan bilgiyi uydurma. Bir eylem başarısızsa başarılı olmuş gibi konuşma.',
    'workspace_read kullanmadan önce mümkünse workspace_search ile doğru dosya yolunu bul.',
    'Gizli dosya, parola, token, anahtar veya credential aramaya çalışma.',
    'Kullanıcı tehlikeli, katalog dışı veya geri döndürülemez bir PC eylemi isterse araç çağırma; bu eylemin bağlı olmadığını kısa söyle.',
    'Cihan Bey hitabını ara sıra kullan; her cevapta tekrarlama.',
    'Bu tur konuşma modu: '+turnStyle.mode+'. '+turnStyle.instruction,
    'İlgili yerel hafıza:\n'+memoryText
  ].join(' ');

  const messages=[
    {role:'system',content:system},
    ...recent.map(x=>({role:x.role,content:x.content})),
    {role:'user',content:text}
  ];
  const tools=nativeAgentTools();
  const actions=[];
  const seenCalls=new Set();
  const started=Date.now();

  for(let round=0;round<Math.max(1,Math.min(6,Number(maxRounds)||4));round++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
    let j;
    try{
      const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          model:LOCAL_BRAIN_MODEL,
          stream:false,
          think:deepRequested,
          keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
          options:{
            temperature:deepRequested?0.32:0.42,
            top_p:0.9,
            repeat_penalty:1.08,
            num_ctx:LOCAL_BRAIN_CTX,
            num_predict:deepRequested?420:260
          },
          messages,
          tools
        }),
        signal:ctl.signal
      });
      clearTimeout(timer);
      j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    }catch(e){
      clearTimeout(timer);
      if(actions.length){
        const summaries=actions.map(x=>(x.ok?'OK ':'FAIL ')+x.tool+': '+x.result).slice(-6);
        appendLocalBrainHistory('user',text);
        const final=await finalizeToolReply(text,summaries,actions.some(x=>!x.ok)?'warm':'focused');
        remember({kind:'native_agent_post_tool_recovery',actions:actions.length,error:String(e.message||e).slice(0,180)});
        return{
          ok:true,type:'chat',
          reply:String(final&&final.reply||summaries.join('. ')),
          tone:String(final&&final.tone||(actions.some(x=>!x.ok)?'warm':'focused')),
          model:LOCAL_BRAIN_MODEL,actions,rounds:round+1,nativeTools:true,reasoning:deepRequested?'deep':'fast',recovered:true,
          latencyMs:Date.now()-started
        };
      }
      return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL,actions};
    }

    const msg=j&&j.message&&typeof j.message==='object'?j.message:{};
    const toolCalls=Array.isArray(msg.tool_calls)?msg.tool_calls.filter(Boolean):[];
    if(!toolCalls.length){
      const reply=normalizeBrainReply(msg.content);
      appendLocalBrainHistory('user',text);
      appendLocalBrainHistory('assistant',reply);
      remember({kind:'native_agent_final',rounds:round+1,actions:actions.length,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started});
      return{
        ok:true,type:'chat',reply,tone:turnStyle.mode,model:LOCAL_BRAIN_MODEL,
        actions,rounds:round+1,nativeTools:true,reasoning:deepRequested?'deep':'fast',latencyMs:Date.now()-started
      };
    }

    messages.push({
      role:'assistant',
      content:String(msg.content||''),
      tool_calls:toolCalls
    });

    for(const tc of toolCalls.slice(0,3)){
      const fn=tc&&tc.function||{};
      const name=String(fn.name||'');
      let args=fn.arguments&&typeof fn.arguments==='object'?fn.arguments:{};
      if(typeof fn.arguments==='string'){
        try{args=JSON.parse(fn.arguments)}catch(_){args={}}
      }
      const signature=nativeToolSignature(name,args);
      let result;
      if(seenCalls.has(signature)){
        result={ok:false,message:'Aynı araç çağrısı tekrarlandı; döngüyü önlemek için engellendi.'};
      }else{
        seenCalls.add(signature);
        result=await executeNativeAgentTool(name,args);
      }
      const content=String(result&&result.message||'Araç sonucu yok.').slice(0,7000);
      actions.push({tool:name,args,ok:!!(result&&result.ok),result:content.slice(0,900)});
      messages.push({role:'tool',content,tool_name:name});
    }
  }

  const summaries=actions.map(x=>(x.ok?'OK ':'FAIL ')+x.tool+': '+x.result).slice(-6);
  appendLocalBrainHistory('user',text);
  const final=await finalizeToolReply(text,summaries,actions.some(x=>!x.ok)?'warm':'focused');
  remember({kind:'native_agent_bounded_stop',actions:actions.length,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started});
  return{
    ok:true,type:'chat',
    reply:String(final&&final.reply||summaries.join('. ')||'Araç döngüsü güvenli sınırda durduruldu.'),
    tone:String(final&&final.tone||(actions.some(x=>!x.ok)?'warm':'focused')),
    model:LOCAL_BRAIN_MODEL,actions,rounds:maxRounds,nativeTools:true,reasoning:deepRequested?'deep':'fast',bounded:true,
    latencyMs:Date.now()-started
  };
}
function shouldReflectToolResult(command,message,resultCount=1){
  const c=String(command||'').toLocaleLowerCase('tr-TR');
  const m=String(message||'');
  return resultCount>1
    || /(?:durumu|status|dosyalarda ara|workspace search|işlemleri listele|islemleri listele|process list|yerel ai)/i.test(c)
    || m.length>150;
}
async function finalizeToolReply(userMessage,toolResults,toneHint='focused'){
  const userText=String(userMessage||'').replace(/\s+/g,' ').trim().slice(0,1800);
  const results=(Array.isArray(toolResults)?toolResults:[toolResults])
    .map(x=>String(x||'').replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .slice(0,4);
  if(!results.length)return{ok:false,error:'NO_TOOL_RESULTS'};

  const rawReply=results.join('. ').replace(/\s+/g,' ').trim().slice(0,900);
  const commandHint=userText;
  if(!shouldReflectToolResult(commandHint,rawReply,results.length)){
    appendLocalBrainHistory('assistant',rawReply);
    remember({kind:'tool_result_final',reflected:false,results:results.length,tone:toneHint});
    return{ok:true,reply:rawReply,tone:toneHint,model:'deterministic-tool-finalizer',latencyMs:0,reflected:false};
  }

  const status=await localBrainStatus();
  if(!status.ready||!status.installed){
    appendLocalBrainHistory('assistant',rawReply);
    return{ok:true,reply:rawReply,tone:toneHint,model:'tool-fallback',latencyMs:0,reflected:false};
  }

  const recent=recentBrainHistory(8);
  const allowedTones=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'];
  const schema={
    type:'object',
    properties:{
      reply:{type:'string'},
      tone:{type:'string',enum:allowedTones}
    },
    required:['reply','tone'],
    additionalProperties:false
  };
  const system=[
    'Sen JARVIS\'sin. Bir araç veya bilgisayar eylemi az önce gerçekten çalıştırıldı ve aşağıda doğrulanmış sonuçları var.',
    'Kullanıcıya yalnızca bu gerçek sonuçlara dayanarak doğal Türkçe ile, insan gibi ve kısa biçimde cevap ver.',
    'Sonuçlarda olmayan bilgi, sayı veya başarı uydurma.',
    'Ham teknik metni sesli konuşmaya uygun hale getir.',
    'Durum, arama veya çok adımlı sonuçlarda önemli noktaları seç; ekrandaki her satırı okumaya çalışma.',
    'Uygunsa tek kısa espri kullanabilirsin; sonucu gölgelememeli.',
    'Cihan Bey hitabını ara sıra kullan, her turda kullanma.',
    'SADECE JSON şemasına uy.'
  ].join(' ');
  const toolBlock=results.map((x,i)=>'SONUÇ '+(i+1)+': '+x).join('\n');
  const body={
    model:LOCAL_BRAIN_MODEL,
    stream:false,
    think:false,
    format:schema,
    keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
    options:{temperature:0.42,top_p:0.88,repeat_penalty:1.08,num_ctx:3072,num_predict:170},
    messages:[
      {role:'system',content:system},
      ...recent.map(x=>({role:x.role,content:x.content})),
      {role:'user',content:'İstek: '+userText+'\n'+toolBlock}
    ]
  };

  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
  const started=Date.now();
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.reply)throw new Error('TOOL_REFLECTION_BAD_JSON');
    const reply=normalizeBrainReply(parsed.reply);
    const tone=allowedTones.includes(String(parsed.tone||''))?String(parsed.tone):toneHint;
    appendLocalBrainHistory('assistant',reply);
    remember({kind:'tool_result_final',reflected:true,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,results:results.length,tone});
    return{ok:true,reply,tone,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,reflected:true};
  }catch(e){
    clearTimeout(timer);
    appendLocalBrainHistory('assistant',rawReply);
    remember({kind:'tool_result_final',reflected:false,error:String(e.message||e).slice(0,180),results:results.length,tone:toneHint});
    return{ok:true,reply:rawReply,tone:toneHint,model:'tool-fallback',latencyMs:Date.now()-started,reflected:false};
  }
}
function startLocalTtsBridge(){
  if(!TTS_ENABLED&&!FORCE_LOCAL_BRIDGE&&!TEST_MODE)return;
  const port=Number(process.env.JARVIS_TTS_PORT||8765);
  let allowedOrigin='';
  try{allowedOrigin=new URL(BASE).origin}catch(e){}
  const server=http.createServer((req,res)=>{
    const origin=String(req.headers.origin||'');
    const allowed=!origin||origin===allowedOrigin||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if(!allowed){res.writeHead(403);return res.end('forbidden')}
    res.setHeader('Access-Control-Allow-Origin',origin||allowedOrigin||'*');
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','content-type');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(req.method==='GET'&&req.url==='/speech-lexicon'){
      const x=readSpeechLexicon();
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,
        aliases:x.aliases,
        hotwords:x.hotwords,
        count:Object.keys(x.aliases||{}).length,
        updatedAt:x.updatedAt
      }));
    }
    if(req.method==='POST'&&req.url==='/speech-lexicon'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=d.action==='forget'
            ?forgetSpeechAlias(d.heard)
            :learnSpeechAlias(d.heard,d.intended,d.source||'local-ui');
          res.writeHead(result.ok?200:422,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='GET'&&req.url==='/health'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,voice:TTS_VOICE,version:WORKER_VERSION,
        capabilities:CAPS,
        localBrain:{model:LOCAL_BRAIN_MODEL,url:LOCAL_BRAIN_URL,personaVersion:2,memory:'semantic-local-v2',vision:isLocalVisionModel()},
        localStt:{port:LOCAL_STT_PORT,model:LOCAL_STT_MODEL,engine:'faster-whisper',adaptiveLexicon:true,lexiconCount:Object.keys(readSpeechLexicon().aliases||{}).length},
        adaptiveTts:{voice:TTS_VOICE,engine:'edge-neural',interruptible:true,offlineFallback:'windows-sapi',profiles:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']},
        brainRuntime:{warm:brainWarmState,keepAlive:LOCAL_BRAIN_KEEP_ALIVE,context:LOCAL_BRAIN_CTX,toolReflection:true,multimodal:isLocalVisionModel(),nativeTools:true,maxToolRounds:4,selectiveReasoning:true},
        mobileRelay:{brain:true,tts:true,pollMs:650}
      }));
    }
    if(req.method==='GET'&&req.url==='/tts-state'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,
        active:ttsSpeaking||ttsPendingCount>0,
        speaking:ttsSpeaking,
        pending:ttsPendingCount,
        startedAt:ttsLastStartedAt||null,
        endedAt:ttsLastEndedAt||null,
        generation:ttsGeneration,
        interruptible:true
      }));
    }
    if(req.method==='POST'&&req.url==='/tts-stop'){
      const stopped=stopJarvisSpeech('local-api');
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify(stopped));
    }
    if(req.method==='POST'&&req.url==='/brain-warm'){
      warmLocalBrain().then(state=>{
        const ok=state.status==='ready';
        res.writeHead(ok?200:503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok,...state}));
      }).catch(e=>{
        res.writeHead(503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:false,status:'error',error:String(e.message||e)}));
      });
      return;
    }
    if(req.method==='GET'&&req.url==='/brain-status'){
      localBrainStatus().then(status=>{
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:true,...status,warm:brainWarmState,keepAlive:LOCAL_BRAIN_KEEP_ALIVE,context:LOCAL_BRAIN_CTX,nativeTools:true,maxToolRounds:4,selectiveReasoning:true,persona:brainPersona(),memoryFacts:readBrainFacts().length,memoryEpisodes:readBrainEpisodes().length}));
      }).catch(e=>{
        res.writeHead(503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/wake'){
      const now=Date.now();
      if((now-lastLocalWakeAt)<12000){
        res.writeHead(202,{'content-type':'application/json'});
        return res.end(JSON.stringify({ok:true,suppressed:true,wake:localWakeCounter}));
      }
      lastLocalWakeAt=now;
      localWakeCounter++;
      showJarvisScreen();
      res.writeHead(202,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,wake:localWakeCounter}));
    }
    if(req.method==='GET'&&req.url.startsWith('/wake-state')){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,wake:localWakeCounter}));
    }
    if(req.method==='POST'&&req.url==='/vision'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>4500000){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'image too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await analyzeLocalImage(d.image,d.question);
          res.writeHead(result.ok?200:(result.error==='VISION_MODEL_REQUIRED'?409:503),{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/agent'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await runNativeAgent(d.message,{maxRounds:d.maxRounds||4});
          res.writeHead(result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/brain'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await callLocalBrain(d.message);
          res.writeHead(result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/brain-finalize'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await finalizeToolReply(d.message,d.results,d.tone||'focused');
          res.writeHead(result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/control'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const command=String(d.command||'').trim();
          if(!command||!isLocalSafeControlCommand(command)){
            res.writeHead(403,{'content-type':'application/json'});
            return res.end(JSON.stringify({ok:false,error:'command not allowed on local safe bridge'}));
          }
          const result=await execute({command});
          res.writeHead(result&&result.ok?200:422,{'content-type':'application/json'});
          return res.end(JSON.stringify(result||{ok:false,message:'no result'}));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/creator-render'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413);return res.end('too large')}
        try{
          const d=JSON.parse(body||'{}');
          const text=String(d.text||'').trim();
          if(!text){res.writeHead(400);return res.end('text required')}
          const out=await renderCreatorVoiceFile(text,d.name||'creator-voice');
          res.writeHead(200,{'content-type':'application/json'});
          return res.end(JSON.stringify({
            ok:true,
            profile:'CINEMATIC_CREATOR',
            voice:CREATOR_TTS_VOICE,
            rate:CREATOR_TTS_RATE,
            pitch:CREATOR_TTS_PITCH,
            volume:CREATOR_TTS_VOLUME,
            path:out
          }));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/speak'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',()=>{
        if(tooLarge){res.writeHead(413);return res.end('too large')}
        try{
          const d=JSON.parse(body||'{}'),text=String(d.text||'').trim();
          if(!text){res.writeHead(400);return res.end('text required')}
          const tone=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'].includes(String(d.tone||''))?String(d.tone):'balanced';
          queueJarvisSpeech(text,tone);
          res.writeHead(202,{'content-type':'application/json'});
          return res.end(JSON.stringify({
            ok:true,queued:true,tone,
            profile:ttsProfileForTone(tone,text),
            spokenText:prepareJarvisSpeechText(text,tone)
          }));
        }catch(e){res.writeHead(400);return res.end('bad request')}
      });
      return;
    }
    res.writeHead(404);res.end('not found');
  });
  server.on('error',e=>console.error('[JARVIS] LOCAL TTS BRIDGE:',e.message));
  server.listen(port,'127.0.0.1',()=>console.log('[JARVIS] LOCAL TTS BRIDGE READY: http://127.0.0.1:'+port));
}

if(!TOKEN&&!DEVICE_TOKEN&&!PAIR_CODE){console.error('JARVIS signed cihaz kimliği veya pairing code gerekli.');process.exit(1)}
function ensureWindowsHelper(filename){
  const helper=path.join(__dirname,filename);
  if(fs.existsSync(helper))return helper;
  const url='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'+encodeURIComponent(filename);
  try{
    const safeUrl=url.replace(/'/g,"''"),safePath=helper.replace(/'/g,"''");
    const ps="$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '"+safeUrl+"' -OutFile '"+safePath+"' -TimeoutSec 20";
    childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:256*1024});
    if(fs.existsSync(helper)){console.log('[JARVIS] HELPER SYNCED: '+filename);return helper}
  }catch(e){console.error('[JARVIS] HELPER SYNC FAILED: '+filename+' · '+e.message)}
  return null;
}
function cleanupOrphanedJarvisHelpers(){
  if(process.platform!=='win32')return;
  // Keep this PowerShell as one syntactically complete pipeline. The previous
  // version inserted semicolons inside Where-Object and caused ParserError.
  const ps="Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match 'jarvis-double-clap-v\\d+\\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  try{
    childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{windowsHide:true,timeout:8000,maxBuffer:128*1024});
    console.log('[JARVIS] ORPHAN CLAP CLEANUP: OK');
  }catch(e){
    console.error('[JARVIS] ORPHAN CLAP CLEANUP:',e.message);
  }
}

function startWindowsWakeHelper(){
  if(process.platform!=='win32')return;
  const helper=ensureWindowsHelper('jarvis-wake-hotkey.ps1');
  if(!helper){console.error('[JARVIS] F8 WAKE: helper hazirlanamadi');return}
  try{
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',helper],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] F8 WAKE ERROR: '+String(d)));
    p.on('exit',code=>{if(code!==0)console.error('[JARVIS] F8 WAKE helper kapandi. code='+code)});
    p.on('error',e=>console.error('[JARVIS] F8 WAKE baslatilamadi:',e.message));
  }catch(e){console.error('[JARVIS] F8 WAKE baslatma hatasi:',e.message)}
}

function startWindowsClapHelper(){
  if(process.platform!=='win32')return;
  const helper=ensureWindowsHelper('jarvis-double-clap-v9.py');
  if(!helper){console.error('[JARVIS] DOUBLE CLAP: helper hazirlanamadi');return}
  try{
    const p=childProcess.spawn('py',[helper],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] DOUBLE CLAP ERROR: '+String(d)));
    p.on('exit',code=>{if(code!==0)console.error('[JARVIS] DOUBLE CLAP helper kapandi. code='+code)});
    p.on('error',e=>console.error('[JARVIS] DOUBLE CLAP baslatilamadi:',e.message));
  }catch(e){console.error('[JARVIS] DOUBLE CLAP baslatma hatasi:',e.message)}
}
function startWindowsLocalSttHelper(){
  if(process.platform!=='win32'||TEST_MODE)return;
  const helper=ensureWindowsHelper('jarvis-local-stt-v3.py');
  if(!helper){console.error('[JARVIS] LOCAL STT: helper hazırlanamadı');return}
  try{
    const env={
      ...process.env,
      JARVIS_STT_PORT:String(LOCAL_STT_PORT),
      JARVIS_STT_MODEL:LOCAL_STT_MODEL,
      JARVIS_WEB_ORIGIN:new URL(BASE).origin,
      JARVIS_SPEECH_LEXICON_FILE:SPEECH_LEXICON_FILE
    };
    const p=childProcess.spawn('py',[helper],{windowsHide:true,stdio:['ignore','pipe','pipe'],env});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] LOCAL STT ERROR: '+String(d)));
    p.on('exit',code=>{
      if(code===2)console.error('[JARVIS] LOCAL STT dependency eksik; browser speech fallback aktif.');
      else if(code!==0)console.error('[JARVIS] LOCAL STT helper kapandı. code='+code);
    });
    p.on('error',e=>console.error('[JARVIS] LOCAL STT başlatılamadı:',e.message));
  }catch(e){console.error('[JARVIS] LOCAL STT başlatma hatası:',e.message)}
}

fs.mkdirSync(WORKSPACE,{recursive:true});
fs.mkdirSync(MEMORY_DIR,{recursive:true});
fs.mkdirSync(CHECKPOINT_DIR,{recursive:true});
fs.mkdirSync(JOURNAL_DIR,{recursive:true});
function remember(record){
  const safe={at:new Date().toISOString(),...record};
  fs.appendFileSync(MEMORY_FILE,JSON.stringify(safe)+'\n','utf8');
}
function strategyMetrics(){
  if(!fs.existsSync(MEMORY_FILE))return{steps:0,repairs:0,successes:0,failures:0,byAction:{}};
  const lines=fs.readFileSync(MEMORY_FILE,'utf8').split('\n').filter(Boolean).slice(-2000);
  const out={steps:0,repairs:0,successes:0,failures:0,byAction:{}};
  for(const line of lines){
    let x;try{x=JSON.parse(line)}catch(e){continue}
    if(x.kind==='repair'){out.repairs++;continue}
    if(x.kind!=='plan_step')continue;
    out.steps++;
    if(x.ok)out.successes++;else out.failures++;
    const a=String(x.action||'unknown');
    if(!out.byAction[a])out.byAction[a]={attempts:0,successes:0,failures:0};
    out.byAction[a].attempts++;
    if(x.ok)out.byAction[a].successes++;else out.byAction[a].failures++;
  }
  return out;
}
function strategySelection(){
  const m=strategyMetrics();
  const MIN_EVIDENCE=5;
  const eligible=[];
  for(const [action,v] of Object.entries(m.byAction)){
    if(v.attempts<MIN_EVIDENCE)continue;
    const successRate=v.successes/v.attempts;
    const failureRate=v.failures/v.attempts;
    const score=Math.max(0,successRate-(failureRate*0.5));
    eligible.push({action,attempts:v.attempts,successRate:Number(successRate.toFixed(3)),score:Number(score.toFixed(3))});
  }
  eligible.sort((a,b)=>b.score-a.score||b.attempts-a.attempts||a.action.localeCompare(b.action));
  return{minimumEvidence:MIN_EVIDENCE,repairEvents:m.repairs,candidates:eligible,recommended:eligible[0]||null};
}
function readStrategyPolicy(){
  try{return JSON.parse(fs.readFileSync(STRATEGY_FILE,'utf8'))}catch(e){return{version:1,active:null,previous:null,baseline:null,updatedAt:null}}
}
function writeStrategyPolicy(p){
  const tmp=STRATEGY_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(p,null,2),'utf8');fs.renameSync(tmp,STRATEGY_FILE);
}
function evaluateStrategyPolicy(){
  const selection=strategySelection(),policy=readStrategyPolicy(),candidate=selection.recommended;
  if(!candidate)return{changed:false,rolledBack:false,policy,reason:'Yeterli kanıt yok'};
  const MIN_IMPROVEMENT=0.05,ROLLBACK_DROP=0.10;
  if(policy.active&&policy.baseline&&policy.active.action===candidate.action){
    const drop=Number(policy.baseline.score||0)-candidate.score;
    if(drop>=ROLLBACK_DROP&&policy.previous){
      const next={...policy,active:policy.previous,previous:policy.active,baseline:policy.previous,updatedAt:new Date().toISOString(),lastDecision:'rollback'};
      writeStrategyPolicy(next);remember({kind:'strategy_rollback',from:policy.active,to:policy.previous,drop});
      return{changed:true,rolledBack:true,policy:next,reason:'Performans düşüşü '+drop.toFixed(3)};
    }
    return{changed:false,rolledBack:false,policy,reason:'Etkin strateji korunuyor'};
  }
  const activeScore=policy.baseline?Number(policy.baseline.score||0):0;
  if(!policy.active||candidate.score>=activeScore+MIN_IMPROVEMENT){
    const next={version:Number(policy.version||1)+1,active:candidate,previous:policy.active||null,baseline:candidate,updatedAt:new Date().toISOString(),lastDecision:'promote'};
    writeStrategyPolicy(next);remember({kind:'strategy_promote',from:policy.active||null,to:candidate});
    return{changed:true,rolledBack:false,policy:next,reason:'Kanıt eşiğini geçen strateji etkinleştirildi'};
  }
  return{changed:false,rolledBack:false,policy,reason:'Aday mevcut politikayı yeterince aşmadı'};
}
function memoryStats(){
  if(!fs.existsSync(MEMORY_FILE))return{records:0,bytes:0,lastAt:null};
  const raw=fs.readFileSync(MEMORY_FILE,'utf8');
  const lines=raw.split('\n').filter(Boolean);
  let lastAt=null;
  if(lines.length){try{lastAt=JSON.parse(lines[lines.length-1]).at||null}catch(e){}}
  return{records:lines.length,bytes:Buffer.byteLength(raw),lastAt};
}

async function api(route,options={}){
  const auth=DEVICE_TOKEN?'Device '+DEVICE_TOKEN:'Bearer '+TOKEN;
  options.headers={...(options.headers||{}),authorization:auth,'x-jarvis-device-id':DEVICE_ID};
  const r=await fetch(BASE+route,options);
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
function deviceTokenExp(token){
  try{const body=String(token||'').split('.')[0];return Number(JSON.parse(Buffer.from(body,'base64url').toString('utf8')).exp)||0}catch(e){return 0}
}
async function saveDeviceToken(token,kind){
  const tmp=DEVICE_TOKEN_FILE+'.tmp';fs.writeFileSync(tmp,token,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,DEVICE_TOKEN_FILE);DEVICE_TOKEN=token;
  remember({kind,deviceId:DEVICE_ID});
}
async function pairDevice(){
  if(DEVICE_TOKEN||!PAIR_CODE)return false;
  try{
    const r=await fetch(BASE+'/api/pairing/exchange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:PAIR_CODE,deviceId:DEVICE_ID,name:NAME,version:WORKER_VERSION,capabilities:CAPS})});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j.token)throw new Error(j.error||('HTTP '+r.status));
    await saveDeviceToken(j.token,'device_paired');return true;
  }catch(e){console.error('[JARVIS] Pairing:',e.message);return false}
}
async function migrateDeviceCredential(){
  const exp=deviceTokenExp(DEVICE_TOKEN),nowMs=Date.now();
  if(DEVICE_TOKEN&&exp>nowMs+24*60*60*1000)return false;
  if(!DEVICE_TOKEN&&!TOKEN)return false;
  const auths=[];
  if(DEVICE_TOKEN&&exp>nowMs)auths.push('Device '+DEVICE_TOKEN);
  if(TOKEN)auths.push('Bearer '+TOKEN);
  for(const auth of auths.slice(0,2)){
    try{
      const r=await fetch(BASE+'/api/worker/device-token',{method:'POST',headers:{authorization:auth,'x-jarvis-device-id':DEVICE_ID,'content-type':'application/json'},body:JSON.stringify({deviceId:DEVICE_ID})});
      const j=await r.json().catch(()=>({}));if(!r.ok||!j.token)continue;
      await saveDeviceToken(j.token,'device_credential_migrated');return true;
    }catch(e){}
  }
  return false;
}
function listFiles(){
  return fs.readdirSync(WORKSPACE,{withFileTypes:true}).slice(0,100).map(e=>e.name+(e.isDirectory()?'/':''));
}
function safeFile(name){
  const clean=String(name||'').trim().replace(/^[\\/]+/,'');
  if(!clean||clean.includes('..'))throw new Error('Geçersiz dosya yolu');
  const target=path.resolve(WORKSPACE,clean);
  if(!(target===WORKSPACE||target.startsWith(WORKSPACE+path.sep)))throw new Error('Workspace dışına erişim engellendi');
  return target;
}
function verifyPath(rel,type){
  const target=safeFile(rel);
  if(!fs.existsSync(target))return false;
  if(type==='dir')return fs.statSync(target).isDirectory();
  if(type==='file')return fs.statSync(target).isFile();
  return true;
}
function fileHash(file){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function journalFile(task){
  const key=String(task.uid||('legacy-'+task.id)).replace(/[^A-Za-z0-9_.-]/g,'_');
  return path.join(JOURNAL_DIR,key+'.json');
}
function freshJournal(task){return{version:3,task:{uid:task.uid,command:task.command,plan:task.plan,createdAt:task.createdAt},entries:[]}}
function readJournal(task){
  const f=journalFile(task);
  try{return JSON.parse(fs.readFileSync(f,'utf8'))}
  catch(e){
    if(e&&e.code==='ENOENT')return freshJournal(task);
    throw new Error('Transaction journal okunamadı/bozuk; otomatik işlem durduruldu: '+path.basename(f));
  }
}
function writeJournal(task,j){
  const f=journalFile(task),tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(j),'utf8');fs.renameSync(tmp,f);
}
function journalBefore(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target);
  if(j.version!==3)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(j.entries.some(x=>x.path===rel))return;
  if(j.entries.length>=32)throw new Error('Transaction journal 32 öğe sınırını aştı');
  const backupBytes=j.entries.reduce((n,e)=>n+(e.type==='file'&&e.existed&&e.data?Buffer.from(e.data,'base64').length:0),0);
  if(type==='file'){
    if(fs.existsSync(target)){
      const st=fs.statSync(target);if(!st.isFile())throw new Error('Rollback hedefi dosya değil: '+rel);
      if(st.size>512*1024)throw new Error('Rollback limiti: mevcut dosya 512KB üzerinde: '+rel);
      if(backupBytes+st.size>2*1024*1024)throw new Error('Transaction toplam rollback bütçesi 2MB sınırını aştı');
      j.entries.push({path:rel,type:'file',state:'prepared',existed:true,beforeHash:fileHash(target),expectedAfterHash:null,data:fs.readFileSync(target).toString('base64')});
    }else j.entries.push({path:rel,type:'file',state:'prepared',existed:false,beforeHash:null,expectedAfterHash:null});
  }else if(type==='dir')j.entries.push({path:rel,type:'dir',state:'prepared',existed:fs.existsSync(target),expectedAfterExists:null});
  writeJournal(task,j);
}
function journalAfter(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target),e=j.entries.find(x=>x.path===rel);
  if(j.version!==3)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(!e)throw new Error('Transaction journal girdisi bulunamadı: '+rel);
  if(type==='file')e.expectedAfterHash=fileHash(target);else e.expectedAfterExists=fs.existsSync(target);
  e.state='applied';writeJournal(task,j);
}
function journalConsistency(task){
  const j=readJournal(task),conflicts=[];
  if(j.version!==3)return{ok:false,conflicts:[{path:'journal',expected:'v3',current:String(j.version)}]};
  for(const e of j.entries){
    const target=safeFile(e.path);
    if(e.type==='file'){
      const current=fileHash(target);
      if(e.state==='applied'&&current!==e.expectedAfterHash)conflicts.push({path:e.path,expected:e.expectedAfterHash,current});
      if(e.state==='prepared'){
        const unchanged=e.existed?current===e.beforeHash:current===null;
        if(!unchanged)conflicts.push({path:e.path,expected:'prepared preimage',current});
      }
    }else if(e.type==='dir'){
      const current=fs.existsSync(target);
      if(e.state==='applied'&&current!==e.expectedAfterExists)conflicts.push({path:e.path,expected:e.expectedAfterExists,current});
      if(e.state==='prepared'&&current!==!!e.existed)conflicts.push({path:e.path,expected:!!e.existed,current});
    }
  }
  return{ok:conflicts.length===0,conflicts};
}
function rollbackJournal(task){
  const consistency=journalConsistency(task);
  if(!consistency.ok){remember({kind:'transaction_conflict',taskUid:task.uid||null,conflicts:consistency.conflicts});return consistency.conflicts.map(x=>({path:x.path,ok:false,error:'external or ambiguous change detected'}))}
  const j=readJournal(task),out=[];
  for(const e of [...j.entries].reverse()){
    const target=safeFile(e.path);
    try{
      if(e.state==='prepared'){out.push({path:e.path,ok:true,skipped:true});continue}
      if(e.type==='file'){
        if(e.existed){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(e.data||'','base64'))}
        else if(fs.existsSync(target)&&fs.statSync(target).isFile())fs.unlinkSync(target);
      }else if(e.type==='dir'&&!e.existed&&fs.existsSync(target))fs.rmdirSync(target);
      out.push({path:e.path,ok:true});
    }catch(err){out.push({path:e.path,ok:false,error:err.message})}
  }
  remember({kind:'transaction_rollback',taskUid:task.uid||null,entries:out});return out;
}
function clearJournal(task){try{fs.unlinkSync(journalFile(task))}catch(e){}}
function planHash(plan){return crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex')}
function verifyCompletedStep(step){
  if(!step||!step.action)return false;
  if(step.action==='make_folder'||step.action==='verify_folder')return verifyPath(step.path,'dir');
  if(step.action==='write_file'){
    const file=safeFile(step.path);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;
    return fileHash(file)===crypto.createHash('sha256').update(String(step.content||''),'utf8').digest('hex');
  }
  if(step.action==='verify_file')return verifyPath(step.path,'file');
  return false;
}
function verifyPlanPrefix(plan,count){
  const failures=[];
  for(let i=0;i<count;i++)if(!verifyCompletedStep(plan.steps[i]))failures.push(i+1);
  return{ok:failures.length===0,failures};
}
function checkpointFile(task){
  const key=String(task.uid||('legacy-'+task.id)).replace(/[^A-Za-z0-9_.-]/g,'_');
  return path.join(CHECKPOINT_DIR,key+'.json');
}
function readCheckpoint(task){
  const f=checkpointFile(task);
  if(!fs.existsSync(f))return{nextStep:0,planVersion:null};
  try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return{nextStep:0,planVersion:null}}
}
function saveCheckpoint(task,data){
  const f=checkpointFile(task),tmp=f+'.tmp';
  const envelope={at:new Date().toISOString(),task:{uid:task.uid,id:task.id,command:task.command,createdAt:task.createdAt,plan:task.plan},...data};
  fs.writeFileSync(tmp,JSON.stringify(envelope),'utf8');
  fs.renameSync(tmp,f);
}
function clearCheckpoint(task){try{fs.unlinkSync(checkpointFile(task))}catch(e){}}
async function runPlan(task){
  const plan=task.plan;
  if(!plan||!Array.isArray(plan.steps)||plan.steps.length<1||plan.steps.length>8)throw new Error('Plan 1-8 adım içermeli');
  const results=[];
  const MAX_STEP_ATTEMPTS=2;
  const cp=readCheckpoint(task),expectedPlanHash=planHash(plan);
  let startAt=(cp.planVersion===plan.version&&cp.planHash===expectedPlanHash&&Number.isInteger(cp.nextStep))?Math.max(0,Math.min(cp.nextStep,plan.steps.length)):0;
  if(cp.nextStep>0&&cp.planHash!==expectedPlanHash)throw new Error('Checkpoint plan hash uyuşmazlığı; otomatik resume reddedildi');
  if(startAt>0){
    const prefix=verifyPlanPrefix(plan,startAt);
    if(!prefix.ok)throw new Error('Checkpoint prefix yeniden doğrulanamadı; adımlar: '+prefix.failures.join(','));
    remember({kind:'resume_revalidated',taskUid:task.uid||null,nextStep:startAt+1,totalSteps:plan.steps.length,planHash:expectedPlanHash});
  }
  for(let i=startAt;i<plan.steps.length;i++){
    const step=plan.steps[i]||{};
    let result=null,lastError=null;
    for(let attempt=1;attempt<=MAX_STEP_ATTEMPTS;attempt++){
      try{
        if(step.action==='make_folder'){
          const dir=safeFile(step.path); journalBefore(task,dir,'dir'); fs.mkdirSync(dir,{recursive:true}); journalAfter(task,dir,'dir');
          result={ok:verifyPath(step.path,'dir'),message:'Klasör: '+step.path};
        }else if(step.action==='write_file'){
          const file=safeFile(step.path),parent=path.dirname(file);
          if(!fs.existsSync(parent))journalBefore(task,parent,'dir');
          journalBefore(task,file,'file'); fs.mkdirSync(parent,{recursive:true});
          if(readJournal(task).entries.some(e=>e.path===path.relative(WORKSPACE,parent)&&e.type==='dir'))journalAfter(task,parent,'dir');
          fs.writeFileSync(file,String(step.content||''),'utf8'); journalAfter(task,file,'file');
          result={ok:verifyPath(step.path,'file'),message:'Dosya: '+step.path};
        }else if(step.action==='verify_file'){
          result={ok:verifyPath(step.path,'file'),message:'Dosya doğrulama: '+step.path};
        }else if(step.action==='verify_folder'){
          result={ok:verifyPath(step.path,'dir'),message:'Klasör doğrulama: '+step.path};
        }else throw new Error('İzin verilmeyen plan aksiyonu: '+String(step.action||''));
        remember({kind:'plan_step',taskUid:task.uid||null,action:step.action,path:step.path||null,step:i+1,attempt,ok:!!result.ok});
        if(result.ok){
          results.push({step:i+1,action:step.action,attempts:attempt,...result});
          saveCheckpoint(task,{planVersion:plan.version,planHash:planHash(plan),nextStep:i+1,totalSteps:plan.steps.length});
          break;
        }
        lastError=new Error('Doğrulama başarısız: '+result.message);
      }catch(e){
        lastError=e;
        remember({kind:'plan_step',taskUid:task.uid||null,action:step.action,path:step.path||null,step:i+1,attempt,ok:false,error:e.message});
      }
      if(attempt<MAX_STEP_ATTEMPTS)remember({kind:'repair',taskUid:task.uid||null,step:i+1,action:step.action,reason:lastError&&lastError.message});
    }
    if(!result||!result.ok){
      const rollback=rollbackJournal(task);
      const failedRollback=rollback.filter(x=>!x.ok);
      if(!failedRollback.length){clearJournal(task);clearCheckpoint(task)}
      throw new Error('Adım '+(i+1)+' iki denemede doğrulanamadı: '+(lastError?lastError.message:'bilinmeyen hata')+' · rollback '+(failedRollback.length?'KISMİ':'OK'));
    }
  }
  clearCheckpoint(task);clearJournal(task);
  return{ok:true,message:'Plan doğrulandı · '+plan.steps.length+' adım · kesintiden devam koruması aktif',steps:results,resumedFrom:startAt};
}
function createBundle(name,description){
  const dir=safeFile(name);
  const existed=fs.existsSync(dir);
  fs.mkdirSync(dir,{recursive:true});
  const created=[];
  try{
    const files={
      'README.md':'# '+path.basename(dir)+'\n\n'+description+'\n',
      'TASKS.md':'# Tasks\n\n- [ ] İlk hedefi tanımla\n- [ ] Uygulamayı geliştir\n- [ ] Doğrulama testlerini çalıştır\n',
      '.gitignore':'node_modules/\n.env\n.env.*\n.DS_Store\n'
    };
    for(const [rel,data] of Object.entries(files)){
      const target=path.join(dir,rel);
      if(!fs.existsSync(target)){fs.writeFileSync(target,data,'utf8');created.push(target)}
    }
    for(const rel of Object.keys(files)){
      const target=path.join(dir,rel);
      if(!fs.existsSync(target)||!fs.statSync(target).isFile())throw new Error('Doğrulama başarısız: '+rel);
    }
    return{ok:true,message:'Proje paketi doğrulandı: '+path.relative(WORKSPACE,dir)+' · '+Object.keys(files).join(', ')};
  }catch(e){
    for(const file of created.reverse()){try{fs.unlinkSync(file)}catch(_){}}
    if(!existed){try{fs.rmdirSync(dir)}catch(_){}}
    throw e;
  }
}
function startDetached(exe,args=[]){
  const p=childProcess.spawn(exe,args,{detached:true,windowsHide:false,stdio:'ignore'});
  p.unref();
}
function openDefaultUrl(url){
  childProcess.spawn('cmd.exe',['/c','start','','"'+url+'"'],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
}
function firstExisting(paths){
  for(const p of paths)try{if(p&&fs.existsSync(p))return p}catch(_){}
  return null;
}
function sendWindowsMediaKey(vk,presses=1){
  if(process.platform!=='win32')throw new Error('Windows media control only');
  const count=Math.max(1,Math.min(12,Number(presses)||1));
  const ps=[
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; namespace Jarvis { public static class Keys { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); } }' -ErrorAction SilentlyContinue",
    "$vk="+Number(vk),
    "1.."+count+" | ForEach-Object { [Jarvis.Keys]::keybd_event([byte]$vk,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 35; [Jarvis.Keys]::keybd_event([byte]$vk,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 45 }"
  ].join('; ');
  childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536});
}
function windowsPowerStatus(){
  if(process.platform!=='win32')return{ok:false,message:'Güç durumu şu anda Windows için etkin'};
  let battery=null;
  try{
    const ps="Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress";
    const raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536}).trim();
    if(raw)battery=JSON.parse(raw);
  }catch(_){}
  const free=Math.round(os.freemem()/1073741824*10)/10;
  const total=Math.round(os.totalmem()/1073741824*10)/10;
  const uptimeMin=Math.round(os.uptime()/60);
  const cpu=os.cpus()&&os.cpus()[0]?String(os.cpus()[0].model||'CPU').replace(/\s+/g,' ').trim():'CPU';
  const parts=['RAM '+free+' / '+total+' GB boş','çalışma süresi '+uptimeMin+' dakika',cpu];
  if(battery&&Number.isFinite(Number(battery.EstimatedChargeRemaining)))parts.unshift('pil %'+Number(battery.EstimatedChargeRemaining));
  else parts.unshift('pil bilgisi alınamadı');
  return{ok:true,message:'PC güç durumu · '+parts.join(' · ')};
}
function isSensitiveWorkspacePath(rel){
  const s=String(rel||'').replace(/\\/g,'/').toLocaleLowerCase('tr-TR');
  const base=path.basename(s);
  if(s.includes('/.git/')||s.includes('/node_modules/')||s.includes('/.jarvis-memory/'))return true;
  if(/(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|private[-_]?key(?:\..*)?|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$/i.test(s))return true;
  if(/(?:token|password|passwd|apikey|api_key|secret)[-_]?(?:backup|dump|export)?\.(?:txt|json|log|csv)$/i.test(base))return true;
  return false;
}
function workspaceSearchHits(query,{limit=5,maxScanned=220,maxDepth=5}={}){
  const raw=String(query||'').replace(/\s+/g,' ').trim();
  const tokens=[...new Set(raw.toLocaleLowerCase('tr-TR').split(/[^a-z0-9çğıöşüı._-]+/i).filter(x=>x.length>=2))]
    .filter(x=>!['nedir','nasil','nasıl','icin','için','bana','bir','ile','olan','son','devam'].includes(x))
    .slice(0,14);
  if(!tokens.length)return{raw,tokens,hits:[],scanned:0};

  const allowedExt=new Set(['.txt','.md','.json','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.csv','.html','.css','.yml','.yaml','.log']);
  const hits=[];
  let scanned=0;
  const walk=(dir,depth=0)=>{
    if(depth>maxDepth||scanned>=maxScanned)return;
    let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch(_){return}
    for(const e of entries){
      if(scanned>=maxScanned)break;
      const full=path.join(dir,e.name);
      const rel=path.relative(WORKSPACE,full);
      if(isSensitiveWorkspacePath(rel))continue;
      if(e.name==='.jarvis-memory'||e.name==='node_modules'||e.name==='.git')continue;
      if(e.isDirectory()){walk(full,depth+1);continue}
      if(!e.isFile()||!allowedExt.has(path.extname(e.name).toLowerCase()))continue;
      scanned++;
      let stat;try{stat=fs.statSync(full)}catch(_){continue}
      if(stat.size>1024*1024)continue;
      let data;try{data=fs.readFileSync(full,'utf8')}catch(_){continue}
      if(/(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]|api[_ -]?key\s*[:=])/i.test(data.slice(0,12000)))continue;

      const lower=data.toLocaleLowerCase('tr-TR');
      const relLower=rel.toLocaleLowerCase('tr-TR');
      let score=0,first=-1,matched=0;
      for(const t of tokens){
        let idx=0,count=0;
        if(relLower.includes(t)){score+=5;matched++}
        while((idx=lower.indexOf(t,idx))!==-1&&count<8){
          if(first<0||idx<first)first=idx;
          count++;idx+=t.length;
        }
        if(count){score+=Math.min(8,count);matched++}
      }
      if(!score)continue;
      // Favor files matching multiple distinct query tokens.
      score+=matched*2;
      const pos=Math.max(0,first);
      const snipStart=Math.max(0,pos-180),snipEnd=Math.min(data.length,pos+620);
      const snippet=data.slice(snipStart,snipEnd).replace(/\s+/g,' ').trim();
      hits.push({score,matched,path:rel,snippet});
    }
  };
  walk(WORKSPACE,0);
  hits.sort((a,b)=>b.score-a.score||b.matched-a.matched||a.path.localeCompare(b.path));
  return{raw,tokens,hits:hits.slice(0,Math.max(1,limit)),scanned};
}
function searchWorkspaceText(query){
  const found=workspaceSearchHits(query,{limit:5});
  if(!found.tokens.length)return{ok:false,message:'Arama ifadesi boş.'};
  if(!found.hits.length)return{ok:true,message:'Çalışma alanında "'+found.raw+'" için eşleşme bulamadım.'};
  return{
    ok:true,
    message:'Çalışma alanı araması · '+found.hits.length+' sonuç: '+found.hits.map((x,i)=>(i+1)+') '+x.path+' — '+x.snippet).join(' | ')
  };
}
function shouldUseWorkspaceContext(query){
  const s=String(query||'').toLocaleLowerCase('tr-TR');
  if(/\b(?:dosya|workspace|çalışma alanı|calisma alani|repo|kod|proje|readme|notlar|notlarım|notlarim)\b/.test(s))return true;
  if(/\b(?:varova|fikir2app|lifecv|hakkım ai|hakkim ai|raporasistan|aynı hamurdan|ayni hamurdan|sentrya|pati alan|zeka aynası|zeka aynasi|yolzeka)\b/.test(s))return true;
  if(isContextRecallQuery(query)&&/\b(?:proje|iş|is|kod|uygulama|site)\b/.test(s))return true;
  return false;
}
function workspaceBrainContext(query,limit=3){
  if(!shouldUseWorkspaceContext(query))return{context:'',sources:[]};
  const found=workspaceSearchHits(query,{limit,maxScanned:180,maxDepth:5});
  const useful=found.hits.filter(x=>x.score>=5).slice(0,limit);
  if(!useful.length)return{context:'',sources:[]};
  const context=useful.map((x,i)=>'KAYNAK '+(i+1)+' ['+x.path+']: '+x.snippet.slice(0,720)).join('\n');
  return{context,sources:useful.map(x=>x.path)};
}

function openKnownDesktopTarget(raw){
  if(process.platform!=='win32')return{ok:false,message:'Masaüstü açma komutları şu anda Windows için etkin'};
  let key=String(raw||'').toLocaleLowerCase('tr-TR').trim()
    .replace(/\s+/g,' ')
    .replace(/^(?:uygulama|program|site)\s+/,'')
    .replace(/\s+(?:uygulamasını|uygulamasini|programını|programini|sitesini)$/,'')
    .replace(/['’](?:y)?[ıiuü]$/,'')
    .trim();

  const appAliases={
    'hesap makinesini':'hesap makinesi',
    'not defterini':'not defteri',
    'dosya gezginini':'dosya gezgini',
    'görev yöneticisini':'görev yöneticisi',
    'gorev yoneticisini':'gorev yoneticisi',
    'çalışma alanını':'çalışma alanı',
    'calisma alanini':'calisma alani'
  };
  key=appAliases[key]||key;

  const urls={
    'youtube':'https://www.youtube.com/',
    'google':'https://www.google.com/',
    'github':'https://github.com/',
    'chatgpt':'https://chatgpt.com/'
  };
  if(urls[key]){openDefaultUrl(urls[key]);return{ok:true,message:key+' açıldı'}}

  const settingsUris={
    'ayarlar':'ms-settings:',
    'settings':'ms-settings:',
    'ses ayarları':'ms-settings:sound',
    'ses ayarlari':'ms-settings:sound',
    'bluetooth ayarları':'ms-settings:bluetooth',
    'bluetooth ayarlari':'ms-settings:bluetooth',
    'wifi ayarları':'ms-settings:network-wifi',
    'wi-fi ayarları':'ms-settings:network-wifi',
    'wifi ayarlari':'ms-settings:network-wifi'
  };
  if(settingsUris[key]){
    childProcess.spawn('cmd.exe',['/c','start','',settingsUris[key]],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
    return{ok:true,message:key+' açıldı'};
  }

  if(['tarayıcı','tarayici','browser','internet'].includes(key)){
    openDefaultUrl('https://www.google.com/');
    return{ok:true,message:'Varsayılan tarayıcı açıldı'};
  }
  if(['çalışma alanı','calisma alani','workspace','jarvis workspace'].includes(key)){
    startDetached('explorer.exe',[WORKSPACE]);
    return{ok:true,message:'JARVIS çalışma alanı açıldı'};
  }

  const builtins={
    'not defteri':['notepad.exe',[]],
    'notepad':['notepad.exe',[]],
    'hesap makinesi':['calc.exe',[]],
    'calculator':['calc.exe',[]],
    'dosya gezgini':['explorer.exe',[]],
    'gezgin':['explorer.exe',[]],
    'görev yöneticisi':['taskmgr.exe',[]],
    'gorev yoneticisi':['taskmgr.exe',[]],
    'paint':['mspaint.exe',[]],
    'powershell':['powershell.exe',[]],
    'terminal':['powershell.exe',[]]
  };
  if(builtins[key]){
    startDetached(builtins[key][0],builtins[key][1]);
    return{ok:true,message:key+' açıldı'};
  }

  const home=os.homedir();
  const browserCandidates={
    'opera gx':[
      path.join(home,'AppData','Local','Programs','Opera GX','launcher.exe'),
      path.join(home,'AppData','Local','Programs','Opera GX','opera.exe'),
      'C:\\Program Files\\Opera GX\\launcher.exe',
      'C:\\Program Files\\Opera GX\\opera.exe'
    ],
    'chrome':[
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(home,'AppData','Local','Google','Chrome','Application','chrome.exe')
    ],
    'edge':[
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ]
  };
  if(browserCandidates[key]){
    const exe=firstExisting(browserCandidates[key]);
    if(!exe)return{ok:false,message:key+' bilgisayarda bulunamadı'};
    startDetached(exe,[]);
    return{ok:true,message:key+' açıldı'};
  }

  return{ok:false,message:'Bu uygulama güvenli açma listesinde yok: '+raw};
}
async function execute(task){
  if(task.plan)return runPlan(task);
  const c=String(task.command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  if(/^(optimizasyonu uygula|optimizasyon uygula|apply optimization)/i.test(c)){
    const e=evaluateStrategyPolicy(),a=e.policy.active;
    return{ok:true,message:(e.rolledBack?'ROLLBACK · ':e.changed?'POLICY UPDATE · ':'NO CHANGE · ')+e.reason+(a?' · aktif '+a.action+' · skor '+a.score:' · aktif strateji yok')};
  }
  if(/^(optimizasyon durumu|strategy selection|en iyi strateji)/i.test(c)){
    const s=strategySelection();
    if(!s.recommended)return{ok:true,message:'Optimizasyon için yeterli kanıt yok · her strateji için en az '+s.minimumEvidence+' deneme gerekli'};
    const r=s.recommended;
    return{ok:true,message:'Kanıta dayalı öneri · '+r.action+' · '+r.attempts+' deneme · başarı '+Math.round(r.successRate*100)+'% · skor '+r.score+' · otomatik kod değişikliği yapılmadı'};
  }
  if(/^(öğrenme durumu|ogrenme durumu|strategy metrics|learning status)/i.test(c)){
    const m=strategyMetrics();
    const actions=Object.entries(m.byAction).map(([k,v])=>k+': '+v.successes+'/'+v.attempts+' başarılı').join(' · ');
    return{ok:true,message:'Strateji ölçümü · '+m.steps+' adım · '+m.repairs+' repair · '+m.successes+' başarılı · '+m.failures+' başarısız'+(actions?' · '+actions:' · henüz yeterli veri yok')};
  }
  if(/^(hafıza durumu|hafiza durumu|memory status)/i.test(c)){
    const s=memoryStats();
    return{ok:true,message:'Yerel kalıcı hafıza aktif · '+s.records+' kayıt · '+s.bytes+' bayt · '+MEMORY_FILE};
  }
  if(/^(yerel ai durumu|local ai status|ai readiness)/i.test(c)){
    const bins=['tesseract','ollama'];
    const found=[];
    for(const bin of bins){
      try{
        const cmd=process.platform==='win32'?'where.exe':'which';
        const out=childProcess.execFileSync(cmd,[bin],{encoding:'utf8',windowsHide:true,timeout:3000,maxBuffer:65536}).trim();
        if(out)found.push(bin);
      }catch(e){}
    }
    return{ok:true,message:'Yerel AI hazırlık · OCR '+(found.includes('tesseract')?'READY':'NOT INSTALLED')+' · VISION '+(found.includes('ollama')?'RUNTIME FOUND':'NOT INSTALLED')+' · yalnızca yerel binary kontrolü'};
  }
  if(/^(sistem durumu|system status|pc durumu)/i.test(c)){
    return{ok:true,message:'PC aktif · '+os.platform()+' '+os.release()+' · Node '+process.version+' · RAM '+Math.round(os.freemem()/1024/1024)+'MB boş'};
  }
  if(/^(işlemleri listele|islemleri listele|process list|çalışan işlemler|calisan islemler)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Process list şu anda Windows için etkin'};
    const out=childProcess.execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:512*1024});
    const rows=out.split(/\r?\n/).filter(Boolean).slice(0,40).map(x=>x.replace(/^"|"$/g,'').split('","').slice(0,2).join(' #'));
    return{ok:true,message:'Çalışan işlemler (ilk '+rows.length+'): '+rows.join(' · ')};
  }
  if(/^(disk durumu|disk status|depolama durumu)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Disk status şu anda Windows için etkin'};
    const ps='Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress';
    const raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:256*1024}).trim();
    const data=raw?JSON.parse(raw):[]; const list=Array.isArray(data)?data:[data];
    return{ok:true,message:list.map(d=>d.DeviceID+' '+Math.round(Number(d.FreeSpace||0)/1073741824)+'GB boş / '+Math.round(Number(d.Size||0)/1073741824)+'GB').join(' · ')||'Yerel disk bulunamadı'};
  }
  if(/^(wake on lan durumu|wol durumu|uzaktan açma durumu|uzaktan acma durumu|wake on lan readiness)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Wake-on-LAN readiness şu anda Windows için etkin'};
    const ps="$ad=Get-CimInstance Win32_NetworkAdapter -Filter \"PhysicalAdapter=True\" | Where-Object {$_.MACAddress -and $_.NetEnabled} | Select-Object -First 5 Name,MACAddress,NetConnectionID; $ad | ConvertTo-Json -Compress";
    let raw='';
    try{raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:256*1024}).trim()}catch(e){}
    const data=raw?JSON.parse(raw):[];const list=Array.isArray(data)?data:[data];
    const adapters=list.filter(Boolean).map(x=>(x.NetConnectionID||x.Name||'Adapter')+' '+x.MACAddress);
    return{ok:true,message:'WoL ön kontrol · aktif fiziksel ağ adaptörü: '+(adapters.join(' · ')||'bulunamadı')+' · BIOS/UEFI ve adaptör wake ayarı ayrıca doğrulanmalı · PC kapalıyken magic packet gönderecek sürekli açık LAN köprüsü henüz bağlı değil'};
  }
  if(/^(ağ durumu|ag durumu|network status|internet durumu)/i.test(c)){
    const nets=os.networkInterfaces(),active=[];
    for(const [name,arr] of Object.entries(nets))for(const x of (arr||[]))if(!x.internal&&x.family==='IPv4')active.push(name+' '+x.address);
    return{ok:true,message:'Ağ arayüzleri: '+(active.join(' · ')||'aktif IPv4 arayüzü bulunamadı')};
  }
  // JARVIS_MEDIA_CONTROL_V1
  if(/^(?:sesi yükselt|sesi yukselt|ses yükselt|ses yukselt|sesi artır|sesi arttır|ses artır|volume up)$/i.test(c)){
    sendWindowsMediaKey(0xAF,4);
    return{ok:true,message:'Ses yükseltildi'};
  }
  if(/^(?:sesi azalt|ses azalt|sesi kıs|sesi kis|ses kıs|ses kis|volume down)$/i.test(c)){
    sendWindowsMediaKey(0xAE,4);
    return{ok:true,message:'Ses azaltıldı'};
  }
  if(/^(?:sessize al|sesi kapat|sesi sustur|mute|sesi aç|sesi ac|unmute)$/i.test(c)){
    sendWindowsMediaKey(0xAD,1);
    return{ok:true,message:'Ses mute durumu değiştirildi'};
  }
  if(/^(?:oynat|duraklat|devam ettir|oynat duraklat|play pause|play|pause)$/i.test(c)){
    sendWindowsMediaKey(0xB3,1);
    return{ok:true,message:'Medya oynat/duraklat komutu gönderildi'};
  }
  if(/^(?:sonraki|sonraki şarkı|sonraki sarki|sonraki medya|next track)$/i.test(c)){
    sendWindowsMediaKey(0xB0,1);
    return{ok:true,message:'Sonraki medya komutu gönderildi'};
  }
  if(/^(?:önceki|onceki|önceki şarkı|onceki sarki|previous track)$/i.test(c)){
    sendWindowsMediaKey(0xB1,1);
    return{ok:true,message:'Önceki medya komutu gönderildi'};
  }
  if(/^(?:medyayı durdur|medyayi durdur|stop media)$/i.test(c)){
    sendWindowsMediaKey(0xB2,1);
    return{ok:true,message:'Medya durduruldu'};
  }
  if(/^(?:pil durumu|batarya durumu|güç durumu|guc durumu|power status)$/i.test(c)){
    return windowsPowerStatus();
  }

  const wsSearch=c.match(/^(?:dosyalarda ara|dosyalarda arat|workspace search)\s+(.+)$/i);
  if(wsSearch){
    const r=searchWorkspaceText(wsSearch[1]);
    return{ok:!!r.ok,retryable:false,message:r.message};
  }

  const openTarget=c.match(/^(?:aç|ac|open|uygulama aç|uygulama ac|program aç|program ac|site aç|site ac)\s+(.+)$/i)
    || c.match(/^(.+?)\s+(?:aç|ac)$/i);
  if(openTarget){
    const r=openKnownDesktopTarget(openTarget[1]);
    return{ok:!!r.ok,retryable:false,message:r.message};
  }

  const creatorVoice=c.match(/^(?:creator sesi oluştur|creator sesi olustur|video sesi oluştur|video sesi olustur|shorts sesi oluştur|shorts sesi olustur)(?:\s+([^:]+))?\s*:\s*([\s\S]+)$/i);
  if(creatorVoice){
    const requestedName=(creatorVoice[1]||('creator-'+Date.now())).trim();
    const out=await renderCreatorVoiceFile(creatorVoice[2],requestedName);
    return{ok:true,message:'Creator anlatım sesi hazır: '+out+' · profil CINEMATIC_CREATOR · Emel'};
  }

  if(/^(dosyaları listele|dosya listesi|list files)/i.test(c)){
    return{ok:true,message:'Workspace: '+(listFiles().join(', ')||'(boş)')};
  }
  const bundle=c.match(/^(?:proje paketi oluştur|proje paketi olustur|workspace bundle)\s+([^:]+)(?::\s*(.*))?$/i);
  if(bundle){
    return createBundle(bundle[1],(bundle[2]||'JARVIS tarafından oluşturulan ve doğrulanan proje çalışma alanı.').trim());
  }
  const folder=c.match(/^(?:klasör oluştur|klasor olustur|make folder|proje klasörü oluştur|proje klasoru olustur)\s+(.+)$/i);
  if(folder){
    const dir=safeFile(folder[1]);
    fs.mkdirSync(dir,{recursive:true});
    return{ok:true,message:'Klasör hazırlandı: '+path.relative(WORKSPACE,dir)};
  }
  const project=c.match(/^(?:proje oluştur|proje olustur|yeni proje|project create)\s+([^:]+)(?::\s*(.*))?$/i);
  if(project){
    const dir=safeFile(project[1]);
    fs.mkdirSync(dir,{recursive:true});
    const readme=path.join(dir,'README.md');
    const desc=(project[2]||'JARVIS tarafından oluşturulan yerel proje.').trim();
    if(!fs.existsSync(readme))fs.writeFileSync(readme,'# '+path.basename(dir)+'\n\n'+desc+'\n','utf8');
    return{ok:true,message:'Proje klasörü hazırlandı: '+path.relative(WORKSPACE,dir)+' · README.md oluşturuldu'};
  }
  const write=c.match(/^(?:dosya oluştur|dosya olustur|write file)\s+([^:]+)\s*:\s*([\s\S]+)$/i);
  if(write){
    const file=safeFile(write[1]);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,write[2],'utf8');
    return{ok:true,message:'Dosya oluşturuldu: '+path.relative(WORKSPACE,file)+' · '+Buffer.byteLength(write[2],'utf8')+' bayt'};
  }
  const read=c.match(/^(?:dosya oku|read file)\s+(.+)$/i);
  if(read){
    const file=safeFile(read[1]);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return{ok:false,retryable:false,message:'Dosya bulunamadı: '+read[1]};
    const data=fs.readFileSync(file,'utf8');
    return{ok:true,message:'Dosya '+path.relative(WORKSPACE,file)+': '+data.slice(0,4000)};
  }
  const m=c.match(/^not al\s+(.+)/i);
  if(m){
    const file=path.join(WORKSPACE,'notes.md');
    fs.appendFileSync(file,'- '+new Date().toISOString()+' '+m[1]+'\n');
    return{ok:true,message:'Not kaydedildi: notes.md'};
  }
  return{ok:false,retryable:false,message:'Bu görev henüz güvenli PC araç kataloğunda yok; tamamlandı sayılmadı.'};
}
async function recoverTransactionJournals(){
  let files=[];try{files=fs.readdirSync(JOURNAL_DIR).filter(x=>x.endsWith('.json')).slice(0,50)}catch(e){return}
  for(const name of files){
    try{
      const j=JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR,name),'utf8')),t=j.task;
      if(!t||!t.uid||!t.command||!t.plan)continue;
      const consistency=journalConsistency(t);
      if(!consistency.ok){
        remember({kind:'transaction_recovery_blocked',taskUid:t.uid,conflicts:consistency.conflicts});
        console.error('[JARVIS] Transaction dış değişiklik nedeniyle durduruldu:',t.uid);continue;
      }
      const cp=readCheckpoint(t),expectedHash=planHash(t.plan);
      if(cp.planVersion===t.plan.version&&cp.planHash===expectedHash&&Number.isInteger(cp.nextStep)){
        const prefix=verifyPlanPrefix(t.plan,Math.max(0,Math.min(cp.nextStep,t.plan.steps.length)));
        if(!prefix.ok){remember({kind:'transaction_recovery_blocked',taskUid:t.uid,reason:'prefix mismatch',steps:prefix.failures});continue}
        await api('/api/worker/rehydrate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t)});
        remember({kind:'transaction_resume_ready',taskUid:t.uid,nextStep:cp.nextStep,planHash:expectedHash});
      }else{
        const rb=rollbackJournal(t);
        if(rb.every(x=>x.ok)){clearJournal(t);clearCheckpoint(t)}
      }
    }catch(e){remember({kind:'transaction_recovery_error',file:name,error:e.message})}
  }
}
async function rehydrateCheckpoints(){
  let files=[];try{files=fs.readdirSync(CHECKPOINT_DIR).filter(x=>x.endsWith('.json')).slice(0,50)}catch(e){return}
  for(const name of files){
    try{
      const cp=JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR,name),'utf8')),t=cp.task;
      if(!t||!t.uid||!t.command||!t.plan)continue;
      await api('/api/worker/rehydrate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t)});
    }catch(e){}
  }
}
async function syncCloudState(){
  try{
    const s=await api('/api/state/snapshot');
    if(s.schemaVersion!==3||!Number.isSafeInteger(s.revision)||!s.signature)throw new Error('İmzalı Cloud snapshot v3 doğrulanamadı');
    let local=null;try{local=JSON.parse(fs.readFileSync(CLOUD_STATE_FILE,'utf8'))}catch(e){}
    if(local&&Number.isSafeInteger(local.revision)&&local.revision>s.revision)return;
    const tmp=CLOUD_STATE_FILE+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(s),'utf8');fs.renameSync(tmp,CLOUD_STATE_FILE);
  }catch(e){}
}
async function tryRestoreCloudState(){
  if(!fs.existsSync(CLOUD_STATE_FILE))return;
  try{
    const s=JSON.parse(fs.readFileSync(CLOUD_STATE_FILE,'utf8'));
    if(s.schemaVersion!==3||!s.signature){remember({kind:'state_restore_refused',reason:'unsigned_or_legacy_snapshot'});return}
    await api('/api/state/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)});
    console.log('[JARVIS] Cloud state yerel snapshot ile geri yüklendi.');
  }catch(e){
    if(!/not empty|approved device required|device awaiting approval/i.test(e.message))console.error('[JARVIS] State restore:',e.message);
  }
}
let lastStateSync=0;
let restoreAttempted=false;
let lastAuthRecovery=0;
let phoneSessionCodeShown=false;
let mobileTtsBusy=false;
let mobileBrainBusy=false;
async function serviceMobileTts(){
  if(mobileTtsBusy)return false;
  mobileTtsBusy=true;
  try{
    const r=await api('/api/worker/mobile-tts-next');
    if(!r||!r.request)return false;
    const q=r.request;
    try{
      const audio=await renderJarvisMp3Base64(q.text,q.tone||'balanced');
      await api('/api/worker/mobile-tts-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:true,audio})
      });
      console.log('[JARVIS] MOBILE TTS READY: '+q.id+' tone='+(q.tone||'balanced'));
    }catch(e){
      await api('/api/worker/mobile-tts-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})
      }).catch(()=>{});
      console.error('[JARVIS] MOBILE TTS:',e.message);
    }
    return true;
  }catch(e){
    if(!/404|not found/i.test(String(e.message||'')))console.error('[JARVIS] MOBILE TTS POLL:',e.message);
    return false;
  }finally{
    mobileTtsBusy=false;
  }
}
async function serviceMobileBrain(){
  if(mobileBrainBusy)return false;
  mobileBrainBusy=true;
  try{
    const r=await api('/api/worker/mobile-brain-next');
    if(!r||!r.request)return false;
    const q=r.request;
    try{
      let result=await runNativeAgent(q.message,{maxRounds:4});
      if(!result||result.ok!==true){
        result=await callLocalBrain(q.message);
      }
      if(!result||result.ok!==true)throw new Error(result&&result.error||'local brain failed');

      if(result.type==='plan'&&Array.isArray(result.commands)&&result.commands.length){
        const actionResults=[];
        let allOk=true;
        for(const command of result.commands.slice(0,4)){
          if(!isLocalSafeControlCommand(command)){allOk=false;actionResults.push({ok:false,message:'Güvenli olmayan adım engellendi: '+command});break}
          const action=await execute({command});
          actionResults.push(action||{ok:false,message:command+' sonucu alınamadı'});
          if(!action||!action.ok){allOk=false;break}
        }
        const summary=actionResults.map(x=>String(x&&x.message||'')).filter(Boolean).join('. ');
        const final=await finalizeToolReply(
          q.message,
          actionResults.map(x=>String(x&&x.message||'')).filter(Boolean),
          allOk?String(result.tone||'focused'):'warm'
        );
        result={
          ok:true,
          type:'chat',
          reply:String(final&&final.reply||summary||result.reply||'Plan işlendi.'),
          command:null,
          commands:result.commands.slice(0,4),
          executed:allOk,
          actionResults,
          model:result.model,
          finalizerModel:final&&final.model||null,
          reflected:!!(final&&final.reflected),
          tone:String(final&&final.tone||(allOk?result.tone||'focused':'warm')),
          memoryHits:result.memoryHits||0,
          personaVersion:result.personaVersion||2
        };
      }else if(result.type==='command'&&result.command){
        const action=await execute({command:result.command});
        const raw=String(action&&action.message||result.reply||'Komut işlendi.');
        const final=await finalizeToolReply(
          q.message,
          [raw],
          action&&action.ok?String(result.tone||'focused'):'warm'
        );
        result={
          ok:true,
          type:'chat',
          reply:String(final&&final.reply||raw),
          command:result.command,
          commands:[],
          executed:!!(action&&action.ok),
          actionResult:action||null,
          model:result.model,
          finalizerModel:final&&final.model||null,
          reflected:!!(final&&final.reflected),
          tone:String(final&&final.tone||(action&&action.ok?result.tone||'focused':'warm')),
          memoryHits:result.memoryHits||0,
          personaVersion:result.personaVersion||2
        };
      }

      await api('/api/worker/mobile-brain-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:true,result})
      });
      console.log('[JARVIS] MOBILE BRAIN READY: '+q.id+' type='+result.type);
    }catch(e){
      await api('/api/worker/mobile-brain-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})
      }).catch(()=>{});
      console.error('[JARVIS] MOBILE BRAIN:',e.message);
    }
    return true;
  }catch(e){
    if(!/404|not found/i.test(String(e.message||'')))console.error('[JARVIS] MOBILE BRAIN POLL:',e.message);
    return false;
  }finally{
    mobileBrainBusy=false;
  }
}
async function poll(){
  try{
    await pairDevice();
    await migrateDeviceCredential();
    if(!restoreAttempted){restoreAttempted=true;await tryRestoreCloudState();}
    try{
      await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,deviceId:DEVICE_ID,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats()})});
    }catch(e){
      const authLost=/revoked|not approved|awaiting approval/i.test(String(e.message||''));
      if(!authLost||Date.now()-lastAuthRecovery<60000)throw e;
      lastAuthRecovery=Date.now();
      remember({kind:'auth_recovery',reason:String(e.message||'authorization lost')});
      await tryRestoreCloudState();
      await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,deviceId:DEVICE_ID,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats()})});
      console.log('[JARVIS] Cloud restart recovery tamamlandı; Worker yeniden yetkilendirildi.');
    }
    if(!phoneSessionCodeShown){
      const p=await api('/api/session/create',{method:'POST'});
      phoneSessionCodeShown=true;
      console.log('[JARVIS] TELEFON SESSION CODE: '+p.code+' (5 dakika, tek kullanim)');
    }
    await serviceMobileTts();
    await serviceMobileBrain();
    if(Date.now()-lastStateSync>30000){
      await recoverTransactionJournals();
      await rehydrateCheckpoints();
      await syncCloudState();
      lastStateSync=Date.now();
    }
    const r=await api('/api/worker/next');
    if(!r.task)return;
    let result;
    try{result=await execute(r.task)}
    catch(e){result={ok:false,retryable:true,message:'Worker hatası: '+e.message}}
    remember({kind:'task_result',taskId:r.task.id,taskUid:r.task.uid,command:r.task.command,agent:r.task.agent,result});
    await api('/api/worker/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:r.task.id,uid:r.task.uid,...result})});
    queueJarvisSpeech(result.message);
    console.log('#'+r.task.id+' '+(result.ok?'OK':'FAIL')+' '+result.message);
  }catch(e){console.error(new Date().toISOString(),e.message)}
}
console.log('JARVIS PC Worker '+WORKER_VERSION+' başladı');
if(!TEST_MODE){
  cleanupOrphanedJarvisHelpers();
  startWindowsWakeHelper();
  startWindowsClapHelper();
  startWindowsLocalSttHelper();
}
startLocalTtsBridge();
if(!TEST_MODE){
  setTimeout(()=>{
    warmLocalBrain().then(state=>{
      if(state.status!=='ready'){
        setTimeout(()=>warmLocalBrain().catch(()=>{}),8000);
      }
    }).catch(()=>{});
  },900);
}
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
if(!TEST_MODE){
  poll();
  setInterval(poll,3000);
  // Phone conversation relay runs faster than the general task poll so
  // speech feels conversational instead of waiting up to three seconds.
  setInterval(()=>serviceMobileBrain().catch(()=>{}),650);
  setInterval(()=>serviceMobileTts().catch(()=>{}),650);
}else{
  console.log('[JARVIS] TEST MODE: cloud polling and Windows helpers disabled');
}
