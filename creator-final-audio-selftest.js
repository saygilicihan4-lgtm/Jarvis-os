const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-final-audio-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for final audio guard');

function tone(name,volume){
  const file=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6',
    '-af','volume='+volume,
    '-c:a','pcm_s16le',file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}
function master(input,name){
  const file=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error','-i',input,
    '-af',creator.creatorAudioMasterFilter({pad:false}),
    '-c:a','pcm_s16le',file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const rawQuiet=tone('raw-quiet',0.0002);
  const mastered=master(rawQuiet,'mastered-quiet');

  const rawProbe=creator.probeRenderedAudioLoudness(rawQuiet,status.ffmpeg);
  const masteredProbe=creator.probeRenderedAudioLoudness(mastered,status.ffmpeg);

  assert.strictEqual(rawProbe.ok,false,'very quiet unmastered output must fail loudness gate');
  assert.strictEqual(rawProbe.code,'CREATOR_AUDIO_LOUDNESS_OUT_OF_RANGE');
  assert.strictEqual(masteredProbe.ok,true,'mastered audio must pass final loudness gate');
  assert.ok(masteredProbe.integratedLufs>=-19&&masteredProbe.integratedLufs<=-13,'mastered integrated loudness must stay near -16 LUFS');
  assert.ok(masteredProbe.truePeakDb<=-0.5,'mastered true peak must retain headroom');
  assert.strictEqual(masteredProbe.targetLufs,-16);
  assert.strictEqual(masteredProbe.method,'ffmpeg-loudnorm-analysis');

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.strictEqual((source.match(/const outputLoudness=probeRenderedAudioLoudness\(outFile,status\.ffmpeg\);/g)||[]).length,2,'Short and long-form must both verify final loudness');
  assert.strictEqual((source.match(/quality\.checks\.audioLoudness=outputLoudness\.ok;/g)||[]).length,2,'quality payload must record loudness gate');
  assert.strictEqual((source.match(/quality\.measured\.audioIntegratedLufs=outputLoudness\.integratedLufs;/g)||[]).length,2,'quality payload must retain measured LUFS');
  assert.strictEqual((source.match(/quality\.measured\.audioTruePeakDb=outputLoudness\.truePeakDb;/g)||[]).length,2,'quality payload must retain true peak');
  assert.strictEqual(typeof creator.probeRenderedAudioLoudness,'function','final loudness probe export missing');

  console.log('CREATOR FINAL AUDIO GUARD V90 SELFTEST PASS',JSON.stringify({raw:rawProbe,mastered:masteredProbe}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
