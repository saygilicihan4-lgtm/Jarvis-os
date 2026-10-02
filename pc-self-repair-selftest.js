const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.1'"),'Worker 2.99.1 required');
assert.ok(worker.includes("name:'pc_self_repair'"),'native self-repair tool missing');
assert.ok(worker.includes('async function repairLocalRuntime()'),'self-repair function missing');
assert.ok(worker.includes("['JARVIS-PC-ACCEPTANCE.ps1','JARVIS PC ACCEPTANCE V1']"),'hardened acceptance script repair sync missing');
assert.ok(worker.includes("'silent_startup_registration'"),'silent startup repair missing');
assert.ok(worker.includes("prepare(WORKSPACE,{allowInstall:true})"),'Creator/FFmpeg repair missing');
assert.ok(worker.includes('JARVIS SELF-REPAIR'),'self-repair summary missing');
assert.ok(worker.includes('jarvis kendini düzelt'),'deterministic self-repair command missing');
assert.ok(worker.includes('jarvis testi'),'deterministic acceptance command missing');

const start=worker.indexOf('async function repairLocalRuntime()');
const end=worker.indexOf('function repairSummaryText',start);
assert.ok(start>0&&end>start,'self-repair block missing');
const block=worker.slice(start,end);
assert.ok(!block.includes('createDraft('),'self-repair must not create Shopify drafts');
assert.ok(!block.includes('createDraftForMission('),'self-repair must not create mission drafts');
assert.ok(!block.includes('publishProduct('),'self-repair must not publish Shopify products');
assert.ok(!block.includes('prepareDraft('),'self-repair must not upload YouTube drafts');
assert.ok(!block.includes("clickByText(workspace,'Publish'"),'self-repair must not click YouTube Publish');
assert.ok(!block.includes("clickByText(workspace,'Yayınla'"),'self-repair must not click YouTube Yayınla');

assert.ok(server.includes("return'pc_acceptance_snapshot_v1'"),'server acceptance route missing');
assert.ok(server.includes("return'pc_self_repair_v1'"),'server self-repair route missing');
assert.ok(server.includes("'pc_acceptance_snapshot_v1','pc_self_repair_v1'"),'safe explicit diagnostic/repair capabilities missing');

console.log('PC SELF-REPAIR SELFTEST PASS');
