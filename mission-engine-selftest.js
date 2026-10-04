const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const m=require('./jarvis-mission-engine');
const approvalIntent=require('./jarvis-approval-intent');

assert.strictEqual(m.MISSION_ENGINE_VERSION,'1.0');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-mission-'));

const x=m.createMission(tmp,{
  type:'varova_campaign',
  label:'V-GAP campaign',
  input:{script:'test'},
  steps:['render_short','shopify_draft','youtube_draft']
});
assert.ok(/^M-[A-Z0-9-]+$/.test(x.id));
assert.strictEqual(x.status,'queued');
assert.strictEqual(x.steps.length,3);

let s=m.startStep(tmp,x.id);
assert.strictEqual(s.status,'running');
assert.strictEqual(s.steps[0].attempts,1);

s=m.completeStep(tmp,x.id,{artifact:{output:'creator-video/a.mp4'}});
assert.strictEqual(s.currentStep,1);
assert.strictEqual(s.artifacts.render_short.output,'creator-video/a.mp4');

s=m.startStep(tmp,x.id);
s=m.failStep(tmp,x.id,{code:'SHOPIFY_NOT_CONNECTED',message:'connect',retryable:true,dependency:'shopify'});
assert.strictEqual(s.status,'waiting_dependency');
assert.strictEqual(s.steps[1].status,'blocked');

s=m.retryBlockedStep(tmp,x.id);
assert.strictEqual(s.status,'queued');
assert.strictEqual(s.steps[1].status,'pending');

s=m.startStep(tmp,x.id);
assert.strictEqual(s.steps[1].attempts,2);
// Simulate a crash with a running external side effect.
const recovered=m.recoverInterruptedMissions(tmp);
assert.ok(recovered.includes(x.id));
s=m.loadMission(tmp,x.id);
assert.strictEqual(s.status,'needs_verification');
assert.strictEqual(s.steps[1].status,'uncertain');

// Never auto-retry an uncertain external side effect.
s=m.startStep(tmp,x.id);
assert.strictEqual(s.status,'needs_verification');
assert.strictEqual(s.steps[1].attempts,2);

s=m.resolveUncertainStep(tmp,x.id,{completed:false,note:'verified absent'});
assert.strictEqual(s.status,'queued');
assert.strictEqual(s.steps[1].status,'pending');

const latest=m.latestOpenMission(tmp);
assert.strictEqual(latest.id,x.id);
const summary=m.summarizeMission(latest);
assert.strictEqual(summary.step.name,'shopify_draft');
assert.strictEqual(summary.label,'V-GAP campaign');

// v168: approval review text must be useful on the existing mobile Mission Queue
// without putting raw form values, URL query secrets, or approval UUIDs in telemetry.
let review=m.createMission(tmp,{
  type:'browser_form',
  label:'Checkout form',
  input:{
    url:'https://secure.example.test/checkout?token=QUERY_SECRET_123',
    finalClick:'Submit order',
    fields:[
      {label:'Name',value:'Cihan Secret Name'},
      {label:'Email',value:'owner@example.test'},
      {label:'Password',value:'TOP_SECRET_PASSWORD'},
      {label:'Note',value:'PRIVATE_NOTE'}
    ]
  },
  steps:[{name:'browser_click',meta:{requiresApproval:true}}]
});
m.startStep(tmp,review.id);
review=m.failStep(tmp,review.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval required',retryable:true,dependency:'approval'});
const reviewRequestId=m.currentStep(review).meta.approvalRequestId;
const reviewSummary=m.summarizeMission(review);
assert.ok(reviewSummary.label.includes('ONAY'));
assert.ok(reviewSummary.label.includes('WEB Submit order @ secure.example.test'));
assert.ok(reviewSummary.label.includes('ALAN Name,Email,Password+1'));
assert.ok(reviewSummary.label.includes('15 DK'));
assert.ok(reviewSummary.label.includes('REQ '));
for(const secret of ['QUERY_SECRET_123','Cihan Secret Name','owner@example.test','TOP_SECRET_PASSWORD','PRIVATE_NOTE',reviewRequestId]){
  assert.ok(!reviewSummary.label.includes(secret),'approval review leaked '+secret);
}
assert.ok(reviewSummary.label.length<=160);

// v169: a visible REQ fingerprint is an optional freshness lock. When present,
// it must select exactly the request the user reviewed; stale or malformed cards
// never grant approval. Manual explicit approval without a REQ remains compatible.
const visibleReq=(reviewSummary.label.match(/REQ ([a-f0-9]{10})/i)||[])[1];
assert.ok(visibleReq,'visible approval request fingerprint missing');
let parsed=approvalIntent.classifyApprovalIntent('onayla '+review.id+' req '+visibleReq);
assert.strictEqual(parsed.approved,true);
assert.strictEqual(parsed.requestFingerprint,visibleReq);
let resolved=approvalIntent.resolveApprovalTarget({
  approval:parsed,
  pending:[{id:review.id,stepName:'browser_click'}],
  requestedMissionId:review.id
});
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.reason,'explicit_mission_id|req:'+visibleReq);

parsed=approvalIntent.classifyApprovalIntent('onayla '+review.id+' req xyz');
resolved=approvalIntent.resolveApprovalTarget({approval:parsed,pending:[{id:review.id,stepName:'browser_click'}],requestedMissionId:review.id});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'INVALID_APPROVAL_REQUEST_FINGERPRINT');

