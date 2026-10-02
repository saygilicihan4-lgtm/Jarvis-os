const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-asset-resolution-'));
const assetDir=path.join(workspace,'creator-assets');
fs.mkdirSync(assetDir,{recursive:true});
const status=creator.ffmpegStatus(workspace);
assert.ok(status.ffmpeg&&status.ffprobe,'FFmpeg and FFprobe are required for asset resolution regression');

function asset(name,size){
  const file=path.join(assetDir,name+'.mp4');
  cp.execFileSync(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i','testsrc2=size='+size+':rate=30',
    '-t','2','-an',
    '-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',
    file
  ],{timeout:60000,stdio:['ignore','pipe','pipe']});
  return file;
}

try{
  const low=asset('low-240p','320x240');
  const acceptable=asset('acceptable-480p','640x480');
  const preferred=asset('preferred-720p','1280x720');

  const lowProbe=creator.inspectAsset(workspace,'creator-assets/low-240p.mp4');
  const acceptableProbe=creator.inspectAsset(workspace,'creator-assets/acceptable-480p.mp4');
  const preferredProbe=creator.inspectAsset(workspace,'creator-assets/preferred-720p.mp4');

  assert.strictEqual(lowProbe.ok,true,'video decoding itself should still be valid');
  assert.strictEqual(lowProbe.resolution.ok,false,'240p-class asset must be below Creator quality floor');
  assert.strictEqual(lowProbe.resolution.tier,'low');
  assert.strictEqual(acceptableProbe.resolution.ok,true,'480p-class asset must remain usable');
  assert.strictEqual(acceptableProbe.resolution.preferred,false);
  assert.strictEqual(acceptableProbe.resolution.tier,'acceptable');
  assert.strictEqual(preferredProbe.resolution.ok,true);
  assert.strictEqual(preferredProbe.resolution.preferred,true,'720p-class asset should be preferred');
  assert.strictEqual(preferredProbe.resolution.tier,'preferred');

  const preflight=creator.preflightAssetSelection(workspace,[low,acceptable,preferred],{maxScenes:5});
  assert.strictEqual(preflight.assets.length,2,'low resolution asset must be removed before render');
  assert.ok(preflight.assets[0].endsWith(path.join('creator-assets','acceptable-480p.mp4')),'accepted asset order must remain stable');
  assert.ok(preflight.assets[1].endsWith(path.join('creator-assets','preferred-720p.mp4')),'preferred asset should remain available');
  assert.strictEqual(preflight.evidence.candidates,3);
  assert.strictEqual(preflight.evidence.accepted,2);
  assert.strictEqual(preflight.evidence.rejected,1);
  assert.strictEqual(preflight.evidence.rejectedAssets[0].code,'CREATOR_ASSET_RESOLUTION_LOW');

  const allLow=creator.preflightAssetSelection(workspace,[low],{maxScenes:5});
  assert.deepStrictEqual(allLow.assets,[],'all-low asset set must allow procedural fallback rather than poor B-roll');
  assert.strictEqual(allLow.evidence.rejected,1);

  const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');
  assert.ok(source.includes("const assetCandidates=explicitAssets?resolveAssetSelection(workspace,assetFiles,5):selectAssets(workspace,base,24)"),'Short preflight candidate expansion missing');
  assert.ok(source.includes("const assetPreflight=preflightAssetSelection(workspace,assetCandidates,{maxScenes:5})"),'Short asset preflight missing');
  assert.ok(source.includes("const assetPreflight=preflightAssetSelection(workspace,assetCandidates,{maxScenes:explicitAssets?20:12})"),'long-form asset preflight missing');
  assert.ok(source.includes('assetPreflight:assetPreflight.evidence'),'asset preflight metadata evidence missing');

  console.log('CREATOR ASSET RESOLUTION V94 SELFTEST PASS',JSON.stringify({low:lowProbe.resolution,acceptable:acceptableProbe.resolution,preferred:preferredProbe.resolution,evidence:preflight.evidence}));
}finally{
  fs.rmSync(workspace,{recursive:true,force:true});
}
