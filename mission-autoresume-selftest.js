const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const start=worker.indexOf('async function serviceDurableMissions()');
const end=worker.indexOf('function openShopifyConnectWindow()',start);
assert.ok(start>0&&end>start,'auto-resume service block missing');
const block=worker.slice(start,end);

assert.ok(block.includes("mission.status==='needs_verification'"),'uncertain mission gate missing');
assert.ok(block.includes("mission.status==='waiting_dependency'"),'dependency wait gate missing');
assert.ok(block.includes('missionDependencyReady(mission)'),'dependency readiness check missing');
assert.ok(block.includes('runDurableMission(candidate.id)')||block.includes('runDurableMission(mission.id)'),'durable resume execution missing');
assert.ok(!block.includes('publishProduct('),'auto-resume must never publish Shopify products');
assert.ok(!block.includes("clickByText(workspace,'Publish'"),'auto-resume must never click YouTube Publish');
assert.ok(!block.includes("clickByText(workspace,'Yayınla'"),'auto-resume must never click YouTube Yayınla');
assert.ok(worker.includes("setInterval(()=>serviceDurableMissions().catch(()=>{}),20000)"),'bounded auto-resume interval missing');
assert.ok(worker.includes("req.url==='/mission-status'"),'mission health endpoint missing');
assert.ok(worker.includes("missionRuntime:missionHealthSnapshot()"),'mission health payload missing');

console.log('MISSION AUTO-RESUME SELFTEST PASS');
