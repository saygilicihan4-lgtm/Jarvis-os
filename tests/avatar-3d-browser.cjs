'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),root=path.join(__dirname,'../public');
const fixture='<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#02080e}.jr-sphere{position:relative;width:200px;height:220px}</style><div class="jr-core jarvis"><div class="jr-sphere"></div></div><script src="/avatar-security-v198.js"></script></html>';
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(fixture)}const p=path.join(root,req.url);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':p.endsWith('.js')?'application/javascript':'text/css'});res.end(e?'':b)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const engine=process.env.JARVIS_TEST_BROWSER||'chromium';
 const browser=await ({chromium,webkit})[engine].launch({headless:true,...(process.env.JARVIS_CHROMIUM_PATH&&engine==='chromium'?{executablePath:process.env.JARVIS_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 try{const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.JarvisAvatar3D);
 await page.evaluate(()=>JarvisAvatarSecurity.open());await page.locator('[data-ja=robot3d]').click();
 assert.equal(await page.locator('[data-ja=robot3d]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.jr-sphere').getAttribute('aria-hidden'),null,'3D image remains accessible');
 await page.locator('[data-ja=project]').click();const canvas=page.locator('.ja-projection canvas');await canvas.waitFor();
 await page.waitForFunction(()=>document.querySelector('.ja-projection canvas').dataset.mouth==='0.000');
 const before=await canvas.evaluate(c=>c.toDataURL());await page.locator('.ja-robot-controls input').fill('45');await page.locator('.ja-robot-controls input').dispatchEvent('input');
 await page.waitForFunction(b=>document.querySelector('.ja-projection canvas').toDataURL()!==b,before);
 await page.locator('[data-ja=mirror]').click();assert.equal(await canvas.evaluate(c=>c.classList.contains('ja-mirror')),true);
 // Actual PCM decode and actual HTMLAudioElement clock; not a mocked amplitude.
 await page.evaluate(async()=>{
   const rate=16000,n=rate*3,b=new ArrayBuffer(44+n*2),v=new DataView(b);const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};
   s(0,'RIFF');v.setUint32(4,36+n*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*2,true);
   for(let i=0;i<rate;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/rate)*16000,true);
   window.robotAudio=new Audio(URL.createObjectURL(new Blob([b],{type:'audio/wav'})));window.robotBytes=new Uint8Array(b);await JarvisAvatar3D.bindAudio(robotAudio,robotBytes);await robotAudio.play();
 });
 await page.waitForFunction(()=>Number(document.querySelector('.ja-projection canvas').dataset.mouth)>.1);
 await page.evaluate(()=>robotAudio.pause());await page.waitForFunction(()=>document.querySelector('.ja-projection canvas').dataset.mouth==='0.000');
 await page.evaluate(async()=>{robotAudio.currentTime=1.5;await robotAudio.play()});
 await page.waitForFunction(()=>robotAudio.currentTime>1.65);assert.equal(await canvas.getAttribute('data-mouth'),'0.000','decoded silence closes jaw');
 await page.evaluate(async()=>{robotAudio.pause();await JarvisAvatar3D.bindAudio(robotAudio,new Uint8Array([1,2,3]))});
 await page.waitForFunction(()=>document.querySelector('.ja-projection canvas').dataset.sync==='unavailable');
 await page.evaluate(()=>{const old=new EventTarget(),current=new EventTarget();JarvisAvatar3D.bindUtterance(old);JarvisAvatar3D.bindUtterance(current);old.dispatchEvent(new Event('start'));old.dispatchEvent(new Event('boundary'));window.robotUtterance=current});
 assert.equal(await canvas.getAttribute('data-mouth'),'0.000','stale utterance cannot animate new speech');
 await page.evaluate(()=>{robotUtterance.dispatchEvent(new Event('start'));robotUtterance.dispatchEvent(new Event('boundary'))});
 await page.waitForFunction(()=>document.querySelector('.ja-projection canvas').dataset.sync==='word-event');
 await page.evaluate(()=>robotUtterance.dispatchEvent(new Event('error')));
 await page.waitForFunction(()=>document.querySelector('.ja-projection canvas').dataset.sync==='unavailable');
 for(const viewport of [{width:844,height:390},{width:320,height:568},{width:1366,height:768}]){await page.setViewportSize(viewport);
   assert.equal(await page.locator('.ja-projection button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=24&&r.height>=24&&r.top>=0&&r.bottom<=innerHeight&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})),true,'controls inside viewport');}
 if(process.env.JARVIS_SCREENSHOTS){fs.mkdirSync(process.env.JARVIS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,'robot3d-'+engine+'.png')})}
 await page.locator('[data-ja=close]').click();await page.reload();await page.waitForSelector('.jr-sphere[data-robot3d="1"] canvas');
 await page.evaluate(()=>JarvisAvatarSecurity.open());await page.locator('[data-ja=robot3d]').click();assert.equal(await page.locator('.jr-sphere canvas').count(),0);
 assert.deepEqual(errors,[]);console.log(engine+' PASS: 3D rotation, PCM/clock jaw, pause, silence, invalid decode, mirror, responsive controls, persistence, removal');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
