'use strict';
// Server-owned device policy only. No bearer tokens, device tokens or heartbeats
// are stored; loading a policy never asserts that a PC is currently online.
function policyRecord(id,device){
  if(!/^[A-Za-z0-9_.-]{1,80}$/.test(String(id)))throw Error('invalid device id');
  const roles=Array.isArray(device.roles)?device.roles.filter(x=>['DEVELOPER','CREATOR','COMMERCE'].includes(x)).slice(0,3):[];
  const caps=Array.isArray(device.allowedCapabilities)?[...new Set(device.allowedCapabilities.map(x=>String(x).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100)).filter(Boolean))].slice(0,512):[];
  return{id,name:String(device.name||id).slice(0,100),approved:device.approved===true,roles,allowedCapabilities:caps,credentialIssuedAt:device.credentialIssuedAt||null};
}
function createPgDeviceRegistry(db){
  return{
    async init(){
      await db.query('CREATE TABLE IF NOT EXISTS jarvis_device_policies(device_id text PRIMARY KEY,policy jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())');
      const result=await db.query('SELECT device_id,policy FROM jarvis_device_policies');
      const devices={};
      for(const row of result.rows){
        const policy=policyRecord(row.device_id,row.policy);
        devices[row.device_id]={...policy,version:null,lastSeen:null,capabilities:[],memory:null,authMode:'signed'};
      }
      return devices;
    },
    async save(id,device){
      const policy=policyRecord(id,device);
      await db.query('INSERT INTO jarvis_device_policies(device_id,policy,updated_at) VALUES($1,$2,now()) ON CONFLICT(device_id) DO UPDATE SET policy=EXCLUDED.policy,updated_at=now()',[id,JSON.stringify(policy)]);
      return policy;
    }
  };
}
module.exports={createPgDeviceRegistry,policyRecord};
