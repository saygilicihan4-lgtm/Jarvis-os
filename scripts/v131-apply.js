'use strict';
const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s,'utf8')}
function once(text,from,to,label){const i=text.indexOf(from);if(i<0)throw new Error('missing '+label);if(text.indexOf(from,i+from.length)>=0)throw new Error('ambiguous '+label);return text.slice(0,i)+to+text.slice(i+from.length)}

let server=read('server.js');
server=once(server,"const mobileTtsRelay=require('./jarvis-mobile-tts-relay');\n","const mobileTtsRelay=require('./jarvis-mobile-tts-relay');\nconst mobileLanguageRelay=require('./jarvis-mobile-language-relay');\n",'server mobile language require');
server=once(server,"  mobileTtsRequests:new Map(),\n  mobileBrainRequests:new Map(),","  mobileTtsRequests:new Map(),\n  mobileLanguageRequests:new Map(),\n  mobileBrainRequests:new Map(),",'server mobile language state');
const phoneAnchor="  if(pathname==='/api/mobile-brain'&&req.method==='POST'){";
const phoneRoutes=`  if(pathname==='/api/mobile-language'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      if(!pcOnline())return json(res,409,{error:'PC Worker offline'});
      let request;
      try{request=mobileLanguageRelay.createRequest({id:crypto.randomUUID(),text:d.text,locale:d.locale,inputSource:d.inputSource,history:d.history})}
      catch(e){return json(res,400,{error:String(e.message||e)})}
      const terminal=[...state.mobileLanguageRequests.entries()].filter(([,r])=>['ready','failed','cancelled'].includes(r.status)).sort((a,b)=>Number(a[1].createdAtMs||0)-Number(b[1].createdAtMs||0));
      while(state.mobileLanguageRequests.size>=128&&terminal.length)state.mobileLanguageRequests.delete(terminal.shift()[0]);
      if(state.mobileLanguageRequests.size>=128)return json(res,429,{error:'mobile language queue full'});
      state.mobileLanguageRequests.set(request.id,request);
      return json(res,202,{ok:true,id:request.id,status:request.status,locale:request.locale,learning:false});
    });
  }
  const mobileLanguageCancel=pathname.match(/^\\/api\\/mobile-language\\/([0-9a-f-]+)\\/cancel$/i);
  if(mobileLanguageCancel&&req.method==='POST'){
    const r=state.mobileLanguageRequests.get(mobileLanguageCancel[1]);
    if(!r)return json(res,404,{error:'mobile language request not found'});
    const cancelled=mobileLanguageRelay.cancel(r);
    if(!cancelled.ok)return json(res,409,{error:cancelled.reason,status:r.status});
    return json(res,200,{ok:true,status:r.status,learning:false});
  }
  const mobileLanguageGet=pathname.match(/^\\/api\\/mobile-language\\/([0-9a-f-]+)$/i);
  if(mobileLanguageGet&&req.method==='GET'){
    const r=state.mobileLanguageRequests.get(mobileLanguageGet[1]);
    if(!r)return json(res,404,{error:'mobile language request not found'});
    if(r.status==='ready')return json(res,200,{ok:true,status:'ready',result:r.result,learning:false});
    if(r.status==='failed')return json(res,200,{ok:false,status:'failed',error:r.error||'mobile language failed',learning:false});
    return json(res,200,{ok:true,status:r.status,learning:false});
  }

`;
server=once(server,phoneAnchor,phoneRoutes+phoneAnchor,'server phone mobile language routes');
const workerAnchor="  if(pathname==='/api/worker/mobile-brain-next'&&req.method==='GET'){";
const workerRoutes=`  if(pathname==='/api/worker/mobile-language-next'&&req.method==='GET'){
    const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'pc';
    const next=[...state.mobileLanguageRequests.values()].find(r=>r.status==='queued');
    if(!next)return json(res,200,{ok:true,request:null});
    const claimed=mobileLanguageRelay.claim(next,deviceId);
    if(!claimed.ok)return json(res,409,{error:claimed.reason});
    return json(res,200,{ok:true,request:{id:next.id,text:next.text,locale:next.locale,inputSource:next.inputSource,history:next.history}});
  }
  if(pathname==='/api/worker/mobile-language-result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const r=state.mobileLanguageRequests.get(String(d.id||''));
      if(!r)return json(res,404,{error:'mobile language request not found'});
      const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'pc';
      const verified=mobileLanguageRelay.verifyResult(r,{workerId:deviceId,locale:d.locale});
      if(!verified.ok)return json(res,409,{error:verified.reason,status:r.status});
      if(d.ok&&d.result&&typeof d.result==='object'&&d.result.ok===true&&d.result.locale===r.locale&&d.result.state==='reply-ready'){
        const reply=String(d.result.reply||'').replace(/\\s+/g,' ').trim().slice(0,900);
        if(!reply)return json(res,400,{error:'valid reply required'});
        r.status='ready';r.result={...d.result,reply,locale:r.locale,learning:false,deviceE2eVerified:false};r.error=null;r.readyAtMs=Date.now();
      }else{
        r.status='failed';r.result=null;r.error=String(d.error||d.result?.reason||'mobile language generation failed').slice(0,240);r.readyAtMs=Date.now();
      }
      return json(res,200,{ok:true,status:r.status,locale:r.locale,learning:false});
    });
  }

`;
server=once(server,workerAnchor,workerRoutes+workerAnchor,'server worker mobile language routes');
write('server.js',server);

