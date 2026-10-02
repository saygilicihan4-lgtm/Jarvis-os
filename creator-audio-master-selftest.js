const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-audio-master-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for audio master regression');

const expected='apad=pad_dur=1,loudnorm=I=-16:LRA=7:TP=-1.5,aresample=48000';
assert.strictEqual(creator.creatorAudioMasterFilter(),expected);
assert.strictEqual(creator.creatorAudioMasterFilter({pad:false}),'loudnorm=I=-16:LRA=7:TP=-1.5,aresample=48000');
assert.deepStrictEqual(creator.creatorAudioMasterProfile(),{
  targetIntegratedLufs:-16,
  targetLra:7,
  targetTruePeakDb:-1.5,
  sampleRate:48000,
  method:'ffmpeg-loudnorm'
});

const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
assert.ok(source.includes("if(!soundDesign.enabled)args.push('-af',creatorAudioMasterFilter());"),'Short voice-only path must use audio master');
assert.ok(source.includes("alimiter=limit=0.95,'+creatorAudioMasterFilter({pad:false})+'[aout]"),'Short voice+SFX path must use audio master');
assert.strictEqual((source.match(/'-c:a','aac','-b:a','192k','-af',creatorAudioMasterFilter\(\),/g)||[]).length,2,'both long-form render paths must use audio master');
assert.ok(source.includes("'-c:a','aac','-b:a','160k','-af',creatorAudioMasterFilter(),"),'procedural Short path must use audio master');

function renderTone(name,volume){
  const file=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6',
    '-af','volume='+volume+','+creator.creatorAudioMasterFilter({pad:false}),
    '-c:a','pcm_s16le',file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}
function inspect(file){
  const probe=JSON.parse(cp.execFileSync(status.ffprobe,[
    '-v','error','-show_entries','stream=sample_rate:format=duration','-of','json',file
  ],{encoding:'utf8',timeout:20000}));
  const run=cp.spawnSync(status.ffmpeg,[
    '-hide_banner','-nostats','-i',file,'-map','0:a:0','-af','volumedetect','-f','null','-'
  ],{encoding:'utf8',timeout:30000});
  assert.strictEqual(run.status,0,String(run.stderr||''));
  const text=String(run.stderr||'');
  const mean=/mean_volume:\s*(-?[0-9.]+) dB/.exec(text);
  const max=/max_volume:\s*(-?[0-9.]+) dB/.exec(text);
  assert.ok(mean&&max,'volumedetect output missing');
  return{
    duration:Number(probe.format&&probe.format.duration),
    sampleRate:Number(probe.streams&&probe.streams[0]&&probe.streams[0].sample_rate),
    mean:Number(mean[1]),
    max:Number(max[1])
  };
}

try{
  const low=inspect(renderTone('low',0.02));
  const hot=inspect(renderTone('hot',2.0));
  for(const measured of [low,hot]){
    assert.ok(measured.duration>=5.9&&measured.duration<=6.2,'audio master must preserve duration');
    assert.strictEqual(measured.sampleRate,48000,'audio master must finish at 48 kHz');
    assert.ok(measured.mean>=-22&&measured.mean<=-10,'mastered audio should stay in a practical loudness band');
    assert.ok(measured.max<=-1,'mastered audio must retain headroom');
  }
  assert.ok(Math.abs(low.mean-hot.mean)<=2,'quiet and hot sources should converge after mastering');
  console.log('CREATOR AUDIO MASTER V88 SELFTEST PASS',JSON.stringify({low,hot}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
