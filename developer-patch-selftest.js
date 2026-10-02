const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.96.0'"),'Worker 2.96.0 required');
assert.ok(worker.includes("'developer_patch_mission_v1'"),'developer patch capability missing');
assert.ok(worker.includes("'developer_patch_rollback_v1'"),'developer rollback capability missing');
assert.ok(worker.includes("name:'developer_patch_mission'"),'developer patch native tool missing');
assert.ok(worker.includes("else if(n==='developer_patch_mission')"),'developer patch handler missing');
assert.ok(worker.includes('function createDeveloperPatchMission(args={})'),'developer patch mission factory missing');
assert.ok(worker.includes("type:'developer_patch'"),'developer_patch mission type missing');
assert.ok(worker.includes("expectedSha256:fileHash(loc.target)"),'patch baseline hash lock missing');
assert.ok(worker.includes("const steps=[{name:'dev_patch_prepare'}]"),'patch prepare step missing');
assert.ok(worker.includes("dev_patch_file_"),'patch file steps missing');
assert.ok(worker.includes("steps.push({name:'dev_patch_verify'})"),'patch final verification step missing');
assert.ok(worker.includes('function developerPatchBackupLocation('),'patch backup location helper missing');
assert.ok(worker.includes('function rollbackDeveloperPatchMission('),'patch rollback helper missing');
assert.ok(worker.includes("reason:'external_conflict'"),'rollback external-edit guard missing');
assert.ok(worker.includes("validator:'node-check'"),'safe JS syntax verification missing');
assert.ok(worker.includes("validator:'json-parse'"),'safe JSON verification missing');
assert.ok(worker.includes("if(step.name==='dev_patch_prepare'||step.name==='dev_patch_verify')"),'patch retry verification missing');
assert.ok(worker.includes("/^dev_patch_file_\\d+$/.test(step.name)"),'patch interruption recovery missing');
assert.ok(worker.includes("current===desired"),'patch desired-hash recovery missing');
assert.ok(worker.includes("current===baseline"),'patch baseline retry guard missing');
assert.ok(worker.includes("DEV_PATCH_BACKUP_VERIFY_FAILED"),'backup verification failure guard missing');
assert.ok(worker.includes("DEV_PATCH_WRITE_VERIFY_FAILED"),'write verification failure guard missing');
assert.ok(worker.includes("DEV_PATCH_VERIFY_FAILED"),'final verification rollback guard missing');
assert.ok(worker.includes("mission&&mission.type==='developer_patch'"),'unexpected patch errors must trigger rollback');
assert.ok(worker.includes('Patch yalnızca mevcut dosyalara uygulanır'),'patch must not silently create project files');
assert.ok(worker.includes('hassas yolları patch etme'),'agent sensitive-path patch guidance missing');
assert.ok(worker.includes('deploy yapma'),'developer patch must remain deploy-free');

assert.ok(html.includes("pcCaps.includes('developer_patch_mission_v1')"),'Developer HUD does not require patch capability');
assert.ok(html.includes("pcCaps.includes('developer_patch_rollback_v1')"),'Developer HUD does not require rollback capability');
assert.ok(html.includes('Durable app builder · SHA-guarded patch · verified rollback'),'Developer HUD patch summary missing');

console.log('DEVELOPER PATCH SELFTEST PASS');
