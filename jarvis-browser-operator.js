const fs=require('fs');
const path=require('path');
const os=require('os');
const http=require('http');
const childProcess=require('child_process');
const finalTarget=require('./jarvis-final-target-verification');

const BROWSER_OPERATOR_VERSION='1.1';
const BROWSER_AUTOFILL_VERSION='1.0';
// Runtime rollout compatibility for Worker 2.102.0 sync probe only: BROWSER_OPERATOR_VERSION='1.0'
const DEFAULT_PORT=9222;
const DEFAULT_ALLOWED_HOSTS=['*'];
const AUTOFILL_PROFILE_VERSION=1;
const AUTOFILL_FIELD_KEYS=['first_name','last_name','full_name','email','phone','company','job_title','website','city','country'];
const AUTOFILL_SENSITIVE_RE=/(?:password|passcode|parola|şifre|sifre|pin\b|otp|one\s*time|tek\s*kullanımlık|doğrulama\s*kodu|dogrulama\s*kodu|verification\s*code|token|secret|api\s*key|api[_-]?key|cvv|cvc|card\s*number|kart\s*numarası|kart\s*numarasi|iban|bank\s*account|banka\s*hesap|kredi\s*kart|ssn|social\s*security|t\.?\s*c\.?\s*kimlik|tc\s*kimlik|tckn|passport|pasaport|tax\s*id|vergi\s*(?:no|numara)|birth|birthday|doğum|dogum|security\s*answer|güvenlik\s*cevab|guvenlik\s*cevab)/i;

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
  return DEFAULT_ALLOWED_HOSTS.slice();
}
function hostAllowed(hostname){
  const host=String(hostname||'').trim();
  if(!host)return false;
  try{
    const u=new URL('https://'+host);
    return !!u.hostname;
  }catch(_){return false}
}
function safeUrl(raw){
  const u=new URL(String(raw||'').trim());
  if(!['https:','http:'].includes(u.protocol))throw new Error('Only http/https URLs are allowed');
  if(!hostAllowed(u.hostname))throw new Error('Invalid browser hostname');
  return u.toString();
}
function autofillProfilePath(workspace){
  const root=path.resolve(String(workspace||process.cwd()));
  return path.join(root,'.jarvis-memory','browser-autofill-profile.json');
}
function normalizeAutofillLabel(value){
  return String(value||'')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9çğıöşü]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function classifyAutofillField(label){
  const raw=String(label||'').trim();
  if(!raw||AUTOFILL_SENSITIVE_RE.test(raw))return null;
  const text=' '+normalizeAutofillLabel(raw)+' ';
  if(/\b(?:e ?mail|email|eposta|e posta)\b/i.test(text))return'email';
  if(/\b(?:telefon|phone|mobile|gsm|cep telefonu|tel)\b/i.test(text))return'phone';
  if(/\b(?:organization title|organisation title|job title|position|role|title|ünvan|unvan|pozisyon|görev|gorev)\b/i.test(text))return'job_title';
  if(/\b(?:company|company name|organization|organisation|business|şirket|sirket|firma|kurum)\b/i.test(text))return'company';
  if(/\b(?:website|web site|web sitesi|homepage|personal site)\b/i.test(text)||/\burl\b/i.test(text))return'website';
  if(/\b(?:city|şehir|sehir|address level2)\b/i.test(text))return'city';
  if(/\b(?:country|country name|ülke|ulke)\b/i.test(text))return'country';
  if(/\b(?:last name|surname|family name|soyad|soy isim|soyisim)\b/i.test(text))return'last_name';
  if(/\b(?:full name|name surname|ad soyad|ad ve soyad|isim soyisim|isim soyad)\b/i.test(text))return'full_name';
  if(/\b(?:first name|given name|adiniz|adınız|isim)\b/i.test(text)&&!/\b(?:soyad|last name|surname)\b/i.test(text))return'first_name';
  if(['ad','isim','name','your name'].includes(normalizeAutofillLabel(raw)))return'full_name';
  return null;
}
function emptyAutofillProfile(){return{version:AUTOFILL_PROFILE_VERSION,updatedAt:null,fields:{}}}
function readAutofillProfile(workspace){
  const file=autofillProfilePath(workspace);
  try{
    if(!fs.existsSync(file))return emptyAutofillProfile();
    const parsed=JSON.parse(fs.readFileSync(file,'utf8')),fields={};
    if(parsed&&parsed.fields&&typeof parsed.fields==='object'){
      for(const key of AUTOFILL_FIELD_KEYS){
        const row=parsed.fields[key],value=String(row&&row.value||'').trim();
        if(!value)continue;
        fields[key]={value:value.slice(0,320),sourceLabel:String(row&&row.sourceLabel||'').replace(/[\r\n]+/g,' ').trim().slice(0,160),updatedAt:String(row&&row.updatedAt||'').slice(0,40)||null};
      }
    }
    return{version:AUTOFILL_PROFILE_VERSION,updatedAt:String(parsed&&parsed.updatedAt||'').slice(0,40)||null,fields};
  }catch(_){return emptyAutofillProfile()}
}
function writeAutofillProfile(workspace,profile){
  const file=autofillProfilePath(workspace),dir=path.dirname(file),clean=emptyAutofillProfile();
  fs.mkdirSync(dir,{recursive:true});
  clean.updatedAt=new Date().toISOString();
  for(const key of AUTOFILL_FIELD_KEYS){
    const row=profile&&profile.fields&&profile.fields[key],value=String(row&&row.value||'').trim();
    if(!value)continue;
    clean.fields[key]={value:value.slice(0,320),sourceLabel:String(row&&row.sourceLabel||'').replace(/[\r\n]+/g,' ').trim().slice(0,160),updatedAt:String(row&&row.updatedAt||clean.updatedAt).slice(0,40)};
  }
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(clean,null,2),'utf8');
  try{fs.chmodSync(tmp,0o600)}catch(_){}
  fs.renameSync(tmp,file);
  try{fs.chmodSync(file,0o600)}catch(_){}
  return clean;
}
function learnAutofillValue(workspace,label,value){
  const key=classifyAutofillField(label),val=String(value??'').replace(/\u0000/g,'').trim().slice(0,320);
  if(!key||!val)return{stored:false,key:null};
  const profile=readAutofillProfile(workspace),now=new Date().toISOString();
  profile.fields[key]={value:val,sourceLabel:String(label||'').replace(/[\r\n]+/g,' ').trim().slice(0,160),updatedAt:now};
  writeAutofillProfile(workspace,profile);
  return{stored:true,key};
}
function forgetAutofillField(workspace,key){
  const canonical=String(key||'').trim();
  if(!AUTOFILL_FIELD_KEYS.includes(canonical))return{removed:false,key:canonical};
  const profile=readAutofillProfile(workspace),existed=!!profile.fields[canonical];
  delete profile.fields[canonical];
  writeAutofillProfile(workspace,profile);
  return{removed:existed,key:canonical};
}
function clearAutofillProfile(workspace){
  const file=autofillProfilePath(workspace);
  try{if(fs.existsSync(file))fs.unlinkSync(file)}catch(_){}
  return{cleared:true};
}
function autofillProfileSummary(workspace){
  const profile=readAutofillProfile(workspace),keys=Object.keys(profile.fields).filter(x=>AUTOFILL_FIELD_KEYS.includes(x));
  return{version:AUTOFILL_PROFILE_VERSION,count:keys.length,keys,updatedAt:profile.updatedAt};
}
function autofillValues(workspace){
  const profile=readAutofillProfile(workspace),out={};
  for(const key of AUTOFILL_FIELD_KEYS){const value=String(profile.fields[key]&&profile.fields[key].value||'').trim();if(value)out[key]=value}
  return out;
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
  return{ok:true,version:BROWSER_OPERATOR_VERSION,running:!!version,browser:version&&version.Browser||browser&&browser.name||null,executable:browser&&browser.exe||null,port,profile:profileDir(workspace),tabs:Array.isArray(tabs)?tabs.filter(x=>x&&x.type==='page').map(x=>({id:x.id,title:x.title,url:x.url})).slice(0,20):[],allowedHosts:allowedHosts(),anyHttpSite:true,safeAutofill:autofillProfileSummary(workspace)};
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
    const page=await activePage(port);runCdpPowerShell(page.webSocketDebuggerUrl,'Page.navigate',{url:target});await new Promise(r=>setTimeout(r,500));return{...current,opened:target,reused:true};
  }
  const browser=findBrowser(preferred||process.env.JARVIS_BROWSER||'');
  if(!browser)throw new Error('Chrome, Edge veya Opera GX bulunamadı');
  const profile=profileDir(workspace);
  const args=['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-features=TranslateUI',target];
  childProcess.spawn(browser.exe,args,{detached:true,windowsHide:true,stdio:'ignore'}).unref();
  const v=await waitReady(port);
  return{ok:true,version:BROWSER_OPERATOR_VERSION,running:true,browser:v.Browser||browser.name,executable:browser.exe,port,profile,opened:target,reused:false,allowedHosts:allowedHosts(),anyHttpSite:true,safeAutofill:autofillProfileSummary(workspace)};
}
function psQuote(x){return String(x).replace(/'/g,"''")}
async function activePage(port=DEFAULT_PORT){
  const tabs=await getJson('http://127.0.0.1:'+port+'/json/list',2500),pages=Array.isArray(tabs)?tabs.filter(x=>x&&x.type==='page'&&x.webSocketDebuggerUrl):[];
  if(!pages.length)throw new Error('No browser page available');
  return pages[0];
}
function runCdpPowerShell(wsUrl,method,params={},timeoutMs=12000){
  if(process.platform!=='win32')throw new Error('CDP bridge requires Windows PowerShell');
  const payload=JSON.stringify({id:1,method,params});
  const script=["$ErrorActionPreference='Stop'","$uri=[Uri]'"+psQuote(wsUrl)+"'","$json='"+psQuote(payload)+"'","$ws=[System.Net.WebSockets.ClientWebSocket]::new()","$ct=[Threading.CancellationToken]::None","$ws.ConnectAsync($uri,$ct).GetAwaiter().GetResult()","$bytes=[Text.Encoding]::UTF8.GetBytes($json)","$seg=[ArraySegment[byte]]::new($bytes)","$ws.SendAsync($seg,[System.Net.WebSockets.WebSocketMessageType]::Text,$true,$ct).GetAwaiter().GetResult()","$buf=New-Object byte[] 1048576","$ms=[IO.MemoryStream]::new()","do{$r=$ws.ReceiveAsync([ArraySegment[byte]]::new($buf),$ct).GetAwaiter().GetResult();$ms.Write($buf,0,$r.Count)}while(-not $r.EndOfMessage)","$txt=[Text.Encoding]::UTF8.GetString($ms.ToArray())","$ws.Dispose()","Write-Output $txt"].join(';');
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
  const expression="(()=>{const p=location.pathname.split('/').filter(Boolean);const ci=p.indexOf('channel'),si=p.indexOf('store');const accountEl=[...document.querySelectorAll('[aria-label]')].find(e=>/@/.test(e.getAttribute('aria-label')||'')&&/(account|hesap|google)/i.test(e.getAttribute('aria-label')||''));return{title:document.title,url:location.href,targetEvidence:{account:accountEl?accountEl.getAttribute('aria-label'):'',target:ci>=0?(p[ci+1]||''):si>=0?(p[si+1]||''):''},text:(document.body&&document.body.innerText||'').replace(/\\s+/g,' ').slice(0,12000),forms:[...document.querySelectorAll('form')].slice(0,12).map(f=>({action:f.action,controls:[...f.querySelectorAll('input,textarea,select,button')].slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.type||'',name:el.name||'',id:el.id||'',autocomplete:el.getAttribute('autocomplete')||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',text:(el.tagName==='BUTTON'||el.type==='submit'?String(el.innerText||el.value||''):'').slice(0,120)}))}))}})()";
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
  const encoded=JSON.stringify(needle),selector=JSON.stringify('button,a,[role="button"],input[type="submit"]');
  const expr=["(()=>{","const n="+encoded+".toLocaleLowerCase('tr-TR');","const els=[...document.querySelectorAll("+selector+")];","const label=x=>String(x.innerText||x.value||x.getAttribute('aria-label')||'').trim().toLocaleLowerCase('tr-TR');","const e=els.find(x=>label(x)===n)||els.find(x=>label(x).includes(n));","if(!e)return{ok:false};","e.scrollIntoView({block:'center'});e.click();","return{ok:true,tag:e.tagName,text:String(e.innerText||e.value||'').slice(0,160)}","})()"].join('');
  return evaluate(workspace,expr,{port});
}
async function verifiedFinalClick(workspace,text,contract,{port=DEFAULT_PORT,receipt=null}={}){
  const snap=await pageSnapshot(workspace,{port}),proof=receipt||finalTarget.verifyFinalTarget(contract,snap);
  finalTarget.assertReceipt(proof,contract,snap);
  const result=await clickByText(workspace,text,{port});
  return{...result,verification:{bindingHash:proof.bindingHash,verifiedAt:proof.verifiedAt,expiresAt:proof.expiresAt,approvalGranted:false}};
}
function browserAutofillExpression(values){
  const safe={};for(const key of AUTOFILL_FIELD_KEYS){const value=String(values&&values[key]||'').trim().slice(0,320);if(value)safe[key]=value}
  return[
    "(()=>{",
    "const profile="+JSON.stringify(safe)+";",
    "const blocked=/(?:password|passcode|parola|şifre|sifre|pin\\b|otp|one\\s*time|tek\\s*kullanımlık|doğrulama\\s*kodu|dogrulama\\s*kodu|verification\\s*code|token|secret|api\\s*key|cvv|cvc|card\\s*number|kart\\s*numarası|kart\\s*numarasi|iban|bank\\s*account|banka\\s*hesap|ssn|social\\s*security|tc\\s*kimlik|tckn|passport|pasaport|birth|birthday|doğum|dogum)/i;",
    "const norm=x=>String(x||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9çğıöşü]+/gi,' ').replace(/\\s+/g,' ').trim();",
    "function labels(el){let l='';const id=el.id||'';if(id){const x=document.querySelector('label[for=\\\"'+CSS.escape(id)+'\\\"]');if(x)l=x.innerText||''}return[el.getAttribute('autocomplete')||'',el.getAttribute('aria-label')||'',el.getAttribute('placeholder')||'',el.getAttribute('name')||'',id,l].join(' ')}",
    "function kind(raw){if(!raw||blocked.test(raw))return null;const n=norm(raw),t=' '+n+' ';if(/\\b(?:e ?mail|email|eposta|e posta)\\b/i.test(t))return'email';if(/\\b(?:telefon|phone|mobile|gsm|cep telefonu|tel)\\b/i.test(t))return'phone';if(/\\b(?:organization title|organisation title|job title|position|role|title|ünvan|unvan|pozisyon|görev|gorev)\\b/i.test(t))return'job_title';if(/\\b(?:company|company name|organization|organisation|business|şirket|sirket|firma|kurum)\\b/i.test(t))return'company';if(/\\b(?:website|web site|web sitesi|homepage|personal site)\\b/i.test(t)||/\\burl\\b/i.test(t))return'website';if(/\\b(?:city|şehir|sehir|address level2)\\b/i.test(t))return'city';if(/\\b(?:country|country name|ülke|ulke)\\b/i.test(t))return'country';if(/\\b(?:last name|surname|family name|soyad|soy isim|soyisim)\\b/i.test(t))return'last_name';if(/\\b(?:full name|name surname|ad soyad|ad ve soyad|isim soyisim|isim soyad)\\b/i.test(t))return'full_name';if(/\\b(?:first name|given name|adiniz|adınız|isim)\\b/i.test(t)&&!/\\b(?:soyad|last name|surname)\\b/i.test(t))return'first_name';if(['ad','isim','name','your name'].includes(n))return'full_name';return null}",
    "const controls=[...document.querySelectorAll('input:not([type=\\\"hidden\\\"]),textarea,select,[contenteditable=\\\"true\\\"]')];const filled=[],skipped=[];",
    "for(const el of controls){const type=String(el.type||'').toLowerCase();if(['password','file','submit','button','reset','checkbox','radio'].includes(type)||el.disabled||el.readOnly)continue;const meta=labels(el);if(blocked.test(meta))continue;const k=kind(meta),val=k&&profile[k];if(!k||!val)continue;const existing=el.isContentEditable?String(el.textContent||'').trim():String(el.value||'').trim();if(existing){skipped.push(k);continue}try{if(el.tagName==='SELECT'){const opts=[...el.options];const n=norm(val);const opt=opts.find(o=>norm(o.value)===n||norm(o.textContent)===n)||opts.find(o=>norm(o.textContent).includes(n)||n.includes(norm(o.textContent)));if(!opt)continue;el.value=opt.value}else if(el.isContentEditable){el.textContent=val}else{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');if(d&&d.set)d.set.call(el,val);else el.value=val}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push(k)}catch(_){}}",
    "return{ok:true,filled:[...new Set(filled)],skipped:[...new Set(skipped)]}",
    "})()"
  ].join('');
}
async function autofillSafeProfile(workspace,{port=DEFAULT_PORT}={}){
  const values=autofillValues(workspace);
  if(!Object.keys(values).length)return{ok:true,filled:[],skipped:[],profileEmpty:true};
  const out=await evaluate(workspace,browserAutofillExpression(values),{port});
  return out&&typeof out==='object'?out:{ok:false,filled:[],skipped:[]};
}
async function setField(workspace,label,value,{port=DEFAULT_PORT,learn=true,autofill=true}={}){
  const key=String(label||'').trim(),val=String(value??'');if(!key)throw new Error('label required');
  const controlSelector=JSON.stringify('input:not([type="hidden"]),textarea,select,[contenteditable="true"]');
  const expr=["(()=>{","const key="+JSON.stringify(key)+".toLocaleLowerCase('tr-TR');","const val="+JSON.stringify(val)+";","const all=[...document.querySelectorAll("+controlSelector+")];","function labelText(el){","const a=el.getAttribute('aria-label')||'';const p=el.getAttribute('placeholder')||'';const n=el.getAttribute('name')||'';const ac=el.getAttribute('autocomplete')||'';const id=el.id||'';let l='';","if(id){const x=document.querySelector('label[for=\\\"'+CSS.escape(id)+'\\\"]');if(x)l=x.innerText||''}","return[ac,a,p,n,l].join(' ').toLocaleLowerCase('tr-TR')","}","const el=all.find(x=>labelText(x).includes(key));if(!el)return{ok:false};","el.scrollIntoView({block:'center'});el.focus();","if(el.tagName==='SELECT'){const opt=[...el.options].find(o=>String(o.textContent||o.value).toLocaleLowerCase('tr-TR').includes(val.toLocaleLowerCase('tr-TR')));if(!opt)return{ok:false,reason:'option-not-found'};el.value=opt.value}","else if(el.isContentEditable){el.textContent=val}","else{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');if(d&&d.set)d.set.call(el,val);else el.value=val}","el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));","return{ok:true,tag:el.tagName,name:el.name||'',id:el.id||''}","})()"].join('');
  const result=await evaluate(workspace,expr,{port});
  if(!result||result.ok!==true)return result;
  const learned=learn?learnAutofillValue(workspace,key,val):{stored:false,key:null};
  const auto=autofill?await autofillSafeProfile(workspace,{port}):{ok:true,filled:[],skipped:[]};
  return{...result,learned:{stored:!!learned.stored,key:learned.key||null},autofill:{filled:Array.isArray(auto&&auto.filled)?auto.filled:[],skipped:Array.isArray(auto&&auto.skipped)?auto.skipped:[]}};
}
async function uploadFile(workspace,selector,filePath,{port=DEFAULT_PORT}={}){
  const full=path.resolve(filePath);if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Upload file not found');
  const page=await activePage(port),doc=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.getDocument',{depth:1}),rootId=doc.root&&doc.root.nodeId;
  if(!rootId)throw new Error('DOM root unavailable');
  const query=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.querySelector',{nodeId:rootId,selector:String(selector||'input[type=file]')});
  if(!query.nodeId)throw new Error('File input not found');
  runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.setFileInputFiles',{nodeId:query.nodeId,files:[full]});return{ok:true,file:full};
}
module.exports={BROWSER_OPERATOR_VERSION,BROWSER_AUTOFILL_VERSION,DEFAULT_PORT,AUTOFILL_PROFILE_VERSION,AUTOFILL_FIELD_KEYS,findBrowser,allowedHosts,hostAllowed,safeUrl,profileDir,status,start,pageSnapshot,navigate,evaluate,clickByText,verifiedFinalClick,setField,uploadFile,autofillProfilePath,normalizeAutofillLabel,classifyAutofillField,readAutofillProfile,learnAutofillValue,forgetAutofillField,clearAutofillProfile,autofillProfileSummary,autofillSafeProfile};
