const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.strictEqual(creator.ENGINE_VERSION,'1.5');

for(const cap of [
  'creator_director_v1',
  'creator_editorial_cadence_v1',
  'creator_visual_repetition_guard_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' missing');
}

assert.ok(source.includes('function buildEditorialTimeline(assets,durationSeconds'),'editorial timeline builder missing');
assert.ok(source.includes('function editorialTimelineQuality(timeline,assetCount)'),'editorial quality evidence missing');
assert.ok(source.includes("split='+shots.length"),'director must split normalized assets into reusable shot branches');
assert.ok(source.includes("concat=n='+storyboard.length+':v=1:a=0[vcut]'"),'director hard-cut concat graph missing');
assert.ok(source.includes("editing:'director-hard-cut-cadence-v1'"),'director profile marker missing');
assert.ok(source.includes('editorial,\n    captionsBurned'),'editorial evidence missing from long-form metadata');
assert.ok(source.includes('editorial,\n    sceneCount:storyboard.length'),'editorial evidence missing from render result');

const assets=['a.mp4','b.mp4','c.mp4','d.mp4'];
const timeline=creator.buildEditorialTimeline(assets,600,{seed:'director-selftest'});
const quality=creator.editorialTimelineQuality(timeline,assets.length);

assert.ok(timeline.length>=70,'10-minute edit should contain many short shots');
assert.strictEqual(timeline[0].start,0,'timeline must start at zero');
assert.strictEqual(timeline[timeline.length-1].end,600,'timeline must cover full duration');
assert.deepStrictEqual(timeline.slice(0,8).map(x=>x.assetIndex),[0,1,2,3,0,1,2,3],'explicit asset order must cycle predictably');
assert.ok(timeline.every(x=>x.duration>=3&&x.duration<=9.05),'every shot must remain in bounded editorial cadence');
assert.strictEqual(quality.ok,true,'editorial quality gate must pass canonical 10-minute timeline');
assert.ok(quality.averageShotSeconds<=8.5,'average shot cadence too slow');
assert.ok(quality.maxShotSeconds<=9.05,'single shot too long');
assert.strictEqual(quality.consecutiveDuplicateAssets,0,'multi-asset timeline must avoid consecutive visual repeats');
assert.strictEqual(quality.repetitionGuardPass,true,'visual repetition guard must pass');

assert.ok(worker.includes("'creator_longform_mission_v1'"),'v68 long-form capability must remain');
assert.ok(worker.includes("'creator_daily_longform_v1'"),'v68 daily long-form capability must remain');
assert.ok(source.includes('function probeRenderedLongform(file,ffprobe)'),'v68 FFprobe long-form quality gate must remain');
assert.ok(source.includes('function probeRenderedShort(file,ffprobe)'),'v67 Shorts quality gate must remain');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'v66 Creator Batch must remain');
assert.ok(worker.includes("'creator_storyboard_v1'"),'v65 Creator Storyboard must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit approval policy must remain');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify explicit approval policy must remain');

console.log('CREATOR DIRECTOR V69 SELFTEST PASS');
