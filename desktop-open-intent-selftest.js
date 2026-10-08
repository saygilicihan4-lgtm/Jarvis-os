'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('worker.js','utf8');
const start=source.indexOf('function openKnownDesktopTarget(raw){');
const end=source.indexOf('\nasync function execute(task){',start);
assert(start>=0&&end>start,'production desktop target resolver found');
const opened=[];
const context={
  process:{platform:'win32'},
  os:{homedir:()=> 'C:\\\\Users\\\\test'},
  path:{join:(...parts)=>parts.join('\\\\')},
  openDefaultUrl:url=>opened.push(url),
  startDetached(){throw new Error('unexpected executable launch')},
  firstExisting(){return null},
  childProcess:{spawn(){throw new Error('unexpected system launch')}},
  WORKSPACE:'C:\\\\Jarvis'
};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
for(const phrase of ['YouTube görevini','YouTube görevi','YouTube uygulamasını','YouTube uygulamayı']){
  const result=context.openKnownDesktopTarget(phrase);
  assert.equal(result.ok,true,phrase+' resolves to known YouTube target');
  assert.equal(opened.at(-1),'https://www.youtube.com/');
}
assert.equal(opened.length,4);
console.log('DESKTOP OPEN INTENT PASS: Turkish task/app suffixes resolve known YouTube target without widening executable allowlist');
