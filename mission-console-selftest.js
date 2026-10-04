const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const css=fs.readFileSync('./public/style.css','utf8');
const missionEngine=fs.readFileSync('./jarvis-mission-engine.js','utf8');
const languageChat=fs.readFileSync('./public/language-chat.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
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
assert.ok(telemetry.includes('paused:Number(h.counts.paused||0)'),'paused mission count missing from cloud telemetry');
assert.ok(server.includes('paused:Math.max(0,Math.min(10000,Number(counts.paused)||0))'),'server sanitizer drops paused mission count');

assert.ok(server.includes('function sanitizeMissionTelemetry(raw)'),'server mission telemetry sanitizer missing');
assert.ok(server.includes('.slice(0,160)'), 'server still truncates capability heartbeat too aggressively');
assert.ok(!server.includes('d.capabilities.slice(0,50)'), 'legacy 50-capability truncation still present');
assert.ok(server.includes('missions:sanitizeMissionTelemetry(d.missions)'),'heartbeat mission sanitizer wiring missing');
assert.ok(server.includes('missions:pc.missions||null'),'public state mission relay missing');

// v168: the approval review stays inside the already-sanitized mission label
// channel. No raw mission input is added to Worker/cloud telemetry.
assert.ok(missionEngine.includes('function approvalReviewLabel('),'privacy-safe approval review helper missing');
assert.ok(missionEngine.includes('label:approvalLabel||m.label'),'approval review is not wired into mission summaries');
assert.ok(server.includes("label:String(m&&m.label||'')"),'cloud sanitizer does not preserve bounded mission labels');
assert.ok(html.includes('const label=String(m&&m.label||m&&m.type||\'JARVIS mission\')'),'Mission Queue does not consume the summarized label');
assert.ok(html.includes("<b>'+esc(label)+'</b>"),'Mission Queue does not escape/render the approval review label');

assert.ok(html.includes('id="localMissionState"'),'local mission telemetry HUD missing');
assert.ok(html.includes('function localMissionCard(m)'),'durable mission card renderer missing');
assert.ok(html.includes('function renderMissionQueue()'),'combined mission queue renderer missing');
assert.ok(html.includes("localMissionRuntimeSource='cloud'"),'phone/cloud mission relay fallback missing');
assert.ok(html.includes("localMissionRuntimeSource=localMissionRuntime?'local':''"),'direct local mission source missing');
assert.ok(html.includes('pc.missions&&typeof pc.missions'),'cloud worker mission state is not consumed');
assert.ok(html.includes('const localCards=localQueue.map(localMissionCard)'),'local durable mission cards not rendered');
assert.ok(css.includes('.local-mission'),'durable mission styling missing');
assert.ok(css.includes('.status.waiting_dependency'),'waiting dependency styling missing');
assert.ok(css.includes('.status.paused'),'paused durable mission styling missing');
assert.ok(html.includes("paused=Number(c.paused||0)"),'paused count is not shown in Mission Console state');

// v170: mobile approval controls are only a user-intent bridge. They must
// re-read sanitized mission state, bind to the visible 80-bit REQ marker, and
// hand the action to the existing Worker/mobile-brain approval machinery.
assert.doesNotThrow(()=>new Function(languageChat),'mobile mission control UI has invalid JavaScript syntax');
assert.ok(languageChat.includes("const REQ_RE=/\\bREQ\\s+([a-f0-9]{20})\\b/i"),'mobile approval UI must require the v169 80-bit REQ marker');
assert.ok(languageChat.includes("String(mission&&mission.status||'')==='waiting_dependency'"),'mobile approval UI must require waiting_dependency');
assert.ok(languageChat.includes("String(step.status||'')==='blocked'"),'mobile approval UI must require a blocked step');
assert.ok(languageChat.includes("String(err.dependency||step.dependency||'')==='approval'"),'mobile approval UI must require approval dependency');
assert.ok(languageChat.includes("const state=await jsonFetch('/api/state')"),'mobile approval UI must re-read current server state before acting');
assert.ok(languageChat.includes('if(rows.length!==1)throw new Error'),'mobile approval UI must fail closed unless exactly one fresh mission matches the REQ marker');
assert.ok(languageChat.includes("?('onayla '+mission.id+' req '+req)"),'mobile approval command must carry exact mission id + current REQ');
assert.ok(languageChat.includes("('iptal et '+mission.id+' req '+req)"),'mobile cancel command must carry exact mission id + reviewed REQ');
assert.ok(languageChat.includes("jsonFetch('/api/mobile-brain'"),'mobile approval must go through the existing Worker/mobile-brain path');
assert.ok(!languageChat.includes("'/api/tasks/'+")&&!languageChat.includes('/approve'), 'durable mission approval UI must not reuse legacy cloud-task approve endpoint');
assert.ok(languageChat.includes("textContent='ONAYLA'"),'mobile approval button missing');
assert.ok(languageChat.includes("textContent='İPTAL'"),'mobile cancel button missing');

console.log('MISSION CONSOLE SELFTEST PASS');
