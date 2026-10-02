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
  const recoverable=audio('recoverable','sine=frequency=440:sample_rate=48000:duration=12.2,volume=0.02');
  const normal=audio('normal','sine=frequency=440:sample_rate=48000:duration=12.2,volume=0.2');
  function master(source,name){
    const out=path.join(workspace,name+'.wav');
    cp.execFileSync(status.ffmpeg,[
      '-y','-hide_banner','-loglevel','error','-i',source,
      '-af',creator.creatorAudioMasterFilter({pad:false}),
      '-c:a','pcm_s16le',out
    ],{timeout:60000,stdio:['ignore','pipe','pipe']});
    return out;
  }
  const masteredQuiet=master(quiet,'mastered-quiet');
  const masteredRecoverable=master(recoverable,'mastered-recoverable');

  const silentProbe=creator.probeNarrationActivity(silent,status.ffmpeg);
  const quietProbe=creator.probeNarrationActivity(quiet,status.ffmpeg);
  const recoverableProbe=creator.probeNarrationActivity(recoverable,status.ffmpeg);
  const normalProbe=creator.probeNarrationActivity(normal,status.ffmpeg);
  const quietFinalProbe=creator.probeNarrationActivity(masteredQuiet,status.ffmpeg,{minMeanDb:-45,minPeakDb:-30});
  const recoverableFinalProbe=creator.probeNarrationActivity(masteredRecoverable,status.ffmpeg,{minMeanDb:-45,minPeakDb:-30});
  const silentFinalProbe=creator.probeNarrationActivity(silent,status.ffmpeg,{minMeanDb:-45,minPeakDb:-30});

  assert.strictEqual(silentProbe.ok,false,'digital silence must fail narration activity gate');
  assert.strictEqual(silentProbe.code,'CREATOR_NARRATION_SILENT');
  assert.strictEqual(quietProbe.ok,true,'very quiet activity should pass the permissive source-presence gate');
  assert.strictEqual(recoverableProbe.ok,true,'recoverable low narration must pass source activity gate');
  assert.strictEqual(normalProbe.ok,true,'normal narration must pass');
  assert.strictEqual(quietFinalProbe.ok,false,'activity that remains unusably quiet after mastering must fail final output gate');
  assert.strictEqual(recoverableFinalProbe.ok,true,'recoverable low narration must pass after mastering');
  assert.strictEqual(silentFinalProbe.ok,false,'silent final audio must fail stricter output activity gate');
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
  assert.strictEqual((source.match(/const outputAudioActivity=probeNarrationActivity\(outFile,status\.ffmpeg,\{minMeanDb:-45,minPeakDb:-30\}\);/g)||[]).length,2,'Short and long-form must both verify final mastered audio activity');
  assert.strictEqual((source.match(/quality\.checks\.audioSignal=outputAudioActivity\.ok;/g)||[]).length,2,'final audio activity evidence must be retained in quality payloads');

  console.log('CREATOR NARRATION ACTIVITY V90 SELFTEST PASS',JSON.stringify({silent:silentProbe,quiet:quietProbe,recoverable:recoverableProbe,normal:normalProbe,quietFinal:quietFinalProbe,recoverableFinal:recoverableFinalProbe}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
