const fs=require('fs');
const path=require('path');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_narrative_visual_sync_v1'"),'narrative visual sync capability missing');
assert.ok(worker.includes("creatorNarrativeSyncReady:CAPS.includes('creator_narrative_visual_sync_v1')"),'PC acceptance narrative sync readiness missing');

const many=Array.from({length:12},(_,i)=>path.join('/tmp','scene-'+String(i+1).padStart(2,'0')+'.mp4'));
const board=creator.buildLongformStoryboard(many,600,0.35,25,28);
assert.strictEqual(board.length,24,'600 second long-form should retain 24 paced scenes');
assert.ok(board.every(x=>x.narrativeOrder==='progressive'),'6+ assets must use progressive narrative ordering');
assert.deepStrictEqual(board.slice(0,4).map(x=>x.assetIndex),[0,0,1,1],'progressive mapping should stretch ordered assets across timeline');
assert.deepStrictEqual(board.slice(-4).map(x=>x.assetIndex),[10,10,11,11],'ending scenes should use ending narrative assets');
assert.ok(board.every((x,i)=>i===0||x.assetIndex>=board[i-1].assetIndex),'progressive asset index must never move backward');
assert.ok(new Set(board.map(x=>x.assetIndex)).size===12,'all ordered web assets should be represented');
assert.ok(board[1].sourceOffset!==board[0].sourceOffset,'reused adjacent asset must vary source offset');

const few=creator.buildLongformStoryboard(many.slice(0,4),600,0.35,25,28);
assert.ok(few.every(x=>x.narrativeOrder==='cyclic'),'small asset pools must preserve cyclic diversity');
assert.strictEqual(few[4].assetIndex,0,'small pool cyclic behavior must remain');

assert.ok(source.includes("const narrativeOrdered=list.length>=6"),'narrative-order threshold missing');
assert.ok(source.includes("narrativeOrder:narrativeOrdered?'progressive':'cyclic'"),'storyboard narrative-order evidence missing');
assert.ok(source.includes("narrativeAssetOrder:assets.length>=6?'progressive':'cyclic'"),'render metadata narrative-order evidence missing');
assert.ok(source.includes("profile:{width:1920,height:1080"),'long-form profile missing');
assert.ok(source.includes("sceneTarget:'20-30s'"),'long-form pacing profile regressed');
assert.ok(source.includes("motion:'subtle-pan-crop'"),'long-form motion profile regressed');

for(const cap of [
  'creator_scene_web_queries_v1',
  'creator_auto_web_query_v1',
  'creator_image_motion_fallback_v1',
  'creator_short_motion_rhythm_v1',
  'creator_longform_edit_rhythm_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR NARRATIVE VISUAL SYNC V77 SELFTEST PASS');
