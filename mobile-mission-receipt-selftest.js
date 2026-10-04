'use strict';
const assert=require('assert/strict');
const actions=require('./public/mission-actions');

(()=>{
  const missionId='M-RECEIPT-AAAAAAAA';
  const req='0123456789abcdefabcd';
  const resolved={id:missionId,req,label:'ONAY · SECRET LABEL SHOULD NEVER ENTER RECEIPT'};
  const at=Date.parse('2026-10-04T16:00:00.000Z');

  const approved=actions.buildVerifiedReceipt('approve',resolved,{state:'approval_request_consumed'},at);
  assert.deepEqual(approved,{
    v:1,action:'approve',mission:'AAAAAAAA',req:'cdefabcd',proof:'approval_request_consumed',at:'2026-10-04T16:00:00.000Z'
  });
  const cancelled=actions.buildVerifiedReceipt('cancel',resolved,{state:'mission_closed'},at+1000);
  assert.equal(cancelled.action,'cancel');
  assert.equal(cancelled.proof,'mission_closed');
  assert.equal(cancelled.mission,'AAAAAAAA');
  assert.equal(cancelled.req,'cdefabcd');

  assert.throws(()=>actions.buildVerifiedReceipt('approve',resolved,{state:'mission_closed'},at),/mission_receipt_proof_invalid/);
  assert.throws(()=>actions.buildVerifiedReceipt('cancel',resolved,{state:'approval_request_consumed'},at),/mission_receipt_proof_invalid/);
  assert.throws(()=>actions.buildVerifiedReceipt('publish',resolved,{state:'approval_request_consumed'},at),/mission_receipt_proof_invalid/);
  assert.throws(()=>actions.buildVerifiedReceipt('approve',{id:'M-bad',req},{state:'approval_request_consumed'},at),/mission_receipt_target_invalid/);
  assert.throws(()=>actions.buildVerifiedReceipt('approve',{id:missionId,req:'0123456789'},{state:'approval_request_consumed'},at),/mission_receipt_target_invalid/);

  const serialized=JSON.stringify(approved);
  assert.equal(serialized.includes(missionId),false,'receipt must not persist full mission id');
  assert.equal(serialized.includes(req),false,'receipt must not persist full REQ fingerprint');
  assert.equal(serialized.includes('SECRET LABEL'),false,'receipt must not persist mission label');
  assert.deepEqual(Object.keys(approved).sort(),['action','at','mission','proof','req','v'].sort(),'receipt must expose only bounded safe fields');

  const approveText=actions.verifiedReceiptText(approved);
  assert.match(approveText,/DOĞRULANDI · ONAY/);
  assert.match(approveText,/M…AAAAAAAA/);
  assert.match(approveText,/REQ …cdefabcd/);
  assert.equal(approveText.includes(missionId),false);
  assert.equal(approveText.includes(req),false);
  assert.match(actions.verifiedReceiptText(cancelled),/İPTAL/);
  assert.match(actions.verifiedReceiptText(cancelled),/GÖREV KAPANDI/);

  assert.equal(actions.sanitizeVerifiedReceipt({...approved,proof:'mission_closed'}),null,'approval receipt cannot claim cancel proof');
  assert.equal(actions.sanitizeVerifiedReceipt({...cancelled,proof:'approval_request_consumed'}),null,'cancel receipt cannot claim approval proof');
  assert.equal(actions.sanitizeVerifiedReceipt({...approved,mission:'TOO-LONG-MISSION'}),null);
  assert.equal(actions.sanitizeVerifiedReceipt({...approved,req:'nothex00'}),null);

  const values=new Map();
  const fakeRoot={sessionStorage:{
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value))
  }};
  assert.equal(actions.readVerifiedReceipts(fakeRoot).length,0);
  assert.equal(actions.storeVerifiedReceipt(approved,fakeRoot),true);
  assert.deepEqual(actions.readVerifiedReceipts(fakeRoot),[approved]);
  assert.equal(values.get(actions.RECEIPT_STORAGE_KEY).includes(missionId),false);
  assert.equal(values.get(actions.RECEIPT_STORAGE_KEY).includes(req),false);

  for(let i=0;i<12;i++){
    actions.storeVerifiedReceipt(actions.buildVerifiedReceipt(
      i%2?'approve':'cancel',resolved,
      {state:i%2?'approval_request_consumed':'mission_closed'},
      at+2000+i*1000
    ),fakeRoot);
  }
  const bounded=actions.readVerifiedReceipts(fakeRoot);
  assert.equal(bounded.length,actions.RECEIPT_LIMIT);
  assert.equal(actions.RECEIPT_LIMIT,8);
  assert.ok(bounded.every(row=>actions.sanitizeVerifiedReceipt(row)));

  values.set(actions.RECEIPT_STORAGE_KEY,JSON.stringify([
    approved,
    {v:1,action:'approve',mission:'AAAAAAAA',req:'cdefabcd',proof:'mission_closed',at:'2026-10-04T16:00:00.000Z'},
    {payload:'secret',input:'secret'}
  ]));
  assert.deepEqual(actions.readVerifiedReceipts(fakeRoot),[approved],'malformed or forged stored receipts must be discarded');

  const source=require('fs').readFileSync('./public/mission-actions.js','utf8');
  assert.ok(source.includes('const verified=await runActionWithProof(action,resolved,{fetchImpl})'),'receipt must be downstream of full Worker+state proof');
  assert.ok(source.includes('const receipt=buildVerifiedReceipt(action,resolved,verified.proof)'),'receipt must bind to verified proof state');
  assert.ok(source.indexOf('const verified=await runActionWithProof')<source.indexOf('storeVerifiedReceipt(receipt,targetRoot)'),'receipt cannot be stored before proof completes');

  console.log('MOBILE MISSION RECEIPT SELFTEST PASS · proof-gated · privacy-safe · bounded session ledger');
})();