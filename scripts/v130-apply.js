'use strict';
const fs=require('fs');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s,'utf8')}
function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0)throw new Error('patch anchor missing: '+label);
  if(text.indexOf(from,i+from.length)>=0)throw new Error('patch anchor ambiguous: '+label);
  return text.slice(0,i)+to+text.slice(i+from.length);
}
function replaceRegex(text,re,to,label){
  const matches=[...text.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];
  if(matches.length!==1)throw new Error('patch regex '+label+' expected 1 match, got '+matches.length);
  return text.replace(re,to);
}
function replaceAfter(text,marker,from,to,label){
  const m=text.indexOf(marker);if(m<0)throw new Error('marker missing: '+label);
  const i=text.indexOf(from,m);if(i<0)throw new Error('post-marker anchor missing: '+label);
  return text.slice(0,i)+to+text.slice(i+from.length);
}

let server=read('server.js');
server=replaceOnce(server,"const crypto=require('crypto');\n","const crypto=require('crypto');\nconst mobileTtsRelay=require('./jarvis-mobile-tts-relay');\n",'server relay require');
server=replaceRegex(server,/  if\(pathname==='\/api\/mobile-tts'&&req\.method==='POST'\)\{[\s\S]*?\n  \}\n\n  const mobileTtsGet=/,
`  if(pathname==='/api/mobile-tts'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const text=String(d.text||'').replace(/\\s+/g,' ').trim().slice(0,700);
      if(!text)return json(res,400,{error:'text required'});
      if(!pcOnline())return json(res,409,{error:'PC Worker offline'});
      const locale=mobileTtsRelay.normalizeLocale(d.locale);
      if(!locale)return json(res,400,{error:'valid locale required'});
      const tone=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'].includes(String(d.tone||''))?String(d.tone):'balanced';
      const id=crypto.randomUUID();
      const request=mobileTtsRelay.createRequest({id,text,tone,locale});
      state.mobileTtsRequests.set(id,request);
      return json(res,202,{ok:true,id,status:'queued',locale:request.locale});
    });
  }

  const mobileTtsCancel=pathname.match(/^\\/api\\/mobile-tts\\/([0-9a-f-]+)\\/cancel$/i);
  if(mobileTtsCancel&&req.method==='POST'){
    const r=state.mobileTtsRequests.get(mobileTtsCancel[1]);
    if(!r)return json(res,404,{error:'tts request not found'});
    const cancelled=mobileTtsRelay.cancel(r);
    if(!cancelled.ok)return json(res,409,{error:cancelled.reason,status:r.status});
    return json(res,200,{ok:true,status:r.status});
  }

  const mobileTtsGet=`, 'server mobile tts create/cancel');
