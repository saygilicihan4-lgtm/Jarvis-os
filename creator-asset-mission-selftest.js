const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const creator=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.0'"),'Worker 2.99.0 required');
assert.ok(worker.includes("'creator_asset_mission_v1'"),'Creator asset mission capability missing');
assert.ok(worker.includes("'creator_asset_probe_v1'"),'Creator asset probe capability missing');
assert.ok(worker.includes("'creator_asset_hash_dedupe_v1'"),'Creator asset hash dedupe capability missing');
assert.ok(worker.includes("name:'creator_asset_mission'"),'native Creator asset mission tool missing');
assert.ok(worker.includes("else if(n==='creator_asset_mission')"),'Creator asset mission handler missing');
assert.ok(worker.includes('function prepareCreatorAssetOperations(args={})'),'Creator asset operation prep missing');
assert.ok(worker.includes('function createCreatorAssetMission(args={})'),'Creator asset mission factory missing');
assert.ok(worker.includes("type:'creator_asset'"),'creator_asset mission type missing');
assert.ok(worker.includes("name:'creator_asset_'"),'Creator asset mission step naming missing');
assert.ok(worker.includes("expectedSha256.slice(0,12)+'-'"),'hash-prefixed Creator asset target missing');
assert.ok(worker.includes("reused:!!state.destinationExists"),'Creator asset hash reuse marker missing');
assert.ok(worker.includes("getCreatorEngine().inspectAsset(WORKSPACE,op.source)"),'FFprobe asset validation missing from mission execution');
assert.ok(worker.includes("dependency:'ffmpeg'"),'Creator asset FFprobe dependency missing');
assert.ok(worker.includes("getWorkspaceFileEngine().applyOperation(WORKSPACE,op)"),'hash-guarded asset copy missing');
assert.ok(worker.includes("getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op)"),'Creator asset restart recovery missing');
assert.ok(worker.includes("CREATOR_ASSET_REUSE_CONFLICT"),'runtime reuse hash revalidation missing');
assert.ok(worker.includes("creatorAssetMissionReady:CAPS.includes('creator_asset_mission_v1')"),'Creator asset acceptance readiness missing');
assert.ok(worker.includes("jarvis-creator-engine.js',\"ENGINE_VERSION='1.1'"),'Creator engine 1.1 runtime signature missing');

const prepStart=worker.indexOf('function prepareCreatorAssetOperations(args={})');
const prepEnd=worker.indexOf('function createCreatorShortMission(args={})',prepStart);
assert.ok(prepStart>0&&prepEnd>prepStart,'Creator asset helper block missing');
const prep=worker.slice(prepStart,prepEnd);
assert.ok(!prep.includes('unlinkSync'),'Creator asset ingest must never delete source files');
assert.ok(!prep.includes("operation:'move'"),'Creator asset ingest must remain copy-only');

const runStart=worker.indexOf("if(/^creator_asset_\\d+$/.test(step.name)){",worker.indexOf('async function runDurableMission(id)'));
const runEnd=worker.indexOf("if(/^workspace_file_\\d+$/.test(step.name)){",runStart);
assert.ok(runStart>0&&runEnd>runStart,'Creator asset runtime block missing');
const run=worker.slice(runStart,runEnd);
assert.ok(!run.includes('unlinkSync'),'Creator asset runtime must never delete source files');
assert.ok(run.indexOf('inspectAsset')<run.indexOf('applyOperation'),'video probe must happen before copy');

assert.ok(creator.includes("const ENGINE_VERSION='1.1'"),'Creator engine 1.1 required');
assert.ok(creator.includes('function inspectAsset(workspace,relativePath)'),'Creator asset inspector missing');
assert.ok(creator.includes("'FFPROBE_MISSING'"),'FFprobe missing guard absent');
assert.ok(creator.includes("'CREATOR_ASSET_INVALID_VIDEO'"),'invalid video guard absent');
assert.ok(creator.includes("'CREATOR_ASSET_SYMLINK_ESCAPE'"),'Creator asset symlink escape guard absent');
assert.ok(creator.includes('duration>600'),'Creator asset duration limit absent');

console.log('CREATOR ASSET MISSION SELFTEST PASS');
