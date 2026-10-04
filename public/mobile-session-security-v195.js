(function(host){
  'use strict';
  if(!host||!host.document)return;
  const doc=host.document;
  const STAGE_ID='jarvisNativeMobileV190';
  const ROOT_ID='jarvisMobileSessionSecurityV195';
  const STYLE_ID='jarvisMobileSessionSecurityV195Style';
  const VERSION='1.0';
  const MEDIA='(max-width: 860px) and (orientation: portrait)';
  let status=null;
  let sessions=[];
  let installed=false;
  let busy=false;

  const TR={
    title:'GÜVENLİK & OTURUMLAR',close:'Kapat',refresh:'Yenile',current:'BU TELEFON',active:'AKTİF',revoked:'İPTAL',expired:'SÜRESİ DOLDU',
    managed:'Yönetilen v3 oturumu',legacy:'Eski v2 oturumu',durable:'Kalıcı koruma',volatile:'Kalıcı depolama kullanılamıyor',
    revoke:'İptal et',revokeOthers:'Diğer oturumları iptal et',disableLegacy:'Eski v2 oturumlarını kapat',general:'Diğer ayarlar',
    confirmRevoke:'Bu oturumu iptal etmek istiyor musunuz?',confirmCurrent:'Bu telefonun mevcut oturumu iptal edilecek ve yeniden giriş gerekecek. Devam edilsin mi?',
    confirmOthers:'Bu telefon dışındaki tüm aktif yönetilen oturumlar iptal edilecek. Devam edilsin mi?',confirmLegacy:'Eski v2 tarayıcı oturumları kalıcı olarak devre dışı bırakılacak. Geri açılamaz. Devam edilsin mi?',
    migration:'Bu tarayıcı eski v2 oturumu kullanıyor. Önce tek kullanımlık kod veya passkey ile yönetilen v3 oturum açın; sonra eski oturumları buradan kalıcı olarak kapatabilirsiniz.',
    legacyOn:'Eski v2 oturumları hâlâ kabul ediliyor',legacyOff:'Eski v2 oturumları devre dışı',ipChanged:'Ağ/IP değişmiş; oturum kimliği yine sunucu tarafından doğrulandı.',
    empty:'Yönetilen oturum bulunamadı.',unauthorized:'Oturum doğrulanamadı. Yeniden giriş yapın.',loading:'Oturumlar yükleniyor…',error:'Güvenlik bilgisi alınamadı',
    issued:'Oluşturuldu',seen:'Son kullanım',expires:'Bitiş',source:'Kaynak',id:'Oturum',done:'İşlem tamamlandı'
  };
  const EN={
    title:'SECURITY & SESSIONS',close:'Close',refresh:'Refresh',current:'THIS PHONE',active:'ACTIVE',revoked:'REVOKED',expired:'EXPIRED',
    managed:'Managed v3 session',legacy:'Legacy v2 session',durable:'Durable protection',volatile:'Durable storage unavailable',
    revoke:'Revoke',revokeOthers:'Revoke other sessions',disableLegacy:'Disable legacy v2 sessions',general:'Other settings',
    confirmRevoke:'Revoke this session?',confirmCurrent:'This phone session will be revoked and sign-in will be required again. Continue?',
    confirmOthers:'All other active managed sessions will be revoked. Continue?',confirmLegacy:'Legacy v2 browser sessions will be permanently disabled and cannot be re-enabled. Continue?',
    migration:'This browser is using a legacy v2 session. First recover with a one-time code or passkey to obtain a managed v3 session; then permanently disable legacy sessions here.',
    legacyOn:'Legacy v2 sessions are still accepted',legacyOff:'Legacy v2 sessions are disabled',ipChanged:'Network/IP changed; server-side session identity is still verified.',
    empty:'No managed sessions found.',unauthorized:'Session could not be verified. Sign in again.',loading:'Loading sessions…',error:'Security status unavailable',
    issued:'Issued',seen:'Last seen',expires:'Expires',source:'Source',id:'Session',done:'Action completed'
  };

  function mobile(){try{return !!host.matchMedia(MEDIA).matches}catch(_){return false}}
  function tr(){return /^tr(?:-|$)/i.test(String(doc.documentElement.lang||'tr-TR'))}
  function t(){return tr()?TR:EN}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
  function fmt(v){
    if(!v)return '—';
    const d=new Date(v);if(!Number.isFinite(d.getTime()))return '—';
    try{return new Intl.DateTimeFormat(tr()?'tr-TR':'en-US',{dateStyle:'short',timeStyle:'short'}).format(d)}catch(_){return d.toISOString().slice(0,16).replace('T',' ')}
  }
  function shortId(v){const s=String(v||'');return s?s.slice(0,8)+'…'+s.slice(-6):'—'}
  function sourceLabel(v){return String(v||'unknown').replace(/[-_]+/g,' ').slice(0,38)}
  async function request(url,options={}){
    const r=await host.fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(j.error||('HTTP '+r.status));e.status=r.status;throw e}
    return j;
  }
  function style(){
    if(doc.getElementById(STYLE_ID))return;
    const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media (max-width:860px) and (orientation:portrait){
        #${ROOT_ID}{position:absolute;inset:0;z-index:480;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#edfaff;-webkit-tap-highlight-color:transparent}
        #${ROOT_ID}[data-open="1"]{display:block}
        #${ROOT_ID} .jsv-backdrop{position:absolute;inset:0;background:rgba(0,3,7,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        #${ROOT_ID} .jsv-sheet{position:absolute;left:2.4%;right:2.4%;bottom:max(env(safe-area-inset-bottom),8px);max-height:82%;overflow:hidden;border:1px solid rgba(74,220,255,.72);border-radius:18px 18px 12px 12px;background:linear-gradient(180deg,rgba(6,22,33,.985),rgba(2,8,14,.99));box-shadow:0 0 34px rgba(38,198,255,.16),inset 0 0 26px rgba(53,211,255,.05)}
        #${ROOT_ID} .jsv-head{height:48px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid rgba(94,222,255,.18)}
        #${ROOT_ID} .jsv-head strong{font-size:12px;letter-spacing:.09em;color:#eafaff;flex:1}
        #${ROOT_ID} .jsv-shield{width:25px;height:25px;border:1px solid #50dcff;border-radius:8px;display:grid;place-items:center;color:#6ee9ff;box-shadow:0 0 10px rgba(70,219,255,.24)}
        #${ROOT_ID} button{font:inherit}
        #${ROOT_ID} .jsv-iconbtn{border:1px solid rgba(102,225,255,.35);background:rgba(9,31,43,.8);color:#eafaff;border-radius:9px;padding:7px 9px;font-size:10px}
        #${ROOT_ID} .jsv-body{padding:11px 12px 14px;overflow:auto;max-height:calc(82vh - 49px);overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
        #${ROOT_ID} .jsv-banner{border:1px solid rgba(82,215,255,.24);background:rgba(21,80,103,.13);border-radius:10px;padding:9px 10px;margin-bottom:9px;font-size:10px;line-height:1.45}
        #${ROOT_ID} .jsv-banner.warn{border-color:rgba(255,179,67,.48);background:rgba(138,80,16,.15);color:#ffe0a2}
        #${ROOT_ID} .jsv-banner.good{border-color:rgba(71,255,176,.35);background:rgba(29,116,79,.14);color:#baffdf}
        #${ROOT_ID} .jsv-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}
        #${ROOT_ID} .jsv-stat{border:1px solid rgba(82,215,255,.18);border-radius:9px;padding:8px;background:rgba(5,19,29,.7)}
        #${ROOT_ID} .jsv-stat small{display:block;color:#88adbd;font-size:7px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
        #${ROOT_ID} .jsv-stat b{font-size:9px;font-weight:650}
        #${ROOT_ID} .jsv-list{display:grid;gap:7px;margin:8px 0 10px}
        #${ROOT_ID} .jsv-session{border:1px solid rgba(86,217,255,.19);border-radius:10px;background:rgba(4,15,24,.86);padding:9px}
        #${ROOT_ID} .jsv-session.current{border-color:rgba(70,255,179,.45);box-shadow:inset 0 0 16px rgba(34,177,120,.05)}
        #${ROOT_ID} .jsv-row{display:flex;align-items:center;gap:7px}.jsv-row+.jsv-row{margin-top:5px}
        #${ROOT_ID} .jsv-name{font-size:10px;font-weight:700;flex:1}.jsv-meta{font-size:8px;color:#91adba;line-height:1.45;word-break:break-word}
        #${ROOT_ID} .jsv-pill{font-size:6px;font-weight:800;letter-spacing:.08em;border:1px solid rgba(74,220,255,.35);border-radius:999px;padding:3px 6px;color:#8ceeff}
        #${ROOT_ID} .jsv-pill.current{border-color:rgba(63,255,174,.5);color:#7dffbd}
        #${ROOT_ID} .jsv-pill.revoked,#${ROOT_ID} .jsv-pill.expired{border-color:rgba(255,115,115,.4);color:#ffaaaa}
        #${ROOT_ID} .jsv-revoke{margin-left:auto;border:1px solid rgba(255,116,116,.42);background:rgba(112,31,31,.18);color:#ffc0c0;border-radius:8px;padding:6px 8px;font-size:8px}
        #${ROOT_ID} .jsv-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
        #${ROOT_ID} .jsv-action{min-height:36px;border:1px solid rgba(72,218,255,.38);border-radius:9px;background:linear-gradient(180deg,rgba(14,48,64,.8),rgba(4,20,31,.9));color:#ebfbff;font-size:9px;padding:7px}
        #${ROOT_ID} .jsv-action.danger{border-color:rgba(255,153,65,.42);color:#ffd59c;background:rgba(89,47,15,.2)}
        #${ROOT_ID} .jsv-action:disabled,#${ROOT_ID} .jsv-revoke:disabled{opacity:.38}
        #${ROOT_ID} .jsv-note{font-size:7px;line-height:1.4;color:#7895a2;margin-top:8px}
      }
    `;(doc.head||doc.documentElement).appendChild(s);
  }
  function shell(stage){
    let root=doc.getElementById(ROOT_ID);if(root)return root;
    root=doc.createElement('div');root.id=ROOT_ID;root.dataset.version=VERSION;root.dataset.open='0';
    root.innerHTML='<div class="jsv-backdrop" data-jsv="close"></div><section class="jsv-sheet" role="dialog" aria-modal="true" aria-label="Session security"><div class="jsv-head"><span class="jsv-shield">⌾</span><strong data-jsv-title></strong><button class="jsv-iconbtn" data-jsv="refresh">↻</button><button class="jsv-iconbtn" data-jsv="close">×</button></div><div class="jsv-body" data-jsv-body></div></section>';
    stage.appendChild(root);return root;
  }
  function render(message=''){
    const root=doc.getElementById(ROOT_ID);if(!root)return;
    const d=t();root.querySelector('[data-jsv-title]').textContent=d.title;
    const body=root.querySelector('[data-jsv-body]');
    if(message){body.innerHTML='<div class="jsv-banner warn">'+esc(message)+'</div>';return}
    if(!status){body.innerHTML='<div class="jsv-banner">'+esc(d.loading)+'</div>';return}
    const current=status.current||{};
    const migration=!!status.migrationRequired;
    const banner=migration?'<div class="jsv-banner warn">'+esc(d.migration)+'</div>':
      '<div class="jsv-banner '+(status.durable?'good':'warn')+'">'+esc(status.durable?d.durable:d.volatile)+'</div>';
    const legacy='<div class="jsv-banner '+(status.legacySessionsAccepted?'warn':'good')+'">'+esc(status.legacySessionsAccepted?d.legacyOn:d.legacyOff)+'</div>';
    const ip=current.ipChanged?'<div class="jsv-banner warn">'+esc(d.ipChanged)+'</div>':'';
    const stats='<div class="jsv-grid"><div class="jsv-stat"><small>'+esc(d.source)+'</small><b>'+esc(sourceLabel(current.source||'—'))+'</b></div><div class="jsv-stat"><small>'+esc(d.expires)+'</small><b>'+esc(fmt(current.expiresAt))+'</b></div></div>';
    let list='';
    if(current.managed){
      list=(sessions||[]).map(s=>{
        const st=String(s.status||'active');const pill=s.current?d.current:st==='revoked'?d.revoked:st==='expired'?d.expired:d.active;
        const canRevoke=st==='active';
        return '<article class="jsv-session '+(s.current?'current':'')+'" data-session="'+esc(s.id)+'"><div class="jsv-row"><div class="jsv-name">'+esc(sourceLabel(s.source))+'</div><span class="jsv-pill '+(s.current?'current':st)+'">'+esc(pill)+'</span>'+(canRevoke?'<button class="jsv-revoke" data-jsv="revoke" data-id="'+esc(s.id)+'" data-current="'+(s.current?'1':'0')+'">'+esc(d.revoke)+'</button>':'')+'</div><div class="jsv-meta">'+esc(d.id)+': '+esc(shortId(s.id))+'<br>'+esc(d.issued)+': '+esc(fmt(s.issuedAt))+' · '+esc(d.seen)+': '+esc(fmt(s.lastSeenAt))+'<br>'+esc(d.expires)+': '+esc(fmt(s.expiresAt))+'</div></article>';
      }).join('')||'<div class="jsv-banner">'+esc(d.empty)+'</div>';
    }else list='<div class="jsv-banner warn">'+esc(d.legacy)+'</div>';
    const actions='<div class="jsv-actions"><button class="jsv-action" data-jsv="refresh">'+esc(d.refresh)+'</button><button class="jsv-action" data-jsv="revoke-others" '+(!current.managed||!status.durable?'disabled':'')+'>'+esc(d.revokeOthers)+'</button><button class="jsv-action danger" data-jsv="legacy-disable" '+(!current.managed||!status.durable||!status.legacySessionsAccepted?'disabled':'')+'>'+esc(d.disableLegacy)+'</button><button class="jsv-action" data-jsv="general">'+esc(d.general)+'</button></div>';
    body.innerHTML=banner+legacy+ip+stats+'<div class="jsv-list">'+list+'</div>'+actions+'<div class="jsv-note">v195 · Session IDs are shown only as shortened hashes. Cookies, passkey material and raw session secrets are never displayed or stored by this panel.</div>';
  }
  async function refresh(){
    if(busy)return;busy=true;render();
    try{
      status=await request('/api/sessions/status');
      sessions=[];
      if(status.current&&status.current.managed){const r=await request('/api/sessions');sessions=Array.isArray(r.sessions)?r.sessions:[]}
      render();
      const stage=doc.getElementById(STAGE_ID);if(stage)stage.dataset.sessionSecurity='ready';
    }catch(e){
      status=null;sessions=[];render(e&&e.status===401?t().unauthorized:(e.message||t().error));
    }finally{busy=false}
  }
  function open(){const root=doc.getElementById(ROOT_ID);if(!root)return;root.dataset.open='1';refresh()}
  function close(){const root=doc.getElementById(ROOT_ID);if(root)root.dataset.open='0'}
  async function mutate(action,id,isCurrent){
    if(busy)return;const d=t();
    if(action==='revoke'){
      if(!host.confirm(isCurrent?d.confirmCurrent:d.confirmRevoke))return;
      busy=true;try{await request('/api/sessions/'+id+'/revoke',{method:'POST',body:JSON.stringify({confirmCurrent:!!isCurrent})});if(isCurrent){close();host.location.reload();return}await refresh()}catch(e){render(e.message||d.error)}finally{busy=false}return;
    }
    if(action==='revoke-others'){
      if(!host.confirm(d.confirmOthers))return;busy=true;try{await request('/api/sessions/revoke-others',{method:'POST',body:'{}'});busy=false;await refresh()}catch(e){busy=false;render(e.message||d.error)}return;
    }
    if(action==='legacy-disable'){
      if(!host.confirm(d.confirmLegacy))return;busy=true;try{await request('/api/sessions/legacy/disable',{method:'POST',body:JSON.stringify({confirm:'DISABLE_LEGACY_SESSIONS'})});busy=false;await refresh()}catch(e){busy=false;render(e.message||d.error)}
    }
  }
  function legacySettings(){
    close();
    const b=doc.querySelector('#jarvisMobileCanonical .jm-hot[data-a="settings"]');if(b)b.click();
  }
  function bind(stage){
    stage.addEventListener('click',e=>{
      const settings=e.target.closest&&e.target.closest('.jn-btn[data-a="settings"]');
      if(settings&&stage.contains(settings)){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();try{settings.blur()}catch(_){}open();return;
      }
      const ctl=e.target.closest&&e.target.closest('[data-jsv]');if(!ctl||!stage.contains(ctl))return;
      const a=ctl.dataset.jsv;
      if(a==='close')return close();
      if(a==='refresh')return void refresh();
      if(a==='general')return legacySettings();
      if(a==='revoke')return void mutate('revoke',String(ctl.dataset.id||''),ctl.dataset.current==='1');
      if(a==='revoke-others'||a==='legacy-disable')return void mutate(a);
    },true);
  }
  function install(attempt=0){
    if(installed||!mobile())return false;
    const stage=doc.getElementById(STAGE_ID);
    if(!stage){if(attempt<220)host.setTimeout(()=>install(attempt+1),40);return false}
    style();shell(stage);bind(stage);installed=true;stage.dataset.sessionSecurityVersion=VERSION;
    // Probe without exposing the panel. A 401 simply means the owner has not authenticated yet.
    request('/api/sessions/status').then(s=>{status=s;stage.dataset.sessionSecurity='ready'}).catch(()=>{stage.dataset.sessionSecurity='locked'});
    return true;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>install(0),{once:true});else install(0);
})(typeof window!=='undefined'?window:null);