server=replaceRegex(server,/  if\(pathname==='\/api\/worker\/mobile-tts-next'&&req\.method==='GET'\)\{[\s\S]*?\n  \}\n\n  if\(pathname==='\/api\/worker\/mobile-tts-result'/,
`  if(pathname==='/api/worker/mobile-tts-next'&&req.method==='GET'){
    const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'pc';
    const next=[...state.mobileTtsRequests.values()].find(r=>r.status==='queued');
    if(!next)return json(res,200,{ok:true,request:null});
    const claimed=mobileTtsRelay.claim(next,deviceId);
    if(!claimed.ok)return json(res,409,{error:claimed.reason});
    return json(res,200,{ok:true,request:{id:next.id,text:next.text,tone:next.tone||'balanced',locale:next.locale}});
  }

  if(pathname==='/api/worker/mobile-tts-result'`, 'server mobile tts claim');
server=replaceRegex(server,/  if\(pathname==='\/api\/worker\/mobile-tts-result'&&req\.method==='POST'\)\{[\s\S]*?\n  \}\n\n  if\(pathname==='\/api\/worker\/mobile-brain-next'/,
`  if(pathname==='/api/worker/mobile-tts-result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const id=String(d.id||''),r=state.mobileTtsRequests.get(id);
      if(!r)return json(res,404,{error:'tts request not found'});
      const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'pc';
      const verified=mobileTtsRelay.verifyResult(r,{workerId:deviceId,locale:d.locale});
      if(!verified.ok)return json(res,409,{error:verified.reason,status:r.status});
      if(d.ok&&typeof d.audio==='string'&&d.audio.length){
        if(d.audio.length>900000)return json(res,413,{error:'audio too large'});
        r.status='ready';r.audio=d.audio;r.error=null;r.readyAtMs=Date.now();
      }else{
        r.status='failed';r.error=String(d.error||'tts generation failed').slice(0,240);r.readyAtMs=Date.now();
      }
      return json(res,200,{ok:true,status:r.status,locale:r.locale});
    });
  }

  if(pathname==='/api/worker/mobile-brain-next'`, 'server mobile tts result');
write('server.js',server);

let worker=read('worker.js');
worker=replaceOnce(worker,"const http=require('http');\n","const http=require('http');\nconst mobileTtsVoiceRouter=require('./jarvis-tts-locale-router').createRouter();\n",'worker voice router require');
worker=replaceOnce(worker,"async function renderJarvisMp3Base64(text,tone='balanced'){","async function renderJarvisMp3Base64(text,tone='balanced',locale='tr-TR'){",'mobile render signature');
worker=replaceAfter(worker,"async function renderJarvisMp3Base64", "  const profile=ttsProfileForTone(tone,clean);\n  const mp3=", "  const profile=ttsProfileForTone(tone,clean);\n  const voiceMatch=await mobileTtsVoiceRouter.resolve(locale);\n  if(!voiceMatch.ok)throw new Error(voiceMatch.reason+(voiceMatch.locale?':'+voiceMatch.locale:''));\n  const mp3=", 'mobile voice inventory resolve');
worker=replaceAfter(worker,"async function renderJarvisMp3Base64", "'--voice',TTS_VOICE", "'--voice',voiceMatch.voice", 'mobile voice selection');
worker=replaceAfter(worker,"async function serviceMobileTts", "renderJarvisMp3Base64(q.text,q.tone||'balanced')", "renderJarvisMp3Base64(q.text,q.tone||'balanced',q.locale)", 'service locale render');
worker=replaceAfter(worker,"async function serviceMobileTts", "JSON.stringify({id:q.id,ok:true,audio})", "JSON.stringify({id:q.id,locale:q.locale,ok:true,audio})", 'service success locale');
worker=replaceAfter(worker,"async function serviceMobileTts", "JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})", "JSON.stringify({id:q.id,locale:q.locale,ok:false,error:String(e.message||e)})", 'service failure locale');
write('worker.js',worker);

let ui=read('public/index.html');
ui=replaceOnce(ui,"async function playJarvisMobileRelay(text,tone='balanced'){","let activeMobileTtsRequestId='';\nasync function playJarvisMobileRelay(text,tone='balanced',locale=activeLanguage){",'ui relay signature');
ui=replaceAfter(ui,"async function playJarvisMobileRelay", "  releaseMobileClapAudioSession();\n", `  releaseMobileClapAudioSession();
  if(activeMobileTtsRequestId){
    const stale=activeMobileTtsRequestId;activeMobileTtsRequestId='';
    fetch('/api/mobile-tts/'+encodeURIComponent(stale)+'/cancel',{method:'POST',credentials:'same-origin'}).catch(()=>{});
  }
`, 'ui cancel stale request');
ui=replaceAfter(ui,"async function playJarvisMobileRelay", "body:JSON.stringify({text:String(text||'').trim(),tone})", "body:JSON.stringify({text:String(text||'').trim(),tone,locale})", 'ui create locale');
ui=replaceAfter(ui,"async function playJarvisMobileRelay", "if(!create.ok||!cj.id)throw new Error(cj.error||'mobile tts unavailable');", "if(!create.ok||!cj.id)throw new Error(cj.error||'mobile tts unavailable');\n  activeMobileTtsRequestId=cj.id;", 'ui active request');
ui=replaceAfter(ui,"async function playJarvisMobileRelay", "if(j.status==='failed')throw new Error(j.error||'mobile tts failed');", "if(j.status==='cancelled'){if(activeMobileTtsRequestId===cj.id)activeMobileTtsRequestId='';throw new Error('mobile tts cancelled')}\n    if(j.status==='failed'){if(activeMobileTtsRequestId===cj.id)activeMobileTtsRequestId='';throw new Error(j.error||'mobile tts failed')}", 'ui terminal status');
ui=replaceAfter(ui,"async function playJarvisMobileRelay", "if(j.status==='ready'&&j.audio){", "if(j.status==='ready'&&j.audio){\n      if(activeMobileTtsRequestId===cj.id)activeMobileTtsRequestId='';", 'ui ready clear');
ui=replaceOnce(ui,"playJarvisMobileRelay(spoken,tone).catch(err=>{","playJarvisMobileRelay(spoken,tone,lang).catch(err=>{",'ui preserve speech locale');
write('public/index.html',ui);

let ci=read('.github/workflows/ci.yml');
ci=replaceOnce(ci,"          node --check worker.js\n","          node --check worker.js\n          node --check jarvis-mobile-tts-relay.js\n          node --check jarvis-tts-locale-router.js\n          node --check mobile-tts-relay-selftest.js\n",'ci syntax');
ci=replaceOnce(ci,"      - name: STT lexicon selftest\n","      - name: Mobile multilingual TTS relay selftest\n        run: node mobile-tts-relay-selftest.js\n      - name: STT lexicon selftest\n",'ci relay test');
write('.github/workflows/ci.yml',ci);

let adaptive=read('.github/workflows/lexicon-ci.yml');
adaptive=replaceOnce(adaptive,"          node --check worker.js\n","          node --check worker.js\n          node --check jarvis-mobile-tts-relay.js\n          node --check jarvis-tts-locale-router.js\n          node --check mobile-tts-relay-selftest.js\n",'adaptive syntax');
adaptive=replaceOnce(adaptive,"      - name: Safe session language switching\n","      - name: Mobile multilingual TTS relay safety\n        run: node mobile-tts-relay-selftest.js\n      - name: Safe session language switching\n",'adaptive relay test');
write('.github/workflows/lexicon-ci.yml',adaptive);

fs.rmSync('scripts/v130-apply.js',{force:true});
fs.rmSync('.github/workflows/v130-bootstrap.yml',{force:true});
console.log('v130 deterministic integration patch applied');
