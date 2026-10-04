const assert=require('assert');
const v=require('./jarvis-final-target-verification');
function snap(url,account,target,forms=[],surfaceEvidence={sameOriginFrames:0,openShadowRoots:0,crossOriginFrames:false},tabId=''){return{url,targetEvidence:{account,target},forms,surfaceEvidence,tabEvidence:tabId?{targetId:tabId}:undefined}}
function form(action='/submit',button='Publish'){return[{action:'https://admin.shopify.com'+action,controls:[{tag:'input',type:'text',name:'title',id:'title',autocomplete:'',placeholder:'Product title',aria:'Title',text:''},{tag:'button',type:'submit',name:'',id:'publish',autocomplete:'',placeholder:'',aria:'',text:button}]}]}
const now=Date.parse('2026-10-04T12:00:00.000Z');
let r=v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now});
assert.strictEqual(r.ok,true);assert.strictEqual(r.approvalGranted,false);assert.strictEqual(r.version,'1.3');
assert.ok(!JSON.stringify(r).includes('owner@example.com'),'receipt must not expose account identity');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'wrong',expectedAction:'save-draft'},snap('https://studio.youtube.com/','owner@example.com','channel-123'),{nowMs:now}).ok,false);
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAction:'publish'},snap('https://studio.youtube.com.evil.test/','',''),{nowMs:now}).reason,'host_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},snap('https://admin.shopify.com/store/store-a','owner','store-b'),{nowMs:now}).reason,'target_mismatch');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedAction:'publish'},snap('https://admin.shopify.com/','','store-a'),{nowMs:now}).reason,'account_mismatch');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'save-draft'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+16000}),e=>e.code==='FINAL_TARGET_STALE');
assert.throws(()=>v.assertReceipt(r,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},snap('https://studio.youtube.com/video/x/edit','owner@example.com','channel-123'),{nowMs:now+1000}),e=>e.code==='FINAL_TARGET_CHANGED');

