const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_auto_hook_motion_rank_v1'"),'auto hook motion rank capability missing');
assert.ok(worker.includes("creatorAutoHookRankReady:CAPS.includes('creator_auto_hook_motion_rank_v1')"),'PC acceptance auto hook rank readiness missing');
assert.ok(worker.includes('function creatorOrderVerifiedMotionHookAssets('),'pure verified hook ordering helper missing');
assert.ok(worker.includes('function creatorPreferVerifiedMotionHookAssets('),'verified motion hook probe helper missing');
assert.ok(worker.includes('const limit=Math.min(3,rows.length)'),'auto hook candidate probe budget must be capped at 3');
assert.ok(worker.includes('findHookMotionWindow(safeFile(rel),ffmpeg'),'auto hook candidates must use decoded-frame motion evidence');
assert.ok(worker.includes('windowSeconds:0.95,maxOffsetSeconds:1.5,stepSeconds:0.5,fps:6'),'bounded auto hook motion probe profile missing');
assert.ok(worker.includes('const hookRank=creatorPreferVerifiedMotionHookAssets(unseenOrdered,orientation,ready.ffmpeg);'),'auto web flow must apply verified motion ranking after diversity ordering');
assert.ok(worker.includes('const ordered=hookRank.paths.slice(0,wanted);'),'auto web flow must preserve ranked hook candidate');
assert.ok(worker.includes('hookMotionVerified:hookRank.verified'),'auto hook evidence missing from memory record');
assert.ok(worker.includes('hookMotionProbeCount:hookRank.probeCount'),'auto hook probe count evidence missing');
assert.ok(worker.includes('hookMotionMeanDifference:Number(hookRank.meanDifference||0)'),'auto hook motion score evidence missing');

const start=worker.indexOf('function creatorOrderVerifiedMotionHookAssets(');
const end=worker.indexOf('function creatorPreferVerifiedMotionHookAssets(',start);
assert.ok(start>0&&end>start,'pure auto hook ordering block missing');
const fnSource=worker.slice(start,end);
const order=Function(fnSource+'; return creatorOrderVerifiedMotionHookAssets;')();

const paths=['creator-assets/a.mp4','creator-assets/b.mp4','creator-assets/c.mp4','creator-assets/d.mp4'];
const evidence=new Map([
  [paths[0],{ok:false,meanDifference:0.02,peakDifference:0.05,activeRatio:0.1}],
  [paths[1],{ok:true,meanDifference:0.41,peakDifference:0.7,activeRatio:0.8}],
  [paths[2],{ok:true,meanDifference:0.2,peakDifference:0.4,activeRatio:0.6}]
]);
assert.deepStrictEqual(order(paths,evidence,'portrait'),[paths[1],paths[0],paths[2],paths[3]],'strongest verified moving candidate should become hook while preserving remaining order');
assert.deepStrictEqual(order(paths,new Map(),'portrait'),paths,'no verified motion should preserve existing order');
assert.deepStrictEqual(order(paths,evidence,'landscape'),paths,'long-form/landscape order must not be changed by Short hook rank');

for(const cap of [
  'creator_hook_motion_evidence_v1',
  'creator_real_motion_hook_v1',
  'creator_batch_web_diversity_v1',
  'creator_micro_hook_v1',
  'creator_web_freshness_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR AUTO HOOK MOTION RANK V85 SELFTEST PASS');
