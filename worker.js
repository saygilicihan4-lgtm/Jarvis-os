const fs=require('fs');
const path=require('path');
const os=require('os');

const BASE=(process.env.JARVIS_URL||'https://jarvis-os-1iuv.onrender.com').replace(/\/$/,'');
const TOKEN=process.env.JARVIS_TOKEN||'';
const NAME=process.env.JARVIS_WORKER_NAME||os.hostname();
const WORKSPACE=path.resolve(process.env.JARVIS_WORKSPACE||path.join(process.cwd(),'jarvis-workspace'));
const CAPS=['system_status','list_files','write_note','write_file','read_file'];

if(!TOKEN){console.error('JARVIS_TOKEN gerekli.');process.exit(1)}
fs.mkdirSync(WORKSPACE,{recursive:true});

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
async function execute(task){
  const c=String(task.command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  if(/^(sistem durumu|system status|pc durumu)/i.test(c)){
    return{ok:true,message:'PC aktif · '+os.platform()+' '+os.release()+' · Node '+process.version+' · RAM '+Math.round(os.freemem()/1024/1024)+'MB boş'};
  }
  if(/^(dosyaları listele|dosya listesi|list files)/i.test(c)){
    return{ok:true,message:'Workspace: '+(listFiles().join(', ')||'(boş)')};
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
    await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,capabilities:CAPS})});
    const r=await api('/api/worker/next');
    if(!r.task)return;
    let result;
    try{result=await execute(r.task)}
    catch(e){result={ok:false,retryable:true,message:'Worker hatası: '+e.message}}
    await api('/api/worker/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:r.task.id,...result})});
    console.log('#'+r.task.id+' '+(result.ok?'OK':'FAIL')+' '+result.message);
  }catch(e){console.error(new Date().toISOString(),e.message)}
}
console.log('JARVIS PC Worker başladı');
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
poll();
setInterval(poll,3000);
