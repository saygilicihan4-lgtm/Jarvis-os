const fs=require('fs');
const assert=require('assert');

const server=fs.readFileSync('./server.js','utf8');
const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(server.includes("return'creator_video_v2'"),'creator video routing missing');
assert.ok(server.includes("return'browser_operator_v1'"),'browser operator routing missing');
assert.ok(server.includes("'creator_tts_v1','creator_video_v2','browser_operator_v1'"),'safe local capability promotion missing');
assert.ok(worker.includes("'browser_operator_v1'"),'worker browser capability missing');
assert.ok(server.includes("return'commerce_engine_v1'"),'commerce status/setup routing missing');
assert.ok(server.includes("return'shopify_product_draft_v1'"),'Shopify draft routing missing');
assert.ok(server.includes("return'shopify_publish_v1'"),'Shopify publish routing missing');
assert.ok(server.includes("'creator_tts_v1','creator_video_v2','browser_operator_v1','commerce_engine_v1'"),'safe local commerce status promotion missing');
assert.ok(worker.includes("getBrowserOperator().pageSnapshot(WORKSPACE)"),'browser snapshot command missing');
assert.ok(worker.includes("getBrowserOperator().start(WORKSPACE,{url:'https://studio.youtube.com/'})"),'YouTube Studio browser command missing');
assert.ok(worker.includes("getBrowserOperator().start(WORKSPACE,{url:'https://admin.shopify.com/'})"),'Shopify Admin browser command missing');

console.log('ROUTING SELFTEST PASS');
