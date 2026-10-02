const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-audio-signal-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg + FFprobe required for narration signal regression');

function wav(name,source){
  const file=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i',source,
    '-t','12.2','-ar','48000','-ac','2','-c:a','pcm_s16le',file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const silent=wav('silent','anullsrc=r=48000:cl=stereo');
  const audible=wav('audible','sine=frequency=440:sample_rate=48000');

  const silentProbe=creator.probeAudioSignal(silent,status.ffmpeg);
  assert.strictEqual(silentProbe.ok,false,'digital silence must fail Creator audio signal gate');
  assert.strictEqual(silentProbe.code,'CREATOR_AUDIO_SIGNAL_MISSING');
  assert.ok(silentProbe.meanDb===-Infinity||silentProbe.meanDb<-80,'silence evidence should be far below threshold');

  const audibleProbe=creator.probeAudioSignal(audible,status.ffmpeg);
  assert.strictEqual(audibleProbe.ok,true,'audible narration must pass Creator audio signal gate');
  assert.ok(audibleProbe.meanDb>=-55);
  assert.ok(audibleProbe.peakDb>=-40);

  let silentError=null;
  try{
    creator.renderShort({
      workspace,
      name:'silent-narration-regression',
      script:'Bu test teknik olarak geçerli fakat sessiz bir anlatım kaynağını reddetmelidir.',
      voicePath:silent,
      assetFiles:[]
    });
  }catch(e){silentError=e}
  assert.ok(silentError,'silent narration must fail before a Short can be accepted');
  assert.strictEqual(silentError.code,'CREATOR_NARRATION_SIGNAL_MISSING');
  assert.ok(silentError.audioSignal&&silentError.audioSignal.ok===false);

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.strictEqual((source.match(/const narrationSignal=probeAudioSignal\(voicePath,status\.ffmpeg\);/g)||[]).length,2,'Short and long-form must both preflight narration signal');
  assert.strictEqual((source.match(/const outputSignal=probeAudioSignal\(outFile,status\.ffmpeg\);/g)||[]).length,2,'Short and long-form must both verify final audio signal');
  assert.strictEqual((source.match(/quality\.checks\.audioSignal=outputSignal\.ok;/g)||[]).length,2,'final audio signal evidence must be retained in both quality payloads');
  assert.ok(source.includes("quality.code='CREATOR_AUDIO_SIGNAL_MISSING'"),'final silent output must fail closed');

  console.log('CREATOR NARRATION SIGNAL V89 SELFTEST PASS',JSON.stringify({
    silent:{meanDb:silentProbe.meanDb,peakDb:silentProbe.peakDb},
    audible:{meanDb:audibleProbe.meanDb,peakDb:audibleProbe.peakDb}
  }));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
