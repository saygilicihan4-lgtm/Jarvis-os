'use strict';
const assert=require('assert/strict');
const {createRouter}=require('./jarvis-tts-locale-router');
const {createEngine}=require('./jarvis-mobile-language-conversation');
function runner(voices){return async()=>({ok:true,stdout:JSON.stringify(voices)})}
function voice(ShortName,Locale,Gender='Male'){return{ShortName,Locale,Gender,Enabled:true}}
(async()=>{
  const router=createRouter({runner:runner([
    voice('nl-NL-MaartenNeural','nl-NL'),voice('tr-TR-AhmetNeural','tr-TR'),voice('en-US-GuyNeural','en-US')
  ]),now:()=>1000});
  const exact=await router.resolve('nl-NL');
  assert.equal(exact.ok,true);assert.equal(exact.locale,'nl-NL');assert.equal(exact.ttsLocale,'nl-NL');assert.equal(exact.localeResolution,'exact');
  assert.equal(exact.evidenceLevel,'runtime_inventory');assert.equal(exact.voice,'nl-NL-MaartenNeural');

  const unique=await router.resolve('nl');
  assert.equal(unique.ok,true);assert.equal(unique.locale,'nl');assert.equal(unique.ttsLocale,'nl-NL');
  assert.equal(unique.localeResolution,'unique_runtime_language_match');assert.equal(unique.evidenceLevel,'runtime_inventory');

  const regional=await router.resolve('nl-BE');
  assert.equal(regional.ok,false);assert.equal(regional.reason,'tts_locale_not_in_runtime_inventory','regional request must not substitute a sibling locale');

  const ambiguousRouter=createRouter({runner:runner([
    voice('nl-NL-MaartenNeural','nl-NL'),voice('nl-BE-ArnaudNeural','nl-BE')
  ]),now:()=>1000});
  const ambiguous=await ambiguousRouter.resolve('nl');
  assert.equal(ambiguous.ok,false);assert.equal(ambiguous.reason,'runtime_tts_locale_ambiguous');assert.deepEqual(ambiguous.ttsCandidates,['nl-BE','nl-NL']);

  let generatedSpeech=null,generatedContext=null;
  const engine=createEngine({voiceRouter:router,output:{generate:async({context,speech})=>{generatedContext=context;generatedSpeech=speech;return{reply:'Hallo.',locale:context.locale}}}});
  const turn=await engine.turn({text:'hallo',locale:'nl',inputSource:'typed',history:[]});
  assert.equal(turn.ok,true);assert.equal(turn.state,'reply-ready');assert.equal(turn.locale,'nl');assert.equal(turn.ttsLocale,'nl-NL');
  assert.equal(turn.localeResolution,'unique_runtime_language_match');assert.equal(turn.speechEvidence,'runtime_inventory');
  assert.equal(generatedContext.locale,'nl');assert.equal(generatedSpeech.locale,'nl');assert.equal(generatedSpeech.ttsLocale,'nl-NL');
  assert.equal(generatedSpeech.localeResolution,'unique_runtime_language_match');assert.equal(generatedSpeech.evidenceLevel,'runtime_inventory');

  let generated=false;
  const blockedEngine=createEngine({voiceRouter:{resolve:async()=>({ok:false,reason:'runtime_tts_locale_ambiguous',ttsCandidates:['nl-BE','nl-NL']})},output:{generate:async()=>{generated=true;throw new Error('must_not_generate')}}});
  const blocked=await blockedEngine.turn({text:'hallo',locale:'nl',inputSource:'typed'});
  assert.equal(blocked.ok,false);assert.equal(blocked.reason,'runtime_tts_locale_ambiguous');assert.deepEqual(blocked.ttsCandidates,['nl-BE','nl-NL']);assert.equal(generated,false);

  console.log('MOBILE RUNTIME LOCALE SELFTEST PASS · exact/unique/ambiguous/regional locale resolution remains runtime-inventory-bound');
})().catch(error=>{console.error(error);process.exitCode=1});
