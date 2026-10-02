const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const source=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_short_kinetic_captions_v1'"),'Short kinetic caption capability missing');
assert.ok(worker.includes("creatorKineticCaptionsReady:CAPS.includes('creator_short_kinetic_captions_v1')"),'PC acceptance kinetic-caption readiness missing');
assert.strictEqual(typeof creator.buildShortAss,'function','buildShortAss export missing');

const ass=creator.buildShortAss(
  'Bu robot sandığından daha hızlı öğreniyor ve birkaç saniye içinde hareketini değiştiriyor.',
  15
);
assert.ok(ass.includes('[V4+ Styles]'),'ASS style section missing');
assert.ok(ass.includes('[Events]'),'ASS events section missing');
assert.ok((ass.match(/^Dialogue:/gm)||[]).length>=2,'Short ASS should use multiple timed caption beats');
assert.ok(ass.includes('\\fad(55,85)'),'caption fade animation missing');
assert.ok(ass.includes('\\fscx118\\fscy118'),'caption pop scale missing');
assert.ok(ass.includes('\\t(0,170,\\fscx100\\fscy100)'),'caption settle animation missing');
assert.ok(ass.includes('\\pos(540,1640)'),'caption vertical-safe position missing');
assert.ok(ass.includes('PlayResX: 1080')&&ass.includes('PlayResY: 1920'),'Short ASS canvas profile missing');

const renderStart=source.indexOf('function renderShort(');
const renderEnd=source.indexOf('function renderLongform(',renderStart);
assert.ok(renderStart>0&&renderEnd>renderStart,'renderShort block missing');
const shortBlock=source.slice(renderStart,renderEnd);
assert.ok(shortBlock.includes("const assFile=path.join(jobDir,base+'.ass')"),'Short ASS artifact path missing');
assert.ok(shortBlock.includes("fs.writeFileSync(assFile,buildShortAss(cleanScript,duration),'utf8')"),'Short ASS generation missing');
assert.ok(shortBlock.includes('ffmpegFilterPath(assFile)'),'Short burn-in must use kinetic ASS file');
assert.ok(shortBlock.includes("captionAnimation:captionsBurned?'pop-fade':'none'"),'caption animation evidence missing');
assert.ok(shortBlock.includes("captions:'kinetic-pop-fade'"),'Short profile kinetic-caption metadata missing');
assert.ok(shortBlock.includes('burnedSubtitle:path.relative(workspace,assFile)'),'burned ASS metadata missing');
assert.ok(shortBlock.includes('subtitle:path.relative(workspace,srtFile)'),'plain SRT export must remain');
assert.ok(!shortBlock.includes("force_style='FontName=Arial,FontSize=22"),'legacy static Short force_style should be removed');

const longStart=source.indexOf('function renderLongform(');
const longBlock=source.slice(longStart);
assert.ok(longBlock.includes('ffmpegFilterPath(srtFile)'),'long-form must keep existing SRT burn behavior');
assert.ok(longBlock.includes("force_style='FontName=Arial,FontSize=26"),'long-form subtitle styling must remain unchanged');

for(const cap of [
  'creator_narrative_visual_sync_v1',
  'creator_scene_web_queries_v1',
  'creator_short_motion_rhythm_v1',
  'creator_quality_gate_v1'
]){
  assert.ok(worker.includes("'"+cap+"'"),cap+' regressed');
}
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SHORT KINETIC CAPTIONS V78 SELFTEST PASS');
