const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const creator=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.1'"),'Worker 2.99.1 required');
assert.ok(worker.includes("'creator_storyboard_v1'"),'Creator storyboard capability missing');
assert.ok(worker.includes("'creator_explicit_assets_v1'"),'explicit Creator asset capability missing');
assert.ok(worker.includes("'creator_render_mission_bind_v1'"),'mission-bound Creator render capability missing');
assert.ok(worker.includes("creatorAssets:{type:'array',maxItems:5"),'Creator mission ordered asset schema missing');
assert.ok(worker.includes('function normalizeCreatorStoryboardAssets(raw)'),'Creator storyboard normalizer missing');
assert.ok(worker.includes("if(!/^creator-assets\\//.test(rel))"),'Creator storyboard scope guard missing');
assert.ok(worker.includes("return{path:rel,sha256}"),'Creator storyboard hash baseline missing');

assert.ok(worker.includes("code:'CREATOR_STORYBOARD_HASH_CONFLICT'"),'runtime storyboard hash conflict guard missing');
assert.ok(worker.includes("getCreatorEngine().inspectAsset(WORKSPACE,rel)"),'selected asset FFprobe validation missing');
assert.ok(worker.includes("dependency:'creator_probe'"),'selected asset FFprobe dependency missing');
assert.ok(worker.includes("assetFiles:selected.map(x=>x.path)"),'ordered asset list must reach Creator renderer');
assert.ok(worker.includes("assetHashes:selected.map(x=>x.sha256)"),'selected asset hashes must reach Creator metadata');
assert.ok(worker.includes("missionId:id"),'durable render must bind mission id');
assert.ok(worker.includes("assetSelection:selected.length?'explicit':'automatic'"),'render artifact must expose selection mode');

const recoveryStart=worker.indexOf("if(step.name==='render_short')");
const recoveryEnd=worker.indexOf("if(step.name==='shopify_draft')",recoveryStart);
assert.ok(recoveryStart>0&&recoveryEnd>recoveryStart,'render recovery block missing');
const recovery=worker.slice(recoveryStart,recoveryEnd);
assert.ok(recovery.includes("String(meta&&meta.missionId||'')===String(mission.id)"),'uncertain render must verify mission-bound metadata');
assert.ok(!recovery.includes("artifact:{output:expected,recovered:true}"),'output existence alone must not resolve uncertain render');

assert.ok(worker.includes("creatorStoryboardReady:CAPS.includes('creator_storyboard_v1')"),'Creator storyboard acceptance readiness missing');
assert.ok(worker.includes("jarvis-creator-engine.js',\"ENGINE_VERSION='1.2'"),'Creator Engine 1.2 runtime signature missing');

assert.ok(creator.includes("const ENGINE_VERSION='1.2'"),'Creator Engine 1.2 required');
assert.ok(creator.includes('function resolveAssetSelection(workspace,assetFiles,maxScenes=5)'),'explicit asset resolver missing');
assert.ok(creator.includes("parts.length!==2||parts[0]!=='creator-assets'"),'explicit asset scope guard missing');
assert.ok(creator.includes("const assets=explicitAssets?resolveAssetSelection(workspace,assetFiles,5):selectAssets(workspace,base,5)"),'explicit ordered selection must override automatic selection');
assert.ok(creator.includes("assetSelection:explicitAssets?'explicit':'automatic'"),'Creator job metadata selection mode missing');
assert.ok(creator.includes("missionId:String(missionId||'')"),'Creator job metadata mission binding missing');

assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify publish gate must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube publish gate must remain');

console.log('CREATOR STORYBOARD SELFTEST PASS');
