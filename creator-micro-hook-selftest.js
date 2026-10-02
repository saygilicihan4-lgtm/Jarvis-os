const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_micro_hook_v1'"),'Creator micro-hook capability missing');
assert.ok(worker.includes("creatorMicroHookReady:CAPS.includes('creator_micro_hook_v1')"),'PC acceptance micro-hook readiness missing');

const one=creator.buildShortStoryboard(['/tmp/video.mp4'],15,0.18,3.2,7,0.9);
assert.ok(one.length>=4,'micro-hook storyboard must retain paced scenes');
assert.strictEqual(one[0].hook,true,'first scene must be marked as hook');
assert.strictEqual(one[0].start,0,'hook must start at t=0');
assert.ok(one[0].duration>=0.75&&one[0].duration<=1.05,'hook duration must stay under ~1 second');
assert.strictEqual(one[0].sourceOffset,0,'first hook should begin at source start for maximum immediate motion');
assert.ok(one.slice(1).every(x=>x.duration>2&&x.duration<=4.5),'post-hook scenes must remain fast paced');
assert.ok(Math.abs(one[one.length-1].end-15)<0.01,'micro-hook storyboard must still cover full Short duration');

const three=creator.buildShortStoryboard(['/tmp/a.mp4','/tmp/b.mp4','/tmp/c.mp4'],18,0.18,3.2,7,0.9);
assert.strictEqual(three[0].assetIndex,0,'prioritized real-motion asset must remain the hook asset');
assert.strictEqual(three[1].assetIndex,1,'post-hook asset order must remain stable');
assert.ok(three[0].duration<three[1].duration,'micro-hook must be shorter than normal scenes');

const clampedLow=creator.buildShortStoryboard(['/tmp/a.mp4'],12,0.18,3.2,7,0.2);
const clampedHigh=creator.buildShortStoryboard(['/tmp/a.mp4'],12,0.18,3.2,7,2);
assert.ok(clampedLow[0].duration>=0.75,'hook lower bound missing');
assert.ok(clampedHigh[0].duration<=1.05,'hook upper bound missing');

assert.ok(source.includes('hookSceneSeconds=0.9'),'micro-hook default missing');
assert.ok(source.includes("hook:index===0"),'hook scene marker missing');
assert.ok(source.includes("hookSeconds>=0.75&&hookSeconds<=1.05"),'render micro-hook fail-closed evidence missing');
assert.ok(source.includes("hookAssetIndex:hookScene?Number(hookScene.assetIndex):-1"),'hook asset evidence missing');
assert.ok(source.includes("hookTarget:'0.75-1.05s'"),'micro-hook profile metadata missing');
assert.ok(source.includes('const storyboard=buildShortStoryboard(assets,duration,transition,3.2,7,0.9)'),'Short renderer must request micro-hook pacing');

for(const cap of [
  'creator_real_motion_hook_v1',
  'creator_web_freshness_v1',
  'creator_short_kinetic_captions_v1',
  'creator_short_motion_rhythm_v1',
  'creator_quality_gate_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}

assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR MICRO HOOK V81 SELFTEST PASS');
