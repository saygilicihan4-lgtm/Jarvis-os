'use strict';
// Run the real server handler and filesystem, without external services/listeners.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let handler;
const context=vm.createContext({
 require(name){if(name==='http')return {createServer(fn){handler=fn;return {listen(){}}}};if(['web-push','pg','@simplewebauthn/server'].includes(name))return {};return require(name)},
 __dirname,Buffer,URL,console:{log(){},error(){}},process:{env:{JARVIS_TOKEN:'isolated-test'}},setInterval(){return 0},clearInterval(){},setTimeout,clearTimeout
});
vm.runInContext(fs.readFileSync(require.resolve('./server.js'),'utf8'),context,{filename:'server.js'});
function get(url){return new Promise((resolve,reject)=>{const result={headers:{}};try{handler({url,method:'GET',headers:{host:'jarvis.test'},socket:{remoteAddress:'127.0.0.1'}},{setHeader(k,v){result.headers[k.toLowerCase()]=v},writeHead(status,headers){result.status=status;Object.assign(result.headers,headers)},end(body){result.body=body;resolve(result)}})}catch(e){reject(e)}})}
(async()=>{
 for(const [file,type]of [['human-avatar-v200.mjs','application/javascript'],['human-avatar-bridge-v200.js','application/javascript'],['human-avatar-v200.html','text/html'],['mobile-reference-v196.css','text/css']]){
  const r=await get('/'+file);assert.equal(r.status,200);assert.equal(r.headers['content-type'].split(';')[0],type,file+' MIME');assert.deepEqual(r.body,fs.readFileSync('public/'+file));
 }
 assert.equal((await get('/missing-module.mjs')).status,404,'missing module must not become SPA HTML');
 console.log('STATIC MODULE PASS: production handler serves exact module bytes with JavaScript MIME');
})().catch(e=>{console.error(e);process.exitCode=1});
