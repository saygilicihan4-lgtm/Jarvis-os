(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMissionActions=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';

  const REQ_RE=/\bREQ\s+([a-f0-9]{20})\b/i;
  const MISSION_ID_RE=/^M-[A-Z0-9-]{12,80}$/;
  const TERMINAL=new Set(['completed','failed','cancelled']);
  const POLL_MS=350;
  const TIMEOUT_MS=30000;
  const PROOF_TIMEOUT_MS=18000;

  function reqFromText(text){
    const match=String(text||'').match(REQ_RE);
    return match?String(match[1]).toLowerCase():'';
  }
  function cleanMissionId(value){
    const id=String(value||'').trim().toUpperCase();
    return MISSION_ID_RE.test(id)?id:'';
  }
  function approvalDependency(mission){
    const step=mission&&mission.step||{},err=step&&step.error||{};
    return String(mission&&mission.status||'')==='waiting_dependency'&&
      String(step.status||'')==='blocked'&&
      String(err.dependency||step.dependency||'')==='approval';
  }
  function activeMission(mission){
    const status=String(mission&&mission.status||'').trim().toLowerCase();
    return !!cleanMissionId(mission&&mission.id)&&!TERMINAL.has(status);
  }
  function missionQueueFromState(state){
    const missions=state&&state.workers&&state.workers.pc&&state.workers.pc.missions;
    return missions&&Array.isArray(missions.queue)?missions.queue:[];
  }
  function resolveMissionFromQueue(queue,req){
    const fingerprint=String(req||'').toLowerCase();
    if(!/^[a-f0-9]{20}$/.test(fingerprint))throw new Error('mission_approval_fingerprint_invalid');
    const rows=(Array.isArray(queue)?queue:[]).filter(m=>approvalDependency(m)&&reqFromText(m&&m.label)===fingerprint);
    if(rows.length!==1)throw new Error(rows.length?'mission_approval_ambiguous':'mission_approval_stale');
    const mission=rows[0],id=cleanMissionId(mission&&mission.id);
    if(!id)throw new Error('mission_id_invalid');
    return{mission,id,req:fingerprint};
  }
  async function parseJson(response){
    try{return await response.json()}catch(_){return{}}
  }
  async function jsonFetch(url,options={},fetchImpl){
    const send=fetchImpl||(root&&root.fetch&&root.fetch.bind(root));
    if(typeof send!=='function')throw new Error('mission_action_fetch_unavailable');
    const response=await send(url,{credentials:'same-origin',cache:'no-store',...options});
    const data=await parseJson(response);
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    return data;
  }
  async function resolveFreshMission(req,{fetchImpl}={}){
    const state=await jsonFetch('/api/state',{},fetchImpl);
    return resolveMissionFromQueue(missionQueueFromState(state),req);
  }
  function commandFor(action,resolved){
    const id=cleanMissionId(resolved&&resolved.id),req=String(resolved&&resolved.req||'').toLowerCase();
    if(!id||!/^[a-f0-9]{20}$/.test(req))throw new Error('mission_action_target_invalid');
    if(action==='approve')return'onayla '+id+' req '+req;
    if(action==='cancel')return'iptal et '+id+' req '+req;
    throw new Error('mission_action_unknown');
  }
  async function runMobileBrain(message,{fetchImpl,wait,now,timeoutMs=TIMEOUT_MS}={}){
    const pause=wait||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
    const clock=now||Date.now;
    const text=String(message||'').replace(/\s+/g,' ').trim();
    if(!text||text.length>300)throw new Error('mission_action_message_invalid');
    const created=await jsonFetch('/api/mobile-brain',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})
    },fetchImpl);
    const id=String(created&&created.id||'');
    if(!/^[0-9a-f-]{8,80}$/i.test(id))throw new Error('mission_action_queue_invalid');
    const deadline=clock()+Math.max(1000,Number(timeoutMs)||TIMEOUT_MS);
    while(clock()<deadline){
      await pause(POLL_MS);
      const state=await jsonFetch('/api/mobile-brain/'+encodeURIComponent(id),{},fetchImpl);
      if(state.status==='ready')return state.result||{ok:true};
      if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error||('mobile_brain_'+state.status));
    }
    throw new Error('mission_action_timeout');
  }
  function collectResultText(value,depth=0,out=[]){
    if(depth>5||out.length>40||value==null)return out;
    if(typeof value==='string'){
      out.push(value.slice(0,1200));
      return out;
    }
    if(Array.isArray(value)){
      for(const item of value.slice(0,12))collectResultText(item,depth+1,out);
      return out;
    }
    if(typeof value==='object'){
      for(const [key,item] of Object.entries(value)){
        if(['reply','message','error','result','actionResult','actionResults'].includes(key))collectResultText(item,depth+1,out);
      }
    }
    return out;
  }
  function workerReceiptMatches(result,action){
    const text=collectResultText(result).join(' · ');
    if(action==='approve')return /AÇIK ONAY UYGULANDI/i.test(text);
    if(action==='cancel')return /MISSION İPTAL EDİLDİ/i.test(text);
    return false;
  }
  async function waitForActionProof(action,id,req,{fetchImpl,wait,now,timeoutMs=PROOF_TIMEOUT_MS}={}){
    const op=String(action||'').trim().toLowerCase();
    const missionId=cleanMissionId(id),fingerprint=String(req||'').toLowerCase();
    if(!['approve','cancel'].includes(op)||!missionId||!/^[a-f0-9]{20}$/.test(fingerprint))throw new Error('mission_action_proof_target_invalid');
    const pause=wait||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
    const clock=now||Date.now;
    const deadline=clock()+Math.max(1000,Number(timeoutMs)||PROOF_TIMEOUT_MS);
    while(clock()<deadline){
      const state=await jsonFetch('/api/state',{},fetchImpl);
      const queue=missionQueueFromState(state);
      const sameId=queue.filter(m=>cleanMissionId(m&&m.id)===missionId);
      if(op==='cancel'){
        if(sameId.length===0)return{ok:true,state:'mission_closed'};
      }else{
        const oldApproval=sameId.filter(m=>approvalDependency(m)&&reqFromText(m&&m.label)===fingerprint);
        if(oldApproval.length===0)return{ok:true,state:'approval_request_consumed',missionPresent:sameId.length>0};
      }
      await pause(POLL_MS);
    }
    throw new Error(op==='approve'?'mission_approval_state_unconfirmed':'mission_cancel_state_unconfirmed');
  }
  async function runActionWithProof(action,resolved,{fetchImpl,wait,now,relayTimeoutMs=TIMEOUT_MS,proofTimeoutMs=PROOF_TIMEOUT_MS}={}){
    const op=String(action||'').trim().toLowerCase();
    const id=cleanMissionId(resolved&&resolved.id),req=String(resolved&&resolved.req||'').toLowerCase();
    const message=commandFor(op,resolved);
    const result=await runMobileBrain(message,{fetchImpl,wait,now,timeoutMs:relayTimeoutMs});
    if(!workerReceiptMatches(result,op))throw new Error('mission_action_worker_receipt_missing');
    const proof=await waitForActionProof(op,id,req,{fetchImpl,wait,now,timeoutMs:proofTimeoutMs});
    return{ok:true,result,proof};
  }
  function setStatus(text,targetRoot=root){
    const el=targetRoot&&targetRoot.document&&targetRoot.document.getElementById('consoleStatus');
    if(el)el.textContent=String(text||'').slice(0,180);
  }
  async function act(card,action,targetRoot=root){
    const req=reqFromText(card&&card.textContent||'');
    if(!req){setStatus('MOBILE MISSION · REQ KODU YOK · İŞLEM YAPILMADI',targetRoot);return false}
    const buttons=card&&card.querySelectorAll?[...card.querySelectorAll('[data-jarvis-mission-action]')]:[];
    buttons.forEach(button=>button.disabled=true);
    try{
      setStatus('MOBILE MISSION · GÜNCEL HEDEF DOĞRULANIYOR',targetRoot);
      const fetchImpl=targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot);
      const resolved=await resolveFreshMission(req,{fetchImpl});
      setStatus('MOBILE MISSION · WORKER RECEIPT + STATE PROOF BEKLENİYOR',targetRoot);
      await runActionWithProof(action,resolved,{fetchImpl});
      setStatus(action==='approve'
        ?'MOBILE MISSION · ONAY DOĞRULANDI · ESKİ REQ TÜKETİLDİ'
        :'MOBILE MISSION · İPTAL DOĞRULANDI · GÖREV AÇIK KUYRUKTAN ÇIKTI',targetRoot);
      if(targetRoot&&typeof targetRoot.load==='function')await targetRoot.load().catch(()=>{});
      return true;
    }catch(error){
      setStatus('MOBILE MISSION · FAIL CLOSED · '+String(error&&error.message||error).slice(0,120),targetRoot);
      return false;
    }finally{buttons.forEach(button=>button.disabled=false)}
  }
  function enhance(targetRoot=root){
    if(!targetRoot||!targetRoot.document)return false;
    for(const card of targetRoot.document.querySelectorAll('.local-mission')){
      if(card.dataset.jarvisMissionApproval==='1')continue;
      const req=reqFromText(card.textContent||'');
      if(!req||!/\bONAY\b/i.test(String(card.textContent||'')))continue;
      const wrap=targetRoot.document.createElement('div');wrap.dataset.jarvisMissionControls='1';wrap.style.cssText='display:flex;gap:7px;flex-wrap:wrap;margin-top:8px';
      const approve=targetRoot.document.createElement('button');approve.type='button';approve.className='mini-btn';approve.textContent='ONAYLA';approve.dataset.jarvisMissionAction='approve';approve.addEventListener('click',()=>act(card,'approve',targetRoot));
      const cancel=targetRoot.document.createElement('button');cancel.type='button';cancel.className='mini-btn';cancel.textContent='İPTAL';cancel.dataset.jarvisMissionAction='cancel';cancel.addEventListener('click',()=>act(card,'cancel',targetRoot));
      wrap.append(approve,cancel);card.appendChild(wrap);card.dataset.jarvisMissionApproval='1';
    }
    return true;
  }
  function install(targetRoot=root){
    if(!targetRoot||!targetRoot.document)return false;
    if(targetRoot.__jarvisMissionActionsInstalled)return true;
    const target=targetRoot.document.getElementById('tasks');if(!target)return false;
    enhance(targetRoot);
    const Observer=targetRoot.MutationObserver||root&&root.MutationObserver;
    if(typeof Observer==='function'){
      const observer=new Observer(()=>enhance(targetRoot));observer.observe(target,{childList:true,subtree:true});
    }
    targetRoot.__jarvisMissionActionsInstalled=true;
    return true;
  }
  function autoInstall(targetRoot=root,attempt=0){
    if(!targetRoot||!targetRoot.document)return false;
    if(install(targetRoot))return true;
    if(attempt<40)targetRoot.setTimeout(()=>autoInstall(targetRoot,attempt+1),100);
    return false;
  }

  if(root&&root.document&&/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))root.setTimeout(()=>autoInstall(root,0),0);
  return{
    REQ_RE,MISSION_ID_RE,reqFromText,cleanMissionId,approvalDependency,activeMission,missionQueueFromState,
    resolveMissionFromQueue,resolveFreshMission,commandFor,runMobileBrain,collectResultText,workerReceiptMatches,
    waitForActionProof,runActionWithProof,act,enhance,install,autoInstall
  };
});