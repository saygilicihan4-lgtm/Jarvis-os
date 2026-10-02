const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');
const web=fs.readFileSync('./jarvis-creator-web-media.js','utf8');

assert.strictEqual(typeof creator.animateStillAsset,'function','still-image animator export missing');
assert.ok(creator.CREATOR_IMAGE_EXTENSIONS instanceof Set,'Creator image extension set missing');
for(const ext of ['.jpg','.jpeg','.png','.webp'])assert.ok(creator.CREATOR_IMAGE_EXTENSIONS.has(ext),ext+' still format missing');

assert.ok(engine.includes("parts.length!==2||parts[0]!=='creator-web-inbox'"),'still-image input must be restricted to web inbox');
assert.ok(engine.includes("CREATOR_IMAGE_SYMLINK_BLOCKED"),'still-image symlink guard missing');
assert.ok(engine.includes("CREATOR_IMAGE_SYMLINK_ESCAPE"),'still-image realpath escape guard missing');
assert.ok(engine.includes("50*1024*1024"),'still-image size cap missing');
assert.ok(engine.includes("'-loop','1','-i',info.full"),'FFmpeg still loop input missing');
assert.ok(engine.includes("scale=1180:2100:force_original_aspect_ratio=increase"),'portrait still animation canvas missing');
assert.ok(engine.includes("scale=2048:1152:force_original_aspect_ratio=increase"),'landscape still animation canvas missing');
assert.ok(engine.includes("35*sin(t*0.95)"),'portrait still pan animation missing');
assert.ok(engine.includes("40*sin(t*0.75)"),'landscape still pan animation missing');
assert.ok(engine.includes("'-c:v','libx264'"),'still-image H.264 encoding missing');
assert.ok(engine.includes("CREATOR_IMAGE_MOTION_VERIFY_FAILED"),'still-image post-render verification guard missing');
assert.ok(engine.includes("sourceSha256"),'derived asset must retain source image hash evidence');

assert.ok(web.includes("gsrsearch:'filetype:bitmap '+q"),'Wikimedia bitmap search syntax missing');
assert.ok(web.includes("iiurlwidth:'2400'"),'Wikimedia bounded thumbnail request missing');
assert.ok(web.includes("function normalizeWikimediaImages("),'Wikimedia image normalizer missing');
assert.ok(web.includes("function downloadImageCandidate("),'licensed image downloader missing');
assert.ok(web.includes("kind:'animated_still'"),'derived image-motion manifest evidence missing');
assert.ok(web.includes("requestedProvider==='auto'||requestedProvider==='wikimedia'"),'image fallback must not silently cross explicit Pexels/Pixabay provider choice');
assert.ok(web.includes("strictRightsPolicy:'Wikimedia video/image only Public Domain/CC0"),'strict image rights policy missing');

assert.ok(worker.includes("'creator_image_motion_fallback_v1'"),'Creator image-motion capability missing');
assert.ok(worker.includes("creatorImageMotionReady:CAPS.includes('creator_image_motion_fallback_v1')"),'PC acceptance image-motion readiness missing');
assert.ok(worker.includes('async function creatorAutoWebAssets('),'central Creator auto-web helper missing');
assert.ok(worker.includes("animateImage:(rel,opts)=>getCreatorEngine().animateStillAsset(WORKSPACE,rel,opts)"),'central auto-web helper must preserve image animation fallback');
const autoUses=(worker.match(/creatorAutoWebAssets\(\{/g)||[]);
assert.ok(autoUses.length>=5,'Creator mission flows must use centralized auto-web helper');
assert.ok(worker.includes("'creator_short_motion_rhythm_v1'"),'Short Motion v73 capability regressed');
assert.ok(worker.includes("'creator_youtube_attribution_v1'"),'YouTube attribution v72 capability regressed');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR IMAGE MOTION V74 SELFTEST PASS');
