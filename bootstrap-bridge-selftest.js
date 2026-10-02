const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const startup=fs.readFileSync('./jarvis-startup.ps1','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.76.0'"),'worker 2.76.0 required');
assert.ok(worker.includes('bootstrap_migration_v1'),'bootstrap capability missing');
assert.ok(worker.includes('function bootstrapRuntimeUpgrade()'),'bootstrap migration function missing');
assert.ok(worker.includes("['jarvis-self-update.ps1',\"UPDATER_VERSION='5.0'\"]"),'updater bootstrap missing');
assert.ok(worker.includes("['jarvis-update-manifest.json','\"schema\": 1']"),'manifest bootstrap missing');
assert.ok(worker.includes("['jarvis-creator-engine.js',\"ENGINE_VERSION='1.0'\"]"),'creator engine bootstrap missing');
assert.ok(worker.includes("['jarvis-commerce-engine.js',\"ENGINE_VERSION='1.0'\"]"),'commerce engine bootstrap missing');
assert.ok(worker.includes("['jarvis-shopify-connect.ps1','SHOPIFY SECURE CONNECT']"),'Shopify connector bootstrap missing');
assert.ok(worker.includes("try{commerceEngine=require('./jarvis-commerce-engine')}catch(_){}"),'commerce engine must be optional during migration');
assert.ok(worker.includes("getCommerceEngine().createDraft(WORKSPACE,product)"),'commerce engine must lazy-load for Shopify tasks');
assert.ok(worker.includes("try{creatorEngine=require('./jarvis-creator-engine')}catch(_){}"),'creator engine must be optional during migration');
assert.ok(worker.includes("getCreatorEngine().renderShort({"),'creator engine must lazy-load after bootstrap');
assert.ok(worker.includes("try{bootstrapRuntimeUpgrade()}catch(e)"),'runtime migration must run before helpers');
assert.ok(startup.includes('jarvis-self-update.ps1'),'canonical startup updater missing');
assert.ok(startup.includes('jarvis-self-update.next.ps1'),'pending updater handoff missing');

console.log('BOOTSTRAP BRIDGE SELFTEST PASS');
