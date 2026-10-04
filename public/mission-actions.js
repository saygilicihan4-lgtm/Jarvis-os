(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisMissionActions=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';

  const MISSION_ID_RE=/^M-[A-Z0-9-]{12,80}$/;
  const REQUEST_RE=/\bREQ\s+([a-f0-9]{20})\b/i;
  const TERMINAL=new Set(['completed','cancelled','failed']);
  const POLL_MS=420;
  const TIMEOUT_MS=65000;

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
    const req=requestFingerprintFromLabel(mission&&mission.label);
    if(!id||status!=='waiting_dependency'||dependencyOf(mission)!=='approval'||!req)return null;
    return{id,req,message:'onayla '+id+' req '+req};
  }
  function cancelDescriptor(mission){
    const id=cleanMissionId(mission&&mission.id);
    const status=String(mission&&mission.status||'').trim().toLowerCase();
    if(!id||TERMINAL.has(status))return null;
    return{id,message:'görevi iptal et '+id};
  }
  function actionMarkup(mission){
    const approve=approvalDescriptor(mission),cancel=cancelDescriptor(mission);
    if(!approve&&!cancel)return'';
    const parts=[];
    if(approve)parts.push('<button type="button" class="mini-btn" data-jarvis-mission-action="approve" data-jarvis-mission-id="'+approve.id+'" data-jarvis-mission-req="'+approve.req+'">ONAYLA</button>');
    if(cancel)parts.push('<button type="button" class="mini-btn" data-jarvis-mission-action="cancel" data-jarvis-mission-id="'+cancel.id+'">İPTAL</button>');
    return '<div class="jarvis-mission-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+parts.join('')+'</div>';
  }
  function decorateMissionCard(html,mission){
    const markup=actionMarkup(mission),source=String(html||'');
    if(!markup||source.includes('data-jarvis-mission-action='))return source;
    const end=source.lastIndexOf('</div>');
    return end>=0?source.slice(0,end)+markup+source.slice(end):source+markup;
  }
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  async function parseJson(response){
    try{return await response.json()}catch(_){return{}}
  }
  async function relayMessage(message,{fetchImpl,now=Date.now,wait=delay,timeoutMs=TIMEOUT_MS}={}){
    const send=fetchImpl||(root&&root.fetch&&root.fetch.bind(root));
    if(typeof send!=='function')throw new Error('mission_action_fetch_unavailable');
    const text=String(message||'').replace(/\s+/g,' ').trim();
    if(!text||text.length>220)throw new Error('mission_action_message_invalid');
    const createdResponse=await send('/api/mobile-brain',{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})
    });
    const created=await parseJson(createdResponse);
    if(!createdResponse.ok||!created.id)throw new Error(created.error||('mission_action_queue_'+createdResponse.status));
    const id=String(created.id),deadline=now()+Math.max(1000,Number(timeoutMs)||TIMEOUT_MS);
    while(now()<deadline){
      await wait(POLL_MS);
      const stateResponse=await send('/api/mobile-brain/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
      const state=await parseJson(stateResponse);
      if(!stateResponse.ok)throw new Error(state.error||('mission_action_poll_'+stateResponse.status));
      if(state.status==='ready')return{ok:true,id,result:state.result||null};
      if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error||('mission_action_'+state.status));
    }
    throw new Error('mission_action_timeout');
  }
  function statusNode(targetRoot){
    try{return targetRoot&&targetRoot.document&&targetRoot.document.getElementById('consoleStatus')}catch(_){return null}
  }
  function resultText(result){
    if(!result||typeof result!=='object')return'İşlem Worker kuyruğuna iletildi.';
    const text=String(result.reply||result.message||result.error||'').replace(/\s+/g,' ').trim();
    return text||'İşlem Worker tarafından işlendi.';
  }
  async function executeDescriptor(descriptor,button,targetRoot=root){
    if(!descriptor)throw new Error('mission_action_not_allowed');
    const status=statusNode(targetRoot),oldText=button&&button.textContent;
    if(button){button.disabled=true;button.textContent='İŞLENİYOR…'}
    if(status)status.textContent='MISSION CONTROL · PC WORKER ONAYI BEKLENİYOR';
    try{
      const out=await relayMessage(descriptor.message,{fetchImpl:targetRoot&&targetRoot.fetch&&targetRoot.fetch.bind(targetRoot)});
      if(status)status.textContent='MISSION CONTROL · '+resultText(out.result).slice(0,180);
      if(targetRoot&&typeof targetRoot.load==='function')await targetRoot.load().catch(()=>{});
      return out;
    }catch(error){
      if(status)status.textContent='MISSION CONTROL REDDEDİLDİ · '+String(error&&error.message||error).slice(0,150);
      throw error;
    }finally{
      if(button&&button.isConnected!==false){button.disabled=false;button.textContent=oldText||'İŞLEM'}
    }
  }
  async function handleClick(event,targetRoot=root){
    const el=event&&event.target&&typeof event.target.closest==='function'?event.target.closest('[data-jarvis-mission-action]'):null;
    if(!el)return false;
    const action=String(el.getAttribute('data-jarvis-mission-action')||'');
    const id=cleanMissionId(el.getAttribute('data-jarvis-mission-id'));
    if(!id)return false;
    event.preventDefault?.();
    if(action==='approve'){
      const req=String(el.getAttribute('data-jarvis-mission-req')||'').toLowerCase();
      if(!/^[a-f0-9]{20}$/.test(req))throw new Error('mission_approval_fingerprint_invalid');
      await executeDescriptor({id,req,message:'onayla '+id+' req '+req},el,targetRoot);
      return true;
    }
    if(action==='cancel'){
      await executeDescriptor({id,message:'görevi iptal et '+id},el,targetRoot);
      return true;
    }
    return false;
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
    cleanMissionId,
    requestFingerprintFromLabel,
    dependencyOf,
    approvalDescriptor,
    cancelDescriptor,
    actionMarkup,
    decorateMissionCard,
    relayMessage,
    install,
    autoInstall
  };
});
