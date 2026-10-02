const fs=require('fs');
const assert=require('assert');
const semantic=require('./jarvis-creator-semantic-quality');

assert.strictEqual(semantic.SEMANTIC_QUALITY_VERSION,'1.1');

const zero=[
  {path:'creator-assets/beach.mp4',sha256:'a',score:0,tags:['sahil','deniz'],summary:'Güneşli sahil görüntüsü.'},
  {path:'creator-assets/coffee.mp4',sha256:'b',score:0,tags:['kahve','kafe'],summary:'Bir fincan kahve yakın planda.'}
];

const blocked=semantic.diversifySemanticRows(zero,{minScore:1,maxSimilarity:0.72,maxItems:12});
assert.deepStrictEqual(blocked.rows,[],'zero-relevance catalog must return no semantic B-roll');
assert.strictEqual(blocked.evidence.eligibleCount,0);
assert.strictEqual(blocked.evidence.rejectedLowRelevanceCount,2);
assert.strictEqual(blocked.evidence.relevanceFloorBlockedAll,true);
assert.strictEqual(blocked.evidence.fallbackUsed,false);

const locallyApproved=semantic.diversifySemanticRows(zero,{
  minScore:1,maxSimilarity:0.72,maxItems:12,
  allowPaths:['creator-assets/coffee.mp4']
});
assert.deepStrictEqual(locallyApproved.rows.map(x=>x.path),['creator-assets/coffee.mp4'],
  'explicit local semantic reranker allowlist must remain a valid relevance signal');
assert.strictEqual(locallyApproved.evidence.relevanceFloorBlockedAll,false);
assert.strictEqual(locallyApproved.evidence.modelAllowlistCount,1);

const relevant=[
  {path:'creator-assets/robot.mp4',sha256:'c',score:7,tags:['robot','fabrika'],summary:'Robot kolu fabrikada çalışıyor.'},
  ...zero
];
const mixed=semantic.diversifySemanticRows(relevant,{minScore:1,maxSimilarity:0.72,maxItems:12});
assert.deepStrictEqual(mixed.rows.map(x=>x.path),['creator-assets/robot.mp4']);
assert.strictEqual(mixed.evidence.rejectedLowRelevanceCount,2);

const worker=fs.readFileSync('./worker.js','utf8');
assert.ok(worker.includes("'creator_semantic_relevance_floor_v1'"),'v97 capability missing');
assert.ok(worker.includes("SEMANTIC_QUALITY_VERSION='1.1'"),'runtime sync must require semantic quality v1.1');
assert.ok(worker.includes("minScore:1"),'worker semantic relevance floor missing');
assert.ok(worker.includes("allowPaths:modelPickedPaths"),'local semantic model allowlist exception missing');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify PUBLIC approval policy regressed');

console.log('CREATOR SEMANTIC RELEVANCE FLOOR V97 SELFTEST PASS',JSON.stringify(blocked.evidence));
