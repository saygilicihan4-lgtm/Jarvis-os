(function(root){
  'use strict';
  if(!root||!root.document)return;
  const doc=root.document;
  const VERSION='1.0';
  const PANEL_ID='jarvisMobileApprovalReview';
  const STYLE_ID='jarvisMobileApprovalReviewStyle';
  const POLL_MS=2500;
  const REQ_RE=/\bREQ\s+([a-f0-9]{20})\b/i;
  const MISSION_RE=/^M-[A-Z0-9-]{12,80}$/;

  function clean(value,max=160){return String(value==null?'':value).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
  function missionId(value){const id=clean(value,90).toUpperCase();return MISSION_RE.test(id)?id:''}
  function reqFrom(value){const m=clean(value,220).match(REQ_RE);return m?m[1].toLowerCase():''}
  function approvalMission(m){return !!(m&&missionId(m.id)&&String(m.status)==='waiting_dependency'&&m.step&&String(m.step.status)==='blocked'&&String(m.step.dependency||m.step.error&&m.step.error.dependency||'')==='approval'&&reqFrom(m.label))}
  function queueFrom(state){const q=state&&state.workers&&state.workers.pc&&state.workers.pc.missions&&state.workers.pc.missions.queue;return Array.isArray(q)?q:[]}
  function safeDevice(state){const pc=state&&state.workers&&state.workers.pc||{};return{label:clean(pc.name||'PC Worker',64),online:pc.online===true}}
  function parseLabel(label){
    const text=clean(label,220),req=reqFrom(text),ttl=(text.match(/\b(\d{1,2})\s*DK\b/i)||[])[1]||'15';
    const body=text.replace(/^ONAY\s*·\s*/i,'').replace(/\s*·\s*\d{1,2}\s*DK\s*·\s*REQ\s+[a-f0-9]{20}\s*$/i,'').trim();
    const out={surface:'İŞLEM',operation:body||'Açık onay bekleyen işlem',target:'-',account:'-',fields:'-',data:'-',ttl,req};
    if(/^WEB\s+/i.test(body)){
      out.surface='WEB';
      const m=body.match(/^WEB\s+(.+?)\s+@\s+([^·]+)(?:\s*·\s*ALAN\s+(.+))?$/i);
      if(m){out.operation=clean(m[1],44)||'SON TIKLAMA';out.target=clean(m[2],90)||'-';out.fields=clean(m[3]||'Listelenen form alanları',100);out.data=out.fields==='-'?'Hazırlanmış form verisi':'Alanlar: '+out.fields+' · değerler güvenlik nedeniyle bu kartta maskeli';}
    }else if(/^SHOPIFY PUBLIC/i.test(body)){
      out.surface='SHOPIFY';out.operation='ÜRÜNÜ PUBLIC YAYINLA';
      const store=(body.match(/\bSTORE\s+([a-f0-9]{1,16})\b/i)||[])[1];const id=(body.match(/(…[^·\s]{1,24})/)||[])[1];
      let title=body.replace(/^SHOPIFY PUBLIC\s*·\s*/i,'').replace(/\s*·\s*…[^·\s]{1,24}/,'').replace(/\s*·\s*STORE\s+[a-f0-9]{1,16}/i,'').trim();
      out.target=clean(title||'Ürün taslağı',90);out.account=store?'STORE '+store:'Bağlı Shopify mağazası';out.fields='Görünürlük durumu';out.data=(id?('Ürün '+id+' · '):'')+'DRAFT → PUBLIC';
    }else if(/^YOUTUBE PUBLIC/i.test(body)){
      out.surface='YOUTUBE';out.operation='VİDEOYU PUBLIC YAYINLA';
      const channel=(body.match(/\bCHANNEL\s+([a-f0-9]{1,16})\b/i)||[])[1];
      const title=body.replace(/^YOUTUBE PUBLIC\s*·\s*/i,'').replace(/\s*·\s*CHANNEL\s+[a-f0-9]{1,16}/i,'').trim();
      out.target=clean(title||'Video taslağı',90);out.account=channel?'CHANNEL '+channel:'Bağlı YouTube kanalı';out.fields='Görünürlük durumu';out.data='DRAFT → PUBLIC';
    }
    return out;
  }
  function installStyle(){
    if(doc.getElementById(STYLE_ID))return;const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
      #${PANEL_ID}{display:none;position:relative;z-index:8;margin:10px 0}
      body[data-reference-cockpit-mobile="1"] #${PANEL_ID}[data-count]:not([data-count="0"]){display:block}
      .mar-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.mar-head strong{font-size:12px;letter-spacing:.08em;color:#ffd88c}.mar-head span{font-size:9px;color:#ffca66}
      .mar-card{border:1px solid rgba(255,160,48,.58);background:linear-gradient(180deg,rgba(25,13,3,.94),rgba(3,9,15,.97));box-shadow:0 0 22px rgba(255,154,47,.12),inset 0 0 25px rgba(255,154,47,.035);padding:11px;margin-bottom:8px;clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px)}
      .mar-card:last-child{margin-bottom:0}.mar-title{font-size:12px;font-weight:800;color:#fff0d0;margin-bottom:8px;overflow-wrap:anywhere}.mar-grid{display:grid;grid-template-columns:84px 1fr;gap:5px 8px;font-size:9.5px;line-height:1.35}.mar-grid dt{color:#9ab7c7}.mar-grid dd{margin:0;color:#edfaff;overflow-wrap:anywhere}.mar-bind{margin-top:8px;padding:7px;border:1px solid rgba(101,230,255,.2);font:8.5px/1.45 ui-monospace,monospace;color:#bfeeff;background:rgba(1,8,14,.68)}
      .mar-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.mar-actions button{min-height:38px;border-radius:8px;font-weight:800;letter-spacing:.02em;cursor:pointer}.mar-approve{border:1px solid rgba(36,255,141,.55);background:rgba(15,94,57,.28);color:#caffdf}.mar-reject{border:1px solid rgba(255,95,109,.55);background:rgba(110,17,27,.27);color:#ffd7dc}.mar-actions button:disabled{opacity:.45;cursor:not-allowed}.mar-status{font-size:8.5px;margin-top:7px;color:#ffcb73;min-height:12px}
      @media(prefers-reduced-motion:reduce){#${PANEL_ID} *{animation:none!important;transition:none!important}}
    `;(doc.head||doc.documentElement).appendChild(s);
  }
  function setStatus(card,text){const n=card&&card.querySelector('.mar-status');if(n)n.textContent=clean(text,180)}
  function legacyCard(id){return [...doc.querySelectorAll('.local-mission[data-jarvis-mission-id]')].find(n=>missionId(n.dataset.jarvisMissionId)===id)||null}
  function liveLabel(card){const n=card&&card.querySelector('.task-head b');return clean(n&&n.textContent||'',220)}
  function verifyProxy(mission,action){
    const id=missionId(mission&&mission.id),req=reqFrom(mission&&mission.label);if(!id||!req)return{ok:false,code:'approval_target_invalid'};
    const card=legacyCard(id);if(!card)return{ok:false,code:'approval_legacy_card_missing'};
    const label=liveLabel(card);if(label!==clean(mission.label,220)||reqFrom(label)!==req)return{ok:false,code:'approval_target_changed'};
    const rows=[...card.querySelectorAll('[data-jarvis-mission-action]')].filter(b=>String(b.dataset.jarvisMissionAction)===action);
    if(rows.length!==1||rows[0].disabled)return{ok:false,code:'approval_action_unavailable'};
    return{ok:true,button:rows[0],id,req};
  }
  function runProxy(card,mission,action){
    const checked=verifyProxy(mission,action);if(!checked.ok){setStatus(card,'FAIL CLOSED · '+checked.code);return false}
    const buttons=[...card.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);setStatus(card,'GÜNCEL MISSION + REQ HEDEFİ DOĞRULANDI · İŞLEM ESKİ GÜVENLİ KÖPRÜYE DEVREDİLDİ');
    try{checked.button.click();return true}catch(_){buttons.forEach(b=>b.disabled=false);setStatus(card,'FAIL CLOSED · approval_proxy_failed');return false}
  }
  function row(dt,dd){const a=doc.createElement('dt'),b=doc.createElement('dd');a.textContent=dt;b.textContent=dd;return[a,b]}
  function renderCard(mission,device){
    const review=parseLabel(mission.label),card=doc.createElement('article');card.className='mar-card';card.dataset.missionId=missionId(mission.id);card.dataset.req=review.req;
    const title=doc.createElement('div');title.className='mar-title';title.textContent=review.surface+' · '+review.operation;card.appendChild(title);
    const grid=doc.createElement('dl');grid.className='mar-grid';
    for(const pair of [row('Hedef',review.target),row('Hesap',review.account),row('Değişiklik',review.fields),row('Gönderilecek',review.data),row('Süre','En fazla '+review.ttl+' dk · onay anında tekrar doğrulanır'),row('Cihaz',device.label+' · '+(device.online?'ÇEVRİMİÇİ':'ÇEVRİMDIŞI'))])grid.append(...pair);card.appendChild(grid);
    const bind=doc.createElement('div');bind.className='mar-bind';bind.textContent='BIND · MISSION '+missionId(mission.id).slice(-12)+' · REQ '+review.req+' · SAME-ORIGIN SESSION · LEGACY APPROVAL PROXY';card.appendChild(bind);
    const actions=doc.createElement('div');actions.className='mar-actions';const approve=doc.createElement('button'),reject=doc.createElement('button');approve.type=reject.type='button';approve.className='mar-approve';reject.className='mar-reject';approve.textContent='ONAYLA';reject.textContent='REDDET / GÖREVİ İPTAL ET';approve.onclick=()=>runProxy(card,mission,'approve');reject.onclick=()=>runProxy(card,mission,'cancel');actions.append(approve,reject);card.appendChild(actions);
    const status=doc.createElement('div');status.className='mar-status';status.setAttribute('role','status');status.textContent='Onay yalnız bu mission + REQ için geçerlidir.';card.appendChild(status);return card;
  }
  function panel(){
    let p=doc.getElementById(PANEL_ID);if(p)return p;const mobile=doc.getElementById('jarvisMobileCanonical'),shell=mobile&&mobile.querySelector('.m-shell');if(!shell)return null;installStyle();p=doc.createElement('section');p.id=PANEL_ID;p.dataset.count='0';p.setAttribute('aria-label','Açık onay inceleme kartları');const head=doc.createElement('div');head.className='mar-head';head.innerHTML='<strong>AÇIK ONAY İNCELEMESİ</strong><span>FAIL-CLOSED</span>';p.appendChild(head);const list=doc.createElement('div');list.className='mar-list';p.appendChild(list);const main=shell.querySelector('.m-main');if(main)main.insertAdjacentElement('afterend',p);else shell.appendChild(p);return p;
  }
  async function state(){const r=await root.fetch('/api/state',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('approval_state_'+r.status);return r.json()}
  let busy=false,lastSignature='';
  async function refresh(){
    if(busy||doc.hidden)return false;const p=panel();if(!p)return false;busy=true;
    try{
      const s=await state(),rows=queueFrom(s).filter(approvalMission).slice(0,4),device=safeDevice(s);const signature=rows.map(m=>missionId(m.id)+'|'+clean(m.label,220)+'|'+clean(m.updatedAt,40)+'|'+device.online).join('||');
      if(signature!==lastSignature){const list=p.querySelector('.mar-list');list.replaceChildren(...rows.map(m=>renderCard(m,device)));p.dataset.count=String(rows.length);lastSignature=signature}
      return true;
    }catch(e){p.dataset.count='0';lastSignature='';return false}finally{busy=false}
  }
  function install(attempt=0){const p=panel();if(!p){if(attempt<100)setTimeout(()=>install(attempt+1),80);return false}refresh();setInterval(refresh,POLL_MS);doc.addEventListener('jarvis:conversation-state',refresh);doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refresh()});return true}
  root.JarvisMobileApprovalReview=Object.freeze({VERSION,POLL_MS,REQ_RE,MISSION_RE,clean,missionId,reqFrom,approvalMission,queueFrom,safeDevice,parseLabel,verifyProxy,install});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>install(0),{once:true});else install(0);
})(typeof window!=='undefined'?window:null);
