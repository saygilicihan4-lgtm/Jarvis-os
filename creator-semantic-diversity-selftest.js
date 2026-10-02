const assert=require('assert');
const semantic=require('./jarvis-creator-semantic-quality');

assert.strictEqual(semantic.SEMANTIC_QUALITY_VERSION,'1.2');

const rows=[
  {
    id:'A001',path:'creator-assets/robot-factory-a.mp4',sha256:'a',score:12,
    tags:['robot','fabrika','otomasyon','montaj hattı'],
    summary:'Endüstriyel robot kolları fabrikada otomatik montaj yapıyor.'
  },
  {
    id:'A002',path:'creator-assets/robot-factory-b.mp4',sha256:'b',score:11,
    tags:['robot','fabrika','otomasyon','montaj hattı'],
    summary:'Fabrikada robot kolları otomatik montaj hattında çalışıyor.'
  },
  {
    id:'A003',path:'creator-assets/rocket-launch.mp4',sha256:'c',score:8,
    tags:['roket','uzay','fırlatma','gökyüzü'],
    summary:'Roket fırlatma rampasından uzaya doğru yükseliyor.'
  },
  {
    id:'A004',path:'creator-assets/ai-chip.mp4',sha256:'d',score:5,
    tags:['yapay zeka','çip','sunucu','teknoloji'],
    summary:'Yapay zeka işlemcileri ve veri merkezi donanımı yakın planda.'
  },
  {
    id:'A005',path:'creator-assets/beach.mp4',sha256:'e',score:0,
    tags:['sahil','deniz','güneş'],
    summary:'Güneşli bir sahilde dalgalar kıyıya vuruyor.'
  }
];

const duplicateScore=semantic.semanticSimilarity(rows[0],rows[1]);
const differentScore=semantic.semanticSimilarity(rows[0],rows[2]);
assert.ok(duplicateScore>=0.72,'near-duplicate robot clips must exceed semantic similarity threshold');
assert.ok(differentScore<0.35,'unrelated robot/rocket clips must stay semantically distinct');

const diversified=semantic.diversifySemanticRows(rows,{
  maxItems:12,minScore:1,maxSimilarity:0.72
});
const paths=diversified.rows.map(x=>x.path);
assert.ok(paths.includes('creator-assets/robot-factory-a.mp4'),'highest-ranked robot clip must survive');
assert.ok(!paths.includes('creator-assets/robot-factory-b.mp4'),'near-duplicate robot clip must be suppressed');
assert.ok(paths.includes('creator-assets/rocket-launch.mp4'),'distinct narrative concept must survive');
assert.ok(paths.includes('creator-assets/ai-chip.mp4'),'second distinct narrative concept must survive');
assert.ok(!paths.includes('creator-assets/beach.mp4'),'zero-relevance filler must not enter semantic selection');
assert.strictEqual(diversified.evidence.rejectedSimilarCount,1);
assert.strictEqual(diversified.evidence.rejectedLowRelevanceCount,1);
assert.strictEqual(diversified.evidence.fallbackUsed,false);

const modelAllowed=semantic.diversifySemanticRows(rows,{
  maxItems:12,minScore:1,maxSimilarity:0.72,
  allowPaths:['creator-assets/beach.mp4']
});
assert.ok(modelAllowed.rows.some(x=>x.path==='creator-assets/beach.mp4'),'local semantic reranker must be able to explicitly retain a zero-lexical-score visual');
assert.strictEqual(modelAllowed.evidence.modelAllowlistCount,1);

const zeroRows=rows.slice(0,2).map((x,i)=>({...x,path:'creator-assets/zero-'+i+'.mp4',score:0}));
const fallback=semantic.diversifySemanticRows(zeroRows,{
  maxItems:12,minScore:1,maxSimilarity:0.72
});
assert.strictEqual(fallback.evidence.fallbackUsed,false,'semantic selector must not invent a low-relevance fallback');
assert.strictEqual(fallback.evidence.relevanceFloorBlockedAll,true,'all-zero catalog must record relevance-floor rejection');
assert.deepStrictEqual(fallback.rows,[],'all-zero semantic catalog must fail relevance closed');

console.log('CREATOR SEMANTIC DIVERSITY V95 SELFTEST PASS',JSON.stringify({
  duplicateScore:Number(duplicateScore.toFixed(3)),
  differentScore:Number(differentScore.toFixed(3)),
  evidence:diversified.evidence,
  selected:paths
}));
