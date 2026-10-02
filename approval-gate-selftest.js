const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const commerce=fs.readFileSync('./jarvis-commerce-engine.js','utf8');
const youtube=fs.readFileSync('./jarvis-youtube-studio.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.ok(worker.includes("'approval_gate_v1'"),'approval gate capability missing');
assert.ok(worker.includes("'shopify_publish_approval_v1'"),'Shopify publish approval capability missing');
assert.ok(worker.includes('function approveMissionGate('),'approval helper missing');
assert.ok(worker.includes("if(pending.length>1)throw new Error('Birden fazla görev onay bekliyor"),'ambiguous approval guard missing');
assert.ok(worker.includes("publishRequested=args.publish===true"),'Shopify publish intent missing');
assert.ok(worker.includes("steps.push({name:'shopify_publish',meta:{requiresApproval:true}})"),'approval-gated publish step missing');
assert.ok(worker.includes("code:'EXPLICIT_APPROVAL_REQUIRED'"),'explicit approval stop missing');
assert.ok(worker.includes("dependency:'approval'"),'approval dependency missing');
assert.ok(worker.includes("if(blocked&&blocked.error&&blocked.error.dependency==='approval')return mission"),'resume must not bypass approval');
assert.ok(worker.includes("step.meta&&step.meta.approvedAt"),'publish step approval proof missing');
assert.ok(worker.includes("getCommerceEngine().publishProduct(WORKSPACE,productId)"),'approved Shopify publish execution missing');
assert.ok(worker.includes("name:'approve_mission_action'"),'approval native tool missing');
assert.ok(worker.includes("else if(n==='approve_mission_action')"),'approval native handler missing');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'generic resume must not count as publish approval');
assert.ok(worker.includes("publish:{type:'boolean'"),'Shopify publish request schema missing');

assert.ok(commerce.includes('async function publishProduct(workspace,productId)'),'Shopify publish engine missing');
assert.ok(commerce.includes("Geçersiz Shopify Product GID")&&commerce.includes("Product\\/\\d+$/.test(id)"),'Shopify publish product id validation missing');
assert.ok(youtube.includes('async function publishPreparedDraft('),'YouTube approval-gated publish engine missing');
assert.ok(youtube.includes('explicit approval proof required for YouTube publish'),'YouTube module approval proof missing');
assert.ok(youtube.includes("state:'publish_started'"),'YouTube publish preflight receipt missing');
assert.ok(youtube.includes('YOUTUBE_PUBLISH_UNCERTAIN'),'YouTube uncertain publish guard missing');
assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
assert.ok(worker.includes("steps.push({name:'youtube_publish',meta:{requiresApproval:true}})"),'YouTube publish step must be approval-gated');
assert.ok(!worker.includes("function:{\n        name:'youtube_publish',"),'direct autonomous YouTube publish tool must not exist');
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'generic resume must not count as YouTube approval');

console.log('APPROVAL GATE SELFTEST PASS');
