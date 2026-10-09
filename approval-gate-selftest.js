const fs=require('fs');
const assert=require('assert');
const approvalIntent=require('./jarvis-approval-intent');
const commerceEngine=require('./jarvis-commerce-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const commerce=fs.readFileSync('./jarvis-commerce-engine.js','utf8');
const youtube=fs.readFileSync('./jarvis-youtube-studio.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.ok(worker.includes("'approval_gate_v1'"),'approval gate capability missing');
assert.ok(worker.includes("'shopify_publish_approval_v1'"),'Shopify publish approval capability missing');
assert.ok(worker.includes('function approveMissionGate('),'approval helper missing');
assert.ok(worker.includes('approvalModule.resolveApprovalTarget('),'approval gate must resolve the target from user intent');
assert.ok(worker.includes("approveMissionGate({missionId:String(a.missionId||'').trim(),approvalIntent,userText:approvalUserText,approvalContext})"),'approval handler must pass actual user intent into target binding');
assert.ok(worker.includes('engine.approveStep(WORKSPACE,resolved.missionId,{surface:resolved.surface,targetReason:resolved.reason})'),'approval must persist the resolved target with a bounded payload grant');
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
assert.ok(worker.includes("require('./jarvis-approval-intent').classifyApprovalIntent(approvalUserText)"),'approval handler must use shared fail-closed intent classifier');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'generic resume must not count as publish approval');
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'generic resume must not count as YouTube approval');
assert.ok(worker.includes("publish:{type:'boolean'"),'Shopify publish request schema missing');

const directShopifyStart=worker.indexOf('  const shopifyPublish=c.match(');
const directShopifyEnd=worker.indexOf("\n\n  if(/^(?:creator motor durumu",directShopifyStart);
assert.ok(directShopifyStart>=0&&directShopifyEnd>directShopifyStart,'direct Shopify command boundary missing');
const directShopifyBlock=worker.slice(directShopifyStart,directShopifyEnd);
assert.ok(directShopifyBlock.includes('Shopify PUBLIC doğrudan yerel komut yolundan çalıştırılmaz; approval-gated mission gerekir.'),'direct Shopify PUBLIC fail-closed message missing');
assert.ok(!directShopifyBlock.includes('publishProduct('),'direct local Shopify command must never call publishProduct');
assert.ok(worker.includes("getCommerceEngine().publishProduct(WORKSPACE,productId)"),'approval-gated Shopify mission publish path must remain');

const youtubePublishStart=worker.indexOf("if(step.name==='youtube_publish')");
const youtubePublishEnd=worker.indexOf("if(step.name==='dev_patch_prepare')",youtubePublishStart);
assert.ok(youtubePublishStart>=0&&youtubePublishEnd>youtubePublishStart,'YouTube PUBLIC mission boundary missing');
const youtubePublishBlock=worker.slice(youtubePublishStart,youtubePublishEnd);
assert.ok(youtubePublishBlock.includes('publishPreparedDraft('),'YouTube PUBLIC publish call missing');
const youtubeAuthStart=youtubePublishBlock.indexOf("if(out.code==='YOUTUBE_AUTH_REQUIRED'){");
const youtubeUncertainStart=youtubePublishBlock.indexOf("if(out.code==='YOUTUBE_PUBLISH_UNCERTAIN'){",youtubeAuthStart);
assert.ok(youtubeAuthStart>=0&&youtubeUncertainStart>youtubeAuthStart,'YouTube PUBLIC auth retry boundary missing');
const youtubeAuthBlock=youtubePublishBlock.slice(youtubeAuthStart,youtubeUncertainStart);
assert.ok(youtubeAuthBlock.includes("engine.failStep(WORKSPACE,id,{code:out.code"),'YouTube auth failure must use persistent engine revocation');
require('./approval-lifecycle-selftest');

