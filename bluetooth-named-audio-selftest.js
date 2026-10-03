const assert=require('assert'),fs=require('fs');const bt=require('./jarvis-bluetooth-audio');const worker=fs.readFileSync('./worker.js','utf8');
assert.equal(bt.VERSION,'1.8'); assert.equal(bt.findAudioDevice('').reason,'device_name_required');
if(process.platform!=='win32')assert.equal(bt.findAudioDevice('speaker').reason,'windows_required');
assert.ok(worker.includes("'select_output'")); assert.ok(worker.includes("deviceName:a.deviceName")); assert.ok(worker.includes("'bluetooth_named_audio_target_v1'"));
console.log('BLUETOOTH NAMED AUDIO TARGET SELFTEST PASS');