const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_longform_duration_fit_v1'"),'duration fit capability missing');
assert.ok(worker.includes("function normalizeCreatorTtsRate(value=CREATOR_TTS_RATE)"),'Creator TTS rate guard missing');
assert.ok(worker.includes("function creatorAudioDurationSeconds(file)"),'FFprobe narration measurement missing');
assert.ok(worker.includes("for(let attempt=1;attempt<=3;attempt++)"),'bounded narration fit loop missing');
assert.ok(worker.includes("fitNarrationRatePercent(duration,600,creatorTtsRateNumber(rate))"),'duration-based rate fit missing');
assert.ok(worker.includes("duration>=570&&duration<=630"),'ten-minute target window missing');
assert.ok(worker.includes("last.duration>=540&&last.duration<=660"),'final 9-11 minute acceptance missing');
assert.ok(worker.includes("LONGFORM_VOICE_DURATION_FIT_FAILED"),'fail-closed duration fit code missing');
assert.ok(worker.includes("voiceDuration:voiceFit.duration"),'voice duration evidence missing');
assert.ok(worker.includes("voiceRate:voiceFit.rate"),'voice rate evidence missing');
assert.ok(worker.includes("voiceFitAttempts:voiceFit.attempts"),'voice fit attempt evidence missing');

assert.ok(engine.includes('function fitNarrationRatePercent('),'pure narration rate helper missing');
assert.strictEqual(creator.fitNarrationRatePercent(600,600,-7),-7,'already-targeted narration must preserve rate');
const slower=creator.fitNarrationRatePercent(500,600,-7);
assert.ok(slower<=-20&&slower>=-30,'short narration should slow down safely');
const faster=creator.fitNarrationRatePercent(700,600,-7);
assert.ok(faster>=5&&faster<=15,'long narration should speed up safely');
assert.strictEqual(creator.fitNarrationRatePercent(1200,600,-7),25,'fast clamp must be enforced');
assert.strictEqual(creator.fitNarrationRatePercent(250,600,-7),-30,'slow clamp must be enforced');

assert.ok(worker.includes("const TTS_VOICE='tr-TR-AhmetNeural'"),'JARVIS main voice changed unexpectedly');
assert.ok(worker.includes("const TTS_RATE='-20%'"),'JARVIS main speech rate changed unexpectedly');
assert.ok(worker.includes("const CREATOR_TTS_RATE='-7%'"),'Creator default rate baseline changed unexpectedly');
assert.ok(engine.includes('function probeRenderedShort(file,ffprobe)'),'Shorts quality gate regressed');
assert.ok(engine.includes('function probeRenderedLongform(file,ffprobe)'),'Long-form quality gate regressed');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify explicit approval policy regressed');

console.log('CREATOR LONGFORM DURATION FIT V69 SELFTEST PASS');