const positiveCases=[
  ['shopify','mağazada yayınla'],
  ['shopify','ürünü yayınla'],
  ['youtube','videoyu yayınla'],
  ['youtube','publish'],
  ['youtube','publish now'],
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
  ['shopify','asla yayınla'],
  ['shopify','yayınlama'],
  ['shopify','yayinlama'],
  ['shopify','yayınlamayın'],
  ['shopify','yayınlamayınız'],
  ['shopify','yayinlamayalim'],
  ['youtube','publish etme'],
  ['youtube','publish etmeyiniz'],
  ['youtube','do not publish'],
  ['youtube','do not ever publish'],
  ['youtube',"don't publish"],
  ['youtube',"don't ever publish"],
  ['youtube','dont publish'],
  ['youtube','never publish'],
  ['youtube','no publish'],
  ['browser','onay verme'],
  ['browser','onay vermeyiniz'],
  ['browser','onaylama'],
  ['browser','onaylamayın'],
  ['browser','onaylamayınız'],
  ['browser','approve etme'],
  ['browser','do not approve'],
  ['browser',"don't approve"],
  ['browser','never ever approve'],
  ['browser','no approve'],
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
assert.strictEqual(approvalIntent.classifyApprovalIntent("don't ever publish").reason,'negated_explicit_action');
assert.strictEqual(approvalIntent.classifyApprovalIntent('no approve').reason,'negated_explicit_action');

// v157: irreversible approval is bound to the target named by the real user turn,
// never merely to a model-selected missionId.
const YT='M-AAAAAAAAAAAA';
const SHOP='M-BBBBBBBBBBBB';
const YT2='M-CCCCCCCCCCCC';
const BROWSER='M-DDDDDDDDDDDD';
const twoSurfaces=[
  {id:YT,stepName:'youtube_publish'},
  {id:SHOP,stepName:'shopify_publish'}
];

const youtubeApproval=approvalIntent.classifyApprovalIntent('YouTube videosunu yayınla');
assert.strictEqual(youtubeApproval.approved,true);
assert.deepStrictEqual(youtubeApproval.surfaces,['youtube']);
assert.strictEqual(youtubeApproval.surface,'youtube');

const shopifyApproval=approvalIntent.classifyApprovalIntent('Shopify mağazasında yayınla');
assert.deepStrictEqual(shopifyApproval.surfaces,['shopify']);
assert.strictEqual(shopifyApproval.surface,'shopify');

const browserApproval=approvalIntent.classifyApprovalIntent('form butonunu onayla');
assert.deepStrictEqual(browserApproval.surfaces,['browser']);
assert.strictEqual(browserApproval.surface,'browser');

const genericChannelApproval=approvalIntent.classifyApprovalIntent('kanalda yayınla');
assert.strictEqual(genericChannelApproval.approved,true);
assert.deepStrictEqual(genericChannelApproval.surfaces,[],'generic channel wording must not silently select YouTube');

const productYoutubeApproval=approvalIntent.classifyApprovalIntent("ürün videosunu YouTube'da yayınla");
assert.deepStrictEqual(productYoutubeApproval.surfaces,['youtube'],'strong YouTube target must win over generic product/video fallback words');

const conflictingApproval=approvalIntent.classifyApprovalIntent("YouTube ve Shopify'da yayınla");
assert.deepStrictEqual(conflictingApproval.surfaces,['youtube','shopify']);
let resolved=approvalIntent.resolveApprovalTarget({approval:conflictingApproval,pending:twoSurfaces});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'AMBIGUOUS_APPROVAL_SURFACE');

resolved=approvalIntent.resolveApprovalTarget({approval:youtubeApproval,pending:twoSurfaces});
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.missionId,YT);
assert.strictEqual(resolved.surface,'youtube');
assert.strictEqual(resolved.reason,'explicit_surface');

resolved=approvalIntent.resolveApprovalTarget({approval:youtubeApproval,pending:twoSurfaces,requestedMissionId:SHOP});
assert.strictEqual(resolved.ok,false,'model-selected Shopify mission must not override a YouTube approval');
assert.strictEqual(resolved.code,'REQUESTED_MISSION_MISMATCH');

resolved=approvalIntent.resolveApprovalTarget({approval:youtubeApproval,pending:twoSurfaces,requestedMissionId:YT});
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.missionId,YT);

const genericApproval=approvalIntent.classifyApprovalIntent('onayla');
assert.deepStrictEqual(genericApproval.surfaces,[]);
resolved=approvalIntent.resolveApprovalTarget({approval:genericApproval,pending:twoSurfaces});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'AMBIGUOUS_PENDING_APPROVAL');