let worker=read('worker.js');
worker=once(worker,"let mobileTtsBusy=false;\nlet mobileBrainBusy=false;","let mobileTtsBusy=false;\nlet mobileLanguageBusy=false;\nlet mobileLanguageEngine=null;\nlet mobileBrainBusy=false;",'worker mobile language state');
const brainFn="async function serviceMobileBrain(){";
const languageFn=`function getMobileLanguageEngine(){
  if(!mobileLanguageEngine){
    const output=require('./jarvis-language-turn-output').createOutput({brainUrl:LOCAL_BRAIN_URL,model:LOCAL_BRAIN_MODEL});
    mobileLanguageEngine=require('./jarvis-mobile-language-conversation').createEngine({output});
  }
  return mobileLanguageEngine;
}
async function serviceMobileLanguage(){
  if(mobileLanguageBusy)return false;
  mobileLanguageBusy=true;
  try{
    const q=(await api('/api/worker/mobile-language-next')).request;
    if(!q)return false;
    let result;
    try{result=await getMobileLanguageEngine().turn(q)}catch(e){result={ok:false,state:'failed',reason:String(e.message||e),locale:q.locale,learning:false,deviceE2eVerified:false}}
    await api('/api/worker/mobile-language-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,locale:q.locale,ok:result.ok===true,result,error:result.ok===true?null:String(result.reason||'mobile language failed')})});
    return true;
  }catch(e){return false}finally{mobileLanguageBusy=false}
}
`;
worker=once(worker,brainFn,languageFn+brainFn,'worker service mobile language');
worker=once(worker,"      await serviceMobileTts();\n      await serviceMobileBrain();","      await serviceMobileTts();\n      await serviceMobileLanguage();\n      await serviceMobileBrain();",'worker poll mobile language');
write('worker.js',worker);

