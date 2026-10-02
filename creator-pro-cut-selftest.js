const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.strictEqual(creator.ENGINE_VERSION,'1.5');

for(const cap of ['creator_pro_cut_v1','creator_longform_pacing_v1','creator_daily_professional_v1']){
  assert.ok(worker.includes("'"+cap+"'"),cap+' missing');
}

assert.strictEqual(typeof creator.buildLongformStoryboard,'function','pro long-form storyboard builder missing');
assert.strictEqual(typeof creator.evaluateLongformEditQuality,'function','pro edit quality evaluator missing');

const assets=['/tmp/a.mp4','/tmp/b.mp4','/tmp/c.mp4','/tmp/d.mp4'];
const info=assets.map((file,i)=>({ok:true,file,duration:24+i*3,width:1920,height:1080,codec:'h264'}));
const board=creator.buildLongformStoryboard(assets,info,600,0.18,8.5,72);
assert.ok(board.length>=60&&board.length<=72,'10-minute pro cut should create 60-72 shots');
assert.deepStrictEqual(board.slice(0,4).map(x=>x.assetIndex),[0,1,2,3],'explicit asset order must lead the first shot cycle');
assert.ok(board.every(x=>x.duration>=6.5&&x.duration<=10.5),'pro shots must stay in professional pacing band');
assert.ok(board.every(x=>x.sourceStart>=0),'source seek offsets must be non-negative');
assert.ok(board.every((x,i)=>i===0||x.start>board[i-1].start),'timeline starts must be monotonic');

const quality=creator.evaluateLongformEditQuality(board,assets,600);
assert.strictEqual(quality.ok,true,'pro edit quality should pass paced multi-asset board');
assert.ok(quality.measured.averageSceneSeconds>=6.5&&quality.measured.averageSceneSeconds<=10.5);
assert.strictEqual(quality.measured.distinctAssets,4);

const weakBoard=creator.buildLongformStoryboard(['/tmp/a.mp4'],[info[0]],600,0,8.5,72);
const weak=creator.evaluateLongformEditQuality(weakBoard,['/tmp/a.mp4'],600);
assert.strictEqual(weak.ok,false,'single-asset long-form must not qualify as professional');
assert.strictEqual(weak.checks.visualVariety,false);

assert.ok(source.includes("function renderLongform({workspace,name,script,voicePath,assetFiles=[],missionId='',assetHashes=[],professionalMode=false})"),'professionalMode render switch missing');
assert.ok(source.includes("buildLongformStoryboard(assets,assetInfo,duration,transition,8.5,72)"),'long-form renderer must use pro pacing builder');
assert.ok(source.includes("split='+scenes.length"),'shared asset inputs must split into reusable shot branches');
assert.ok(source.includes("'trim=start='+scene.sourceStart.toFixed(3)+':duration='"),'shot-specific source seek missing');
assert.ok(source.includes("const offset=Number(storyboard[i].start||0)"),'xfade must follow storyboard timeline offsets');
assert.ok(source.includes("if(professionalMode&&!editQuality.ok)"),'professional edit quality must fail closed');
assert.ok(source.includes("CREATOR_PRO_VISUALS_REQUIRED"),'insufficient visual variety code missing');
assert.ok(source.includes("professionalMode:professionalMode===true"),'pro mode metadata missing');
assert.ok(source.includes("editQuality,"),'edit quality evidence missing from metadata/artifact');

assert.ok(worker.includes("const professionalMode=args.professionalMode!==false"),'new long-form missions must default to professional mode');
assert.ok(worker.includes("professionalMode:input.professionalMode===true"),'old v68 missions without flag must remain backward compatible');
assert.ok(worker.includes("professionalMode:true,\n        includeYouTube"),'daily missions must force professional mode');
assert.ok(worker.includes("if(availableVisuals<3)"),'daily professional visual readiness guard missing');
assert.ok(worker.includes("DAILY_PRO_VISUALS_REQUIRED"),'daily visual wait reason missing');
assert.ok(worker.includes("creatorLongformReady:CAPS.includes('creator_longform_mission_v1')"),'PC acceptance long-form readiness missing');
assert.ok(worker.includes("CAPS.includes('creator_pro_cut_v1')"),'PC acceptance must require Pro Cut capability');

assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy must remain');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify PUBLIC approval policy must remain');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'Creator Batch v66 must remain');
assert.ok(worker.includes("'creator_quality_gate_v1'"),'Creator Quality v67 must remain');
assert.ok(worker.includes("'creator_daily_longform_v1'"),'Creator Daily Longform v68 must remain');

console.log('CREATOR PRO CUT V69 SELFTEST PASS');
