const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.103.0'"),'Worker 2.103.0 required');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'creator batch mission capability missing');
assert.ok(worker.includes("'creator_batch_child_dedupe_v1'"),'creator batch child dedupe capability missing');
assert.ok(worker.includes("'creator_batch_youtube_draft_v1'"),'creator batch YouTube draft capability missing');
assert.ok(worker.includes("'mission_cooperative_yield_v1'"),'cooperative scheduler yield capability missing');
assert.ok(worker.includes("'creator_batch_storyboard_lock_v1'"),'reused child storyboard lock capability missing');
assert.ok(worker.includes("'creator_batch_render_binding_v1'"),'batch render binding capability missing');
assert.ok(worker.includes("'creator_storyboard_v1'"),'Creator storyboard capability must remain');
assert.ok(worker.includes("'creator_explicit_assets_v1'"),'Creator explicit asset capability must remain');
assert.ok(worker.includes("'creator_render_mission_bind_v1'"),'Creator mission-bound render capability must remain');

assert.ok(worker.includes("name:'creator_batch_mission'"),'native creator batch tool missing');
assert.ok(worker.includes("else if(n==='creator_batch_mission')"),'creator batch handler missing');
assert.ok(worker.includes("creatorAssets:{type:'array',maxItems:5"),'batch item ordered creatorAssets schema missing');
assert.ok(worker.includes('function normalizeCreatorBatchItems(args={})'),'batch item normalizer missing');
assert.ok(worker.includes("args.items)?args.items.slice(0,10)"),'batch must cap at 10 items');
assert.ok(worker.includes("if(rows.length<2)throw new Error('Creator batch görevi için en az 2 video gerekli.')"),'batch minimum 2 guard missing');
assert.ok(worker.includes('creatorAssets:normalizeCreatorStoryboardAssets(row&&row.creatorAssets)'),'batch must hash-lock ordered storyboard assets at parent creation');

assert.ok(worker.includes('function createCreatorBatchMission(args={})'),'batch mission factory missing');
assert.ok(worker.includes("type:'creator_batch'"),'creator_batch mission type missing');
assert.ok(worker.includes("name:'creator_batch_render_'"),'batch render phase steps missing');
assert.ok(worker.includes("name:'creator_batch_youtube_'"),'batch YouTube phase steps missing');
assert.ok(worker.includes('function creatorBatchReceiptId(missionId,index)'),'per-item YouTube receipt id missing');

assert.ok(worker.includes('function findCreatorBatchChild(parentId,index)'),'batch child lookup missing');
assert.ok(worker.includes("listMissions(WORKSPACE,{limit:1000})"),'durable child lookup horizon too small');
assert.ok(worker.includes("m&&m.type==='creator_short'"),'batch child lookup must only reuse creator_short missions');
assert.ok(worker.includes("String(m.input&&m.input.batchParent||'')===pid"),'batch child lookup must bind parent id');
assert.ok(worker.includes("Number(m.input&&m.input.batchIndex)===Number(index)"),'batch child lookup must bind item index');
assert.ok(worker.includes('const existing=findCreatorBatchChild(parentMission.id,index);'),'batch must search existing child before creation');
assert.ok(worker.includes('if(existing){'),'existing child must enter guarded reuse branch');
assert.ok(worker.includes("if(!creatorBatchAssetsMatch(selected,existing.input&&existing.input.creatorAssets))"),'existing child must match parent storyboard before reuse');
assert.ok(worker.includes('return existing;'),'matching existing child must be reused');

assert.ok(worker.includes('function verifyCreatorBatchItemAssets(item)'),'parent-baseline storyboard verification missing');
assert.ok(worker.includes('function creatorBatchAssetsMatch(expected,actual)'),'parent/child storyboard equality helper missing');
assert.ok(worker.includes('CREATOR_BATCH_CHILD_STORYBOARD_MISMATCH'),'reused child storyboard mismatch guard missing');
assert.ok(worker.includes("throw new Error('CREATOR_STORYBOARD_HASH_CONFLICT: '+rel)"),'batch must stop when parent storyboard hash changes');
assert.ok(worker.includes("getCreatorEngine().inspectAsset(WORKSPACE,rel)"),'batch child creation must revalidate selected videos');
assert.ok(worker.includes('creatorAssets:selected.map(x=>x.path)'),'verified ordered storyboard must be passed into child');
assert.ok(worker.includes('includeYouTube:false'),'render child must not upload during render phase');
assert.ok(worker.includes('publish:false,\n    _batchParent:parentMission.id'),'batch child must force publish=false');
assert.ok(worker.includes('batchParent:String(args._batchParent||\'\')'),'child must persist parent reference');
assert.ok(worker.includes('batchIndex:Number.isInteger(Number(args._batchIndex))'),'child must persist item index');

