const fs=require('fs');
const assert=require('assert');
const semantic=require('./jarvis-creator-semantic-quality');

assert.strictEqual(semantic.SEMANTIC_QUALITY_VERSION,'1.4');

const longNarrative=[
  'OPENING_ROBOT '+('alpha '.repeat(700)),
  ('beta '.repeat(350))+' MIDDLE_QUANTUM '+('beta '.repeat(350)),
  ('gamma '.repeat(700))+' ENDING_SPACE'
].join(' ');

const digest=semantic.buildNarrativeDigest(longNarrative,{maxChars:1200});
assert.strictEqual(digest.truncated,true,'long narrative must use balanced digest');
assert.strictEqual(digest.sections.length,3,'long narrative must expose three timeline sections');
assert.deepStrictEqual(digest.sections.map(x=>x.label),['BAŞLANGIÇ','ORTA','KAPANIŞ']);
assert.ok(digest.text.includes('OPENING_ROBOT'),'opening concept missing from semantic digest');
assert.ok(digest.text.includes('MIDDLE_QUANTUM'),'middle concept missing from semantic digest');
assert.ok(digest.text.includes('ENDING_SPACE'),'closing concept missing from semantic digest');
assert.ok(digest.outputChars<=1200,'semantic digest exceeded context budget');
assert.ok(digest.originalChars>digest.outputChars,'long narrative was not compacted');

const ordered=semantic.orderRowsByNarrativeSections([
  {path:'creator-assets/space.mp4',score:8,tags:['uzay','roket'],summary:'Uzay roketi yörüngede.'},
  {path:'creator-assets/robot.mp4',score:9,tags:['robot','fabrika'],summary:'Robot fabrikada üretime başlıyor.'},
  {path:'creator-assets/quantum.mp4',score:7,tags:['kuantum','çip'],summary:'Kuantum çipi laboratuvarda.'}
],[
  {label:'BAŞLANGIÇ',text:'Robot fabrikada üretime başlıyor.'},
  {label:'ORTA',text:'Kuantum çipi laboratuvarda yeni aşamaya geçiyor.'},
  {label:'KAPANIŞ',text:'Uzay roketi yörüngede görevi tamamlıyor.'}
]);
assert.deepStrictEqual(ordered.rows.map(x=>x.path),[
  'creator-assets/robot.mp4','creator-assets/quantum.mp4','creator-assets/space.mp4'
],'semantic assets must follow opening-middle-closing narrative order');
assert.strictEqual(ordered.evidence.applied,true);
assert.deepStrictEqual(ordered.evidence.sectionLoads,[1,1,1]);

const short=semantic.buildNarrativeDigest('Kısa anlatım robot ve uzay hakkında.',{maxChars:1200});
assert.strictEqual(short.truncated,false);
assert.strictEqual(short.sections.length,1);
assert.ok(short.text.includes('Kısa anlatım robot ve uzay hakkında.'));

const worker=fs.readFileSync('./worker.js','utf8');
assert.ok(worker.includes("'creator_semantic_narrative_digest_v1'"),'v98 capability missing');
assert.ok(worker.includes("'creator_scene_semantic_order_v1'"),'v99 capability missing');
assert.ok(worker.includes('orderRowsByNarrativeSections(diversity.rows,narrativeDigest.sections)'),'v99 narrative ordering integration missing');
assert.ok(worker.includes('narrativeOrderAssignments:'),'v99 narrative ordering evidence missing');
assert.ok(worker.includes('function creatorSemanticNarrativeDigest(query,maxChars=3200)'),'Worker semantic digest helper missing');
assert.ok(worker.includes("getCreatorSemanticQuality().buildNarrativeDigest(query,{maxChars:cap})"),'Worker must prefer semantic-quality digest module');
assert.ok(worker.includes("ANLATIM ÖZETİ (başlangıç / orta / kapanış):"),'local reranker balanced narrative prompt missing');
assert.ok(worker.includes("narrativeDigestSections:Array.isArray(narrativeDigest.sections)?narrativeDigest.sections.length:0"),'digest evidence missing');
assert.ok(worker.includes("narrativeDigestTruncated:!!narrativeDigest.truncated"),'digest truncation evidence missing');
assert.ok(!worker.includes("String(query||'').slice(0,3200)"),'opening-only 3200-char semantic truncation must be removed');
assert.ok(worker.includes("SEMANTIC_QUALITY_VERSION='1.4'"),'runtime sync must require semantic quality v1.3');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SEMANTIC NARRATIVE DIGEST V98 SELFTEST PASS',JSON.stringify({
  sections:digest.sections.map(x=>({label:x.label,ratio:x.ratio,chars:x.text.length})),
  originalChars:digest.originalChars,
  outputChars:digest.outputChars
}));
