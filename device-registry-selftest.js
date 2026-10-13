'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createPgDeviceRegistry,policyRecord}=require('./jarvis-device-registry');
(async()=>{
 const records=new Map();const db={async query(sql,values){
  assert(!/DELETE|DROP|TRUNCATE/.test(sql));
  if(sql.startsWith('INSERT'))records.set(values[0],JSON.parse(values[1]));
  if(sql.startsWith('SELECT'))return{rows:[...records].map(([device_id,policy])=>({device_id,policy}))};
  return{rows:[]};
 }};
 const registry=createPgDeviceRegistry(db);assert.deepEqual(await registry.init(),{});
 const device={name:'PC',approved:true,roles:['DEVELOPER'],allowedCapabilities:['free_first_tools_v1'],credentialIssuedAt:'generation-1',lastSeen:new Date().toISOString(),version:'2.104.0',token:'NEVER_STORE'};
 await registry.save('pc',device);
 let restored=await createPgDeviceRegistry(db).init();assert.equal(restored.pc.approved,true);assert.equal(restored.pc.lastSeen,null);assert.equal(restored.pc.version,null);assert.equal(restored.pc.credentialIssuedAt,'generation-1');
 assert.equal(JSON.stringify([...records]).includes('NEVER_STORE'),false);
 await registry.save('pc',{...device,approved:false});restored=await createPgDeviceRegistry(db).init();assert.equal(restored.pc.approved,false,'revocation survives restart');
 const denied=policyRecord('pc',{...device,approved:'true',roles:['ADMIN','DEVELOPER'],allowedCapabilities:['ok','bad/../']});assert.equal(denied.approved,false);assert.deepEqual(denied.roles,['DEVELOPER']);
 await assert.rejects(createPgDeviceRegistry({query:async()=>{throw Error('offline')}}).init(),/offline/);
 // Exercise actual server policy persistence ordering: an older approval cannot
 // replace a newer revocation after a slow database acknowledgement.
 const source=fs.readFileSync('server.js','utf8');let release;const saved=[];
 const c=vm.createContext({deviceRegistryReady:true,deviceRegistry:{save:async(id,p)=>{saved.push(p.approved);if(saved.length===1)await new Promise(r=>release=r)}}});
 const a=source.indexOf('const devicePolicyWrites='),b=source.indexOf('async function persistPush(',a);vm.runInContext(source.slice(a,b),c);
 const approval=c.persistDevicePolicy('pc',{approved:true});approval.catch(()=>{});
 for(let i=0;i<5&&!release;i++)await Promise.resolve();
 const revocation=c.persistDevicePolicy('pc',{approved:false});release();await assert.rejects(approval,/superseded/);await revocation;
 assert.deepEqual(saved,[true,false]);assert.equal(vm.runInContext('devicePolicyWrites.size',c),0);
 console.log('DEVICE REGISTRY PASS: grants and revocations survive restart, no live status or secrets restored, failed load and superseded mutation fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
