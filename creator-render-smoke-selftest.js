const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

function command(name){
  try{
    const out=cp.execFileSync(process.platform==='win32'?'where':'which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return out.split(/\r?\n/)[0]||null;
  }catch(_){return null}
}
function run(file,args,timeout=120000){
  return cp.execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout,maxBuffer:16*1024*1024});
}

const ffmpeg=command('ffmpeg');
const ffprobe=command('ffprobe');
assert.ok(ffmpeg,'ffmpeg required for Creator render smoke test');
assert.ok(ffprobe,'ffprobe required for Creator render smoke test');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-render-smoke-'));
const assetDir=path.join(workspace,'creator-assets');
fs.mkdirSync(assetDir,{recursive:true});

const a=path.join(assetDir,'smoke-a.mp4');
const b=path.join(assetDir,'smoke-b.mp4');
const voice=path.join(workspace,'voice.wav');

run(ffmpeg,[
  '-y','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','testsrc2=size=360x640:rate=30',
  '-t','5',
  '-c:v','libx264','-preset','ultrafast','-crf','28','-pix_fmt','yuv420p',
  a
]);
run(ffmpeg,[
  '-y','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','smptebars=size=360x640:rate=30',
  '-t','5',
  '-c:v','libx264','-preset','ultrafast','-crf','28','-pix_fmt','yuv420p',
  b
]);
run(ffmpeg,[
  '-y','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=44100',
  '-t','12.2',
  '-c:a','pcm_s16le',
  voice
]);

const status=creator.ffmpegStatus(workspace);
assert.strictEqual(status.ok,true,'Creator engine must find ffmpeg');
assert.ok(status.ffprobe,'Creator engine must find ffprobe');

const out=creator.renderShort({
  workspace,
  name:'render-smoke',
  script:'İlk saniyede gerçek hareket başlıyor. JARVIS sahneleri değiştiriyor ve altyazıları ritmik biçimde ekrana getiriyor.',
  voicePath:voice,
  assetFiles:['creator-assets/smoke-a.mp4','creator-assets/smoke-b.mp4'],
  assetHashes:[],
  missionId:'creator-render-smoke-v82'
});

assert.strictEqual(out.ok,true,'renderShort must succeed');
assert.ok(fs.existsSync(out.output),'rendered MP4 missing');
assert.ok(fs.statSync(out.output).size>10000,'rendered MP4 too small');
assert.ok(fs.existsSync(out.subtitle),'plain SRT sidecar missing');
assert.ok(fs.existsSync(out.burnedSubtitle),'kinetic ASS subtitle artifact missing');
assert.strictEqual(out.captionsBurned,true,'kinetic captions must actually be burned in CI');
assert.strictEqual(out.captionAnimation,'pop-fade','kinetic caption animation evidence missing');
assert.ok(out.sceneCount>=4,'Short smoke render must use paced multi-scene editing');
assert.ok(out.visualEdit&&out.visualEdit.ok===true,'visual edit gate must pass');

const probe=creator.probeRenderedShort(out.output,status.ffprobe);
assert.strictEqual(probe.ok,true,'rendered MP4 must pass Creator quality gate');
assert.strictEqual(probe.measured.width,1080,'render width mismatch');
assert.strictEqual(probe.measured.height,1920,'render height mismatch');
assert.ok(Math.abs(probe.measured.fps-30)<=0.05,'render FPS mismatch');
assert.strictEqual(String(probe.measured.videoCodec).toLowerCase(),'h264','render codec mismatch');
assert.strictEqual(probe.checks.audio,true,'render audio stream missing');
assert.ok(probe.measured.duration>=11.8&&probe.measured.duration<=18.8,'render duration outside Shorts gate');

const meta=JSON.parse(fs.readFileSync(out.metadata,'utf8'));
assert.strictEqual(meta.missionId,'creator-render-smoke-v82','mission binding missing');
assert.strictEqual(meta.captionAnimation,'pop-fade','metadata kinetic caption evidence missing');
assert.strictEqual(meta.profile.captions,'kinetic-pop-fade','profile kinetic caption evidence missing');
assert.strictEqual(meta.profile.motion,'dynamic-pan-crop','motion profile missing');
assert.ok(Array.isArray(meta.storyboard)&&meta.storyboard.length>=4,'storyboard metadata missing');
assert.strictEqual(meta.quality.ok,true,'stored quality evidence missing');

console.log('CREATOR REAL RENDER SMOKE V82 PASS · '+out.output);
