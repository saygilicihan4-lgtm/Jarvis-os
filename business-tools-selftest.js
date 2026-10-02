const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.78.0'"),'Worker 2.78.0 required');
assert.ok(worker.includes("name:'creator_render_short'"),'native creator render tool missing');
assert.ok(worker.includes("name:'creator_status'"),'native creator status tool missing');
assert.ok(worker.includes("name:'shopify_status'"),'native Shopify status tool missing');
assert.ok(worker.includes("name:'shopify_create_draft'"),'native Shopify draft tool missing');
assert.ok(worker.includes("getCommerceEngine().createDraft(WORKSPACE,product)"),'Shopify draft execution missing');
assert.ok(worker.includes("getCreatorEngine().renderShort({workspace:WORKSPACE,name,script,voicePath:voice})"),'Creator native render execution missing');
assert.ok(worker.includes('ürün yayınlanmadı'),'draft-only user feedback missing');
assert.ok(worker.includes('Ürünü halka açık mağazada yayınlama native ajan aracı değildir.'),'native publish guardrail prompt missing');

// Publishing stays available only through the explicit deterministic command path.
// It must not be exposed as an autonomous local-brain tool.
assert.ok(!worker.includes("name:'shopify_publish_product'"),'public Shopify publish must not be a native autonomous tool');

assert.ok(server.includes("return'shopify_product_draft_v1'"),'server Shopify draft routing missing');
assert.ok(server.includes("return'shopify_publish_v1'"),'server Shopify publish routing missing');
assert.ok(server.includes("return'commerce_engine_v1'"),'server commerce status/setup routing missing');

console.log('BUSINESS TOOLS SELFTEST PASS');
