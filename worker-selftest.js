const http=require('http');
const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');

const OLLAMA_PORT=11445;
const BRIDGE_PORT=18765;
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-brain-test-'));
const seen=[];

function json(res,code,obj){
  res.writeHead(code,{'content-type':'application/json'});
  res.end(JSON.stringify(obj));
}
function readJson(req){
  return new Promise((resolve,reject)=>{
    let b='';
    req.on('data',x=>b+=x);
    req.on('end',()=>{try{resolve(JSON.parse(b||'{}'))}catch(e){reject(e)}});
  });
}
const mock=http.createServer(async(req,res)=>{
  if(req.url==='/api/tags')return json(res,200,{models:[{name:'qwen2.5:1.5b'}]});
  if(req.url==='/api/chat'&&req.method==='POST'){
    const body=await readJson(req);
    seen.push(body);
    const last=(body.messages||[]).filter(x=>x.role==='user').slice(-1)[0];
    const text=String(last&&last.content||'');
    let out;
    if(/youtube/i.test(text))out={type:'command',reply:'YouTube açılıyor.',command:'youtube aç'};
    else if(/format/i.test(text))out={type:'command',reply:'Tamam, formatlıyorum.',command:'bilgisayarı formatla'};
    else if(/az önce/i.test(text))out={type:'chat',reply:'Az önce sohbeti biraz daha eğlenceli hale getirmek istediğinizi söylediniz.',command:null};
    else out={type:'chat',reply:'Olur. Biraz gırgır, biraz fikir; sıkıcı asistan moduna girmeden devam edelim.',command:null};
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
    const u=new URL(url),body=JSON.stringify(obj);
    const req=http.request({hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},r=>{
      let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}));
    });
    req.on('error',reject);req.end(body);
  });
}
function waitForBridge(child,timeout=10000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('bridge timeout')),timeout);
    const onData=d=>{
      const s=String(d);
      process.stdout.write(s);
      if(s.includes('LOCAL TTS BRIDGE READY')){clearTimeout(timer);resolve()}
    };
    child.stdout.on('data',onData);
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
        JARVIS_LOCAL_BRAIN_MODEL:'qwen2.5:1.5b',
        JARVIS_TOKEN:'test-token',
        JARVIS_WORKSPACE:workspace
      },
      stdio:['ignore','pipe','pipe']
    });
    await waitForBridge(worker);

    const h=await get('http://127.0.0.1:'+BRIDGE_PORT+'/health');
    assert(h.status===200,'health status');
    const hj=JSON.parse(h.body);
    assert(hj.version==='2.40.0','worker version');
    assert(hj.localBrain&&hj.localBrain.personaVersion===2,'persona v2 health');

    const chat=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bugün biraz sohbet edelim; böyle konuşmanı istiyorum, biraz da gırgır olsun.'});
    assert(chat.status===200,'chat status');
    const cj=JSON.parse(chat.body);
    assert(cj.ok===true&&cj.type==='chat','chat routing');
    assert(/gırgır|fikir|devam/i.test(cj.reply),'humanlike chat reply');

    const cmd=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:"YouTube'u açar mısın?"});
    assert(cmd.status===200,'command status');
    const cm=JSON.parse(cmd.body);
    assert(cm.type==='command'&&cm.command==='youtube aç','safe command normalization');

    const blocked=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bilgisayarı formatla.'});
    assert(blocked.status===200,'blocked status');
    const bj=JSON.parse(blocked.body);
    assert(bj.type==='chat'&&bj.command===null,'unsafe command must be blocked');

    const follow=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Az önce ne söyledim?'});
    assert(follow.status===200,'follow-up status');
    const fj=JSON.parse(follow.body);
    assert(fj.type==='chat','follow-up chat');
    const finalReq=seen[seen.length-1]||{};
    const msgText=(finalReq.messages||[]).map(x=>x.content).join('\n');
    assert(/Bugün biraz sohbet edelim/i.test(msgText),'recent conversation context missing');

    const facts=path.join(workspace,'.jarvis-memory','brain-facts.jsonl');
    assert(fs.existsSync(facts),'explicit preference memory file missing');

    console.log('WORKER BRAIN SELFTEST PASS');
    process.exitCode=0;
  }catch(e){
    console.error('WORKER BRAIN SELFTEST FAIL:',e.message);
    process.exitCode=1;
  }finally{
    try{if(worker)worker.kill()}catch(_){}
    try{mock.close()}catch(_){}
    try{fs.rmSync(workspace,{recursive:true,force:true})}catch(_){}
  }
})();