const factoryStart=worker.indexOf('function createCreatorBatchMission(args={})');
const childFactoryStart=worker.indexOf('function createCreatorShortMission(args={})',factoryStart);
assert.ok(factoryStart>0&&childFactoryStart>factoryStart,'batch factory block missing');
const batchFactory=worker.slice(factoryStart,childFactoryStart);
assert.ok(!batchFactory.includes('youtube_publish'),'batch factory must never queue PUBLIC publish');
assert.ok(!batchFactory.includes('publish:true'),'batch factory must never request PUBLIC publish');

assert.ok(worker.includes("if(/^creator_batch_render_\\d+$/.test(step.name))"),'batch render execution/recovery missing');
assert.ok(worker.includes("dependency:'mission:'+child.id"),'parent must yield to scheduler while child is open');
assert.ok(worker.includes("if(/^creator_batch_youtube_\\d+$/.test(step.name))"),'batch YouTube DRAFT execution/recovery missing');
assert.ok(worker.includes("missionId:receiptId"),'each batch DRAFT must use its own receipt id');
assert.ok(worker.includes("published:false"),'batch YouTube artifact must remain non-public');
assert.ok(worker.includes("BATCH_RENDER_BINDING_MISMATCH"),'YouTube DRAFT must require mission/storyboard-bound render metadata');
assert.ok(worker.includes("String(meta&&meta.missionId||'')!==String(child.id)"),'batch DRAFT must verify render metadata child mission binding');
assert.ok(worker.includes("meta&&meta.sourceAssetHashes"),'batch DRAFT must verify rendered storyboard hash list');

const depStart=worker.indexOf("if(/^mission:M-[A-Z0-9-]{12,80}$/.test(dep))");
const depEnd=worker.indexOf("if(dep==='pc_runtime')",depStart);
assert.ok(depStart>0&&depEnd>depStart,'child mission dependency readiness block missing');
const depBlock=worker.slice(depStart,depEnd);
assert.ok(depBlock.includes("['completed','failed','cancelled'].includes"),'parent must wake only when child reaches terminal state');
assert.ok(!depBlock.includes("!['paused','cancelled','failed'].includes"),'queued/running child must not wake parent and starve scheduler');
assert.ok(worker.includes("if(dep.startsWith('mission:'))return false"),'malformed mission dependency must stay blocked rather than reaching Mission Engine');

assert.ok(worker.includes("creatorBatchMissionReady:CAPS.includes('creator_batch_mission_v1')"),'PC acceptance must require Creator Batch readiness');
assert.ok(worker.includes("creatorStoryboardReady:CAPS.includes('creator_storyboard_v1')"),'PC acceptance must keep Creator Storyboard readiness');
assert.ok(worker.includes("CAPS.includes('mission_cooperative_yield_v1')"),'PC acceptance must require cooperative yield');
assert.ok(worker.includes('Batch hiçbir videoyu PUBLIC yayınlamaz.'),'native batch contract must state no PUBLIC publishing');
assert.ok(worker.includes('Batch PUBLIC yayınlamaz'),'agent guidance must preserve draft-only batch policy');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit publish gate must remain');
assert.ok(worker.includes('function creatorBatchActiveChild(mission)'),'batch Mission Control active-child helper missing');
assert.ok(worker.includes('function cascadeCreatorBatchControl(mission,action)'),'batch Mission Control cascade helper missing');
assert.ok(worker.includes("cascadeCreatorBatchControl(mission,'resume')"),'batch resume must cascade to paused child');
assert.ok(worker.includes("cascadeCreatorBatchControl(mission,'cancel')"),'batch cancel must cascade to active child');
assert.ok(worker.includes('cascadeCreatorBatchControl(mission,op)'),'batch pause/cancel must cascade to child without force-kill');
const batchControlStart=worker.indexOf('function creatorBatchActiveChild(mission)');
const batchControlEnd=worker.indexOf('function missionControlCandidates(action)',batchControlStart);
assert.ok(batchControlStart>0&&batchControlEnd>batchControlStart,'batch control helper block missing');
const batchControl=worker.slice(batchControlStart,batchControlEnd);
assert.ok(!/killChildTree|taskkill|Stop-Process|process\.kill/.test(batchControl),'batch Mission Control must never force-kill child work');

console.log('CREATOR BATCH V66 SELFTEST PASS');
