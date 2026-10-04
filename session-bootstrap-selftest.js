'use strict';
// Execute the production HTTP handler. No listener, external services or real credentials.
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {EventEmitter}=require('events');
let handler;
const context=vm.createContext({
  require(name){
    if(name==='http')return {createServer(fn){handler=fn;return {listen(){}};}};
    if(['web-push','pg','@simplewebauthn/server'].includes(name))return {};
    return require(name);
  },
  __dirname,Buffer,URL,console:{log(){},error(){}},
  process:{env:{JARVIS_TOKEN:'selftest-only-token',JARVIS_DEVICE_SECRET:'selftest-only-device-secret'}},
  setInterval(){return 0;},clearInterval(){},setTimeout,clearTimeout
});
vm.runInContext(fs.readFileSync(require.resolve('./server.js'),'utf8'),context,{filename:'server.js'});
function request(url,{method='GET',headers={},ip='192.0.2.10',body}={}){
  return new Promise((resolve,reject)=>{
    const req=new EventEmitter();Object.assign(req,{url,method,headers:{host:'jarvis.test',...headers},socket:{remoteAddress:ip},destroy(){reject(Error('request destroyed'));}});
    const result={headers:{}};
    const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},writeHead(status,h){result.status=status;Object.assign(result.headers,h);},end(b){result.body=JSON.parse(b);resolve(result);}};
    try{handler(req,res);if(body!==undefined)req.emit('data',JSON.stringify(body));req.emit('end');}catch(e){reject(e);}
  });
}
function cookie(exp=Date.now()+60000){
  context.testExpiry=exp;
  return 'jarvis_session='+encodeURIComponent(vm.runInContext("signPhoneSession({headers:{},socket:{remoteAddress:'192.0.2.10'}},testExpiry)",context));
}
async function run(){
  vm.runInContext("state.workers.devices.pc={approved:true,authMode:'signed',lastSeen:new Date().toISOString(),networkTag:ipTag({headers:{},socket:{remoteAddress:'192.0.2.10'}})}",context);
  for(const headers of [{},{'user-agent':'iPhone'},{cookie:'jarvis_session=forged.token'},{cookie:'jarvis_session=%E0%A4%A'},{cookie:cookie(Date.now()-1000)}]){
    const r=await request('/api/session/lan-bootstrap',{method:'POST',headers});
    assert.strictEqual(r.status,401,'same IP and signed Worker are not browser identity');
    assert.strictEqual(r.body.pairingRequired,true);assert(!r.headers['set-cookie']);
  }
  for(const spoof of ['cf-connecting-ip','x-forwarded-for']){
    const r=await request('/api/session/lan-bootstrap',{method:'POST',ip:'198.51.100.20',headers:{[spoof]:'192.0.2.10'}});
    assert.strictEqual(r.status,401,'proxy header is not an authentication factor');assert(!r.headers['set-cookie']);
  }
  const valid=cookie();
  vm.runInContext('state.workers.devices={}',context);
  for(const [url,method] of [['/api/session/bootstrap','GET'],['/api/session/lan-bootstrap','POST']]){
    const r=await request(url,{method,ip:'198.51.100.20',headers:{cookie:valid}});
    assert.strictEqual(r.status,200,'existing session survives IP change and offline Worker');
    assert.strictEqual(r.body.existing,true);assert(!r.headers['set-cookie'],'bootstrap does not extend expiry');
    const denied=await request(url,{method});assert.strictEqual(denied.status,401);assert(!denied.headers['set-cookie']);
    const malformed=await request(url,{method,headers:{cookie:'jarvis_session=%'}});assert.strictEqual(malformed.status,401);assert(!malformed.headers['set-cookie']);
  }
  const anonymousCreate=await request('/api/session/create',{method:'POST'});assert.strictEqual(anonymousCreate.status,401);
  vm.runInContext("phoneCode='12345678';phoneCodeExp=Date.now()+60000;phoneCodeUsed=false",context);
  const wrong=await request('/api/session/exchange',{method:'POST',body:{code:'87654321'}});assert.strictEqual(wrong.status,403);assert(!wrong.headers['set-cookie']);
  const exchanged=await request('/api/session/exchange',{method:'POST',body:{code:'12345678'}});
  assert.strictEqual(exchanged.status,200);assert(/HttpOnly; Secure; SameSite=Lax/.test(exchanged.headers['set-cookie']));
  const restored=await request('/api/session/bootstrap',{ip:'198.51.100.25',headers:{cookie:exchanged.headers['set-cookie'].split(';')[0]}});assert.strictEqual(restored.status,200);
  const replay=await request('/api/session/exchange',{method:'POST',body:{code:'12345678'}});assert.strictEqual(replay.status,403);assert(!replay.headers['set-cookie']);
  const html=fs.readFileSync(require.resolve('./public/index.html'),'utf8');
  const bootstrap=html.slice(html.indexOf('async function bootstrapSession(){'),html.indexOf('async function languageConversationRequest'));
  assert(!bootstrap.includes('/api/session/lan-bootstrap'),'UI must not treat network presence as login');
  assert(bootstrap.includes('if(await tryTrustedSession())return;'),'phone and desktop both reuse a valid session');
  assert(bootstrap.indexOf('if(await tryTrustedSession())return;')<bootstrap.indexOf('const unlocked=await requireLocalDeviceUnlock(true)'));
  for(const userAgent of ['iPhone','Desktop']){
    for(const existing of [true,false]){
      const calls=[];
      const ui=vm.createContext({navigator:{userAgent},authmsg:{textContent:''},consoleStatus:{textContent:''},
        async fetch(url){calls.push(url);return {ok:existing};},
        async load(){calls.push('load');},setAuthenticated(v){calls.push('authenticated:'+v);},setAccessMode(v){calls.push('mode:'+v);},
        async refreshDeviceLockStatus(){},async resyncExistingPush(){},
        async requireLocalDeviceUnlock(){calls.push('passkey');return false;}
      });
      vm.runInContext(bootstrap,ui);await vm.runInContext('bootstrapSession()',ui);
      assert.strictEqual(calls[0],'/api/session/bootstrap');
      assert(calls.includes('authenticated:'+existing));
      assert.strictEqual(calls.includes('passkey'),!existing&&userAgent==='iPhone');
      if(!existing)assert(!calls.includes('load'),'failed proof never loads authenticated UI');
    }
  }
  console.log('SESSION BOOTSTRAP SELFTEST PASS (production HTTP handler; fake services)');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
