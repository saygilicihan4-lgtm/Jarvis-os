const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.91.0'"),'Worker 2.91.0 required');
assert.ok(worker.includes("'shopify_product_mission_v1'"),'durable Shopify product mission capability missing');
assert.ok(worker.includes('function createShopifyProductMission(args={})'),'Shopify product mission factory missing');
assert.ok(worker.includes("type:'shopify_product'"),'shopify_product mission type missing');
assert.ok(worker.includes("steps:['shopify_draft']"),'Shopify mission must stay draft-only');
assert.ok(worker.includes("name:'shopify_product_mission'"),'native Shopify mission tool missing');
assert.ok(worker.includes("else if(n==='shopify_product_mission')"),'Shopify mission tool handler missing');
assert.ok(worker.includes("yalnızca DRAFT ürün oluşturur")||worker.includes("Yalnızca DRAFT ürün oluşturur"),'Shopify publish guard missing');
assert.ok(worker.includes("shopify_product_mission kullan"),'native agent durable Shopify guidance missing');
assert.ok(worker.includes('createDraftForMission(WORKSPACE,product,id)'),'mission idempotency path missing');
assert.ok(worker.includes("dependency:'shopify'"),'Shopify dependency wait path missing');

assert.ok(html.includes("pcCaps.includes('shopify_product_mission_v1')"),'HUD does not verify durable Commerce capability');
assert.ok(html.includes('durable product mission'),'Commerce durable mission detail missing');

console.log('SHOPIFY MISSION SELFTEST PASS');
