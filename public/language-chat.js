(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.JarvisLanguageChat=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function createClient({request,play,onState=()=>{},onReply=()=>{}}){
    let sessionId=null,controller=null,busy=false;
    async function run(){
      if(busy)return{ok:false,state:'busy'};
      busy=true;controller=new AbortController();const active=controller;
      let receipt=null,acknowledged=false;
      onState('preparing');
      try{
        if(!sessionId){const created=await request({action:'create'},active.signal);sessionId=created.sessionId;if(!sessionId)throw new Error('session_create_failed')}
        active.signal.throwIfAborted();
        const result=await request({action:'turn',sessionId},active.signal);
        receipt=result.receipt||null;
        active.signal.throwIfAborted();
        if(result.state==='confirm-language'){onState('confirm-language',result);return result}
        if(!result.ok||result.state!=='audio-ready')throw new Error(result.reason||result.error||'speech_language_unavailable');
        onReply(result);onState('playing',result);
        await play(result,active.signal);
        active.signal.throwIfAborted();
        const completed=await request({action:'acknowledge',sessionId,receipt,played:true},active.signal);
        acknowledged=true;onState('completed',completed);return completed;
      }catch(error){
        if(!active.signal.aborted)onState('error',{error:String(error.message||error)});
        if(/session_expired|session_not_found/.test(String(error.message||error)))sessionId=null;
        return{ok:false,cancelled:active.signal.aborted,error:String(error.message||error)};
      }finally{
        if(receipt&&!acknowledged&&sessionId)try{await request({action:'acknowledge',sessionId,receipt,played:false})}catch(_){}
        if(controller===active){controller=null;busy=false;onState('idle')}
      }
    }
    async function cancel(){
      controller?.abort();
      if(sessionId)try{await request({action:'cancel',sessionId})}catch(_){}
    }
    return{run,cancel,get busy(){return busy}};
  }
  return{createClient};
});

