const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const WORKSPACE_FILE_ENGINE_VERSION='1.0';
const CHUNK_BYTES=1024*1024;

function inside(parent,target){
  const p=path.resolve(parent),t=path.resolve(target);
  return t===p||t.startsWith(p+path.sep);
}
function normalizeRel(rel){
  const raw=String(rel||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
  if(!raw||raw.includes('\0')||path.isAbsolute(raw))throw new Error('WORKSPACE_FILE_BAD_PATH');
  const parts=raw.split('/').filter(Boolean);
  if(!parts.length||parts.some(x=>x==='.'||x==='..'))throw new Error('WORKSPACE_FILE_BAD_PATH');
  const lower=parts.map(x=>x.toLocaleLowerCase('tr-TR'));
  const first=lower[0];
  if(first==='.git'||first==='node_modules'||first==='.jarvis-memory'||first==='.jarvis-missions'||first.startsWith('.jarvis-')){
    throw new Error('WORKSPACE_FILE_INTERNAL_PATH');
  }
  const base=lower[lower.length-1];
  if(/^\.env(?:\..*)?$/.test(base)||/^(?:credentials?|secrets?|private[-_]?key|id_rsa|id_ed25519)(?:\..*)?$/.test(base)){
    throw new Error('WORKSPACE_FILE_SENSITIVE_PATH');
  }
  if(/(?:token|password|passwd|apikey|api_key|secret)[-_]?(?:backup|dump|export)?\.(?:txt|json|log|csv)$/.test(base)){
    throw new Error('WORKSPACE_FILE_SENSITIVE_PATH');
  }
  return parts.join('/');
}
function rootInfo(workspace){
  const root=path.resolve(String(workspace||''));
  if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw new Error('WORKSPACE_FILE_WORKSPACE_MISSING');
  const real=fs.realpathSync(root);
  return{root,real};
}
function candidate(workspace,rel){
  const info=rootInfo(workspace);
  const clean=normalizeRel(rel);
  const full=path.resolve(info.root,clean);
  if(!inside(info.root,full))throw new Error('WORKSPACE_FILE_OUTSIDE');
  return{...info,rel:clean,full};
}
function assertParentInside(workspace,full){
  const info=rootInfo(workspace);
  const parent=path.dirname(full);
  if(!fs.existsSync(parent)||!fs.statSync(parent).isDirectory())throw new Error('WORKSPACE_FILE_PARENT_MISSING');
  const parentReal=fs.realpathSync(parent);
  if(!inside(info.real,parentReal))throw new Error('WORKSPACE_FILE_SYMLINK_ESCAPE');
  return parentReal;
}
function existingFile(workspace,rel){
  const c=candidate(workspace,rel);
  if(!fs.existsSync(c.full))return{...c,exists:false};
  const lst=fs.lstatSync(c.full);
  if(lst.isSymbolicLink())throw new Error('WORKSPACE_FILE_SYMLINK_BLOCKED');
  if(!lst.isFile())throw new Error('WORKSPACE_FILE_NOT_FILE');
  const real=fs.realpathSync(c.full);
  if(!inside(c.real,real))throw new Error('WORKSPACE_FILE_SYMLINK_ESCAPE');
  return{...c,exists:true,real,bytes:lst.size};
}
function destinationState(workspace,rel){
  const c=candidate(workspace,rel);
  assertParentInside(workspace,c.full);
  if(!fs.existsSync(c.full))return{...c,exists:false};
  const lst=fs.lstatSync(c.full);
  if(lst.isSymbolicLink())throw new Error('WORKSPACE_FILE_SYMLINK_BLOCKED');
  if(!lst.isFile())throw new Error('WORKSPACE_FILE_DEST_NOT_FILE');
  const real=fs.realpathSync(c.full);
  if(!inside(c.real,real))throw new Error('WORKSPACE_FILE_SYMLINK_ESCAPE');
  return{...c,exists:true,real,bytes:lst.size};
}
function hashFile(file){
  const h=crypto.createHash('sha256');
  const fd=fs.openSync(file,'r');
  const buf=Buffer.allocUnsafe(CHUNK_BYTES);
  try{
    let offset=0;
    for(;;){
      const read=fs.readSync(fd,buf,0,buf.length,offset);
      if(!read)break;
      h.update(buf.subarray(0,read));
      offset+=read;
    }
  }finally{fs.closeSync(fd)}
  return h.digest('hex');
}
function inspectOperation(workspace,op){
  const source=existingFile(workspace,op.source);
  const destination=destinationState(workspace,op.destination);
  return{
    sourceExists:!!source.exists,
    sourceHash:source.exists?hashFile(source.full):null,
    destinationExists:!!destination.exists,
    destinationHash:destination.exists?hashFile(destination.full):null,
    source:source.full,
    destination:destination.full
  };
}
function normalizeOperations(workspace,rows){
  const list=Array.isArray(rows)?rows.slice(0,12):[];
  if(!list.length)throw new Error('WORKSPACE_FILE_OPS_REQUIRED');
  return list.map((row,index)=>{
    const operation=String(row&&row.operation||'').trim().toLowerCase();
    if(operation!=='copy'&&operation!=='move')throw new Error('WORKSPACE_FILE_BAD_OPERATION_'+(index+1));
    const source=normalizeRel(row&&row.source);
    const destination=normalizeRel(row&&row.destination);
    if(source===destination)throw new Error('WORKSPACE_FILE_SAME_PATH_'+(index+1));
    const src=existingFile(workspace,source);
    if(!src.exists)throw new Error('WORKSPACE_FILE_SOURCE_MISSING_'+(index+1));
    const dst=destinationState(workspace,destination);
    if(dst.exists)throw new Error('WORKSPACE_FILE_DEST_EXISTS_'+(index+1));
    return{
      operation,
      source,
      destination,
      expectedSha256:hashFile(src.full),
      bytes:src.bytes
    };
  });
}
function recoveryDecision(workspace,op){
  let state;
  try{state=inspectOperation(workspace,op)}catch(e){return{decision:'uncertain',code:String(e.message||e)}}
  const expected=String(op&&op.expectedSha256||'');
  if(op.operation==='copy'){
    if(state.sourceExists&&state.sourceHash===expected&&state.destinationExists&&state.destinationHash===expected)return{decision:'completed',state};
    if(state.sourceExists&&state.sourceHash===expected&&!state.destinationExists)return{decision:'retry',state};
    return{decision:'uncertain',state};
  }
  if(op.operation==='move'){
    if(!state.sourceExists&&state.destinationExists&&state.destinationHash===expected)return{decision:'completed',state};
    if(state.sourceExists&&state.sourceHash===expected&&!state.destinationExists)return{decision:'retry',state};
    return{decision:'uncertain',state};
  }
  return{decision:'uncertain',state};
}
function applyOperation(workspace,op){
  const state=inspectOperation(workspace,op);
  const expected=String(op&&op.expectedSha256||'');
  if(!state.sourceExists||state.sourceHash!==expected)return{ok:false,code:'WORKSPACE_FILE_SOURCE_CONFLICT',uncertain:false};
  if(state.destinationExists)return{ok:false,code:'WORKSPACE_FILE_DEST_EXISTS',uncertain:false};

  try{
    fs.copyFileSync(state.source,state.destination,fs.constants.COPYFILE_EXCL);
  }catch(e){
    return{ok:false,code:e&&e.code==='EEXIST'?'WORKSPACE_FILE_DEST_EXISTS':'WORKSPACE_FILE_COPY_FAILED',uncertain:false,message:String(e.message||e)};
  }
  let destinationHash=null;
  try{destinationHash=hashFile(state.destination)}catch(e){
    return{ok:false,code:'WORKSPACE_FILE_DEST_VERIFY_FAILED',uncertain:true,message:String(e.message||e)};
  }
  if(destinationHash!==expected)return{ok:false,code:'WORKSPACE_FILE_DEST_VERIFY_FAILED',uncertain:true};

  if(op.operation==='copy'){
    return{ok:true,operation:'copy',source:op.source,destination:op.destination,sha256:expected,bytes:Number(op.bytes||0)};
  }

  try{
    const currentSource=hashFile(state.source);
    if(currentSource!==expected)return{ok:false,code:'WORKSPACE_FILE_SOURCE_CHANGED_AFTER_COPY',uncertain:true};
    fs.unlinkSync(state.source);
  }catch(e){
    return{ok:false,code:'WORKSPACE_FILE_MOVE_SOURCE_REMOVE_FAILED',uncertain:true,message:String(e.message||e)};
  }
  return{ok:true,operation:'move',source:op.source,destination:op.destination,sha256:expected,bytes:Number(op.bytes||0)};
}

module.exports={
  WORKSPACE_FILE_ENGINE_VERSION,
  normalizeRel,
  hashFile,
  normalizeOperations,
  inspectOperation,
  recoveryDecision,
  applyOperation
};
