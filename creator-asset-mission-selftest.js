const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const creatorSource=fs.readFileSync('./jarvis-creator-engine.js','utf8');
const fileEngine=fs.readFileSync('./jarvis-workspace-file-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.0'"),'Worker 2.99.0 required');
assert.strictEqual(creator.ENGINE_VERSION,'1.1');
assert.ok(worker.includes("'creator_asset_mission_v1'"),'creator asset mission capability missing');
assert.ok(worker.includes("'creator_asset_probe_v1'"),'creator asset probe capability missing');
assert.ok(worker.includes("'creator_asset_hash_dedupe_v1'"),'creator asset dedupe capability missing');
assert.ok(worker.includes("name:'creator_asset_mission'"),'creator asset native tool missing');
assert.ok(worker.includes("else if(n==='creator_asset_mission')"),'creator asset handler missing');
assert.ok(worker.includes('function prepareCreatorAssetOperations(args={})'),'creator asset operation planner missing');
assert.ok(worker.includes('function createCreatorAssetMission(args={})'),'creator asset mission factory missing');
assert.ok(worker.includes("type:'creator_asset'"),'creator asset mission type missing');
assert.ok(worker.includes("if(/^creator_asset_\\d+$/.test(step.name))"),'creator asset durable step missing');
assert.ok(worker.includes("getCreatorEngine().inspectAsset(WORKSPACE,op.source)"),'ffprobe validation must run before ingest');
assert.ok(worker.includes("getWorkspaceFileEngine().applyOperation(WORKSPACE,op)"),'creator asset copy must use workspace hash/no-overwrite engine');
assert.ok(worker.includes("getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op)"),'creator asset restart recovery missing');
assert.ok(worker.includes("dependency:'creator_probe'"),'ffprobe-specific dependency missing');
assert.ok(worker.includes("if(dep==='creator_probe')"),'ffprobe readiness probe missing');
assert.ok(worker.includes("creatorAssetMissionReady:CAPS.includes('creator_asset_mission_v1')"),'creator asset acceptance readiness missing');
assert.ok(worker.includes('Kaynağı silme; asset FFprobe doğrulaması + SHA-256 kopya doğrulaması geçmeden Creator asset kabul etme.'),'agent source-preservation guidance missing');

assert.ok(creatorSource.includes('function inspectAsset(workspace,relativePath)'),'creator asset inspector missing');
assert.ok(creatorSource.includes('CREATOR_ASSET_SYMLINK_BLOCKED'),'creator asset symlink guard missing');
assert.ok(creatorSource.includes('CREATOR_ASSET_SYMLINK_ESCAPE'),'creator asset symlink escape guard missing');
assert.ok(creatorSource.includes('CREATOR_ASSET_DURATION_LIMIT'),'creator duration limit missing');
assert.ok(creatorSource.includes("return 'asset-'+hash+ext"),'creator content-hash destination naming missing');
assert.ok(fileEngine.includes('COPYFILE_EXCL'),'creator ingest must inherit atomic no-overwrite copy');

const hashA='0123456789abcdef'.padEnd(64,'0');
const hashB='fedcba9876543210'.padEnd(64,'0');
assert.strictEqual(
  creator.assetDestinationName('incoming/first-name.mp4',hashA),
  creator.assetDestinationName('other/renamed.mp4',hashA),
  'same content hash must dedupe independent of source filename'
);
assert.notStrictEqual(
  creator.assetDestinationName('incoming/first-name.mp4',hashA),
  creator.assetDestinationName('incoming/first-name.mp4',hashB),
  'different hashes must not collide'
);
assert.throws(()=>creator.assetDestinationName('x.txt',hashA),/UNSUPPORTED_EXTENSION/);

console.log('CREATOR ASSET MISSION SELFTEST PASS');
