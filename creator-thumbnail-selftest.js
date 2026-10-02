const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
const youtube=fs.readFileSync('./jarvis-youtube-studio.js','utf8');
const engine=fs.readFileSync('./jarvis-creator-engine.js','utf8');

assert.ok(worker.includes("'creator_thumbnail_v1'"),'Creator thumbnail capability missing');
assert.ok(worker.includes("creatorThumbnailReady:CAPS.includes('creator_thumbnail_v1')"),'PC acceptance thumbnail readiness missing');
assert.ok(worker.includes("thumbnail:String(rendered.thumbnail||'').trim()"),'mission YouTube draft thumbnail binding missing');
assert.ok(worker.includes("thumbnail:String(a.thumbnail||'').trim()"),'manual YouTube draft thumbnail binding missing');
assert.ok(worker.includes("thumbnailTitle:String(input.youtube&&input.youtube.title||input.campaignName||'')"),'render thumbnail title binding missing');

assert.strictEqual(typeof creator.thumbnailTitleLines,'function','thumbnail title helper missing');
assert.strictEqual(typeof creator.createThumbnail,'function','thumbnail renderer export missing');
const lines=creator.thumbnailTitleLines('Yapay zeka ile geleceğin robotları bugün nasıl çalışıyor',{maxChars:18,maxLines:3});
assert.ok(lines.length>=2&&lines.length<=3,'thumbnail title wrapping must stay bounded');
assert.ok(lines.every(x=>x.length<=24),'thumbnail title line unexpectedly long');

assert.ok(engine.includes("thumbnails:ensureDir(path.join(workspace,'creator-thumbnails'))"),'thumbnail output directory missing');
assert.ok(engine.includes("'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720"),'1280x720 thumbnail profile missing');
assert.ok(engine.includes("thumbnail=createThumbnail(workspace,outFile"),'render must create thumbnail from final video');
assert.ok(engine.includes("thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null"),'thumbnail metadata evidence missing');

assert.ok(youtube.includes('function resolveWorkspaceImage('),'YouTube workspace thumbnail guard missing');
assert.ok(youtube.includes("new Set(['.jpg','.jpeg','.png','.webp'])"),'YouTube thumbnail file allowlist missing');
assert.ok(youtube.includes("size>5*1024*1024"),'YouTube thumbnail size guard missing');
assert.ok(youtube.includes("input[type=file][accept*=image]"),'YouTube image input selector missing');
assert.ok(youtube.includes('async function tryUploadThumbnail('),'YouTube thumbnail upload helper missing');
assert.ok(youtube.includes("thumbnailSet:!!thumbnailSet.ok"),'YouTube thumbnail receipt evidence missing');
assert.ok(youtube.includes("' · thumbnail yüklenemedi, taslak devam etti'"),'thumbnail upload must fail open for DRAFT');

assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit PUBLIC approval policy regressed');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify explicit publish approval policy regressed');

console.log('CREATOR THUMBNAIL V86 SELFTEST PASS');
