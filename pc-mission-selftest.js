const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.97.0'"),'Worker 2.97.0 required');
assert.ok(worker.includes("'pc_safe_mission_v1'"),'durable safe PC mission capability missing');
assert.ok(worker.includes("'pc_safe_action_catalog_v1'"),'safe PC action catalog capability missing');
assert.ok(worker.includes("'pc_mission_resume_v1'"),'PC mission resume capability missing');
assert.ok(worker.includes("name:'pc_safe_mission'"),'native PC mission tool missing');
assert.ok(worker.includes("else if(n==='pc_safe_mission')"),'PC mission handler missing');
assert.ok(worker.includes('function normalizePcMissionActions(args={})'),'PC action normalizer missing');
assert.ok(worker.includes('function pcMissionCommand(action)'),'PC action-to-command mapper missing');
assert.ok(worker.includes('function createPcSafeMission(args={})'),'PC mission factory missing');
assert.ok(worker.includes("type:'pc_safe'"),'pc_safe mission type missing');
assert.ok(worker.includes("name:'pc_action_'"),'PC mission step naming missing');
assert.ok(worker.includes("/^pc_action_\\d+$/.test(step.name)"),'PC mission runtime execution missing');
assert.ok(worker.includes("if(action&&action.kind==='status')"),'read-only PC retry classification missing');
assert.ok(worker.includes("Read-only PC status action is safe to retry"),'read-only retry note missing');
assert.ok(worker.includes("if(!command||!isLocalSafeControlCommand(command))"),'PC mission must revalidate the safe command catalog');
assert.ok(worker.includes("code:'PC_ACTION_NOT_SAFE'"),'unsafe PC action guard missing');
assert.ok(worker.includes("'pc_runtime'"),'PC runtime dependency token missing');
assert.ok(worker.includes("if(dep==='pc_runtime')"),'PC runtime dependency readiness handler missing');
assert.ok(worker.includes("pcMissionReady:CAPS.includes('pc_safe_mission_v1')"),'PC acceptance readiness missing');

const start=worker.indexOf('function normalizePcMissionActions(args={})');
const end=worker.indexOf('function pcMissionCommand(action)',start);
assert.ok(start>0&&end>start,'PC mission normalizer block missing');
const block=worker.slice(start,end);
assert.ok(block.includes("new Set(['system','disk','network','power'])"),'PC status allowlist missing');
assert.ok(block.includes("new Set(['volume_up','volume_down','mute','play_pause','next','previous','stop'])"),'PC media allowlist missing');
assert.ok(block.includes("'youtube','google','github','chatgpt'"),'PC open-target allowlist missing');
assert.ok(!block.includes("'powershell'"),'PowerShell must not be in durable PC allowlist');
assert.ok(!block.includes("'terminal'"),'Terminal must not be in durable PC allowlist');
assert.ok(!block.includes('cmd.exe'),'arbitrary shell must not be in durable PC mission normalizer');

assert.ok(worker.includes('shell/PowerShell, keyfi exe/path, silme, ödeme, public publish veya hesap değişikliği ekleme'),'agent PC mission safety guidance missing');
assert.ok(worker.includes("['jarvis-youtube-studio.js',\"YOUTUBE_STUDIO_VERSION='1.1'\"]"),'fresh/runtime bootstrap must sync YouTube Studio 1.1');

console.log('PC SAFE MISSION SELFTEST PASS');
