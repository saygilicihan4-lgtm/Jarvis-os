const assert=require('assert');
const v=require('./jarvis-final-target-verification');
function snap(url,account,target){return{url,targetEvidence:{account,target}}}
const now=Date.parse('2026-10-04T12:00:00.000Z');
let r=v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now});
assert.strictEqual(r.ok,true);assert.strictEqual(r.approvalGranted,false);
assert.ok(!JSON.stringify(r).includes('owner@example.com'),'receipt must not expose account identity');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'wrong',expectedAction:'save-draft'},snap('https://studio.youtube.com/','owner@example.com','channel-123'),{nowMs:now}).ok,false);
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAction:'publish'},snap('https://studio.youtube.com.evil.test/','',''),{nowMs:now}).reason,'host_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},snap('https://admin.shopify.com/store/store-a','owner','store-b'),{nowMs:now}).reason,'target_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedAction:'publish'},snap('https://admin.shopify.com/','','store-a'),{nowMs:now}).reason,'account_mismatch');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+16000}),e=>e.code==='FINAL_TARGET_STALE');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+1000}),e=>e.code==='FINAL_TARGET_CHANGED');
console.log('FINAL TARGET VERIFICATION SELFTEST PASS');
