const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const startup=fs.readFileSync('./jarvis-startup.ps1','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.99.0'"),'worker 2.99.0 required');
assert.ok(worker.includes('bootstrap_migration_v2'),'bootstrap v2 capability missing');
assert.ok(worker.includes('bootstrap_migration_v3'),'bootstrap v3 capability missing');
assert.ok(worker.includes('bootstrap_migration_v4'),'bootstrap v4 capability missing');
assert.ok(worker.includes('bootstrap_migration_v5'),'bootstrap v5 capability missing');
assert.ok(worker.includes('bootstrap_migration_v6'),'bootstrap v6 capability missing');
assert.ok(worker.includes('function bootstrapRuntimeUpgrade()'),'bootstrap migration function missing');
assert.ok(worker.includes("['jarvis-self-update.ps1',\"UPDATER_VERSION='5.0'\"]"),'updater bootstrap missing');
assert.ok(worker.includes("['jarvis-update-manifest.json','\"schema\": 1']"),'manifest bootstrap missing');
assert.ok(worker.includes("['jarvis-creator-engine.js',\"ENGINE_VERSION='1.1'\"]"),'creator engine bootstrap missing');
assert.ok(worker.includes("['jarvis-browser-operator.js',\"BROWSER_OPERATOR_VERSION='1.0'\"]"),'browser operator bootstrap missing');
assert.ok(worker.includes("['jarvis-commerce-engine.js',\"ENGINE_VERSION='1.0'\"]"),'commerce engine bootstrap missing');
assert.ok(worker.includes("['jarvis-shopify-connect.ps1','SHOPIFY SECURE CONNECT']"),'Shopify connector bootstrap missing');
assert.ok(worker.includes("['jarvis-youtube-studio.js',\"YOUTUBE_STUDIO_VERSION='1.1'\"]"),'YouTube Studio draft bootstrap missing');
assert.ok(worker.includes("['jarvis-mission-engine.js',\"MISSION_ENGINE_VERSION='1.0'\"]"),'Mission Engine bootstrap missing');
assert.ok(worker.includes("['JARVIS-PC-ACCEPTANCE.ps1','JARVIS PC ACCEPTANCE V1']"),'PC acceptance bootstrap missing');
assert.ok(worker.includes("try{missionEngine=require('./jarvis-mission-engine')}catch(_){}"),'Mission Engine must be optional during migration');
assert.ok(worker.includes('recoverInterruptedMissions(WORKSPACE)'),'Mission recovery startup hook missing');
assert.ok(worker.includes("try{youtubeStudio=require('./jarvis-youtube-studio')}catch(_){}"),'YouTube Studio module must be optional during migration');
assert.ok(worker.includes("try{commerceEngine=require('./jarvis-commerce-engine')}catch(_){}"),'commerce engine must be optional during migration');
assert.ok(worker.includes("getCommerceEngine().createDraft(WORKSPACE,product)"),'commerce engine must lazy-load for Shopify tasks');
assert.ok(worker.includes("try{creatorEngine=require('./jarvis-creator-engine')}catch(_){}"),'creator engine must be optional during migration');
assert.ok(worker.includes("getCreatorEngine().renderShort({"),'creator engine must lazy-load after bootstrap');
assert.ok(worker.includes("try{bootstrapRuntimeUpgrade()}catch(e)"),'runtime migration must run before helpers');
assert.ok(startup.includes('jarvis-self-update.ps1'),'canonical startup updater missing');
assert.ok(startup.includes('jarvis-self-update.next.ps1'),'pending updater handoff missing');

assert.ok(worker.includes("['jarvis-workspace-file-engine.js',\"WORKSPACE_FILE_ENGINE_VERSION='1.0'\"]"),'workspace file engine must be included in repair/bootstrap sync');
console.log('BOOTSTRAP BRIDGE SELFTEST PASS');
