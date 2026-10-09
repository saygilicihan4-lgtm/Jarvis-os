const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
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

console.log('SHOPIFY MISSION SELFTEST PASS');
