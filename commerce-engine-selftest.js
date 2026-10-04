const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const engine=require('./jarvis-commerce-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.0');
assert.strictEqual(engine.DEFAULT_API_VERSION,'2026-10');
assert.strictEqual(engine.normalizeShopDomain('https://varora-v.myshopify.com/admin'),'varora-v.myshopify.com');
assert.throws(()=>engine.normalizeShopDomain('bad domain'));

const p=engine.normalizeProduct({
  title:'  V-GAP   Organizer ',
  description:'Telefonunuz artık koltuk arasına düşmesin.',
  price:'499,90',
  tags:'otomobil, organizer, otomobil',
  images:['https://example.com/a.jpg']
});
assert.strictEqual(p.title,'V-GAP Organizer');
assert.strictEqual(p.price,499.90);
assert.deepStrictEqual(p.tags,['otomobil','organizer']);
assert.ok(p.descriptionHtml.includes('<p>'));
assert.strictEqual(p.vendor,'VAROVA');

const payload=engine.productSetPayload({
  title:'V-GAP Organizer',
  price:499.90,
  description:'Test',
  tags:['VAROVA']
},{status:'DRAFT'});
assert.strictEqual(payload.input.status,'DRAFT');
assert.strictEqual(payload.input.title,'V-GAP Organizer');
assert.ok(!payload.input.variants,'Simple product should let Shopify create the default variant first');

const variants=engine.productSetPayload({
  title:'Renkli Organizer',
  variants:[
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
assert.ok(typeof engine.findProductByMission==='function');
assert.ok(typeof engine.createDraftForMission==='function');
assert.ok(typeof engine.resolveShopifyPublishApproval==='function');
assert.ok(typeof engine.assertActiveProduct==='function');
assert.ok(typeof engine.assertPublishedOnPublication==='function');

const gid='gid://shopify/Product/123456789';
const publication={id:'gid://shopify/Publication/987654321',name:'Online Store'};
const activeProduct=engine.assertActiveProduct({product:{id:gid,title:'V-GAP Organizer',status:'ACTIVE'}},gid);
assert.strictEqual(activeProduct.id,gid);
assert.strictEqual(activeProduct.status,'ACTIVE');
assert.throws(
  ()=>engine.assertActiveProduct({product:{id:gid,title:'V-GAP Organizer',status:'DRAFT'}},gid),
  err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED'
);
assert.throws(
  ()=>engine.assertActiveProduct({product:{id:'gid://shopify/Product/999',status:'ACTIVE'}},gid),
  err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED'
);
assert.throws(
  ()=>engine.assertActiveProduct({},gid),
  err=>err&&err.code==='SHOPIFY_ACTIVE_POSTCONDITION_FAILED'
);
assert.strictEqual(engine.assertPublishedOnPublication({publishable:{publishedOnPublication:true}},publication),true);
assert.throws(
  ()=>engine.assertPublishedOnPublication({publishable:{publishedOnPublication:false}},publication),
  err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED'
);
assert.throws(
  ()=>engine.assertPublishedOnPublication({publishable:{}},publication),
  err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED'
);
assert.throws(
  ()=>engine.assertPublishedOnPublication({publishable:{publishedOnPublication:true}},null),
  err=>err&&err.code==='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED'
);

const commerceSource=fs.readFileSync(path.join(__dirname,'jarvis-commerce-engine.js'),'utf8');
const publishStart=commerceSource.indexOf('async function publishProduct(workspace,productId)');
const publicationPreflight=commerceSource.indexOf('const publication=await findOnlineStorePublication(creds);',publishStart);
const activeMutation=commerceSource.indexOf('const active=await graphQLRequest(creds,`mutation JarvisActivateProduct',publishStart);
const activePostcondition=commerceSource.indexOf('const activeProduct=assertActiveProduct(update,id);',publishStart);
const publishMutation=commerceSource.indexOf('const pub=await graphQLRequest(creds,`mutation JarvisPublishProduct',publishStart);
const publicationPostcondition=commerceSource.indexOf('const publicationVerified=assertPublishedOnPublication(out,publication);',publishStart);
const publishReceipt=commerceSource.indexOf("const receipt=path.join(dirs.receipts,'publish-'",publishStart);
assert.ok(publishStart>=0&&publicationPreflight>publishStart&&activeMutation>publicationPreflight,'Online Store publication preflight must happen before ACTIVE mutation');
assert.ok(activePostcondition>activeMutation&&publishMutation>activePostcondition,'ACTIVE response must be verified before publish mutation');
assert.ok(publicationPostcondition>publishMutation&&publishReceipt>publicationPostcondition,'Publication response must be verified before success receipt');

const approvalRoot=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-approval-'));
const missionDir=path.join(approvalRoot,'.jarvis-missions');
fs.mkdirSync(missionDir,{recursive:true});
const missionFile=path.join(missionDir,'M-ABCDEF123456.json');
function missionFixture(){
  return{
    schema:1,
    engine:'JARVIS_MISSION_ENGINE',
    version:'1.0',
    id:'M-ABCDEF123456',
    type:'shopify_product',
    status:'running',
    createdAt:'2026-10-04T00:00:00.000Z',
    updatedAt:'2026-10-04T00:02:00.000Z',
    completedAt:null,
    currentStep:1,
    input:{publishRequested:true},
    artifacts:{},
    history:[],
    steps:[
      {
        index:0,
        name:'shopify_draft',
        status:'completed',
        attempts:1,
        startedAt:'2026-10-04T00:00:10.000Z',
        completedAt:'2026-10-04T00:01:00.000Z',
        error:null,
        artifact:{product:{id:gid,title:'V-GAP Organizer',status:'DRAFT'}},
        meta:{}
      },
      {
        index:1,
        name:'shopify_publish',
        status:'running',
        attempts:1,
        startedAt:'2026-10-04T00:02:00.000Z',
        completedAt:null,
        error:null,
        artifact:null,
        meta:{requiresApproval:true,approvedAt:'2026-10-04T00:01:30.000Z'}
      }
    ]
  };
}
function saveMission(mission){
  fs.writeFileSync(missionFile,JSON.stringify(mission,null,2),'utf8');
}
function requiresApproval(fn){
  assert.throws(fn,err=>err&&err.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED');
}

requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

let mission=missionFixture();
saveMission(mission);
let proof=engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')});
assert.strictEqual(proof.missionId,'M-ABCDEF123456');
assert.strictEqual(proof.productId,gid);
assert.strictEqual(proof.approvedAt,'2026-10-04T00:01:30.000Z');

mission=missionFixture();
mission.steps[1].meta.approvedAt='yes';
saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

mission=missionFixture();
mission.steps[1].meta.approvedAt='2026-10-04T00:00:30.000Z';
saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

mission=missionFixture();
mission.steps[1].meta.approvedAt='2026-10-04T00:04:00.000Z';
saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

mission=missionFixture();
mission.steps[1].status='completed';
mission.status='completed';
saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

mission=missionFixture();
mission.steps[0].artifact.product.id='gid://shopify/Product/999999999';
saveMission(mission);
requiresApproval(()=>engine.resolveShopifyPublishApproval(approvalRoot,gid,{nowMs:Date.parse('2026-10-04T00:03:00.000Z')}));

const noProofRoot=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-no-proof-'));
(async()=>{
  await assert.rejects(
    engine.publishProduct(noProofRoot,gid),
    err=>err&&err.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED'
  );
  console.log('COMMERCE ENGINE SELFTEST PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
