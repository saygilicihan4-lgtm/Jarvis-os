const assert=require('assert'),fs=require('fs');const bt=require('./jarvis-bluetooth-audio');const w=fs.readFileSync('./worker.js','utf8');
assert.equal(bt.VERSION,'1.2');assert.equal(bt.selectOutput('').reason,'device_name_required');
assert.ok(w.includes("'windows_audio_endpoint_verification_v1'"));
const src=fs.readFileSync('./jarvis-bluetooth-audio.js','utf8');
assert.ok(src.includes("manual_endpoint_selection_required"),'must not fake default endpoint switching');
assert.ok(src.includes("Microsoft\\\\Multimedia\\\\Sound Mapper"),'default endpoint verification probe missing');
console.log('WINDOWS AUDIO ENDPOINT SELFTEST PASS');