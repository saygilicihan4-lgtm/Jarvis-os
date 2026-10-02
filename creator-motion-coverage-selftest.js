const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-motion-coverage-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for motion coverage regression');

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
  const staticVideo=video('static','color=c=blue:s=320x568:r=30:d=12.2');
  const movingVideo=video('moving','testsrc2=s=320x568:r=30:d=12.2');

  const staticShort=creator.probeRenderedMotionCoverage(staticVideo,status.ffmpeg,12.2,{mode:'short'});
  const movingShort=creator.probeRenderedMotionCoverage(movingVideo,status.ffmpeg,12.2,{mode:'short'});
  const staticLong=creator.probeRenderedMotionCoverage(staticVideo,status.ffmpeg,12.2,{mode:'longform'});
  const movingLong=creator.probeRenderedMotionCoverage(movingVideo,status.ffmpeg,12.2,{mode:'longform'});

  assert.strictEqual(staticShort.ok,false,'full-duration static video must fail Short motion coverage');
  assert.strictEqual(movingShort.ok,true,'moving video must pass Short motion coverage');
  assert.ok(movingShort.activeWindows>=movingShort.requiredWindows);
  assert.strictEqual(staticLong.ok,false,'static video must fail long-form sampling policy');
  assert.strictEqual(movingLong.ok,true,'moving video must pass long-form sampling policy');
  assert.strictEqual(movingLong.sampledWindows,5);
  assert.strictEqual(movingShort.sampledWindows,4);

  const good=creator.applyRenderedVisualQuality(
    {ok:true,code:'BASE_PASS',message:'base',checks:{},measured:{duration:12.2}},
    movingVideo,status.ffmpeg,{mode:'short'}
  );
  assert.strictEqual(good.ok,true);
  assert.strictEqual(good.checks.motionCoverage,true);
  assert.ok(good.motionCoverage&&good.motionCoverage.ok);

  const frozen=creator.applyRenderedVisualQuality(
    {ok:true,code:'BASE_PASS',message:'base',checks:{},measured:{duration:12.2}},
    staticVideo,status.ffmpeg,{mode:'short'}
  );
  assert.strictEqual(frozen.ok,false);
  assert.strictEqual(frozen.code,'CREATOR_MOTION_COVERAGE_MISSING');
  assert.strictEqual(frozen.checks.motionCoverage,false);

  const baseFailure=creator.applyRenderedVisualQuality(
    {ok:false,code:'BASE_FAIL',message:'base fail',checks:{},measured:{duration:12.2}},
    movingVideo,status.ffmpeg,{mode:'short'}
  );
  assert.strictEqual(baseFailure.ok,false,'visual pass must not erase an earlier quality failure');
  assert.strictEqual(baseFailure.code,'BASE_FAIL');

  const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  const worker=fs.readFileSync('./worker.js','utf8');
  assert.ok(engine.includes("applyRenderedVisualQuality(quality,outFile,status.ffmpeg,{mode:'short'})"),'Short render motion gate missing');
  assert.ok(engine.includes("applyRenderedVisualQuality(quality,outFile,status.ffmpeg,{mode:'longform'})"),'long-form render motion gate missing');
  assert.ok(worker.includes("creator.applyRenderedVisualQuality(quality,expected,status.ffmpeg,{mode:'short'})"),'Short recovery motion gate missing');
  assert.ok(worker.includes("creator.applyRenderedVisualQuality(quality,expected,status.ffmpeg,{mode:'longform'})"),'long-form recovery motion gate missing');

  console.log('CREATOR MOTION COVERAGE V91 SELFTEST PASS',JSON.stringify({staticShort,movingShort,staticLong,movingLong}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
