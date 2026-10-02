const fs=require('fs');
const path=require('path');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_longform_edit_rhythm_v1'"),'long-form edit rhythm capability missing');
assert.strictEqual(typeof creator.buildLongformStoryboard,'function','long-form storyboard export missing');

const assets=[
  path.join('/tmp','a.mp4'),
  path.join('/tmp','b.mp4'),
  path.join('/tmp','c.mp4'),
  path.join('/tmp','d.mp4')
];
const board=creator.buildLongformStoryboard(assets,600,0.35,25,28);
assert.strictEqual(board.length,24,'600 second long-form should target 24 paced scenes');
for(let i=0;i<4;i++)assert.strictEqual(board[i].file,assets[i],'first asset order must be preserved');
assert.strictEqual(board[4].file,assets[0],'storyboard should cycle assets after preserving first order');
assert.ok(board[4].sourceOffset!==board[0].sourceOffset,'reused asset should start from a different source offset');
assert.ok(board.every(x=>x.duration>20&&x.duration<30.5),'scene duration must stay in professional 20-30s rhythm');
assert.strictEqual(board[0].transition,null,'first scene must not have a transition');
assert.ok(new Set(board.slice(1).map(x=>x.transition)).size>=3,'long-form transition variety missing');
assert.ok(board.every((x,i)=>i===0||x.start>board[i-1].start),'storyboard starts must be strictly increasing');
assert.ok(board[board.length-1].end<=600.001,'storyboard must not exceed target duration');

assert.ok(source.includes('buildLongformStoryboard(assets,duration,transition,25,28)'),'long-form renderer must use paced storyboard');
assert.ok(source.includes("for(const scene of storyboard)args.push('-stream_loop','-1','-i',scene.file)"),'each paced scene must receive its own input');
assert.ok(source.includes("'-map',String(storyboard.length)+':a:0'"),'long-form audio map must follow expanded storyboard input count');
assert.ok(source.includes("motion:'subtle-pan-crop'"),'long-form motion profile missing');
assert.ok(source.includes("transition:'varied'"),'long-form varied transition profile missing');
assert.ok(source.includes("CREATOR_LONGFORM_EDIT_RHYTHM_FAILED"),'long-form edit rhythm fail-closed guard missing');
assert.ok(source.includes("sceneCount:storyboard.length"),'long-form scene evidence missing');

const renderStart=source.indexOf('function renderShort(');
const renderEnd=source.indexOf('function renderLongform(',renderStart);
const shortBlock=source.slice(renderStart,renderEnd);
assert.ok(shortBlock.includes("const storyboard=buildStoryboard(assets,duration,transition)"),'Shorts storyboard behavior changed');
assert.ok(shortBlock.includes("'-map',String(assets.length)+':a:0'"),'Shorts audio mapping changed');
assert.ok(!shortBlock.includes('buildLongformStoryboard'),'Long-form edit logic leaked into Shorts');
assert.ok(!shortBlock.includes('visualEdit'),'Long-form visual metadata leaked into Shorts');

assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR LONGFORM EDIT RHYTHM V70 SELFTEST PASS');
