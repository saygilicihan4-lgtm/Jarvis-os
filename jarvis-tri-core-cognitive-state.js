'use strict';

const VERSION='1.0';
const CORES=Object.freeze(['jarvis','nova','orion']);
const PHASES=Object.freeze(['idle','listening','thinking','consulting','synthesizing','waiting','speaking','error']);
const CORE_SET=new Set(CORES),PHASE_SET=new Set(PHASES);

function core(value){const id=String(value||'').toLowerCase();return CORE_SET.has(id)?id:null}
function ids(value,primary){
  const out=[];
  for(const item of Array.isArray(value)?value:[]){const id=core(item);if(!id||id===primary||out.includes(id))continue;out.push(id);if(out.length===2)break}
  return out;
}
function revision(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?Math.min(n,1_000_000_000):0}
function sanitize(value={}){
  const primary=core(value.primary),phase=PHASE_SET.has(String(value.phase||''))?String(value.phase):'idle';
  return Object.freeze({
    phase,
    primary,
    consulting:Object.freeze(ids(value.consulting,primary)),
    completed:Object.freeze(ids(value.completed,primary)),
    revision:revision(value.revision),
    authority:'shared_guardrail_only'
  });
}
function next(previous,update={}){
  const prev=sanitize(previous||{});
  return sanitize({...update,revision:prev.revision+1});
}
function publicState(value){return sanitize(value)}
function uiState(phase){
  return({idle:'idle',listening:'listening',thinking:'thinking',consulting:'thinking',synthesizing:'thinking',waiting:'waiting',speaking:'speaking',error:'error'})[String(phase||'')]||'idle';
}
function isPublicShape(value){
  if(!value||typeof value!=='object')return false;
  const keys=Object.keys(value).sort().join(',');
  if(keys!=='authority,completed,consulting,phase,primary,revision')return false;
  const safe=sanitize(value);
  return value.phase===safe.phase&&value.primary===safe.primary&&value.revision===safe.revision&&value.authority==='shared_guardrail_only'&&
    JSON.stringify(value.consulting)===JSON.stringify([...safe.consulting])&&JSON.stringify(value.completed)===JSON.stringify([...safe.completed]);
}

module.exports={VERSION,CORES,PHASES,core,ids,revision,sanitize,next,publicState,uiState,isPublicShape};
