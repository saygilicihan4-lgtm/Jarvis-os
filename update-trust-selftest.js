const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const startup=fs.readFileSync('./jarvis-startup.ps1','utf8');
const updater=fs.readFileSync('./jarvis-self-update.ps1','utf8');
const manifest=fs.readFileSync('./jarvis-update-manifest.json','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
assert.ok(worker.includes("const UPDATE_STATE_FILE=path.join(MEMORY_DIR,'update-state.json')"),'update state path missing');
assert.ok(worker.includes('function selfUpdateState()'),'self-update state reader missing');
assert.ok(worker.includes('selfUpdate:selfUpdateState()'),'local health does not expose updater state');
assert.ok(worker.includes('update:selfUpdateState()'),'Worker heartbeat does not relay updater state');
assert.ok(worker.includes('autoUpdateReady:!!(startup.selfUpdate&&startup.selfUpdate.configured)'),'acceptance does not gate updater readiness');
assert.ok(worker.includes("restartPolicy:'startup-before-worker'"),'restart policy missing');

assert.ok(server.includes('function sanitizeWorkerUpdate(raw)'),'server updater sanitizer missing');
assert.ok(server.includes('update:sanitizeWorkerUpdate(d.update)'),'heartbeat updater sanitizer wiring missing');
assert.ok(server.includes('update:pc.update||null'),'public state updater relay missing');

assert.ok(html.includes('id="updateState"'),'AUTO UPDATE HUD metric missing');
assert.ok(html.includes('function renderSelfUpdateState(raw'), 'updater HUD renderer missing');
assert.ok(html.includes("renderSelfUpdateState(j.selfUpdate,'local')"),'local updater telemetry not rendered');
assert.ok(html.includes("renderSelfUpdateState(pc.update,'cloud')"),'cloud updater telemetry not rendered on phone/web');

assert.ok(startup.includes('jarvis-self-update.ps1'),'startup does not invoke self updater');
assert.ok(startup.includes('-Silent'),'startup updater must run silently');
assert.ok(updater.includes("$BaseUrl = 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'"),'updater stable source missing');
assert.ok(updater.includes('Save-UpdateState $true'),'updater state persistence missing');
assert.ok(manifest.includes('"path": "worker.js"'),'worker not managed by update manifest');

console.log('UPDATE TRUST SELFTEST PASS');
