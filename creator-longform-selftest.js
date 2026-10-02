const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
assert.strictEqual(creator.ENGINE_VERSION,'1.4');

for(const cap of [
  'creator_longform_mission_v1',
  'creator_longform_quality_v1',
  'creator_longform_recovery_v1',
  'creator_multilingual_voice_v1',
  'creator_daily_longform_v1',
  'creator_daily_idempotency_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' missing');
}

assert.ok(source.includes('function renderLongform({workspace,name,script,voicePath,assetFiles=[],missionId=\'\',assetHashes=[]})'),'long-form renderer missing');
assert.ok(source.includes('function probeRenderedLongform(file,ffprobe)'),'long-form probe missing');
assert.ok(source.includes("codec:String(video&&video.codec_name||'').toLowerCase()==='h264'"),'H.264 long-form gate missing');
assert.ok(source.includes("width:Number(video&&video.width)===1920"),'1920 long-form width gate missing');
assert.ok(source.includes("height:Number(video&&video.height)===1080"),'1080 long-form height gate missing');
assert.ok(source.includes("Math.abs(fps-30)<=0.05"),'30 FPS gate missing');
assert.ok(source.includes("duration>=540&&duration<=660"),'9-11 minute duration gate missing');
assert.ok(source.includes("audio:!!audio"),'long-form audio requirement missing');
assert.ok(source.includes("split(',').includes('mp4')"),'MP4 container gate missing');
assert.ok(source.includes("actualSize>=1024*1024"),'minimum output size gate missing');
assert.ok(source.includes("const quality=probeRenderedLongform(outFile,status.ffprobe)"),'post-render long-form quality gate missing');
assert.ok(source.includes("mode:'longform'"),'long-form metadata mode missing');
assert.ok(source.includes("sourceAssetHashes:Array.isArray(assetHashes)"),'long-form asset hash metadata missing');
assert.ok(source.includes("renderLongform,\n  probeRenderedShort,\n  probeRenderedLongform"),'long-form exports missing');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-longform-test-'));
const assetDir=path.join(tmp,'creator-assets');
fs.mkdirSync(assetDir,{recursive:true});
const ordered=[];
for(let i=0;i<20;i++){
  const name=String(i+1).padStart(2,'0')+'.mp4';
  fs.writeFileSync(path.join(assetDir,name),Buffer.alloc(32,i+1));
  ordered.push('creator-assets/'+name);
}
const explicit=creator.resolveAssetSelection(tmp,ordered,20);
assert.strictEqual(explicit.length,20,'long-form storyboard must support 20 clips');
assert.ok(explicit[0].endsWith(path.join('creator-assets','01.mp4')),'long-form clip order must be preserved');
assert.ok(explicit[19].endsWith(path.join('creator-assets','20.mp4')),'long-form clip order must be preserved');

if(process.platform!=='win32'){
  const output=path.join(tmp,'longform.mp4');
  fs.writeFileSync(output,Buffer.alloc(2*1024*1024,7));
  const bytes=fs.statSync(output).size;
  const goodProbe=path.join(tmp,'ffprobe-good.sh');
  fs.writeFileSync(goodProbe,`#!/bin/sh
cat <<'JSON'
{"streams":[{"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"r_frame_rate":"30/1"},{"codec_type":"audio","codec_name":"aac"}],"format":{"duration":"600.000","size":"${bytes}","format_name":"mov,mp4,m4a,3gp,3g2,mj2"}}
JSON
`,'utf8');
  fs.chmodSync(goodProbe,0o755);
  const pass=creator.probeRenderedLongform(output,goodProbe);
  assert.strictEqual(pass.ok,true,'valid 10-minute HD output must pass long-form gate');
  assert.strictEqual(pass.measured.duration,600);

  const badProbe=path.join(tmp,'ffprobe-bad.sh');
  fs.writeFileSync(badProbe,`#!/bin/sh
cat <<'JSON'
{"streams":[{"codec_type":"video","codec_name":"h264","width":1280,"height":720,"r_frame_rate":"30/1"}],"format":{"duration":"600.000","size":"${bytes}","format_name":"mov,mp4"}}
JSON
`,'utf8');
  fs.chmodSync(badProbe,0o755);
  const fail=creator.probeRenderedLongform(output,badProbe);
  assert.strictEqual(fail.ok,false,'missing audio / non-HD output must fail closed');
  assert.strictEqual(fail.checks.audio,false);
  assert.strictEqual(fail.checks.width,false);
}

assert.ok(worker.includes('async function renderCreatorLongformVoiceFile'),'chunked local long-form narration missing');
assert.ok(worker.includes('splitCreatorNarrationChunks'),'long-form narration chunker missing');
assert.ok(worker.includes("function normalizeCreatorVoiceName"),'multilingual Neural voice validator missing');
assert.ok(worker.includes("function createCreatorLongformMission(args={})"),'durable long-form mission factory missing');
assert.ok(worker.includes("const steps=['render_longform']"),'long-form render step missing');
assert.ok(worker.includes("if(step.name==='render_longform')"),'long-form execution/recovery missing');
assert.ok(worker.includes("creator.probeRenderedLongform(expected,status.ffprobe)"),'long-form uncertain recovery must re-run quality probe');
assert.ok(worker.includes("mission.artifacts.render_longform||mission.artifacts.render_short"),'YouTube DRAFT must accept long-form artifact');
assert.ok(worker.includes("name:'creator_longform_mission'"),'native long-form mission tool missing');
assert.ok(worker.includes("else if(n==='creator_longform_mission')"),'native long-form mission handler missing');

assert.ok(worker.includes("const CREATOR_DAILY_PLAN_FILE=path.join(MEMORY_DIR,'creator-daily-longform.json')"),'durable daily plan state missing');
assert.ok(worker.includes("function findCreatorDailyMission(planId,dateKey)"),'daily mission dedupe lookup missing');
assert.ok(worker.includes("m&&m.type==='creator_longform'"),'daily dedupe must bind long-form mission type');
assert.ok(worker.includes("String(m.input&&m.input.dailyDate||'')===day"),'daily dedupe must bind calendar date');
assert.ok(worker.includes("listMissions(WORKSPACE,{limit:1000})"),'daily dedupe horizon missing');
assert.ok(worker.includes("async function serviceCreatorDailyPlan"),'daily plan service missing');
assert.strictEqual((worker.match(/async function serviceCreatorDailyPlan/g)||[]).length,1,'daily planner must have exactly one service implementation');
assert.ok(/function creatorDailyDefaultPlan\(\)[\s\S]{0,500}enabled:true/.test(worker),'requested daily long-form plan must default enabled');
assert.ok(worker.includes('function creatorDailyAutoAssetBaselines(dateKey,maxItems=12)'),'daily auto asset baseline helper missing');
assert.ok(worker.includes('creatorDailyAutoAssetBaselines(dateKey,12)'),'daily automatic storyboard must be selected and hash-locked before mission creation');
assert.ok(worker.includes('verifyCreatorLongformBaselines(plan.creatorAssets)'),'configured daily storyboard baselines must be reverified before reuse');
assert.ok(worker.includes("setInterval(()=>serviceCreatorDailyPlan().catch(()=>{}),60000)"),'daily plan restart service interval missing');
assert.ok(worker.includes("name:'creator_daily_longform_plan'"),'native daily plan tool missing');
assert.ok(worker.includes("else if(n==='creator_daily_longform_plan')"),'native daily plan handler missing');

const dailyStart=worker.indexOf('async function serviceCreatorDailyPlan');
const dailyEnd=worker.indexOf('function normalizePcMissionActions',dailyStart);
assert.ok(dailyStart>0&&dailyEnd>dailyStart,'daily plan service block missing');
const dailyBlock=worker.slice(dailyStart,dailyEnd);
assert.ok(dailyBlock.includes('publish:false'),'daily plan must force publish=false');
assert.ok(!dailyBlock.includes('publish:true'),'daily plan must never request PUBLIC');
assert.ok(!dailyBlock.includes("youtube_publish"),'daily plan must never create YouTube PUBLIC step directly');

assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit approval policy must remain');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify explicit approval policy must remain');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'Creator Batch v66 capability must remain');
assert.ok(worker.includes("'creator_storyboard_v1'"),'Creator Storyboard v65 capability must remain');
assert.ok(worker.includes("'creator_quality_gate_v1'"),'Creator Quality v67 capability must remain');
assert.ok(source.includes('function probeRenderedShort(file,ffprobe)'),'Shorts quality gate must remain');
assert.ok(source.includes("width:Number(video&&video.width)===1080"),'Shorts 1080 width gate must remain');
assert.ok(source.includes("height:Number(video&&video.height)===1920"),'Shorts 1920 height gate must remain');

console.log('CREATOR DAILY LONGFORM V68 SELFTEST PASS');
