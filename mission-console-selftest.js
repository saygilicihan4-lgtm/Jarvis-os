const fs=require('fs');
const assert=require('assert');
const {execFileSync}=require('child_process');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const css=fs.readFileSync('./public/style.css','utf8');
const missionEngine=fs.readFileSync('./jarvis-mission-engine.js','utf8');
const languageChat=fs.readFileSync('./public/language-chat.js','utf8');
const missionActions=fs.readFileSync('./public/mission-actions.js','utf8');
const serviceWorker=fs.readFileSync('./public/sw.js','utf8');

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

// v171/v172: mobile Mission Control is isolated and success requires a two-part
// proof: authoritative Worker receipt plus a fresh durable-state transition.
assert.doesNotThrow(()=>new Function(languageChat),'language chat bootstrap has invalid JavaScript syntax');
assert.doesNotThrow(()=>new Function(missionActions),'mobile mission action module has invalid JavaScript syntax');
assert.ok(languageChat.includes("script.src='/mission-actions.js'"),'mobile mission action module is not loaded');
assert.ok(languageChat.includes('JarvisMissionActions.install(root)'),'mobile mission action module is not installed');
assert.ok(!languageChat.includes('const REQ_RE='),'approval authority must not live inside language-chat.js');
assert.ok(missionActions.includes("const REQ_RE=/\\bREQ\\s+([a-f0-9]{20})\\b/i"),'mobile approval module must require the v169 80-bit REQ marker');
assert.ok(missionActions.includes("jsonFetch('/api/state'"),'mobile approval module must re-read current server state');
assert.ok(missionActions.includes("jsonFetch('/api/mobile-brain'"),'mobile approval module must use the Worker/mobile-brain path');
assert.ok(missionActions.includes("return'onayla '+id+' req '+req"),'approve command must bind mission id + current REQ');
assert.ok(missionActions.includes("return'iptal et '+id+' req '+req"),'cancel command must bind mission id + current REQ');
assert.ok(missionActions.includes('function workerReceiptMatches('),'Worker receipt verifier missing');
assert.ok(missionActions.includes('function waitForActionProof('),'post-action durable state proof missing');
assert.ok(missionActions.includes('mission_action_worker_receipt_missing'),'generic Worker success must not count as mobile mission success');
assert.ok(missionActions.includes('mission_approval_state_unconfirmed'),'approval must fail closed while reviewed REQ remains active');
assert.ok(missionActions.includes('mission_cancel_state_unconfirmed'),'cancel must fail closed while mission remains in open queue');
assert.ok(missionActions.includes("/AÇIK ONAY UYGULANDI/i"),'approval receipt marker validation missing');
assert.ok(missionActions.includes("/MISSION İPTAL EDİLDİ/i"),'cancel receipt marker validation missing');
assert.ok(!missionActions.includes("'/api/tasks/'+")&&!missionActions.includes('/approve'),'durable mission controls must not reuse legacy cloud-task approve endpoint');
assert.ok(missionActions.includes("approve.textContent='ONAYLA'"),'mobile approval button missing');
assert.ok(missionActions.includes("cancel.textContent='İPTAL'"),'mobile cancel button missing');
assert.ok(worker.includes("message:'AÇIK ONAY UYGULANDI · '"),'authoritative Worker approval receipt marker missing');
assert.ok(worker.includes("'MISSION İPTAL EDİLDİ'"),'authoritative Worker cancel receipt marker missing');

// v174: same mission action replay is coalesced at the shared Service Worker
// network boundary, while Worker REQ/state proof remains the final authority.
assert.doesNotThrow(()=>new Function(serviceWorker),'service worker has invalid JavaScript syntax');
assert.ok(serviceWorker.includes('function missionActionReplayKeyFromMessage('),'mission replay key parser missing');
assert.ok(serviceWorker.includes('function coalesceMissionActionRequest('),'mission replay request coalescer missing');
assert.ok(serviceWorker.includes("url.pathname!=='/api/mobile-brain'"),'replay coalescing must be scoped to mobile-brain only');
assert.ok(serviceWorker.includes('MISSION_ACTION_REPLAY_TTL_MS=45000'),'mission replay cache must be short-lived and bounded');

// v175: verified receipts are derived only after Worker receipt + state proof,
// contain bounded suffixes only, and stay in a short session-local ledger.
assert.ok(missionActions.includes("const RECEIPT_STORAGE_KEY='jarvisMissionReceiptsV1'"),'verified receipt session key missing');
assert.ok(missionActions.includes('const RECEIPT_LIMIT=8'),'verified receipt ledger must be bounded');
assert.ok(missionActions.includes('function buildVerifiedReceipt('),'verified receipt builder missing');
assert.ok(missionActions.includes('function sanitizeVerifiedReceipt('),'verified receipt sanitizer missing');
assert.ok(missionActions.includes('const verified=await runActionWithProof(action,resolved,{fetchImpl})'),'receipt must follow full action proof');
assert.ok(missionActions.includes('const receipt=buildVerifiedReceipt(action,resolved,verified.proof)'),'verified proof is not bound to receipt');

execFileSync(process.execPath,['mobile-mission-actions-selftest.js'],{stdio:'inherit'});
execFileSync(process.execPath,['mobile-mission-replay-selftest.js'],{stdio:'inherit'});
execFileSync(process.execPath,['mobile-mission-receipt-selftest.js'],{stdio:'inherit'});
execFileSync(process.execPath,['mobile-mission-trail-selftest.js'],{stdio:'inherit'});
console.log('MISSION CONSOLE SELFTEST PASS');
