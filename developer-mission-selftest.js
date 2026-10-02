const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.98.0'"),'Worker 2.98.0 required');
assert.ok(worker.includes("'developer_project_mission_v1'"),'developer project mission capability missing');
assert.ok(worker.includes('function createDeveloperProjectMission(args={})'),'developer mission factory missing');
assert.ok(worker.includes("type:'developer_project'"),'developer_project mission type missing');
assert.ok(worker.includes("name:'developer_project_mission'"),'native developer mission tool missing');
assert.ok(worker.includes("else if(n==='developer_project_mission')"),'developer mission handler missing');
assert.ok(worker.includes("steps.push({name:'dev_verify'})"),'developer verification step missing');
assert.ok(worker.includes("PROJECT_FILE_CONFLICT"),'existing-file conflict guard missing');
assert.ok(worker.includes("otomatik üzerine yazma durduruldu"),'no-overwrite guard message missing');
assert.ok(worker.includes("isSensitiveWorkspacePath(projectName+'/'+rel)"),'sensitive path guard missing');
assert.ok(worker.includes("if(total>240000)"),'developer mission total-size guard missing');
assert.ok(worker.includes("if(bytes>60000)"),'developer file-size guard missing');
assert.ok(worker.includes("fileHash(loc.target)!==expected"),'final file hash verification missing');
assert.ok(worker.includes("developer_project_mission kullan"),'native agent developer guidance missing');
assert.ok(worker.includes("deploy etmez"),'developer deploy guard missing');

assert.ok(html.includes('id="devAgentDetail"'),'Developer readiness detail missing');
assert.ok(html.includes("pcCaps.includes('developer_project_mission_v1')"),'HUD does not verify developer mission capability');
assert.ok(html.includes('Durable app builder · SHA-guarded patch · verified rollback'),'Developer readiness summary missing');

console.log('DEVELOPER MISSION SELFTEST PASS');
