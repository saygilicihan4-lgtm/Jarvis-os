const fs=require('fs');
const path=require('path');
const os=require('os');

const BASE=(process.env.JARVIS_URL||'https://jarvis-os-1iuv.onrender.com').replace(/\/$/,'');
const TOKEN=process.env.JARVIS_TOKEN||'';
const NAME=process.env.JARVIS_WORKER_NAME||os.hostname();
const DEVICE_FILE=path.join(os.homedir(),'.jarvis-device-id');
function loadDeviceId(){
  if(process.env.JARVIS_DEVICE_ID)return process.env.JARVIS_DEVICE_ID;
  try{const x=fs.readFileSync(DEVICE_FILE,'utf8').trim();if(x)return x}catch(e){}
  const id='PC-'+os.hostname().replace(/[^A-Za-z0-9_.-]/g,'-')+'-'+require('crypto').randomBytes(4).toString('hex');
  fs.writeFileSync(DEVICE_FILE,id,'utf8');return id;
}
const DEVICE_ID=loadDeviceId();
const WORKSPACE=path.resolve(process.env.JARVIS_WORKSPACE||path.join(process.cwd(),'jarvis-workspace'));
const MEMORY_DIR=path.join(WORKSPACE,'.jarvis-memory');
const MEMORY_FILE=path.join(MEMORY_DIR,'task-history.jsonl');
const CHECKPOINT_DIR=path.join(MEMORY_DIR,'checkpoints');
const JOURNAL_DIR=path.join(MEMORY_DIR,'journals');
const STRATEGY_FILE=path.join(MEMORY_DIR,'strategy-policy.json');
const CLOUD_STATE_FILE=path.join(MEMORY_DIR,'cloud-state.json');
const WORKER_VERSION='2.1.0';
const CAPS=['system_status','list_files','write_note','write_file','read_file','make_folder','project_scaffold','workspace_bundle','mission_plan','strategy_metrics','strategy_selection','strategy_rollback','resume_checkpoint','multi_device_identity','cloud_state_backup','snapshot_integrity_v2','task_uid_v1','safe_rehydrate_v1','transactional_plan','transaction_crash_recovery_v1','checkpoint_plan_hash_v1','prefix_revalidation_v1','local_memory'];

if(!TOKEN){console.error('JARVIS_TOKEN gerekli.');process.exit(1)}
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
  options.headers={...(options.headers||{}),authorization:'Bearer '+TOKEN,'x-jarvis-device-id':DEVICE_ID};
  const r=await fetch(BASE+route,options);
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
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
function readJournal(task){try{return JSON.parse(fs.readFileSync(journalFile(task),'utf8'))}catch(e){return{version:2,task:{uid:task.uid,command:task.command,plan:task.plan,createdAt:task.createdAt},entries:[]}}}
function writeJournal(task,j){
  const f=journalFile(task),tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(j),'utf8');fs.renameSync(tmp,f);
}
function journalBefore(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target);
  if(j.version!==2)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(j.entries.some(x=>x.path===rel))return;
  if(type==='file'){
    if(fs.existsSync(target)){
      const st=fs.statSync(target);if(!st.isFile())throw new Error('Rollback hedefi dosya değil: '+rel);
      if(st.size>512*1024)throw new Error('Rollback limiti: mevcut dosya 512KB üzerinde: '+rel);
      j.entries.push({path:rel,type:'file',existed:true,beforeHash:fileHash(target),afterHash:null,data:fs.readFileSync(target).toString('base64')});
    }else j.entries.push({path:rel,type:'file',existed:false,beforeHash:null,afterHash:null});
  }else if(type==='dir')j.entries.push({path:rel,type:'dir',existed:fs.existsSync(target),afterExists:null});
  if(j.entries.length>32)throw new Error('Transaction journal 32 öğe sınırını aştı');
  writeJournal(task,j);
}
function journalAfter(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target),e=j.entries.find(x=>x.path===rel);
  if(j.version!==2)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(!e)throw new Error('Transaction journal girdisi bulunamadı: '+rel);
  if(type==='file')e.afterHash=fileHash(target);else e.afterExists=fs.existsSync(target);
  writeJournal(task,j);
}
function journalConsistency(task){
  const j=readJournal(task),conflicts=[];
  for(const e of j.entries){
    const target=safeFile(e.path);
    if(e.type==='file'){
      const current=fileHash(target);
      const expected=e.afterHash;
      if(expected&&current!==expected)conflicts.push({path:e.path,expected,current});
      if(!expected&&e.existed&&current!==e.beforeHash)conflicts.push({path:e.path,expected:e.beforeHash,current});
    }else if(e.type==='dir'&&e.afterExists===true&&!fs.existsSync(target))conflicts.push({path:e.path,expected:'exists',current:'missing'});
  }
  return{ok:conflicts.length===0,conflicts};
}
function rollbackJournal(task){
  const consistency=journalConsistency(task);
  if(!consistency.ok){remember({kind:'transaction_conflict',taskUid:task.uid||null,conflicts:consistency.conflicts});return consistency.conflicts.map(x=>({path:x.path,ok:false,error:'external change detected'}))}
  const j=readJournal(task),out=[];
  for(const e of [...j.entries].reverse()){
    const target=safeFile(e.path);
    try{
      if(e.type==='file'){
        if(e.existed){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(e.data||'','base64'))}
        else if(fs.existsSync(target)&&fs.statSync(target).isFile())fs.unlinkSync(target);
      }else if(e.type==='dir'&&!e.existed&&fs.existsSync(target)){try{fs.rmdirSync(target)}catch(x){}}
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
          const file=safeFile(step.path); journalBefore(task,file,'file'); fs.mkdirSync(path.dirname(file),{recursive:true});
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
  if(/^(sistem durumu|system status|pc durumu)/i.test(c)){
    return{ok:true,message:'PC aktif · '+os.platform()+' '+os.release()+' · Node '+process.version+' · RAM '+Math.round(os.freemem()/1024/1024)+'MB boş'};
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
    if(s.schemaVersion!==2||!Number.isSafeInteger(s.revision)||!s.sha256)throw new Error('Cloud snapshot v2 doğrulanamadı');
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
    await api('/api/state/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)});
    console.log('[JARVIS] Cloud state yerel snapshot ile geri yüklendi.');
  }catch(e){
    if(!/not empty|approved device required|device awaiting approval/i.test(e.message))console.error('[JARVIS] State restore:',e.message);
  }
}
let lastStateSync=0;
async function poll(){
  try{
    await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,deviceId:DEVICE_ID,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats()})});
    if(Date.now()-lastStateSync>30000){
      await tryRestoreCloudState();
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
    console.log('#'+r.task.id+' '+(result.ok?'OK':'FAIL')+' '+result.message);
  }catch(e){console.error(new Date().toISOString(),e.message)}
}
console.log('JARVIS PC Worker '+WORKER_VERSION+' başladı');
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
poll();
setInterval(poll,3000);
