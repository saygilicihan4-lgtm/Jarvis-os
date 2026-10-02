const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const vm=require('vm');
const engine=require('./jarvis-mission-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const start=worker.indexOf('function missionControlCandidates(action)');
const end=worker.indexOf('function approveMissionGate',start);
assert.ok(start>0&&end>start,'Mission Control helper source block missing');
const helperSource=worker.slice(start,end);

function harness(workspace){
  const sandbox={WORKSPACE:workspace,getMissionEngine:()=>engine};
  vm.createContext(sandbox);
  vm.runInContext(helperSource+'\nthis.requestMissionControl=requestMissionControl;this.applyPendingMissionControl=applyPendingMissionControl;',sandbox);
  return sandbox;
}
function tmpWorkspace(label){
  return fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-mc-'+label+'-'));
}

// Approval-gated mission: pause/resume must never turn the gate into a runnable queued step.
{
  const workspace=tmpWorkspace('approval');
  const h=harness(workspace);
  let m=engine.createMission(workspace,{type:'shopify_product',steps:[{name:'shopify_publish',meta:{requiresApproval:true}}]});
  engine.startStep(workspace,m.id);
  m=engine.failStep(workspace,m.id,{code:'EXPLICIT_APPROVAL_REQUIRED',message:'approval required',retryable:true,dependency:'approval'});
  assert.strictEqual(m.status,'waiting_dependency');
  assert.strictEqual(engine.currentStep(m).status,'blocked');
  assert.strictEqual(engine.currentStep(m).error.dependency,'approval');

  m=h.requestMissionControl({missionId:m.id,action:'pause'});
  assert.strictEqual(m.status,'paused');
  assert.strictEqual(m.control.resumeStatus,'waiting_dependency');
  assert.strictEqual(engine.currentStep(m).error.dependency,'approval');

  assert.throws(
    ()=>h.requestMissionControl({missionId:m.id,action:'pause'}),
    /duraklatılamaz/,
    're-pausing a paused gated mission must be rejected'
  );
  const stillPaused=engine.loadMission(workspace,m.id);
  assert.strictEqual(stillPaused.status,'paused');
  assert.strictEqual(stillPaused.control.resumeStatus,'waiting_dependency','repeated pause must not overwrite gated resume state');

  m=h.requestMissionControl({missionId:m.id,action:'resume'});
  assert.strictEqual(m.status,'waiting_dependency');
  assert.strictEqual(engine.currentStep(m).status,'blocked');
  assert.strictEqual(engine.currentStep(m).error.dependency,'approval','resume must preserve explicit approval dependency');
}

// Verification-gated mission: pause/resume must return to needs_verification, not queued.
{
  const workspace=tmpWorkspace('verify');
  const h=harness(workspace);
  let m=engine.createMission(workspace,{type:'youtube_publish',steps:['youtube_publish']});
  engine.startStep(workspace,m.id);
  m=engine.failStep(workspace,m.id,{code:'YOUTUBE_PUBLISH_UNCERTAIN',message:'uncertain publish',uncertain:true});
  assert.strictEqual(m.status,'needs_verification');
  assert.strictEqual(engine.currentStep(m).status,'uncertain');

  m=h.requestMissionControl({missionId:m.id,action:'pause'});
  assert.strictEqual(m.status,'paused');
  assert.strictEqual(m.control.resumeStatus,'needs_verification');

  m=h.requestMissionControl({missionId:m.id,action:'resume'});
  assert.strictEqual(m.status,'needs_verification');
  assert.strictEqual(engine.currentStep(m).status,'uncertain','resume must not arm uncertain external side effect for retry');
}

// Running work receives a persisted request only; no force-stop happens until boundary helper is applied.
{
  const workspace=tmpWorkspace('running');
  const h=harness(workspace);
  let m=engine.createMission(workspace,{type:'pc_safe',steps:['step_one','step_two']});
  m=engine.startStep(workspace,m.id);
  assert.strictEqual(m.status,'running');

  const requested=h.requestMissionControl({missionId:m.id,action:'pause'});
  assert.strictEqual(requested.status,'running');
  assert.strictEqual(requested.control.requested,'pause');

  engine.completeStep(workspace,m.id,{artifact:{ok:true}});
  m=h.applyPendingMissionControl(engine.loadMission(workspace,m.id));
  assert.strictEqual(m.status,'paused');
  assert.strictEqual(m.control.resumeStatus,'queued');
  assert.strictEqual(m.currentStep,1);
}

// Cancelled missions are terminal; paused missions can be cancelled without resuming work.
{
  const workspace=tmpWorkspace('cancel');
  const h=harness(workspace);
  let m=engine.createMission(workspace,{type:'workspace_file',steps:['copy_one']});
  m=h.requestMissionControl({missionId:m.id,action:'pause'});
  assert.strictEqual(m.status,'paused');
  m=h.requestMissionControl({missionId:m.id,action:'cancel'});
  assert.strictEqual(m.status,'cancelled');
  assert.ok(m.completedAt);
  assert.ok(!engine.schedulerOrder([m]).length,'cancelled mission must stay outside scheduler');
}

// Ambiguous implicit control must require missionId.
{
  const workspace=tmpWorkspace('ambiguous');
  const h=harness(workspace);
  engine.createMission(workspace,{type:'a',steps:['one']});
  engine.createMission(workspace,{type:'b',steps:['one']});
  assert.throws(()=>h.requestMissionControl({action:'pause'}),/missionId/);
}

console.log('MISSION CONTROL STATE SELFTEST PASS');
