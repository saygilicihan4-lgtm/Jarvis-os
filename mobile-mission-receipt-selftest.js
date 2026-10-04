'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync('./public/mission-actions.js','utf8');
const missionId='M-RECEIPT-AAAAAAAA';
const req='0123456789abcdefabcd';
const sensitive='PRIVATE_PAYLOAD_TOKEN_URL_SECRET';
const rawRequestId='approval-request-private-123456789';
const label='ONAY · '+sensitive+' · REQ '+req;
const mission={id:missionId,label,status:'waiting_dependency',step:{status:'blocked',dependency:'approval'}};
const resolved={id:missionId,req,label,mission};
const stateOf=queue=>({workers:{pc:{online:true,missions:{ok:true,openCount:queue.length,queue}}}});
const response=data=>({ok:true,status:200,json:async()=>data});
const plain=value=>JSON.parse(JSON.stringify(value));

// Execute the shipped module and act() with a virtual clock, real async gates,
// and fake HTTP/DOM/storage boundaries. No real Worker or PUBLIC action runs.
function harness(action,options={}){
  let clock=Date.parse('2026-10-04T16:00:00.000Z');
  const mod={exports:{}};
  class TestDate extends Date {static now(){return clock}}
  vm.runInNewContext(source,{module:mod,Date:TestDate,URLSearchParams,
    setTimeout(fn,ms){clock+=ms;Promise.resolve().then(fn)}});
  const actions=mod.exports,values=new Map(),writes=[],calls=[];
  const status={textContent:''},buttons=[{disabled:false},{disabled:false}];
  let releaseProof;
  const gate=new Promise(resolve=>{releaseProof=resolve});
  let stateCalls=0;
  const root={document:{getElementById:id=>id==='consoleStatus'?status:null},
    sessionStorage:{getItem:key=>values.get(key)||null,
      setItem(key,value){values.set(key,String(value));writes.push(String(value))},
      removeItem:key=>values.delete(key)},
    load:options.load||(()=>Promise.resolve()),
    fetch:async(url,init)=>{
      calls.push({url,init});
      if(url==='/api/state'){
        stateCalls++;
        if(stateCalls===1)return response(options.initialState||stateOf([mission]));
        if(options.holdProof)await gate;
        return response(options.proofState===undefined?stateOf([]):options.proofState);
      }
      if(url==='/api/mobile-brain')return response({id:'abcd1234-abcd'});
      if(url==='/api/mobile-brain/abcd1234-abcd'){
        if(options.workerError)throw new Error(sensitive+' https://example.invalid/?token='+sensitive);
        const message=options.missingWorkerReceipt?'Komut alındı.':action==='approve'?'AÇIK ONAY UYGULANDI':'MISSION İPTAL EDİLDİ';
        return response({status:'ready',result:{ok:true,reply:message+' · '+sensitive,
          approvalRequestId:rawRequestId,payload:{input:sensitive},credential:sensitive}});
      }
      throw new Error('Unexpected test URL');
    }};
  if(options.storageBlocked)Object.defineProperty(root,'sessionStorage',{get(){throw new Error('SecurityError')}});
  const card={textContent:label,dataset:{jarvisMissionId:missionId},
    querySelector:()=>({textContent:options.cardLabel||label}),querySelectorAll:()=>buttons};
  return{actions,root,card,values,writes,calls,status,buttons,releaseProof,run:()=>actions.act(card,action,root)};
}

