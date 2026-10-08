'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path').win32;
const source=fs.readFileSync('worker.js','utf8');
const start=source.indexOf('function normalizeStartMenuAppName(value){');
const end=source.indexOf('\nasync function execute(task){',start);
assert(start>=0&&end>start,'production start-menu resolver found');
const home='C:\\Users\\test';
const appData=path.join(home,'AppData','Roaming');
const programData='C:\\ProgramData';
const programs=path.join(appData,'Microsoft','Windows','Start Menu','Programs');
const sharedPrograms=path.join(programData,'Microsoft','Windows','Start Menu','Programs');
const nested=path.join(programs,'Productivity');
const dir=(name)=>({name,isDirectory:()=>true,isFile:()=>false});
const file=(name)=>({name,isDirectory:()=>false,isFile:()=>true});
const entries=new Map([
 [programs,[file('Spotify.lnk'),dir('Productivity')]],
 [nested,[file('Slack.lnk'),file('Uninstall.lnk')]],
 [sharedPrograms,[file('Spotify.lnk')]]
]);
const launched=[];
const context={
  process:{platform:'win32',env:{APPDATA:appData,PROGRAMDATA:programData}},
  os:{homedir:()=>home},path,
  fs:{readdirSync(dir){if(!entries.has(dir))throw Error('not found');return entries.get(dir)}},
  openDefaultUrl(){throw Error('unexpected URL launch')},
  startDetached:(exe,args)=>launched.push({exe,args}),
  firstExisting:()=>null,
  childProcess:{spawn(){throw Error('unexpected command launch')}},
  WORKSPACE:path.join(home,'JARVIS')
};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
const spotify=context.openKnownDesktopTarget('Spotify uygulamasını');
assert.equal(spotify.ok,true);
assert.match(spotify.message,/Spotify/);
assert.equal(launched.at(-1).exe,'explorer.exe');
assert.equal(launched.at(-1).args[0],path.join(programs,'Spotify.lnk'),'user Start Menu shortcut wins over shared duplicate');
const slack=context.openKnownDesktopTarget('Slack görevini');
assert.equal(slack.ok,true,'nested Start Menu shortcut is discovered');
assert.equal(launched.at(-1).args[0],path.join(nested,'Slack.lnk'));
const blocked=context.openKnownDesktopTarget('Uninstall');
assert.equal(blocked.ok,false,'maintenance shortcuts are not discovered as apps');
const unknown=context.openKnownDesktopTarget('not installed app');
assert.equal(unknown.ok,false,'unknown names never become executable paths');
assert.equal(launched.length,2,'only exact Start Menu app matches launch');
console.log('INSTALLED APP DISCOVERY PASS: exact user/shared Start Menu match, nested shortcut, no arbitrary executable, maintenance shortcuts blocked');
