'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=__dirname;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'jarvis-update-manifest.json'),'utf8'));
const managed=new Set(manifest.files.map(entry=>entry.path));
for(const entry of manifest.files){
  const content=fs.readFileSync(path.join(root,entry.path));
  assert(content.byteLength>=entry.min_bytes,entry.path+' below minimum size');
  assert(content.toString().includes(entry.signature),entry.path+' lost expected signature');
  if(entry.kind!=='node')continue;
  for(const match of content.toString().matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){
    const dependency=path.normalize(path.join(path.dirname(entry.path),match[1]+'.js'));
    if(fs.existsSync(path.join(root,dependency)))assert(managed.has(dependency),entry.path+' missing managed dependency '+dependency);
  }
}
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const source=worker.slice(worker.indexOf('let previousCpuTimes=null;'),worker.indexOf('function memoryStats(){'));
assert(source.includes('function systemMetrics(){'));
const os={cpus:()=>[{times:{user:20,idle:80}}],totalmem:()=>100,freemem:()=>40};
const context={os,fs:{statfsSync:()=>({blocks:100,bavail:25})},WORKSPACE:'test'};
vm.createContext(context);
vm.runInContext(source,context);
assert.equal(context.systemMetrics().cpu,null);
os.cpus=()=>[{times:{user:40,idle:90}}];
const second=context.systemMetrics();
assert.equal(second.cpu,67);
assert.equal(second.ram,60);
assert.equal(second.disk,75);
context.fs.statfsSync=()=>{throw Error('unsupported')};
assert.equal(context.systemMetrics().disk,null);
assert(worker.includes("const tmp=target+'.new.js'"),'Node 24 staged JS suffix regression');
const startup=fs.readFileSync(path.join(root,'jarvis-startup.ps1'),'utf8');
const installer=fs.readFileSync(path.join(root,'install-jarvis-startup.ps1'),'utf8');
const hidden=fs.readFileSync(path.join(root,'JARVIS-STARTUP-HIDDEN.vbs'),'utf8');
for(const contents of [startup,installer])assert(contents.includes('Split-Path -Parent $MyInvocation.MyCommand.Path'),'startup must use installed folder');
assert(hidden.includes('WScript.ScriptFullName'),'hidden launcher must resolve its installed folder');
assert(installer.includes('$shortcut.TargetPath = $wscript'),'Startup fallback must launch wscript');
assert(installer.includes('$shortcut.Arguments = (\'"\' + $HiddenVbs + \'"\')'),'Startup fallback must reference installed VBS');
assert(installer.includes('$shortcut.WorkingDirectory = $JarvisDir'),'Startup fallback must retain installed directory');
assert(!installer.includes('Copy-Item $HiddenVbs $FallbackVbs'),'Startup fallback must not copy a relative-path launcher');
assert(startup.includes('if ($operaRunning)'),'Opera session restore must not open duplicate tab');
console.log('PC STARTUP TELEMETRY PASS: manifest closure, live metrics, JS staging and folder-relative boot');
