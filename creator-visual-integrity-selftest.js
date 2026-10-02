const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-visual-integrity-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for visual integrity regression');

function video(name,source){
  const file=path.join(workspace,name+'.mp4');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i',source,
    '-an','-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',
    '-movflags','+faststart',file
  ],{timeout:90000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const black=video('black','color=c=black:s=320x568:r=30:d=12.2');
  const white=video('white','color=c=white:s=320x568:r=30:d=12.2');
  const darkValid=video('dark-valid','color=c=0x101820:s=320x568:r=30:d=12.2');
  const moving=video('moving','testsrc2=s=320x568:r=30:d=12.2');

  const blackWindow=creator.probeRenderedExposureWindow(black,status.ffmpeg,{start:2,seconds:1.1,fps:2});
  const whiteWindow=creator.probeRenderedExposureWindow(white,status.ffmpeg,{start:2,seconds:1.1,fps:2});
  const darkWindow=creator.probeRenderedExposureWindow(darkValid,status.ffmpeg,{start:2,seconds:1.1,fps:2});
  const movingWindow=creator.probeRenderedExposureWindow(moving,status.ffmpeg,{start:2,seconds:1.1,fps:2});

  assert.strictEqual(blackWindow.ok,false,'full black window must fail');
  assert.strictEqual(blackWindow.nearBlack,true);
  assert.strictEqual(blackWindow.code,'CREATOR_VISUAL_NEAR_BLACK');
  assert.strictEqual(whiteWindow.ok,false,'full white window must fail');
  assert.strictEqual(whiteWindow.nearWhite,true);
  assert.strictEqual(whiteWindow.code,'CREATOR_VISUAL_NEAR_WHITE');
  assert.strictEqual(darkWindow.ok,true,'dark but non-blank content must not be rejected');
  assert.strictEqual(movingWindow.ok,true,'normal moving content must pass exposure window');

  const blackShort=creator.probeRenderedVisualIntegrity(black,status.ffmpeg,12.2,{mode:'short'});
  const whiteShort=creator.probeRenderedVisualIntegrity(white,status.ffmpeg,12.2,{mode:'short'});
  const movingShort=creator.probeRenderedVisualIntegrity(moving,status.ffmpeg,12.2,{mode:'short'});
  const movingLong=creator.probeRenderedVisualIntegrity(moving,status.ffmpeg,12.2,{mode:'longform'});

  assert.strictEqual(blackShort.ok,false);
  assert.strictEqual(blackShort.nearBlackWindows,4);
  assert.strictEqual(whiteShort.ok,false);
  assert.strictEqual(whiteShort.nearWhiteWindows,4);
  assert.strictEqual(movingShort.ok,true);
  assert.strictEqual(movingShort.usableWindows,4);
  assert.strictEqual(movingLong.ok,true);
  assert.strictEqual(movingLong.sampledWindows,5);
  assert.ok(movingLong.usableWindows>=movingLong.requiredWindows);

  const quality=creator.applyRenderedVisualQuality(
    {ok:true,code:'BASE_PASS',message:'base',checks:{},measured:{duration:12.2}},
    moving,status.ffmpeg,{mode:'short'}
  );
  assert.strictEqual(quality.ok,true,'normal moving render must pass combined visual quality');
  assert.strictEqual(quality.checks.visualIntegrity,true);
  assert.ok(quality.visualIntegrity&&quality.visualIntegrity.ok);
  assert.ok(Number.isFinite(quality.measured.visualUsableWindows));

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.ok(source.includes('result.checks.visualIntegrity=visualIntegrity.ok'),'visual integrity evidence missing from quality payload');
  assert.ok(source.includes('result.measured.visualNearBlackWindows=visualIntegrity.nearBlackWindows'),'near-black measurement missing');
  assert.ok(source.includes('result.measured.visualNearWhiteWindows=visualIntegrity.nearWhiteWindows'),'near-white measurement missing');

  console.log('CREATOR VISUAL INTEGRITY V93 SELFTEST PASS',JSON.stringify({blackWindow,whiteWindow,darkWindow,movingWindow,blackShort,whiteShort,movingShort,movingLong}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
