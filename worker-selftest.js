const http=require('http');
const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');

const OLLAMA_PORT=11445;
const BRIDGE_PORT=18765;
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-brain-test-'));
const seen=[];
let cancelUpstreamClosed=false;
let streamUpstreamClosed=false;

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
  if(req.url==='/api/tags')return json(res,200,{models:[{name:'qwen3.5:2b'},{name:'qwen3.5:4b'}]});
  if(req.url==='/api/chat'&&req.method==='POST'){
    const body=await readJson(req);
    seen.push(body);
    if(body.stream===true){
      const streamLast=(body.messages||[]).filter(x=>x.role==='user').slice(-1)[0];
      const streamText=String(streamLast&&streamLast.content||'');
      res.writeHead(200,{'content-type':'application/x-ndjson'});
      if(/kesinti devam testi/i.test(streamText)){
        res.on('close',()=>{streamUpstreamClosed=true});
        res.write(JSON.stringify({message:{role:'assistant',content:'İlk kısmı söylüyorum. '},done:false})+'\n');
        await new Promise(r=>setTimeout(r,1200));
        if(res.destroyed||res.writableEnded)return;
        res.end(JSON.stringify({message:{role:'assistant',content:'İkinci kısım burada.'},done:true})+'\n');
        return;
      }
      const deltas=['Olur. ','Biraz gırgır, ','biraz fikir; akıcı devam ederiz.'];
      for(const delta of deltas){
        res.write(JSON.stringify({message:{role:'assistant',content:delta},done:false})+'\n');
      }
      res.end(JSON.stringify({message:{role:'assistant',content:''},done:true})+'\n');
      return;
    }
    const last=(body.messages||[]).filter(x=>x.role==='user').slice(-1)[0];
    const text=String(last&&last.content||'');
    const system=(body.messages||[]).filter(x=>x.role==='system').map(x=>String(x.content||'')).join('\n');
    const toolMessages=(body.messages||[]).filter(x=>x.role==='tool');
    if(body.stream===true){
      res.writeHead(200,{'content-type':'application/x-ndjson'});
      res.write(JSON.stringify({message:{role:'assistant',content:'Olur. '},done:false})+'\n');
      res.write(JSON.stringify({message:{role:'assistant',content:'Biraz gırgır, biraz fikir; '},done:false})+'\n');
      res.end(JSON.stringify({message:{role:'assistant',content:'bugün gayet iyi gidiyor.'},done:true})+'\n');
      return;
    }
    if(Array.isArray(body.tools)&&body.tools.length){
      if(/iptal ajan testi/i.test(text)&&toolMessages.length===0){
        res.on('close',()=>{cancelUpstreamClosed=true});
        await new Promise(r=>setTimeout(r,1200));
        if(res.destroyed||res.writableEnded)return;
        return json(res,200,{message:{role:'assistant',content:'',tool_calls:[{function:{name:'open_target',arguments:{target:'youtube'}}}]}});
      }
      if(/arka planda ne var/i.test(text)&&toolMessages.length===0){
        return json(res,200,{message:{role:'assistant',content:'',tool_calls:[{function:{name:'screen_describe',arguments:{question:'Ekranda ne görüyorsun?'}}}]}});
      }
      if(/gizli env/i.test(text)&&toolMessages.length===0){
        return json(res,200,{message:{role:'assistant',content:'',tool_calls:[{function:{name:'workspace_read',arguments:{path:'.env'}}}]}});
      }
      if(/mavi roket/i.test(text)){
        if(toolMessages.length===0){
          return json(res,200,{message:{role:'assistant',content:'',tool_calls:[{function:{name:'workspace_search',arguments:{query:'mavi roket'}}}]}});
        }
        if(toolMessages.length===1){
          return json(res,200,{message:{role:'assistant',content:'',tool_calls:[{function:{name:'workspace_read',arguments:{path:'projects/mavi-roket.md'}}}]}});
        }
        return json(res,200,{message:{role:'assistant',content:'Mavi roket dosyasını buldum ve içeriğini okudum.'}});
      }
      if(toolMessages.length){
        return json(res,200,{message:{role:'assistant',content:'Yerel araç sonucunu aldım ve işlemi tamamladım.'}});
      }
      return json(res,200,{message:{role:'assistant',content:'Bu turda araca gerek yok; doğrudan cevap veriyorum.'}});
    }
    let out;
    if(last&&Array.isArray(last.images)&&last.images.length){
      out={reply:'Görüntüde kırmızı bir kare görüyorum.',tone:'focused',observations:['kırmızı kare','sade arka plan']};
    } else if(/JARVIS yanıt kalite denetleyicisisin/i.test(system)){
      out={reply:'VAROVA için yerel proje notuna dayanarak odak noktası müşteri dönüşümü ve net ürün anlatımı olmalı.',tone:'work'};
    } else if(/araç veya bilgisayar eylemi az önce gerçekten çalıştırıldı/i.test(system)){
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
function postAndAbort(url,obj,delay=100){
  return new Promise((resolve)=>{
    const u=new URL(url),body=JSON.stringify(obj||{});
    const req=http.request({
      hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',
      headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}
    },r=>{
      r.resume();
      r.on('end',()=>resolve(false));
    });
    let done=false;
    const finish=v=>{if(done)return;done=true;resolve(v)};
    req.on('error',()=>finish(true));
    req.end(body);
    setTimeout(()=>{
      try{req.destroy(new Error('intentional-client-abort'))}catch(_){}
      finish(true);
    },delay);
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
        JARVIS_LOCAL_BRAIN_MODEL:'qwen3.5:2b',
        JARVIS_LOCAL_BRAIN_DEEP_MODEL:'qwen3.5:4b',
        JARVIS_TOKEN:'test-token',
        JARVIS_WORKSPACE:workspace
      },
      stdio:['ignore','pipe','pipe']
    });
    await waitForBridge(worker);

    const h=await get('http://127.0.0.1:'+BRIDGE_PORT+'/health');
    assert(h.status===200,'health status');
    const hj=JSON.parse(h.body);
    assert(hj.version==='2.73.0','worker version');
    assert(hj.localBrain&&hj.localBrain.personaVersion===2,'persona v2 health');
    assert(hj.localStt&&hj.localStt.adaptiveDecode===true,'adaptive STT decode health');
    assert(hj.localStt&&hj.localStt.dynamicEndpointing===true,'dynamic STT endpointing health');
    assert(hj.localBrain.vision===true,'local multimodal health');
    assert(hj.brainRuntime&&hj.brainRuntime.nativeTools===true,'native tools health');
    assert(hj.brainRuntime.selectiveReasoning===true,'selective reasoning health');
    assert(hj.brainRuntime.streamingChat===true,'streaming chat health');
    assert(hj.brainRuntime.fullDuplexInterrupt===true,'full duplex interrupt health');
    assert(hj.brainRuntime.cancellableAgent===true,'cancellable native agent health');
    assert(hj.capabilities.includes('full_duplex_interrupt_v1'),'full duplex interrupt capability');
    assert(hj.capabilities.includes('cancellable_agent_v1'),'cancellable agent capability');
    assert(Array.isArray(hj.capabilities)&&hj.capabilities.includes('natural_barge_in_v1'),'natural barge-in capability health');
    assert(hj.capabilities.includes('spoken_followup_interrupt_v1'),'spoken follow-up interrupt capability health');
    assert(hj.capabilities.includes('conversation_repair_v1'),'conversation repair capability health');
    assert(hj.capabilities.includes('misunderstanding_recovery_v1'),'misunderstanding recovery capability health');
    assert(hj.brainRuntime.conversationRepair===true,'conversation repair runtime health');
    assert(hj.brainRuntime.socialDialogue===true,'social dialogue runtime health');
    assert(hj.brainRuntime.responseVariation===true,'response variation runtime health');
    assert(hj.brainRuntime.contextualFollowup===true,'contextual follow-up runtime health');
    assert(hj.brainRuntime.dialogueFeedbackLearning===true,'dialogue feedback learning health');
    assert(hj.brainRuntime.socialPreferenceAdaptation===true,'social preference adaptation health');
    assert(hj.brainRuntime.socialMomentum===true,'social momentum runtime health');
    assert(hj.brainRuntime.ellipticalTurnResolution===true,'elliptical turn resolution health');
    assert(hj.brainRuntime.conversationCadence===true,'conversation cadence runtime health');
    assert(hj.brainRuntime.brevityMirroring===true,'brevity mirroring runtime health');
    assert(hj.brainRuntime.adaptiveResponseLength===true,'adaptive response length health');
    assert(hj.brainRuntime.interruptionContinuity===true,'interruption continuity runtime health');
    assert(hj.brainRuntime.spokenResume===true,'spoken resume runtime health');
    assert(hj.brainRuntime.partialStreamResume===true,'partial stream resume runtime health');
    assert(hj.capabilities.includes('interruption_continuity_v1'),'interruption continuity capability');
    assert(hj.capabilities.includes('spoken_resume_v1'),'spoken resume capability');
    assert(hj.capabilities.includes('partial_stream_resume_v1'),'partial stream resume capability');
    assert(hj.capabilities.includes('conversation_cadence_v1'),'conversation cadence capability');
    assert(hj.capabilities.includes('brevity_mirroring_v1'),'brevity mirroring capability');
    assert(hj.capabilities.includes('adaptive_response_length_v1'),'adaptive response length capability');
    assert(hj.capabilities.includes('social_momentum_v1'),'social momentum capability');
    assert(hj.capabilities.includes('elliptical_turn_resolution_v1'),'elliptical turn capability');
    assert(hj.brainRuntime.autoQualityEscalation===true,'auto quality escalation health');
    assert(hj.brainRuntime.weakResponseEscalation===true,'weak response escalation health');
    assert(hj.brainRuntime.repairQualityEscalation===true,'repair quality escalation health');
    assert(hj.capabilities.includes('auto_quality_escalation_v1'),'auto quality escalation capability');
    assert(hj.capabilities.includes('weak_response_escalation_v1'),'weak response escalation capability');
    assert(hj.capabilities.includes('repair_quality_escalation_v1'),'repair quality escalation capability');
    assert(hj.capabilities.includes('dialogue_feedback_learning_v1'),'dialogue feedback capability');
    assert(hj.capabilities.includes('social_preference_adaptation_v1'),'social preference adaptation capability');
    assert(hj.capabilities.includes('social_dialogue_v1'),'social dialogue capability');
    assert(hj.capabilities.includes('response_variation_v1'),'response variation capability');
    assert(hj.capabilities.includes('contextual_followup_v1'),'contextual follow-up capability');
    assert(hj.brainRuntime.adaptiveModelRouter===true,'adaptive model router health');
    assert(hj.brainRuntime.adaptiveTurnPacing===true,'adaptive turn pacing health');
    assert(hj.capabilities.includes('adaptive_turn_pacing_v1'),'adaptive turn pacing capability');
    assert(hj.capabilities.includes('latency_learning_v1'),'latency learning capability');
    assert(hj.brainRuntime.fastModel==='qwen3.5:2b','fast model health');
    assert(hj.brainRuntime.deepModel==='qwen3.5:4b','deep model health');
    assert(hj.capabilities.includes('adaptive_model_router_v1'),'adaptive model router capability');
    assert(hj.capabilities.includes('deep_model_fallback_v1'),'deep model fallback capability');
    assert(hj.brainRuntime.sentenceStreamTts===true,'sentence stream TTS health');
    assert(Number(hj.brainRuntime.context)>=4096,'adaptive context health');
    assert(hj.brainRuntime.screenVisionExplicitOnly===true,'screen vision consent health');
    assert(hj.brainRuntime.screenVision===false,'CI must not claim Windows screen capture');
    assert(hj.adaptiveTts&&hj.adaptiveTts.interruptible===true,'interruptible TTS health');
    assert(hj.adaptiveTts.adaptiveVoicePreferences===true,'adaptive voice preference health');
    assert(hj.adaptiveTts.speakerEchoRejection===true,'speaker echo rejection health');
    assert(hj.capabilities.includes('speaker_echo_rejection_v1'),'speaker echo rejection capability');
    assert(hj.adaptiveTts.voicePreferences&&Number(hj.adaptiveTts.voicePreferences.rateOffset)===0,'default voice preference health');
    assert(hj.adaptiveTts.chunkedPipeline===true,'chunked TTS pipeline health');
    assert(hj.adaptiveTts.prefetch===true,'TTS prefetch health');
    assert(hj.adaptiveTts.safeCache===true,'safe TTS cache health');
    assert(hj.adaptiveTts.dynamicChunkProsody===true,'dynamic chunk prosody health');
    assert(hj.adaptiveTts.naturalPauseTiming===true,'natural pause timing health');
    assert(hj.capabilities.includes('dynamic_chunk_prosody_v1'),'dynamic prosody capability');
    assert(hj.capabilities.includes('natural_pause_timing_v1'),'natural pause timing capability');
    assert(hj.adaptiveTts.backchannelPrewarm===true,'thinking backchannel prewarm health');
    assert(hj.adaptiveTts.backchannelState&&Number(hj.adaptiveTts.backchannelState.total)>=4,'backchannel prewarm state metadata');
    assert(hj.adaptiveTts.wakeAckPrewarm===true,'wake acknowledgement prewarm health');
    assert(Number(hj.adaptiveTts.wakeAckVariants)>=4,'wake acknowledgement variants health');
    assert(hj.capabilities.includes('dynamic_wake_ack_v1'),'dynamic wake acknowledgement capability');
    assert(hj.capabilities.includes('wake_ack_turn_timing_v1'),'wake acknowledgement turn timing capability');
    assert(hj.adaptiveTts.offlineFallback==='windows-sapi','offline TTS fallback health');
    assert(hj.brainRuntime&&hj.brainRuntime.keepAlive,'brain runtime health');

    const feedback=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Çok soru soruyorsun, biraz azalt.'});
    assert(feedback.status===200,'dialogue feedback directive status');
    const feedbackj=JSON.parse(feedback.body);
    assert(feedbackj.ok===true&&feedbackj.model==='local-dialogue-feedback','dialogue feedback routing');
    assert(feedbackj.preferences&&Number(feedbackj.preferences.followupBias)<0,'dialogue feedback bias not learned');

    const feedbackState=await get('http://127.0.0.1:'+BRIDGE_PORT+'/dialogue-feedback');
    assert(feedbackState.status===200,'dialogue feedback state endpoint');
    const dfs=JSON.parse(feedbackState.body);
    assert(dfs.ok===true&&Number(dfs.followupBias)<0,'dialogue feedback state did not persist');

    const afterFeedbackSeen=seen.length;
    const afterFeedback=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Naber Jarvis, bugün nasıl gidiyor?'});
    assert(afterFeedback.status===200,'dialogue feedback reuse status');
    const afj=JSON.parse(afterFeedback.body);
    assert(afj.type==='chat'&&afj.followupAllowed===false,'learned follow-up preference was not reused');
    const afReqs=seen.slice(afterFeedbackSeen);
    const afPrompt=afReqs.map(x=>(x.messages||[]).filter(m=>m.role==='system').map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/ÖĞRENİLMİŞ SOHBET TERCİHLERİ/i.test(afPrompt),'learned dialogue preference prompt missing');

    const feedbackRestore=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bana daha çok soru sor.'});
    assert(feedbackRestore.status===200,'dialogue feedback restore status');
    const restorej=JSON.parse(feedbackRestore.body);
    assert(restorej.ok===true&&restorej.model==='local-dialogue-feedback','dialogue feedback restore routing');
    const restoredState=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/dialogue-feedback')).body);
    assert(Number(restoredState.followupBias)>-0.20,'dialogue feedback restore bias');

    const prosody=await post('http://127.0.0.1:'+BRIDGE_PORT+'/prosody-preview',{
      text:'Tamam. Gerçekten mi? Dikkat, hata var.',
      tone:'balanced'
    });
    assert(prosody.status===200,'prosody preview status');
    const pp=JSON.parse(prosody.body);
    assert(pp.ok===true&&Array.isArray(pp.chunks)&&pp.chunks.length===3,'Turkish sentence prosody chunking');
    assert(pp.chunks[0].pauseMs>0&&pp.chunks[1].pauseMs>0&&pp.chunks[2].pauseMs===0,'natural inter-sentence pause timing');
    assert(pp.chunks[1].profile.pitch!==pp.chunks[0].profile.pitch,'question prosody did not move pitch');
    assert(pp.chunks[2].profile.rate!==pp.chunks[0].profile.rate,'caution prosody did not move rate');

    const streamSeen=seen.length;
    const streamed=await post('http://127.0.0.1:'+BRIDGE_PORT+'/chat-stream',{message:'Naber Jarvis, bugün nasıl gidiyor?'});
    assert(streamed.status===200,'streaming chat status');
    const streamEvents=streamed.body.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
    assert(streamEvents[0]&&streamEvents[0].type==='meta'&&streamEvents[0].streaming===true,'streaming chat meta');
    assert(streamEvents[0].socialMode==='casual','streaming social mode');
    assert(streamEvents[0].followupAllowed===true,'streaming contextual follow-up metadata');
    const deltas=streamEvents.filter(x=>x.type==='delta').map(x=>String(x.text||''));
    assert(deltas.length>=2,'streaming chat deltas missing');
    const doneEvent=streamEvents.find(x=>x.type==='done');
    assert(doneEvent&&doneEvent.ok===true&&/gırgır|fikir/i.test(doneEvent.reply),'streaming chat done payload');
    assert(doneEvent.socialMode==='casual'&&doneEvent.followupAllowed===true,'streaming social completion metadata');
    const streamReq=seen.slice(streamSeen).find(x=>x.stream===true);
    assert(streamReq&&streamReq.think===false,'streaming Ollama request mode');
    assert(!Array.isArray(streamReq.tools),'streaming chat must not expose PC tools');

    const noStreamAction=await post('http://127.0.0.1:'+BRIDGE_PORT+'/chat-stream',{message:"YouTube'u açar mısın?"});
    assert(noStreamAction.status===409,'PC action must be rejected by chat streaming');

    const initialInterruptState=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/interruption-state')).body);
    assert(initialInterruptState.ok===true&&initialInterruptState.available===false,'initial interruption state');

    streamUpstreamClosed=false;
    const streamAborted=await postAndAbort('http://127.0.0.1:'+BRIDGE_PORT+'/chat-stream',{message:'kesinti devam testi'},140);
    assert(streamAborted===true,'stream client abort helper did not abort');
    for(let i=0;i<30&&!streamUpstreamClosed;i++)await new Promise(r=>setTimeout(r,50));
    assert(streamUpstreamClosed===true,'stream abort did not cancel upstream Ollama request');
    let interruptState=null;
    for(let i=0;i<30;i++){
      interruptState=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/interruption-state')).body);
      if(interruptState.available)break;
      await new Promise(r=>setTimeout(r,50));
    }
    assert(interruptState&&interruptState.available===true&&interruptState.kind==='stream','interrupted stream state not captured');
    assert(Number(interruptState.partialChars)>0,'interrupted stream partial text missing');

    const resumeSeen=seen.length;
    const resumed=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'devam et'});
    assert(resumed.status===200,'interrupted conversation resume status');
    const resumedJ=JSON.parse(resumed.body);
    assert(resumedJ.ok===true&&resumedJ.resumed===true&&resumedJ.resumeSource==='stream','interrupted stream did not resume');
    const resumePrompt=seen.slice(resumeSeen).map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/KESİLEN KONUŞMA DEVAMI/i.test(resumePrompt),'interrupted stream resume context missing');
    assert(/İlk kısmı söylüyorum/i.test(resumePrompt),'interrupted partial answer missing from resume prompt');
    const clearedInterruptState=JSON.parse((await get('http://127.0.0.1:'+BRIDGE_PORT+'/interruption-state')).body);
    assert(clearedInterruptState.available===false,'interruption state not cleared after resume');

    const clientAborted=await postAndAbort('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'iptal ajan testi',maxRounds:4},120);
    assert(clientAborted===true,'client abort helper did not abort');
    for(let i=0;i<20&&!cancelUpstreamClosed;i++)await new Promise(r=>setTimeout(r,50));
    assert(cancelUpstreamClosed===true,'native agent abort did not cancel upstream Ollama request');
    const afterCancelHealth=await get('http://127.0.0.1:'+BRIDGE_PORT+'/health');
    assert(afterCancelHealth.status===200,'worker unhealthy after native agent cancellation');

    const voiceFast=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Biraz daha hızlı konuş.'});
    assert(voiceFast.status===200,'spoken voice speed preference status');
    const voiceFastJ=JSON.parse(voiceFast.body);
    assert(voiceFastJ.ok===true&&voiceFastJ.model==='local-voice-preference','spoken voice speed preference routing');
    assert(Number(voiceFastJ.voicePreferences&&voiceFastJ.voicePreferences.rateOffset)===2,'spoken voice speed preference value');

    const voiceState=await get('http://127.0.0.1:'+BRIDGE_PORT+'/voice-preferences');
    assert(voiceState.status===200,'voice preference state status');
    const voiceStateJ=JSON.parse(voiceState.body);
    assert(voiceStateJ.ok===true&&Number(voiceStateJ.rateOffset)===2,'voice preference persistence');

    const voicePreview=await post('http://127.0.0.1:'+BRIDGE_PORT+'/prosody-preview',{text:'Tamam. Devam ediyorum.',tone:'balanced'});
    assert(voicePreview.status===200,'adaptive voice prosody preview status');
    const voicePreviewJ=JSON.parse(voicePreview.body);
    assert(Array.isArray(voicePreviewJ.chunks)&&voicePreviewJ.chunks.length>=2,'adaptive voice prosody chunks');
    assert(String(voicePreviewJ.chunks[0].profile.rate)!=='-18%','voice rate preference not applied to prosody');

    const voiceReset=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Konuşma ayarlarını sıfırla.',maxRounds:1});
    assert(voiceReset.status===200,'voice preference reset status');
    const voiceResetJ=JSON.parse(voiceReset.body);
    assert(voiceResetJ.ok===true&&voiceResetJ.model==='local-voice-preference','voice preference reset routing');
    assert(Number(voiceResetJ.voicePreferences&&voiceResetJ.voicePreferences.rateOffset)===0,'voice preference reset rate');
    const voicePrefsFile=path.join(workspace,'.jarvis-memory','voice-preferences.json');
    assert(fs.existsSync(voicePrefsFile),'voice preference file missing');

    const agentDir=path.join(workspace,'projects');
    fs.mkdirSync(agentDir,{recursive:true});
    fs.writeFileSync(path.join(agentDir,'mavi-roket.md'),'# Mavi Roket\n\nYerel ajan zincir testi için doğrulanmış içerik.','utf8');
    fs.writeFileSync(path.join(workspace,'.env'),'SUPER_SECRET=never-read','utf8');

    const agent=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Mavi roket dosyasını bul ve oku.',maxRounds:4});
    assert(agent.status===200,'native agent status');
    const aj=JSON.parse(agent.body);
    assert(aj.ok===true&&aj.nativeTools===true,'native agent routing');
    assert(Array.isArray(aj.actions)&&aj.actions.length===2,'adaptive tool chain length');
    assert(aj.actions[0].tool==='workspace_search'&&aj.actions[1].tool==='workspace_read','adaptive tool chain order');
    assert(aj.actions.every(x=>x.ok===true),'adaptive tool chain result');
    assert(/Mavi roket dosyasını buldum/i.test(aj.reply),'native agent final reply');

    const deepAgentSeen=seen.length;
    const deepAgent=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Mavi roket dosyasını kapsamlı analiz et.',maxRounds:4});
    assert(deepAgent.status===200,'deep native agent status');
    const daj=JSON.parse(deepAgent.body);
    assert(daj.ok===true&&daj.reasoning==='deep','deep native agent reasoning mode');
    assert(daj.model==='qwen3.5:4b','deep native agent did not use stronger model');
    const deepAgentReqs=seen.slice(deepAgentSeen).filter(x=>Array.isArray(x.tools));
    assert(deepAgentReqs.length>=1&&deepAgentReqs.every(x=>x.model==='qwen3.5:4b'),'deep native tool loop mixed model tiers');
    assert(deepAgentReqs.some(x=>x.think===true),'deep native tool loop did not enable thinking');

    const secret=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Gizli env dosyasını oku.',maxRounds:2});
    assert(secret.status===200,'native secret guard status');
    const sg=JSON.parse(secret.body);
    assert(Array.isArray(sg.actions)&&sg.actions.length>=1,'native secret guard action');
    assert(sg.actions[0].tool==='workspace_read'&&sg.actions[0].ok===false,'native secret read must be blocked');
    assert(/Hassas dosya erişimi engellendi/i.test(sg.actions[0].result),'native secret guard result');

    const unauthorizedScreen=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Arka planda ne var?',maxRounds:2});
    assert(unauthorizedScreen.status===200,'screen consent agent status');
    const usj=JSON.parse(unauthorizedScreen.body);
    assert(Array.isArray(usj.actions)&&usj.actions.length>=1,'screen consent action missing');
    assert(usj.actions[0].tool==='screen_describe'&&usj.actions[0].ok===false,'screen capture without explicit request must be blocked');
    assert(/yalnızca açık kullanıcı isteğiyle/i.test(usj.actions[0].result),'screen consent guard message');

    const screenDirect=await post('http://127.0.0.1:'+BRIDGE_PORT+'/screen-vision',{question:'Ekranda ne görüyorsun?'});
    assert(screenDirect.status===501,'screen vision must report WINDOWS_ONLY in CI');
    const sdj=JSON.parse(screenDirect.body);
    assert(sdj.ok===false&&sdj.error==='WINDOWS_ONLY','screen vision CI platform guard');

    const vision=await post('http://127.0.0.1:'+BRIDGE_PORT+'/vision',{
      image:'aGVsbG8=',
      question:'Bu görüntüde ne görüyorsun?'
    });
    assert(vision.status===200,'local vision status');
    const vj=JSON.parse(vision.body);
    assert(vj.ok===true&&vj.localOnly===true,'local vision routing');
    assert(/kırmızı bir kare/i.test(vj.reply),'local vision reply');
    assert(vj.model==='qwen3.5:2b','local vision model');

    const chat=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bugün biraz sohbet edelim; böyle konuşmanı istiyorum, biraz da gırgır olsun.'});
    assert(chat.status===200,'chat status');
    const cj=JSON.parse(chat.body);
    assert(cj.ok===true&&cj.type==='chat','chat routing');
    assert(/gırgır|fikir|devam/i.test(cj.reply),'humanlike chat reply');
    assert(['playful','casual','balanced'].includes(cj.tone),'chat tone missing');

    const socialSeen=seen.length;
    const social=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bak ne oldu, bugün başıma komik bir şey geldi.'});
    assert(social.status===200,'social dialogue status');
    const socialj=JSON.parse(social.body);
    assert(socialj.ok===true&&socialj.type==='chat','social dialogue routing');
    assert(socialj.socialMode==='banter'||socialj.socialMode==='story','social dialogue mode');
    assert(socialj.followupAllowed===true,'social follow-up policy');
    const socialReqs=seen.slice(socialSeen);
    const socialPrompt=socialReqs.map(x=>(x.messages||[]).filter(m=>m.role==='system').map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/SOSYAL DİYALOG MODU/i.test(socialPrompt),'social dialogue prompt missing');
    assert(/en fazla bir kısa takip sorusu/i.test(socialPrompt),'bounded social follow-up rule missing');
    assert(/Son JARVIS açılışlarını tekrar etme/i.test(socialPrompt),'response variation opener memory missing');

    const momentumSeen=seen.length;
    const momentum=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Aynen, devam et.'});
    assert(momentum.status===200,'social momentum status');
    const momentumJ=JSON.parse(momentum.body);
    assert(momentumJ.ok===true&&momentumJ.socialMomentum===true,'social momentum was not carried');
    assert(['banter','story'].includes(momentumJ.momentumMode),'unexpected social momentum mode');
    assert(momentumJ.socialMode===momentumJ.momentumMode,'social mode did not follow carried momentum');
    const momentumPrompt=seen.slice(momentumSeen).map(x=>(x.messages||[]).filter(m=>m.role==='system').map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/SOSYAL MOMENTUM/i.test(momentumPrompt),'social momentum prompt missing');

    const resetMomentum=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Neyse, başka konu.'});
    assert(resetMomentum.status===200,'social momentum reset status');
    const resetMomentumJ=JSON.parse(resetMomentum.body);
    assert(resetMomentumJ.socialMomentum!==true,'social momentum ignored explicit topic reset');

    const compactSeen=seen.length;
    const compactCadence=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Kısa cevap ver: bugün nasılsın?'});
    assert(compactCadence.status===200,'compact cadence status');
    const compactJ=JSON.parse(compactCadence.body);
    assert(compactJ.ok===true&&compactJ.cadenceMode==='compact','compact cadence mode');
    assert(Number(compactJ.targetWords)>0&&Number(compactJ.targetWords)<=50,'compact cadence target');
    const compactReq=seen.slice(compactSeen).find(x=>!x.stream&&x.format);
    assert(compactReq&&Number(compactReq.options&&compactReq.options.num_predict)===190,'compact cadence prediction budget');

    const detailedSeen=seen.length;
    const detailedCadence=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Detaylı anlat: iyi bir yapay zeka asistanı insan gibi nasıl konuşmalı?'});
    assert(detailedCadence.status===200,'detailed cadence status');
    const detailedJ=JSON.parse(detailedCadence.body);
    assert(detailedJ.ok===true&&detailedJ.cadenceMode==='detailed','detailed cadence mode');
    assert(Number(detailedJ.targetWords)>=120,'detailed cadence target');
    const detailedReq=seen.slice(detailedSeen).find(x=>!x.stream&&x.format);
    assert(detailedReq&&Number(detailedReq.options&&detailedReq.options.num_predict)===380,'detailed cadence prediction budget');

    const repairSeed=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bana sade bir uygulama fikri ver.'});
    assert(repairSeed.status===200,'repair seed status');
    const repairSeen=seen.length;
    const repair=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Hayır, beni yanlış anladın; komik bir uygulama fikri istemiştim.'});
    assert(repair.status===200,'conversation repair status');
    const repairj=JSON.parse(repair.body);
    assert(repairj.ok===true&&repairj.type==='chat'&&repairj.repairMode===true,'conversation repair mode missing');
    assert(repairj.qualityEscalated===true,'repair quality escalation missing');
    assert(repairj.qualityEscalationReason==='conversation-repair','repair quality escalation reason');
    assert(repairj.qualityEscalationModel==='qwen3.5:4b','repair quality escalation model');
    const repairReqs=seen.slice(repairSeen);
    assert(repairReqs.some(x=>x.model==='qwen3.5:4b'&&x.think===false),'repair was not escalated to stronger local model');
    const repairPrompt=repairReqs.map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/KONUŞMA ONARIM MODU/i.test(repairPrompt),'conversation repair system prompt missing');
    assert(/Bana sade bir uygulama fikri ver/i.test(repairPrompt),'previous user turn missing from repair context');
    assert(/komik bir uygulama fikri/i.test(repairPrompt),'current correction missing from repair context');

    const nativeRepairSeen=seen.length;
    const nativeRepair=await post('http://127.0.0.1:'+BRIDGE_PORT+'/agent',{message:'Hayır, beni yanlış anladın; daha komik olsun.',maxRounds:1});
    assert(nativeRepair.status===200,'native repair status');
    const nativeRepairJ=JSON.parse(nativeRepair.body);
    assert(nativeRepairJ.ok===true&&nativeRepairJ.repairMode===true,'native repair metadata missing');
    const nativeRepairPrompt=seen.slice(nativeRepairSeen).map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(/KONUŞMA ONARIM MODU/i.test(nativeRepairPrompt),'native agent repair prompt missing');

    const streamRepairSeed=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bana ciddi bir slogan fikri ver.'});
    assert(streamRepairSeed.status===200,'stream repair seed status');
    const streamRepairSeen=seen.length;
    const streamRepair=await post('http://127.0.0.1:'+BRIDGE_PORT+'/chat-stream',{message:'Hayır, beni yanlış anladın; komik slogan istemiştim.'});
    assert(streamRepair.status===200,'stream repair status');
    const streamRepairEvents=streamRepair.body.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
    const streamRepairMeta=streamRepairEvents.find(x=>x.type==='meta');
    const streamRepairDone=streamRepairEvents.find(x=>x.type==='done');
    assert(streamRepairMeta&&streamRepairMeta.repairMode===true,'stream repair meta missing');
    assert(streamRepairDone&&streamRepairDone.repairMode===true,'stream repair done metadata missing');
    const streamRepairReq=seen.slice(streamRepairSeen).find(x=>x.stream===true);
    const streamRepairPrompt=(streamRepairReq.messages||[]).map(m=>String(m.content||'')).join('\n');
    assert(/KONUŞMA ONARIM MODU/i.test(streamRepairPrompt),'stream repair prompt missing');
    assert(/Bana ciddi bir slogan fikri ver/i.test(streamRepairPrompt),'stream repair previous turn missing');

    const personaPath=path.join(workspace,'.jarvis-memory','brain-persona.json');
    assert(fs.existsSync(personaPath),'persona file missing');
    const persona=JSON.parse(fs.readFileSync(personaPath,'utf8'));
    assert(Number(persona.humor)>0.68,'persona humor did not adapt upward');
    assert(Number(persona.playfulness)>0.62,'persona playfulness did not adapt upward');

    const projectDir=path.join(workspace,'projects','varova');
    fs.mkdirSync(projectDir,{recursive:true});
    fs.writeFileSync(path.join(projectDir,'strategy.md'),'VAROVA safir anka 4821. Odak: müşteri dönüşümü, net ürün anlatımı ve V-GAP demo akışı.','utf8');
    fs.writeFileSync(path.join(projectDir,'credentials.json'),'api_key=SHOULD_NOT_ENTER_RAG safir anka 4821','utf8');

    const ragSeen=seen.length;
    const rag=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'VAROVA projesindeki safir anka 4821 notunu kapsamlı analiz et.'});
    assert(rag.status===200,'local RAG status');
    const ragj=JSON.parse(rag.body);
    assert(ragj.ok===true&&ragj.type==='chat','local RAG chat');
    assert(ragj.deepReflected===true,'deep reflection not activated');
    assert(Array.isArray(ragj.workspaceSources)&&ragj.workspaceSources.some(x=>/strategy\.md/i.test(x)),'workspace source missing');
    assert(!ragj.workspaceSources.some(x=>/credentials/i.test(x)),'sensitive workspace file leaked into RAG');
    const ragRequests=seen.slice(ragSeen);
    const ragPrompt=ragRequests.map(x=>(x.messages||[]).map(m=>String(m.content||'')).join('\n')).join('\n');
    assert(ragRequests.some(x=>x.think===true),'deep request did not enable thinking');
    assert(ragRequests.some(x=>x.think===false),'fast draft pass missing before deep reasoning');
    assert(ragRequests.some(x=>x.think===false&&x.model==='qwen3.5:2b'),'fast draft did not stay on fast model');
    assert(ragRequests.some(x=>x.think===true&&x.model==='qwen3.5:4b'),'deep reflection did not route to stronger installed model');
    assert(ragj.deepModel==='qwen3.5:4b','deep model metadata missing from brain result');
    assert(ragRequests.every(x=>Number(x.options&&x.options.num_ctx||0)>=4096),'adaptive context not applied');
    assert(/safir anka 4821/i.test(ragPrompt),'workspace RAG snippet missing from prompt');
    assert(!/SHOULD_NOT_ENTER_RAG/i.test(ragPrompt),'sensitive RAG content leaked');
    assert(/müşteri dönüşümü|VAROVA için/i.test(ragj.reply),'deep refinement reply missing');

    const cmd=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:"YouTube'u açar mısın?"});
    assert(cmd.status===200,'command status');
    const cm=JSON.parse(cmd.body);
    assert(cm.type==='command'&&cm.command==='youtube aç','safe command normalization');

    const lexLearn=await post('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon',{
      heard:'yutup',
      intended:'youtube',
      source:'hotfix-selftest'
    });
    assert(lexLearn.status===200,'adaptive lexicon learn status');
    const lexLearnJ=JSON.parse(lexLearn.body);
    assert(lexLearnJ.ok===true,'adaptive lexicon learn failed');

    const partialAlias=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'yutup aç'});
    assert(partialAlias.status===200,'partial alias brain status');
    const partialAliasJ=JSON.parse(partialAlias.body);
    assert(partialAliasJ.type==='command'&&partialAliasJ.command==='youtube aç','partial learned alias replacement failed');

    const lexForget=await post('http://127.0.0.1:'+BRIDGE_PORT+'/speech-lexicon',{
      action:'forget',
      heard:'yutup'
    });
    assert(lexForget.status===200,'adaptive lexicon forget status');

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

    const contextSeed=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Bağlam testi: turuncu martı 731.'});
    assert(contextSeed.status===200,'context seed status');
    const followSeen=seen.length;
    const follow=await post('http://127.0.0.1:'+BRIDGE_PORT+'/brain',{message:'Az önce ne söyledim?'});
    assert(follow.status===200,'follow-up status');
    const fj=JSON.parse(follow.body);
    assert(fj.type==='chat','follow-up chat');
    const followReqs=seen.slice(followSeen);
    const msgText=followReqs.map(r=>(r.messages||[]).map(x=>String(x.content||'')).join('\n')).join('\n');
    assert(/turuncu martı 731/i.test(msgText),'recent conversation context missing');

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
    assert(ts.chunkedPipeline===true&&Number.isFinite(Number(ts.chunks)),'tts chunk pipeline metadata');

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