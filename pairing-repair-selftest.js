'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('worker.js','utf8');
const production=source.slice(source.indexOf('let pairingAttempted=false;'),source.indexOf('async function migrateDeviceCredential()'));
function scenario(token,code,reply){
  const stats={calls:0,saves:0,cleared:0};let abort;
  const c={DEVICE_TOKEN:token,PAIR_CODE:code,BASE:'https://example.invalid',DEVICE_ID:'test',NAME:'Test',WORKER_VERSION:'test',CAPS:[],AbortController,
    setTimeout(fn,ms){assert.equal(ms,10000);abort=fn;return 1},clearTimeout(){stats.cleared++},console:{error(){}},
    async fetch(url,opts){stats.calls++;assert.equal(JSON.parse(opts.body).code,code);assert.equal(opts.headers.authorization,undefined);return reply(opts)},
    async saveDeviceToken(value){stats.saves++;c.DEVICE_TOKEN=value}};
  vm.createContext(c);vm.runInContext(production,c);return {c,stats,abort:()=>abort()};
}
(async()=>{
  for(const old of ['', 'expired-token', 'revoked-token']){
    const {c,stats}=scenario(old,'FRESH',async()=>({ok:true,json:async()=>({token:'new-token'})}));
    assert.equal(await c.pairDevice(),true);assert.equal(c.DEVICE_TOKEN,'new-token');
    assert.equal(await c.pairDevice(),false);assert.equal(stats.calls,1);assert.equal(stats.saves,1);assert.equal(stats.cleared,1);
  }
  for(const reply of [async()=>({ok:false,status:403,json:async()=>({error:'invalid'})}),async()=>({ok:true,json:async()=>({})}),async()=>{throw Error('network')}]){
    const {c,stats}=scenario('keep-old','BAD',reply);assert.equal(await c.pairDevice(),false);
    assert.equal(c.DEVICE_TOKEN,'keep-old');await c.pairDevice();assert.equal(stats.calls,1);assert.equal(stats.saves,0);assert.equal(stats.cleared,1);
  }
  const empty=scenario('keep-old','',()=>{throw Error('unexpected')});await empty.c.pairDevice();assert.equal(empty.stats.calls,0);
  const hung=scenario('keep-old','FRESH',opts=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted')))));
  const pending=hung.c.pairDevice();hung.abort();assert.equal(await pending,false);assert.equal(hung.c.DEVICE_TOKEN,'keep-old');assert.equal(hung.stats.cleared,1);
  console.log('PAIRING REPAIR PASS: old token replacement, no-code preservation, failure preservation, single attempt, bounded network wait');
})().catch(e=>{console.error(e);process.exitCode=1});
