const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_short_motion_rhythm_v1'"),'Creator Short motion capability missing');
assert.ok(worker.includes("creatorShortMotionReady:CAPS.includes('creator_short_motion_rhythm_v1')"),'PC acceptance Short motion readiness missing');

assert.strictEqual(typeof creator.buildShortStoryboard,'function','Short storyboard builder export missing');

const single=creator.buildShortStoryboard(['/tmp/a.mp4'],15,0.18,3.2,7);
assert.ok(single.length>=4&&single.length<=7,'one clip must become a paced multi-scene Short');
assert.strictEqual(single[0].start,0);
assert.ok(Math.abs(single[single.length-1].end-15)<0.01,'Short storyboard must cover target duration');
assert.ok(single.every(x=>Number(x.duration)>2&&Number(x.duration)<=4.5),'Short scenes must stay in fast edit range');
assert.ok(new Set(single.map(x=>x.sourceOffset)).size>1,'reused clip must use different source offsets');
assert.ok(new Set(single.map(x=>x.motionPhase)).size>1,'reused clip must use different motion phases');
assert.ok(new Set(single.map(x=>x.transition).filter(Boolean)).size>1,'Short must use varied safe transitions');

const multi=creator.buildShortStoryboard(['/tmp/a.mp4','/tmp/b.mp4','/tmp/c.mp4'],18,0.18,3.2,7);
assert.ok(multi.length>=5&&multi.length<=7,'18 second Short must have fast paced scenes');
assert.deepStrictEqual(multi.slice(0,3).map(x=>x.assetIndex),[0,1,2],'first cycle must preserve source order');
assert.ok(multi.some(x=>x.cycle>0),'Short storyboard should cycle assets when useful');

assert.ok(source.includes('function buildShortStoryboard('),'Short motion storyboard implementation missing');
assert.ok(source.includes("'scale=1180:2100:force_original_aspect_ratio=increase,'"),'overscale motion canvas missing');
assert.ok(source.includes("35*sin(t*1.15+"),'horizontal animated crop missing');
assert.ok(source.includes("55*cos(t*0.85+"),'vertical animated crop missing');
assert.ok(source.includes("const transitionName=String(storyboard[i].transition||'fade')"),'varied transition selection missing');
assert.ok(source.includes("'-map',String(storyboard.length)+':a:0'"),'audio input index must follow expanded Short storyboard inputs');
assert.ok(source.includes("motion:assets.length?'dynamic-pan-crop':'procedural'"),'Short motion evidence missing');
assert.ok(source.includes("e.code='CREATOR_SHORT_EDIT_RHYTHM_FAILED'"),'Short edit rhythm must fail closed');
assert.ok(source.includes("sceneTarget:'2.5-4s'"),'Short profile scene target missing');
assert.ok(source.includes("transition:'varied'"),'Short profile varied transition metadata missing');

for(const cap of [
  'creator_web_media_v1',
  'creator_youtube_attribution_v1',
  'creator_visual_relevance_v1',
  'creator_longform_edit_rhythm_v1',
  'creator_quality_gate_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}

assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SHORT MOTION V73 SELFTEST PASS');
