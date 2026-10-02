const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-final-visual-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for final visual guard');

function render(name,source){
  const file=path.join(workspace,name+'.mp4');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i',source,
    '-an',
    '-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',
    '-movflags','+faststart',
    file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const moving=render('moving','testsrc2=size=320x180:rate=30:duration=12.2');
  const black=render('black','color=c=black:s=320x180:r=30:d=12.2');
  const gray=render('gray','color=c=gray:s=320x180:r=30:d=12.2');

  const movingProbe=creator.probeRenderedVisualActivity(moving,status.ffmpeg,{durationSeconds:12.2});
  const blackProbe=creator.probeRenderedVisualActivity(black,status.ffmpeg,{durationSeconds:12.2});
  const grayProbe=creator.probeRenderedVisualActivity(gray,status.ffmpeg,{durationSeconds:12.2});

  assert.strictEqual(movingProbe.ok,true,'moving rendered video must pass visual activity gate');
  assert.ok(movingProbe.activeWindows>=2,'moving output needs motion in at least two timeline windows');
  assert.strictEqual(blackProbe.ok,false,'static black output must fail visual activity gate');
  assert.strictEqual(grayProbe.ok,false,'static visible output must fail visual freeze gate');
  assert.strictEqual(blackProbe.code,'CREATOR_VISUAL_ACTIVITY_LOW');
  assert.strictEqual(movingProbe.method,'ffmpeg-frame-difference');

  const staticQuality=creator.applyRenderedVisualQuality(
    {ok:true,code:'CREATOR_QUALITY_PASS',message:'ok',checks:{},measured:{duration:12.2}},
    gray,
    status.ffmpeg,
    {mode:'short'}
  );
  assert.strictEqual(staticQuality.ok,false);
  assert.strictEqual(staticQuality.checks.visualActivity,false);
  assert.strictEqual(staticQuality.code,'CREATOR_VISUAL_ACTIVITY_LOW');
  assert.ok(staticQuality.visualActivity&&Array.isArray(staticQuality.visualActivity.windows));

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  const worker=fs.readFileSync('./worker.js','utf8');
  assert.strictEqual((source.match(/const quality=applyRenderedMediaQuality\(/g)||[]).length,2,'Short and long-form renders must both use final media guard');
  assert.strictEqual((worker.match(/creator\.applyRenderedMediaQuality\(creator\.probeRendered/g)||[]).length,2,'Short and long-form recovery must both use final media guard');
  assert.strictEqual(typeof creator.probeRenderedVisualWindow,'function');
  assert.strictEqual(typeof creator.probeRenderedVisualActivity,'function');
  assert.strictEqual(typeof creator.applyRenderedVisualQuality,'function');
  assert.strictEqual(typeof creator.applyRenderedMediaQuality,'function');

  console.log('CREATOR FINAL VISUAL GUARD V91 SELFTEST PASS',JSON.stringify({moving:movingProbe,black:blackProbe,gray:grayProbe}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
