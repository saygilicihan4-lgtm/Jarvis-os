const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const engine=require('./jarvis-commerce-engine');
const missionEngine=require('./jarvis-mission-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.0');
assert.strictEqual(engine.DEFAULT_API_VERSION,'2026-10');
assert.strictEqual(engine.SHOPIFY_FINAL_TARGET_VERSION,1);
assert.strictEqual(engine.SHOPIFY_PUBLIC_ACTION,'PUBLISH_PRODUCT');
assert.strictEqual(engine.normalizeShopDomain('https://varora-v.myshopify.com/admin'),'varora-v.myshopify.com');
assert.throws(()=>engine.normalizeShopDomain('bad domain'));

const p=engine.normalizeProduct({
  title:'  V-GAP   Organizer ',description:'Telefonunuz artık koltuk arasına düşmesin.',price:'499,90',
  tags:'otomobil, organizer, otomobil',images:['https://example.com/a.jpg']
});
assert.strictEqual(p.title,'V-GAP Organizer');
assert.strictEqual(p.price,499.90);
assert.deepStrictEqual(p.tags,['otomobil','organizer']);
assert.ok(p.descriptionHtml.includes('<p>'));
assert.strictEqual(p.vendor,'VAROVA');

const payload=engine.productSetPayload({title:'V-GAP Organizer',price:499.90,description:'Test',tags:['VAROVA']},{status:'DRAFT'});
assert.strictEqual(payload.input.status,'DRAFT');
assert.strictEqual(payload.input.title,'V-GAP Organizer');
assert.ok(!payload.input.variants,'Simple product should let Shopify create the default variant first');
const variants=engine.productSetPayload({
  title:'Renkli Organizer',variants:[
    {price:100,options:[{name:'Renk',value:'Siyah'}]},
    {price:110,options:[{name:'Renk',value:'Kirmizi'}]}
  ]
},{status:'DRAFT'});
assert.strictEqual(variants.input.productOptions[0].name,'Renk');
assert.strictEqual(variants.input.variants.length,2);
const parsed=engine.parseKeyValueProduct('V-GAP Organizer | fiyat=499,90 | etiket=araba,organizer | açıklama=Koltuk arası düzenleyici');
assert.strictEqual(parsed.title,'V-GAP Organizer');
assert.strictEqual(parsed.price,'499,90');
assert.strictEqual(parsed.description,'Koltuk arası düzenleyici');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-'));
const draft=engine.saveLocalDraft(tmp,{title:'Deneme',price:50});
assert.strictEqual(draft.ok,true);
assert.ok(fs.existsSync(draft.file));
assert.strictEqual(engine.missionTag('M-ABC-123'),'jarvis_mission_M-ABC-123');
for(const name of ['findProductByMission','createDraftForMission','resolveShopifyPublishApproval','assertActiveProduct','assertPublishedOnPublication',
  'buildShopifyFinalTargetLock','assertShopifyFinalTargetLock','verifyShopifyFinalTargetOnline','safeShopifyFinalTargetProof']){
  assert.ok(typeof engine[name]==='function',name+' missing');
}

const STORE='varora-v.myshopify.com';
const OTHER_STORE='other-store.myshopify.com';
const STORE_HASH=engine.privacyHash(STORE);
const gid='gid://shopify/Product/123456789';
const otherGid='gid://shopify/Product/999999999';
const publication={id:'gid://shopify/Publication/987654321',name:'Online Store'};
const otherPublication={id:'gid://shopify/Publication/111111111',name:'Online Store'};

