const fs=require('fs');
const path=require('path');
const os=require('os');
const http=require('http');
const childProcess=require('child_process');
const finalTarget=require('./jarvis-final-target-verification');

const BROWSER_OPERATOR_VERSION='1.0';
const DEFAULT_PORT=9222;
const DEFAULT_ALLOWED_HOSTS=['studio.youtube.com','youtube.com','www.youtube.com','admin.shopify.com'];

function execFile(exe,args,opts={}){
  return childProcess.execFileSync(exe,args,{
    encoding:'utf8',windowsHide:true,timeout:opts.timeout||15000,
    maxBuffer:opts.maxBuffer||1024*1024*4,stdio:opts.stdio||['ignore','pipe','pipe']
  });
}
function existing(paths){for(const p of paths){try{if(p&&fs.existsSync(p))return p}catch(_){}}return null}
function browserCandidates(){
  const home=os.homedir();
  return[
    {name:'edge',paths:['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']},
    {name:'chrome',paths:['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',path.join(home,'AppData','Local','Google','Chrome','Application','chrome.exe')]},
    {name:'opera gx',paths:[path.join(home,'AppData','Local','Programs','Opera GX','launcher.exe'),path.join(home,'AppData','Local','Programs','Opera GX','opera.exe'),'C:\\Program Files\\Opera GX\\launcher.exe','C:\\Program Files\\Opera GX\\opera.exe']}
  ];
}
function findBrowser(preferred=''){
  const pref=String(preferred||'').toLowerCase().trim(),rows=browserCandidates();
  const ordered=pref?[...rows.filter(x=>x.name===pref),...rows.filter(x=>x.name!==pref)]:rows;
  for(const row of ordered){const exe=existing(row.paths);if(exe)return{name:row.name,exe}}
  return null;
}
function profileDir(workspace){
  const dir=path.join(workspace,'.jarvis-browser-profile');
  fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function allowedHosts(){
  const extra=String(process.env.JARVIS_BROWSER_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return[...new Set([...DEFAULT_ALLOWED_HOSTS,...extra])];
}
function hostAllowed(hostname){
  const host=String(hostname||'').toLowerCase();
  return allowedHosts().some(rule=>host===rule||host.endsWith('.'+rule));
}
function safeUrl(raw){
  const u=new URL(String(raw||'').trim());
  if(!['https:','http:'].includes(u.protocol))throw new Error('Only http/https URLs are allowed');
  if(['127.0.0.1','localhost'].includes(u.hostname))return u.toString();
  if(!hostAllowed(u.hostname))throw new Error('Host is outside JARVIS browser allowlist: '+u.hostname);
  return u.toString();
}
function getJson(url,timeout=2500){
  return new Promise((resolve,reject)=>{
    const req=http.get(url,{timeout},res=>{
      let body='';res.on('data',x=>body+=x);res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300)return reject(new Error('HTTP '+res.statusCode));
        try{resolve(JSON.parse(body))}catch(e){reject(e)}
      });
    });
    req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);
  });
}
async function status(workspace,port=DEFAULT_PORT){
  let version=null,tabs=[];
  try{version=await getJson('http://127.0.0.1:'+port+'/json/version')}catch(_){}
  if(version){try{tabs=await getJson('http://127.0.0.1:'+port+'/json/list')}catch(_){}}
  const browser=findBrowser(process.env.JARVIS_BROWSER||'');
  return{
    ok:true,version:BROWSER_OPERATOR_VERSION,running:!!version,
    browser:version&&version.Browser||browser&&browser.name||null,
    executable:browser&&browser.exe||null,port,profile:profileDir(workspace),
    tabs:Array.isArray(tabs)?tabs.filter(x=>x&&x.type==='page').map(x=>({id:x.id,title:x.title,url:x.url})).slice(0,20):[],
    allowedHosts:allowedHosts()
  };
}
async function waitReady(port=DEFAULT_PORT,timeoutMs=12000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    try{const v=await getJson('http://127.0.0.1:'+port+'/json/version',1000);if(v&&v.webSocketDebuggerUrl)return v}catch(_){}
    await new Promise(r=>setTimeout(r,300));
  }
  throw new Error('Browser debugging endpoint did not become ready');
}
async function start(workspace,{preferred='',port=DEFAULT_PORT,url='https://www.youtube.com/'}={}){
  if(process.platform!=='win32')throw new Error('JARVIS Browser Operator currently requires Windows');
  const current=await status(workspace,port),target=safeUrl(url);
  if(current.running){
    const page=await activePage(port);
    runCdpPowerShell(page.webSocketDebuggerUrl,'Page.navigate',{url:target});
    await new Promise(r=>setTimeout(r,500));
    return{...current,opened:target,reused:true};
  }
  const browser=findBrowser(preferred||process.env.JARVIS_BROWSER||'');
  if(!browser)throw new Error('Chrome, Edge veya Opera GX bulunamadı');
  const profile=profileDir(workspace);
  const args=['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-features=TranslateUI',target];
  childProcess.spawn(browser.exe,args,{detached:true,windowsHide:true,stdio:'ignore'}).unref();
  const v=await waitReady(port);
  return{ok:true,version:BROWSER_OPERATOR_VERSION,running:true,browser:v.Browser||browser.name,executable:browser.exe,port,profile,opened:target,reused:false,allowedHosts:allowedHosts()};
}
function psQuote(x){return String(x).replace(/'/g,"''")}
async function activePage(port=DEFAULT_PORT){
  const tabs=await getJson('http://127.0.0.1:'+port+'/json/list',2500);
  const pages=Array.isArray(tabs)?tabs.filter(x=>x&&x.type==='page'&&x.webSocketDebuggerUrl):[];
  if(!pages.length)throw new Error('No browser page available');
  return pages[0];
}
function runCdpPowerShell(wsUrl,method,params={},timeoutMs=12000){
  if(process.platform!=='win32')throw new Error('CDP bridge requires Windows PowerShell');
  const payload=JSON.stringify({id:1,method,params});
  const script=[
    "$ErrorActionPreference='Stop'",
    "$uri=[Uri]'"+psQuote(wsUrl)+"'",
    "$json='"+psQuote(payload)+"'",
    "$ws=[System.Net.WebSockets.ClientWebSocket]::new()",
    "$ct=[Threading.CancellationToken]::None",
    "$ws.ConnectAsync($uri,$ct).GetAwaiter().GetResult()",
    "$bytes=[Text.Encoding]::UTF8.GetBytes($json)",
    "$seg=[ArraySegment[byte]]::new($bytes)",
    "$ws.SendAsync($seg,[System.Net.WebSockets.WebSocketMessageType]::Text,$true,$ct).GetAwaiter().GetResult()",
    "$buf=New-Object byte[] 1048576",
    "$ms=[IO.MemoryStream]::new()",
    "do{$r=$ws.ReceiveAsync([ArraySegment[byte]]::new($buf),$ct).GetAwaiter().GetResult();$ms.Write($buf,0,$r.Count)}while(-not $r.EndOfMessage)",
    "$txt=[Text.Encoding]::UTF8.GetString($ms.ToArray())",
    "$ws.Dispose()",
    "Write-Output $txt"
  ].join(';');
  const out=execFile('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{timeout:timeoutMs,maxBuffer:1024*1024*2}).trim();
  const obj=JSON.parse(out||'{}');if(obj.error)throw new Error('CDP '+method+': '+JSON.stringify(obj.error));return obj.result||{};
}
async function evaluate(workspace,expression,{port=DEFAULT_PORT}={}){
  const s=await status(workspace,port);if(!s.running)throw new Error('Browser Operator is not running');
  const page=await activePage(port);
  const result=runCdpPowerShell(page.webSocketDebuggerUrl,'Runtime.evaluate',{expression:String(expression||''),returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails)throw new Error('Browser script failed');
  return result.result&&Object.prototype.hasOwnProperty.call(result.result,'value')?result.result.value:null;
}
async function pageSnapshot(workspace,{port=DEFAULT_PORT}={}){
  const expression="(()=>{const p=location.pathname.split('/').filter(Boolean);const ci=p.indexOf('channel'),si=p.indexOf('store');const accountEl=[...document.querySelectorAll('[aria-label]')].find(e=>/@/.test(e.getAttribute('aria-label')||'')&&/(account|hesap|google)/i.test(e.getAttribute('aria-label')||''));return{title:document.title,url:location.href,targetEvidence:{account:accountEl?accountEl.getAttribute('aria-label'):'',target:ci>=0?(p[ci+1]||''):si>=0?(p[si+1]||''):''},text:(document.body&&document.body.innerText||'').replace(/\\\\s+/g,' ').slice(0,12000),forms:[...document.querySelectorAll('form')].slice(0,12).map(f=>({action:f.action,controls:[...f.querySelectorAll('input,textarea,select,button')].slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.type||'',name:el.name||'',id:el.id||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',text:(el.tagName==='BUTTON'||el.type==='submit'?String(el.innerText||el.value||''):'').slice(0,120)}))}))}})()";
  const value=await evaluate(workspace,expression,{port});return{ok:true,...value};
}
async function navigate(workspace,url,{port=DEFAULT_PORT}={}){
  const target=safeUrl(url),s=await status(workspace,port);
  if(!s.running)await start(workspace,{port,url:target});
  const page=await activePage(port);runCdpPowerShell(page.webSocketDebuggerUrl,'Page.navigate',{url:target});
  await new Promise(r=>setTimeout(r,900));return pageSnapshot(workspace,{port});
}
async function clickByText(workspace,text,{port=DEFAULT_PORT}={}){
  const needle=String(text||'').trim();if(!needle)throw new Error('text required');
  const encoded=JSON.stringify(needle);
  const selector=JSON.stringify('button,a,[role="button"],input[type="submit"]');
  const expr=[
    "(()=>{",
    "const n="+encoded+".toLocaleLowerCase('tr-TR');",
    "const els=[...document.querySelectorAll("+selector+")];",
    "const label=x=>String(x.innerText||x.value||x.getAttribute('aria-label')||'').trim().toLocaleLowerCase('tr-TR');",
    "const e=els.find(x=>label(x)===n)||els.find(x=>label(x).includes(n));",
    "if(!e)return{ok:false};",
    "e.scrollIntoView({block:'center'});e.click();",
    "return{ok:true,tag:e.tagName,text:String(e.innerText||e.value||'').slice(0,160)}",
    "})()"
  ].join('');
  return evaluate(workspace,expr,{port});
}
async function verifiedFinalClick(workspace,text,contract,{port=DEFAULT_PORT,receipt=null}={}){
  const snap=await pageSnapshot(workspace,{port});
  const proof=receipt||finalTarget.verifyFinalTarget(contract,snap);
  finalTarget.assertReceipt(proof,contract,snap);
  const result=await clickByText(workspace,text,{port});
  return{...result,verification:{bindingHash:proof.bindingHash,verifiedAt:proof.verifiedAt,expiresAt:proof.expiresAt,approvalGranted:false}};
}
async function setField(workspace,label,value,{port=DEFAULT_PORT}={}){
  const key=String(label||'').trim(),val=String(value??'');if(!key)throw new Error('label required');
  const controlSelector=JSON.stringify('input:not([type="hidden"]),textarea,select,[contenteditable="true"]');
  const expr=[
    "(()=>{",
    "const key="+JSON.stringify(key)+".toLocaleLowerCase('tr-TR');",
    "const val="+JSON.stringify(val)+";",
    "const all=[...document.querySelectorAll("+controlSelector+")];",
    "function labelText(el){",
    "const a=el.getAttribute('aria-label')||'';const p=el.getAttribute('placeholder')||'';const n=el.getAttribute('name')||'';const id=el.id||'';let l='';",
    "if(id){const x=document.querySelector('label[for=\\\"'+CSS.escape(id)+'\\\"]');if(x)l=x.innerText||''}",
    "return[a,p,n,l].join(' ').toLocaleLowerCase('tr-TR')",
    "}",
    "const el=all.find(x=>labelText(x).includes(key));if(!el)return{ok:false};",
    "el.scrollIntoView({block:'center'});el.focus();",
    "if(el.tagName==='SELECT'){const opt=[...el.options].find(o=>String(o.textContent||o.value).toLocaleLowerCase('tr-TR').includes(val.toLocaleLowerCase('tr-TR')));if(!opt)return{ok:false,reason:'option-not-found'};el.value=opt.value}",
    "else if(el.isContentEditable){el.textContent=val}",
    "else{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');if(d&&d.set)d.set.call(el,val);else el.value=val}",
    "el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));",
    "return{ok:true,tag:el.tagName,name:el.name||'',id:el.id||''}",
    "})()"
  ].join('');
  return evaluate(workspace,expr,{port});
}
async function uploadFile(workspace,selector,filePath,{port=DEFAULT_PORT}={}){
  const full=path.resolve(filePath);if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Upload file not found');
  const page=await activePage(port),doc=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.getDocument',{depth:1}),rootId=doc.root&&doc.root.nodeId;
  if(!rootId)throw new Error('DOM root unavailable');
  const query=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.querySelector',{nodeId:rootId,selector:String(selector||'input[type=file]')});
  if(!query.nodeId)throw new Error('File input not found');
  runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.setFileInputFiles',{nodeId:query.nodeId,files:[full]});return{ok:true,file:full};
}
module.exports={BROWSER_OPERATOR_VERSION,DEFAULT_PORT,findBrowser,allowedHosts,hostAllowed,safeUrl,profileDir,status,start,pageSnapshot,navigate,evaluate,clickByText,verifiedFinalClick,setField,uploadFile};
