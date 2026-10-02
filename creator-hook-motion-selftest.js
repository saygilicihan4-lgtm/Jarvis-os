const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_hook_motion_evidence_v1'"),'hook motion evidence capability missing');
assert.ok(worker.includes("creatorHookMotionReady:CAPS.includes('creator_hook_motion_evidence_v1')"),'PC acceptance hook motion readiness missing');

assert.strictEqual(typeof creator.probeHookMotion,'function','probeHookMotion export missing');
assert.strictEqual(typeof creator.findHookMotionWindow,'function','findHookMotionWindow export missing');

assert.ok(source.includes("'-f','framemd5','-'"),'decoded-frame motion evidence missing');
assert.ok(source.includes("'fps='+rate+',scale=64:64:flags=area,format=gray'"),'bounded hook frame sampling missing');
assert.ok(source.includes("sampleCount>=3&&uniqueFrames>=2&&changeRatio>=0.12"),'hook motion threshold missing');
assert.ok(source.includes("maxOffsetSeconds=3"),'bounded hook motion search horizon missing');
assert.ok(source.includes("stepSeconds=0.5"),'hook motion search step missing');
assert.ok(source.includes("findHookMotionWindow(assets[0],status.ffmpeg"),'Short renderer hook motion probe missing');
assert.ok(source.includes("storyboard[0].sourceOffset=Number(hookMotion.offset||0)"),'moving-window source offset binding missing');
assert.ok(source.includes("hookMotion.ok===true"),'visual edit gate must require motion evidence');
assert.ok(source.includes("e.code='CREATOR_SHORT_HOOK_MOTION_MISSING'"),'missing-motion render must fail closed');
assert.ok(source.includes("hookMotion,"),'hook motion metadata evidence missing');

for(const cap of [
  'creator_micro_hook_v1',
  'creator_real_motion_hook_v1',
  'creator_batch_web_diversity_v1',
  'creator_short_kinetic_captions_v1',
  'creator_quality_gate_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR HOOK MOTION EVIDENCE V84 SELFTEST PASS');
