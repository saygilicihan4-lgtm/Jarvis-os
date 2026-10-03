'use strict';
const assert=require('assert/strict'),http=require('http'),{spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-language-bridge-'));
async function freePort(){const s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
(async()=>{
  let child,closed;
  try{
    const port=await freePort();
    child=spawn(process.execPath,['worker.js'],{cwd:__dirname,env:{...process.env,JARVIS_TEST_MODE:'1',JARVIS_LOCAL_BRIDGE_FORCE:'1',JARVIS_TTS_PORT:String(port),JARVIS_TOKEN:'language-test-token',JARVIS_DEVICE_ID:'TEST-LANGUAGE-SESSION',JARVIS_WORKSPACE:root},stdio:['ignore','pipe','pipe']});
    closed=new Promise(resolve=>child.once('exit',resolve));
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('language bridge start timeout')),10000);
      child.stdout.on('data',data=>{if(String(data).includes('LOCAL TTS BRIDGE READY')){clearTimeout(timeout);resolve()}});
      child.once('exit',code=>{clearTimeout(timeout);reject(new Error('worker exit '+code))});
    });
    const post=async(data,origin)=>{
      const response=await fetch('http://127.0.0.1:'+port+'/language-session',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(3000)});
      return{status:response.status,body:response.status===403?null:await response.json()};
    };
    let response=await post({action:'create'});assert.equal(response.status,200);
    const id=response.body.sessionId;assert.match(id,/^[0-9a-f-]{36}$/);
    assert.equal(response.body.context.locale,'tr-TR');assert.equal(response.body.speech.ok,false);
    response=await post({action:'set-preference',locale:'de',root:'/malicious-ignored-path'});assert.equal(response.status,200);
    response=await post({action:'status',sessionId:id});assert.equal(response.body.context.locale,'de-DE');
    response=await post({action:'begin',sessionId:id});assert.equal(response.body.error,'fresh_capture_required');
    response=await post({action:'complete',sessionId:id,turnId:'fake',successful:true});assert.equal(response.body.ok,false);
    response=await post({action:'status',sessionId:'unknown'});assert.equal(response.status,422);
    response=await post({action:'create',requested:'__proto__'});assert.equal(response.status,422);
    response=await post({action:'set-preference',locale:'fr'},'http://localhost.evil.test');assert.equal(response.status,403);
    response=await post({action:'status',sessionId:id});assert.equal(response.body.context.locale,'de-DE','blocked origin cannot mutate');
    const manifest=JSON.parse(fs.readFileSync('jarvis-update-manifest.json','utf8'));
    const installer=fs.readFileSync('JARVIS-ZERO-COST-ONECLICK.ps1','utf8');
    for(const file of ['jarvis-language-core.js','jarvis-language-learning.js','jarvis-speech-capabilities.js','jarvis-speech-provider-discovery.js','jarvis-session-language.js','jarvis-speech-session-runtime.js']){
      const entry=manifest.files.find(x=>x.path===file);assert.ok(entry,'updater entry '+file);
      assert.ok(fs.readFileSync(file,'utf8').includes(entry.signature));assert.ok(fs.statSync(file).size>=entry.min_bytes);
      assert.ok(installer.includes('"'+file+'"'),'installer entry '+file);
    }
    assert.ok(fs.existsSync(path.join(root,'.jarvis-memory','language-profile.json')),'profile under worker workspace');
    console.log('LANGUAGE SESSION WORKER SELFTEST PASS · real local HTTP API, no microphone/TTS E2E');
  }finally{if(child&&child.exitCode===null){child.kill();await closed}fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
