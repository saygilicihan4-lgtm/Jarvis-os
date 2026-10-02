const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const engine=require('./jarvis-creator-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.0');
assert.strictEqual(engine.CREATOR_PROFILE_VERSION,'2.0');
assert.strictEqual(engine.safeName('Benim Shorts / Test'),'Benim-Shorts-Test');

const srt=engine.buildSrt('Birinci cümle burada. İkinci cümle burada ve devam ediyor.',15);
assert.ok(srt.includes('1'));
assert.ok(srt.includes('-->'));
assert.ok(srt.includes('Birinci'));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-creator-test-'));
const status=engine.ffmpegStatus(tmp);
assert.strictEqual(typeof status.ok,'boolean');
assert.ok(status.assetDir.includes('creator-assets'));
assert.ok(fs.existsSync(status.assetDir));

for(const name of ['a.mp4','b.mp4','c.mp4']){
  fs.writeFileSync(path.join(status.assetDir,name),Buffer.alloc(32,1));
}
const selected=engine.selectAssets(tmp,'kampanya-test',5);
assert.strictEqual(selected.length,3);
assert.deepStrictEqual(engine.selectAssets(tmp,'kampanya-test',5),selected,'asset selection must be deterministic');
const board=engine.buildStoryboard(selected,15,0.18);
assert.strictEqual(board.length,3);
assert.strictEqual(board[0].start,0);
assert.ok(board[1].start>0);
assert.ok(Math.abs(board[board.length-1].end-15)<0.01);
assert.ok(engine.ffmpegFilterPath(path.join(tmp,'creator jobs','x.srt')).includes('/'),'filter path must normalize separators');

const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
assert.ok(source.includes('xfade=transition=fade'),'multi-scene transition missing');
assert.ok(source.includes('subtitles=filename='),'burned caption filter missing');
assert.ok(source.includes("multiScene:true"),'multi-scene metadata missing');
assert.ok(source.includes("captionsBurned"),'caption verification metadata missing');

console.log('CREATOR ENGINE SELFTEST PASS');
