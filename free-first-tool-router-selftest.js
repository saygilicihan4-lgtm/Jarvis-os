'use strict';
const assert=require('node:assert/strict');
const tools=require('./jarvis-free-first-tools');

assert.equal(tools.resolve('YouTube Shorts üret').id,'jarvis-creator');
assert.equal(tools.resolve('Kanal için özgün Shorts hazırla').kind,'native_creator');
assert.equal(tools.resolve('Araştırma yap').id,'gemini-notebook');
assert.equal(tools.resolve('tasarım prototipi').id,'penpot');
assert.equal(tools.resolve('not al').kind,'installed_app');
assert.equal(tools.resolve('randevu planla').id,'cal-com');
assert.equal(tools.resolve('otomasyon kur').kind,'configured_service');
assert.equal(tools.launchable(tools.resolve('otomasyon kur')),false,'n8n needs configured self-hosting; do not open paid cloud by default');
assert.equal(tools.resolve('YouTube videosu hazırla').cost,'local_zero_cost');
assert.match(tools.resolve('YouTube videosu hazırla').note,/lisansı doğrulanmış görüntüler/);
assert.equal(tools.resolve('pazarlama içeriği').cost,'free_experimental');
assert.equal(tools.resolve('ViewMade ile üret').ok,false,'paid ViewMade is never an automatic free-first choice');
assert.equal(tools.resolve('belirsiz iş').ok,false);
assert.equal(tools.resolve('araştırma aracı').url,'https://notebooklm.google.com/');
console.log('FREE-FIRST TOOL ROUTER PASS');