let html=read('public/index.html');
html=once(html,'<script src="/language-chat.js"></script>','<script src="/language-chat.js"></script>\n<script src="/mobile-language-chat.js"></script>','mobile script');
html=once(html,'let languageChatClient=null;\nlet languageChatStarting=false;','let languageChatClient=null;\nlet mobileLanguageChatClient=null;\nlet mobileLanguageCapture=null;\nlet languageChatStarting=false;','mobile client state');
html=once(html,"  recognition.onend=()=>{\n    setVoiceMode(false);","  recognition.onend=()=>{\n    setVoiceMode(false);\n    if(mobileLanguageCapture){const slot=mobileLanguageCapture;mobileLanguageCapture=null;slot.reject(new Error('browser_stt_no_final_result'));return}",'recognition mobile end');
html=once(html,"    const err=String(e.error||'ERROR');","    const err=String(e.error||'ERROR');\n    if(mobileLanguageCapture){const slot=mobileLanguageCapture;mobileLanguageCapture=null;slot.reject(new Error('browser_stt_'+err.toLowerCase()));return}",'recognition mobile error');
html=once(html,"    if(e.results[e.results.length-1].isFinal){\n      if(bargeInMode){","    if(e.results[e.results.length-1].isFinal){\n      if(mobileLanguageCapture){const slot=mobileLanguageCapture;mobileLanguageCapture=null;slot.resolve(captured);return}\n      if(bargeInMode){",'recognition mobile result');
const runAnchor='async function runLanguageChat(){';
const mobileFns=`function captureMobileLanguageTranscript(locale,signal){
  if(!recognition)return Promise.reject(new Error('browser_stt_unsupported'));
  if(mobileLanguageCapture)return Promise.reject(new Error('browser_stt_busy'));
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;if(mobileLanguageCapture===slot)mobileLanguageCapture=null;signal?.removeEventListener('abort',onAbort);fn(value)};
    const slot={resolve:value=>finish(resolve,value),reject:error=>finish(reject,error instanceof Error?error:new Error(String(error||'browser_stt_failed')))};
    const onAbort=()=>{try{recognition.abort()}catch(_){};slot.reject(new Error('mobile_language_cancelled'))};
    mobileLanguageCapture=slot;signal?.addEventListener('abort',onAbort,{once:true});
    try{recognition.lang=locale;recognition.start()}catch(e){slot.reject(e)}
  });
}
async function mobileLanguageConversationRequest(data,signal){
  let id='',finished=false;
  try{
    const created=await api('/api/mobile-language',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal});
    id=String(created.id||'');if(!id)throw new Error('mobile_language_queue_failed');
    const deadline=Date.now()+60000;
    while(Date.now()<deadline){
      signal?.throwIfAborted();
      await new Promise((resolve,reject)=>{const t=setTimeout(resolve,450);if(signal)signal.addEventListener('abort',()=>{clearTimeout(t);reject(new Error('mobile_language_cancelled'))},{once:true})});
      const state=await api('/api/mobile-language/'+encodeURIComponent(id),{cache:'no-store',signal});
      if(state.status==='ready'&&state.result){finished=true;return state.result}
      if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error||('mobile_language_'+state.status));
    }
    throw new Error('mobile_language_timeout');
  }finally{
    if(id&&!finished)fetch('/api/mobile-language/'+encodeURIComponent(id)+'/cancel',{method:'POST',credentials:'same-origin'}).catch(()=>{});
  }
}
async function playMobileLanguageReply(result,signal){
  const abort=()=>{
    if(activeMobileTtsRequestId){const id=activeMobileTtsRequestId;activeMobileTtsRequestId='';fetch('/api/mobile-tts/'+encodeURIComponent(id)+'/cancel',{method:'POST',credentials:'same-origin'}).catch(()=>{})}
    if(mobileJarvisPlayer){try{mobileJarvisPlayer.pause();mobileJarvisPlayer.onended?.()}catch(_){}}
  };
  signal?.addEventListener('abort',abort,{once:true});
  try{signal?.throwIfAborted();await playJarvisMobileRelay(result.reply,'balanced',result.locale);signal?.throwIfAborted()}
  finally{signal?.removeEventListener('abort',abort)}
}
async function runMobileLanguageChat(){
  if(!recognition){languageChatStatus.textContent='Telefon tarayıcısında konuşma tanıma desteği doğrulanmadı.';return}
  if(!window.JarvisMobileLanguageChat){languageChatStatus.textContent='Mobil çok dilli sohbet modülü yüklenemedi.';return}
  if(!mobileLanguageChatClient)mobileLanguageChatClient=JarvisMobileLanguageChat.createClient({
    capture:captureMobileLanguageTranscript,request:mobileLanguageConversationRequest,play:playMobileLanguageReply,
    onState:(state,detail={})=>{
      languageChatBtn.textContent=(state==='idle'||state==='confirm-language')?'ÇOK DİLLİ SOHBET':'DUR';
      if(state==='listening')languageChatStatus.textContent='Telefon mikrofonu · '+(LANGUAGE_NAMES[activeLanguage.split('-')[0]]||activeLanguage)+' dinleniyor.';
      else if(state==='confirm-language')languageChatStatus.textContent='Dil değişimi adayı: '+(LANGUAGE_NAMES[String(detail.locale||'').split('-')[0]]||detail.locale)+'. Onaylamak için düğmeye tekrar dokunun.';
      else if(state==='language-confirmed')languageChatStatus.textContent='Dil değişimi açıkça onaylandı · '+detail.locale;
      else if(state==='thinking')languageChatStatus.textContent='PC yerel model yanıt hazırlıyor · giriş dili öğrenilmiyor.';
      else if(state==='playing')languageChatStatus.textContent='Yanıt telefonda locale-doğrulanmış TTS ile oynatılıyor.';
      else if(state==='completed'){activeLanguage=detail.nextLocale||detail.locale||activeLanguage;recognition.lang=activeLanguage;languageChatStatus.textContent='Mobil çok dilli tur tamamlandı · dil öğrenme kapalı.'}
      else if(state==='error')languageChatStatus.textContent='Mobil çok dilli sohbet tamamlanamadı: '+detail.error;
    },
    onReply:result=>{coreSubtitle.textContent=result.reply;consoleStatus.textContent='MOBILE LANGUAGE CHAT · '+result.locale+' · NO STT LEARNING';rememberJarvisSpeechEcho(result.reply)}
  });
  if(mobileLanguageChatClient.busy){mobileLanguageChatClient.cancel();return}
  primeMobileSpeech();
  await mobileLanguageChatClient.run({locale:activeLanguage});
}
`;
html=once(html,runAnchor,mobileFns+runAnchor,'mobile language functions');
html=once(html,"  if(!/Windows/i.test(navigator.userAgent)||isMobileJarvis()){\n    languageChatStatus.textContent='Bu sohbet yolu şu anda Windows PC içindir.';return;\n  }","  if(isMobileJarvis()){await runMobileLanguageChat();return}\n  if(!/Windows/i.test(navigator.userAgent)){\n    languageChatStatus.textContent='Yerel konuşma oturumu şu anda Windows PC içindir.';return;\n  }",'mobile language route');
html=once(html,'  privacyMode=true;\n  languageChatClient?.cancel();','  privacyMode=true;\n  languageChatClient?.cancel();\n  mobileLanguageChatClient?.cancel();','privacy cancel mobile language');
html=once(html,'  if(!ok)languageChatClient?.cancel();','  if(!ok){languageChatClient?.cancel();mobileLanguageChatClient?.cancel();}','auth cancel mobile language');
write('public/index.html',html);
console.log('v131 integration patch applied');
