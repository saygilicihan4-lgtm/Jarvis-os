'use strict';
const fs=require('fs');
const p='server.js';
let s=fs.readFileSync(p,'utf8');
const old="const r=await sessionLifecycle.setLegacyAllowed(false);";
const next="const r=await sessionLifecycle.disableLegacy();";
if(s.includes(next)){
  if(s.includes(old))throw new Error('mixed legacy lifecycle APIs');
  console.log('v163 monotonic server patch already applied');
  process.exit(0);
}
if(s.split(old).length-1!==1)throw new Error('expected exactly one legacy cutoff server anchor');
s=s.replace(old,next);
if(s.includes('sessionLifecycle.setLegacyAllowed'))throw new Error('deprecated legacy re-enable API remains in server');
fs.writeFileSync(p,s);
console.log('v163 monotonic server patch applied');
