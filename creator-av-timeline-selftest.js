const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-av-timeline-'));
const {ffmpeg,ffprobe}=creator.ffmpegStatus(workspace);
assert.ok(ffmpeg&&ffprobe,'FFmpeg and FFprobe are required for timeline regression');
function render(name,videoSeconds,audioSeconds,width=1080,height=1920){
  const file=path.join(workspace,name+'.mp4');
  cp.execFileSync(ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i',`color=c=blue:s=${width}x${height}:r=30:d=${videoSeconds}`,
    '-f','lavfi','-i',`sine=frequency=440:sample_rate=48000:duration=${audioSeconds}`,
    '-map','0:v:0','-map','1:a:0',
    '-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','192k','-movflags','+faststart',file
  ],{timeout:90000,stdio:['ignore','pipe','pipe']});
  return file;
}
try{
  const truncatedVideo=creator.probeRenderedShort(render('short-video',1,12.2),ffprobe);
  assert.strictEqual(truncatedVideo.ok,false,'a 1-second video with 12-second audio must fail the Short gate');
  assert.strictEqual(truncatedVideo.checks.duration,true,'container duration alone must look valid in this regression');
  assert.strictEqual(truncatedVideo.checks.videoTimeline,false);
  assert.strictEqual(truncatedVideo.checks.audioTimeline,true);

  const truncatedAudio=creator.probeRenderedShort(render('short-audio',12.2,1),ffprobe);
  assert.strictEqual(truncatedAudio.ok,false,'a 12-second video with 1-second audio must fail the Short gate');
  assert.strictEqual(truncatedAudio.checks.videoTimeline,true);
  assert.strictEqual(truncatedAudio.checks.audioTimeline,false);

  const valid=creator.probeRenderedShort(render('complete',12.2,12.2),ffprobe);
  assert.strictEqual(valid.ok,true,'complete audio/video streams must still pass');
  assert.ok(valid.measured.videoDuration>=12&&valid.measured.audioDuration>=12);

  // A long AAC track is cheap to encode; no nine-minute HD render is needed
  // to reproduce the exact same container-duration blind spot in long-form.
  const long=creator.probeRenderedLongform(render('long-short-video',1,540,1920,1080),ffprobe);
  assert.strictEqual(long.checks.duration,true);
  assert.strictEqual(long.checks.size,true,'fixture must meet the existing long-form size gate');
  assert.strictEqual(long.ok,false,'nine-minute container must not hide one-second video');
  assert.strictEqual(long.checks.videoTimeline,false);
  assert.strictEqual(long.checks.audioTimeline,true);

  const coverage=creator.streamTimelineCoverage;
  assert.strictEqual(typeof coverage,'function');
  assert.strictEqual(coverage({start_time:'0',duration:'12.2'},12.2).ok,true);
  assert.strictEqual(coverage({start_time:'0.02',duration:'12.18'},12.2).ok,true,'normal encoder offsets should pass');
  assert.strictEqual(coverage({start_time:'2',duration:'10.2'},12.2).ok,false,'late stream start must fail despite matching end');
  assert.strictEqual(coverage({start_time:'-2',duration:'14.2'},12.2).ok,false,'large negative stream offset must fail');
  assert.strictEqual(coverage({start_time:'0',duration:'11'},12.2).ok,false);
  for(const stream of [{},{start_time:'0'},{start_time:'0',duration:'N/A'},{start_time:'',duration:'12.2'},{start_time:null,duration:'12.2'}]){
    assert.strictEqual(coverage(stream,12.2).ok,false,'missing stream timing must fail closed');
  }
  console.log('CREATOR AV TIMELINE SELFTEST PASS');
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
