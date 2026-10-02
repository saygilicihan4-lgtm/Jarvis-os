const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

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

const row=(name,hash=name)=>({path:'creator-assets/'+name+'.mp4',sha256:hash});
const web=[row('web-a'),row('web-b')];
const semantic=[row('semantic-a')];
const fallback=[row('random-a'),row('random-b'),row('random-c')];

const relevant=choose(web,semantic,fallback,12);
assert.deepStrictEqual(
  relevant.map(x=>x.path),
  ['creator-assets/web-a.mp4','creator-assets/web-b.mp4','creator-assets/semantic-a.mp4'],
  'random local fallback must not pad a non-empty relevance-qualified set'
);
assert.ok(!relevant.some(x=>/random-/.test(x.path)),'irrelevant filler leaked into a relevant daily selection');

const semanticOnly=choose([],semantic,fallback,12);
assert.deepStrictEqual(semanticOnly.map(x=>x.path),['creator-assets/semantic-a.mp4']);

const fallbackOnly=choose([],[],fallback,2);
assert.deepStrictEqual(
  fallbackOnly.map(x=>x.path),
  ['creator-assets/random-a.mp4','creator-assets/random-b.mp4'],
  'deterministic local fallback must remain available when no relevant asset exists'
);

const deduped=choose([row('shared','same')],[row('shared','same'),row('semantic-b')],fallback,12);
assert.deepStrictEqual(
  deduped.map(x=>x.path),
  ['creator-assets/shared.mp4','creator-assets/semantic-b.mp4'],
  'relevance merge must preserve path dedupe without invoking fallback'
);

assert.ok(worker.includes("'creator_relevance_preserving_fallback_v1'"),'v96 capability missing');
assert.ok(worker.includes('chooseCreatorDailyBaselines(web,semantic,creatorDailyAutoAssetBaselines(dateKey,12),12)'),'daily planner must use relevance-preserving fallback policy');
assert.ok(!worker.includes('mergeCreatorAssetBaselines(web,mergeCreatorAssetBaselines(semantic,creatorDailyAutoAssetBaselines(dateKey,12),12),12)'),'old random-padding chain must be removed');

const dailyStart=worker.indexOf('async function serviceCreatorDailyPlan');
const dailyEnd=worker.indexOf('function normalizePcMissionActions',dailyStart);
assert.ok(dailyStart>0&&dailyEnd>dailyStart,'daily service block missing');
const daily=worker.slice(dailyStart,dailyEnd);
assert.ok(daily.includes('publish:false'),'daily workflow must stay DRAFT-only');
assert.ok(!daily.includes('publish:true'),'daily workflow must never auto-PUBLIC YouTube');
assert.ok(!daily.includes('youtube_publish'),'daily workflow must never create YouTube PUBLIC step');

assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit approval rule regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify explicit approval rule regressed');

console.log('CREATOR RELEVANCE FALLBACK V96 SELFTEST PASS',JSON.stringify({
  relevant:relevant.map(x=>x.path),
  fallbackOnly:fallbackOnly.map(x=>x.path)
}));
