const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');

for(const cap of [
  'creator_asset_semantic_catalog_v1',
  'creator_visual_relevance_v1',
  'creator_local_vision_broll_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' missing');
}

assert.ok(worker.includes("const CREATOR_ASSET_CATALOG_FILE=path.join(MEMORY_DIR,'creator-asset-catalog.json')"),'semantic catalog path missing');
assert.ok(worker.includes('function readCreatorAssetCatalog()'),'catalog reader missing');
assert.ok(worker.includes('function writeCreatorAssetCatalog(catalog)'),'catalog writer missing');
assert.ok(worker.includes('async function creatorAssetPreviewBase64(relativePath)'),'local video preview extractor missing');
assert.ok(worker.includes("'-frames:v','1'"),'FFmpeg single-frame preview missing');
assert.ok(worker.includes("'scale=768:-2:force_original_aspect_ratio=decrease'"),'bounded preview resize missing');
assert.ok(worker.includes('async function classifyCreatorAssetSemantic(relativePath)'),'semantic classifier missing');
assert.ok(worker.includes("if(!/^creator-assets\\//i.test(rel))throw new Error('CREATOR_SEMANTIC_ASSET_SCOPE')"),'catalog scope guard missing');
assert.ok(worker.includes("const sha256=getWorkspaceFileEngine().hashFile(full)"),'catalog hash binding missing');
assert.ok(worker.includes("images:[preview.image]"),'local multimodal classification input missing');
assert.ok(worker.includes("model:status.model"),'classification must use local installed vision model');
assert.ok(worker.includes("remember({kind:'creator_asset_semantic_index'"),'semantic indexing evidence missing');
assert.ok(worker.includes("localOnly:true"),'local-only indexing evidence missing');

assert.ok(worker.includes('async function serviceCreatorAssetSemanticCatalog({maxItems=1}={})'),'bounded background catalog service missing');
assert.ok(worker.includes("const limit=Math.max(1,Math.min(4,Number(maxItems)||1))"),'catalog indexing must be bounded');
assert.ok(worker.includes("setInterval(()=>serviceCreatorAssetSemanticCatalog({maxItems:1}).catch(()=>{}),180000)"),'low-frequency catalog service missing');

assert.ok(worker.includes('async function selectCreatorRelevantAssetBaselines(query,maxItems=12)'),'semantic asset selector missing');
assert.ok(worker.includes('creatorCatalogLexicalScore(entry,queryTokens)'),'deterministic relevance fallback missing');
assert.ok(worker.includes("if(!sha256||sha256!==String(entry&&entry.sha256||''))continue"),'stale catalog hash entries must be rejected');
assert.ok(worker.includes("Sen JARVIS Creator B-roll seçicisisin."),'local semantic reranker prompt missing');
assert.ok(worker.includes("Yalnız verilen kimlikleri kullan"),'semantic reranker id allowlist missing');
assert.ok(worker.includes('function mergeCreatorAssetBaselines(primary,fallback,maxItems=12)'),'safe deterministic fallback merge missing');

const dailyStart=worker.indexOf('async function serviceCreatorDailyPlan');
const dailyEnd=worker.indexOf('function normalizePcMissionActions',dailyStart);
assert.ok(dailyStart>0&&dailyEnd>dailyStart,'daily plan block missing');
const daily=worker.slice(dailyStart,dailyEnd);
assert.ok(daily.includes("await serviceCreatorAssetSemanticCatalog({maxItems:2})"),'daily plan must opportunistically seed semantic catalog');
assert.ok(daily.includes("await selectCreatorRelevantAssetBaselines(brief.title+' '+brief.script,12)"),'daily plan must select semantically relevant assets');
assert.ok(daily.includes("await selectCreatorRelevantAssetBaselines(brief.title+' '+brief.script,12)"),'daily plan must select semantically relevant assets');
assert.ok(daily.includes("getCreatorWebMedia().searchAndIngest(WORKSPACE"),'daily plan must opportunistically use licensed web B-roll');
assert.ok(daily.includes("orientation:'landscape'"),'daily web B-roll must request landscape assets');
assert.ok(daily.includes('mergeCreatorAssetBaselines(web,mergeCreatorAssetBaselines(semantic,creatorDailyAutoAssetBaselines(dateKey,12),12),12)'),'daily plan must merge web, semantic and deterministic fallback assets');
assert.ok(daily.includes('publish:false'),'daily visual relevance flow must remain DRAFT-only');
assert.ok(!daily.includes('publish:true'),'daily visual relevance must never request PUBLIC');
assert.ok(!daily.includes('youtube_publish'),'daily relevance block must never create PUBLIC step');

assert.ok(worker.includes("creatorVisualRelevanceReady:CAPS.includes('creator_asset_semantic_catalog_v1')"),'PC acceptance readiness missing');
assert.ok(worker.includes("'creator_longform_edit_rhythm_v1'"),'Longform Edit v70 capability must remain');
assert.ok(worker.includes("'creator_longform_duration_fit_v1'"),'Duration Fit v69 capability must remain');
assert.ok(worker.includes("'creator_daily_longform_v1'"),'Daily Longform v68 capability must remain');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'Creator Batch v66 capability must remain');
assert.ok(worker.includes("'creator_storyboard_v1'"),'Storyboard v65 capability must remain');
assert.ok(worker.includes("'creator_web_media_v1'"),'Creator Web Media v71 capability must remain');
assert.ok(worker.includes("'creator_youtube_attribution_v1'"),'YouTube source attribution capability missing');
assert.ok(engine.includes('function buildLongformStoryboard('),'Longform Edit v70 engine must remain');
assert.ok(engine.includes('function probeRenderedLongform('),'longform quality gate must remain');
assert.ok(engine.includes('function probeRenderedShort('),'Shorts quality gate must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR VISUAL RELEVANCE V71 SELFTEST PASS');
