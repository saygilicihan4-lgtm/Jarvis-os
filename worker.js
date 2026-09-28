const fs=require('fs');
const path=require('path');
const os=require('os');

const BASE=(process.env.JARVIS_URL||'https://jarvis-os-1iuv.onrender.com').replace(/\/$/,'');
const TOKEN=process.env.JARVIS_TOKEN||'';
const NAME=process.env.JARVIS_WORKER_NAME||os.hostname();
const WORKSPACE=path.resolve(process.env.JARVIS_WORKSPACE||path.join(process.cwd(),'jarvis-workspace'));
const MEMORY_DIR=path.join(WORKSPACE,'.jarvis-memory');
const MEMORY_FILE=path.join(MEMORY_DIR,'task-history.jsonl');
const WORKER_VERSION='0.7.0';
const CAPS=['system_status','list_files','write_note','write_file','read_file','make_folder','project_scaffold','workspace_bundle','mission_plan','local_memory'];

if(!TOKEN){console.error('JARVIS_TOKEN gerekli.');process.exit(1)}
fs.mkdirSync(WORKSPACE,{recursive:true});
fs.mkdirSync(MEMORY_DIR,{recursive:true});
function remember(record){
  const safe={at:new Date().toISOString(),...record};
  fs.appendFileSync(MEMORY_FILE,JSON.stringify(safe)+'\n','utf8');
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
  options.headers={...(options.headers||{}),authorization:'Bearer '+TOKEN};
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
async function runPlan(plan){
  if(!plan||!Array.isArray(plan.steps)||plan.steps.length<1||plan.steps.length>8)throw new Error('Plan 1-8 adım içermeli');
  const results=[];
  const MAX_STEP_ATTEMPTS=2;
  for(let i=0;i<plan.steps.length;i++){
    const step=plan.steps[i]||{};
    let result=null,lastError=null;
    for(let attempt=1;attempt<=MAX_STEP_ATTEMPTS;attempt++){
      try{
        if(step.action==='make_folder'){
          const dir=safeFile(step.path); fs.mkdirSync(dir,{recursive:true});
          result={ok:verifyPath(step.path,'dir'),message:'Klasör: '+step.path};
        }else if(step.action==='write_file'){
          const file=safeFile(step.path); fs.mkdirSync(path.dirname(file),{recursive:true});
          fs.writeFileSync(file,String(step.content||''),'utf8');
          result={ok:verifyPath(step.path,'file'),message:'Dosya: '+step.path};
        }else if(step.action==='verify_file'){
          result={ok:verifyPath(step.path,'file'),message:'Dosya doğrulama: '+step.path};
        }else if(step.action==='verify_folder'){
          result={ok:verifyPath(step.path,'dir'),message:'Klasör doğrulama: '+step.path};
        }else{
          throw new Error('İzin verilmeyen plan aksiyonu: '+String(step.action||''));
        }
        remember({kind:'plan_step',action:step.action,path:step.path||null,step:i+1,attempt,ok:!!result.ok});
        if(result.ok){results.push({step:i+1,action:step.action,attempts:attempt,...result});break}
        lastError=new Error('Doğrulama başarısız: '+result.message);
      }catch(e){
        lastError=e;
        remember({kind:'plan_step',action:step.action,path:step.path||null,step:i+1,attempt,ok:false,error:e.message});
      }
      if(attempt<MAX_STEP_ATTEMPTS)remember({kind:'repair',step:i+1,action:step.action,reason:lastError&&lastError.message});
    }
    if(!result||!result.ok)throw new Error('Adım '+(i+1)+' iki denemede doğrulanamadı: '+(lastError?lastError.message:'bilinmeyen hata'));
  }
  return{ok:true,message:'Plan doğrulandı · '+results.length+' adım · bounded repair aktif',steps:results};
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
  if(task.plan)return runPlan(task.plan);
  const c=String(task.command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
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
async function poll(){
  try{
    await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats()})});
    const r=await api('/api/worker/next');
    if(!r.task)return;
    let result;
    try{result=await execute(r.task)}
    catch(e){result={ok:false,retryable:true,message:'Worker hatası: '+e.message}}
    remember({kind:'task_result',taskId:r.task.id,command:r.task.command,agent:r.task.agent,result});
    await api('/api/worker/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:r.task.id,...result})});
    console.log('#'+r.task.id+' '+(result.ok?'OK':'FAIL')+' '+result.message);
  }catch(e){console.error(new Date().toISOString(),e.message)}
}
console.log('JARVIS PC Worker '+WORKER_VERSION+' başladı');
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
poll();
setInterval(poll,3000);
