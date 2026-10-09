'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('worker.js','utf8');
const start=source.indexOf('let mobilePollAuthorized=false;');
const end=source.indexOf('async function serviceMobileTts(){',start);
assert(start>0&&end>start,'mobile auth gate exists');
const notices=[];
const ctx={console:{error:(message)=>notices.push(message)},lastCloudHeartbeatAt:123};
vm.createContext(ctx);
vm.runInContext(source.slice(start,end),ctx);
assert.equal(ctx.mobileAuthorizationDenied(Error('device revoked or not approved')),true);
assert.equal(ctx.mobileAuthorizationDenied(Error('device identity mismatch')),true);
assert.equal(ctx.mobileAuthorizationDenied(Error('network timeout')),false);
assert.equal(ctx.pauseMobilePollsForAuth(Error('network timeout')),false);
assert.equal(vm.runInContext('mobilePollAuthorized',ctx),false);
vm.runInContext('mobilePollAuthorized=true;mobileAuthNoticeShown=false',ctx);
assert.equal(ctx.pauseMobilePollsForAuth(Error('device revoked or not approved')),true);
assert.equal(vm.runInContext('mobilePollAuthorized',ctx),false);
assert.equal(ctx.lastCloudHeartbeatAt,0);
ctx.pauseMobilePollsForAuth(Error('device revoked or not approved'));
assert.equal(notices.length,1,'revoked device notice is not spammed');
for(const fn of ['serviceMobileTts','serviceMobileLanguage','serviceMobileBrain']){
  assert(source.includes(`async function ${fn}(){\n  if(!mobilePollAuthorized)return false;`),`${fn} requires an authorized heartbeat`);
}
assert(source.includes('mobilePollAuthorized=true;\n    mobileAuthNoticeShown=false;'),'only successful heartbeat resumes mobile polls');
console.log('MOBILE AUTH POLL PASS: authorization gate, one notice, heartbeat resume');
