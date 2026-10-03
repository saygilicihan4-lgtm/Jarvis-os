'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createRuntime}=require('./jarvis-speech-session-runtime'),{discoverEdgeTts}=require('./jarvis-speech-provider-discovery');
const {createOutput}=require('./jarvis-language-turn-output'),{createConversation}=require('./jarvis-language-conversation');
const learning=require('./jarvis-language-learning');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-conversation-'));
let utterance=0,replyLocale=null,generationFailure=false,renderFailure=false,waitForAbort=false,entered;
const calls=[],renderedDirs=[];
const voices=['tr-TR-AhmetNeural','de-DE-ConradNeural','en-US-GuyNeural'].map(ShortName=>({ShortName,Locale:ShortName.split('-').slice(0,2).join('-'),Gender:'Male'}));
const fetchImpl=async(url,options)=>{
  if(url.endsWith('/health'))return{ok:true,json:async()=>({ok:true,loaded:true,engine:'faster-whisper',language_capabilities:{source:'loaded_model_inventory',languages:['tr','de','en'],automatic_detection:true}})};
  if(url.endsWith('/listen'))return{ok:true,json:async()=>({ok:true,engine:'faster-whisper',text:'Guten Tag, erzähl mir etwas.',meta:{utterance_id:'id-'+(++utterance),language_detection:{mode:'automatic',language:'de',confidence:.97,reliable:true,final:true}}})};
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const body=JSON.parse(options.body);calls.push(body);
  assert.equal(body.tools,undefined,'conversation cannot execute tools');
  assert.equal(body.messages[0].role,'system');
  if(waitForAbort){entered();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('cancelled_generation')),{once:true}))}
  if(generationFailure)throw new Error('model_unavailable');
  const locale=replyLocale||body.format.properties.locale.enum[0];
  return{ok:true,json:async()=>({message:{content:JSON.stringify({reply:'Hallo! Schön, dich zu hören.',locale})}})};
};
const runner=async(command,args)=>{
  assert.equal(command,'python3');assert.equal(args[0],'-m');assert.equal(args[1],'edge_tts');
  const voice=args[args.indexOf('--voice')+1];assert.ok(voices.some(x=>x.ShortName===voice));
  const file=args[args.indexOf('--write-media')+1];renderedDirs.push(path.dirname(file));
  if(renderFailure)throw new Error('voice_unavailable');
  const bytes=Buffer.alloc(1024);bytes.write('ID3');fs.writeFileSync(file,bytes);
};
const output=createOutput({fetchImpl,runner,platform:'linux'});
const runtime=createRuntime({root,fetchImpl,probeVoices:async registry=>[await discoverEdgeTts({registry,runner:async()=>({ok:true,stdout:JSON.stringify(voices)})})]});
const chat=createConversation({runtime,output});
(async()=>{
  let result;
  try{
    assert.throws(()=>createOutput({brainUrl:'https://paid.example/api'}),/loopback/);
    assert.throws(()=>createOutput({brainUrl:'http://user:pass@localhost:11434'}),/loopback/);
    const id=chat.create({}).sessionId;
    result=await chat.turn(id);assert.equal(result.state,'confirm-language');assert.equal(calls.length,0,'first foreign detection must not generate in previous language');
    result=await chat.turn(id);assert.equal(result.state,'audio-ready');assert.equal(result.locale,'de-DE');assert.equal(result.voice,'de-DE-ConradNeural');
    assert.match(calls[0].messages[0].content,/locale de-DE/);assert.equal(calls[0].messages.length,2);
    assert.equal(runtime.status(id).activeTurn,true,'render completion alone cannot finish playback');
    await assert.rejects(chat.turn(id),/busy/);
    assert.throws(()=>chat.acknowledge(id,{receipt:'fake',played:true}),/invalid/);
    assert.equal(learning.load(root).learnedLocale,null);
    chat.acknowledge(id,{receipt:result.receipt,played:true});
    assert.throws(()=>chat.acknowledge(id,{receipt:result.receipt,played:true}),/invalid/,'playback replay rejected');
    for(let i=0;i<2;i++){result=await chat.turn(id);chat.acknowledge(id,{receipt:result.receipt,played:true})}
    assert.equal(learning.load(root).learnedLocale,'de-DE');
    assert.ok(calls.at(-1).messages.length>2,'same-session completed history retained in memory');
    runtime.resetLearned();replyLocale='fr-FR';await assert.rejects(chat.turn(id),/locale/);replyLocale=null;
    assert.equal(runtime.status(id).activeTurn,false);
    generationFailure=true;await assert.rejects(chat.turn(id),/model_unavailable/);generationFailure=false;
    const id2=chat.create({requested:'de'}).sessionId;
    result=await chat.turn(id2);assert.equal(calls.at(-1).messages.length,2,'different session does not inherit transcript history');
    chat.acknowledge(id2,{receipt:result.receipt,played:false});
    assert.equal(learning.load(root).learnedLocale,null,'playback failure cannot learn');
    renderFailure=true;await assert.rejects(chat.turn(id2),/voice_unavailable/);renderFailure=false;
    assert.equal(runtime.status(id2).activeTurn,false);
    waitForAbort=true;const enteredPromise=new Promise(resolve=>entered=resolve);
    const pending=chat.turn(id2);await enteredPromise;chat.cancel(id2);await assert.rejects(pending,/cancelled/);waitForAbort=false;
    assert.equal(runtime.status(id2).activeTurn,false);assert.equal(learning.load(root).learnedLocale,null);
    assert.ok(renderedDirs.every(dir=>!fs.existsSync(dir)),'temporary audio removed on success and failure');
    const plan={ok:true,locale:'de-DE',ttsLocale:'de-DE',cost:0,fallbackUsed:false,ttsProvider:'edge-tts',voice:'tr-TR-AhmetNeural'};
    await assert.rejects(output.render({reply:'Hi',context:{locale:'de-DE'},speech:plan}),/mismatch/);
    const sapiOutput=createOutput({platform:'win32',runner:async(command,args)=>{
      assert.equal(command,'powershell.exe');assert.ok(args.includes('-File'));assert.ok(!args.includes('-Command'));
      const input=args[args.indexOf('-InputPath')+1],out=args[args.indexOf('-OutputPath')+1];
      const data=JSON.parse(fs.readFileSync(input,'utf8'));assert.equal(data.voice,'Installed German');assert.equal(data.text,"Hello ' ; no code");
      const bytes=Buffer.alloc(1024);bytes.write('RIFF');bytes.write('WAVE',8);fs.writeFileSync(out,bytes);
      renderedDirs.push(path.dirname(out));
    }});
    const sapi=await sapiOutput.render({reply:"Hello ' ; no code",context:{locale:'de-DE'},speech:{...plan,ttsProvider:'windows-sapi',voice:'Installed German'}});
    assert.equal(sapi.mime,'audio/wav');assert.ok(renderedDirs.every(dir=>!fs.existsSync(dir)));
    console.log('LANGUAGE CONVERSATION SELFTEST PASS · simulated ASR/model/render, locale coupling, receipts, cancellation and cleanup');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{fs.rmSync(root,{recursive:true,force:true});console.error(error);process.exitCode=1});
