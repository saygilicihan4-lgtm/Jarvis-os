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
  const RECEIPT_STORAGE_KEY='jarvisMissionReceiptsV1';
  const RECEIPT_LIMIT=8;
  const RECEIPT_STORAGE_MAX=4096;
  // Display evidence only; never consulted by an authorization path.
  const verifiedProofs=new WeakMap();

  function reqFromText(text){
    const match=String(text||'').match(REQ_RE);
    return match?String(match[1]).toLowerCase():'';
  }
  function cleanMissionId(value){
    const id=String(value||'').trim().toUpperCase();
    return MISSION_ID_RE.test(id)?id:'';
  }
  function normalizedLabel(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function labelForMission(mission){return normalizedLabel(mission&&mission.label||mission&&mission.type||'JARVIS mission')}
  function renderedCardLabel(card){
    const node=card&&card.querySelector&&card.querySelector('.task-head b');
    return normalizedLabel(node&&node.textContent||'');
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
  function resolveMissionFromQueue(queue,req,{missionId='',label=''}={}){
    const fingerprint=String(req||'').toLowerCase();
    if(!/^[a-f0-9]{20}$/.test(fingerprint))throw new Error('mission_approval_fingerprint_invalid');
    const targetId=missionId?cleanMissionId(missionId):'';
    if(missionId&&!targetId)throw new Error('mission_action_target_invalid');
    const targetLabel=normalizedLabel(label);
    const rows=(Array.isArray(queue)?queue:[]).filter(m=>{
      if(!approvalDependency(m)||reqFromText(m&&m.label)!==fingerprint)return false;
      if(targetId&&cleanMissionId(m&&m.id)!==targetId)return false;
      if(targetLabel&&labelForMission(m)!==targetLabel)return false;
      return true;
    });
    if(rows.length!==1)throw new Error(rows.length?'mission_approval_ambiguous':'mission_approval_stale');
    const mission=rows[0],id=cleanMissionId(mission&&mission.id);
    if(!id)throw new Error('mission_id_invalid');
    return{mission,id,req:fingerprint,label:labelForMission(mission)};
  }
  function bindMissionCardHtml(html,mission){
    const source=String(html||''),id=cleanMissionId(mission&&mission.id);
    if(!id||source.includes('data-jarvis-mission-id='))return source;
    return source.replace('<div class="task local-mission"','<div class="task local-mission" data-jarvis-mission-id="'+id+'"');
  }
  function missionIdFromSearch(search){
    try{return cleanMissionId(new URLSearchParams(String(search||'')).get('mission'))}catch(_){return''}
  }
  function missionIdFromLocation(targetRoot=root){
    return missionIdFromSearch(targetRoot&&targetRoot.location&&targetRoot.location.search||'');
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
  async function resolveFreshMission(req,{missionId='',label='',fetchImpl}={}){
    const state=await jsonFetch('/api/state',{},fetchImpl);
    return resolveMissionFromQueue(missionQueueFromState(state),req,{missionId,label});
  }
  async function focusMissionById(id,{fetchImpl,targetRoot=root}={}){
    const requested=cleanMissionId(id);
    if(!requested)throw new Error('mission_deeplink_id_invalid');
    if(!targetRoot||!targetRoot.document)throw new Error('mission_deeplink_dom_unavailable');
    const state=await jsonFetch('/api/state',{},fetchImpl);
    const queue=missionQueueFromState(state);
    const rows=queue.filter(m=>cleanMissionId(m&&m.id)===requested&&activeMission(m));
    const cards=[...targetRoot.document.querySelectorAll('.local-mission')].filter(card=>cleanMissionId(card&&card.dataset&&card.dataset.jarvisMissionId)===requested);
    if(rows.length!==1)throw new Error(rows.length?'mission_deeplink_ambiguous':'mission_deeplink_stale');
    if(cards.length!==1)throw new Error(cards.length?'mission_deeplink_card_ambiguous':'mission_deeplink_card_missing');
    const card=cards[0];
    if(renderedCardLabel(card)!==labelForMission(rows[0]))throw new Error('mission_deeplink_card_mismatch');
    card.dataset.jarvisMissionFocused='1';
    if(card.style){card.style.outline='2px solid currentColor';card.style.outlineOffset='3px'}
    try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){try{card.scrollIntoView()}catch(__){}}
    setStatus('MOBILE MISSION · BİLDİRİMDEN İLGİLİ GÖREV AÇILDI · '+requested.slice(-8),targetRoot);
    if(targetRoot.setTimeout)targetRoot.setTimeout(()=>{try{if(card.style){card.style.outline='';card.style.outlineOffset=''}}catch(_){}},8000);
    return{mission:rows[0],id:requested,card};
  }
  function scheduleMissionFocus(targetRoot=root,attempt=0){
    if(!targetRoot||!targetRoot.document)return false;
    const requested=missionIdFromLocation(targetRoot);
    if(!requested)return false;
    if(targetRoot.__jarvisMissionFocusedId===requested)return true;
    if(targetRoot.__jarvisMissionFocusPending)return false;
    targetRoot.__jarvisMissionFocusPending=true;
    focusMissionById(requested,{fetchImpl:targetRoot.fetch&&targetRoot.fetch.bind(targetRoot),targetRoot})
      .then(()=>{targetRoot.__jarvisMissionFocusedId=requested})
      .catch(()=>{
        if(attempt<24&&targetRoot.setTimeout)targetRoot.setTimeout(()=>scheduleMissionFocus(targetRoot,attempt+1),250);
        else setStatus('MOBILE MISSION · BİLDİRİM HEDEFİ ARTIK AKTİF DEĞİL',targetRoot);
      })
      .finally(()=>{targetRoot.__jarvisMissionFocusPending=false});
    return false;
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
      const pc=state&&state.workers&&state.workers.pc;
      const missions=pc&&pc.missions;
      if(!pc||pc.online!==true||!missions||missions.ok!==true||!Array.isArray(missions.queue)||
        !Number.isInteger(missions.openCount)||missions.openCount<missions.queue.length||
        missions.queue.some(m=>!m||!cleanMissionId(m.id)||typeof m.label!=='string'||
          !['queued','running','paused','waiting_dependency','needs_verification'].includes(m.status))||
        new Set(missions.queue.map(m=>cleanMissionId(m.id))).size!==missions.queue.length){
        throw new Error('mission_action_state_invalid');
      }
      const queue=missionQueueFromState(state);
      const sameId=queue.filter(m=>cleanMissionId(m&&m.id)===missionId);
      if(sameId.some(m=>m.status==='waiting_dependency'&&(!m.step||m.step.status!=='blocked'||
        !String(m.step.dependency||m.step.error&&m.step.error.dependency||'')||
        (approvalDependency(m)&&!reqFromText(m.label)))))throw new Error('mission_action_state_invalid');
      // A truncated queue cannot prove that an absent mission was closed.
      const complete=missions.openCount===queue.length;
      if(op==='cancel'){
        if(sameId.length===0&&complete)return{ok:true,state:'mission_closed'};
      }else{
        const oldApproval=sameId.filter(m=>approvalDependency(m)&&reqFromText(m&&m.label)===fingerprint);
        if(oldApproval.length===0&&(sameId.length===1||complete))return{ok:true,state:'approval_request_consumed',missionPresent:sameId.length>0};
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
    const proof=Object.freeze(await waitForActionProof(op,id,req,{fetchImpl,wait,now,timeoutMs:proofTimeoutMs}));
    verifiedProofs.set(proof,{action:op,id,req});
    return{ok:true,result,proof};
  }
  function sanitizeVerifiedReceipt(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.v!==1)return null;
    const {action,mission,req,proof,state,at}=value;
    if([action,mission,req,proof,state,at].some(x=>typeof x!=='string'))return null;
    if(!['approve','cancel'].includes(action)||!/^[A-Z0-9-]{8}$/.test(mission)||!/^[a-f0-9]{8}$/.test(req))return null;
    if(proof!=='worker_receipt+durable_state')return null;
    if(action==='approve'&&state!=='approval_request_consumed')return null;
    if(action==='cancel'&&state!=='mission_closed')return null;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)||!Number.isFinite(Date.parse(at)))return null;
    if(new Date(at).toISOString()!==at)return null;
    return{v:1,action,mission,req,proof,state,at};
  }
  function buildVerifiedReceipt(action,resolved,proof,now=Date.now()){
    const op=String(action||'').trim().toLowerCase();
    const id=cleanMissionId(resolved&&resolved.id),req=String(resolved&&resolved.req||'').toLowerCase();
    const proofState=String(proof&&proof.state||'');
    const binding=verifiedProofs.get(proof);
    const stamp=Number(typeof now==='function'?now():now);
    if(!id||!/^[a-f0-9]{20}$/.test(req)||!Number.isFinite(stamp))throw new Error('mission_receipt_target_invalid');
    const expected=op==='approve'?'approval_request_consumed':op==='cancel'?'mission_closed':'';
    if(!expected||proofState!==expected||!binding||binding.action!==op||binding.id!==id||binding.req!==req)throw new Error('mission_receipt_proof_invalid');
    const receipt=sanitizeVerifiedReceipt({
      v:1,action:op,mission:id.slice(-8),req:req.slice(-8),proof:'worker_receipt+durable_state',state:proofState,at:new Date(stamp).toISOString()
    });
    if(!receipt)throw new Error('mission_receipt_invalid');
    return receipt;
  }
  function verifiedReceiptText(receipt){
    const clean=sanitizeVerifiedReceipt(receipt);
    if(!clean)return'';
    const action=clean.action==='approve'?'ONAY':'İPTAL';
    const proof=clean.action==='approve'?'REQ TÜKETİLDİ':'GÖREV KAPANDI';
    return'DOĞRULANDI · '+action+' · M…'+clean.mission+' · REQ …'+clean.req+' · WORKER + DURUM · '+proof+' · '+clean.at;
  }
  function readVerifiedReceipts(targetRoot=root){
    try{
      const storage=targetRoot&&targetRoot.sessionStorage;
      if(!storage||typeof storage.getItem!=='function')return[];
      const raw=storage.getItem(RECEIPT_STORAGE_KEY)||'[]';
      if(typeof raw!=='string'||raw.length>RECEIPT_STORAGE_MAX)throw new Error('receipt_storage_invalid');
      const rows=JSON.parse(raw);
      if(!Array.isArray(rows))throw new Error('receipt_storage_invalid');
      const clean=rows.slice(-RECEIPT_LIMIT).map(sanitizeVerifiedReceipt).filter(Boolean);
      // Remove unknown fields and malformed records from storage as well as output.
      if(JSON.stringify(clean)!==raw)storage.setItem(RECEIPT_STORAGE_KEY,JSON.stringify(clean));
      return clean;
    }catch(_){
      try{targetRoot.sessionStorage.removeItem(RECEIPT_STORAGE_KEY)}catch(__){}
      return[];
    }
  }
  function storeVerifiedReceipt(receipt,targetRoot=root){
    try{
      const clean=sanitizeVerifiedReceipt(receipt),storage=targetRoot&&targetRoot.sessionStorage;
      if(!clean||!storage||typeof storage.setItem!=='function')return false;
      const rows=readVerifiedReceipts(targetRoot);
      rows.push(clean);
      storage.setItem(RECEIPT_STORAGE_KEY,JSON.stringify(rows.slice(-RECEIPT_LIMIT)));
      return true;
    }catch(_){return false}
  }
  function setStatus(text,targetRoot=root){
    const el=targetRoot&&targetRoot.document&&targetRoot.document.getElementById('consoleStatus');
    if(el)el.textContent=String(text||'').slice(0,180);
  }
  async function act(card,action,targetRoot=root){
    const req=reqFromText(card&&card.textContent||'');
    const missionId=cleanMissionId(card&&card.dataset&&card.dataset.jarvisMissionId);
    const label=renderedCardLabel(card);
    if(!req||!missionId||!label){setStatus('MOBILE MISSION · HEDEF DOĞRULANAMADI · İŞLEM YAPILMADI',targetRoot);return false}
    const buttons=card&&card.querySelectorAll?[...card.querySelectorAll('[data-jarvis-mission-action]')]:[];
    buttons.forEach(button=>button.disabled=true);
    try{
      setStatus('MOBILE MISSION · GÜNCEL HEDEF DOĞRULANIYOR',targetRoot);
      const fetchImpl=targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot);
      const resolved=await resolveFreshMission(req,{missionId,label,fetchImpl});
      setStatus('MOBILE MISSION · WORKER RECEIPT + STATE PROOF BEKLENİYOR',targetRoot);
      const verified=await runActionWithProof(action,resolved,{fetchImpl});
      const receipt=buildVerifiedReceipt(action,resolved,verified.proof);
      storeVerifiedReceipt(receipt,targetRoot);
      if(targetRoot&&typeof targetRoot.load==='function')try{await targetRoot.load()}catch(_){}
      setStatus('MOBILE MISSION · '+verifiedReceiptText(receipt),targetRoot);
      return true;
    }catch(error){
      const code=String(error&&error.message||'');
      const safeCode=/^mission_[a-z_]{1,64}$/.test(code)?code:'mission_action_unconfirmed';
      setStatus('MOBILE MISSION · FAIL CLOSED · '+safeCode,targetRoot);
      return false;
    }finally{buttons.forEach(button=>button.disabled=false)}
  }
  function enhance(targetRoot=root){
    if(!targetRoot||!targetRoot.document)return false;
    for(const card of targetRoot.document.querySelectorAll('.local-mission')){
      if(card.dataset.jarvisMissionApproval==='1')continue;
      const missionId=cleanMissionId(card&&card.dataset&&card.dataset.jarvisMissionId);
      const req=reqFromText(card.textContent||'');
      if(!missionId||!req||!/\bONAY\b/i.test(String(card.textContent||'')))continue;
      const wrap=targetRoot.document.createElement('div');wrap.dataset.jarvisMissionControls='1';wrap.style.cssText='display:flex;gap:7px;flex-wrap:wrap;margin-top:8px';
      const approve=targetRoot.document.createElement('button');approve.type='button';approve.className='mini-btn';approve.textContent='ONAYLA';approve.dataset.jarvisMissionAction='approve';approve.addEventListener('click',()=>act(card,'approve',targetRoot));
      const cancel=targetRoot.document.createElement('button');cancel.type='button';cancel.className='mini-btn';cancel.textContent='İPTAL';cancel.dataset.jarvisMissionAction='cancel';cancel.addEventListener('click',()=>act(card,'cancel',targetRoot));
      wrap.append(approve,cancel);card.appendChild(wrap);card.dataset.jarvisMissionApproval='1';
    }
    return true;
  }
  function install(targetRoot=root){
    if(!targetRoot||!targetRoot.document)return false;
    if(targetRoot.__jarvisMissionActionsInstalled){scheduleMissionFocus(targetRoot);return true}
    const target=targetRoot.document.getElementById('tasks');
    if(!target||typeof targetRoot.localMissionCard!=='function')return false;
    if(!targetRoot.__jarvisMissionRendererWrapped){
      const original=targetRoot.localMissionCard;
      targetRoot.localMissionCard=function(mission){return bindMissionCardHtml(original(mission),mission)};
      targetRoot.__jarvisMissionRendererWrapped=true;
      if(typeof targetRoot.renderMissionQueue==='function')try{targetRoot.renderMissionQueue()}catch(_){}
    }
    enhance(targetRoot);scheduleMissionFocus(targetRoot);
    const Observer=targetRoot.MutationObserver||root&&root.MutationObserver;
    if(typeof Observer==='function'){
      const observer=new Observer(()=>{enhance(targetRoot);scheduleMissionFocus(targetRoot)});observer.observe(target,{childList:true,subtree:true});
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
    REQ_RE,MISSION_ID_RE,RECEIPT_STORAGE_KEY,RECEIPT_LIMIT,RECEIPT_STORAGE_MAX,reqFromText,cleanMissionId,normalizedLabel,labelForMission,renderedCardLabel,approvalDependency,activeMission,missionQueueFromState,
    resolveMissionFromQueue,bindMissionCardHtml,missionIdFromSearch,missionIdFromLocation,resolveFreshMission,focusMissionById,scheduleMissionFocus,
    commandFor,runMobileBrain,collectResultText,workerReceiptMatches,waitForActionProof,runActionWithProof,
    sanitizeVerifiedReceipt,buildVerifiedReceipt,verifiedReceiptText,readVerifiedReceipts,storeVerifiedReceipt,
    act,enhance,install,autoInstall
  };
});
