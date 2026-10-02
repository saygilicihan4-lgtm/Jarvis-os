const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-motion-continuity-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for motion continuity regression');

function segmented(){
  const file=path.join(workspace,'middle-freeze.mp4');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i','testsrc2=s=320x568:r=30:d=4.3',
    '-f','lavfi','-i','color=c=blue:s=320x568:r=30:d=3.6',
    '-f','lavfi','-i','testsrc2=s=320x568:r=30:d=4.3',
    '-filter_complex',
    '[0:v]setpts=PTS-STARTPTS[v0];[1:v]setpts=PTS-STARTPTS[v1];[2:v]setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0[v]',
    '-map','[v]','-an',
    '-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',
    '-movflags','+faststart',file
  ],{timeout:90000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const file=segmented();
  const result=creator.probeRenderedMotionCoverage(file,status.ffmpeg,12.2,{mode:'longform'});

  assert.strictEqual(result.sampledWindows,11,'long-form must sample eleven timeline windows');
  assert.ok(result.activeWindows>=result.requiredWindows,'fixture must reproduce the old count-based false pass');
  assert.strictEqual(result.coverageOk,true,'overall active-window count should pass in this reproducer');
  assert.ok(result.maxInactiveRun>=3,'middle freeze must form a consecutive inactive run');
  assert.strictEqual(result.maxAllowedInactiveRun,2);
  assert.strictEqual(result.continuityOk,false,'long consecutive freeze must fail continuity');
  assert.strictEqual(result.ok,false,'coverage count alone must not pass a long freeze');
  assert.strictEqual(result.code,'CREATOR_MOTION_CONTINUITY_MISSING');

  const quality=creator.applyRenderedVisualQuality(
    {ok:true,code:'BASE_PASS',message:'base',checks:{},measured:{duration:12.2}},
    file,status.ffmpeg,{mode:'longform'}
  );
  assert.strictEqual(quality.ok,false);
  assert.strictEqual(quality.checks.motionCoverage,true,'count coverage evidence should remain explicit');
  assert.strictEqual(quality.checks.motionContinuity,false,'continuity evidence must fail');
  assert.strictEqual(quality.code,'CREATOR_MOTION_CONTINUITY_MISSING');
  assert.ok(quality.measured.motionMaxInactiveRun>=3);
  assert.strictEqual(quality.measured.motionMaxAllowedInactiveRun,2);

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.ok(source.includes("Array.from({length:11}"),'long-form eleven-window sampling policy missing');
  assert.ok(source.includes("const maxAllowedInactiveRun=longform?2:1"),'continuity run limit missing');
  assert.ok(source.includes("result.checks.motionContinuity=motionCoverage.continuityOk"),'motion continuity quality evidence missing');

  console.log('CREATOR MOTION CONTINUITY V92 SELFTEST PASS',JSON.stringify(result));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
