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
  if(req.url==='/api/tags')return json(res,200,{models:[{name:'qwen3:1.7b'}]});
  if(req.url==='/api/chat'&&req.method==='POST'){
    const body=await readJson(req);
    seen.push(body);
    const last=(body.messages||[]).filter(x=>x.role==='user').slice(-1)[0];
    const text=String(last&&last.content||'');
    const system=(body.messages||[]).filter(x=>x.role==='system').map(x=>String(x.content||'')).join('\n');
    let out;
    if(/araç veya bilgisayar eylemi az önce gerçekten çalıştırıldı/i.test(system)){
      out={reply:'Pil yüzde seksen iki. Sistem normal görünüyor.',tone:'focused'};
    } else if(/gelecekte bağlamı korumak/i.test(system)){
      out={
        summary:'Eski sohbette Mavi roket projesi ve doğal JARVIS konuşma tarzı ele alındı.',
        topics:['Mavi roket projesi','JARVIS konuşma tarzı'],
        decisions:['Sohbet doğal ve kısa kalacak'],
        preferences:['Gırgır ve samimi ton'],
        unresolved:['Mavi roket projesinin sonraki adımı']
      };
    } else if(/youtube/i.test(text)&&/ses/i.test(text))out={type:'plan',reply:'YouTube ve ses ayarını birlikte hallediyorum.',command:null,commands:['youtube aç','sesi yükselt'],tone:'focused'};
    else if(/youtube/i.test(text))out={type:'command',reply:'YouTube açılıyor.',command:'youtube aç',commands:[],tone:'focused'};
    else if(/format/i.test(text))out={type:'command',reply:'Tamam, formatlıyorum.',command:'bilgisayarı formatla',commands:[],tone:'serious'};
    else if(/az önce/i.test(text))out={type:'chat',reply:'Az önce sohbeti biraz daha eğlenceli hale getirmek istediğinizi söylediniz.',command:null,commands:[],tone:'warm'};
    else out={type:'chat',reply:'Olur. Biraz gırgır, biraz fikir; sıkıcı asistan moduna girmeden devam edelim.',command:null,commands:[],tone:'playful'};
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
        JARVIS_LOCAL_BRAIN_MODEL:'qwen3:1.7b',
        JARVIS_TOKEN:'test-token',
        JARVIS_WORKSPACE:workspace
      },
      stdio:['ignore','pipe','pipe']
    });
    await waitForBridge(worker);

    const h=await get('http://127.0.0.1:'+BRIDGE_PORT+'/health');
    assert(h.status===200,'health status');
    const hj=JSON.parse(h.body);
    assert(hj.version==='2.49.0','worker version');
    assert(hj.localBrain&&hj.localBrain.personaVersion===2,'persona v2 health');
    assert(hj.adaptiveTts&&hj.adaptiveTts.interruptible===true,'interruptible TTS health');
    assert(hj.adaptiveTts.offlineFallback==='windows-sapi','offline TTS fallback health');
    assert(hj.brainRuntime&&hj.brainRuntime.keepAlive,'brain runtime health');

    const chat=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bugün biraz sohbet edelim; böyle konuşmanı istiyorum, biraz da gırgır olsun.'});
    assert(chat.status===200,'chat status');
    const cj=JSON.parse(chat.body);
    assert(cj.ok===true&&cj.type==='chat','chat routing');
    assert(/gırgır|fikir|devam/i.test(cj.reply),'humanlike chat reply');
    assert(['playful','casual','balanced'].includes(cj.tone),'chat tone missing');

    const personaPath=path.join(workspace,'.jarvis-memory','brain-persona.json');
    assert(fs.existsSync(personaPath),'persona file missing');
    const persona=JSON.parse(fs.readFileSync(personaPath,'utf8'));
    assert(Number(persona.humor)>0.68,'persona humor did not adapt upward');
    assert(Number(persona.playfulness)>0.62,'persona playfulness did not adapt upward');

    const cmd=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:"YouTube'u açar mısın?"});
    assert(cmd.status===200,'command status');
    const cm=JSON.parse(cmd.body);
    assert(cm.type==='command'&&cm.command==='youtube aç','safe command normalization');

    const plan=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:"YouTube'u aç ve sesi yükselt."});
    assert(plan.status===200,'multi-action plan status');
    const pm=JSON.parse(plan.body);
    assert(pm.type==='plan','multi-action plan routing');
    assert(Array.isArray(pm.commands)&&pm.commands.length===2,'multi-action commands missing');
    assert(pm.commands[0]==='youtube aç'&&pm.commands[1]==='sesi yükselt','multi-action order');

    const reflected=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain-finalize',{
      message:'Pil durumu nedir?',
      results:['PC güç durumu · pil %82 · RAM 5.4 / 8 GB boş'],
      tone:'focused'
    });
    assert(reflected.status===200,'tool reflection status');
    const rfj=JSON.parse(reflected.body);
    assert(rfj.ok===true&&rfj.reflected===true,'tool reflection not used');
    assert(/yüzde seksen iki/i.test(rfj.reply),'tool reflection reply missing verified result');

    const simpleFinal=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain-finalize',{
      message:"YouTube'u aç",
      results:['youtube açıldı'],
      tone:'focused'
    });
    assert(simpleFinal.status===200,'simple tool finalizer status');
    const sfj=JSON.parse(simpleFinal.body);
    assert(sfj.ok===true&&sfj.reflected===false,'simple tool should avoid extra model latency');
    assert(/youtube açıldı/i.test(sfj.reply),'simple tool final reply');

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

    const remember=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Hatırla: En sevdiğim video tonu sinematik ve komik.'});
    assert(remember.status===200,'remember directive status');
    const rj=JSON.parse(remember.body);
    assert(rj.ok===true&&rj.model==='local-memory','remember directive routing');

    const recall=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Ne hatırlıyorsun?'});
    const recallj=JSON.parse(recall.body);
    assert(/sinematik ve komik/i.test(recallj.reply),'explicit memory recall missing');

    const forget=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Unut: En sevdiğim video tonu sinematik ve komik.'});
    const forgetj=JSON.parse(forget.body);
    assert(/hafıza kaydını çıkardım/i.test(forgetj.reply),'forget directive failed');

    const modelReq=seen.find(x=>(x.messages||[]).some(m=>m.role==='system'&&/Bu tur konuşma modu/i.test(String(m.content||''))));
    assert(!!modelReq,'dynamic conversation mode prompt missing');
    assert(modelReq.think===false,'Qwen3 think=false missing for low-latency conversation');

    const ttsState=await get('http://127.0.0.1:'+BRIDGE_PORT+'/tts-state');
    assert(ttsState.status===200,'tts-state status');
    const ts=JSON.parse(ttsState.body);
    assert(ts.ok===true&&typeof ts.active==='boolean','tts-state payload');
    assert(ts.interruptible===true&&Number.isFinite(Number(ts.generation)),'tts interrupt metadata');

    const warm=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain-warm',{});
    assert(warm.status===200,'brain warm endpoint');
    const warmj=JSON.parse(warm.body);
    assert(warmj.ok===true&&warmj.status==='ready','brain warm state');
    assert(Number(warmj.latencyMs)>=0,'brain warm latency');

    const stop=await post('http://127.0.0.1:'+BRIDGE_PORT+'/tts-stop',{reason:'selftest'});
    assert(stop.status===200,'tts-stop status');
    const stopj=JSON.parse(stop.body);
    assert(stopj.ok===true&&stopj.stopped===true,'tts-stop result');

    const speechPreview=await post('http://127.0.0.1:'+BRIDGE_PORT+'/speak',{
      text:'PC güç durumu · pil %75 · RAM 3.5 / 8 GB boş',
      tone:'serious'
    });
    assert(speechPreview.status===202,'speech preview status');
    const sp=JSON.parse(speechPreview.body);
    assert(sp.tone==='serious','expressive tone route');
    assert(/bilgisayar/i.test(sp.spokenText),'PC naturalization missing');
    assert(/yüzde\s*75/i.test(sp.spokenText),'percent naturalization missing');
    assert(/8 gigabayt/i.test(sp.spokenText),'GB naturalization missing');

    const searchDir=path.join(workspace,'projects');
    fs.mkdirSync(searchDir,{recursive:true});
    fs.writeFileSync(path.join(searchDir,'mavi-roket.md'),'# Mavi Roket\n\nBu proje yerel çalışma alanı arama testi içindir.\n','utf8');
    const search=await post('http://127.0.0.1:'+BRIDGE_PORT+'/control',{command:'dosyalarda ara mavi roket'});
    assert(search.status===200,'workspace search status');
    const sj=JSON.parse(search.body);
    assert(sj.ok===true&&/mavi-roket\.md/i.test(sj.message),'workspace search result missing');

    // Force a long local conversation and verify automatic episode compaction.
    const histDir=path.join(workspace,'.jarvis-memory');
    fs.mkdirSync(histDir,{recursive:true});
    const histFile=path.join(histDir,'brain-history.jsonl');
    const longRows=[];
    for(let i=0;i<72;i++){
      longRows.push({
        at:new Date(Date.now()-72000+i*1000).toISOString(),
        role:i%2===0?'user':'assistant',
        content:i<28
          ?('Mavi roket projesi eski konuşma satırı '+i+' doğal sohbet gırgır')
          :('Yakın konuşma satırı '+i)
      });
    }
    fs.writeFileSync(histFile,longRows.map(x=>JSON.stringify(x)).join('\n')+'\n','utf8');

    const trigger=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Sohbete devam edelim.'});
    assert(trigger.status===200,'episode trigger chat');

    let bs=null;
    for(let i=0;i<30;i++){
      const br=await get('http://127.0.0.1:'+BRIDGE_PORT+'/brain-status');
      bs=JSON.parse(br.body);
      if(Number(bs.memoryEpisodes||0)>0)break;
      await new Promise(r=>setTimeout(r,100));
    }
    assert(Number(bs&&bs.memoryEpisodes||0)>0,'episodic memory summary not created');

    const beforeSeen=seen.length;
    const oldTopic=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Mavi roket projesinden ne hatırlıyorsun?'});
    assert(oldTopic.status===200,'episodic retrieval request');
    const reqs=seen.slice(beforeSeen);
    const episodicPrompt=reqs.map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/Eski sohbet özeti:.*Mavi roket/is.test(episodicPrompt),'episodic summary was not retrieved into prompt');

    const recallSeen=seen.length;
    const recallGeneric=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Nerede kalmıştık?'});
    assert(recallGeneric.status===200,'generic context recall request');
    const recallReqs=seen.slice(recallSeen);
    const recallPrompt=recallReqs.map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/Eski sohbet özeti:.*Mavi roket/is.test(recallPrompt),'generic recall did not inject recent episode');

    const continueSeen=seen.length;
    const continueGeneric=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Devam et.'});
    assert(continueGeneric.status===200,'continue context request');
    const continueReqs=seen.slice(continueSeen);
    const continuePrompt=continueReqs.map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/Eski sohbet özeti:.*Mavi roket/is.test(continuePrompt),'devam et did not recover recent episode');

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