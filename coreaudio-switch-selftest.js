const assert=require('assert'),fs=require('fs');const bt=require('./jarvis-bluetooth-audio');
assert.equal(bt.VERSION,'1.6');assert.equal(bt.setDefaultEndpoint('').reason,'endpoint_id_required');
assert.equal(bt.parseFoundDevice('[]'),null);assert.equal(bt.parseFoundDevice('bad'),null);
const d=bt.parseFoundDevice(JSON.stringify([{Status:'Error',InstanceId:'x'},{Status:'OK',InstanceId:'y'}]));assert.equal(d.InstanceId,'y');
const ps=fs.readFileSync('./jarvis-set-audio-endpoint.ps1','utf8');assert.ok(ps.includes('SetDefaultEndpoint'));assert.ok(ps.includes('for(int role=0;role<3;role++)'));assert.ok(ps.includes('JARVIS_AUDIO_ENDPOINT_SET'));
console.log('CORE AUDIO SWITCH SELFTEST PASS');