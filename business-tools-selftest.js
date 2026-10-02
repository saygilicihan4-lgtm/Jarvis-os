const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.93.0'"),'Worker 2.93.0 required');
assert.ok(worker.includes("name:'creator_render_short'"),'native creator render tool missing');
assert.ok(worker.includes("name:'creator_status'"),'native creator status tool missing');
assert.ok(worker.includes("name:'shopify_status'"),'native Shopify status tool missing');
assert.ok(worker.includes("name:'shopify_create_draft'"),'native Shopify draft tool missing');
assert.ok(worker.includes("getCommerceEngine().createDraft(WORKSPACE,product)"),'Shopify draft execution missing');
assert.ok(worker.includes("getCreatorEngine().renderShort({workspace:WORKSPACE,name,script,voicePath:voice})"),'Creator native render execution missing');
assert.ok(worker.includes('ürün yayınlanmadı'),'draft-only user feedback missing');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'explicit publish approval guardrail prompt missing');

// Public publishing is exposed only through the explicit approval gate.
// There is no direct autonomous publish-product tool.
assert.ok(!worker.includes("name:'shopify_publish_product'"),'direct Shopify publish tool must not be exposed');
assert.ok(worker.includes("name:'approve_mission_action'"),'explicit mission approval tool missing');
assert.ok(worker.includes("dependency:'approval'"),'publish approval dependency missing');
assert.ok(worker.includes("name:'varova_campaign_mission'"),'durable VAROVA campaign tool missing');
assert.ok(worker.includes("name:'resume_latest_mission'"),'mission resume tool missing');
assert.ok(worker.includes('createDraftForMission(WORKSPACE,product,id)'),'mission-idempotent Shopify draft execution missing');
assert.ok(worker.includes('missionId:id'),'mission-aware YouTube draft execution missing');

assert.ok(server.includes("return'shopify_product_draft_v1'"),'server Shopify draft routing missing');
assert.ok(server.includes("return'shopify_publish_v1'"),'server Shopify publish routing missing');
assert.ok(server.includes('|yayınla|yayinla|publish)'), 'public publish approval guard missing');
assert.ok(server.includes('oluştur|olustur|ekle|taslak|update'), 'Shopify draft write classification missing');
assert.ok(server.includes("return'commerce_engine_v1'"),'server commerce status/setup routing missing');

console.log('BUSINESS TOOLS SELFTEST PASS');
