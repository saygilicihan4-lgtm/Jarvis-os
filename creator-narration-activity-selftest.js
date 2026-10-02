const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-narration-activity-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for narration activity regression');

function audio(name,filter){
  const file=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i',filter,
    '-c:a','pcm_s16le',file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const silent=audio('silent','anullsrc=r=48000:cl=mono:d=12.2');
  const quiet=audio('quiet','sine=frequency=440:sample_rate=48000:duration=12.2,volume=0.002');
  const normal=audio('normal','sine=frequency=440:sample_rate=48000:duration=12.2,volume=0.2');

  const silentProbe=creator.probeNarrationActivity(silent,status.ffmpeg);
  const quietProbe=creator.probeNarrationActivity(quiet,status.ffmpeg);
  const normalProbe=creator.probeNarrationActivity(normal,status.ffmpeg);

  assert.strictEqual(silentProbe.ok,false,'digital silence must fail narration activity gate');
  assert.strictEqual(silentProbe.code,'CREATOR_NARRATION_SILENT');
  assert.strictEqual(quietProbe.ok,true,'very quiet but recoverable narration must pass');
  assert.strictEqual(normalProbe.ok,true,'normal narration must pass');
  assert.ok(quietProbe.maxDb>-80&&quietProbe.meanDb>-85);
  assert.strictEqual(quietProbe.method,'ffmpeg-volumedetect');

  let rejected=null;
  try{
    creator.renderShort({
      workspace,
      name:'silent-short',
      script:'This narration should never reach rendering.',
      voicePath:silent,
      assetFiles:[]
    });
  }catch(e){rejected=e}
  assert.ok(rejected,'silent narration must stop renderShort');
  assert.strictEqual(rejected.code,'CREATOR_NARRATION_SILENT');
  assert.strictEqual(rejected.narrationActivity&&rejected.narrationActivity.ok,false);
  assert.ok(!fs.existsSync(path.join(workspace,'creator-video','silent-short.mp4')),'silent narration must fail before MP4 output');

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.strictEqual((source.match(/const narrationActivity=probeNarrationActivity\(voicePath,status\.ffmpeg\);/g)||[]).length,2,'Short and long-form must both gate narration activity');
  assert.ok(source.includes('narrationActivity,\n    output:path.relative(workspace,outFile)'),'Short metadata must retain narration activity evidence');
  assert.ok(source.includes('audioMaster:creatorAudioMasterProfile(),\n    narrationActivity,\n    profile:{width:1920,height:1080'),'long-form metadata must retain narration activity evidence');

  console.log('CREATOR NARRATION ACTIVITY V89 SELFTEST PASS',JSON.stringify({silent:silentProbe,quiet:quietProbe,normal:normalProbe}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
