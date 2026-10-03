'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createRuntime}=require('./jarvis-speech-session-runtime'),discovery=require('./jarvis-speech-provider-discovery'),caps=require('./jarvis-speech-capabilities'),learning=require('./jarvis-language-learning');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-speech-runtime-'));
const voices=[{ShortName:'tr-TR-EmelNeural',Locale:'tr-TR',Gender:'Female'},{ShortName:'tr-TR-AhmetNeural',Locale:'tr-TR',Gender:'Male'},{ShortName:'de-DE-ConradNeural',Locale:'de-DE',Gender:'Male'}];
const health={ok:true,loaded:true,engine:'faster-whisper',language_capabilities:{source:'loaded_model_inventory',languages:['tr','de','en'],automatic_detection:true}};
let clock=1000,utterance=0,confidence=.96,mode='automatic',language='de',repeat=false,loaded=true,blockCapture=null;
const requests=[];
const fetchImpl=async(url,options)=>{
  assert.match(url,/^http:\/\/127\.0\.0\.1:8768\/(health|listen)$/);
  if(url.endsWith('/health'))return{ok:true,json:async()=>({...health,loaded})};
  requests.push(JSON.parse(options.body));
  if(blockCapture)await blockCapture;
  const id=repeat?utterance:++utterance;
  return{ok:true,json:async()=>({ok:true,engine:'faster-whisper',text:'Guten Tag, wie geht es dir?',meta:{utterance_id:'u-'+id,
    language_detection:{mode,language,confidence,reliable:true,final:true}}})};
};
const runner=async()=>({ok:true,stdout:JSON.stringify(voices)});
const probeVoices=async registry=>[await discovery.discoverEdgeTts({registry,runner})];
(async()=>{
  try{
    const runtimeLocaleRegistry=caps.createRegistry({now:()=>clock});
    runtimeLocaleRegistry.registerProvider('faster-whisper',{sttLanguages:['nl'],offline:true,cost:0,evidence:{source:'loaded_model_inventory'}});
    runtimeLocaleRegistry.registerProvider('edge-tts',{ttsLocales:['nl-NL'],voices:[{id:'nl-NL-MaartenNeural',locale:'nl-NL',gender:'Male'}],cost:0,evidence:{source:'runtime_voice_inventory'}});
    assert.equal(runtimeLocaleRegistry.supports('edge-tts','tts','nl'),false,'bare language is not falsely reported as an exact TTS locale');
    let nlPlan=runtimeLocaleRegistry.select({locale:'nl'});
    assert.equal(nlPlan.ok,true);assert.equal(nlPlan.locale,'nl');assert.equal(nlPlan.ttsLocale,'nl-NL');
    assert.equal(nlPlan.localeResolution,'unique_runtime_language_match');assert.equal(nlPlan.voice,'nl-NL-MaartenNeural');
    assert.equal(runtimeLocaleRegistry.select({locale:'nl-BE'}).ok,false,'explicit region cannot silently use a sibling runtime locale');
    runtimeLocaleRegistry.registerProvider('edge-tts',{ttsLocales:['nl-NL','nl-BE'],voices:[
      {id:'nl-NL-MaartenNeural',locale:'nl-NL',gender:'Male'},{id:'nl-BE-ArnaudNeural',locale:'nl-BE',gender:'Male'}],cost:0,evidence:{source:'runtime_voice_inventory'}});
    const ambiguous=runtimeLocaleRegistry.select({locale:'nl'});
    assert.equal(ambiguous.ok,false);assert.equal(ambiguous.reason,'runtime_tts_locale_ambiguous');
    assert.deepEqual(ambiguous.ttsCandidates,['nl-BE','nl-NL'],'multiple runtime regions require explicit disambiguation');
    const exactBelgian=runtimeLocaleRegistry.select({locale:'nl-BE'});
    assert.equal(exactBelgian.ok,true);assert.equal(exactBelgian.ttsLocale,'nl-BE');assert.equal(exactBelgian.localeResolution,'exact');

    const registry=caps.createRegistry({now:()=>clock});
    await discovery.discoverEdgeTts({registry,runner});
    assert.equal(registry.select({locale:'tr'}).ok,false,'TTS inventory cannot imply STT');
    discovery.registerLocalStt(health,{registry});
    assert.equal(registry.select({locale:'tr'}).voice,'tr-TR-AhmetNeural','approved Turkish voice retained');
    assert.equal(registry.select({locale:'tr',offlineOnly:true}).ok,false,'Edge is online');
    assert.equal(registry.select({locale:'de-AT'}).ok,false,'no silent regional TTS fallback');
    assert.equal(registry.select({locale:'ja'}).ok,false,'no fabricated locales');
    await discovery.discoverSystemTts({registry,platform:'win32',runner:async()=>({ok:true,stdout:JSON.stringify([
      {Name:'Offline German',Culture:'de-DE',Gender:'Male',Enabled:true},{Name:'Disabled Turkish',Culture:'tr-TR',Enabled:false}])})});
    assert.equal(registry.select({locale:'de',offlineOnly:true}).voice,'Offline German');
    clock+=300001;assert.equal(registry.select({locale:'de'}).ok,false,'expired evidence is unusable');
    await discovery.discoverEdgeTts({registry,runner});discovery.registerLocalStt(health,{registry});
    await discovery.discoverEdgeTts({registry,runner:async()=>({ok:false,reason:'offline'})});
    assert.equal(registry.supports('edge-tts','tts','tr'),false,'failed refresh revokes cached inventory');
    discovery.registerLocalStt({...health,loaded:false},{registry});
    assert.equal(registry.supports('faster-whisper','stt','de'),false,'unloaded model revokes STT');
    const runtime=createRuntime({root,fetchImpl,probeVoices,now:()=>clock});
    const id=runtime.create({}).sessionId;
    await runtime.probe();
    await runtime.listen(id);
    let turn=runtime.begin(id);assert.equal(turn.context.locale,'tr-TR','first utterance cannot switch');
    assert.equal(runtime.complete(id,{turnId:turn.turnId,successful:true}).learning,false,'mismatched locale cannot learn');
    await runtime.listen(id);turn=runtime.begin(id);assert.equal(turn.context.locale,'de-DE');
    await assert.rejects(runtime.listen(id),/busy/,'capture cannot overlap a response');
    assert.equal(runtime.complete(id,{turnId:'stale',successful:true}).ok,false);
    runtime.complete(id,{turnId:turn.turnId,successful:true});
    assert.equal(runtime.complete(id,{turnId:turn.turnId,successful:true}).ok,false,'replay cannot learn twice');
    for(let i=0;i<2;i++){await runtime.listen(id);turn=runtime.begin(id);runtime.complete(id,{turnId:turn.turnId,successful:true})}
    assert.equal(learning.load(root).learnedLocale,'de-DE');
    assert.equal(requests.every(x=>x.language==='auto'),true,'runtime actually requests auto detection');
    assert.equal(runtime.create({}).context.locale,'de-DE','new session restores preference');
    runtime.resetLearned();repeat=true;
    await assert.rejects(runtime.listen(id),/duplicate/);repeat=false;
    const replaySession=runtime.create({}).sessionId;repeat=true;
    await assert.rejects(runtime.listen(replaySession),/duplicate/,'new session cannot replay a provider observation');repeat=false;
    language='ja';const unsupported=await runtime.listen(id);
    assert.equal(unsupported.speech.ok,false,'unsupported detection is visible to the caller');
    assert.equal(runtime.begin(id).ok,false,'unsupported detected language cannot silently use previous locale');
    assert.equal(runtime.status(id).activeTurn,false);language='de';
    mode='configured';await runtime.listen(id);turn=runtime.begin(id);
    assert.equal(runtime.complete(id,{turnId:turn.turnId,successful:true}).learning,false,'forced language probability cannot learn');
    mode='automatic';confidence=NaN;await runtime.listen(id);turn=runtime.begin(id);
    assert.equal(runtime.complete(id,{turnId:turn.turnId,successful:true}).learning,false);
    assert.equal(learning.load(root).learnedLocale,null);
    runtime.setPreference('tr');confidence=.96;
    await runtime.listen(id);turn=runtime.begin(id);assert.equal(turn.context.locale,'tr-TR');
    assert.equal(requests.at(-1).language,'tr-TR','explicit preference controls decoder');
    runtime.complete(id,{turnId:turn.turnId,successful:true});
    let release;blockCapture=new Promise(resolve=>release=resolve);
    const first=runtime.listen(id);
    const second=runtime.create({}).sessionId;
    await assert.rejects(runtime.listen(second),/busy/);release();await first;blockCapture=null;
    loaded=false;await assert.rejects(runtime.listen(id),/unavailable/);
    clock+=1800001;assert.throws(()=>runtime.status(id),/expired/);
    const profile=fs.readFileSync(path.join(root,'.jarvis-memory','language-profile.json'),'utf8');
    assert.equal(profile.includes('Guten Tag'),false,'no transcripts persisted');
    console.log('SPEECH RUNTIME SELFTEST PASS · runtime-locale uniqueness, regional ambiguity, inventory, learning, replay, isolation and expiry');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
