const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const m=require('./jarvis-mission-engine');

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

console.log('MISSION ENGINE SELFTEST PASS');
