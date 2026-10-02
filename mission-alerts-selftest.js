const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const server=fs.readFileSync('./server.js','utf8');
const start=server.indexOf('function missionTransitionEvent(');
const end=server.indexOf('async function pushMissionTransition(',start);
assert.ok(start>0&&end>start,'mission transition helper missing');
const source=server.slice(start,end);

const context={Date,String,Number,Math,result:null};
vm.createContext(context);
vm.runInContext(source,context);

const now=Date.now();
const iso=new Date(now).toISOString();
const completed={lastResult:{status:'completed',missionId:'M-TEST-1234567890',dependency:'',at:iso}};
let event=vm.runInContext('missionTransitionEvent(null,'+JSON.stringify(completed)+','+now+')',context);
assert.ok(event&&event.status==='completed','fresh completed mission must notify');
assert.ok(/tamamlandı/i.test(event.title),'completed notification title missing');

event=vm.runInContext('missionTransitionEvent('+JSON.stringify(completed)+','+JSON.stringify(completed)+','+now+')',context);
assert.strictEqual(event,null,'same transition must not notify twice');

const stale={lastResult:{status:'completed',missionId:'M-STALE-1234567890',dependency:'',at:new Date(now-181000).toISOString()}};
event=vm.runInContext('missionTransitionEvent(null,'+JSON.stringify(stale)+','+now+')',context);
assert.strictEqual(event,null,'stale mission result must not replay after server restart');

const verify={lastResult:{status:'needs_verification',missionId:'M-VERIFY-1234567890',dependency:'youtube_studio',at:iso}};
event=vm.runInContext('missionTransitionEvent(null,'+JSON.stringify(verify)+','+now+')',context);
assert.ok(event&&event.status==='needs_verification','verification event missing');
assert.ok(/kopya/i.test(event.body),'verification notification must explain duplicate-safety stop');

const waiting={lastResult:{status:'waiting_dependency',missionId:'M-WAIT-1234567890',dependency:'shopify',at:iso}};
event=vm.runInContext('missionTransitionEvent(null,'+JSON.stringify(waiting)+','+now+')',context);
assert.ok(event&&event.status==='waiting_dependency','waiting dependency event missing');
assert.ok(/shopify/i.test(event.body),'dependency name missing from notification');

const idle={lastResult:{status:'no_runnable_mission',missionId:'M-IDLE-1234567890',dependency:'',at:iso}};
event=vm.runInContext('missionTransitionEvent(null,'+JSON.stringify(idle)+','+now+')',context);
assert.strictEqual(event,null,'non-actionable scheduler state must not notify');

assert.ok(server.includes("log('MISSION_EVENT'"),'mission event audit log missing');
assert.ok(server.includes("log('MISSION_PUSH'"),'mission push delivery log missing');
assert.ok(server.includes('pushMissionTransition(previousMissions,snapshot.missions)'), 'heartbeat transition dispatch missing');
assert.ok((server.match(/pushMissionTransition\(previousMissions,snapshot\.missions\)/g)||[]).length>=2,'signed and legacy Worker heartbeat paths must both dispatch');
assert.ok(server.includes("tag:'jarvis-mission-'"),'stable mission push tag missing');

console.log('MISSION ALERTS SELFTEST PASS');
