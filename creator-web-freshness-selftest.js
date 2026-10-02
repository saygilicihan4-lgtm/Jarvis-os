const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_web_freshness_v1'"),'web freshness capability missing');
assert.ok(worker.includes("creatorWebFreshnessReady:CAPS.includes('creator_web_freshness_v1')"),'PC acceptance freshness readiness missing');
assert.ok(worker.includes("const CREATOR_ASSET_USAGE_FILE=path.join(MEMORY_DIR,'creator-asset-usage.json')"),'asset usage ledger path missing');
assert.ok(worker.includes('function readCreatorAssetUsage()'),'usage ledger reader missing');
assert.ok(worker.includes('function writeCreatorAssetUsage(usage)'),'usage ledger writer missing');
assert.ok(worker.includes('function creatorRecentWebAssetSet(days=7)'),'recent web asset window missing');
assert.ok(worker.includes('function creatorMarkWebAssetsUsed(assets,context={})'),'web asset usage marker missing');
assert.ok(worker.includes('sourceRecordsForAssets(WORKSPACE,paths)'),'usage marker must only accept manifest-backed web assets');

const start=worker.indexOf('function creatorPreferFreshAssetPaths(paths,recentSet,maxItems=12)');
const end=worker.indexOf('function creatorRecentWebAssetSet',start);
assert.ok(start>0&&end>start,'pure freshness ordering helper missing');
const fnSource=worker.slice(start,end);
const prefer=Function(fnSource+'; return creatorPreferFreshAssetPaths;')();

const recent=new Set(['creator-assets/old-a.mp4','creator-assets/old-b.mp4']);
const ordered=prefer([
  'creator-assets/old-a.mp4',
  'creator-assets/new-a.mp4',
  'creator-assets/new-b.mp4',
  'creator-assets/old-b.mp4',
  'creator-assets/new-a.mp4'
],recent,4);
assert.deepStrictEqual(
  ordered,
  ['creator-assets/new-a.mp4','creator-assets/new-b.mp4','creator-assets/old-a.mp4','creator-assets/old-b.mp4'],
  'fresh web assets must be preferred while recent assets remain fallback'
);

const fallback=prefer(
  ['creator-assets/old-a.mp4','creator-assets/old-b.mp4'],
  recent,
  2
);
assert.deepStrictEqual(
  fallback,
  ['creator-assets/old-a.mp4','creator-assets/old-b.mp4'],
  'freshness must fail open when no new web media exists'
);

assert.ok(worker.includes('const candidateTarget=Math.min(12,wanted+Math.min(4,queries.length))'),'auto web must fetch a bounded extra candidate pool');
assert.ok(worker.includes('const freshOrdered=creatorPreferFreshAssetPaths(unique,recent,wanted)'),'auto web freshness ordering missing');
assert.ok(worker.includes('const ordered=creatorPreferRealMotionHookAssets(freshOrdered,orientation)'),'v80 hook ordering must run after freshness');
assert.ok(worker.includes('freshnessDays:7'),'freshness evidence missing');
assert.ok(worker.includes('freshCount'),'freshness evidence must record fresh candidate count');
assert.ok(worker.includes('creatorMarkWebAssetsUsed(out.assets.map'),'successful render usage recording missing');
assert.ok(worker.includes("type:String(mission.type||'creator_longform')"),'long-form freshness context missing');
assert.ok(worker.includes("type:String(mission.type||'creator_short')"),'Short freshness context missing');
assert.ok(worker.includes('creatorMarkWebAssetsUsed(meta&&meta.sourceAssets'),'recovered successful render must restore usage evidence');

for(const cap of [
  'creator_short_kinetic_captions_v1',
  'creator_narrative_visual_sync_v1',
  'creator_scene_web_queries_v1',
  'creator_image_motion_fallback_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR WEB FRESHNESS V79 SELFTEST PASS');