;(function(root){
  'use strict';
  if(!root||!root.document||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return;
  function loadScript(id,src){
    return new Promise((resolve,reject)=>{
      if(root.document.getElementById(id)){
        const ready=id==='jarvisMobileSpeechEvidenceCoreScript'?root.JarvisMobileSpeechEvidenceStatus:root.JarvisMobileSpeechEvidenceUi;
        if(ready){resolve(true);return}
      }
      const script=root.document.createElement('script');script.id=id;script.src=src;script.async=false;
      script.onload=()=>resolve(true);script.onerror=()=>reject(new Error('script_load_failed:'+src));
      (root.document.head||root.document.documentElement).appendChild(script);
    });
  }
  async function boot(attempt=0){
    if(!root.JarvisMobileLanguageChat){
      if(attempt<20)setTimeout(()=>boot(attempt+1),100);
      return false;
    }
    try{
      if(!root.JarvisMobileSpeechEvidenceStatus)await loadScript('jarvisMobileSpeechEvidenceCoreScript','/mobile-speech-evidence-status.js');
      if(!root.JarvisMobileSpeechEvidenceUi)await loadScript('jarvisMobileSpeechEvidenceUiScript','/mobile-speech-evidence-ui.js');
      return !!(root.JarvisMobileSpeechEvidenceUi&&root.JarvisMobileSpeechEvidenceUi.install(root.document));
    }catch(_){return false}
  }
  setTimeout(()=>boot(0),0);
})(typeof globalThis==='object'?globalThis:this);

;(function(root){
  'use strict';
  if(!root||!root.document||!root.fetch||!/iPhone|iPad|iPod|Android/i.test(String(root.navigator&&root.navigator.userAgent||'')))return;
  const REQ_RE=/\bREQ\s+([a-f0-9]{20})\b/i;
  const MISSION_ID_RE=/^M-[A-Z0-9-]{12,80}$/;
  const TERMINAL=new Set(['completed','failed','cancelled']);
  let missionFocusDone=false,missionFocusRunning=false;
  function setStatus(text){
    const el=root.document.getElementById('consoleStatus');
    if(el)el.textContent=String(text||'').slice(0,180);
  }
  async function jsonFetch(url,options={}){
    const response=await root.fetch(url,{credentials:'same-origin',cache:'no-store',...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    return data;
  }
  function missionQueue(state){
    const missions=state&&state.workers&&state.workers.pc&&state.workers.pc.missions;
    return missions&&Array.isArray(missions.queue)?missions.queue:[];
  }
  function missionIdFromLocation(){
    try{
      const id=String(new URLSearchParams(root.location&&root.location.search||'').get('mission')||'').toUpperCase();
      return MISSION_ID_RE.test(id)?id:'';
    }catch(_){return''}
  }
  function renderedCardLabel(card){
    const label=card&&card.querySelector&&card.querySelector('.task-head b');
    return String(label&&label.textContent||'').replace(/\s+/g,' ').trim();
  }
  function missionForCard(queue,card){
    const cards=[...root.document.querySelectorAll('.local-mission')];
    const index=cards.indexOf(card);
    if(index<0||index>=queue.length)return null;
    const mission=queue[index];
    if(!mission||!MISSION_ID_RE.test(String(mission.id||'')))return null;
    const expected=String(mission.label||mission.type||'JARVIS mission').replace(/\s+/g,' ').trim();
    const rendered=renderedCardLabel(card);
    if(expected&&rendered&&expected!==rendered)return null;
    return mission;
  }
  function approvalDependency(mission){
    const step=mission&&mission.step||{},err=step&&step.error||{};
    return String(mission&&mission.status||'')==='waiting_dependency'&&String(step.status||'')==='blocked'&&String(err.dependency||step.dependency||'')==='approval';
  }
  function reqFromText(text){const m=String(text||'').match(REQ_RE);return m?m[1].toLowerCase():''}
  async function resolveFreshMission(req,card=null){
    if(!/^[a-f0-9]{20}$/.test(String(req||'')))throw new Error('Onay kartı REQ kodu geçersiz.');
    const state=await jsonFetch('/api/state');
    const queue=missionQueue(state);
    if(card){
      const mission=missionForCard(queue,card);
      if(!mission||!approvalDependency(mission)||reqFromText(mission.label)!==req)throw new Error('Onay kartı eskimiş; güncel kartı yeniden açın.');
      card.dataset.jarvisMissionId=String(mission.id);
      return mission;
    }
    const rows=queue.filter(m=>approvalDependency(m)&&reqFromText(m.label)===req);
    if(rows.length!==1)throw new Error(rows.length?'Onay kartı belirsiz; görev listesini yenileyin.':'Onay kartı eskimiş; güncel kartı yeniden açın.');
    const mission=rows[0];
    if(!MISSION_ID_RE.test(String(mission.id||'')))throw new Error('Güncel mission kimliği doğrulanamadı.');
    return mission;
  }
  async function focusMissionFromUrl(attempt=0){
    const requested=missionIdFromLocation();
    if(!requested||missionFocusDone||missionFocusRunning)return !!missionFocusDone;
    missionFocusRunning=true;
    try{
      const state=await jsonFetch('/api/state');
      const queue=missionQueue(state),index=queue.findIndex(m=>String(m&&m.id||'')===requested);
      const cards=[...root.document.querySelectorAll('.local-mission')];
      const mission=index>=0?queue[index]:null,card=index>=0?cards[index]:null;
      if(!mission||!card||missionForCard(queue,card)!==mission){
        if(attempt<24)root.setTimeout(()=>{missionFocusRunning=false;focusMissionFromUrl(attempt+1).catch(()=>{})},250);
        return false;
      }
      card.dataset.jarvisMissionId=requested;
      card.dataset.jarvisMissionFocused='1';
      card.style.outline='2px solid currentColor';
      card.style.outlineOffset='3px';
      try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){try{card.scrollIntoView()}catch(__){}}
      setStatus('MOBILE MISSION · BİLDİRİMDEN İLGİLİ GÖREV AÇILDI · '+requested.slice(-8));
      missionFocusDone=true;
      root.setTimeout(()=>{try{card.style.outline='';card.style.outlineOffset=''}catch(_){}},8000);
      return true;
    }catch(error){
      if(attempt<24)root.setTimeout(()=>{missionFocusRunning=false;focusMissionFromUrl(attempt+1).catch(()=>{})},250);
      else setStatus('MOBILE MISSION · BİLDİRİM HEDEFİ AÇILAMADI');
      return false;
    }finally{
      if(missionFocusDone||attempt>=24)missionFocusRunning=false;
    }
  }
  async function runMobileBrain(message){
    const created=await jsonFetch('/api/mobile-brain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:String(message||'').slice(0,300)})});
    const id=String(created.id||'');
    if(!/^[0-9a-f-]{8,80}$/i.test(id))throw new Error('Mobil komut kuyruğa alınamadı.');
    const deadline=Date.now()+30000;
    while(Date.now()<deadline){
      await new Promise(r=>setTimeout(r,350));
      const state=await jsonFetch('/api/mobile-brain/'+encodeURIComponent(id));
      if(state.status==='ready')return state.result||{ok:true};
      if(state.status==='failed'||state.status==='cancelled')throw new Error(state.error||('mobile_brain_'+state.status));
    }
    throw new Error('Mobil komut zaman aşımına uğradı.');
  }
  async function act(card,action){
    const req=reqFromText(card&&card.textContent||'');
    if(!req){setStatus('MOBILE MISSION · REQ KODU YOK · İŞLEM YAPILMADI');return false}
    const buttons=[...card.querySelectorAll('[data-jarvis-mission-action]')];
    buttons.forEach(b=>b.disabled=true);
    try{
      setStatus('MOBILE MISSION · GÜNCEL HEDEF DOĞRULANIYOR');
      const mission=await resolveFreshMission(req,card);
      const message=action==='approve'
        ?('onayla '+mission.id+' req '+req)
        :('iptal et '+mission.id+' req '+req);
      setStatus(action==='approve'?'MOBILE MISSION · AÇIK ONAY WORKER’A GÖNDERİLDİ':'MOBILE MISSION · İPTAL İSTEĞİ WORKER’A GÖNDERİLDİ');
      const result=await runMobileBrain(message);
      setStatus('MOBILE MISSION · '+String(result&&result.reply||result&&result.message||'WORKER YANITI ALINDI').replace(/\s+/g,' ').slice(0,130));
      if(typeof root.load==='function')await root.load().catch(()=>{});
      return true;
    }catch(error){
      setStatus('MOBILE MISSION · FAIL CLOSED · '+String(error&&error.message||error).slice(0,120));
      return false;
    }finally{buttons.forEach(b=>b.disabled=false)}
  }
  function enhance(){
    for(const card of root.document.querySelectorAll('.local-mission')){
      if(card.dataset.jarvisMissionApproval==='1')continue;
      const req=reqFromText(card.textContent||'');
      if(!req||!/\bONAY\b/i.test(String(card.textContent||'')))continue;
      const wrap=root.document.createElement('div');wrap.dataset.jarvisMissionControls='1';wrap.style.cssText='display:flex;gap:7px;flex-wrap:wrap;margin-top:8px';
      const approve=root.document.createElement('button');approve.type='button';approve.className='mini-btn';approve.textContent='ONAYLA';approve.dataset.jarvisMissionAction='approve';approve.addEventListener('click',()=>act(card,'approve'));
      const cancel=root.document.createElement('button');cancel.type='button';cancel.className='mini-btn';cancel.textContent='İPTAL';cancel.dataset.jarvisMissionAction='cancel';cancel.addEventListener('click',()=>act(card,'cancel'));
      wrap.append(approve,cancel);card.appendChild(wrap);card.dataset.jarvisMissionApproval='1';
    }
  }
  function install(){
    const target=root.document.getElementById('tasks');if(!target)return false;
    enhance();focusMissionFromUrl().catch(()=>{});
    const observer=new MutationObserver(()=>{enhance();focusMissionFromUrl().catch(()=>{})});observer.observe(target,{childList:true,subtree:true});
    return true;
  }
  const start=()=>{if(!install())setTimeout(start,250)};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else setTimeout(start,0);
})(typeof globalThis==='object'?globalThis:this);
