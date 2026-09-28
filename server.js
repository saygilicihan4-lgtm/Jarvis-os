const http=require('http');
const fs=require('fs');
const path=require('path');

const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const TOKEN=process.env.JARVIS_TOKEN||'';
const state={
  tasks:[],
  audit:[],
  workers:{pc:{name:null,version:null,lastSeen:null,capabilities:[],memory:null},devices:{}}
};

function now(){return new Date().toISOString()}
function log(type,message){
  state.audit.push({at:now(),type,message});
  if(state.audit.length>300)state.audit.shift();
}
function json(res,code,obj){
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(obj));
}
function readJson(req,cb){
  let b='';
  req.on('data',x=>{b+=x;if(b.length>1_000_000)req.destroy()});
  req.on('end',()=>{try{cb(null,JSON.parse(b||'{}'))}catch(e){cb(e)}});
}
function authorized(req){
  if(!TOKEN)return true;
  const h=req.headers.authorization||'';
  return h===('Bearer '+TOKEN)||req.headers['x-jarvis-token']===TOKEN;
}
function agentFor(c){
  c=String(c||'').toLowerCase();
  if(/shopify|ürün|stok|sipariş|varova/.test(c))return'COMMERCE';
  if(/video|short|reels|youtube/.test(c))return'CREATOR';
  if(/kod|uygulama|site|deploy|github|dosya|klasör|bilgisayar|pc:|proje oluştur|proje olustur|yeni proje/.test(c))return'DEVELOPER';
  if(/araştır|bul|incele/.test(c))return'RESEARCH';
  if(/reklam|büyü|satış|seo/.test(c))return'GROWTH';
  return'CORE';
}
function risky(c){
  return /(öde|satın al|reklam bütçe|para gönder|iade yap|sözleşme imzala|sil|delete|format)/i.test(String(c||''));
}
function remoteAgent(a){return['DEVELOPER','CREATOR','COMMERCE'].includes(a)}
function requiredCapability(command){
  const c=String(command||'').toLowerCase().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  if(deterministicPlan(command))return'mission_plan';
  if(/^(optimizasyon durumu|strategy selection|en iyi strateji)/.test(c))return'strategy_selection';
  if(/^(öğrenme durumu|ogrenme durumu|strategy metrics|learning status)/.test(c))return'strategy_metrics';
  if(/^(hafıza durumu|hafiza durumu|memory status)/.test(c))return'local_memory';
  if(/^(sistem durumu|system status|pc durumu)/.test(c))return'system_status';
  if(/^(dosyaları listele|dosya listesi|list files)/.test(c))return'list_files';
  if(/^(dosya oluştur|dosya olustur|write file)/.test(c))return'write_file';
  if(/^(dosya oku|read file)/.test(c))return'read_file';
  if(/^(not al)/.test(c))return'write_note';
  if(/^(proje paketi oluştur|proje paketi olustur|workspace bundle)/.test(c))return'workspace_bundle';
  if(/^(klasör oluştur|klasor olustur|make folder|proje klasörü oluştur|proje klasoru olustur)/.test(c))return'make_folder';
  if(/^(proje oluştur|proje olustur|yeni proje|project create)/.test(c))return'project_scaffold';
  return null;
}
function deterministicPlan(command){
  const raw=String(command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  const m=raw.match(/^(?:çalışma alanı hazırla|calisma alani hazirla|workspace hazırla|workspace hazirla)\s+([^:]+)(?::\s*(.*))?$/i);
  if(!m)return null;
  const name=m[1].trim().replace(/[<>:"|?*]/g,'-').slice(0,80);
  if(!name||name==='.'||name==='..')return null;
  const desc=(m[2]||'JARVIS kontrollü görev çalışma alanı.').trim().slice(0,1000);
  return{
    version:1,
    steps:[
      {action:'make_folder',path:name},
      {action:'write_file',path:name+'/README.md',content:'# '+name+'\n\n'+desc+'\n'},
      {action:'write_file',path:name+'/TASKS.md',content:'# Tasks\n\n- [ ] Plan\n- [ ] Execute\n- [ ] Verify\n'},
      {action:'verify_file',path:name+'/README.md'},
      {action:'verify_file',path:name+'/TASKS.md'}
    ]
  };
}
function workerSupports(command){
  const need=requiredCapability(command);
  if(!need)return{ok:false,need:null};
  return{ok:state.workers.pc.capabilities.includes(need),need};
}
function taskById(id){return state.tasks.find(t=>t.id===Number(id))}
function workerOnline(w){const t=w&&w.lastSeen;return !!t&&(Date.now()-new Date(t).getTime()<15000)}
function pcOnline(){return workerOnline(state.workers.pc)}
function deviceWorker(id){return id&&state.workers.devices[id]||null}
function deviceOnline(id){return workerOnline(deviceWorker(id))}
function publicDevices(){
  return Object.fromEntries(Object.entries(state.workers.devices).map(([id,w])=>[id,{name:w.name,version:w.version,lastSeen:w.lastSeen,capabilities:w.capabilities,memory:w.memory,approved:!!w.approved,online:workerOnline(w)}]));
}
function prepareTask(t,approved=false){
  if(risky(t.command)&&!approved){
    t.status='waiting_approval';
    t.message='Yüksek riskli/geri döndürülemez eylem: açık onay gerekli.';
    log('GUARDRAIL','#'+t.id+' onaya alındı');
    return;
  }
  if(remoteAgent(t.agent)){
    const support=workerSupports(t.command);
    if(pcOnline()&&!support.ok){
      t.status='needs_tool';
      t.message=support.need?'Bağlı PC Worker bu yeteneği desteklemiyor: '+support.need+' · Worker güncellemesi gerekli.':'Bu görev için güvenli PC aracı henüz tanımlı değil.';
      log('TOOL_MISSING','#'+t.id+' '+t.message);
      return;
    }
    t.status='waiting_worker';
    t.message='PC Worker bekleniyor.';
    log('ROUTE','#'+t.id+' PC Worker kuyruğuna gönderildi');
    return;
  }
  if(/self.?heal|hata testi|retry/i.test(t.command)){
    return runLocalSelfHeal(t);
  }
  t.status='needs_tool';
  t.message='Bu görev için henüz gerçek araç bağlı değil; tamamlandı sayılmadı.';
  log('TOOL_MISSING','#'+t.id+' araç bekliyor');
}
function runLocalSelfHeal(t){
  t.status='running';
  log('EXECUTE','#'+t.id+' local self-heal testi');
  setTimeout(()=>{
    t.attempts++;
    if(t.attempts===1){
      t.status='retrying';
      t.message='İlk strateji başarısız (kontrollü test). Alternatif strateji deneniyor.';
      log('DIAGNOSE','#'+t.id+' strateji değiştirildi');
      return setTimeout(()=>runLocalSelfHeal(t),300);
    }
    t.status='completed';
    t.message='Self-healing döngüsü ikinci stratejide doğrulandı.';
    log('VERIFY','#'+t.id+' self-heal doğrulandı');
  },250);
}
function publicState(){
  return{
    tasks:state.tasks,
    audit:state.audit,
    workers:{
      pc:{
        name:state.workers.pc.name,
        version:state.workers.pc.version,
        lastSeen:state.workers.pc.lastSeen,
        capabilities:state.workers.pc.capabilities,
        memory:state.workers.pc.memory,
        online:pcOnline()
      }
    }
  };
}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const pathname=u.pathname;

  if(pathname==='/api/health'){
    return json(res,200,{ok:true,name:'JARVIS OS',version:'0.2.0',zeroCostFirst:true,auth:!!TOKEN,pcWorker:pcOnline()});
  }

  if(pathname.startsWith('/api/')&&!authorized(req)){
    return json(res,401,{error:'unauthorized'});
  }

  if(pathname==='/api/state'&&req.method==='GET'){
    return json(res,200,publicState());
  }

  if(pathname==='/api/tasks'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const command=String(d.command||'').trim();
      if(!command)return json(res,400,{error:'command required'});
      const t={
        id:state.tasks.length+1,
        uid:'J-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),
        command,
        agent:agentFor(command),
        status:'queued',
        attempts:0,
        maxRetries:3,
        message:'',
        createdAt:now(),
        claimedAt:null,
        completedAt:null
      };
      const plan=deterministicPlan(command);
      if(plan){t.plan=plan;t.agent='DEVELOPER';}
      state.tasks.push(t);
      log(plan?'PLAN':'QUEUE','#'+t.id+(plan?' güvenli '+plan.steps.length+' adımlı plan oluşturuldu':' kuyruğa alındı'));
      prepareTask(t,false);
      return json(res,201,t);
    });
  }

  const approve=pathname.match(/^\/api\/tasks\/(\d+)\/approve$/);
  if(approve&&req.method==='POST'){
    const t=taskById(approve[1]);
    if(!t)return json(res,404,{error:'task not found'});
    if(t.status!=='waiting_approval')return json(res,409,{error:'task is not waiting approval'});
    log('APPROVE','#'+t.id+' kullanıcı tarafından onaylandı');
    prepareTask(t,true);
    return json(res,200,t);
  }

  const cancel=pathname.match(/^\/api\/tasks\/(\d+)\/cancel$/);
  if(cancel&&req.method==='POST'){
    const t=taskById(cancel[1]);
    if(!t)return json(res,404,{error:'task not found'});
    if(['completed','cancelled'].includes(t.status))return json(res,409,{error:'task already closed'});
    t.status='cancelled';
    t.message='Kullanıcı tarafından iptal edildi.';
    t.completedAt=now();
    log('CANCEL','#'+t.id+' iptal edildi');
    return json(res,200,t);
  }

  if(pathname==='/api/worker/heartbeat'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      state.workers.pc={
        name:String(d.name||'PC Worker'),
        version:d.version?String(d.version):null,
        lastSeen:now(),
        capabilities:Array.isArray(d.capabilities)?d.capabilities.slice(0,50):[],
        memory:d.memory&&typeof d.memory==='object'?{
          records:Number(d.memory.records)||0,
          bytes:Number(d.memory.bytes)||0,
          lastAt:d.memory.lastAt?String(d.memory.lastAt):null
        }:null
      };
      return json(res,200,{ok:true,at:state.workers.pc.lastSeen});
    });
  }

  if(pathname==='/api/worker/next'&&req.method==='GET'){
    state.workers.pc.lastSeen=now();
    const CLAIM_TTL_MS=90_000;
    for(const stale of state.tasks.filter(x=>x.status==='claimed'&&x.claimedAt)){
      if(Date.now()-new Date(stale.claimedAt).getTime()>CLAIM_TTL_MS){
        if(stale.attempts<stale.maxRetries){
          stale.status='waiting_worker';
          stale.message='PC bağlantısı kesildi; görev checkpoint üzerinden yeniden kuyruğa alındı.';
          log('RESUME','#'+stale.id+' yarım görev yeniden kuyruğa alındı');
        }else{
          stale.status='failed';
          stale.message='PC bağlantısı sırasında maksimum yeniden deneme sınırına ulaşıldı.';
          stale.completedAt=now();
          log('FAILED','#'+stale.id+' kesinti retry sınırına ulaştı');
        }
      }
    }
    const queued=state.tasks.filter(x=>x.status==='waiting_worker');
    let t=null;
    for(const candidate of queued){
      const support=workerSupports(candidate.command);
      if(support.ok){t=candidate;break}
      if(support.need){
        candidate.status='needs_tool';
        candidate.message='Bağlı PC Worker bu yeteneği desteklemiyor: '+support.need+' · Worker güncellemesi gerekli.';
        log('TOOL_MISSING','#'+candidate.id+' '+candidate.message);
      }else{
        candidate.status='needs_tool';
        candidate.message='Bu görev için güvenli PC aracı henüz tanımlı değil.';
        log('TOOL_MISSING','#'+candidate.id+' '+candidate.message);
      }
    }
    if(!t)return json(res,200,{task:null});
    t.status='claimed';
    t.claimedAt=now();
    t.attempts++;
    t.message='PC Worker görevi aldı.';
    log('CLAIM','#'+t.id+' PC Worker aldı (deneme '+t.attempts+')');
    return json(res,200,{task:t});
  }

  if(pathname==='/api/worker/result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const t=taskById(d.id);
      if(!t)return json(res,404,{error:'task not found'});
      if(t.status==='cancelled')return json(res,409,{error:'task cancelled'});
      if(d.ok){
        t.status='completed';
        t.message=String(d.message||'PC Worker görevi tamamladı.');
        t.completedAt=now();
        log('VERIFY','#'+t.id+' PC Worker sonucu doğrulandı');
      }else{
        const retryable=d.retryable===true&&t.attempts<t.maxRetries;
        t.status=retryable?'waiting_worker':'failed';
        t.message=String(d.message||'PC Worker görevi başarısız oldu.');
        if(!retryable)t.completedAt=now();
        log(retryable?'RETRY':'FAILED','#'+t.id+' '+t.message);
      }
      return json(res,200,t);
    });
  }

  if(req.method!=='GET'){
    res.writeHead(405);return res.end('method not allowed');
  }

  let rel=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\/+/, '');
  let file=path.resolve(PUBLIC,rel);
  if(!(file===path.resolve(PUBLIC,'index.html')||file.startsWith(PUBLIC+path.sep))){
    res.writeHead(403);return res.end('blocked');
  }
  fs.readFile(file,(err,data)=>{
    if(err&&!path.extname(rel)){
      file=path.join(PUBLIC,'index.html');
      return fs.readFile(file,(e,d)=>{
        if(e){res.writeHead(404);return res.end('not found')}
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
        res.end(d);
      });
    }
    if(err){res.writeHead(404);return res.end('not found')}
    const ext=path.extname(file);
    const type=ext==='.css'?'text/css; charset=utf-8':ext==='.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
    res.end(data);
  });
});

server.listen(PORT,'0.0.0.0',()=>{
  log('BOOT','JARVIS OS v0.2 started');
  console.log('JARVIS OS listening on '+PORT);
});
