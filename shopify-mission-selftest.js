const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const commerce=require('./jarvis-commerce-engine');
const missionEngine=require('./jarvis-mission-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const commerceSource=fs.readFileSync('./jarvis-commerce-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
assert.ok(worker.includes("'shopify_product_mission_v1'"),'durable Shopify product mission capability missing');
assert.ok(worker.includes('function createShopifyProductMission(args={})'),'Shopify product mission factory missing');
assert.ok(worker.includes("type:'shopify_product'"),'shopify_product mission type missing');
assert.ok(worker.includes("const steps=['shopify_draft'];"),'Shopify mission must begin with a draft step');
assert.ok(worker.includes("if(publishRequested)steps.push({name:'shopify_publish',meta:{requiresApproval:true}})"),'optional publish must be approval-gated');
assert.ok(worker.includes("publishRequested=args.publish===true"),'publish must require an explicit requested flag');
assert.ok(worker.includes("name:'shopify_product_mission'"),'native Shopify mission tool missing');
assert.ok(worker.includes("else if(n==='shopify_product_mission')"),'Shopify mission tool handler missing');
assert.ok(worker.includes("publish=true istenirse görev yayınlama adımında DURUR")||worker.includes("publish=true yalnızca yayınlama isteğini sıraya koyar"),'Shopify approval-gate description missing');
assert.ok(worker.includes("code:'EXPLICIT_APPROVAL_REQUIRED'"),'Shopify publish approval barrier missing');
assert.ok(worker.includes("shopify_product_mission kullan"),'native agent durable Shopify guidance missing');
assert.ok(worker.includes('createDraftForMission(WORKSPACE,product,id)'),'mission idempotency path missing');
assert.ok(worker.includes("dependency:'shopify'"),'Shopify dependency wait path missing');

assert.ok(html.includes("pcCaps.includes('shopify_product_mission_v1')"),'HUD does not verify durable Commerce capability');
assert.ok(html.includes('durable product mission'),'Commerce durable mission detail missing');

assert.ok(commerceSource.includes('const approval=resolvePublishApproval(workspace,id);'),'Shopify PUBLIC must resolve approval before publishing');
assert.ok(commerceSource.indexOf('const approval=resolvePublishApproval(workspace,id);')<commerceSource.indexOf('const creds=resolveCredentials(workspace);',commerceSource.indexOf('async function publishProduct')),'approval guard must run before Shopify credentials/network path');
assert.ok(commerceSource.includes("step.name!=='shopify_publish'"),'approval must be bound to the Shopify publish step');
assert.ok(commerceSource.includes("approvalKind||'')!=='explicit_user'"),'approval must be explicitly user-originated');
assert.ok(commerceSource.includes('approvedMs<draftMs'),'approval must not predate the completed draft artifact');
assert.ok(commerceSource.includes('approvedMs>nowMs+5000'),'future-dated approval must fail closed');

(async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-shopify-approval-'));
  const productId='gid://shopify/Product/1234567890';

  await assert.rejects(
    ()=>commerce.publishProduct(workspace,productId),
    /SHOPIFY_EXPLICIT_APPROVAL_REQUIRED/,
    'direct/legacy publish must fail before credentials or network without a mission-bound approval'
  );

  let mission=missionEngine.createMission(workspace,{
    type:'shopify_product',
    input:{publishRequested:true},
    steps:['shopify_draft',{name:'shopify_publish',meta:{requiresApproval:true}}]
  });
  mission=missionEngine.startStep(workspace,mission.id);
  mission=missionEngine.completeStep(workspace,mission.id,{artifact:{product:{id:productId,title:'Test Product',status:'DRAFT'}}});

  assert.throws(()=>commerce.resolvePublishApproval(workspace,productId),/SHOPIFY_EXPLICIT_APPROVAL_REQUIRED/,'draft alone must never authorize PUBLIC');

  mission=missionEngine.loadMission(workspace,mission.id);
  let step=missionEngine.currentStep(mission);
  step.meta={...(step.meta||{}),approvedAt:'2000-01-01T00:00:00.000Z',approvalKind:'explicit_user'};
  missionEngine.saveMission(workspace,mission);
  assert.throws(()=>commerce.resolvePublishApproval(workspace,productId),/SHOPIFY_APPROVAL_PREDATES_DRAFT/,'approval older than draft must fail closed');

  mission=missionEngine.loadMission(workspace,mission.id);
  step=missionEngine.currentStep(mission);
  step.meta={...(step.meta||{}),approvedAt:new Date(Date.now()+60000).toISOString(),approvalKind:'explicit_user'};
  missionEngine.saveMission(workspace,mission);
  assert.throws(()=>commerce.resolvePublishApproval(workspace,productId),/SHOPIFY_APPROVAL_IN_FUTURE/,'future approval must fail closed');

  mission=missionEngine.loadMission(workspace,mission.id);
  step=missionEngine.currentStep(mission);
  const approvedAt=new Date().toISOString();
  step.meta={...(step.meta||{}),approvedAt,approvalKind:'explicit_user'};
  missionEngine.saveMission(workspace,mission);
  const proof=commerce.resolvePublishApproval(workspace,productId);
  assert.strictEqual(proof.missionId,mission.id);
  assert.strictEqual(proof.approvedAt,approvedAt);
  assert.strictEqual(proof.approvalKind,'explicit_user');

  await assert.rejects(
    ()=>commerce.publishProduct(workspace,productId),
    /SHOPIFY_NOT_CONNECTED/,
    'with valid local approval proof, execution may proceed only as far as the existing Shopify credential gate in this offline selftest'
  );

  const otherId='gid://shopify/Product/9999999999';
  assert.throws(()=>commerce.resolvePublishApproval(workspace,otherId),/SHOPIFY_EXPLICIT_APPROVAL_REQUIRED/,'approval must stay bound to the exact draft product id');

  console.log('SHOPIFY MISSION SELFTEST PASS · PUBLIC publish is fail-closed unless the exact draft product has fresh explicit-user mission approval');
})().catch(e=>{console.error(e);process.exit(1)});
