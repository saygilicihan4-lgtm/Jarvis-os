const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const yt=require('./jarvis-youtube-studio');

assert.strictEqual(yt.YOUTUBE_STUDIO_VERSION,'1.0');
assert.strictEqual(yt.STUDIO_URL,'https://studio.youtube.com/');

const spec=yt.parseUploadSpec('creator-video/test.mp4 | başlık=Deneme Başlık | açıklama=Kısa açıklama');
assert.strictEqual(spec.file,'creator-video/test.mp4');
assert.strictEqual(spec.title,'Deneme Başlık');
assert.strictEqual(spec.description,'Kısa açıklama');

assert.strictEqual(yt.authRequired({url:'https://accounts.google.com/signin',text:''}),true);
assert.strictEqual(yt.authRequired({url:'https://studio.youtube.com/',text:'Kanal içeriği Dashboard'}),false);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-youtube-'));
fs.mkdirSync(path.join(tmp,'creator-video'),{recursive:true});
const video=path.join(tmp,'creator-video','demo.mp4');
fs.writeFileSync(video,Buffer.alloc(2048,1));
const resolved=yt.resolveWorkspaceVideo(tmp,'creator-video/demo.mp4');
assert.strictEqual(resolved.full,video);
assert.throws(()=>yt.resolveWorkspaceVideo(tmp,path.resolve(tmp,'..','outside.mp4')),/workspace/);

const source=fs.readFileSync('./jarvis-youtube-studio.js','utf8');
const worker=fs.readFileSync('./worker.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
assert.ok(source.includes("published:false"),'draft result must state not published');
assert.ok(!source.includes("clickByText(workspace,'Publish'"),'module must never click Publish');
assert.ok(!source.includes("clickByText(workspace,'Yayınla'"),'module must never click Yayınla');
assert.ok(source.includes("input[type=file]"),'file input upload path missing');
assert.ok(worker.includes("name:'youtube_prepare_draft_upload'"),'native YouTube draft tool missing');
assert.ok(worker.includes("name:'youtube_studio_status'"),'native YouTube status tool missing');
assert.ok(!worker.includes("name:'youtube_publish'"),'YouTube public publish must not be an autonomous native tool');
assert.ok(worker.includes('PUBLIC/YAYINLA adımına dokunulmadı')||source.includes('PUBLIC/YAYINLA adımına dokunulmadı'),'draft-only completion message missing');
assert.ok(server.includes("return'youtube_upload_prepare_v1'"),'server YouTube draft routing missing');

console.log('YOUTUBE STUDIO DRAFT SELFTEST PASS');
