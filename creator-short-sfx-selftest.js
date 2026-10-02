const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_short_sfx_v1'"),'Creator Short SFX capability missing');
assert.ok(worker.includes("creatorShortSfxReady:CAPS.includes('creator_short_sfx_v1')"),'PC acceptance Short SFX readiness missing');
assert.ok(worker.includes("soundDesign:out.soundDesign||null"),'mission Short SFX artifact binding missing');

assert.strictEqual(typeof creator.buildShortSfxEvents,'function','Short SFX planner export missing');
assert.strictEqual(typeof creator.renderShortSfxBed,'function','Short SFX bed renderer export missing');

const board=creator.buildShortStoryboard(['/tmp/a.mp4','/tmp/b.mp4'],15,0.18,3.2,7,0.9);
const events=creator.buildShortSfxEvents(board,15,5);
assert.ok(events.length>=2&&events.length<=5,'Short SFX events must stay bounded');
assert.strictEqual(events[0].kind,'impact','first Short SFX must be hook impact');
assert.strictEqual(events[0].time,0.03,'hook impact timing changed');
assert.ok(events.slice(1).every(x=>x.kind==='whoosh'),'transition SFX must use whoosh profile');
assert.ok(events.slice(1).every(x=>x.time>=0.35&&x.time<14.82),'transition SFX timing out of bounds');
assert.ok(events.every(x=>x.level<=0.05),'SFX must remain well below narration level');

assert.ok(engine.includes("anoisesrc=color=pink:sample_rate=48000:duration=0.24"),'procedural whoosh source missing');
assert.ok(engine.includes("sine=frequency=118:sample_rate=48000:duration=0.20"),'procedural impact source missing');
assert.ok(engine.includes("alimiter=limit=0.45[sfx]"),'SFX bed limiter missing');
assert.ok(engine.includes("amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,'+creatorAudioMasterFilter({pad:false})+'[aout]"),'voice/SFX mix limiter + audio master missing');
assert.ok(engine.includes("profile:'voice-only-fallback'"),'SFX fail-open voice-only fallback missing');
assert.ok(engine.includes("if(!soundDesign.enabled)args.push('-af',creatorAudioMasterFilter())"),'voice-only mastered fallback path missing');
assert.ok(engine.includes("sfx:'procedural-impact-whoosh'"),'Short profile SFX metadata missing');
assert.ok(!engine.includes('http://')&&!engine.includes('https://'),'Creator engine SFX must not depend on internet media');

assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR SHORT SFX V87 SELFTEST PASS');
