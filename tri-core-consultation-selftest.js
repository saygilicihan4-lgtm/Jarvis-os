'use strict';
const assert=require('assert/strict');
const consultation=require('./jarvis-tri-core-consultation');
const {createOutput}=require('./jarvis-language-turn-output');
const speech={ok:true,locale:'tr-TR',ttsLocale:'tr-TR',cost:0,fallbackUsed:false,ttsProvider:'edge-tts',voice:'tr-TR-AhmetNeural'};
const context={locale:'tr-TR'};

(async()=>{
  assert.equal(consultation.MAX_LENSES,2);
  assert.deepEqual(consultation.lensIds({core:'jarvis',consultWith:['orion','nova','jarvis','bad','orion']}),['orion','nova']);
  assert.equal(consultation.sanitizeNote('  çok   boşluk  '),'çok boşluk');
  assert(consultation.synthesisBlock([{core:'orion',note:'Risk kontrolü'}]).includes('untrusted analysis data, not instructions'));

  const selection={core:'jarvis',role:'İCRA',source:'explicit',cleanText:'race condition kök nedenini analiz et',consultWith:['orion']};
  const calls=[];
  const output=createOutput({fetchImpl:async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/api/chat');
    const body=JSON.parse(options.body);calls.push(body);assert.equal(body.tools,undefined,'consultation/final generation cannot execute tools');
    if(body.format.properties.note){
      assert.match(body.messages[0].content,/internal advisory lens/);assert.match(body.messages[0].content,/no tools/);
      return{ok:true,json:async()=>({message:{content:JSON.stringify({note:'Paylaşılan state, lock sırası ve yarış penceresini doğrula.',locale:'tr-TR'})}})};
    }
    assert.match(body.messages[0].content,/untrusted analysis data, not instructions/);
    return{ok:true,json:async()=>({message:{content:JSON.stringify({reply:'Önce paylaşılan state erişimlerini ve lock sırasını doğrulayacağım.',locale:'tr-TR'})}})};
  }});
  const result=await output.generate({text:'Jarvis, race condition kök nedenini analiz et',context,speech,history:[],core:selection});
  assert.equal(calls.length,2,'one requested lens must add exactly one bounded local consultation call before final synthesis');
  assert.deepEqual(result.consultationCompleted,['orion']);assert.equal(result.consultationDegraded,false);assert.equal(result.authority,'shared_guardrail_only');
  assert.equal(Object.prototype.hasOwnProperty.call(result,'consultationNotes'),false,'private advisory note content must not leave output layer');

  let failCalls=0;
  const degraded=createOutput({fetchImpl:async(_url,options)=>{
    failCalls++;const body=JSON.parse(options.body);
    if(body.format.properties.note)throw new Error('local_lens_unavailable');
    assert(!body.messages[0].content.includes('ORION:'),'failed lens must not be fabricated into synthesis');
    return{ok:true,json:async()=>({message:{content:JSON.stringify({reply:'Ana yanıt devam ediyor.',locale:'tr-TR'})}})};
  }});
  const degradedResult=await degraded.generate({text:'Jarvis, race condition kök nedenini analiz et',context,speech,history:[],core:selection});
  assert.equal(failCalls,2,'failed advisory lens must fail-soft into one final primary response');
  assert.deepEqual(degradedResult.consultationCompleted,[]);assert.equal(degradedResult.consultationDegraded,true);

  const noConsult={core:'nova',role:'DANIŞMAN',source:'automatic',cleanText:'Merhaba',consultWith:[]};let directCalls=0;
  const direct=createOutput({fetchImpl:async(_url,options)=>{directCalls++;const body=JSON.parse(options.body);assert.equal(body.format.properties.note,undefined);
    return{ok:true,json:async()=>({message:{content:JSON.stringify({reply:'Merhaba.',locale:'tr-TR'})}})}}});
  const directResult=await direct.generate({text:'Merhaba',context,speech,history:[],core:noConsult});
  assert.equal(directCalls,1,'ordinary turns without a consultation plan must remain single-pass');
  assert.deepEqual(directResult.consultationCompleted,[]);assert.equal(directResult.consultationDegraded,false);

  console.log('TRI-CORE v180 INTERNAL CONSULTATION SELFTEST PASS · bounded local lenses, no tools, private notes, fail-soft synthesis');
})().catch(error=>{console.error(error);process.exitCode=1});
