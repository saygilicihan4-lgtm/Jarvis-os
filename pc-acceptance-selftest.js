const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
assert.ok(worker.includes("const WORKER_VERSION='2.99.0'"),'Worker 2.99.0 required');
assert.ok(worker.includes("name:'pc_acceptance_snapshot'"),'native acceptance tool missing');
assert.ok(worker.includes("req.url==='/acceptance-snapshot'"),'acceptance endpoint missing');
assert.ok(worker.includes("'pc_acceptance_snapshot_v1'"),'acceptance capability missing');
assert.ok(worker.includes("'silent_startup_diagnostics_v1'"),'silent startup diagnostics capability missing');
assert.ok(worker.includes("'pc_acceptance_hardened_v1'"),'hardened acceptance capability missing');
assert.ok(worker.includes("'pc_self_repair_v1'"),'PC self-repair capability missing');

const start=worker.indexOf('async function buildPcAcceptanceSnapshot()');
const end=worker.indexOf('function acceptanceSummaryText',start);
assert.ok(start>0&&end>start,'acceptance snapshot function missing');
const block=worker.slice(start,end);
assert.ok(block.includes('startupAcceptanceSnapshot()'),'startup diagnostics missing');
assert.ok(block.includes('ffmpegStatus(WORKSPACE)'),'creator readiness missing');
assert.ok(block.includes('getBrowserOperator().status(WORKSPACE)'),'browser readiness missing');
assert.ok(block.includes('getCommerceEngine().status(WORKSPACE)'),'commerce readiness missing');
assert.ok(block.includes('getYoutubeStudio().status'),'YouTube readiness missing');
assert.ok(block.includes('missionHealthSnapshot()'),'mission readiness missing');
assert.ok(block.includes("pcMissionReady:CAPS.includes('pc_safe_mission_v1')"),'safe PC mission readiness missing');
assert.ok(!block.includes('publishProduct('),'acceptance snapshot must not publish');
assert.ok(!block.includes('createDraft('),'acceptance snapshot must not create Shopify data');
assert.ok(!block.includes('prepareDraft('),'acceptance snapshot must not upload YouTube data');
assert.ok(!block.includes('TOKEN'),'acceptance snapshot must not expose cloud token');
assert.ok(!block.includes('DEVICE_TOKEN'),'acceptance snapshot must not expose device token');
assert.ok(!block.includes('deviceId'),'acceptance snapshot must not expose stable device id');
assert.ok(worker.includes("(taskRegistered&&hiddenTaskAction)||fallbackRegistered"),'scheduled task must prove hidden launcher action');

assert.ok(worker.includes("workspaceFileMissionReady:CAPS.includes('workspace_file_mission_v1')"),'workspace file mission readiness missing from acceptance');
assert.ok(worker.includes("missionControlReady:CAPS.includes('mission_control_v1')"),'mission control readiness missing from acceptance');
assert.ok(worker.includes("creatorAssetMissionReady:CAPS.includes('creator_asset_mission_v1')"),'creator asset mission readiness missing from acceptance');
console.log('PC ACCEPTANCE SNAPSHOT SELFTEST PASS');
