const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.100.0'"),'Worker 2.100.0 required');
assert.ok(worker.includes("'creator_batch_mission_v1'"),'creator batch mission capability missing');
assert.ok(worker.includes("'creator_batch_child_dedupe_v1'"),'creator batch child dedupe capability missing');
assert.ok(worker.includes("'creator_batch_youtube_draft_v1'"),'creator batch YouTube draft capability missing');
assert.ok(worker.includes("'mission_cooperative_yield_v1'"),'cooperative scheduler yield capability missing');
assert.ok(worker.includes("name:'creator_batch_mission'"),'native creator batch tool missing');
assert.ok(worker.includes("else if(n==='creator_batch_mission')"),'creator batch handler missing');
assert.ok(worker.includes('function normalizeCreatorBatchItems(args={})'),'batch item normalizer missing');
assert.ok(worker.includes("args.items)?args.items.slice(0,10)"),'batch must cap at 10 items');
assert.ok(worker.includes("if(rows.length<2)throw new Error('Creator batch görevi için en az 2 video gerekli.')"),'batch minimum 2 guard missing');

assert.ok(worker.includes('function createCreatorBatchMission(args={})'),'batch mission factory missing');
assert.ok(worker.includes("type:'creator_batch'"),'creator_batch mission type missing');
assert.ok(worker.includes("name:'creator_batch_render_'"),'batch render phase steps missing');
assert.ok(worker.includes("name:'creator_batch_youtube_'"),'batch YouTube phase steps missing');
assert.ok(worker.includes('function creatorBatchReceiptId(missionId,index)'),'per-item YouTube receipt id missing');

assert.ok(worker.includes('function findCreatorBatchChild(parentId,index)'),'batch child lookup missing');
assert.ok(worker.includes("m&&m.type==='creator_short'"),'batch child lookup must only reuse creator_short missions');
assert.ok(worker.includes("String(m.input&&m.input.batchParent||'')===pid"),'batch child lookup must bind parent id');
assert.ok(worker.includes("Number(m.input&&m.input.batchIndex)===Number(index)"),'batch child lookup must bind item index');
assert.ok(worker.includes('const existing=findCreatorBatchChild(parentMission.id,index);'),'batch must search existing child before creation');
assert.ok(worker.includes('if(existing)return existing;'),'batch must reuse existing child');
assert.ok(worker.includes('includeYouTube:false'),'render child must not upload while render phase is running');
assert.ok(worker.includes('publish:false,\n    _batchParent:parentMission.id'),'batch child must force publish=false');

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
assert.ok(worker.includes("published:false"),'batch YouTube artifact must stay non-public');

const depStart=worker.indexOf("if(/^mission:M-[A-Z0-9-]+$/.test(dep))");
const depEnd=worker.indexOf("if(dep==='pc_runtime')",depStart);
assert.ok(depStart>0&&depEnd>depStart,'child mission dependency readiness block missing');
const depBlock=worker.slice(depStart,depEnd);
assert.ok(depBlock.includes("['completed','failed','cancelled'].includes"),'parent must wake only when child reaches terminal state');
assert.ok(!depBlock.includes("!['paused','cancelled','failed'].includes"),'queued/running child must not wake parent and starve scheduler');
assert.strictEqual((depBlock.match(/loadMission\(WORKSPACE/g)||[]).length,1,'child dependency logic must not contain overlapping readiness branches');

assert.ok(worker.includes("creatorBatchMissionReady:CAPS.includes('creator_batch_mission_v1')"),'PC acceptance must require creator batch readiness');
assert.ok(worker.includes("CAPS.includes('mission_cooperative_yield_v1')"),'PC acceptance must require cooperative yield');
assert.ok(worker.includes('Batch hiçbir videoyu PUBLIC yayınlamaz.'),'native batch contract must state no PUBLIC publishing');
assert.ok(worker.includes('batch PUBLIC yayınlamaz'),'agent guidance must preserve draft-only batch policy');

console.log('CREATOR BATCH MISSION SELFTEST PASS');
