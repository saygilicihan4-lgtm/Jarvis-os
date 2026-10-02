const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const creator=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.ok(worker.includes("'creator_quality_gate_v1'"),'Creator quality gate capability missing');
assert.ok(worker.includes("'creator_quality_recovery_v1'"),'Creator quality recovery capability missing');
assert.ok(worker.includes("jarvis-creator-engine.js',\"ENGINE_VERSION='1.5'"),'Creator Engine 1.5 runtime signature missing');
assert.ok(worker.includes("quality:out.quality"),'render artifact must retain measured quality');
assert.ok(worker.includes("creator.probeRenderedShort(expected,status.ffprobe)"),'uncertain render recovery must rerun quality gate');
assert.ok(worker.includes("artifact:{output:expected,metadata:metaFile,quality,recovered:true}"),'recovered render must retain quality evidence');
assert.ok(worker.includes("creatorQualityGateReady:CAPS.includes('creator_quality_gate_v1')"),'PC acceptance must require Creator quality gate');

assert.ok(creator.includes("const ENGINE_VERSION='1.5'"),'Creator Engine 1.5 required');
assert.ok(creator.includes('function probeRenderedShort(file,ffprobe)'),'render quality probe missing');
assert.ok(creator.includes("audio:!!audio"),'audio stream quality requirement missing');
assert.ok(creator.includes("codec:String(video&&video.codec_name||'').toLowerCase()==='h264'"),'H.264 quality requirement missing');
assert.ok(creator.includes("width:Number(video&&video.width)===1080"),'1080 width requirement missing');
assert.ok(creator.includes("height:Number(video&&video.height)===1920"),'1920 height requirement missing');
assert.ok(creator.includes("Math.abs(fps-30)<=0.05"),'30 FPS requirement missing');
assert.ok(creator.includes("duration>=11.8&&duration<=18.8"),'12-18s tolerance requirement missing');
assert.ok(creator.includes("const quality=probeRenderedShort(outFile,status.ffprobe)"),'post-render quality gate invocation missing');
assert.ok(creator.includes("e.code=String(quality.code||'CREATOR_QUALITY_FAILED')"),'quality failure must fail closed');
assert.ok(creator.includes("quality,\n    output:path.relative(workspace,outFile)"),'quality evidence missing from Creator job metadata');
assert.ok(creator.includes("probeRenderedShort,\n  probeRenderedLongform,\n  listAssets"),'quality probe export missing');

assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify publish gate must remain');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube publish gate must remain');
assert.ok(worker.includes("'creator_batch_storyboard_lock_v1'"),'Creator Batch v66 storyboard lock must remain');
assert.ok(worker.includes("'mission_control_v1'"),'Mission Control must remain');
assert.ok(worker.includes("'workspace_file_mission_v1'"),'Workspace Files must remain');

console.log('CREATOR QUALITY GATE SELFTEST PASS');
