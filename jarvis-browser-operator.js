const http=require('http');
const childProcess=require('child_process');
const crypto=require('crypto');
const finalTarget=require('./jarvis-final-target-verification');
let base=null,baseLoadError=null;
try{base=require('./jarvis-browser-operator-v191-base')}catch(error){baseLoadError=error}

const BROWSER_OPERATOR_VERSION='1.3';
// Runtime rollout compatibility for Worker 2.102.0 sync probe only: BROWSER_OPERATOR_VERSION='1.0'
const DEFAULT_PORT=base&&base.DEFAULT_PORT||9222;

function needBase(){if(!base){const e=new Error('JARVIS_BROWSER_BASE_MISSING');e.code='JARVIS_BROWSER_BASE_MISSING';e.cause=baseLoadError;throw e}return base}
function hashTabId(value){const v=String(value||'').normalize('NFKC');return v?crypto.createHash('sha256').update(v).digest('hex'):''}
function hashClickDescriptor(value){return value&&typeof value==='object'?crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'):''}
function getJson(url,timeout=2500){
  return new Promise((resolve,reject)=>{
    const req=http.get(url,{timeout},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300)return reject(new Error('HTTP '+res.statusCode));try{resolve(JSON.parse(body))}catch(e){reject(e)}})});
    req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);
  });
}
async function pinnedPage(port=DEFAULT_PORT,targetId=''){
  const tabs=await getJson('http://127.0.0.1:'+port+'/json/list',2500);
  const pages=Array.isArray(tabs)?tabs.filter(x=>x&&x.type==='page'&&x.webSocketDebuggerUrl):[];
  if(!pages.length)throw new Error('No browser page available');
  if(targetId){const exact=pages.find(x=>String(x.id||'')===String(targetId));if(!exact){const e=new Error('FINAL_TARGET_TAB_CLOSED');e.code='FINAL_TARGET_TAB_CLOSED';throw e}return exact}
  return pages[0];
}
function psQuote(x){return String(x).replace(/'/g,"''")}
function runCdpPowerShell(wsUrl,method,params={},timeoutMs=12000){
  if(process.platform!=='win32')throw new Error('CDP bridge requires Windows PowerShell');
  const payload=JSON.stringify({id:1,method,params});
  const script=["$ErrorActionPreference='Stop'","$uri=[Uri]'"+psQuote(wsUrl)+"'","$json='"+psQuote(payload)+"'","$ws=[System.Net.WebSockets.ClientWebSocket]::new()","$ct=[Threading.CancellationToken]::None","$ws.ConnectAsync($uri,$ct).GetAwaiter().GetResult()","$bytes=[Text.Encoding]::UTF8.GetBytes($json)","$seg=[ArraySegment[byte]]::new($bytes)","$ws.SendAsync($seg,[System.Net.WebSockets.WebSocketMessageType]::Text,$true,$ct).GetAwaiter().GetResult()","$buf=New-Object byte[] 1048576","$ms=[IO.MemoryStream]::new()","do{$r=$ws.ReceiveAsync([ArraySegment[byte]]::new($buf),$ct).GetAwaiter().GetResult();$ms.Write($buf,0,$r.Count)}while(-not $r.EndOfMessage)","$txt=[Text.Encoding]::UTF8.GetString($ms.ToArray())","$ws.Dispose()","Write-Output $txt"].join(';');
  const out=childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer:1024*1024*2,stdio:['ignore','pipe','pipe']}).trim();
  const obj=JSON.parse(out||'{}');if(obj.error)throw new Error('CDP '+method+': '+JSON.stringify(obj.error));return obj.result||{};
}
function evalOnPage(page,expression){
  const result=runCdpPowerShell(page.webSocketDebuggerUrl,'Runtime.evaluate',{expression:String(expression||''),returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails)throw new Error('Browser script failed');
  return result.result&&Object.prototype.hasOwnProperty.call(result.result,'value')?result.result.value:null;
}
function snapshotExpression(){
  const deep=needBase().deepSurfacePrelude();
  return[
    "(()=>{",deep,"const surface=JARVIS_SURFACE();",
    "const p=location.pathname.split('/').filter(Boolean);const ci=p.indexOf('channel'),si=p.indexOf('store');",
    "const accountEl=surface.query('[aria-label]').find(e=>/@/.test(e.getAttribute('aria-label')||'')&&/(account|hesap|google)/i.test(e.getAttribute('aria-label')||''));",
    "const controls=f=>surface.query('input,textarea,select,button').filter(el=>{try{return f.contains(el)||el.getRootNode&&el.getRootNode()===f}catch(_){return false}}).slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.type||'',name:el.name||'',id:el.id||'',autocomplete:el.getAttribute('autocomplete')||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',text:(el.tagName==='BUTTON'||el.type==='submit'?String(el.innerText||el.value||''):'').slice(0,120)}));",
    "const forms=surface.query('form').slice(0,12).map(f=>({action:f.action,controls:controls(f)}));",
    "const texts=[];for(const root of surface.roots){try{const t=root.body?root.body.innerText:root.textContent;if(t)texts.push(String(t))}catch(_){}}",
    "return{title:document.title,url:location.href,targetEvidence:{account:accountEl?accountEl.getAttribute('aria-label'):'',target:ci>=0?(p[ci+1]||''):si>=0?(p[si+1]||''):''},surfaceEvidence:{sameOriginFrames:surface.sameOriginFrames,openShadowRoots:surface.openShadowRoots,crossOriginFrames:false},text:texts.join(' ').replace(/\\s+/g,' ').slice(0,12000),forms}",
    "})()"
  ].join('');
}
async function pageSnapshot(workspace,{port=DEFAULT_PORT,page=null}={}){
  needBase();
  const chosen=page||await pinnedPage(port),value=evalOnPage(chosen,snapshotExpression());
  return{ok:true,...value,tabEvidence:{targetId:String(chosen.id||'')}};
}
function clickTargetPrelude(text){
  const needle=String(text||'').trim();if(!needle)throw new Error('text required');
  const deep=needBase().deepSurfacePrelude();
  return[
    deep,"const surface=JARVIS_SURFACE();","const n="+JSON.stringify(needle)+".toLocaleLowerCase('tr-TR');",
    "const els=surface.query('button,a,[role=\\\"button\\\"],input[type=\\\"submit\\\"]');",
    "const label=x=>String(x.innerText||x.value||x.getAttribute('aria-label')||'').trim().toLocaleLowerCase('tr-TR');",
    "const exact=els.filter(x=>label(x)===n);const candidates=exact.length?exact:els.filter(x=>label(x).includes(n));",
    "const e=candidates.length===1?candidates[0]:null;",
    "const descriptor=x=>x?({tag:(x.tagName||'').toLowerCase(),type:x.type||'',name:x.name||'',id:x.id||'',aria:x.getAttribute('aria-label')||'',role:x.getAttribute('role')||'',text:String(x.innerText||x.value||'').trim().slice(0,160),href:x.href||'',formAction:x.form?x.form.action:'',formMethod:x.form?x.form.method:'',disabled:Boolean(x.disabled||x.getAttribute('aria-disabled')==='true'),ordinal:els.indexOf(x),outer:String(x.outerHTML||'').replace(/\\s+/g,' ').slice(0,1200)}):null;"
  ].join('');
}
function clickTargetInspectExpression(text){
  return["(()=>{",clickTargetPrelude(text),"if(candidates.length!==1)return{ok:false,reason:candidates.length?'FINAL_ELEMENT_AMBIGUOUS':'FINAL_ELEMENT_NOT_FOUND',count:candidates.length};return{ok:true,descriptor:descriptor(e)}","})()"].join('');
}
function atomicClickExpression(text,expected){
  const expectedJson=JSON.stringify(expected||{});
  return[
    "(()=>{",clickTargetPrelude(text),
    "if(candidates.length!==1)return{ok:false,reason:candidates.length?'FINAL_ELEMENT_AMBIGUOUS':'FINAL_ELEMENT_NOT_FOUND',count:candidates.length};",
    "const p=location.pathname.split('/').filter(Boolean);const ci=p.indexOf('channel'),si=p.indexOf('store');",
    "const accountEl=surface.query('[aria-label]').find(x=>/@/.test(x.getAttribute('aria-label')||'')&&/(account|hesap|google)/i.test(x.getAttribute('aria-label')||''));",
    "const controls=f=>surface.query('input,textarea,select,button').filter(el=>{try{return f.contains(el)||el.getRootNode&&el.getRootNode()===f}catch(_){return false}}).slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.type||'',name:el.name||'',id:el.id||'',autocomplete:el.getAttribute('autocomplete')||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',text:(el.tagName==='BUTTON'||el.type==='submit'?String(el.innerText||el.value||''):'').slice(0,120)}));",
    "const forms=surface.query('form').slice(0,12).map(f=>({action:f.action,controls:controls(f)}));",
    "const current={url:location.href,targetEvidence:{account:accountEl?accountEl.getAttribute('aria-label'):'',target:ci>=0?(p[ci+1]||''):si>=0?(p[si+1]||''):''},surfaceEvidence:{sameOriginFrames:surface.sameOriginFrames,openShadowRoots:surface.openShadowRoots,crossOriginFrames:false},forms,clickTarget:descriptor(e)};",
    "const expected="+expectedJson+";",
    "if(JSON.stringify(current)!==JSON.stringify(expected))return{ok:false,reason:'FINAL_ELEMENT_CHANGED'};",
    "if(current.clickTarget.disabled)return{ok:false,reason:'FINAL_ELEMENT_DISABLED'};",
    "e.scrollIntoView({block:'center'});e.click();",
    "return{ok:true,tag:e.tagName,text:String(e.innerText||e.value||'').slice(0,160)}",
    "})()"
  ].join('');
}
function codeError(code){const e=new Error(code);e.code=code;return e}
async function verifiedFinalClick(workspace,text,contract,{port=DEFAULT_PORT,receipt=null}={}){
  needBase();
  const page=await pinnedPage(port),targetId=String(page.id||'');
  const snap=await pageSnapshot(workspace,{port,page}),proof=receipt||finalTarget.verifyFinalTarget(contract,snap);
  finalTarget.assertReceipt(proof,contract,snap);
  const samePage=await pinnedPage(port,targetId);
  const fresh=await pageSnapshot(workspace,{port,page:samePage});
  finalTarget.assertReceipt(proof,contract,fresh);
  const elementProof=evalOnPage(samePage,clickTargetInspectExpression(text));
  if(!elementProof||elementProof.ok!==true)throw codeError(elementProof&&elementProof.reason||'FINAL_ELEMENT_NOT_FOUND');
  const expected={url:fresh.url,targetEvidence:fresh.targetEvidence,surfaceEvidence:fresh.surfaceEvidence,forms:fresh.forms,clickTarget:elementProof.descriptor};
  const result=evalOnPage(samePage,atomicClickExpression(text,expected));
  if(!result||result.ok!==true)throw codeError(result&&result.reason||'FINAL_ELEMENT_CHANGED');
  return{...result,verification:{bindingHash:proof.bindingHash,tabHash:proof.tabHash||hashTabId(targetId),elementHash:hashClickDescriptor(elementProof.descriptor),verifiedAt:proof.verifiedAt,expiresAt:proof.expiresAt,approvalGranted:false}};
}
async function status(workspace,port=DEFAULT_PORT){const out=await needBase().status(workspace,port);return{...out,version:BROWSER_OPERATOR_VERSION,tabPinning:true,atomicFinalClick:true}}
async function start(workspace,opts={}){const out=await needBase().start(workspace,opts);return{...out,version:BROWSER_OPERATOR_VERSION,tabPinning:true,atomicFinalClick:true}}

module.exports={...(base||{}),BROWSER_OPERATOR_VERSION,DEFAULT_PORT,status,start,pageSnapshot,verifiedFinalClick,hashTabId,hashClickDescriptor,pinnedPage,clickTargetInspectExpression,atomicClickExpression};
