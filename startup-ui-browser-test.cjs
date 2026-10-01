// Browser-level UI regression with explicit health/session fixtures, never production credentials.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{
   const file=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1);
   if(!['index.html','style.css','manifest.webmanifest','sw.js'].includes(file)){res.writeHead(404);return res.end()}
   res.setHeader('content-type',file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/javascript');
   res.end(fs.readFileSync(path.join(__dirname,'public',file)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
   browser=await chromium.launch(process.platform==='win32'?{channel:'msedge',headless:true}:{headless:true});
   const context=await browser.newContext({viewport:{width:1366,height:768},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'});
   let online=false,cloud=true,authorized=true;
   const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
     const url=route.request().url();
     if(!cloud)return route.abort();
     if(url.includes('/api/state'))return route.fulfill({json:{workers:{pc:{online:false}},tasks:[],audit:[],brain:{zeroCostOnly:true}}});
     if(url.includes('/session/'))return route.fulfill({status:authorized?200:401,json:{ok:authorized}});
     return route.fulfill({json:{ok:true,enabled:false}});
   });
   await page.route('http://127.0.0.1:8765/**',async route=>{
     if(!online)return route.abort();
     const health={ok:true,version:'2.73.0',capabilities:['local_memory']};
     return route.fulfill({json:route.request().url().endsWith('/health')?health:{ok:true,aliases:{}}});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/?startup=1');
   await page.waitForFunction(()=>document.querySelector('#coreTitle').textContent==='Bilgisayar bağlantısı yok');
   await page.waitForFunction(()=>connectionState.cloud===true&&document.querySelector('#loginOverlay').classList.contains('hidden'));
   assert.equal(await page.locator('.side-panel').first().isVisible(),false);
   assert.equal(await page.locator('#cloudDot').getAttribute('class'),'dot online');
   assert.equal(await page.locator('#loginOverlay').isVisible(),false);
   await page.screenshot({path:path.join(process.env.RUNNER_TEMP||'/tmp','jarvis-ui-offline.png')});
   online=true;
   await page.evaluate(()=>refreshLocalWorkerHealth());
   await page.waitForFunction(()=>document.querySelector('#coreTitle').textContent==='Bilgisayar bağlı');
   assert.match(await page.locator('#connectionSummary').innerText(),/Yerel bağlantı ve bulut/);
   await page.locator('#detailsToggle').click();
   assert.equal(await page.locator('.side-panel').first().isVisible(),true);
   assert.equal(await page.locator('#detailsToggle').getAttribute('aria-expanded'),'true');
   await page.locator('#detailsToggle').click();
   for(const size of [{width:1366,height:768},{width:1024,height:768},{width:390,height:844}]){
     await page.setViewportSize(size);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');
     const box=await page.locator('#cmd').boundingBox();
     assert.ok(box.x>=0&&box.x+box.width<=size.width&&box.y+box.height<=size.height,'Input outside viewport');
     await page.screenshot({path:path.join(process.env.RUNNER_TEMP||'/tmp',`jarvis-ui-${size.width}.png`)});
   }
   cloud=false;
   await page.evaluate(()=>load().catch(handleCloudFailure));
   assert.equal(await page.locator('#coreTitle').innerText(),'Bilgisayar bağlı');
   assert.equal(await page.locator('#cloudDot').getAttribute('class'),'dot offline');
   assert.equal(await page.locator('#loginOverlay').isVisible(),false,'Network failure should not invalidate an existing session');
   online=false;
   await page.evaluate(()=>refreshLocalWorkerHealth());
   assert.equal(await page.locator('#coreTitle').innerText(),'Bilgisayar bağlantısı yok');
   await page.evaluate(()=>handleCloudFailure(new Error('ACCESS DENIED')));
   assert.equal(await page.locator('#loginOverlay').isVisible(),true,'Authentication must still be enforced');
   assert.deepEqual(errors,[]);
   console.log('BROWSER PASS: offline/online, cloud loss, auth, details and 3 screen sizes');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