resolved=approvalIntent.resolveApprovalTarget({approval:genericApproval,pending:[{id:SHOP,stepName:'shopify_publish'}]});
assert.strictEqual(resolved.ok,true,'generic approval must remain compatible when exactly one irreversible mission waits');
assert.strictEqual(resolved.missionId,SHOP);
assert.strictEqual(resolved.reason,'single_pending');

resolved=approvalIntent.resolveApprovalTarget({approval:genericApproval,pending:[{id:SHOP,stepName:'shopify_publish'}],requestedMissionId:YT});
assert.strictEqual(resolved.ok,false,'even a single pending mission must reject a conflicting model-supplied missionId');
assert.strictEqual(resolved.code,'REQUESTED_MISSION_MISMATCH');

resolved=approvalIntent.resolveApprovalTarget({approval:youtubeApproval,pending:[{id:YT,stepName:'youtube_publish'},{id:YT2,stepName:'youtube_publish'}]});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'AMBIGUOUS_SURFACE_MISSIONS');

const exactIdApproval=approvalIntent.classifyApprovalIntent(`onayla ${YT2}`);
resolved=approvalIntent.resolveApprovalTarget({approval:exactIdApproval,pending:[{id:YT,stepName:'youtube_publish'},{id:YT2,stepName:'youtube_publish'}]});
assert.strictEqual(resolved.ok,true,'exact mission ID in the user text must disambiguate same-surface missions');
assert.strictEqual(resolved.missionId,YT2);
assert.strictEqual(resolved.reason,'explicit_mission_id');

resolved=approvalIntent.resolveApprovalTarget({approval:exactIdApproval,pending:[{id:YT,stepName:'youtube_publish'},{id:YT2,stepName:'youtube_publish'}],requestedMissionId:YT});
assert.strictEqual(resolved.ok,false,'model missionId must not override the exact mission ID written by the user');
assert.strictEqual(resolved.code,'REQUESTED_MISSION_MISMATCH');

const matchingIdAndSurface=approvalIntent.classifyApprovalIntent(`YouTube videosunu yayınla ${YT}`);
resolved=approvalIntent.resolveApprovalTarget({approval:matchingIdAndSurface,pending:twoSurfaces});
assert.strictEqual(resolved.ok,true,'exact mission ID and named surface may agree');
assert.strictEqual(resolved.missionId,YT);

const conflictingIdAndSurface=approvalIntent.classifyApprovalIntent(`YouTube videosunu yayınla ${SHOP}`);
resolved=approvalIntent.resolveApprovalTarget({approval:conflictingIdAndSurface,pending:twoSurfaces});
assert.strictEqual(resolved.ok,false,'an exact mission ID must not override a contradictory user-named surface');
assert.strictEqual(resolved.code,'MISSION_SURFACE_MISMATCH');

resolved=approvalIntent.resolveApprovalTarget({approval:genericChannelApproval,pending:twoSurfaces});
assert.strictEqual(resolved.ok,false,'generic channel wording must fail closed when multiple irreversible missions wait');
assert.strictEqual(resolved.code,'AMBIGUOUS_PENDING_APPROVAL');

resolved=approvalIntent.resolveApprovalTarget({approval:youtubeApproval,pending:[{id:SHOP,stepName:'shopify_publish'},{id:BROWSER,stepName:'browser_click'}]});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'SURFACE_NOT_PENDING');

assert.strictEqual(typeof commerceEngine.publishProduct,'function','Shopify publish engine missing');
assert.throws(()=>commerceEngine.resolveShopifyPublishApproval('/tmp/jarvis-invalid-approval-root','not-a-product-gid'),/Geçersiz Shopify Product GID/,'Shopify publish product id validation missing');
assert.ok(youtube.includes('async function publishPreparedDraft('),'YouTube approval-gated publish engine missing');
assert.ok(youtube.includes('explicit approval proof required for YouTube publish'),'YouTube module approval proof missing');
assert.ok(youtube.includes("state:'publish_started'"),'YouTube publish preflight receipt missing');
assert.ok(youtube.includes('YOUTUBE_PUBLISH_UNCERTAIN'),'YouTube uncertain publish guard missing');
assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
assert.ok(!worker.includes("function:{\n        name:'youtube_publish',"),'direct autonomous YouTube publish tool must not exist');

console.log('APPROVAL GATE SELFTEST PASS · PUBLIC approval is fail-closed on negation, direct bypass, stale auth retry, ambiguous targets, and confused-deputy mission routing');
