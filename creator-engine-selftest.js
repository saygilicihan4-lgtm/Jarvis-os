const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const engine=require('./jarvis-creator-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.4');
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
const shortBoard=engine.buildShortStoryboard(selected.slice(0,1),15,0.18,3.2,7);
assert.ok(shortBoard.length>=4,'single asset should be cut into multiple short scenes');
assert.ok(shortBoard.every(x=>x.duration<=4.5),'Short scenes should stay under edit-rhythm cap');
assert.ok(new Set(shortBoard.map(x=>x.sourceOffset)).size>1,'reused Short asset should use varied source offsets');
assert.ok(new Set(shortBoard.map(x=>x.transition).filter(Boolean)).size>1,'Short transitions should be varied');
assert.ok(engine.ffmpegFilterPath(path.join(tmp,'creator jobs','x.srt')).includes('/'),'filter path must normalize separators');

const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
assert.ok(source.includes('xfade=transition='),'multi-scene transition missing');
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
assert.ok(source.includes('function probeRenderedShort(file,ffprobe)'),'Creator render quality probe missing');
assert.ok(source.includes("codec:String(video&&video.codec_name||'').toLowerCase()==='h264'"),'H.264 quality check missing');
assert.ok(source.includes("width:Number(video&&video.width)===1080"),'1080 width quality check missing');
assert.ok(source.includes("height:Number(video&&video.height)===1920"),'1920 height quality check missing');
assert.ok(source.includes("Math.abs(fps-30)<=0.05"),'30 FPS quality check missing');
assert.ok(source.includes("duration>=11.8&&duration<=18.8"),'Shorts duration quality check missing');
assert.ok(source.includes("audio:!!audio"),'audio stream quality check missing');
assert.strictEqual(typeof engine.thumbnailTitleLines,'function','thumbnail title helper export missing');
assert.strictEqual(typeof engine.createThumbnail,'function','thumbnail renderer export missing');
assert.strictEqual(typeof engine.buildShortSfxEvents,'function','Short SFX event planner export missing');
assert.strictEqual(typeof engine.renderShortSfxBed,'function','Short SFX renderer export missing');
assert.ok(source.includes("const quality=applyRenderedAudioQuality(")&&source.includes("probeRenderedShort(outFile,status.ffprobe)"),'post-render technical + final audio gate missing');
assert.strictEqual(typeof engine.applyRenderedAudioQuality,'function','final audio quality helper export missing');
assert.strictEqual(typeof engine.applyRenderedVisualQuality,'function','final visual quality helper export missing');
assert.strictEqual(typeof engine.probeRenderedVisualIntegrity,'function','visual integrity probe export missing');
assert.ok(source.includes("quality,\n    visualEdit,\n    thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null,\n    thumbnailTitleBurned:!!(thumbnail&&thumbnail.ok&&thumbnail.titleBurned),\n    soundDesign,\n    audioMaster:creatorAudioMasterProfile(),\n    narrationActivity,\n    output:path.relative(workspace,outFile)"),'quality + visual edit + thumbnail + sound design + audio master + narration activity metadata missing');
assert.strictEqual(typeof engine.probeNarrationActivity,'function','narration activity probe export missing');
assert.strictEqual(typeof engine.creatorAudioMasterFilter,'function','audio master filter export missing');
assert.strictEqual(typeof engine.creatorAudioMasterProfile,'function','audio master profile export missing');

console.log('CREATOR ENGINE SELFTEST PASS');
