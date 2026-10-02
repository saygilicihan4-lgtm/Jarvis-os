const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const css=fs.readFileSync('./public/style.css','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.93.0'"),'Worker 2.93.0 required');
assert.ok(worker.includes("'pc_self_repair_v1'"),'self-repair capability must be preserved');
assert.ok(worker.includes("'creator_multiscene_v2'"),'multi-scene Creator capability must be preserved');
assert.ok(worker.includes("'creator_burned_captions_v1'"),'burned-caption Creator capability must be preserved');
assert.ok(worker.includes("'cloud_mission_telemetry_v1'"),'cloud mission telemetry capability missing');
assert.ok(worker.includes('function cloudMissionTelemetry()'),'cloud mission telemetry helper missing');
assert.ok(worker.includes('missions:cloudMissionTelemetry()'),'Worker heartbeat does not include mission telemetry');

const telemetryStart=worker.indexOf('function cloudMissionTelemetry()');
const telemetryEnd=worker.indexOf('async function missionDependencyReady',telemetryStart);
assert.ok(telemetryStart>0&&telemetryEnd>telemetryStart,'mission telemetry block missing');
const telemetry=worker.slice(telemetryStart,telemetryEnd);
assert.ok(!telemetry.includes('.input'),'cloud mission telemetry must not expose mission input payload');
assert.ok(!telemetry.includes('TOKEN'),'cloud mission telemetry must not expose tokens');
assert.ok(!telemetry.includes('DEVICE_TOKEN'),'cloud mission telemetry must not expose device token');
assert.ok(telemetry.includes('queue:cleanQueue'),'sanitized mission queue missing');

assert.ok(server.includes('function sanitizeMissionTelemetry(raw)'),'server mission telemetry sanitizer missing');
assert.ok(server.includes('.slice(0,160)'), 'server still truncates capability heartbeat too aggressively');
assert.ok(!server.includes('d.capabilities.slice(0,50)'), 'legacy 50-capability truncation still present');
assert.ok(server.includes('missions:sanitizeMissionTelemetry(d.missions)'),'heartbeat mission sanitizer wiring missing');
assert.ok(server.includes('missions:pc.missions||null'),'public state mission relay missing');

assert.ok(html.includes('id="localMissionState"'),'local mission telemetry HUD missing');
assert.ok(html.includes('function localMissionCard(m)'),'durable mission card renderer missing');
assert.ok(html.includes('function renderMissionQueue()'),'combined mission queue renderer missing');
assert.ok(html.includes("localMissionRuntimeSource='cloud'"),'phone/cloud mission relay fallback missing');
assert.ok(html.includes("localMissionRuntimeSource=localMissionRuntime?'local':''"),'direct local mission source missing');
assert.ok(html.includes('pc.missions&&typeof pc.missions'),'cloud worker mission state is not consumed');
assert.ok(html.includes('const localCards=localQueue.map(localMissionCard)'),'local durable mission cards not rendered');
assert.ok(css.includes('.local-mission'),'durable mission styling missing');
assert.ok(css.includes('.status.waiting_dependency'),'waiting dependency styling missing');

console.log('MISSION CONSOLE SELFTEST PASS');
