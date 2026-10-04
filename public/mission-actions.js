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
      const resolved=await resolveFreshMission(req,{missionId,label,fetchImpl:targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot)});
      const message=commandFor(action,resolved);
      setStatus(action==='approve'?'MOBILE MISSION · AÇIK ONAY WORKER’A GÖNDERİLDİ':'MOBILE MISSION · İPTAL İSTEĞİ WORKER’A GÖNDERİLDİ',targetRoot);
      const result=await runMobileBrain(message,{fetchImpl:targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot)});
      setStatus('MOBILE MISSION · '+String(result&&result.reply||result&&result.message||'WORKER YANITI ALINDI').replace(/\s+/g,' ').slice(0,130),targetRoot);
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
  return{REQ_RE,MISSION_ID_RE,reqFromText,cleanMissionId,normalizedLabel,labelForMission,renderedCardLabel,approvalDependency,activeMission,missionQueueFromState,resolveMissionFromQueue,bindMissionCardHtml,missionIdFromSearch,missionIdFromLocation,resolveFreshMission,focusMissionById,scheduleMissionFocus,commandFor,runMobileBrain,act,enhance,install,autoInstall};
});