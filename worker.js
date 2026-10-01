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
const WORKER_VERSION='2.37.0';
const CAPS=['system_status','list_files','write_note','write_file','read_file','make_folder','project_scaffold','workspace_bundle','mission_plan','strategy_metrics','strategy_selection','strategy_rollback','resume_checkpoint','multi_device_identity','cloud_state_backup','snapshot_integrity_v2','snapshot_hmac_v3','signed_bootstrap_restore_v1','task_uid_v1','safe_rehydrate_v1','transactional_plan','transaction_crash_recovery_v1','strict_journal_v2','bounded_rollback_v1','transaction_journal_v3','checkpoint_plan_hash_v1','prefix_revalidation_v1','signed_device_credential_v1','device_credential_refresh_v1','pairing_code_v1','restore_before_heartbeat_v1','single_restore_attempt_v1','auth_loss_restore_v1','global_f8_wake_v1','phone_session_code_v1','local_memory','process_list_v1','disk_status_v1','network_status_v1','local_ai_readiness_v1','wake_on_lan_readiness_v1','local_tts_v1','local_tts_bridge_v1','double_clap_wake_v2','helper_autosync_v1','python_clap_listener_v1','double_clap_transient_gate_v2','double_clap_classifier_v3','mobile_tts_relay_v1','creator_tts_v1','desktop_launch_v1','media_control_v1','power_status_v1'];


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
let speechQueue=Promise.resolve();
const TTS_LOCK_FILE=path.join(__dirname,'jarvis-tts-active.lock');
let lastQueuedSpeech='';
let lastQueuedSpeechAt=0;
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
async function speakJarvisNow(text){
  if(!TTS_ENABLED)return;
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,700);
  if(!clean)return;
  const mp3=path.join(os.tmpdir(),'jarvis-tts-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');
  setTtsLock(true);
  try{
    await runHidden('py',['-m','edge_tts','--voice',TTS_VOICE,'--rate='+TTS_RATE,'--pitch='+TTS_PITCH,'--volume='+TTS_VOLUME,'--text',clean,'--write-media',mp3],45000);
    const safe=mp3.replace(/'/g,"''");
    const ps="Add-Type -AssemblyName PresentationCore; $p=New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'"+safe+"'); for($i=0;$i -lt 100 -and -not $p.NaturalDuration.HasTimeSpan;$i++){Start-Sleep -Milliseconds 100}; $p.Volume=1.0; $p.Play(); if($p.NaturalDuration.HasTimeSpan){Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds+500)}else{Start-Sleep -Seconds 15}; $p.Close()";
    await runHidden('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],45000);
  }finally{
    try{if(fs.existsSync(mp3))fs.unlinkSync(mp3)}catch(e){}
    await new Promise(r=>setTimeout(r,900));
    setTtsLock(false);
  }
}
async function renderJarvisMp3Base64(text){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,700);
  if(!clean)throw new Error('text required');
  const mp3=path.join(os.tmpdir(),'jarvis-mobile-tts-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');
  try{
    await runHidden('py',['-m','edge_tts','--voice',TTS_VOICE,'--rate='+TTS_RATE,'--pitch='+TTS_PITCH,'--volume='+MOBILE_TTS_VOLUME,'--text',clean,'--write-media',mp3],45000);
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
function queueJarvisSpeech(text){
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
  speechQueue=speechQueue.then(()=>speakJarvisNow(clean)).catch(e=>console.error('[JARVIS] TTS:',e.message));
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

function startLocalTtsBridge(){
  if(!TTS_ENABLED)return;
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
    if(req.method==='GET'&&req.url==='/health'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,voice:TTS_VOICE,version:WORKER_VERSION}));
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
          queueJarvisSpeech(text);
          res.writeHead(202,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:true,queued:true}));
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
async function serviceMobileTts(){
  try{
    const r=await api('/api/worker/mobile-tts-next');
    if(!r||!r.request)return false;
    const q=r.request;
    try{
      const audio=await renderJarvisMp3Base64(q.text);
      await api('/api/worker/mobile-tts-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,ok:true,audio})});
      console.log('[JARVIS] MOBILE TTS READY: '+q.id);
    }catch(e){
      await api('/api/worker/mobile-tts-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})}).catch(()=>{});
      console.error('[JARVIS] MOBILE TTS:',e.message);
    }
    return true;
  }catch(e){
    if(!/404|not found/i.test(String(e.message||'')))console.error('[JARVIS] MOBILE TTS POLL:',e.message);
    return false;
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
cleanupOrphanedJarvisHelpers();
startWindowsWakeHelper();
startWindowsClapHelper();
startLocalTtsBridge();
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
poll();
setInterval(poll,3000);
