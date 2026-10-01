const http=require('http');
const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');

const OLLAMA_PORT=11449;
const BRIDGE_PORT=18769;
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-lexicon-test-'));
const seen=[];

function json(res,code,obj){
  res.writeHead(code,{'content-type':'application/json'});
  res.end(JSON.stringify(obj));
}
function readJson(req){
  return new Promise((resolve,reject)=>{
    let body='';
    req.on('data',x=>body+=x);
    req.on('end',()=>{try{resolve(JSON.parse(body||'{}'))}catch(e){reject(e)}});
  });
}
const mock=http.createServer(async(req,res)=>{
  if(req.url==='/api/tags')return json(res,200,{models:[{name:'qwen3.5:2b'}]});
  if(req.url==='/api/chat'&&req.method==='POST'){
    const body=await readJson(req);
    seen.push(body);
    const messages=Array.isArray(body.messages)?body.messages:[];
    const lastUser=messages.filter(x=>x.role==='user').slice(-1)[0];
    const text=String(lastUser&&lastUser.content||'');
    if(Array.isArray(body.tools)&&body.tools.length){
      return json(res,200,{message:{role:'assistant',content:'Düzeltilmiş ifadeyi native ajan aldı.'}});
    }
    const out=/youtube/i.test(text)
      ?{type:'command',reply:'YouTube açılıyor.',command:'youtube aç',commands:[],tone:'focused'}
      :{type:'chat',reply:'Sizi anladım.',command:null,commands:[],tone:'balanced'};
    return json(res,200,{message:{role:'assistant',content:JSON.stringify(out)}});
  }
  return json(res,404,{error:'not found'});
});
function get(url){
  return new Promise((resolve,reject)=>{
    http.get(url,r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}))}).on('error',reject);
  });
}
function post(url,obj){
  return new Promise((resolve,reject)=>{
    const u=new URL(url),body=JSON.stringify(obj||{});
    const req=http.request({hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},r=>{
      let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}));
    });
    req.on('error',reject);req.end(body);
  });
}
function waitForBridge(child,timeout=10000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('bridge timeout')),timeout);
    child.stdout.on('data',d=>{
      const s=String(d);process.stdout.write(s);
      if(s.includes('LOCAL TTS BRIDGE READY')){clearTimeout(timer);resolve()}
    });
    child.stderr.on('data',d=>process.stderr.write(String(d)));
    child.on('exit',code=>{clearTimeout(timer);reject(new Error('worker exited '+code))});
  });
}
function assert(x,msg){if(!x)throw new Error(msg)}

(async()=>{
  let worker;
  try{
    await new Promise((resolve,reject)=>mock.listen(OLLAMA_PORT,'127.0.0.1',e=>e?reject(e):resolve()));
    worker=spawn(process.execPath,['worker.js'],{
      cwd:__dirname,
      env:{
        ...process.env,
        JARVIS_TEST_MODE:'1',
        JARVIS_LOCAL_BRIDGE_FORCE:'1',
        JARVIS_TTS_PORT:String(BRIDGE_PORT),
        JARVIS_LOCAL_BRAIN_URL:'http://127.0.0.1:'+OLLAMA_PORT,
        JARVIS_LOCAL_BRAIN_MODEL:'qwen3.5:2b',
        JARVIS_TOKEN:'test-token',
        JARVIS_WORKSPACE:workspace
      },
      stdio:['ignore','pipe','pipe']
    });
    await waitForBridge(worker);

    const health=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/health')).body);
    assert(health.ok===true,'health');
    assert(health.localStt&&health.localStt.adaptiveLexicon===true,'adaptive lexicon health metadata');

    const learn=await post('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon',{
      heard:'yutup ac',intended:'youtube aç',source:'standalone-test'
    });
    assert(learn.status===200,'learn status');
    const lj=JSON.parse(learn.body);
    assert(lj.ok===true&&lj.count===1,'learn payload');

    const current=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon')).body);
    assert(current.aliases['yutup ac']==='youtube aç','alias persisted');

    const brain=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'yutup ac'});
    assert(brain.status===200,'brain status');
    const bj=JSON.parse(brain.body);
    assert(bj.type==='command'&&bj.command==='youtube aç','brain did not apply learned alias');

    const before=seen.length;
    const agent=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'yutup ac',maxRounds:1});
    assert(agent.status===200,'agent status');
    const agentSeen=seen.slice(before).map(x=>(x.messages||[]).filter(m=>m.role==='user').map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/youtube aç/i.test(agentSeen),'native agent did not receive corrected text');

    const teach=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'gugil dersem google aç anla',maxRounds:1});
    assert(teach.status===200,'teaching phrase status');
    const tj=JSON.parse(teach.body);
    assert(tj.ok===true&&tj.model==='local-speech-lexicon','teaching phrase bypass/routing');

    const afterTeach=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon')).body);
    assert(afterTeach.aliases['gugil']==='google aç','teaching phrase not persisted');

    const forget=await post('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon',{action:'forget',heard:'yutup ac'});
    assert(forget.status===200&&JSON.parse(forget.body).ok===true,'forget failed');

    const file=path.join(workspace,'.jarvis-memory','speech-lexicon.json');
    assert(fs.existsSync(file),'lexicon file missing');
    const disk=JSON.parse(fs.readFileSync(file,'utf8'));
    assert(disk.aliases&&disk.aliases.gugil==='google aç','lexicon disk persistence');

    console.log('LEXICON WORKER SELFTEST PASS');
    process.exitCode=0;
  }catch(e){
    console.error('LEXICON WORKER SELFTEST FAIL:',e.message);
    process.exitCode=1;
  }finally{
    try{if(worker)worker.kill()}catch(_){}
    try{mock.close()}catch(_){}
    try{fs.rmSync(workspace,{recursive:true,force:true})}catch(_){}
  }
})();