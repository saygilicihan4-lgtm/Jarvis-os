const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const engine=require('./jarvis-creator-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.2');
assert.strictEqual(engine.CREATOR_PROFILE_VERSION,'2.0');
assert.strictEqual(engine.safeName('Benim Shorts / Test'),'Benim-Shorts-Test');
assert.strictEqual(engine.assetSafeName('incoming/My Clip.MP4'),'My-Clip.mp4');


const srt=engine.buildSrt('Birinci cümle burada. İkinci cümle burada ve devam ediyor.',15);
assert.ok(srt.includes('1'));
assert.ok(srt.includes('-->'));
assert.ok(srt.includes('Birinci'));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-creator-test-'));
fs.writeFileSync(path.join(tmp,'bad.txt'),Buffer.alloc(2048,1));
assert.strictEqual(engine.inspectAsset(tmp,'bad.txt').code,'CREATOR_ASSET_UNSUPPORTED_EXTENSION');
assert.strictEqual(engine.inspectAsset(tmp,'../outside.mp4').code,'CREATOR_ASSET_BAD_PATH');

const status=engine.ffmpegStatus(tmp);
assert.strictEqual(typeof status.ok,'boolean');
assert.ok(status.assetDir.includes('creator-assets'));
assert.ok(fs.existsSync(status.assetDir));

for(const name of ['a.mp4','b.mp4','c.mp4']){
  fs.writeFileSync(path.join(status.assetDir,name),Buffer.alloc(32,1));
}
const explicit=engine.resolveAssetSelection(tmp,['creator-assets/c.mp4','creator-assets/a.mp4'],5);
assert.strictEqual(explicit.length,2);
assert.ok(explicit[0].endsWith(path.join('creator-assets','c.mp4')),'explicit asset order must be preserved');
assert.ok(explicit[1].endsWith(path.join('creator-assets','a.mp4')),'explicit asset order must be preserved');
assert.throws(()=>engine.resolveAssetSelection(tmp,['creator-video/out.mp4'],5),/STORYBOARD_ASSET_SCOPE/);
assert.throws(()=>engine.resolveAssetSelection(tmp,['../outside.mp4'],5),/STORYBOARD/);

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
assert.ok(source.includes('function inspectAsset(workspace,relativePath)'),'Creator asset ffprobe inspector missing');
assert.ok(source.includes('CREATOR_ASSET_INVALID_VIDEO'),'invalid-video guard missing');
assert.ok(source.includes('CREATOR_ASSET_SYMLINK_ESCAPE'),'asset symlink escape guard missing');
assert.ok(source.includes('duration>600'),'Creator asset duration limit missing');
assert.ok(source.includes('function resolveAssetSelection(workspace,assetFiles,maxScenes=5)'),'explicit Creator asset resolver missing');
assert.ok(source.includes("assetSelection:explicitAssets?'explicit':'automatic'"),'render metadata must record asset selection mode');
assert.ok(source.includes("missionId:String(missionId||'')"),'render metadata must bind durable mission id');

console.log('CREATOR ENGINE SELFTEST PASS');
