const fs=require('fs');
const assert=require('assert');
const semantic=require('./jarvis-creator-semantic-quality');

assert.strictEqual(semantic.SEMANTIC_QUALITY_VERSION,'1.2');

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

const short=semantic.buildNarrativeDigest('Kısa anlatım robot ve uzay hakkında.',{maxChars:1200});
assert.strictEqual(short.truncated,false);
assert.strictEqual(short.sections.length,1);
assert.ok(short.text.includes('Kısa anlatım robot ve uzay hakkında.'));

const worker=fs.readFileSync('./worker.js','utf8');
assert.ok(worker.includes("'creator_semantic_narrative_digest_v1'"),'v98 capability missing');
assert.ok(worker.includes('function creatorSemanticNarrativeDigest(query,maxChars=3200)'),'Worker semantic digest helper missing');
assert.ok(worker.includes("getCreatorSemanticQuality().buildNarrativeDigest(query,{maxChars:cap})"),'Worker must prefer semantic-quality digest module');
assert.ok(worker.includes("ANLATIM ÖZETİ (başlangıç / orta / kapanış):"),'local reranker balanced narrative prompt missing');
assert.ok(worker.includes("narrativeDigestSections:Array.isArray(narrativeDigest.sections)?narrativeDigest.sections.length:0"),'digest evidence missing');
assert.ok(worker.includes("narrativeDigestTruncated:!!narrativeDigest.truncated"),'digest truncation evidence missing');
assert.ok(!worker.includes("String(query||'').slice(0,3200)"),'opening-only 3200-char semantic truncation must be removed');
assert.ok(worker.includes("SEMANTIC_QUALITY_VERSION='1.2'"),'runtime sync must require semantic quality v1.2');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SEMANTIC NARRATIVE DIGEST V98 SELFTEST PASS',JSON.stringify({
  sections:digest.sections.map(x=>({label:x.label,ratio:x.ratio,chars:x.text.length})),
  originalChars:digest.originalChars,
  outputChars:digest.outputChars
}));
