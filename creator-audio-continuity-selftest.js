const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-audio-continuity-'));
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for audio continuity regression');

function segments(name,parts){
  const raw=path.join(workspace,name+'-raw.wav');
  const args=['-y','-hide_banner','-loglevel','error'];
  parts.forEach(part=>{
    if(part.kind==='silence')args.push('-f','lavfi','-i','anullsrc=r=48000:cl=mono:d='+part.seconds);
    else args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration='+part.seconds);
  });
  if(parts.length===1){
    args.push('-map','0:a:0','-c:a','pcm_s16le',raw);
  }else{
    const labels=parts.map((_,i)=>'['+i+':a]').join('');
    args.push('-filter_complex',labels+'concat=n='+parts.length+':v=0:a=1[out]','-map','[out]','-c:a','pcm_s16le',raw);
  }
  cp.execFileSync(status.ffmpeg,args,{timeout:60000,stdio:['ignore','pipe','pipe']});
  const mastered=path.join(workspace,name+'.wav');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error','-i',raw,
    '-af',creator.creatorAudioMasterFilter({pad:false}),
    '-c:a','pcm_s16le',mastered
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return mastered;
}

try{
  const continuous=segments('continuous',[{kind:'tone',seconds:12.2}]);
  const shortGap=segments('short-gap',[
    {kind:'tone',seconds:3},
    {kind:'silence',seconds:4.2},
    {kind:'tone',seconds:5}
  ]);
  const longGap=segments('long-gap',[
    {kind:'tone',seconds:3},
    {kind:'silence',seconds:9},
    {kind:'tone',seconds:3}
  ]);

  const good=creator.probeAudioContinuity(continuous,status.ffmpeg,{maxSilentSeconds:3});
  const shortFail=creator.probeAudioContinuity(shortGap,status.ffmpeg,{maxSilentSeconds:3});
  const shortUnderLongPolicy=creator.probeAudioContinuity(shortGap,status.ffmpeg,{maxSilentSeconds:8});
  const longFail=creator.probeAudioContinuity(longGap,status.ffmpeg,{maxSilentSeconds:8});

  assert.strictEqual(good.ok,true,'continuous mastered audio must pass');
  assert.strictEqual(shortFail.ok,false,'4.2 second gap must fail Short continuity policy');
  assert.strictEqual(shortFail.code,'CREATOR_AUDIO_DROPOUT');
  assert.ok(shortFail.maxSilenceSeconds>=4&&shortFail.maxSilenceSeconds<4.5);
  assert.strictEqual(shortUnderLongPolicy.ok,true,'4.2 second gap may pass long-form continuity policy');
  assert.strictEqual(longFail.ok,false,'9 second gap must fail long-form continuity policy');
  assert.ok(longFail.maxSilenceSeconds>=8.8);

  const combined=creator.applyRenderedAudioQuality(
    {ok:true,code:'BASE_PASS',message:'base',checks:{},measured:{}},
    shortGap,status.ffmpeg,{mode:'short'}
  );
  assert.strictEqual(combined.ok,false,'central final audio guard must reject a long Short dropout');
  assert.strictEqual(combined.checks.audioContinuity,false);
  assert.ok(combined.audioContinuity&&combined.audioContinuity.maxSilenceSeconds>=4);

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.ok(source.includes("maxSilentSeconds:longform?8:3"),'mode-specific dropout limits missing');
  assert.ok(source.includes('result.checks.audioContinuity=audioContinuity.ok'),'continuity evidence missing from quality checks');
  assert.ok(source.includes('result.measured.maxAudioSilenceSeconds=audioContinuity.maxSilenceSeconds'),'maximum silence measurement missing');
  assert.strictEqual(typeof creator.probeAudioContinuity,'function','audio continuity probe export missing');

  console.log('CREATOR AUDIO CONTINUITY V92 SELFTEST PASS',JSON.stringify({good,shortFail,shortUnderLongPolicy,longFail}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
