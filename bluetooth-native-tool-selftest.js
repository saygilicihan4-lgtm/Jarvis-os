const assert=require('assert'),fs=require('fs');const s=fs.readFileSync('./worker.js','utf8');
assert.ok(s.includes("name:'bluetooth_control'"),'native Bluetooth tool missing');
for(const a of ['status','list_audio','pair','playpause','next','previous','stop','volumeup','volumedown','mute'])assert.ok(s.includes("'"+a+"'"),'Bluetooth action missing '+a);
assert.ok(s.includes("bluetoothAudio.command(action,{deviceName:a.deviceName})"),'Bluetooth native tool is not wired to adapter');
assert.ok(s.includes("'bluetooth_native_tool_v1'"),'Bluetooth native capability missing');
console.log('BLUETOOTH NATIVE TOOL SELFTEST PASS');