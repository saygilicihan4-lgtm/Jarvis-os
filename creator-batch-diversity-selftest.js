const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_batch_web_diversity_v1'"),'batch web diversity capability missing');
assert.ok(worker.includes("creatorBatchWebDiversityReady:CAPS.includes('creator_batch_web_diversity_v1')"),'PC acceptance batch diversity readiness missing');

const start=worker.indexOf('function creatorPreferUnseenAssetPaths(paths,excludeSet,maxItems=12)');
const end=worker.indexOf('function creatorAutoWebQuery',start);
assert.ok(start>0&&end>start,'pure batch diversity helper missing');
const fnSource=worker.slice(start,end);
const prefer=Function(fnSource+'; return creatorPreferUnseenAssetPaths;')();

const exclude=new Set(['creator-assets/a.mp4','creator-assets/b.mp4']);
const ordered=prefer([
  'creator-assets/a.mp4',
  'creator-assets/c.mp4',
  'creator-assets/b.mp4',
  'creator-assets/d.mp4',
  'creator-assets/c.mp4'
],exclude,4);

assert.deepStrictEqual(
  ordered,
  ['creator-assets/c.mp4','creator-assets/d.mp4','creator-assets/a.mp4','creator-assets/b.mp4'],
  'unseen assets must be preferred while previous batch assets remain fallback'
);

const fallback=prefer(
  ['creator-assets/a.mp4','creator-assets/b.mp4'],
  exclude,
  2
);
assert.deepStrictEqual(
  fallback,
  ['creator-assets/a.mp4','creator-assets/b.mp4'],
  'batch diversity must fail open when no unseen asset exists'
);

assert.ok(worker.includes("excludePaths=[]"),'auto-web excludePaths option missing');
assert.ok(worker.includes('const batchWebSeen=new Set()'),'batch-scoped seen set missing');
assert.ok(worker.includes('excludePaths:[...batchWebSeen]'),'batch seen assets must be passed to auto-web');
assert.ok(worker.includes("for(const rel of assets)batchWebSeen.add"),'selected batch web assets must be remembered');
assert.ok(worker.includes('const unseenOrdered=creatorPreferUnseenAssetPaths(motionOrdered,batchExcluded,wanted)'),'diversity must run after freshness + media-kind hook ordering');
assert.ok(worker.includes('const hookRank=creatorPreferVerifiedMotionHookAssets(unseenOrdered,orientation,ready.ffmpeg);'),'verified hook ranking must run after batch diversity');
assert.ok(worker.includes('const ordered=hookRank.paths.slice(0,wanted)'),'final ordering must preserve batch diversity except for verified hook promotion');
assert.ok(worker.includes('unseenCount'),'diversity evidence missing');
assert.ok(worker.includes('batchExcludedCount:batchExcluded.size'),'batch exclusion evidence missing');

for(const cap of [
  'creator_real_motion_hook_v1',
  'creator_web_freshness_v1',
  'creator_short_kinetic_captions_v1',
  'creator_scene_web_queries_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}

assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR BATCH WEB DIVERSITY V81 SELFTEST PASS');