(async()=>{
  for(const action of ['approve','cancel']){
    const h=harness(action,{holdProof:true});
    const pending=h.run();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.buttons.every(b=>b.disabled),true);
    assert.equal(h.writes.length,0,'receipt must not exist while durable proof is pending');
    assert.equal(h.status.textContent.includes('DOĞRULANDI'),false);
    h.releaseProof();
    assert.equal(await pending,true);
    assert.equal(h.buttons.every(b=>!b.disabled),true);
    const rows=plain(h.actions.readVerifiedReceipts(h.root));
    assert.equal(rows.length,1);
    const receipt=rows[0];
    assert.deepEqual(Object.keys(receipt).sort(),['v','action','mission','req','proof','state','at'].sort());
    assert.equal(receipt.action,action);
    assert.equal(receipt.mission,'AAAAAAAA');
    assert.equal(receipt.req,'cdefabcd');
    assert.equal(receipt.proof,'worker_receipt+durable_state');
    assert.equal(receipt.state,action==='approve'?'approval_request_consumed':'mission_closed');
    assert.ok(Number.isFinite(Date.parse(receipt.at)));
    assert.ok(h.status.textContent.includes(receipt.at),'visible receipt must include timestamp');
    assert.ok(h.status.textContent.includes(action==='approve'?'REQ TÜKETİLDİ':'GÖREV KAPANDI'));
    assert.equal(h.writes.length,1);
    for(const forbidden of [missionId,req,label,sensitive,rawRequestId,'payload','credential','https://']){
      assert.equal(h.writes.join('').includes(forbidden),false,'storage leaked '+forbidden);
      assert.equal(h.status.textContent.includes(forbidden),false,'receipt display leaked '+forbidden);
    }
    const submitted=JSON.parse(h.calls.find(c=>c.url==='/api/mobile-brain').init.body);
    assert.equal(submitted.message,(action==='approve'?'onayla ':'iptal et ')+missionId+' req '+req);

    for(const options of [
      {missingWorkerReceipt:true},
      {proofState:stateOf([mission])},
      {initialState:stateOf([{...mission,label:label.replace(req,'fedcba9876543210abcd')}])},
      {initialState:stateOf([{...mission,id:'M-OTHER-BBBBBBBB'}])},
      {cardLabel:'Wrong rendered label'},
      {workerError:true},
      {proofState:{}},
      {proofState:{workers:{pc:{online:false,missions:{ok:true,openCount:0,queue:[]}}}}},
      {proofState:{workers:{pc:{online:true,missions:{ok:false,openCount:0,queue:[]}}}}},
      {proofState:{workers:{pc:{online:true,missions:{ok:true,openCount:9,queue:[]}}}}},
      {proofState:stateOf([mission,mission])},
      {proofState:stateOf([{...mission,step:null}])},
      {proofState:stateOf([{...mission,label:'ONAY · malformed REQ'}])}
    ]){
      const failed=harness(action,options);
      assert.equal(await failed.run(),false,JSON.stringify(options));
      assert.equal(failed.writes.length,0,'failed proof must never persist a receipt');
      assert.equal(failed.status.textContent.includes('DOĞRULANDI'),false);
      assert.equal(failed.status.textContent.includes(sensitive),false,'raw failure must not leak');
      assert.equal(failed.buttons.every(b=>!b.disabled),true);
      if(options.initialState||options.cardLabel)assert.equal(failed.calls.some(c=>c.url==='/api/mobile-brain'),false);
    }
    for(const options of [{storageBlocked:true},{load(){throw new Error('refresh failed')}},{load:()=>undefined}]){
      const h=harness(action,options);
      assert.equal(await h.run(),true,'optional display/storage failure cannot undo successful proof');
      assert.ok(h.status.textContent.includes('DOĞRULANDI'));
    }
  }

  const h=harness('approve'),a=h.actions;
  await h.run();
  const approved=plain(a.readVerifiedReceipts(h.root)[0]);
  // A proof-shaped object, a bare durable proof, or another decision's proof is
  // not enough: only runActionWithProof can register receipt evidence.
  assert.throws(()=>a.buildVerifiedReceipt('approve',resolved,{ok:true,state:'approval_request_consumed'}),/mission_receipt_proof_invalid/);
  let clock=0;
  const opts={now:()=>clock++,wait:async()=>{},fetchImpl:async url=>response(
    url==='/api/mobile-brain'?{id:'abcd1234-abcd'}:
    url==='/api/state'?stateOf([]):{status:'ready',result:{message:'AÇIK ONAY UYGULANDI'}})};
  const bare=await a.waitForActionProof('approve',missionId,req,opts);
  assert.throws(()=>a.buildVerifiedReceipt('approve',resolved,bare),/mission_receipt_proof_invalid/);
  const verified=await a.runActionWithProof('approve',resolved,opts);
  assert.doesNotThrow(()=>a.buildVerifiedReceipt('approve',resolved,verified.proof));
  assert.throws(()=>a.buildVerifiedReceipt('approve',{...resolved,req:'fedcba9876543210abcd'},verified.proof),/mission_receipt_proof_invalid/);
  assert.throws(()=>a.buildVerifiedReceipt('approve',{...resolved,id:'M-OTHER-BBBBBBBB'},verified.proof),/mission_receipt_proof_invalid/);
  assert.throws(()=>a.buildVerifiedReceipt('cancel',resolved,verified.proof),/mission_receipt_proof_invalid/);
  assert.throws(()=>a.buildVerifiedReceipt('publish',resolved,verified.proof),/mission_receipt_proof_invalid/);
  assert.equal(Object.isFrozen(verified.proof),true);

  for(const bad of [{v:2},{at:'2026-02-30T16:00:00.000Z'},{at:'2026-99-99T16:00:00.000Z'},
    {req:'nothex00'},{mission:'TOO-LONG-MISSION'},{state:'mission_closed'},{proof:sensitive}]){
    assert.equal(a.sanitizeVerifiedReceipt({...approved,...bad}),null);
  }
  assert.deepEqual(plain(a.sanitizeVerifiedReceipt({...approved,payload:sensitive})),approved);
  for(let i=0;i<12;i++)a.storeVerifiedReceipt({...approved,at:new Date(Date.parse(approved.at)+i*1000).toISOString()},h.root);
  const bounded=plain(a.readVerifiedReceipts(h.root));
  assert.equal(bounded.length,a.RECEIPT_LIMIT);
  assert.equal(a.RECEIPT_LIMIT,8);
  assert.equal(bounded.at(-1).at,new Date(Date.parse(approved.at)+11000).toISOString());
  assert.ok(h.values.get(a.RECEIPT_STORAGE_KEY).length<a.RECEIPT_STORAGE_MAX);

  for(const raw of ['{bad',JSON.stringify({payload:sensitive}),'x'.repeat(a.RECEIPT_STORAGE_MAX+1)]){
    h.values.set(a.RECEIPT_STORAGE_KEY,raw);
    assert.equal(a.readVerifiedReceipts(h.root).length,0);
    assert.equal(h.values.has(a.RECEIPT_STORAGE_KEY),false,'malformed storage must be removed');
  }
  h.values.set(a.RECEIPT_STORAGE_KEY,JSON.stringify([{...approved,payload:sensitive},{payload:sensitive}]));
  assert.deepEqual(plain(a.readVerifiedReceipts(h.root)),[approved]);
  assert.equal(h.values.get(a.RECEIPT_STORAGE_KEY).includes(sensitive),false,'unknown fields must be scrubbed from storage');
  for(const fail of ['getItem','setItem']){
    const root={sessionStorage:{...h.root.sessionStorage,[fail](){throw new Error('SecurityError')}}};
    if(fail==='getItem')assert.equal(a.readVerifiedReceipts(root).length,0);
    else assert.equal(a.storeVerifiedReceipt(approved,root),false);
  }
  console.log('MOBILE MISSION RECEIPT SELFTEST PASS · real act flow · proof-gated · privacy-safe · bounded storage · fail-closed state');
})().catch(error=>{console.error(error);process.exitCode=1});
