const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_scene_web_queries_v1'"),'scene web query capability missing');
assert.ok(worker.includes("creatorSceneWebReady:CAPS.includes('creator_scene_web_queries_v1')"),'PC acceptance scene-web readiness missing');
assert.ok(worker.includes('function creatorSceneWebQueries(title,script,{maxQueries=3,maxTerms=7}={})'),'scene query planner missing');
assert.ok(worker.includes("const queries=explicit\n    ?[explicit]\n    :queryPlanner"),'explicit web query must override scene query generation');
assert.ok(worker.includes('const queryPlanner=narrative?creatorNarrativeWebQueries:creatorSceneWebQueries'),'Short scene planner and long-form narrative planner must both remain available');
assert.ok(worker.includes("const perQuery=Math.max(1,Math.min(4,Math.ceil(wanted/queries.length)))"),'bounded per-query media request missing');
assert.ok(worker.includes("sceneAware:queries.length>1"),'scene-aware evidence missing');
assert.ok(worker.includes("maxQueries:2,\n            manifestId:'batch-'"),'batch query cap must be 2');
assert.ok(worker.includes("maxQueries:3,\n          manifestId:'short-'"),'Short query cap must be 3');
assert.ok(worker.includes("maxQueries:4,\n          manifestId:'long-'"),'long-form query cap must be 4');
assert.ok(worker.includes("maxQueries:2,\n          manifestId:'varova-'"),'VAROVA query cap must be 2');
assert.ok(worker.includes("maxQueries:3,\n            manifestId:'daily-'"),'daily query cap must be 3');

const start=worker.indexOf('function creatorAutoWebQuery(title,script,maxTerms=9)');
const end=worker.indexOf('async function creatorAutoWebAssets',start);
assert.ok(start>0&&end>start,'scene query planner block missing');
const fnSource=worker.slice(start,end);
const planners=Function(fnSource+'; return {creatorAutoWebQuery,creatorSceneWebQueries};')();

const title='Geleceğin Robot Fabrikası';
const script=[
  'Sabah vardiyasında insansı robotlar üretim hattına giriyor ve metal parçaları taşıyor.',
  'Bir laboratuvar mühendisi yapay zeka sisteminin kameralarını ve sensörlerini test ediyor.',
  'Otonom robot kolu hassas elektronik parçaları yüksek hızda monte ediyor.',
  'Depo bölümünde küçük mobil robotlar raflar arasında paketleri taşıyor ve rota planlıyor.',
  'Günün sonunda insanlar ve robotlar aynı üretim alanında güvenli biçimde birlikte çalışıyor.'
].join(' ');
const qs=planners.creatorSceneWebQueries(title,script,{maxQueries:4,maxTerms:7});
assert.ok(qs.length>=2&&qs.length<=4,'scene-aware planner should produce bounded diverse queries');
assert.strictEqual(new Set(qs).size,qs.length,'scene queries must be unique');
assert.ok(qs.every(q=>q.length>0&&q.length<=140),'scene queries must stay bounded');
assert.ok(qs.some(q=>/laboratuvar|sensör|sensor|kamera/.test(q)),'middle-scene concepts should affect query diversity');
assert.ok(qs.some(q=>/depo|mobil|raf|paket/.test(q)),'later-scene concepts should affect query diversity');

const one=planners.creatorSceneWebQueries(title,'Robot fabrikada çalışıyor.',{maxQueries:4,maxTerms:7});
assert.ok(one.length>=1&&one.length<=4,'short scripts must still yield at least one query');

assert.ok(worker.includes("'creator_auto_web_query_v1'"),'Auto Web v75 capability regressed');
assert.ok(worker.includes("'creator_image_motion_fallback_v1'"),'Image Motion v74 capability regressed');
assert.ok(worker.includes("'creator_short_motion_rhythm_v1'"),'Short Motion v73 capability regressed');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SCENE WEB V76 SELFTEST PASS');
