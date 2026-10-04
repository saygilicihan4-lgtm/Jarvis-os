'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const tri=require('./jarvis-tri-core-personality');
const deliberation=require('./jarvis-tri-core-deliberation');
const {createOutput}=require('./jarvis-language-turn-output');

(async()=>{
  const secretText='Jarvis, race condition kök nedenini analiz et, riskleri karşılaştır; token=TOPSECRET123 password=qwerty987 87654321 Bearer abcdefghijklmnop sk-abcdefghijk https://user:pass@example.test/path';
  const redacted=deliberation.redactConsultationText(secretText);
  for(const forbidden of ['TOPSECRET123','qwerty987','87654321','abcdefghijklmnop','sk-abcdefghijk','user:pass'])assert(!redacted.includes(forbidden),'consultation redaction leaked '+forbidden);
  assert(redacted.includes('[REDACTED]')||redacted.includes('[REDACTED_SECRET]'),'redaction markers missing');

  const selected=tri.select(secretText);
  assert.equal(selected.core,'jarvis');
  assert.deepEqual([...selected.consultWith],['orion','nova'],'mixed technical/advisory request should plan ORION + NOVA');
  assert.deepEqual([...deliberation.sanitizePlan(selected)],['orion','nova']);
  assert.throws(()=>deliberation.createDeliberator({origin:'https://paid.example'}),/loopback/);
  assert.throws(()=>deliberation.createDeliberator({origin:'http://user:pass@localhost:11434'}),/loopback/);

  const consultantCalls=[];
  const consultantFetch=async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/api/chat');
    const body=JSON.parse(options.body);consultantCalls.push(body);
    assert.equal(body.tools,undefined,'consultation cannot receive tools');
    assert.equal(body.think,false,'consultation must not request hidden reasoning output');
    assert.deepEqual(body.format.required,['note']);
    assert.equal(body.messages.length,2,'consultant gets no conversation history fan-out');
    for(const forbidden of ['TOPSECRET123','qwerty987','87654321','abcdefghijklmnop','sk-abcdefghijk','user:pass'])assert(!body.messages[1].content.includes(forbidden),'consultation request leaked '+forbidden);
    const core=body.messages[0].content.includes('ORION')?'orion':'nova';
    return{ok:true,json:async()=>({message:{content:JSON.stringify({note:core==='orion'?'Kök nedeni ve yarış koşulu varsayımlarını doğrula.':'Alternatifleri etki ve risk açısından karşılaştır.'})}})};
  };
  const d=deliberation.createDeliberator({origin:'http://127.0.0.1:11434',fetchImpl:consultantFetch});
  const result=await d.consult({selection:selected,text:secretText,locale:'tr-TR'});
  assert.deepEqual([...result.consultedWith],['orion','nova']);assert.equal(result.notes.length,2);assert.equal(consultantCalls.length,2);assert.equal(result.mode,'local_advisory_only');
  const block=deliberation.advisoryBlock(result.notes);
  assert(block.includes('untrusted analysis only'));assert(block.includes('ORION:'));assert(block.includes('NOVA:'));

  let failCount=0;
  const failSoft=deliberation.createDeliberator({origin:'http://localhost:11434',fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body);failCount++;
    if(body.messages[0].content.includes('ORION'))throw new Error('local_model_busy');
    return{ok:true,json:async()=>({message:{content:JSON.stringify({note:'Riskleri sırala.'})}})};
  }});
  const partial=await failSoft.consult({selection:selected,text:'Teknik analiz yap ve riskleri karşılaştır',locale:'tr-TR'});
  assert.equal(failCount,2);assert.deepEqual([...partial.consultedWith],['nova'],'one consultant failure must not block the primary answer path');

  const aborter=new AbortController();aborter.abort();
  await assert.rejects(d.consult({selection:selected,text:'analiz et',locale:'tr-TR',signal:aborter.signal}),/abort/i,'turn cancellation must stop consultation');

  const calls=[];
  const output=createOutput({fetchImpl:async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/api/chat');
    const body=JSON.parse(options.body);calls.push(body);assert.equal(body.tools,undefined);
    if(body.format&&body.format.required&&body.format.required[0]==='note'){
      const core=body.messages[0].content.includes('ORION')?'ORION':'NOVA';
      return{ok:true,json:async()=>({message:{content:JSON.stringify({note:core+' kısa danışma notu.'})}})};
    }
    assert.deepEqual(body.format.required,['reply','locale']);
    assert(body.messages[0].content.includes('Runtime internal advisory notes follow.'),'final core did not receive completed advisory notes');
    assert(body.messages[0].content.includes('ORION:')&&body.messages[0].content.includes('NOVA:'),'final synthesis missing consultant notes');
    return{ok:true,json:async()=>({message:{content:JSON.stringify({reply:'Tek bir birleşik yanıt.',locale:'tr-TR'})}})};
  }});
  const speech={ok:true,locale:'tr-TR',ttsLocale:'tr-TR',localeResolution:'exact',evidenceLevel:'runtime_inventory',cost:0,fallbackUsed:false,ttsProvider:'edge-tts',voice:'tr-TR-AhmetNeural'};
  const generated=await output.generate({text:secretText,context:{locale:'tr-TR'},speech,history:[{role:'assistant',content:'Önceki konuşma yalnızca ana çekirdeğe gitmeli.'}],core:selected});
  assert.equal(calls.length,3,'two consultant passes plus one final synthesis expected');
  assert.deepEqual(generated.consultedWith,['orion','nova']);assert.equal(generated.consultationMode,'local_advisory_only');assert.equal(generated.authority,'shared_guardrail_only');
  assert(calls[2].messages.length>2,'primary synthesis should retain normal conversation history');

  const source=fs.readFileSync('jarvis-tri-core-deliberation.js','utf8');
  assert(!source.includes('localStorage')&&!source.includes('sessionStorage'),'deliberation must not persist data');
  assert(!source.includes('console.log')&&!source.includes('console.error'),'deliberation must not log consultation text or notes');
  assert(!/\bexecute\s*[:=(]/i.test(source)&&!/\bapprove\s*[:=(]/i.test(source)&&!/\bpublish\s*[:=(]/i.test(source),'deliberation must expose no action authority');
  console.log('TRI-CORE v180 REAL LOCAL DELIBERATION SELFTEST PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
