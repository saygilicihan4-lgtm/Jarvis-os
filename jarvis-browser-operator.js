const fs=require('fs');
const path=require('path');
const os=require('os');
const http=require('http');
const childProcess=require('child_process');
const finalTarget=require('./jarvis-final-target-verification');

const BROWSER_OPERATOR_VERSION='1.2';
// Runtime rollout compatibility for Worker 2.102.0 sync probe only: BROWSER_OPERATOR_VERSION='1.0'
const DEFAULT_PORT=9222;
const DEFAULT_ALLOWED_HOSTS=['*'];
const AUTOFILL_SCHEMA=1;
const AUTOFILL_FIELDS=['fullName','firstName','lastName','email','phone','company','jobTitle','website','address1','address2','city','state','postalCode','country'];

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
function autofillProfileFile(){
  const override=String(process.env.JARVIS_AUTOFILL_PROFILE_FILE||'').trim();
  if(override)return path.resolve(override);
  if(process.platform==='win32'){
    const base=String(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'));
    return path.join(base,'JARVIS-OS','browser-autofill-v1.json');
  }
  return path.join(os.homedir(),'.jarvis-os','browser-autofill-v1.json');
}
function emptyAutofillProfile(){return{schema:AUTOFILL_SCHEMA,updatedAt:null,fields:{}}}
function normalizeAutofillText(value){
  return String(value||'')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u')
    .replace(/[_-]+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function isSensitiveAutofillDescriptor(value,meta={}){
  const type=normalizeAutofillText(meta.type||'');
  if(['password','file','hidden'].includes(type))return true;
  const d=normalizeAutofillText([value,meta.name,meta.id,meta.placeholder,meta.aria,meta.autocomplete].filter(Boolean).join(' '));
  return /(?:password|parola|sifre|otp|one time|verification code|dogrulama kod|security code|recovery code|2fa|mfa|pin|cvv|cvc|card number|credit card|kredi kart|iban|bank account|banka hesab|routing number|swift|ssn|social security|tc kimlik|tckn|kimlik no|identity number|passport|pasaport|api key|access token|secret|private key)/.test(d);
}
function classifyAutofillField(label,meta={}){
  if(isSensitiveAutofillDescriptor(label,meta))return null;
  const ac=normalizeAutofillText(meta.autocomplete||'');
  if(/(?:^| )email(?: |$)/.test(ac))return'email';
  if(/(?:^| )tel(?: |$)/.test(ac))return'phone';
  if(/(?:^| )given name(?: |$)/.test(ac))return'firstName';
  if(/(?:^| )family name(?: |$)/.test(ac))return'lastName';
  if(/(?:^| )name(?: |$)/.test(ac))return'fullName';
  if(/(?:^| )organization title(?: |$)/.test(ac))return'jobTitle';
  if(/(?:^| )organization(?: |$)/.test(ac))return'company';
  if(/(?:^| )url(?: |$)/.test(ac))return'website';
  if(/(?:^| )(?:street address|address line1)(?: |$)/.test(ac))return'address1';
  if(/(?:^| )address line2(?: |$)/.test(ac))return'address2';
  if(/(?:^| )address level2(?: |$)/.test(ac))return'city';
  if(/(?:^| )address level1(?: |$)/.test(ac))return'state';
  if(/(?:^| )postal code(?: |$)/.test(ac))return'postalCode';
  if(/(?:^| )(?:country|country name)(?: |$)/.test(ac))return'country';
  const d=normalizeAutofillText([label,meta.name,meta.id,meta.placeholder,meta.aria].filter(Boolean).join(' '));
  if(!d)return null;
  if(/\b(?:email|e mail|eposta|e posta)\b/.test(d))return'email';
  if(/\b(?:phone|telephone|mobile|telefon|cep telefonu|cep no)\b/.test(d))return'phone';
  if(/\b(?:company|organization|organisation|firma|sirket|kurum)\b/.test(d))return'company';
  if(/\b(?:job title|position|occupation|meslek|unvan|gorev)\b/.test(d))return'jobTitle';
  if(/\b(?:website|web site|homepage|site url|web adres)\b/.test(d))return'website';
  if(/\b(?:last name|surname|family name|soyad|soyisim)\b/.test(d))return'lastName';
  if(/\b(?:first name|given name|adiniz|adin|isim)\b/.test(d)&&!/\b(?:company|firma|sirket|product|urun|store|magaza)\b/.test(d))return'firstName';
  if(/\b(?:full name|name surname|ad soyad|isim soyisim)\b/.test(d)||d==='name')return'fullName';
  if(/\b(?:address line 2|address2|adres 2|adres ikinci)\b/.test(d))return'address2';
  if(/\b(?:street address|address line 1|address1|street|sokak|cadde|adres)\b/.test(d))return'address1';
  if(/\b(?:city|town|sehir|ilce)\b/.test(d))return'city';
  if(/\b(?:state|province|region|eyalet|il)\b/.test(d))return'state';
  if(/\b(?:postal code|postcode|zip code|zipcode|posta kod)\b/.test(d))return'postalCode';
  if(/\b(?:country|ulke)\b/.test(d))return'country';
  return null;
}
function envAutofillFields(){
  const env={
    fullName:'JARVIS_AUTOFILL_NAME',firstName:'JARVIS_AUTOFILL_FIRST_NAME',lastName:'JARVIS_AUTOFILL_LAST_NAME',
    email:'JARVIS_AUTOFILL_EMAIL',phone:'JARVIS_AUTOFILL_PHONE',company:'JARVIS_AUTOFILL_COMPANY',
    jobTitle:'JARVIS_AUTOFILL_JOB_TITLE',website:'JARVIS_AUTOFILL_WEBSITE',address1:'JARVIS_AUTOFILL_ADDRESS1',
    address2:'JARVIS_AUTOFILL_ADDRESS2',city:'JARVIS_AUTOFILL_CITY',state:'JARVIS_AUTOFILL_STATE',
    postalCode:'JARVIS_AUTOFILL_POSTAL_CODE',country:'JARVIS_AUTOFILL_COUNTRY'
  };
  const out={};
  for(const [key,name] of Object.entries(env)){
    const value=String(process.env[name]||'').trim();
    if(value)out[key]=value.slice(0,500);
  }
  return out;
}
function readAutofillProfile(){
  const base=emptyAutofillProfile();
  try{
    const file=autofillProfileFile();
    if(fs.existsSync(file)){
      const raw=JSON.parse(fs.readFileSync(file,'utf8'));
      if(raw&&typeof raw==='object'&&raw.fields&&typeof raw.fields==='object'){
        for(const key of AUTOFILL_FIELDS){
          const value=String(raw.fields[key]||'').trim();
          if(value)base.fields[key]=value.slice(0,500);
        }
        base.updatedAt=raw.updatedAt||null;
      }
    }
  }catch(_){}
  base.fields={...base.fields,...envAutofillFields()};
  return base;
}
function writeAutofillProfile(profile){
  const file=autofillProfileFile(),dir=path.dirname(file);
  fs.mkdirSync(dir,{recursive:true});
  const fields={};
  for(const key of AUTOFILL_FIELDS){
    const value=String(profile&&profile.fields&&profile.fields[key]||'').trim();
    if(value)fields[key]=value.slice(0,500);
  }
  const clean={schema:AUTOFILL_SCHEMA,updatedAt:new Date().toISOString(),fields};
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(clean,null,2),'utf8');
  try{fs.chmodSync(tmp,0o600)}catch(_){}
  fs.renameSync(tmp,file);
  try{fs.chmodSync(file,0o600)}catch(_){}
  return clean;
}
function rememberAutofillField(label,value,meta={}){
  const key=classifyAutofillField(label,meta);
  const val=String(value??'').trim();
  if(!key||!val)return{remembered:false,key:null};
  if(isSensitiveAutofillDescriptor(label,meta))return{remembered:false,key:null};
  const current=readAutofillProfile();
  current.fields[key]=val.slice(0,500);
  writeAutofillProfile(current);
  return{remembered:true,key};
}
function autofillProfileStatus(){
  const profile=readAutofillProfile();
  const keys=AUTOFILL_FIELDS.filter(key=>String(profile.fields[key]||'').trim());
  return{enabled:true,schema:AUTOFILL_SCHEMA,availableKeys:keys,fieldCount:keys.length,storage:'local-user-data',storesSecrets:false};
}
function clearAutofillProfile(){
  const file=autofillProfileFile();
  try{if(fs.existsSync(file))fs.unlinkSync(file)}catch(e){return{ok:false,error:String(e.message||e)}}
  return{ok:true};
}
function browserAutofillExpression(fields){
  const safe={};
  for(const key of AUTOFILL_FIELDS){const value=String(fields&&fields[key]||'').trim();if(value)safe[key]=value.slice(0,500)}
  const data=JSON.stringify(safe);
  return[
    "(()=>{",
    "const profile="+data+";",
    "const norm=v=>String(v||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u').replace(/[_-]+/g,' ').replace(/[^a-z0-9\\s]/g,' ').replace(/\\s+/g,' ').trim();",
    "const sensitive=(d,t)=>['password','file','hidden'].includes(norm(t))||/(password|parola|sifre|otp|one time|verification code|dogrulama kod|security code|recovery code|2fa|mfa|pin|cvv|cvc|card number|credit card|kredi kart|iban|bank account|banka hesab|routing number|swift|ssn|social security|tc kimlik|tckn|kimlik no|identity number|passport|pasaport|api key|access token|secret|private key)/.test(norm(d));",
    "function descriptor(el){let label='';if(el.id){const x=document.querySelector('label[for=\\\"'+CSS.escape(el.id)+'\\\"]');if(x)label=x.innerText||''}return[el.getAttribute('aria-label')||'',el.placeholder||'',el.name||'',el.id||'',label].join(' ')}",
    "function classify(el){const ac=norm(el.autocomplete||el.getAttribute('autocomplete')||''),d=norm(descriptor(el));if(sensitive(d,el.type||''))return null;if(/(?:^| )email(?: |$)/.test(ac))return'email';if(/(?:^| )tel(?: |$)/.test(ac))return'phone';if(/(?:^| )given name(?: |$)/.test(ac))return'firstName';if(/(?:^| )family name(?: |$)/.test(ac))return'lastName';if(/(?:^| )name(?: |$)/.test(ac))return'fullName';if(/(?:^| )organization title(?: |$)/.test(ac))return'jobTitle';if(/(?:^| )organization(?: |$)/.test(ac))return'company';if(/(?:^| )url(?: |$)/.test(ac))return'website';if(/(?:^| )(?:street address|address line1)(?: |$)/.test(ac))return'address1';if(/(?:^| )address line2(?: |$)/.test(ac))return'address2';if(/(?:^| )address level2(?: |$)/.test(ac))return'city';if(/(?:^| )address level1(?: |$)/.test(ac))return'state';if(/(?:^| )postal code(?: |$)/.test(ac))return'postalCode';if(/(?:^| )(?:country|country name)(?: |$)/.test(ac))return'country';if(/\\b(?:email|e mail|eposta|e posta)\\b/.test(d))return'email';if(/\\b(?:phone|telephone|mobile|telefon|cep telefonu|cep no)\\b/.test(d))return'phone';if(/\\b(?:company|organization|organisation|firma|sirket|kurum)\\b/.test(d))return'company';if(/\\b(?:job title|position|occupation|meslek|unvan|gorev)\\b/.test(d))return'jobTitle';if(/\\b(?:website|web site|homepage|site url|web adres)\\b/.test(d))return'website';if(/\\b(?:last name|surname|family name|soyad|soyisim)\\b/.test(d))return'lastName';if(/\\b(?:first name|given name|adiniz|adin|isim)\\b/.test(d)&&!/\\b(?:company|firma|sirket|product|urun|store|magaza)\\b/.test(d))return'firstName';if(/\\b(?:full name|name surname|ad soyad|isim soyisim)\\b/.test(d)||d==='name')return'fullName';if(/\\b(?:address line 2|address2|adres 2|adres ikinci)\\b/.test(d))return'address2';if(/\\b(?:street address|address line 1|address1|street|sokak|cadde|adres)\\b/.test(d))return'address1';if(/\\b(?:city|town|sehir|ilce)\\b/.test(d))return'city';if(/\\b(?:state|province|region|eyalet|il)\\b/.test(d))return'state';if(/\\b(?:postal code|postcode|zip code|zipcode|posta kod)\\b/.test(d))return'postalCode';if(/\\b(?:country|ulke)\\b/.test(d))return'country';return null}",
    "const controls=[...document.querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]')];const filled=[],used=new Set();let skippedSensitive=0;",
    "for(const el of controls){if(el.disabled||el.readOnly)continue;const type=norm(el.type||'');const d=descriptor(el);if(sensitive(d,type)){skippedSensitive++;continue}if(['checkbox','radio','submit','button','reset','image'].includes(type))continue;const current=el.isContentEditable?String(el.textContent||'').trim():String(el.value||'').trim();if(current)continue;const key=classify(el),val=key?String(profile[key]||'').trim():'';if(!key||!val||used.has(key))continue;if(el.tagName==='SELECT'){const nv=norm(val);const opts=[...el.options];const opt=opts.find(o=>norm(o.textContent||o.value)===nv)||opts.find(o=>norm(o.textContent||o.value).includes(nv));if(!opt)continue;el.value=opt.value}else if(el.isContentEditable){el.textContent=val}else{const p=Object.getPrototypeOf(el),pd=p&&Object.getOwnPropertyDescriptor(p,'value');if(pd&&pd.set)pd.set.call(el,val);else el.value=val}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push({key,tag:el.tagName.toLowerCase(),name:String(el.name||'').slice(0,80),id:String(el.id||'').slice(0,80)});used.add(key)}",
    "return{ok:true,filled:filled.length,keys:[...used],controls:controls.length,skippedSensitive};",
    "})()"
  ].join('');
}
function allowedHosts(){return DEFAULT_ALLOWED_HOSTS.slice()}
function hostAllowed(hostname){
  const host=String(hostname||'').trim();
  if(!host)return false;
  try{const u=new URL('https://'+host);return!!u.hostname}catch(_){return false}
}
function safeUrl(raw){
  const u=new URL(String(raw||'').trim());
  if(!['https:','http:'].includes(u.protocol))throw new Error('Only http/https URLs are allowed');
  if(!hostAllowed(u.hostname))throw new Error('Invalid browser hostname');
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
    allowedHosts:allowedHosts(),anyHttpSite:true,autofill:autofillProfileStatus()
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
  return{ok:true,version:BROWSER_OPERATOR_VERSION,running:true,browser:v.Browser||browser.name,executable:browser.exe,port,profile,opened:target,reused:false,allowedHosts:allowedHosts(),anyHttpSite:true,autofill:autofillProfileStatus()};
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
  const expression="(()=>{const p=location.pathname.split('/').filter(Boolean);const ci=p.indexOf('channel'),si=p.indexOf('store');const accountEl=[...document.querySelectorAll('[aria-label]')].find(e=>/@/.test(e.getAttribute('aria-label')||'')&&/(account|hesap|google)/i.test(e.getAttribute('aria-label')||''));return{title:document.title,url:location.href,targetEvidence:{account:accountEl?accountEl.getAttribute('aria-label'):'',target:ci>=0?(p[ci+1]||''):si>=0?(p[si+1]||''):''},text:(document.body&&document.body.innerText||'').replace(/\\s+/g,' ').slice(0,12000),forms:[...document.querySelectorAll('form')].slice(0,12).map(f=>({action:f.action,controls:[...f.querySelectorAll('input,textarea,select,button')].slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.type||'',name:el.name||'',id:el.id||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',autocomplete:el.getAttribute('autocomplete')||'',required:!!el.required,disabled:!!el.disabled,valuePresent:!!String(el.value||el.textContent||'').trim(),text:(el.tagName==='BUTTON'||el.type==='submit'?String(el.innerText||el.value||''):'').slice(0,120)}))}))}})()";
  const value=await evaluate(workspace,expression,{port});return{ok:true,...value};
}
async function autoFillRemembered(workspace,{port=DEFAULT_PORT}={}){
  const profile=readAutofillProfile();
  const keys=AUTOFILL_FIELDS.filter(key=>String(profile.fields[key]||'').trim());
  if(!keys.length)return{ok:true,filled:0,keys:[],availableKeys:[],skippedSensitive:0};
  const result=await evaluate(workspace,browserAutofillExpression(profile.fields),{port});
  return{ok:true,filled:Number(result&&result.filled||0),keys:Array.isArray(result&&result.keys)?result.keys:[],availableKeys:keys,controls:Number(result&&result.controls||0),skippedSensitive:Number(result&&result.skippedSensitive||0)};
}
async function navigate(workspace,url,{port=DEFAULT_PORT}={}){
  const target=safeUrl(url),s=await status(workspace,port);
  if(!s.running)await start(workspace,{port,url:target});
  const page=await activePage(port);runCdpPowerShell(page.webSocketDebuggerUrl,'Page.navigate',{url:target});
  await new Promise(r=>setTimeout(r,900));
  let autofill;
  try{autofill=await autoFillRemembered(workspace,{port})}catch(_){autofill={ok:false,filled:0,keys:[],code:'AUTOFILL_FAILED'}}
  const snapshot=await pageSnapshot(workspace,{port});
  return{...snapshot,autofill};
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
    "return{ok:true,tag:el.tagName,name:el.name||'',id:el.id||'',type:el.type||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',autocomplete:el.getAttribute('autocomplete')||''}",
    "})()"
  ].join('');
  const result=await evaluate(workspace,expr,{port});
  if(result&&result.ok){
    const memory=rememberAutofillField(key,val,result);
    return{...result,autofillMemory:memory};
  }
  return result;
}
async function uploadFile(workspace,selector,filePath,{port=DEFAULT_PORT}={}){
  const full=path.resolve(filePath);if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Upload file not found');
  const page=await activePage(port),doc=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.getDocument',{depth:1}),rootId=doc.root&&doc.root.nodeId;
  if(!rootId)throw new Error('DOM root unavailable');
  const query=runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.querySelector',{nodeId:rootId,selector:String(selector||'input[type=file]')});
  if(!query.nodeId)throw new Error('File input not found');
  runCdpPowerShell(page.webSocketDebuggerUrl,'DOM.setFileInputFiles',{nodeId:query.nodeId,files:[full]});return{ok:true,file:full};
}
module.exports={BROWSER_OPERATOR_VERSION,DEFAULT_PORT,AUTOFILL_SCHEMA,AUTOFILL_FIELDS,findBrowser,allowedHosts,hostAllowed,safeUrl,profileDir,autofillProfileFile,autofillProfileStatus,clearAutofillProfile,classifyAutofillField,isSensitiveAutofillDescriptor,rememberAutofillField,status,start,pageSnapshot,navigate,evaluate,autoFillRemembered,clickByText,verifiedFinalClick,setField,uploadFile};
