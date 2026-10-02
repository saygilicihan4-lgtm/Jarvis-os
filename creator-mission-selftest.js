const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.94.0'"),'Worker 2.94.0 required');
assert.ok(worker.includes("'creator_short_mission_v1'"),'creator durable mission capability missing');
assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
assert.ok(worker.includes('function createCreatorShortMission(args={})'),'creator mission factory missing');
assert.ok(worker.includes("type:'creator_short'"),'creator_short mission type missing');
assert.ok(worker.includes("const steps=['render_short'];"),'creator mission must always render first');
assert.ok(worker.includes("if(includeYouTube)steps.push('youtube_draft');"),'creator mission optional YouTube draft missing');
assert.ok(worker.includes("name:'creator_short_mission'"),'native creator mission tool missing');
assert.ok(worker.includes("else if(n==='creator_short_mission')"),'creator mission tool handler missing');
assert.ok(worker.includes("publishYouTube=true")&&worker.includes("approval gate"),'creator mission YouTube approval semantics missing');
assert.ok(worker.includes("creator_short_mission kullan"),'native agent durable mission guidance missing');
assert.ok(worker.includes("'creator_multiscene_v2'"),'multi-scene Creator capability must remain');
assert.ok(worker.includes("'creator_burned_captions_v1'"),'burned captions capability must remain');
assert.ok(worker.includes("'cloud_mission_telemetry_v1'"),'mission telemetry capability must remain');

assert.ok(html.includes('id="creatorAgentDetail"'),'Creator readiness detail missing');
assert.ok(html.includes("pcCaps.includes('creator_short_mission_v1')"),'HUD does not verify durable Creator capability');
assert.ok(html.includes("pcCaps.includes('youtube_publish_approval_v1')"),'HUD does not verify YouTube publish approval capability');
assert.ok(html.includes("Multi-scene Shorts · burned captions · durable mission"),'HUD Creator readiness summary missing');
assert.ok(html.includes('id="commerceAgentDetail"'),'Commerce readiness detail missing');

console.log('CREATOR MISSION SELFTEST PASS');
