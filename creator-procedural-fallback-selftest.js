const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');
const semantic=require('./jarvis-creator-semantic-quality');

assert.strictEqual(semantic.SEMANTIC_QUALITY_VERSION,'1.3','current semantic narrative digest quality must remain');

function block(start,end){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  assert.ok(a>=0&&b>a,'worker helper block missing: '+start);
  return worker.slice(a,b);
}

const merge=Function(
  block('function mergeCreatorAssetBaselines(', 'function chooseCreatorDailyBaselines(')+
  ';return mergeCreatorAssetBaselines;'
)();
const choose=Function(
  'mergeCreatorAssetBaselines',
  block('function chooseCreatorDailyBaselines(', 'function creatorDailyAutoAssetBaselines(')+
  ';return chooseCreatorDailyBaselines;'
)(merge);

const row=name=>({path:'creator-assets/'+name+'.mp4',sha256:name.padEnd(64,'0').slice(0,64)});
const relevant=choose([row('web')],[row('semantic')],12);
assert.deepStrictEqual(relevant.map(x=>x.path),['creator-assets/web.mp4','creator-assets/semantic.mp4']);
assert.deepStrictEqual(choose([],[],12),[],'empty relevance set must stay empty instead of selecting unrelated local B-roll');

assert.ok(worker.includes("'creator_semantic_narrative_digest_v1'"),'semantic narrative digest capability regressed');
assert.ok(worker.includes("'creator_procedural_fallback_v1'"),'procedural fallback capability missing');
assert.ok(worker.includes("const creatorAssetMode=baselineOverride&&!creatorAssets.length?'procedural':'auto'"),
  'empty daily baseline override must bind procedural mode into durable mission input');
assert.ok(worker.includes("assetMode:String(input.creatorAssetMode||'auto')"),
  'durable long-form runner must pass mission-bound asset mode to renderer');
assert.ok(worker.includes("assetSelection:String(out.assetSelection||'automatic')"),
  'durable artifact must record renderer selection mode');

assert.ok(engine.includes("const proceduralAssets=requestedAssetMode==='procedural'"),
  'long-form renderer procedural mode missing');
assert.ok(engine.includes("const assetCandidates=proceduralAssets?[]:"),
  'procedural mode must not auto-select workspace B-roll');
assert.ok(engine.includes("const assetSelection=proceduralAssets?'procedural':"),
  'renderer must record procedural selection evidence');

const dailyStart=worker.indexOf('async function serviceCreatorDailyPlan');
const dailyEnd=worker.indexOf('function normalizePcMissionActions',dailyStart);
assert.ok(dailyStart>0&&dailyEnd>dailyStart,'daily service block missing');
const daily=worker.slice(dailyStart,dailyEnd);
assert.ok(daily.includes('chooseCreatorDailyBaselines(web,semantic,12)'),'daily planner must use relevance-only baselines');
assert.ok(!daily.includes('chooseCreatorDailyBaselines(web,semantic,creatorDailyAutoAssetBaselines'),
  'daily planner must not force random local fallback');
assert.ok(daily.includes('_creatorAssetBaselines:automatic'),'daily mission must preserve empty baseline override as explicit intent');
assert.ok(daily.includes("assetMode:automatic.length?'relevant':'procedural'"),'daily evidence must record procedural fallback');

assert.ok(worker.includes('creatorSemanticNarrativeDigest(query,3200)'),'v98 narrative digest integration must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify PUBLIC approval policy regressed');

console.log('CREATOR PROCEDURAL FALLBACK V98 SELFTEST PASS',JSON.stringify({
  relevant:relevant.map(x=>x.path),
  empty:choose([],[],12)
}));
