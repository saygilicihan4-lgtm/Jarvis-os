const assert=require('assert');const fs=require('fs');const src=fs.readFileSync('./jarvis-bluetooth-audio.js','utf8');const bt=require('./jarvis-bluetooth-audio');
assert.ok(src.includes("Get-PnpDevice -Class Bluetooth"),'Bluetooth adapter inventory missing');
assert.ok(src.includes("ms-settings:bluetooth"),'Windows Bluetooth pairing entry missing');
for(const a of ['playpause','next','previous','stop','volumeup','volumedown','mute'])assert.ok(src.includes(a),'media action missing '+a);
assert.equal(bt.command('definitely-not-valid').reason,'unsupported_action');
if(process.platform!=='win32')assert.equal(bt.status().reason,'windows_required');
console.log('BLUETOOTH AUDIO ROUTER SELFTEST PASS');