const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const web=require('./jarvis-creator-web-media');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_real_motion_hook_v1'"),'real-motion hook capability missing');
assert.ok(worker.includes("creatorRealMotionHookReady:CAPS.includes('creator_real_motion_hook_v1')"),'PC acceptance real-motion hook readiness missing');
assert.ok(worker.includes('hookMediaKind'),'auto-web hook evidence missing');

const start=worker.indexOf("function creatorOrderRealMotionHookAssets(paths,mediaKinds,orientation='portrait')");
const end=worker.indexOf("function creatorPreferRealMotionHookAssets",start);
assert.ok(start>0&&end>start,'pure real-motion hook ordering helper missing');
const fnSource=worker.slice(start,end);
const order=Function(fnSource+'; return creatorOrderRealMotionHookAssets;')();

const paths=[
  'creator-assets/still-a.mp4',
  'creator-assets/video-a.mp4',
  'creator-assets/still-b.mp4',
  'creator-assets/video-b.mp4'
];
const kinds=new Map([
  ['creator-assets/still-a.mp4','animated_still'],
  ['creator-assets/video-a.mp4','video'],
  ['creator-assets/still-b.mp4','animated_still'],
  ['creator-assets/video-b.mp4','video']
]);
assert.deepStrictEqual(
  order(paths,kinds,'portrait'),
  ['creator-assets/video-a.mp4','creator-assets/video-b.mp4','creator-assets/still-a.mp4','creator-assets/still-b.mp4'],
  'portrait auto-web hooks must prefer real video'
);
assert.deepStrictEqual(
  order(paths,kinds,'landscape'),
  paths,
  'landscape/long-form order must remain unchanged'
);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-motion-hook-test-'));
const manifestDir=path.join(tmp,'creator-web-media');
fs.mkdirSync(manifestDir,{recursive:true});
fs.writeFileSync(path.join(manifestDir,'manifest-test.json'),JSON.stringify({
  items:[
    {
      path:'creator-assets/video-a.mp4',
      source:{provider:'wikimedia',title:'Real video',license:'CC0 1.0'}
    },
    {
      path:'creator-assets/still-a.mp4',
      derived:{kind:'animated_still',sourcePath:'creator-web-images/source.jpg'},
      source:{provider:'wikimedia',title:'Animated still',license:'CC0 1.0'}
    }
  ]
},null,2),'utf8');
const records=web.sourceRecordsForAssets(tmp,paths);
const byPath=new Map(records.map(x=>[x.path,x.mediaKind]));
assert.strictEqual(byPath.get('creator-assets/video-a.mp4'),'video','native web video mediaKind missing');
assert.strictEqual(byPath.get('creator-assets/still-a.mp4'),'animated_still','animated still mediaKind missing');

const autoStart=worker.indexOf('async function creatorAutoWebAssets');
const autoEnd=worker.indexOf('function creatorYoutubeDescription',autoStart);
const autoBlock=worker.slice(autoStart,autoEnd);
assert.ok(autoBlock.includes('const motionOrdered=creatorPreferRealMotionHookAssets(freshOrdered,orientation)'),'real-motion hook order must run after freshness');
assert.ok(autoBlock.includes('creatorPreferUnseenAssetPaths(motionOrdered,batchExcluded,wanted)'),'later diversity ordering must preserve real-motion hook stage');
assert.ok(autoBlock.includes("hookMediaKind=String(row&&row.mediaKind||'unknown')"),'hook media kind evidence lookup missing');

const shortMission=worker.slice(worker.indexOf('function createCreatorShortMission'),worker.indexOf('function createCreatorLongformMission'));
assert.ok(shortMission.includes('creatorAssets=normalizeCreatorStoryboardAssets(args.creatorAssets)'),'explicit Short asset normalization missing');
assert.ok(!shortMission.includes('creatorPreferRealMotionHookAssets'),'explicit user asset order must not be reordered');

for(const cap of [
  'creator_web_freshness_v1',
  'creator_short_kinetic_captions_v1',
  'creator_narrative_visual_sync_v1',
  'creator_scene_web_queries_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR REAL MOTION HOOK V80 SELFTEST PASS');
