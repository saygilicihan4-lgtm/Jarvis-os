const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),root=path.join(__dirname,'../public');
// Exercise production static routing, not a fixture with a different MIME map.
const vm=require('node:vm'),serverPath=path.join(__dirname,'../server.js'),productionRequire=require('node:module').createRequire(serverPath);
let productionHandler;
vm.runInNewContext(fs.readFileSync(serverPath,'utf8'),{
 require(name){if(name==='http')return {createServer(fn){productionHandler=fn;return {listen(){}}}};if(['web-push','pg','@simplewebauthn/server'].includes(name))return {};return productionRequire(name)},
 __dirname:path.dirname(serverPath),Buffer,URL,console:{log(){},error(){}},process:{env:{JARVIS_TOKEN:'isolated-browser-test'}},setInterval(){return 0},clearInterval(){},setTimeout,clearTimeout
},{filename:'server.js'});
const server=http.createServer(productionHandler);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.JARVIS_CHROMIUM_PATH?{executablePath:process.env.JARVIS_CHROMIUM_PATH}:{}),...(process.env.JARVIS_BROWSER_PROXY?{proxy:{server:process.env.JARVIS_BROWSER_PROXY,bypass:'127.0.0.1,localhost'}}:{}),args:['--no-sandbox','--in-process-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('browser:',m.text())});
 if(process.env.JARVIS_TEST_PYTHON_PROXY==='1')await page.route(/^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\//,async route=>{
  const {execFile}=require('node:child_process');try{const body=await new Promise((resolve,reject)=>execFile('python',['-c','import sys,urllib.request;sys.stdout.buffer.write(urllib.request.urlopen(sys.argv[1],timeout=60).read())',route.request().url()],{encoding:'buffer',maxBuffer:50*1024*1024,timeout:70000},(e,b)=>e?reject(e):resolve(b)));await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':/\.(m?js)(\?|$)/.test(route.request().url())?'application/javascript':'application/octet-stream'},body})}catch(e){console.log('asset unavailable:',route.request().url());await route.abort()}
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/human-avatar-v200.html');await page.locator('#start').click();
 await page.evaluate(()=>JarvisHumanStage.stop());
 await page.waitForFunction(()=>document.querySelector('#stage').dataset.ready==='true'||document.querySelector('#status').textContent.includes('yüklenemedi'),null,{timeout:180000});
 assert.equal(await page.locator('#stage').getAttribute('data-ready'),'true',await page.locator('#status').textContent());
 assert.equal(await page.locator('#stage canvas').count(),1);
 assert.equal(await page.evaluate(()=>JarvisHumanStage.diagnostics().active),false,'closing during load stays inactive');
 await page.evaluate(()=>JarvisHumanStage.resume());
 // Synthetic harmonic audio exercises the real worklet/model, not Turkish speech accuracy.
 await page.evaluate(async()=>{
  const rate=16000,count=rate*8,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes),str=(n,s)=>{for(let i=0;i<s.length;i++)v.setUint8(n+i,s.charCodeAt(i))};
  str(0,'RIFF');v.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){const t=i/rate,s=(Math.sin(t*2*Math.PI*120)+.6*Math.sin(t*2*Math.PI*720)+.4*Math.sin(t*2*Math.PI*1080))*.3;v.setInt16(44+i*2,Math.round(s*32767),true)}
  window.testAudio=new Audio(URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})));testAudio.volume=0;
  await testAudio.play();await JarvisHumanStage.bindAudio(testAudio,bytes);
 });
 await page.waitForFunction(()=>JarvisHumanStage.diagnostics().analyzing);
 await page.waitForFunction(()=>Object.values(JarvisHumanStage.diagnostics().visemes).some(v=>v>.01),null,{timeout:6000});
 await page.evaluate(()=>testAudio.pause());
 await page.waitForFunction(()=>Object.values(JarvisHumanStage.diagnostics().visemes).every(v=>v===0),null,{timeout:3000});
 await page.evaluate(()=>{JarvisHumanStage.stop();testAudio.play()});
 assert.equal(await page.evaluate(()=>JarvisHumanStage.diagnostics().analyzing),false,'closed scene ignores playback');
 await page.evaluate(()=>{testAudio.pause();URL.revokeObjectURL(testAudio.src);JarvisHumanStage.resume()});
 await page.locator('#mirror').click();assert.equal(await page.locator('#stage').evaluate(n=>n.classList.contains('mirror')),true);
 await page.locator('#clean').click();await page.locator('#restore').click();
 // The projection dialog must be able to start the parent's explicit mic capture
 // and show the parent's recognition state without loading a second model.
 await page.evaluate(()=>{window.voiceCalls=0;window.toggleVoice=()=>{window.voiceCalls++};for(const [id,value] of [['voiceState','VOICE: MANUAL LISTENING'],['consoleStatus','JARVIS · DUYULAN: Merhaba']]){const n=document.createElement('div');n.id=id;n.textContent=value;document.body.append(n)}});
 await page.addScriptTag({url:'/human-avatar-bridge-v200.js'});
 await page.evaluate(()=>JarvisHumanAvatar.open());
 const projection=page.frameLocator('iframe[title="JARVIS human projection"]');
 await projection.locator('#listen').click();
 assert.equal(await page.evaluate(()=>voiceCalls),1,'projection microphone reaches parent capture');
 await projection.locator('#voiceStatus').filter({hasText:'MANUAL LISTENING'}).waitFor();
 await page.locator('dialog > button').click();
 for(const [width,height]of [[844,390],[390,844]]){await page.setViewportSize({width,height});const bounds=await page.locator('header button').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,left:r.left,right:r.right,bottom:r.bottom,ok:r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}}));assert(bounds.every(r=>r.ok),JSON.stringify({width,height,bounds}))}
 await page.setViewportSize({width:1280,height:720});if(process.env.JARVIS_SCREENSHOTS){fs.mkdirSync(process.env.JARVIS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,'human-avatar.png')})}
 assert.deepEqual(errors,[]);console.log('PASS: real MPFB model, applied visemes from synthetic audio, pause neutral, closed-load lifecycle, WebGL, mirror, controls, rotation');
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
