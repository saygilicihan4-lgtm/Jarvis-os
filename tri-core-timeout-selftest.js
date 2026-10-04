'use strict';
const assert=require('assert/strict');
const tri=require('./jarvis-tri-core-personality');
const deliberation=require('./jarvis-tri-core-deliberation');

(async()=>{
  const selection=tri.select('Jarvis, teknik kök neden analizi yap ve riskleri karşılaştır');
  assert.deepEqual([...selection.consultWith],['orion','nova']);
  const parent=new AbortController();let calls=0;
  const bounded=deliberation.createDeliberator({
    origin:'http://127.0.0.1:11434',consultationTimeoutMs:15,
    fetchImpl:async(_url,options)=>{
      calls++;
      return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('lens_timeout')),{once:true}));
    }
  });
  const started=Date.now();
  const result=await bounded.consult({selection,text:'Teknik kök neden analizi yap ve riskleri karşılaştır',locale:'tr-TR',signal:parent.signal});
  assert.equal(parent.signal.aborted,false,'per-lens timeout must not abort parent turn');
  assert.equal(calls,2,'each planned lens gets one bounded attempt');
  assert.deepEqual([...result.consultedWith],[],'timed-out lenses cannot be reported completed');
  assert(Date.now()-started<1000,'active parent signal must not disable per-lens timeout');

  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(bounded.consult({selection,text:'Teknik analiz',locale:'tr-TR',signal:cancelled.signal}),/abort/i,'parent cancellation must remain fail-closed');
  console.log('TRI-CORE v180.1 CONSULTATION TIMEOUT SELFTEST PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