const activeProduct=engine.assertActiveProduct({product:{id:gid,title:'V-GAP Organizer',status:'ACTIVE'}},gid);
assert.strictEqual(activeProduct.id,gid);
assert.strictEqual(activeProduct.status,'ACTIVE');
assert.throws(()=>engine.assertActiveProduct({product:{id:gid,title:'V-GAP Organizer',status:'DRAFT'}},gid),err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED');
assert.throws(()=>engine.assertActiveProduct({product:{id:otherGid,status:'ACTIVE'}},gid),err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED');
assert.throws(()=>engine.assertActiveProduct({},gid),err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED');
assert.strictEqual(engine.assertPublishedOnPublication({publishable:{publishedOnPublication:true}},publication),true);
assert.throws(()=>engine.assertPublishedOnPublication({publishable:{publishedOnPublication:false}},publication),err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED');
assert.throws(()=>engine.assertPublishedOnPublication({publishable:{}},publication),err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED');
assert.throws(()=>engine.assertPublishedOnPublication({publishable:{publishedOnPublication:true}},null),err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED');

const commerceSource=fs.readFileSync(path.join(__dirname,'jarvis-commerce-engine.js'),'utf8');
const publishStart=commerceSource.indexOf('async function publishProduct(workspace,productId,opts={})');
const publicationPreflight=commerceSource.indexOf('const publication=await findOnlineStorePublication(creds,request);',publishStart);
const firstFinalTarget=commerceSource.indexOf('const activeCreds=await recheckFinalTarget();',publishStart);
const activeMutation=commerceSource.indexOf('mutation JarvisActivateProduct',publishStart);
const secondFinalTarget=commerceSource.indexOf('publishCreds=await recheckFinalTarget()',publishStart);
const publishMutation=commerceSource.indexOf('mutation JarvisPublishProduct',publishStart);
const publishReceipt=commerceSource.indexOf("const receipt=path.join(dirs.receipts,'publish-'",publishStart);
assert.ok(publishStart>=0&&publicationPreflight>publishStart&&firstFinalTarget>publicationPreflight&&activeMutation>firstFinalTarget,
  'read-only final-target verification must happen immediately before ACTIVE mutation');
assert.ok(secondFinalTarget>activeMutation&&publishMutation>secondFinalTarget,
  'final target must be reverified after ACTIVE and before publication mutation');
assert.ok(publishReceipt>publishMutation,'Success receipt must happen only after publication mutation verification');
assert.ok(!commerceSource.includes('shop:creds.shop,\n    apiVersion'),'raw shop domain must not be persisted in receipts');

const approvalRoot=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-approval-'));
const missionDir=path.join(approvalRoot,'.jarvis-missions');
fs.mkdirSync(missionDir,{recursive:true});
const missionId='M-ABCDEF123456';
const missionFile=path.join(missionDir,missionId+'.json');
const FIXED_NOW=Date.parse('2026-10-04T00:03:00.000Z');
function missionFixture({productId=gid,storeHash=STORE_HASH,id=missionId}={}){
  const mission={
    schema:1,engine:'JARVIS_MISSION_ENGINE',version:'1.0',id,type:'shopify_product',status:'running',
    createdAt:'2026-10-04T00:00:00.000Z',updatedAt:'2026-10-04T00:02:00.000Z',completedAt:null,currentStep:1,
    input:{publishRequested:true},artifacts:{},history:[],
    steps:[
      {index:0,name:'shopify_draft',status:'completed',attempts:1,startedAt:'2026-10-04T00:00:10.000Z',completedAt:'2026-10-04T00:01:00.000Z',error:null,
       artifact:{product:{id:productId,title:'V-GAP Organizer',status:'DRAFT',_jarvisStoreHash:storeHash}},meta:{}},
      {index:1,name:'shopify_publish',status:'running',attempts:1,startedAt:'2026-10-04T00:02:00.000Z',completedAt:null,error:null,artifact:null,
       meta:{requiresApproval:true,approvedAt:'2026-10-04T00:01:30.000Z'}}
    ]
  };
  mission.artifacts.shopify_draft=JSON.parse(JSON.stringify(mission.steps[0].artifact));
  const lifecycle=require('./jarvis-approval-lifecycle');
  const step=mission.steps[1],at=Date.parse(step.meta.approvedAt);
  mission.status='waiting_dependency';step.status='blocked';step.error={dependency:'approval'};
  lifecycle.requestApproval(mission,at);
  assert.strictEqual(lifecycle.grantApproval(mission,{surface:'shopify',targetReason:'explicit_surface',nowMs:at}).ok,true);
  mission.status='running';step.status='running';step.error=null;
  return mission;
}
function saveMission(mission){fs.writeFileSync(path.join(missionDir,mission.id+'.json'),JSON.stringify(mission,null,2),'utf8')}
function requiresApproval(fn){assert.throws(fn,err=>err&&err.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED')}

requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
let mission=missionFixture();saveMission(mission);
let proof=engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW});
assert.strictEqual(proof.missionId,missionId);
assert.strictEqual(proof.productId,gid);
assert.strictEqual(proof.draftShopHash,STORE_HASH);
assert.strictEqual(proof.approvedAt,'2026-10-04T00:01:30.000Z');

const lock=engine.buildShopifyFinalTargetLock({shop:STORE,productId:gid,publicationId:publication.id,action:'PUBLISH_PRODUCT',approval:proof});
assert.strictEqual(lock.draftShopHash,STORE_HASH);
assert.strictEqual(engine.assertShopifyFinalTargetLock(lock,{shop:STORE,productId:gid,publicationId:publication.id,action:'PUBLISH_PRODUCT',approval:proof}),true);
const safeProof=engine.safeShopifyFinalTargetProof(lock,{verifiedAt:'2026-10-04T00:03:00.000Z'});
assert.strictEqual(safeProof.approvalGranted,false,'final target proof must never grant approval');
assert.strictEqual(safeProof.storeHash,STORE_HASH);
assert.ok(!JSON.stringify(safeProof).includes(STORE),'raw store/account must not enter final target proof');
assert.throws(()=>engine.assertShopifyFinalTargetLock(lock,{shop:OTHER_STORE,productId:gid,publicationId:publication.id,action:'PUBLISH_PRODUCT',approval:proof}),err=>err&&err.code==='SHOPIFY_FINAL_TARGET_STORE_CHANGED');
assert.throws(()=>engine.assertShopifyFinalTargetLock(lock,{shop:STORE,productId:otherGid,publicationId:publication.id,action:'PUBLISH_PRODUCT',approval:proof}),err=>err&&err.code==='SHOPIFY_FINAL_TARGET_PRODUCT_CHANGED');
assert.throws(()=>engine.assertShopifyFinalTargetLock(lock,{shop:STORE,productId:gid,publicationId:otherPublication.id,action:'PUBLISH_PRODUCT',approval:proof}),err=>err&&err.code==='SHOPIFY_FINAL_TARGET_PUBLICATION_CHANGED');
assert.throws(()=>engine.assertShopifyFinalTargetLock(lock,{shop:STORE,productId:gid,publicationId:publication.id,action:'DELETE_PRODUCT',approval:proof}),err=>err&&err.code==='SHOPIFY_FINAL_TARGET_ACTION_CHANGED');

mission=missionFixture();mission.steps[1].meta.approvedAt='yes';saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
mission=missionFixture();mission.steps[1].meta.approvedAt='2026-10-04T00:00:30.000Z';saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
mission=missionFixture();mission.steps[1].meta.approvedAt='2026-10-04T00:04:00.000Z';saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
mission=missionFixture();mission.steps[1].status='completed';mission.status='completed';saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
mission=missionFixture();mission.steps[0].artifact.product.id=otherGid;mission.artifacts.shopify_draft.product.id=otherGid;saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));
mission=missionFixture();delete mission.steps[0].artifact.product._jarvisStoreHash;delete mission.artifacts.shopify_draft.product._jarvisStoreHash;saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:FIXED_NOW}));

function fakeHarness({currentStore=STORE,remotePublication=publication,changeOnVerify=0,throwStage='' }={}){
  const calls={read:0,verify:0,active:0,publish:0,mutations:0};
  const creds={ready:true,shop:currentStore,apiVersion:'2026-10',token:'TOP_SECRET_SHOPIFY_TOKEN'};
  const request=async(_creds,query,variables)=>{
    if(query.includes('JarvisPublications')){
      calls.read++;
      return{publications:{nodes:[publication]}};
    }
    if(query.includes('JarvisShopifyFinalTarget')){
      calls.read++;calls.verify++;
      const changed=changeOnVerify>0&&calls.verify>=changeOnVerify;
      return{
        shop:{myshopifyDomain:changed?OTHER_STORE:currentStore},
        product:{id:gid},
        publications:{nodes:[changed?otherPublication:remotePublication]}
      };
    }
    if(query.includes('JarvisActivateProduct')){
      calls.active++;calls.mutations++;
      if(throwStage==='active')throw new Error('simulated transport loss after ACTIVE dispatch');
      return{productUpdate:{product:{id:gid,title:'V-GAP Organizer',status:'ACTIVE'},userErrors:[]}};
    }
    if(query.includes('JarvisPublishProduct')){
      calls.publish++;calls.mutations++;
      if(throwStage==='publish')throw new Error('simulated transport loss after publish dispatch');
      return{publishablePublish:{publishable:{publishedOnPublication:true},userErrors:[]}};
    }
    throw new Error('Unexpected GraphQL operation');
  };
  return{calls,creds,request,resolveCredentials:()=>creds};
}

async function run(){
  const noProofRoot=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-no-proof-'));
  const noApproval=fakeHarness();
  await assert.rejects(engine.publishProduct(noProofRoot,gid,{request:noApproval.request,resolveCredentials:noApproval.resolveCredentials,nowMs:FIXED_NOW}),
    err=>err&&err.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED');
  assert.strictEqual(noApproval.calls.mutations,0);
  assert.strictEqual(noApproval.calls.read,0);

  mission=missionFixture({productId:otherGid});saveMission(mission);
  const wrongProduct=fakeHarness();
  await assert.rejects(engine.publishProduct(approvalRoot,gid,{request:wrongProduct.request,resolveCredentials:wrongProduct.resolveCredentials,nowMs:FIXED_NOW}),
    err=>err&&err.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED');
  assert.strictEqual(wrongProduct.calls.mutations,0);

  mission=missionFixture();saveMission(mission);
  const wrongStore=fakeHarness({currentStore:OTHER_STORE});
  await assert.rejects(engine.publishProduct(approvalRoot,gid,{request:wrongStore.request,resolveCredentials:wrongStore.resolveCredentials,nowMs:FIXED_NOW}),
    err=>err&&err.code==='SHOPIFY_FINAL_TARGET_STORE_MISMATCH');
  assert.strictEqual(wrongStore.calls.mutations,0);

  mission=missionFixture();saveMission(mission);
  const wrongPub=fakeHarness({remotePublication:otherPublication});
  await assert.rejects(engine.publishProduct(approvalRoot,gid,{request:wrongPub.request,resolveCredentials:wrongPub.resolveCredentials,nowMs:FIXED_NOW}),
    err=>err&&err.code==='SHOPIFY_FINAL_TARGET_PUBLICATION_MISMATCH');
  assert.strictEqual(wrongPub.calls.mutations,0);

  mission=missionFixture();saveMission(mission);
  const good=fakeHarness();
  const out=await engine.publishProduct(approvalRoot,gid,{request:good.request,resolveCredentials:good.resolveCredentials,nowMs:FIXED_NOW});
  assert.strictEqual(out.ok,true);
  assert.strictEqual(good.calls.active,1);
  assert.strictEqual(good.calls.publish,1);
  assert.strictEqual(good.calls.verify,2);
  assert.strictEqual(out.finalTarget.approvalGranted,false);
  const receiptText=fs.readFileSync(out.receipt,'utf8');
  assert.ok(!receiptText.includes(STORE),'raw store/account must not leak into publish receipt');
  assert.ok(!receiptText.includes('TOP_SECRET_SHOPIFY_TOKEN'),'raw token must not leak into publish receipt');
  assert.ok(!receiptText.includes('owner@example.test'),'raw account/email must not leak into publish receipt');
  assert.ok(receiptText.includes(STORE_HASH),'privacy-safe store hash should be retained');

  mission=missionFixture();saveMission(mission);
  const changed=fakeHarness({changeOnVerify:2});
  await assert.rejects(engine.publishProduct(approvalRoot,gid,{request:changed.request,resolveCredentials:changed.resolveCredentials,nowMs:FIXED_NOW}),err=>{
    assert.strictEqual(err.uncertain,true);assert.strictEqual(err.reasonCode,'SHOPIFY_PUBLISH_UNCERTAIN');return true;
  });
  assert.strictEqual(changed.calls.active,1);
  assert.strictEqual(changed.calls.publish,0);

  mission=missionFixture();saveMission(mission);
  const uncertain=fakeHarness({throwStage:'publish'});
  let uncertainError=null;
  try{await engine.publishProduct(approvalRoot,gid,{request:uncertain.request,resolveCredentials:uncertain.resolveCredentials,nowMs:FIXED_NOW})}catch(e){uncertainError=e}
  assert.ok(uncertainError&&uncertainError.uncertain===true);
  assert.strictEqual(uncertainError.reasonCode,'SHOPIFY_PUBLISH_UNCERTAIN');
  assert.strictEqual(uncertain.calls.active,1);
  assert.strictEqual(uncertain.calls.publish,1);
  let blocked=missionEngine.failStep(approvalRoot,missionId,{code:uncertainError.code,message:uncertainError.message,uncertain:true});
  assert.strictEqual(blocked.status,'needs_verification');
  const attemptsBefore=blocked.steps[blocked.currentStep].attempts;
  blocked=missionEngine.startStep(approvalRoot,missionId);
  assert.strictEqual(blocked.status,'needs_verification');
  assert.strictEqual(blocked.steps[blocked.currentStep].attempts,attemptsBefore,'uncertain irreversible step must not auto-replay');
  assert.strictEqual(uncertain.calls.publish,1,'publish mutation must not be replayed by recovery gate');

  console.log('COMMERCE ENGINE SELFTEST PASS');
}
run().catch(err=>{console.error(err);process.exitCode=1});
