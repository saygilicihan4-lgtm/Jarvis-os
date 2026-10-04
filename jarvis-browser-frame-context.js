'use strict';

const FRAME_CONTEXT_VERSION='1.0';
const DEFAULT_MAX_FRAMES=24;

function safeFrameUrl(raw){
  try{
    const u=new URL(String(raw||''));
    return ['http:','https:'].includes(u.protocol)?u.toString():'';
  }catch(_){return''}
}
function originOf(raw){
  try{
    const u=new URL(String(raw||''));
    return ['http:','https:'].includes(u.protocol)?u.origin:'';
  }catch(_){return''}
}
function flattenFrameTree(frameTree,{maxFrames=DEFAULT_MAX_FRAMES}={}){
  const limit=Math.max(1,Math.min(64,Number(maxFrames)||DEFAULT_MAX_FRAMES));
  const out=[];
  const visit=(node,depth=0,parentId=null)=>{
    if(!node||out.length>=limit)return;
    const f=node.frame||{};
    if(f.id){
      out.push({
        id:String(f.id),
        parentId:parentId?String(parentId):null,
        depth:Math.max(0,Number(depth)||0),
        url:safeFrameUrl(f.url),
        securityOrigin:String(f.securityOrigin||''),
        name:String(f.name||'').slice(0,160),
        mimeType:String(f.mimeType||'').slice(0,100)
      });
    }
    const nextParent=f.id||parentId;
    for(const child of Array.isArray(node.childFrames)?node.childFrames:[]){
      if(out.length>=limit)break;
      visit(child,depth+1,nextParent);
    }
  };
  visit(frameTree,0,null);
  return out;
}
function classifyFrameOrigins(frames){
  const rows=Array.isArray(frames)?frames:[];
  const main=rows[0]||null;
  const mainOrigin=originOf(main&&main.url)||(main&&main.securityOrigin)||'';
  return rows.map((row,index)=>{
    const frameOrigin=originOf(row&&row.url)||(row&&row.securityOrigin)||'';
    return{
      ...row,
      isMain:index===0,
      origin:frameOrigin,
      crossOrigin:index>0&&!!mainOrigin&&!!frameOrigin&&frameOrigin!==mainOrigin,
      webFrame:!!safeFrameUrl(row&&row.url)
    };
  });
}
function crossOriginWebFrames(frameTree,{maxFrames=DEFAULT_MAX_FRAMES}={}){
  return classifyFrameOrigins(flattenFrameTree(frameTree,{maxFrames}))
    .filter(x=>!x.isMain&&x.webFrame&&x.crossOrigin);
}
function isolatedWorldParams(frameId,{worldName='jarvis-frame-context'}={}){
  const id=String(frameId||'').trim();
  if(!id)throw new Error('frameId required');
  return{frameId:id,worldName:String(worldName||'jarvis-frame-context').slice(0,120),grantUniveralAccess:false};
}
function runtimeEvaluateParams(expression,contextId){
  const id=Number(contextId);
  if(!Number.isInteger(id)||id<=0)throw new Error('valid contextId required');
  return{expression:String(expression||''),contextId:id,returnByValue:true,awaitPromise:true,userGesture:true};
}
function normalizeEvaluationResult(result){
  if(result&&result.exceptionDetails)return{ok:false,error:'FRAME_SCRIPT_FAILED'};
  const remote=result&&result.result;
  return{ok:true,value:remote&&Object.prototype.hasOwnProperty.call(remote,'value')?remote.value:null};
}
function createRuntime({runCdp,maxFrames=DEFAULT_MAX_FRAMES}={}){
  if(typeof runCdp!=='function')throw new Error('runCdp function required');
  const limit=Math.max(1,Math.min(64,Number(maxFrames)||DEFAULT_MAX_FRAMES));
  async function listFrames(){
    const tree=await Promise.resolve(runCdp('Page.getFrameTree',{}));
    const rows=classifyFrameOrigins(flattenFrameTree(tree&&tree.frameTree,{maxFrames:limit}));
    return{ok:true,frames:rows,crossOrigin:rows.filter(x=>x.crossOrigin&&x.webFrame)};
  }
  async function createContext(frame,{worldName='jarvis-frame-context'}={}){
    if(!frame||!frame.id)throw new Error('frame required');
    const params=isolatedWorldParams(frame.id,{worldName});
    const out=await Promise.resolve(runCdp('Page.createIsolatedWorld',params));
    const contextId=Number(out&&out.executionContextId);
    if(!Number.isInteger(contextId)||contextId<=0)return{ok:false,frameId:frame.id,error:'FRAME_CONTEXT_UNAVAILABLE'};
    return{ok:true,frameId:frame.id,contextId};
  }
  async function evaluateFrame(frame,expression,{worldName='jarvis-frame-context'}={}){
    const ctx=await createContext(frame,{worldName});
    if(!ctx.ok)return ctx;
    const out=await Promise.resolve(runCdp('Runtime.evaluate',runtimeEvaluateParams(expression,ctx.contextId)));
    return{frameId:frame.id,url:frame.url,crossOrigin:!!frame.crossOrigin,...normalizeEvaluationResult(out)};
  }
  async function evaluateCrossOrigin(expression,{stopOnTruthy=false,worldName='jarvis-frame-context'}={}){
    const listed=await listFrames(),results=[];
    for(const frame of listed.crossOrigin.slice(0,limit)){
      let row;
      try{row=await evaluateFrame(frame,expression,{worldName})}
      catch(error){row={ok:false,frameId:frame.id,url:frame.url,crossOrigin:true,error:String(error&&error.message||error).slice(0,240)}}
      results.push(row);
      if(stopOnTruthy&&row.ok&&row.value)break;
    }
    return{ok:true,frameCount:listed.frames.length,crossOriginCount:listed.crossOrigin.length,results};
  }
  return{listFrames,createContext,evaluateFrame,evaluateCrossOrigin};
}

module.exports={
  FRAME_CONTEXT_VERSION,
  DEFAULT_MAX_FRAMES,
  safeFrameUrl,
  originOf,
  flattenFrameTree,
  classifyFrameOrigins,
  crossOriginWebFrames,
  isolatedWorldParams,
  runtimeEvaluateParams,
  normalizeEvaluationResult,
  createRuntime
};
