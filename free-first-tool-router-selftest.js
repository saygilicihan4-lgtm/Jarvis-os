'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
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
const server=fs.readFileSync('server.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
function extract(source,begin,end,context){
  const a=source.indexOf(begin),b=source.indexOf(end,a);
  assert(a>=0&&b>a,'production command route found: '+begin);
  vm.runInContext(source.slice(a,b),context);
}
const serverContext={deterministicPlan:()=>null};vm.createContext(serverContext);
extract(server,'function requiredCapability(command){','\nfunction deterministicPlan(',serverContext);
const workerContext={};vm.createContext(workerContext);
extract(worker,'function isLocalSafeControlCommand(command){','\nfunction speechLexiconKey(',workerContext);
const uiContext={};vm.createContext(uiContext);
extract(html,'function isDirectLocalPcCommand(command){','\nfunction renderSelfUpdateState(',uiContext);
for(const command of ['ücretsiz araştırma aracı aç','tasarım için bedava aracı kullan','free tool open design']){
  assert.equal(serverContext.requiredCapability(command),'free_first_tools_v1');
  assert.equal(workerContext.isLocalSafeControlCommand(command),true);
  assert.equal(uiContext.isDirectLocalPcCommand(command),true);
}
assert.equal(workerContext.isLocalSafeControlCommand('ücretsiz araçla ürünü yayınla'),false);
assert.equal(serverContext.requiredCapability('ücretsiz araçla ürünü yayınla'),null);
assert(worker.includes("openDefaultUrl(route.url);"),'free web tool must use the existing default browser');
assert(!worker.includes("getBrowserOperator().start(WORKSPACE,{url:route.url})"),'free tool must not force a separate browser profile');
console.log('FREE-FIRST TOOL ROUTER PASS');
