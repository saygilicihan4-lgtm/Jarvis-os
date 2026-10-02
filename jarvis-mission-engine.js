const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const MISSION_ENGINE_VERSION='1.0';
const OPEN_STATUSES=new Set(['queued','running','waiting_dependency','needs_verification']);

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function missionDir(workspace){return ensureDir(path.join(workspace,'.jarvis-missions'))}
function safeId(id){
  const s=String(id||'').trim();
  if(!/^M-[A-Z0-9-]{12,80}$/.test(s))throw new Error('Invalid mission id');
  return s;
}
function missionFile(workspace,id){return path.join(missionDir(workspace),safeId(id)+'.json')}
function now(){return new Date().toISOString()}
function clone(x){return JSON.parse(JSON.stringify(x))}
function atomicWrite(file,obj){
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(obj,null,2),'utf8');
  fs.renameSync(tmp,file);
}
function newMissionId(){
  return 'M-'+crypto.randomUUID().toUpperCase();
}
function normalizeStep(step,index){
  if(typeof step==='string')step={name:step};
  const name=String(step&&step.name||'').trim().replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,80);
  if(!name)throw new Error('Mission step name required');
  return{
    index,
    name,
    status:'pending',
    attempts:0,
    startedAt:null,
    completedAt:null,
    error:null,
    artifact:null,
    meta:step&&step.meta&&typeof step.meta==='object'?clone(step.meta):{}
  };
}
function createMission(workspace,{type='generic',input={},steps=[],label=''}={}){
  if(!Array.isArray(steps)||!steps.length)throw new Error('Mission steps required');
  const id=newMissionId();
  const createdAt=now();
  const mission={
    schema:1,
    engine:'JARVIS_MISSION_ENGINE',
    version:MISSION_ENGINE_VERSION,
    id,
    type:String(type||'generic').slice(0,80),
    label:String(label||'').trim().slice(0,160),
    status:'queued',
    createdAt,
    updatedAt:createdAt,
    completedAt:null,
    currentStep:0,
    input:input&&typeof input==='object'?clone(input):{},
    steps:steps.map(normalizeStep),
    artifacts:{},
    history:[{at:createdAt,event:'mission_created'}]
  };
  atomicWrite(missionFile(workspace,id),mission);
  return clone(mission);
}
function loadMission(workspace,id){
  const file=missionFile(workspace,id);
  if(!fs.existsSync(file))return null;
  const j=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!j||j.schema!==1||j.id!==safeId(id)||!Array.isArray(j.steps))throw new Error('Invalid mission file');
  return j;
}
function saveMission(workspace,mission){
  if(!mission||!mission.id)throw new Error('Mission required');
  mission.updatedAt=now();
  atomicWrite(missionFile(workspace,mission.id),mission);
  return clone(mission);
}
function listMissions(workspace,{limit=30}={}){
  let names=[];try{names=fs.readdirSync(missionDir(workspace)).filter(x=>/^M-[A-Z0-9-]+\.json$/.test(x))}catch(_){return[]}
  const rows=[];
  for(const name of names.slice(-Math.max(1,Number(limit)||30)*3)){
    try{
      const j=JSON.parse(fs.readFileSync(path.join(missionDir(workspace),name),'utf8'));
      if(j&&j.schema===1&&j.id)rows.push(j);
    }catch(_){}
  }
  return rows.sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt))).slice(0,Math.max(1,Number(limit)||30));
}
function latestOpenMission(workspace){
  return listMissions(workspace,{limit:50}).find(x=>OPEN_STATUSES.has(String(x.status||'')))||null;
}
function schedulerOrder(missions){
  const rows=Array.isArray(missions)?missions.filter(Boolean):[];
  return rows
    .filter(x=>OPEN_STATUSES.has(String(x.status||'')))
    .sort((a,b)=>{
      const ac=String(a.createdAt||a.updatedAt||'');
      const bc=String(b.createdAt||b.updatedAt||'');
      const byCreated=ac.localeCompare(bc);
      if(byCreated!==0)return byCreated;
      return String(a.id||'').localeCompare(String(b.id||''));
    });
}
function currentStep(mission){
  if(!mission||!Array.isArray(mission.steps))return null;
  const idx=Math.max(0,Math.min(mission.steps.length-1,Number(mission.currentStep)||0));
  return mission.steps[idx]||null;
}
function addHistory(mission,event,extra={}){
  if(!Array.isArray(mission.history))mission.history=[];
  mission.history.push({at:now(),event:String(event||'event').slice(0,80),...clone(extra)});
  if(mission.history.length>200)mission.history=mission.history.slice(-200);
}
function startStep(workspace,id,{allowUncertainRetry=false}={}){
  const m=loadMission(workspace,id);if(!m)throw new Error('Mission not found');
  const step=currentStep(m);if(!step)throw new Error('Mission step not found');
  if(step.status==='completed'){
    if(m.currentStep<m.steps.length-1){
      m.currentStep++;
      return startStep(workspace,id,{allowUncertainRetry});
    }
    m.status='completed';m.completedAt=m.completedAt||now();return saveMission(workspace,m);
  }
  if(step.status==='uncertain'&&!allowUncertainRetry){
    m.status='needs_verification';
    addHistory(m,'step_retry_blocked_uncertain',{step:step.name});
    return saveMission(workspace,m);
  }
  if(step.status==='running'){
    step.status='uncertain';
    step.error={code:'INTERRUPTED_IN_FLIGHT',message:'Step was running when execution was interrupted',at:now()};
    m.status='needs_verification';
    addHistory(m,'step_marked_uncertain',{step:step.name});
    return saveMission(workspace,m);
  }
  step.status='running';
  step.attempts=(Number(step.attempts)||0)+1;
  step.startedAt=now();
  step.completedAt=null;
  step.error=null;
  m.status='running';
  addHistory(m,'step_started',{step:step.name,attempt:step.attempts});
  return saveMission(workspace,m);
}
function completeStep(workspace,id,{artifact=null,meta=null}={}){
  const m=loadMission(workspace,id);if(!m)throw new Error('Mission not found');
  const step=currentStep(m);if(!step)throw new Error('Mission step not found');
  step.status='completed';
  step.completedAt=now();
  step.error=null;
  if(artifact!==null&&artifact!==undefined){
    step.artifact=clone(artifact);
    m.artifacts[step.name]=clone(artifact);
  }
  if(meta&&typeof meta==='object')step.meta={...(step.meta||{}),...clone(meta)};
  addHistory(m,'step_completed',{step:step.name});
  if(m.currentStep>=m.steps.length-1){
    m.status='completed';m.completedAt=now();
    addHistory(m,'mission_completed');
  }else{
    m.currentStep++;
    m.status='queued';
  }
  return saveMission(workspace,m);
}
function failStep(workspace,id,{code='STEP_FAILED',message='Step failed',retryable=false,dependency=null,uncertain=false}={}){
  const m=loadMission(workspace,id);if(!m)throw new Error('Mission not found');
  const step=currentStep(m);if(!step)throw new Error('Mission step not found');
  step.status=uncertain?'uncertain':(retryable?'blocked':'failed');
  step.error={code:String(code||'STEP_FAILED').slice(0,80),message:String(message||'Step failed').slice(0,1200),retryable:!!retryable,dependency:dependency?String(dependency).slice(0,120):null,at:now()};
  m.status=uncertain?'needs_verification':(retryable?'waiting_dependency':'failed');
  addHistory(m,'step_failed',{step:step.name,code:step.error.code,retryable:!!retryable,uncertain:!!uncertain});
  return saveMission(workspace,m);
}
function retryBlockedStep(workspace,id){
  const m=loadMission(workspace,id);if(!m)throw new Error('Mission not found');
  const step=currentStep(m);if(!step)throw new Error('Mission step not found');
  if(step.status!=='blocked')return clone(m);
  step.status='pending';step.error=null;
  m.status='queued';
  addHistory(m,'step_retry_armed',{step:step.name});
  return saveMission(workspace,m);
}
function resolveUncertainStep(workspace,id,{completed=false,artifact=null,note=''}={}){
  const m=loadMission(workspace,id);if(!m)throw new Error('Mission not found');
  const step=currentStep(m);if(!step)throw new Error('Mission step not found');
  if(step.status!=='uncertain')return clone(m);
  if(completed){
    step.status='completed';step.completedAt=now();step.error=null;
    if(artifact!==null&&artifact!==undefined){step.artifact=clone(artifact);m.artifacts[step.name]=clone(artifact)}
    addHistory(m,'uncertain_step_verified_complete',{step:step.name,note:String(note||'').slice(0,240)});
    if(m.currentStep>=m.steps.length-1){m.status='completed';m.completedAt=now()}
    else{m.currentStep++;m.status='queued'}
  }else{
    step.status='pending';step.error=null;
    m.status='queued';
    addHistory(m,'uncertain_step_verified_retry',{step:step.name,note:String(note||'').slice(0,240)});
  }
  return saveMission(workspace,m);
}
function recoverInterruptedMissions(workspace){
  const changed=[];
  for(const row of listMissions(workspace,{limit:100})){
    if(row.status!=='running')continue;
    const step=currentStep(row);
    if(!step||step.status!=='running')continue;
    step.status='uncertain';
    step.error={code:'PROCESS_RESTARTED_DURING_STEP',message:'JARVIS restarted while this step was in flight',retryable:false,at:now()};
    row.status='needs_verification';
    addHistory(row,'mission_recovered_uncertain',{step:step.name});
    saveMission(workspace,row);changed.push(row.id);
  }
  return changed;
}
function summarizeMission(m){
  if(!m)return null;
  const step=currentStep(m);
  return{
    id:m.id,
    type:m.type,
    label:m.label,
    status:m.status,
    currentStep:Number(m.currentStep)||0,
    step:step?{name:step.name,status:step.status,attempts:step.attempts,error:step.error||null}:null,
    createdAt:m.createdAt,
    updatedAt:m.updatedAt,
    completedAt:m.completedAt||null,
    artifacts:Object.keys(m.artifacts||{})
  };
}

module.exports={
  MISSION_ENGINE_VERSION,
  OPEN_STATUSES,
  createMission,
  loadMission,
  saveMission,
  listMissions,
  latestOpenMission,
  schedulerOrder,
  currentStep,
  startStep,
  completeStep,
  failStep,
  retryBlockedStep,
  resolveUncertainStep,
  recoverInterruptedMissions,
  summarizeMission
};