const yt=v.resourceEvidence('youtube','https://studio.youtube.com/video/AbC_123/edit');
assert.deepStrictEqual(yt,{kind:'video',id:'AbC_123'});
const ytSnap=snap('https://studio.youtube.com/video/AbC_123/edit','owner@example.com','channel-123',[],undefined,'tab-A-raw-id');
const ytResourceHash=v.resourceFingerprint('youtube',ytSnap);assert.match(ytResourceHash,/^[a-f0-9]{64}$/);
const ytTabHash=v.tabFingerprint(ytSnap);assert.match(ytTabHash,/^[a-f0-9]{64}$/);assert.ok(!ytTabHash.includes('tab-A-raw-id'));
const ytCaseVariant=snap('https://studio.youtube.com/video/abc_123/edit','owner@example.com','channel-123',[],undefined,'tab-A-raw-id');
assert.notStrictEqual(v.resourceFingerprint('youtube',ytCaseVariant),ytResourceHash,'case-sensitive YouTube IDs must not collapse to one hash');
const ytBound=v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish',expectedResource:'video:AbC_123',expectedResourceKind:'video'},ytSnap,{nowMs:now});
assert.strictEqual(ytBound.ok,true);assert.strictEqual(ytBound.resourceKind,'video');assert.strictEqual(ytBound.resourceHash,ytResourceHash);assert.strictEqual(ytBound.tabHash,ytTabHash);assert.ok(!JSON.stringify(ytBound).includes('AbC_123'),'receipt must hash resource ID rather than expose it');assert.ok(!JSON.stringify(ytBound).includes('tab-A-raw-id'),'receipt must never expose raw browser target IDs');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish',expectedResource:'video:AbC_123'},ytCaseVariant,{nowMs:now}).reason,'resource_mismatch');
assert.throws(()=>v.assertReceipt(ytBound,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},ytCaseVariant,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
const wrongVideo=snap('https://studio.youtube.com/video/def_999/edit','owner@example.com','channel-123',[],undefined,'tab-A-raw-id');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish',expectedResource:'AbC_123'},wrongVideo,{nowMs:now}).reason,'resource_mismatch');
assert.throws(()=>v.assertReceipt(ytBound,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},wrongVideo,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');

const sameContentOtherTab=snap('https://studio.youtube.com/video/AbC_123/edit','owner@example.com','channel-123',[],undefined,'tab-B-raw-id');
assert.notStrictEqual(v.tabFingerprint(sameContentOtherTab),ytTabHash,'different CDP tabs must have different tab fingerprints');
assert.throws(()=>v.assertReceipt(ytBound,{provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish'},sameContentOtherTab,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
assert.strictEqual(v.verifyFinalTarget({provider:'youtube',expectedAccount:'owner@example.com',expectedTarget:'channel-123',expectedAction:'publish',expectedTabHash:ytTabHash},sameContentOtherTab,{nowMs:now}).reason,'tab_mismatch');

const shopSnap=snap('https://admin.shopify.com/store/store-a/products/123','owner','store-a',form('/store/store-a/products/123','Publish'),{sameOriginFrames:1,openShadowRoots:2,crossOriginFrames:false},'shop-tab-1');
const shopResource=v.resourceEvidence('shopify',shopSnap.url);assert.deepStrictEqual(shopResource,{kind:'product',id:'123',store:'store-a'});
const fp=v.evidenceFingerprint(shopSnap,'shopify');
assert.strictEqual(fp.formHash,v.formFingerprint(shopSnap));assert.strictEqual(fp.surfaceHash,v.surfaceFingerprint(shopSnap));assert.strictEqual(fp.resourceHash,v.resourceFingerprint('shopify',shopSnap));assert.strictEqual(fp.tabHash,v.tabFingerprint(shopSnap));assert.match(fp.resourceHash,/^[a-f0-9]{64}$/);assert.match(fp.tabHash,/^[a-f0-9]{64}$/);assert.match(fp.formHash,/^[a-f0-9]{64}$/);assert.match(fp.surfaceHash,/^[a-f0-9]{64}$/);
const bound=v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedResource:'product:123',expectedResourceHash:fp.resourceHash,expectedResourceKind:'product',expectedTabHash:fp.tabHash,expectedFormHash:fp.formHash,expectedSurfaceHash:fp.surfaceHash},shopSnap,{nowMs:now});
assert.strictEqual(bound.ok,true);assert.strictEqual(bound.resourceHash,fp.resourceHash);assert.strictEqual(bound.tabHash,fp.tabHash);assert.strictEqual(bound.formHash,fp.formHash);assert.strictEqual(bound.surfaceHash,fp.surfaceHash);
assert.ok(!JSON.stringify(bound).includes('Product title'),'receipt must expose only form hash, never form field metadata');
assert.ok(!JSON.stringify(bound).includes('"123"'),'receipt must not expose product resource ID');
assert.ok(!JSON.stringify(bound).includes('shop-tab-1'),'receipt must not expose raw tab ID');

const wrongProduct=snap('https://admin.shopify.com/store/store-a/products/999','owner','store-a',form('/store/store-a/products/999','Publish'),shopSnap.surfaceEvidence,'shop-tab-1');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedResource:'product:123'},wrongProduct,{nowMs:now}).reason,'resource_mismatch');
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},wrongProduct,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
const wrongForm=snap(shopSnap.url,'owner','store-a',form('/store/store-a/products/999','Publish'),shopSnap.surfaceEvidence,'shop-tab-1');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedFormHash:fp.formHash},wrongForm,{nowMs:now}).reason,'form_mismatch');
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},wrongForm,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
const alteredControls=snap(shopSnap.url,'owner','store-a',form('/store/store-a/products/123','Delete'),shopSnap.surfaceEvidence,'shop-tab-1');
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},alteredControls,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
const alteredSurface=snap(shopSnap.url,'owner','store-a',shopSnap.forms,{sameOriginFrames:0,openShadowRoots:2,crossOriginFrames:false},'shop-tab-1');
assert.throws(()=>v.assertReceipt(bound,{provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish'},alteredSurface,{nowMs:now+500}),e=>e.code==='FINAL_TARGET_CHANGED');
assert.strictEqual(v.verifyFinalTarget({provider:'shopify',expectedAccount:'owner',expectedTarget:'store-a',expectedAction:'publish',expectedSurfaceHash:'0'.repeat(64)},shopSnap,{nowMs:now}).reason,'surface_mismatch');

console.log('FINAL TARGET VERIFICATION v192 SELFTEST PASS · tab + case-sensitive resource + URL/account/target/form/surface binding fail closed');
