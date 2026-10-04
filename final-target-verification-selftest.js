const assert=require('assert');
const v=require('./jarvis-final-target-verification');
function snap(url,account,target,forms=[],surfaceEvidence={sameOriginFrames:0,openShadowRoots:0,crossOriginFrames:false}){return{url,targetEvidence:{account,target},forms,surfaceEvidence}}
function form(action='/submit',button='Publish'){return[{action:'https://admin.shopify.com'+action,controls:[{tag:'input',type:'text',name:'title',id:'title',autocomplete:'',placeholder:'Product title',aria:'Title',text:''},{tag:'button',type:'submit',name:'',id:'publish',autocomplete:'',placeholder:'',aria:'',text:button}]}]}
const now=Date.parse('2026-10-04T12:00:00.000Z');
let r=v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now});
assert.strictEqual(r.ok,true);assert.strictEqual(r.approvalGranted,false);assert.strictEqual(r.version,'1.1');
assert.ok(!JSON.stringify(r).includes('owner@example.com'),'receipt must not expose account identity');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'wrong',expectedAction:'save-draft'},snap('https://studio.youtube.com/','owner@example.com','channel-123'),{nowMs:now}).ok,false);
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAction:'publish'},snap('https://studio.youtube.com.evil.test/','',''),{nowMs:now}).reason,'host_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},snap('https://admin.shopify.com/store/store-a','owner','store-b'),{nowMs:now}).reason,'target_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedAction:'publish'},snap('https://admin.shopify.com/','','store-a'),{nowMs:now}).reason,'account_mismatch');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+16000}),e=>e.code==='FINAL_TARGET_STALE');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+1000}),e=>e.code==='FINAL_TARGET_CHANGED');

const shopSnap=snap('https://admin.shopify.com/store/store-a/products/123','owner','store-a',form('/store/store-a/products/123','Publish'),{sameOriginFrames:1,openShadowRoots:2,crossOriginFrames:false});
const fp=v.evidenceFingerprint(shopSnap);
assert.strictEqual(fp.formHash,v.formFingerprint(shopSnap));assert.strictEqual(fp.surfaceHash,v.surfaceFingerprint(shopSnap));assert.match(fp.formHash,/^[a-f0-9]{64}$/);assert.match(fp.surfaceHash,/^[a-f0-9]{64}$/);
const bound=v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedFormHash:fp.formHash,expectedSurfaceHash:fp.surfaceHash},shopSnap,{nowMs:now});
assert.strictEqual(bound.ok,true);assert.strictEqual(bound.formHash,fp.formHash);assert.strictEqual(bound.surfaceHash,fp.surfaceHash);
assert.ok(!JSON.stringify(bound).includes('Product title'),'receipt must expose only form hash, never form field metadata');

const wrongForm=snap(shopSnap.url,'owner','store-a',form('/store/store-a/products/999','Publish'),shopSnap.surfaceEvidence);
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedFormHash:fp.formHash},wrongForm,{nowMs:now}).reason,'form_mismatch');
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedFormHash:fp.formHash,expectedSurfaceHash:fp.surfaceHash},wrongForm,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');

const alteredControls=snap(shopSnap.url,'owner','store-a',form('/store/store-a/products/123','Delete'),shopSnap.surfaceEvidence);
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},alteredControls,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
const alteredSurface=snap(shopSnap.url,'owner','store-a',shopSnap.forms,{sameOriginFrames:0,openShadowRoots:2,crossOriginFrames:false});
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},alteredSurface,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedSurfaceHash:'0'.repeat(64)},shopSnap,{nowMs:now}).reason,'surface_mismatch');

console.log('FINAL TARGET VERIFICATION v188 SELFTEST PASS · URL/account/target + live form structure + surface binding fail closed');
