const fs=require('fs');
const assert=require('assert');
const approvalIntent=require('./jarvis-approval-intent');

const worker=fs.readFileSync('./worker.js','utf8');
const commerce=fs.readFileSync('./jarvis-commerce-engine.js','utf8');
const youtube=fs.readFileSync('./jarvis-youtube-studio.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
assert.ok(worker.includes("'approval_gate_v1'"),'approval gate capability missing');
assert.ok(worker.includes("'shopify_publish_approval_v1'"),'Shopify publish approval capability missing');
assert.ok(worker.includes('function approveMissionGate('),'approval helper missing');
assert.ok(worker.includes("if(pending.length>1)throw new Error('Birden fazla görev onay bekliyor"),'ambiguous approval guard missing');
assert.ok(worker.includes("publishRequested=args.publish===true"),'Shopify publish intent missing');
assert.ok(worker.includes("steps.push({name:'shopify_publish',meta:{requiresApproval:true}})"),'Shopify PUBLIC approval-gated step missing');
assert.ok(worker.includes("steps.push({name:'youtube_publish',meta:{requiresApproval:true}})"),'YouTube PUBLIC approval-gated step missing');
assert.ok(worker.includes("steps.push({name:'browser_click',meta:{requiresApproval:true}})"),'generic browser final-click approval-gated step missing');
assert.ok(worker.includes("code:'EXPLICIT_APPROVAL_REQUIRED'"),'explicit approval stop missing');
assert.ok(worker.includes("dependency:'approval'"),'approval dependency missing');
assert.ok(worker.includes("if(blocked&&blocked.error&&blocked.error.dependency==='approval')return mission"),'resume must not bypass approval');
assert.ok(worker.includes("step.meta&&step.meta.approvedAt"),'publish step approval proof missing');
assert.ok(worker.includes("getCommerceEngine().publishProduct(WORKSPACE,productId)"),'approved Shopify publish execution missing');
assert.ok(worker.includes("name:'approve_mission_action'"),'approval native tool missing');
assert.ok(worker.includes("else if(n==='approve_mission_action')"),'approval native handler missing');
assert.ok(worker.includes("require('./jarvis-approval-intent').classifyApprovalIntent(userText)"),'approval handler must use shared fail-closed intent classifier');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'generic resume must not count as publish approval');
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'generic resume must not count as YouTube approval');
assert.ok(worker.includes("publish:{type:'boolean'"),'Shopify publish request schema missing');

const positiveCases=[
  ['shopify','mağazada yayınla'],
  ['shopify','ürünü yayınla'],
  ['youtube','videoyu yayınla'],
  ['youtube','publish'],
  ['browser','onayla'],
  ['browser','onay ver'],
  ['english','approve']
];
for(const [surface,text] of positiveCases){
  const result=approvalIntent.classifyApprovalIntent(text);
  assert.strictEqual(result.approved,true,`${surface} positive approval rejected: ${text}`);
  assert.strictEqual(result.reason,'explicit_action');
}

const negativeCases=[
  ['shopify','sakın yayınlama'],
  ['shopify','sakin yayinlama'],
  ['shopify','yayınlama'],
  ['shopify','yayinlama'],
  ['shopify','yayınlamayın'],
  ['shopify','yayinlamayalim'],
  ['youtube','publish etme'],
  ['youtube','do not publish'],
  ['youtube',"don't publish"],
  ['youtube','dont publish'],
  ['youtube','never publish'],
  ['browser','onay verme'],
  ['browser','onaylama'],
  ['browser','onaylamayın'],
  ['browser','approve etme'],
  ['browser','do not approve'],
  ['browser',"don't approve"],
  ['mixed','yayınlama, sonra onayla'],
  ['mixed','publish etme ama onayla'],
  ['mixed','sakın yayınla'],
  ['generic','devam et'],
  ['generic','continue'],
  ['generic','tamam devam et']
];
for(const [surface,text] of negativeCases){
  const result=approvalIntent.classifyApprovalIntent(text);
  assert.strictEqual(result.approved,false,`${surface} negated/non-explicit approval accepted: ${text}`);
}
assert.strictEqual(approvalIntent.classifyApprovalIntent('yayınlama, sonra onayla').reason,'negated_explicit_action');
assert.strictEqual(approvalIntent.classifyApprovalIntent('publish etme ama onayla').reason,'negated_explicit_action');

assert.ok(commerce.includes('async function publishProduct(workspace,productId)'),'Shopify publish engine missing');
assert.ok(commerce.includes("Geçersiz Shopify Product GID")&&commerce.includes("Product\\/\\d+$/.test(id)"),'Shopify publish product id validation missing');
assert.ok(youtube.includes('async function publishPreparedDraft('),'YouTube approval-gated publish engine missing');
assert.ok(youtube.includes('explicit approval proof required for YouTube publish'),'YouTube module approval proof missing');
assert.ok(youtube.includes("state:'publish_started'"),'YouTube publish preflight receipt missing');
assert.ok(youtube.includes('YOUTUBE_PUBLISH_UNCERTAIN'),'YouTube uncertain publish guard missing');
assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
assert.ok(!worker.includes("function:{\n        name:'youtube_publish',"),'direct autonomous YouTube publish tool must not exist');

console.log('APPROVAL GATE SELFTEST PASS · Shopify/YouTube/browser irreversible approval intent rejects explicit Turkish/English negation');
