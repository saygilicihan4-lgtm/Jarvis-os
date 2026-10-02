const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const css=fs.readFileSync('./public/style.css','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.1'"),'Worker 2.99.1 required');
assert.ok(worker.includes("'mission_control_v1'"),'mission control capability missing');
assert.ok(worker.includes("'mission_pause_v1'"),'mission pause capability missing');
assert.ok(worker.includes("'mission_cancel_v1'"),'mission cancel capability missing');
assert.ok(worker.includes("name:'mission_control'"),'native mission control tool missing');
assert.ok(worker.includes("else if(n==='mission_control')"),'mission control handler missing');
assert.ok(worker.includes('function missionControlCandidates(action)'),'mission control candidate helper missing');
assert.ok(worker.includes('function applyPendingMissionControl(mission)'),'mission control boundary helper missing');
assert.ok(worker.includes('function requestMissionControl({missionId=\'\',action=\'\'}={})'),'mission control request helper missing');

assert.ok(worker.includes("if(candidates.length>1)throw new Error('Birden fazla uygun görev var; missionId"),'ambiguous mission control must require missionId');
assert.ok(worker.includes("mission.status='paused'"),'pause status transition missing');
assert.ok(worker.includes("mission.status='cancelled'"),'cancel status transition missing');
assert.ok(worker.includes("mission.status=resumeStatus"),'resume status restoration missing');
assert.ok(worker.includes("['waiting_dependency','needs_verification'].includes(currentStatus)"),'pause must preserve gated/verification state');
assert.ok(worker.includes("['waiting_dependency','needs_verification'].includes(String(mission.control&&mission.control.resumeStatus||''))"),'resume must restore gated/verification state');
assert.ok(worker.includes("if(status!=='running')return applyPendingMissionControl(mission)"),'running control must wait for safe boundary');
assert.ok(worker.includes("mission=applyPendingMissionControl(mission)"),'durable mission loop boundary control missing');
assert.ok(worker.includes("['completed','failed','cancelled','paused'].includes(String(mission.status||''))"),'paused/cancelled terminal boundary missing');

const controlStart=worker.indexOf('function missionControlCandidates(action)');
const controlEnd=worker.indexOf('function approveMissionGate',controlStart);
assert.ok(controlStart>0&&controlEnd>controlStart,'mission control helper block missing');
const control=worker.slice(controlStart,controlEnd);
assert.ok(!/killChildTree|taskkill|Stop-Process|process\.kill/.test(control),'mission control must not force-kill in-flight work');
assert.ok(control.includes("status==='paused'"),'paused mission selection missing');

assert.ok(worker.includes("paused=rows.filter(x=>String(x.status||'')==='paused')"),'paused mission telemetry missing');
assert.ok(worker.includes("paused:Number(h.counts.paused||0)"),'paused cloud count missing');
assert.ok(worker.includes("missionControlReady:CAPS.includes('mission_control_v1')"),'mission control acceptance readiness missing');
assert.ok(server.includes("paused:Math.max(0,Math.min(10000,Number(counts.paused)||0))"),'server must preserve paused mission count');
assert.ok(css.includes('.status.paused{color:var(--warn)}'),'paused Mission Console styling missing');
assert.ok(html.includes('const status=String(m&&m.status||\'queued\')'),'Mission Console must render durable mission status generically');

assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval boundary must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube approval boundary must remain');

console.log('MISSION CONTROL SELFTEST PASS');
