'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../public');
const fixture=`<!doctype html><html lang="tr-TR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div class="app"><textarea id="cmd"></textarea><div id="tasks"></div><div id="audit"></div><span id="pcState">OFFLINE</span></div><script>window.voiceCalls=0;window.sendCalls=0;window.toggleVoice=()=>{voiceCalls++;document.body.dataset.jarvisCoreState='listening'};window.send=()=>sendCalls++;</script><script src="/tri-core-hologram.js"></script></body></html>`;
const state={workers:{pc:{online:false,capabilities:[]},devices:[]},tasks:[],audit:[],assistant:{},brain:{zeroCostOnly:true},remoteControl:{},accountPolicies:[]};
const sessions={current:{managed:true,id:'fixture-current',source:'passkey'},durable:true,legacySessionsAccepted:true};
let writes=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){if(req.method!=='GET')writes++;res.setHeader('content-type','application/json');return res.end(JSON.stringify(url.pathname==='/api/state'?state:url.pathname==='/api/sessions/status'?sessions:url.pathname==='/api/sessions'?{sessions:[]}:{ok:true}))}
  if(url.pathname==='/test-fixture'){res.setHeader('content-type','text/html');return res.end(fixture)}
  const filename=path.join(root,url.pathname==='/'?'index.html':url.pathname);if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(filename,(e,b)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('content-type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.jpg':'image/jpeg'})[path.extname(filename)]||'text/plain');res.end(b)});
});
function geometry(){
  const v=visualViewport,errors=[];const stage=document.querySelector('.jr-layout');const r=stage.getBoundingClientRect();
  if(Math.abs(r.width-v.width)>1||Math.abs(r.height-v.height)>1)errors.push('viewport mismatch '+JSON.stringify({r:r.toJSON(),w:v.width,h:v.height}));
  for(const n of stage.querySelectorAll('.jr-button')){
    const b=n.getBoundingClientRect();if(b.width<24||b.height<24)errors.push(n.dataset.a+' undersized '+b.width+'x'+b.height);
    if(b.x<v.offsetLeft-.5||b.right>v.offsetLeft+v.width+.5||b.y<v.offsetTop-.5||b.bottom>v.offsetTop+v.height+.5)errors.push(n.dataset.a+' outside viewport');
    for(const [fx,fy] of [[.5,.5],[.18,.3],[.8,.7]]){const target=document.elementFromPoint(b.x+b.width*fx,b.y+b.height*fy)?.closest('[data-a]');if(target!==n)errors.push(n.dataset.a+' occluded by '+target?.dataset.a)}
  }
  const scroll=document.documentElement.scrollWidth;if(scroll>v.width+1)errors.push('horizontal overflow '+scroll);
  return errors;
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const engines=process.env.JARVIS_TEST_BROWSER?[process.env.JARVIS_TEST_BROWSER]:['chromium','webkit'];
  for(const engine of engines){const browser=await ({chromium,webkit})[engine].launch({headless:true,...(process.env.JARVIS_CHROMIUM_PATH&&engine==='chromium'?{executablePath:process.env.JARVIS_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
    try{
      for(const [width,height] of [[390,844],[390,664],[320,568],[430,932],[844,390],[667,375],[932,430],[844,320],[568,320],[1366,768],[1920,1080]]){
        const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'tr-TR',reducedMotion:'reduce'});
        const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/test-fixture');await page.waitForSelector('.jr-layout');await page.waitForFunction(()=>document.querySelector('#jarvisNativeMobileV190')?.dataset.sessionSecurity==='ready');
        await page.evaluate(s=>document.dispatchEvent(new CustomEvent('jarvis:dashboard-state',{detail:s})),state);
        if(process.env.JARVIS_SCREENSHOTS){fs.mkdirSync(process.env.JARVIS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,engine+'-'+width+'x'+height+'-initial.png')})}
        assert.deepEqual(await page.evaluate(geometry),[],engine+' '+width+'x'+height);
        assert.equal(await page.locator('.jr-layout .jr-button').count(),16);
        assert.equal(await page.locator('.jr-sphere-art image').count(),3);
        if(width>height){
          assert.deepEqual(await page.evaluate(()=>['nova','jarvis','orion'].flatMap(name=>{
            const core=document.querySelector('.jr-core.'+name).getBoundingClientRect(),card=document.querySelector('.jr-card.'+name),r=card.getBoundingClientRect();
            return r.left<core.right-1||r.top>=core.bottom||r.bottom<=core.top||card.scrollHeight>card.clientHeight+1?[name+' capability card is not beside sphere or clips text']:[];
          })),[],'wide agent descriptions');
        }
        assert.deepEqual(await page.locator('.jr-meter b').allTextContents(),['—','—','—']);
        assert.equal(await page.locator('[data-connection=pc]').getAttribute('data-online'),'false');
        // Activate the actual visible controls, not their hidden legacy proxies.
        for(const action of ['newTask','youtube','shopify','files','apps','browser','talk','think','apply','done','tasks','feed','connections']){
          await page.locator('.jr-layout [data-a="'+action+'"]').tap();
          const modal=page.locator('.ref-modal');await modal.waitFor({state:'visible'});
          assert.equal(await modal.evaluate(n=>{const b=n.getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),true,action+' modal hit test');
          await page.locator('.ref-modal .ref-actions button').first().tap();await modal.waitFor({state:'hidden'});
        }
        await page.locator('.jr-layout [data-a=mic]').tap();await page.locator('.jr-layout [data-a=listen]').tap();
        assert.equal(await page.evaluate(()=>voiceCalls),2,'each tap must dispatch exactly once');
        await page.locator('.jr-layout [data-a=settings]').tap();await page.locator('#jarvisMobileSessionSecurityV195[data-open="1"]').waitFor();
        await page.locator('button[data-jsv=close]').tap();
        for(const [locale,quick,phone] of [['en-US','QUICK ACCESS','Phone'],['tr-TR','HIZLI ERİŞİM','Telefon']]){
          await page.evaluate(async l=>{await JarvisCockpitI18n.setLocale(l,{translate:false});document.dispatchEvent(new CustomEvent('jarvis:language-changed',{detail:{locale:l}}))},locale);
          assert.equal(await page.locator('.jr-quick h2').textContent(),quick);assert.equal(await page.locator('.jr-link [data-i18n=phone]').textContent(),phone);
          assert.deepEqual(await page.evaluate(geometry),[],'locale '+locale);
        }
        await page.evaluate(async()=>{JarvisCockpitI18n.register('ar',{quick:'وصول سريع',phone:'هاتف'});await JarvisCockpitI18n.setLocale('ar',{translate:false})});
        assert.equal(await page.locator('.jr-layout').getAttribute('data-dir'),'rtl');assert.equal(await page.locator('.jr-quick h2').textContent(),'وصول سريع');
        assert.deepEqual(await page.evaluate(geometry),[],'RTL hit targets');
        await page.evaluate(()=>JarvisCockpitI18n.setLocale('tr-TR',{translate:false}));
        // Simulate device safe-area reservations; emulated WebKit has no notch.
        if(height>=664){await page.addStyleTag({content:'.jr-enhanced .jr-layout{padding-top:47px!important;padding-bottom:34px!important}'});assert.deepEqual(await page.evaluate(geometry),[],'safe-area inset');}
        if(width>height&&width<1000){await page.addStyleTag({content:'.jr-enhanced .jr-layout{padding-left:47px!important;padding-right:47px!important;padding-bottom:21px!important}'});if(process.env.JARVIS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,engine+'-'+width+'x'+height+'-notch.png')});assert.deepEqual(await page.evaluate(geometry),[],'landscape notch/home indicator');}
        for(const s of ['idle','listening','speaking','thinking']){await page.evaluate(v=>document.body.dataset.jarvisCoreState=v,s);await page.waitForFunction(v=>document.querySelector('.jr-enhanced').dataset.state===v,s);}
        assert.equal(await page.locator('.jr-sphere-art').first().evaluate(n=>getComputedStyle(n).animationName),'none','reduced motion');
        if(width===390&&height===844&&process.env.JARVIS_SCREENSHOTS){fs.mkdirSync(process.env.JARVIS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,engine+'-390x844.png')})}
        assert.deepEqual(errors,[],engine+' runtime errors');assert.equal(await page.evaluate(()=>sendCalls),0,'opening UI must not execute commands');
        console.log(engine,width+'x'+height,'PASS: 16 targets, modal dispatch, locales, state, honest telemetry');
        await context.close();
      }
      const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'tr-TR'}),page=await ctx.newPage();
      await page.goto(base+'/test-fixture');await page.waitForSelector('.jr-layout');
      await page.evaluate(()=>window.rotationStage=document.querySelector('.jr-enhanced'));
      for(const size of [{width:844,height:390},{width:1366,height:768},{width:390,height:844}]){
        await page.setViewportSize(size);await page.waitForFunction(()=>Math.abs(document.querySelector('.jr-layout').getBoundingClientRect().height-visualViewport.height)<1);
        assert.deepEqual(await page.evaluate(geometry),[],'rotation '+JSON.stringify(size));
        assert.equal(await page.evaluate(()=>rotationStage===document.querySelector('.jr-enhanced')),true,'rotation must retain DOM/state');
      }
      const idle=await page.locator('.jarvis .jr-sphere-art').evaluate(n=>getComputedStyle(n).animationName);
      await page.evaluate(()=>document.body.dataset.jarvisCoreState='speaking');await page.waitForFunction(()=>document.querySelector('.jr-enhanced').dataset.state==='speaking');
      assert.notEqual(await page.locator('.jarvis .jr-sphere-art').evaluate(n=>getComputedStyle(n).animationName),idle);
      await page.setViewportSize({width:390,height:664});await page.waitForFunction(()=>Math.abs(document.querySelector('.jr-layout').getBoundingClientRect().height-visualViewport.height)<1);assert.deepEqual(await page.evaluate(geometry),[],'dynamic viewport resize');
      // Keyboard viewport: modal remains usable when the visual viewport shrinks.
      await page.locator('.jr-layout [data-a=newTask]').tap();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{value:380,configurable:true});visualViewport.dispatchEvent(new Event('resize'))});await page.waitForFunction(()=>document.querySelector('.ref-modal').getBoundingClientRect().height===380);await page.locator('.ref-modal textarea').fill('Yerel test');
      assert.equal(await page.locator('.ref-modal .ref-actions button').last().isVisible(),true);await page.locator('.ref-modal .ref-actions button').first().tap();
      await ctx.close();
      const real=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
      const app=await real.newPage(),appErrors=[];app.on('pageerror',e=>appErrors.push(e.message));await app.goto(base+'/');await app.waitForSelector('.jr-layout');await app.waitForSelector('#loginOverlay.hidden',{state:'attached'});
      await app.waitForFunction(()=>document.querySelector('.jr-online span')?.textContent==='Sistemler Çevrimiçi');
      assert.deepEqual(await app.evaluate(geometry),[],'actual app loader');assert.deepEqual(appErrors,[],'actual app boot errors');
      if(process.env.JARVIS_SCREENSHOTS)await app.screenshot({path:path.join(process.env.JARVIS_SCREENSHOTS,engine+'-app-390x844.png')});
      await real.close();
      const desktop=await browser.newContext({viewport:{width:1366,height:768},locale:'tr-TR'});
      const desk=await desktop.newPage(),deskErrors=[];desk.on('pageerror',e=>deskErrors.push(e.message));
      await desk.goto(base+'/');await desk.waitForSelector('.jr-layout');await desk.waitForSelector('#loginOverlay.hidden',{state:'attached'});
      assert.deepEqual(await desk.evaluate(geometry),[],'actual desktop app loader');
      await desk.locator('.jr-layout [data-a=newTask]').click();await desk.locator('.ref-modal.open').waitFor();
      await desk.locator('.ref-modal .ref-actions button').first().click();
      await desk.locator('.jr-layout [data-a=settings]').click();await desk.locator('#jarvisMobileSessionSecurityV195[data-open="1"]').waitFor();await desk.locator('button[data-jsv=close]').click();
      assert.deepEqual(deskErrors,[],'desktop runtime errors');await desktop.close();
      console.log(engine,'PASS: animation state and viewport/keyboard resize');
    }finally{await browser.close()}
  }
  assert.equal(writes,0,'presentation must not POST to APIs');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
