const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.97.0'"),'Worker 2.97.0 required');
assert.ok(worker.includes("'creator_short_mission_v1'"),'creator durable mission capability missing');
assert.ok(worker.includes('function createCreatorShortMission(args={})'),'creator mission factory missing');
assert.ok(worker.includes("type:'creator_short'"),'creator_short mission type missing');
assert.ok(worker.includes("const steps=['render_short'];"),'creator mission must always render first');
assert.ok(worker.includes("if(includeYouTube)steps.push('youtube_draft');"),'creator mission optional YouTube draft missing');
assert.ok(worker.includes("const publishYouTube=args.publish===true"),'creator YouTube publish intent missing');
assert.ok(worker.includes("if(publishYouTube)steps.push({name:'youtube_publish',meta:{requiresApproval:true}})"),'creator YouTube publish approval step missing');
assert.ok(worker.includes("name:'creator_short_mission'"),'native creator mission tool missing');
assert.ok(worker.includes("else if(n==='creator_short_mission')"),'creator mission tool handler missing');
assert.ok(worker.includes("publish=true yalnızca taslaktan sonra PUBLIC yayın adımını sıraya koyar"),'creator mission publish gate description missing');
assert.ok(worker.includes('YOUTUBE PUBLIC İÇİN AYRI AÇIK ONAY BEKLİYOR'),'creator publish approval feedback missing');
assert.ok(worker.includes("creator_short_mission kullan"),'native agent durable mission guidance missing');
assert.ok(worker.includes("'creator_multiscene_v2'"),'multi-scene Creator capability must remain');
assert.ok(worker.includes("'creator_burned_captions_v1'"),'burned captions capability must remain');
assert.ok(worker.includes("'cloud_mission_telemetry_v1'"),'mission telemetry capability must remain');

assert.ok(html.includes('id="creatorAgentDetail"'),'Creator readiness detail missing');
assert.ok(html.includes("pcCaps.includes('creator_short_mission_v1')"),'HUD does not verify durable Creator capability');
assert.ok(html.includes("Multi-scene Shorts · burned captions · durable mission"),'HUD Creator readiness summary missing');
assert.ok(html.includes('id="commerceAgentDetail"'),'Commerce readiness detail missing');

console.log('CREATOR MISSION SELFTEST PASS');
