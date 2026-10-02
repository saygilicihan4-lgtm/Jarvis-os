const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-mission-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.94.0'"),'Worker 2.94.0 required');
assert.ok(worker.includes("'mission_fair_scheduler_v1'"),'fair scheduler capability missing');
assert.ok(engine.includes('function schedulerOrder(missions)'), 'schedulerOrder helper missing');

const start=worker.indexOf('async function serviceDurableMissions()');
const end=worker.indexOf('function openShopifyConnectWindow()',start);
assert.ok(start>0&&end>start,'mission service block missing');
const block=worker.slice(start,end);

assert.ok(block.includes('engine.schedulerOrder('),'service must use deterministic mission ordering');
assert.ok(block.includes("mission.status==='waiting_dependency'"),'waiting dependency gate missing');
assert.ok(block.includes('missionDependencyReady(mission)'),'dependency readiness probe missing');
assert.ok(block.includes('blockedDependencies++'),'blocked mission skip accounting missing');
assert.ok(block.includes('continue;'),'scheduler must skip blocked work');
assert.ok(block.includes("candidate=mission"),'runnable mission selection missing');
assert.ok(block.includes("status:'no_runnable_mission'"),'no-runnable state missing');
assert.ok(!block.includes('publishProduct('),'scheduler must never publish Shopify products');
assert.ok(!block.includes("clickByText(workspace,'Publish'"),'scheduler must never publish YouTube videos');

const healthStart=worker.indexOf('function missionHealthSnapshot()');
const healthEnd=worker.indexOf('async function missionDependencyReady',healthStart);
const health=worker.slice(healthStart,healthEnd);
assert.ok(health.includes("scheduler:'oldest-ready-first'"),'health scheduler metadata missing');
assert.ok(health.includes('waitingDependency'),'waiting dependency count missing');
assert.ok(health.includes('needsVerification'),'verification count missing');
assert.ok(health.includes('queue:open.slice(0,10)'),'mission queue preview missing');

console.log('MISSION SCHEDULER SELFTEST PASS');