parsed=approvalIntent.classifyApprovalIntent('onayla '+review.id+' req '+visibleReq+' req 0123456789');
resolved=approvalIntent.resolveApprovalTarget({approval:parsed,pending:[{id:review.id,stepName:'browser_click'}],requestedMissionId:review.id});
assert.strictEqual(resolved.ok,false);
assert.strictEqual(resolved.code,'AMBIGUOUS_APPROVAL_REQUEST_FINGERPRINT');

let stale=m.createMission(tmp,{
  type:'browser_form',
  label:'Stale approval card',
  input:{url:'https://example.test/form',finalClick:'Submit',fields:[{label:'Name',value:'Safe fixture'}]},
  steps:[{name:'browser_click',meta:{requiresApproval:true}}]
});
m.startStep(tmp,stale.id);
stale=m.failStep(tmp,stale.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval required',retryable:true,dependency:'approval'});
const staleOldTag=(m.summarizeMission(stale).label.match(/REQ ([a-f0-9]{10})/i)||[])[1];
const staleOldRequest=m.currentStep(stale).meta.approvalRequestId;
// Refresh the request while preserving the same mission/payload. A phone card
// rendered before this refresh must no longer be able to authorize the step.
stale=m.failStep(tmp,stale.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval refreshed',retryable:true,dependency:'approval'});
const staleNewRequest=m.currentStep(stale).meta.approvalRequestId;
const staleNewTag=(m.summarizeMission(stale).label.match(/REQ ([a-f0-9]{10})/i)||[])[1];
assert.notStrictEqual(staleOldRequest,staleNewRequest);
assert.notStrictEqual(staleOldTag,staleNewTag);
assert.throws(
  ()=>m.approveStep(tmp,stale.id,{surface:'browser',targetReason:'explicit_mission_id|req:'+staleOldTag}),
  e=>e&&e.code==='APPROVAL_REQUEST_FINGERPRINT_MISMATCH'
);
stale=m.loadMission(tmp,stale.id);
assert.strictEqual(stale.status,'waiting_dependency');
assert.strictEqual(m.currentStep(stale).status,'blocked');
assert.strictEqual(!!m.currentStep(stale).meta.approvedAt,false);
stale=m.approveStep(tmp,stale.id,{surface:'browser',targetReason:'explicit_mission_id|req:'+staleNewTag});
assert.strictEqual(stale.status,'queued');
assert.strictEqual(m.currentStep(stale).status,'pending');
assert.ok(m.currentStep(stale).meta.approvedAt);

let manual=m.createMission(tmp,{
  type:'browser_form',
  label:'Manual approval compatibility',
  input:{url:'https://example.test/manual',finalClick:'Submit',fields:[]},
  steps:[{name:'browser_click',meta:{requiresApproval:true}}]
});
m.startStep(tmp,manual.id);
manual=m.failStep(tmp,manual.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval required',retryable:true,dependency:'approval'});
manual=m.approveStep(tmp,manual.id,{surface:'browser',targetReason:'explicit_mission_id'});
assert.strictEqual(manual.status,'queued');
assert.ok(m.currentStep(manual).meta.approvedAt,'manual explicit approval without REQ must remain compatible');

// Shopify review binds the human-readable product target plus only a short store
// fingerprint. The raw store/account/token never needs to enter cloud telemetry.
let shop=m.createMission(tmp,{
  type:'shopify_product',
  label:'Publish V-GAP',
  input:{product:{title:'V-GAP Organizer'}},
  steps:['shopify_draft',{name:'shopify_publish',meta:{requiresApproval:true}}]
});
m.startStep(tmp,shop.id);
shop=m.completeStep(tmp,shop.id,{artifact:{product:{
  id:'gid://shopify/Product/12345678',title:'V-GAP Organizer',status:'DRAFT',
  _jarvisStoreHash:'deadbeefcafebabefeedface0123456789abcdef0123456789abcdef01234567'
}}});
m.startStep(tmp,shop.id);
shop=m.failStep(tmp,shop.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval required',retryable:true,dependency:'approval'});
const shopSummary=m.summarizeMission(shop);
assert.ok(shopSummary.label.includes('SHOPIFY PUBLIC'));
assert.ok(shopSummary.label.includes('V-GAP Organizer'));
assert.ok(shopSummary.label.includes('…12345678'));
assert.ok(shopSummary.label.includes('STORE deadbeef'));
assert.ok(!shopSummary.label.includes('cafebabe'));
assert.ok(!shopSummary.label.includes('myshopify.com'));
assert.ok(shopSummary.label.length<=160);

const ordered=m.schedulerOrder([
  {id:'M-ZZZZZZZZZZZZ',status:'queued',createdAt:'2026-10-02T02:00:00.000Z'},
  {id:'M-BBBBBBBBBBBB',status:'waiting_dependency',createdAt:'2026-10-02T01:00:00.000Z'},
  {id:'M-AAAAAAAAAAAA',status:'completed',createdAt:'2026-10-02T00:00:00.000Z'},
  {id:'M-CCCCCCCCCCCC',status:'needs_verification',createdAt:'2026-10-02T01:30:00.000Z'}
]);
assert.deepStrictEqual(ordered.map(x=>x.id),[
  'M-BBBBBBBBBBBB',
  'M-CCCCCCCCCCCC',
  'M-ZZZZZZZZZZZZ'
]);

console.log('MISSION ENGINE SELFTEST PASS');
