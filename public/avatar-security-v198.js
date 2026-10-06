/* Local-only 2D avatar presentation. No network, voice cloning or task authority. */
(function(w){
  'use strict';
  const d=w.document,cores=['nova','jarvis','orion'],prefix='jarvis.avatar.v198.',limit=2*1024*1024;
  let dialog,selected='jarvis',pending=null,previous=null,revision=0;
  const words={
    tr:{title:'Avatar stüdyosu',cyber:'Güvenlik kontrolü',close:'Kapat',name:'Görünen ad',file:'Fotoğraf seç (PNG/JPEG/WebP, en fazla 2 MB)',rights:'Görüntüyü bu amaçla kullanma hakkım var. Ünlü kullanımı için gerekli izinleri kontrol ettim.',save:'Bu çekirdeğe kaydet',reset:'Bu çekirdeğin avatarını kaldır',project:'Yansıtma önizlemesi',back:'Geri',mirror:'Aynala',note:'Yerel 2D avatar; 3D hologram, dudak senkronizasyonu veya ses klonu değildir. Görsel sunucuya gönderilmez, yalnız bu tarayıcıda saklanır. Ünlü adı/görseli eklemek kullanım izni sağlamaz.',disclaimer:'AI avatarı · Gerçek kişi değil',saved:'Kaydedildi',removed:'Avatar kaldırıldı',error:'İşlem tamamlanamadı. Dosya türünü, boyutunu, kullanım iznini ve tarayıcı depolamasını kontrol edin.',missing:'Önce bir avatar kaydedin.',scope:'Bu panel yalnız yerel tarayıcı yeteneklerini gösterir; sızma testi veya güvenlik sertifikası değildir.',secure:'Güvenli tarayıcı bağlamı',passkey:'Passkey API desteği (kayıtlı olduğu anlamına gelmez)',session:'Oturum durum sorgusu (aktif oturum doğrulaması değildir)',ready:'Yanıt alındı',unknown:'Doğrulanmadı',yes:'Var',no:'Yok',repo:'Repo içindeki izinli, izole güvenlik testleri:',dark:'Dark web bağlantısı ve dış hedef taraması bu sürümde yok. Dış testler için hedef, izin ve kapsam ayrıca tanımlanmalıdır.',motion:'Durum tepkisi yalnız görsel efekt; yüz/ağız animasyonu değildir.'},
    en:{title:'Avatar studio',cyber:'Security checks',close:'Close',name:'Display name',file:'Choose photo (PNG/JPEG/WebP, up to 2 MB)',rights:'I have the rights to use this image for this purpose, including any necessary celebrity permissions.',save:'Save to this core',reset:'Remove this core avatar',project:'Projection preview',back:'Back',mirror:'Mirror',note:'Local 2D avatar, not a 3D hologram, lip-sync or voice clone. Images stay in this browser and are not uploaded. Adding a celebrity name/image does not grant permission.',disclaimer:'AI avatar · Not the real person',saved:'Saved',removed:'Avatar removed',error:'Could not complete the operation. Check image type/size, usage permission and browser storage.',missing:'Save an avatar first.',scope:'Local browser capabilities only; not a penetration test or security certification.',secure:'Secure browser context',passkey:'Passkey API supported (does not imply enrollment)',session:'Session-status query (not active session verification)',ready:'Response received',unknown:'Unverified',yes:'Available',no:'Unavailable',repo:'Authorized isolated security tests in the repository:',dark:'No dark-web connection or external-target scanner in this release. External tests require a defined target, permission and scope.',motion:'State response is a visual effect only, not face/mouth animation.'}
  };
  const t=k=>(words[(d.documentElement.lang||'').startsWith('tr')?'tr':'en'][k]||k);
  const node=(tag,text,cls)=>{const n=d.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
  function valid(v){return !!v&&typeof v.name==='string'&&v.name.length<=60&&typeof v.data==='string'&&v.data.length<limit*1.4&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v.data)}
  function read(core){try{const v=JSON.parse(localStorage.getItem(prefix+core));return valid(v)?v:null}catch(_){return null}}
  function apply(core){const sphere=d.querySelector('.jr-core.'+core+' .jr-sphere');if(!sphere)return;const v=read(core);sphere.querySelector('.ja-face')?.remove();sphere.removeAttribute('data-avatar');sphere.setAttribute('aria-hidden','true');sphere.removeAttribute('aria-label');if(!v)return;
    const image=node('img',null,'ja-face');image.src=v.data;image.alt=v.name+' · '+t('disclaimer');sphere.append(image);sphere.dataset.avatar='1';sphere.removeAttribute('aria-hidden');sphere.setAttribute('aria-label',image.alt);
  }
  function button(key,fn){const b=node('button',t(key));b.type='button';b.dataset.ja=key;b.onclick=fn;return b}
  function message(key){dialog.querySelector('[role=status]').textContent=t(key)}
  function close(){revision++;pending=null;dialog.close();previous?.focus({preventScroll:true})}
  function prepare(title){revision++;pending=null;dialog.className='ja-dialog';dialog.replaceChildren();const head=node('header');head.append(node('h2',title),button('close',close));dialog.append(head);dialog.dir=d.documentElement.dir||'ltr';dialog.setAttribute('aria-label',title)}
  async function selectFile(file){const token=++revision;pending=null;try{
    if(!file||file.size>limit||file.size<12)throw Error('size');
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const png=[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    const type=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;if(!type)throw Error('type');
    const blob=new Blob([file],{type}),url=URL.createObjectURL(blob),img=new Image();try{img.src=url;await img.decode();if(img.naturalWidth>8192||img.naturalHeight>8192)throw Error('dimensions')}finally{URL.revokeObjectURL(url)}
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
    if(token!==revision||!dialog.open)return;pending=data;const preview=dialog.querySelector('.ja-preview');preview.src=data;preview.hidden=false;
  }catch(_){if(token===revision&&dialog.open)message('error')}}
  function studio(){prepare(t('title'));const pick=node('select');pick.dataset.ja='core';pick.setAttribute('aria-label','NOVA / JARVIS / ORION');for(const c of cores){const o=node('option',c.toUpperCase());o.value=c;pick.append(o)}pick.value=selected;pick.onchange=()=>{selected=pick.value;studio()};dialog.append(pick,node('p',t('note')));
    const existing=read(selected),nameLabel=node('label',t('name')),name=node('input');name.type='text';name.maxLength=60;name.dataset.ja='name';name.value=existing?.name||'';nameLabel.append(name);
    const fileLabel=node('label',t('file')),file=node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.dataset.ja='file';file.onchange=()=>{rights.checked=false;void selectFile(file.files[0])};fileLabel.append(file);
    const preview=node('img',null,'ja-preview');preview.alt=t('disclaimer');preview.hidden=!existing;if(existing)preview.src=existing.data;
    const rightsLabel=node('label',null,'ja-rights'),rights=node('input');rights.type='checkbox';rights.dataset.ja='rights';rightsLabel.append(rights,d.createTextNode(t('rights')));
    dialog.append(nameLabel,fileLabel,preview,rightsLabel);
    const actions=node('div',null,'ja-actions');actions.append(button('save',()=>{try{if(!rights.checked||(file.files.length&&!pending))throw Error('rights_or_pending_file');const v={name:name.value.trim()||selected.toUpperCase(),data:pending||existing?.data};if(!valid(v))throw Error('data');localStorage.setItem(prefix+selected,JSON.stringify(v));apply(selected);message('saved')}catch(_){message('error')}}),button('reset',()=>{try{localStorage.removeItem(prefix+selected);apply(selected);studio();message('removed')}catch(_){message('error')}}),button('project',project));dialog.append(actions,node('p',t('motion')));const status=node('p');status.setAttribute('role','status');dialog.append(status);
  }
  function project(){if(w.JarvisAvatar3D?.isEnabled(selected)){project3d();return}const v=read(selected);if(!v){message('missing');return}prepare(t('project'));dialog.classList.add('ja-projection');const image=node('img',null,'ja-projected-image');image.src=v.data;image.alt=v.name;const cap=node('p',v.name+' · '+t('disclaimer'));const controls=node('div',null,'ja-actions');controls.append(button('back',studio),button('mirror',()=>image.classList.toggle('ja-mirror')));dialog.append(image,cap,controls)}
  function project3d(){prepare(t('project'));dialog.classList.add('ja-projection');const host=node('div',null,'ja-robot-host'),cap=node('p'),controls=node('div',null,'ja-robot-controls');dialog.append(host,cap,controls);const canvas=w.JarvisAvatar3D.mount(host,selected,cap);controls.append(button('back',studio),button('mirror',()=>canvas.classList.toggle('ja-mirror')));const label=node('label',(d.documentElement.lang.startsWith('tr')?'Döndür':'Rotate')),angle=node('input');angle.type='range';angle.min='-60';angle.max='60';angle.value='0';angle.oninput=()=>w.JarvisAvatar3D.rotate(canvas,Number(angle.value));label.append(angle);controls.append(label)}
  function cyber(){prepare(t('cyber'));dialog.append(node('p',t('scope')));const list=node('ul');for(const [key,val] of [['secure',w.isSecureContext?t('yes'):t('no')],['passkey',w.PublicKeyCredential?t('yes'):t('no')],['session',d.getElementById('jarvisNativeMobileV190')?.dataset.sessionSecurity==='ready'?t('ready'):t('unknown')]])list.append(node('li',t(key)+': '+val));dialog.append(list,node('p',t('repo')),node('code','npm run security:check'),node('p',t('dark')))}
  function open(mode='avatar'){previous=d.activeElement;if(mode==='cyber')cyber();else studio();if(!dialog.open)dialog.showModal();dialog.querySelector('button').focus()}
  const css=node('link');css.rel='stylesheet';css.href='/avatar-security-v198.css';d.head.append(css);
  const robotCSS=node('link');robotCSS.rel='stylesheet';robotCSS.href='/avatar-3d-v199.css';d.head.append(robotCSS);
  const robotScript=node('script');robotScript.src='/avatar-3d-v199.js';d.head.append(robotScript);
  // Add the optional original robot without changing the existing photo workflow.
  const studioObserver=new MutationObserver(()=>{
    if(!dialog.open||dialog.classList.contains('ja-projection')||!dialog.querySelector('[data-ja=core]')||dialog.querySelector('[data-ja=robot3d]'))return;
    const b=node('button',d.documentElement.lang.startsWith('tr')?'Özgün 3D robotu aç / kapat':'Toggle original 3D robot');b.type='button';b.dataset.ja='robot3d';
    b.onclick=()=>{try{if(!w.JarvisAvatar3D)throw Error('loading');w.JarvisAvatar3D.setCore(selected,!w.JarvisAvatar3D.isEnabled(selected));b.setAttribute('aria-pressed',String(w.JarvisAvatar3D.isEnabled(selected)));message('saved')}catch(_){message('error')}};
    b.setAttribute('aria-pressed',String(!!w.JarvisAvatar3D?.isEnabled(selected)));dialog.append(b,node('p',d.documentElement.lang.startsWith('tr')?'3D robot: özgün model, ünlü değil. Ses genliğine bağlı çene; fonem senkronu değil. Fotoğraf modu ayrıdır.':'3D robot: original model, not a celebrity. Audio-energy jaw motion, not phoneme lip sync. Photo mode is separate.'));
  });
  dialog=node('dialog',null,'ja-dialog');dialog.id='jarvisAvatarStudio';dialog.addEventListener('cancel',e=>{e.preventDefault();close()});d.body.append(dialog);
  studioObserver.observe(dialog,{childList:true,attributes:true,attributeFilter:['open']});
  for(const core of cores)apply(core);
  d.addEventListener('jarvis:cockpit-locale',()=>{for(const c of cores)apply(c);if(dialog.open)close()});
  w.addEventListener('storage',e=>{if(e.key===null||e.key.startsWith(prefix))for(const c of cores)apply(c)});
  w.JarvisAvatarSecurity=Object.freeze({open});
})(window);
