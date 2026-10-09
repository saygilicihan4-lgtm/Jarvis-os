'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const server=fs.readFileSync('server.js','utf8');
const start=server.indexOf('function accountActionFor(command){');
const end=server.indexOf('\nfunction accountPolicyAllows(',start);
assert(start>=0&&end>start,'production account action classifier found');
const context={};vm.createContext(context);
vm.runInContext(server.slice(start,end),context);
for(const command of ['Shopify mağazasını aç','Shopify aç','PC: Shopify mağazasını aç','Shopify admin aç']){
  assert.equal(context.accountActionFor(command),null,command+' must be navigation only');
}
for(const command of ['Shopify ürün görevini aç','Shopify ürün taslağı ekle: {"title":"A"}','Shopify ürünü yayınla gid://shopify/Product/123']){
  assert.equal(context.accountActionFor(command)?.type,'shopify',command+' must remain account-gated');
}
const ui=fs.readFileSync('public/reference-cockpit.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');
assert(worker.includes("if(openTarget&&!/^(?:youtube studio|shopify admin) (?:aç|ac)$/i.test(c))"),'dedicated browser commands must not be swallowed by generic launcher');
assert(ui.includes("shopify:'Shopify mağazasını aç'"),'quick action must navigate rather than queue a product task');
assert(!ui.includes("shopify:'Shopify ürün görevini aç'"),'old ambiguous shortcut must be removed');
console.log('SHOPIFY NAVIGATION GUARD PASS · browser open vs account actions separated');
