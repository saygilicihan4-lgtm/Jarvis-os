'use strict';
const assert=require('assert');
const frame=require('./jarvis-browser-frame-context');

assert.strictEqual(frame.FRAME_CONTEXT_VERSION,'1.0');
assert.strictEqual(frame.safeFrameUrl('https://example.com/x'),'https://example.com/x');
assert.strictEqual(frame.safeFrameUrl('javascript:alert(1)'),'');
assert.strictEqual(frame.originOf('https://a.example/path'),'https://a.example');

const tree={frame:{id:'MAIN',url:'https://app.example/form',securityOrigin:'https://app.example'},childFrames:[
  {frame:{id:'SAME',url:'https://app.example/embed',securityOrigin:'https://app.example'},childFrames:[]},
  {frame:{id:'CROSS',url:'https://forms.partner.example/widget',securityOrigin:'https://forms.partner.example'},childFrames:[
    {frame:{id:'NESTED',url:'https://nested.other.example/form',securityOrigin:'https://nested.other.example'},childFrames:[]}
  ]},
  {frame:{id:'ABOUT',url:'about:blank',securityOrigin:'https://app.example'},childFrames:[]}
]};

const flat=frame.flattenFrameTree(tree,{maxFrames:10});
assert.deepStrictEqual(flat.map(x=>x.id),['MAIN','SAME','CROSS','NESTED','ABOUT']);
assert.strictEqual(flat.find(x=>x.id==='NESTED').parentId,'CROSS');
assert.strictEqual(flat.find(x=>x.id==='NESTED').depth,2);
const classified=frame.classifyFrameOrigins(flat);
assert.strictEqual(classified.find(x=>x.id==='SAME').crossOrigin,false);
assert.strictEqual(classified.find(x=>x.id==='CROSS').crossOrigin,true);
assert.strictEqual(classified.find(x=>x.id==='NESTED').crossOrigin,true);
assert.strictEqual(classified.find(x=>x.id==='ABOUT').webFrame,false);
assert.deepStrictEqual(frame.crossOriginWebFrames(tree).map(x=>x.id),['CROSS','NESTED']);

const world=frame.isolatedWorldParams('CROSS',{worldName:'jarvis-test'});
assert.strictEqual(world.frameId,'CROSS');
assert.strictEqual(world.worldName,'jarvis-test');
assert.strictEqual(world.grantUniveralAccess,false,'cross-origin runtime must not request universal page access');
assert.ok(!Object.keys(world).some(k=>/universal/i.test(k)&&k!=='grantUniveralAccess'));
const evalParams=frame.runtimeEvaluateParams('document.title',7);
assert.strictEqual(evalParams.contextId,7);
assert.strictEqual(evalParams.returnByValue,true);
assert.strictEqual(evalParams.awaitPromise,true);

const calls=[];
let nextContext=40;
const runtime=frame.createRuntime({runCdp:(method,params)=>{
  calls.push({method,params});
  if(method==='Page.getFrameTree')return{frameTree:tree};
  if(method==='Page.createIsolatedWorld')return{executionContextId:++nextContext};
  if(method==='Runtime.evaluate')return{result:{value:params.contextId===41?false:{found:true,contextId:params.contextId}}};
  throw new Error('unexpected '+method);
}});

(async()=>{
  const listed=await runtime.listFrames();
  assert.strictEqual(listed.frames.length,5);
  assert.deepStrictEqual(listed.crossOrigin.map(x=>x.id),['CROSS','NESTED']);
  const out=await runtime.evaluateCrossOrigin('({found:true})',{stopOnTruthy:true,worldName:'jarvis-safe-frame'});
  assert.strictEqual(out.crossOriginCount,2);
  assert.strictEqual(out.results.length,2,'first cross-origin context returned false, second truthy should stop');
  const worldCalls=calls.filter(x=>x.method==='Page.createIsolatedWorld');
  assert.strictEqual(worldCalls.length,2);
  assert.ok(worldCalls.every(x=>x.params.grantUniveralAccess===false));
  assert.deepStrictEqual(worldCalls.map(x=>x.params.frameId),['CROSS','NESTED']);
  const evalCalls=calls.filter(x=>x.method==='Runtime.evaluate');
  assert.strictEqual(evalCalls.length,2);
  assert.ok(evalCalls.every(x=>Number.isInteger(x.params.contextId)&&x.params.contextId>0));
  console.log('BROWSER FRAME CONTEXT SELFTEST PASS · bounded cross-origin CDP worlds, universal access disabled');
})().catch(error=>{console.error(error);process.exitCode=1});
