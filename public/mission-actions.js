(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMissionActions=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';

  const MISSION_ID_RE=/^M-[A-Z0-9-]{12,80}$/;
  const REQUEST_RE=/\bREQ\s+([a-f0-9]{20})\b/i;
  const POLL_MS=350;
  const RELAY_TIMEOUT_MS=30000;
  const PROOF_TIMEOUT_MS=18000;

  function cleanMissionId(value){
    const id=String(value||'').trim().toUpperCase();
    return MISSION_ID_RE.test(id)?id:'';
  }
  function requestFingerprintFromLabel(value){
    const match=String(value||'').match(REQUEST_RE);
    return match?String(match[1]).toLowerCase():'';
  }
  function dependencyOf(mission){
    const step=mission&&mission.step&&typeof mission.step==='object'?mission.step:{};
    const err=step.error&&typeof step.error==='object'?step.error:{};
    return String(step.dependency||err.dependency||'').trim().toLowerCase();
  }
  function approvalDescriptor(mission){
    const id=cleanMissionId(mission&&mission.id);
    const status=String(mission&&mission.status||'').trim().toLowerCase();
    const stepStatus=String(mission&&mission.step&&mission.step.status||'').trim().toLowerCase();
    const req=requestFingerprintFromLabel(mission&&mission.label);
    if(!id||status!=='waiting_dependency'||stepStatus!=='blocked'||dependencyOf(mission)!=='approval'||!req)return null;
    return{id,req};
  }
  function actionDescriptor(mission,action){
    const d=approvalDescriptor(mission),op=String(action||'').toLowerCase();
    if(!d||!['approve','cancel'].includes(op))return null;
    return{
      ...d,
      action:op,
      message:op==='approve'?('onayla '+d.id+' req '+d.req):('iptal et '+d.id+' req '+d.req)
    };
  }
  function actionMarkup(mission){
    const approve=actionDescriptor(mission,'approve'),cancel=actionDescriptor(mission,'cancel');
    if(!approve||!cancel)return'';
    return '<div class="jarvis-mission-actions" style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px">'
      +'<button type="button" class="mini-btn" data-jarvis-mission-action="approve" data-jarvis-mission-id="'+approve.id+'" data-jarvis-mission-req="'+approve.req+'">ONAYLA</button>'
      +'<button type="button" class="mini-btn" data-jarvis-mission-action="cancel" data-jarvis-mission-id="'+cancel.id+'" data-jarvis-mission-req="'+cancel.req+'">İPTAL</button>'
      +'</div>';
  }
  function decorateMissionCard(html,mission){
    const markup=actionMarkup(mission),source=String(html||'');
    if(!markup||source.includes('data-jarvis-mission-action='))return source;
    const end=source.lastIndexOf('</div>');
    return end>=0?source.slice(0,end)+markup+source.slice(end):source+markup;
  }
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function parseJson(response){try{return await response.json()}catch(_){return{}}}
  function fetchImplOrRoot(fetchImpl){
    const send=fetchImpl||(root&&root.fetch&&root.fetch.bind(root));
    if(typeof send!=='function')throw new Error('mission_action_fetch_unavailable');
    return send;
  }
  async function fetchCurrentMissions(fetchImpl){
    const send=fetchImplOrRoot(fetchImpl);
    const response=await send('/api/state',{credentials:'same-origin',cache:'no-store'});
    const state=await parseJson(response);
    if(!response.ok)throw new Error(state.error||('mission_state_'+response.status));
    const missions=state&&state.workers&&state.workers.pc&&state.workers.pc.missions;
    return missions&&Array.isArray(missions.queue)?missions.queue:[];
  }
  async function resolveFreshAction(id,req,action,{fetchImpl}={}){
    const cleanId=cleanMissionId(id),cleanReq=String(req||'').toLowerCase(),op=String(action||'').toLowerCase();
    if(!cleanId||!/^[a-f0-9]{20}$/.test(cleanReq)||!['approve','cancel'].includes(op))throw new Error('mission_action_target_invalid');
    const queue=await fetchCurrentMissions(fetchImpl);
    const matches=queue.filter(m=>{
      const d=approvalDescriptor(m);
      return d&&d.id===cleanId&&d.req===cleanReq;
    });
    if(matches.length!==1)throw new Error(matches.length?'mission_action_ambiguous':'mission_action_stale');
    return actionDescriptor(matches[0],op);
  }
  async function relayMessage(message,{fetchImpl,now=Date.now,wait=delay,timeoutMs=RELAY_TIMEOUT_MS}={}){
    const send=fetchImplOrRoot(fetchImpl);
    const text=String(message||'').replace(/\s+/g,' ').trim();
    if(!text||text.length>220)throw new Error('mission_action_message_invalid');
    const createdResponse=await send('/api/mobile-brain',{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})
    });
    const created=await parseJson(createdResponse);
    if(!createdResponse.ok||!created.id)throw new Error(created.error||('mission_action_queue_'+createdResponse.status));
    const relayId=String(created.id),deadline=now()+Math.max(1000,Number(timeoutMs)||RELAY_TIMEOUT_MS);
    while(now()<deadline){
      await wait(POLL_MS);
      const stateResponse=await send('/api/mobile-brain/'+encodeURIComponent(relayId),{credentials:'same-origin',cache:'no-store'});
      const state=await parseJson(stateResponse);
      if(!stateResponse.ok)throw new Error(state.error||('mission_action_poll_'+stateResponse.status));
      if(state.status==='ready')return{ok:true,id:relayId,result:state.result||null};
      if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error||('mission_action_'+state.status));
    }
    throw new Error('mission_action_timeout');
  }
  function collectResultText(value,depth=0,out=[]){
    if(depth>5||out.length>40||value==null)return out;
    if(typeof value==='string'){out.push(value.slice(0,1200));return out}
    if(Array.isArray(value)){for(const item of value.slice(0,12))collectResultText(item,depth+1,out);return out}
    if(typeof value==='object'){
      for(const [key,item] of Object.entries(value)){
        if(['reply','message','error','actionResult','actionResults','result'].includes(key))collectResultText(item,depth+1,out);
      }
    }
    return out;
  }
  function workerReceiptMatches(result,action){
    const text=collectResultText(result).join(' · ');
    return action==='approve'?/AÇIK ONAY UYGULANDI/i.test(text):/MISSION İPTAL EDİLDİ/i.test(text);
  }
  async function waitForStateProof(action,id,req,{fetchImpl,now=Date.now,wait=delay,timeoutMs=PROOF_TIMEOUT_MS}={}){
    const cleanId=cleanMissionId(id),cleanReq=String(req||'').toLowerCase(),op=String(action||'').toLowerCase();
    if(!cleanId||!/^[a-f0-9]{20}$/.test(cleanReq)||!['approve','cancel'].includes(op))throw new Error('mission_action_proof_target_invalid');
    const deadline=now()+Math.max(1000,Number(timeoutMs)||PROOF_TIMEOUT_MS);
    while(now()<deadline){
      const queue=await fetchCurrentMissions(fetchImpl);
      const sameId=queue.filter(m=>cleanMissionId(m&&m.id)===cleanId);
      if(op==='cancel'){
        if(sameId.length===0)return{ok:true,state:'mission_closed'};
      }else{
        const oldApproval=sameId.filter(m=>{
          const d=approvalDescriptor(m);return d&&d.req===cleanReq;
        });
        if(oldApproval.length===0)return{ok:true,state:'approval_request_consumed',missionPresent:sameId.length>0};
      }
      await wait(POLL_MS);
    }
    throw new Error(op==='approve'?'mission_approval_state_unconfirmed':'mission_cancel_state_unconfirmed');
  }
  async function relayAndVerify(descriptor,{fetchImpl,now=Date.now,wait=delay,relayTimeoutMs=RELAY_TIMEOUT_MS,proofTimeoutMs=PROOF_TIMEOUT_MS}={}){
    if(!descriptor||!['approve','cancel'].includes(descriptor.action))throw new Error('mission_action_not_allowed');
    const relay=await relayMessage(descriptor.message,{fetchImpl,now,wait,timeoutMs:relayTimeoutMs});
    if(!workerReceiptMatches(relay.result,descriptor.action))throw new Error('mission_action_worker_receipt_missing');
    const proof=await waitForStateProof(descriptor.action,descriptor.id,descriptor.req,{fetchImpl,now,wait,timeoutMs:proofTimeoutMs});
    return{ok:true,relay,proof};
  }
  function statusNode(targetRoot){
    try{return targetRoot&&targetRoot.document&&targetRoot.document.getElementById('consoleStatus')}catch(_){return null}
  }
  async function executeDescriptor(descriptor,button,targetRoot=root){
    if(!descriptor)throw new Error('mission_action_not_allowed');
    const status=statusNode(targetRoot),oldText=button&&button.textContent;
    if(button){button.disabled=true;button.textContent='DOĞRULANIYOR…'}
    if(status)status.textContent='MOBILE MISSION · WORKER RECEIPT + STATE PROOF BEKLENİYOR';
    try{
      const fetchImpl=targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot);
      const out=await relayAndVerify(descriptor,{fetchImpl});
      if(status)status.textContent=descriptor.action==='approve'
        ?'MOBILE MISSION · ONAY DOĞRULANDI · ESKİ REQ TÜKETİLDİ'
        :'MOBILE MISSION · İPTAL DOĞRULANDI · GÖREV AÇIK KUYRUKTAN ÇIKTI';
      if(targetRoot&&typeof targetRoot.load==='function')await targetRoot.load().catch(()=>{});
      return out;
    }catch(error){
      if(status)status.textContent='MOBILE MISSION · FAIL CLOSED · '+String(error&&error.message||error).slice(0,130);
      throw error;
    }finally{
      if(button&&button.isConnected!==false){button.disabled=false;button.textContent=oldText||'İŞLEM'}
    }
  }
  async function handleClick(event,targetRoot=root){
    const el=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-jarvis-mission-action]'):null;
    if(!el)return false;
    const action=String(el.getAttribute('data-jarvis-mission-action')||'').toLowerCase();
    const id=cleanMissionId(el.getAttribute('data-jarvis-mission-id'));
    const req=String(el.getAttribute('data-jarvis-mission-req')||'').toLowerCase();
    if(!id||!/^[a-f0-9]{20}$/.test(req)||!['approve','cancel'].includes(action))return false;
    event.preventDefault?.();
    const fetchImpl=targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot);
    const fresh=await resolveFreshAction(id,req,action,{fetchImpl});
    await executeDescriptor(fresh,el,targetRoot);
    return true;
  }
  function install(targetRoot=root){
    if(!targetRoot||!targetRoot.document)return false;
    if(targetRoot.__jarvisMissionActionsInstalled)return true;
    if(typeof targetRoot.localMissionCard!=='function')return false;
    const original=targetRoot.localMissionCard;
    targetRoot.localMissionCard=function(mission){return decorateMissionCard(original(mission),mission)};
    targetRoot.document.addEventListener('click',event=>{handleClick(event,targetRoot).catch(()=>{})});
    targetRoot.__jarvisMissionActionsInstalled=true;
    if(typeof targetRoot.renderMissionQueue==='function')try{targetRoot.renderMissionQueue()}catch(_){}
    return true;
  }
  function autoInstall(targetRoot=root,attempt=0){
    if(!targetRoot||!targetRoot.document)return false;
    if(install(targetRoot))return true;
    if(attempt<60)targetRoot.setTimeout(()=>autoInstall(targetRoot,attempt+1),100);
    return false;
  }

  if(root&&root.document)root.setTimeout(()=>autoInstall(root,0),0);
  return{
    cleanMissionId,requestFingerprintFromLabel,dependencyOf,approvalDescriptor,actionDescriptor,
    actionMarkup,decorateMissionCard,fetchCurrentMissions,resolveFreshAction,relayMessage,
    collectResultText,workerReceiptMatches,waitForStateProof,relayAndVerify,install,autoInstall
  };
});
