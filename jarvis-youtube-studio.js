const fs=require('fs');
const path=require('path');

const YOUTUBE_STUDIO_VERSION='1.0';
const STUDIO_URL='https://studio.youtube.com/';

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function safeText(value,max){
  return String(value||'').replace(/\u0000/g,'').replace(/\r/g,'').trim().slice(0,max);
}
function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function isInside(parent,file){
  const p=path.resolve(parent),f=path.resolve(file);
  const rel=path.relative(p,f);
  return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));
}
function resolveWorkspaceVideo(workspace,filePath){
  if(!workspace)throw new Error('workspace required');
  const raw=safeText(filePath,1200);
  if(!raw)throw new Error('video file required');
  const full=path.isAbsolute(raw)?path.resolve(raw):path.resolve(workspace,raw);
  if(!isInside(workspace,full))throw new Error('YouTube upload is limited to the JARVIS workspace');
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Video file not found: '+raw);
  const ext=path.extname(full).toLowerCase();
  if(!new Set(['.mp4','.mov','.m4v','.webm']).has(ext))throw new Error('Unsupported video file type: '+ext);
  const size=fs.statSync(full).size;
  if(size<1024)throw new Error('Video file is empty or too small');
  return{full,size,ext};
}
function parseUploadSpec(text){
  const parts=String(text||'').split('|').map(x=>x.trim()).filter(Boolean);
  if(!parts.length)return null;
  const out={file:parts.shift(),title:'',description:''};
  for(const part of parts){
    const m=part.match(/^([^=]+)=(.*)$/s);if(!m)continue;
    const key=m[1].trim().toLocaleLowerCase('tr-TR'),value=m[2].trim();
    if(['başlık','baslik','title'].includes(key))out.title=value;
    else if(['açıklama','aciklama','description'].includes(key))out.description=value;
  }
  return out;
}
async function snapshot(operator,workspace){
  try{return await operator.pageSnapshot(workspace)}catch(e){return{ok:false,error:String(e.message||e)}}
}
function authRequired(snap){
  const url=String(snap&&snap.url||'').toLowerCase();
  const text=String(snap&&snap.text||'').toLocaleLowerCase('tr-TR');
  if(/accounts\.google\./.test(url))return true;
  if(/(?:oturum aç|oturum ac|sign in to youtube|sign in)/i.test(text)&&!/(?:içerik|content|dashboard|kanal içeriği|channel content)/i.test(text))return true;
  return false;
}
async function status(operator,workspace){
  const s=await operator.status(workspace);
  if(!s.running)return{
    ok:true,running:false,loggedIn:false,profile:s.profile,browser:s.browser||null,
    message:'JARVIS browser profili kapalı. YouTube Studio için açılabilir.'
  };
  const snap=await snapshot(operator,workspace);
  return{
    ok:true,
    running:true,
    loggedIn:!!(snap.ok&&!authRequired(snap)),
    profile:s.profile,
    browser:s.browser||null,
    title:snap.title||null,
    url:snap.url||null,
    message:snap.ok
      ?(authRequired(snap)?'YouTube Studio oturumu gerekli. JARVIS browser profilinde bir kez giriş yapın.':'YouTube Studio browser oturumu hazır görünüyor.')
      :'Browser açık; Studio sayfası henüz okunamadı.'
  };
}
async function clickAny(operator,workspace,labels){
  for(const label of labels){
    try{
      const r=await operator.clickByText(workspace,label);
      if(r&&r.ok)return{ok:true,label,result:r};
    }catch(_){}
  }
  return{ok:false};
}
async function uploadInputExists(operator,workspace){
  try{return !!(await operator.evaluate(workspace,"!!document.querySelector('input[type=file]')"))}catch(_){return false}
}
async function waitForUploadInput(operator,workspace,timeoutMs=12000){
  const start=Date.now();
  while(Date.now()-start<timeoutMs){
    if(await uploadInputExists(operator,workspace))return true;
    await sleep(350);
  }
  return false;
}
async function ensureUploadDialog(operator,workspace){
  if(await uploadInputExists(operator,workspace))return true;
  await clickAny(operator,workspace,['Oluştur','Olustur','Create']);
  await sleep(700);
  await clickAny(operator,workspace,['Video yükle','Video yukle','Upload videos','Upload video']);
  return waitForUploadInput(operator,workspace,12000);
}
async function setAnyField(operator,workspace,labels,value){
  if(!String(value||'').trim())return{ok:true,skipped:true};
  for(const label of labels){
    try{
      const r=await operator.setField(workspace,label,value);
      if(r&&r.ok)return{ok:true,label,result:r};
    }catch(_){}
  }
  return{ok:false};
}
function missionReceiptFile(workspace,missionId){
  const id=String(missionId||'').trim().replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100);
  if(!id)return null;
  return path.join(ensureDir(path.join(workspace,'youtube-drafts')),'mission-'+id+'.json');
}
function receiptFile(workspace,title,missionId=''){
  const mission=missionReceiptFile(workspace,missionId);
  if(mission)return mission;
  const dir=ensureDir(path.join(workspace,'youtube-drafts'));
  const base=String(title||'youtube-upload').normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'youtube-upload';
  return path.join(dir,base+'-'+Date.now()+'.json');
}
function readReceipt(workspace,missionId){
  const file=missionReceiptFile(workspace,missionId);
  if(!file||!fs.existsSync(file))return null;
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){return null}
}
function writeReceipt(file,record){
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(record,null,2),'utf8');
  fs.renameSync(tmp,file);
}
async function prepareDraft(operator,workspace,{file,title='',description='',missionId=''}={}){
  if(!operator)throw new Error('browser operator required');
  const video=resolveWorkspaceVideo(workspace,file);
  const cleanTitle=safeText(title||path.basename(video.full,path.extname(video.full)),100);
  const cleanDescription=safeText(description,5000);
  const receipt=receiptFile(workspace,cleanTitle,missionId);
  const existing=missionId?readReceipt(workspace,missionId):null;
  if(existing&&existing.state==='draft_prepared'&&existing.file===video.full){
    return{
      ok:true,
      code:'YOUTUBE_DRAFT_PREPARED',
      reused:true,
      published:false,
      file:video.full,
      title:existing.title||cleanTitle,
      titleSet:!!existing.titleSet,
      descriptionSet:!!existing.descriptionSet,
      receipt,
      message:'YouTube Studio mission taslağı zaten hazırlanmış · '+path.basename(video.full)+' · yeniden yüklenmedi'
    };
  }
  if(existing&&existing.state==='upload_started'&&existing.file===video.full){
    return{
      ok:false,
      code:'YOUTUBE_UPLOAD_UNCERTAIN',
      retryable:false,
      uncertain:true,
      receipt,
      message:'Önceki YouTube yüklemesi yarıda kesilmiş olabilir. Tekrar yükleyip kopya oluşturmamak için otomatik retry durduruldu; Studio ekranı doğrulanmalı.'
    };
  }

  let browser=await operator.status(workspace);
  if(!browser.running){
    browser=await operator.start(workspace,{url:STUDIO_URL});
    await sleep(1500);
  }else{
    try{await operator.navigate(workspace,STUDIO_URL)}catch(_){}
    await sleep(900);
  }

  let snap=await snapshot(operator,workspace);
  if(authRequired(snap)){
    return{
      ok:false,code:'YOUTUBE_AUTH_REQUIRED',retryable:false,
      message:'YouTube Studio için JARVIS browser profilinde bir kez oturum açılması gerekiyor. Video yüklenmedi.'
    };
  }

  const ready=await ensureUploadDialog(operator,workspace);
  if(!ready){
    snap=await snapshot(operator,workspace);
    if(authRequired(snap)){
      return{ok:false,code:'YOUTUBE_AUTH_REQUIRED',retryable:false,message:'YouTube Studio oturumu gerekli. Video yüklenmedi.'};
    }
    return{
      ok:false,code:'UPLOAD_DIALOG_NOT_FOUND',retryable:true,
      message:'YouTube Studio yükleme penceresi bulunamadı. Sayfa değişmiş olabilir; hiçbir video yayınlanmadı.'
    };
  }

  const preflight={
    schema:1,
    engine:'JARVIS_YOUTUBE_STUDIO',
    version:YOUTUBE_STUDIO_VERSION,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    missionId:missionId||null,
    action:'DRAFT_UPLOAD_STARTED',
    state:'upload_started',
    file:video.full,
    bytes:video.size,
    title:cleanTitle,
    description:cleanDescription,
    published:false
  };
  writeReceipt(receipt,preflight);

  await operator.uploadFile(workspace,'input[type=file]',video.full);
  await sleep(1700);

  const titleSet=await setAnyField(operator,workspace,['Başlık','Baslik','Title'],cleanTitle);
  const descriptionSet=await setAnyField(operator,workspace,['Açıklama','Aciklama','Description'],cleanDescription);
  snap=await snapshot(operator,workspace);

  const record={
    ...preflight,
    updatedAt:new Date().toISOString(),
    state:'draft_prepared',
    titleSet:!!titleSet.ok,
    descriptionSet:!!descriptionSet.ok,
    studioUrl:snap&&snap.url||STUDIO_URL,
    published:false
  };
  writeReceipt(receipt,record);

  return{
    ok:true,
    code:'YOUTUBE_DRAFT_PREPARED',
    published:false,
    file:video.full,
    title:cleanTitle,
    titleSet:!!titleSet.ok,
    descriptionSet:!!descriptionSet.ok,
    receipt,
    message:'YouTube Studio taslak yüklemesi başlatıldı · '+path.basename(video.full)+' · PUBLIC/YAYINLA adımına dokunulmadı'
  };
}


function visibilityStage(snap){
  const text=String(snap&&snap.text||'').toLocaleLowerCase('tr-TR');
  return /(?:görünürlük|gorunurluk|visibility)/i.test(text)&&/(?:herkese açık|herkese acik|public|gizli|private|liste dışı|liste disi|unlisted)/i.test(text);
}
async function selectPublicVisibility(operator,workspace){
  const expr=[
    "(()=>{",
    "const needles=['herkese açık','herkese acik','public'];",
    "const els=[...document.querySelectorAll('[role=radio],tp-yt-paper-radio-button,label,ytcp-ve,[aria-label]')];",
    "const label=e=>String(e.innerText||e.textContent||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().toLocaleLowerCase('tr-TR');",
    "const target=els.find(e=>needles.some(n=>label(e)===n))||els.find(e=>needles.some(n=>label(e).includes(n)));",
    "if(!target)return{ok:false,reason:'public-option-not-found'};",
    "target.scrollIntoView({block:'center'});target.click();",
    "return{ok:true,text:label(target).slice(0,120)};",
    "})()"
  ].join('');
  try{return await operator.evaluate(workspace,expr)}catch(e){return{ok:false,reason:String(e.message||e).slice(0,180)}}
}
function publishEvidence(snap){
  const text=String(snap&&snap.text||'').replace(/\s+/g,' ').toLocaleLowerCase('tr-TR');
  return /(?:video yayınlandı|video yayinlandi|video published|published successfully|yayınlandı|yayinlandi)/i.test(text);
}
async function publishPreparedDraft(operator,workspace,{missionId='',approved=false}={}){
  if(!operator)throw new Error('browser operator required');
  if(!approved)return{ok:false,code:'EXPLICIT_APPROVAL_REQUIRED',retryable:false,message:'YouTube yayınlama için açık kullanıcı onayı gerekli.'};
  const receipt=missionReceiptFile(workspace,missionId);
  if(!receipt)return{ok:false,code:'MISSION_ID_REQUIRED',retryable:false,message:'YouTube yayınlama için missionId gerekli.'};
  const existing=readReceipt(workspace,missionId);
  if(!existing)return{ok:false,code:'YOUTUBE_DRAFT_RECEIPT_MISSING',retryable:false,message:'Yayınlanacak YouTube taslak kaydı bulunamadı.'};
  if(existing.state==='published'&&existing.published===true){
    return{ok:true,code:'YOUTUBE_PUBLISHED',reused:true,published:true,receipt,file:existing.file,title:existing.title,message:'YouTube videosu daha önce yayınlanmış · tekrar yayınlanmadı'};
  }
  if(existing.state==='publish_started'||existing.state==='publish_uncertain'){
    return{ok:false,code:'YOUTUBE_PUBLISH_UNCERTAIN',retryable:false,uncertain:true,receipt,message:'Önceki YouTube yayınlama denemesi belirsiz. Kopya veya yanlış durum oluşturmamak için otomatik tekrar engellendi.'};
  }
  if(existing.state!=='draft_prepared'){
    return{ok:false,code:'YOUTUBE_DRAFT_NOT_READY',retryable:false,receipt,message:'YouTube taslağı yayınlamaya hazır durumda değil: '+String(existing.state||'unknown')};
  }

  const browser=await operator.status(workspace);
  if(!browser.running)return{ok:false,code:'YOUTUBE_STUDIO_NOT_RUNNING',retryable:true,message:'YouTube Studio browser oturumu açık değil.'};
  let snap=await snapshot(operator,workspace);
  if(authRequired(snap))return{ok:false,code:'YOUTUBE_AUTH_REQUIRED',retryable:true,message:'YouTube Studio oturumu gerekli; yayınlama yapılmadı.'};
  if(!/^https:\/\/studio\.youtube\.com\//i.test(String(snap&&snap.url||''))){
    return{ok:false,code:'YOUTUBE_DRAFT_CONTEXT_REQUIRED',retryable:true,message:'YouTube Studio taslak penceresi aktif değil; yayınlama yapılmadı.'};
  }

  for(let i=0;i<4&&!visibilityStage(snap);i++){
    const next=await clickAny(operator,workspace,['İleri','Ileri','Next']);
    if(!next.ok)break;
    await sleep(600);
    snap=await snapshot(operator,workspace);
    if(authRequired(snap))return{ok:false,code:'YOUTUBE_AUTH_REQUIRED',retryable:true,message:'YouTube Studio oturumu kayboldu; yayınlama yapılmadı.'};
  }
  if(!visibilityStage(snap)){
    return{ok:false,code:'YOUTUBE_VISIBILITY_STAGE_NOT_FOUND',retryable:true,message:'YouTube görünürlük adımı doğrulanamadı; yayınlama yapılmadı.'};
  }

  const publicChoice=await selectPublicVisibility(operator,workspace);
  if(!publicChoice||!publicChoice.ok){
    return{ok:false,code:'YOUTUBE_PUBLIC_OPTION_NOT_FOUND',retryable:true,message:'YouTube Herkese Açık seçeneği doğrulanamadı; yayınlama yapılmadı.'};
  }
  await sleep(350);

  const preflight={
    ...existing,
    updatedAt:new Date().toISOString(),
    action:'PUBLIC_PUBLISH_APPROVED',
    state:'publish_started',
    approval:'explicit_user',
    approvedAt:new Date().toISOString(),
    published:false
  };
  writeReceipt(receipt,preflight);

  const clicked=await clickAny(operator,workspace,['Yayınla','Yayinla','Publish']);
  if(!clicked.ok){
    const failed={...preflight,updatedAt:new Date().toISOString(),state:'draft_prepared',published:false,publishClickFailed:true};
    writeReceipt(receipt,failed);
    return{ok:false,code:'YOUTUBE_PUBLISH_BUTTON_NOT_FOUND',retryable:true,receipt,message:'YouTube Yayınla düğmesi bulunamadı; video yayınlanmadı.'};
  }

  await sleep(1600);
  snap=await snapshot(operator,workspace);
  if(publishEvidence(snap)){
    const record={...preflight,updatedAt:new Date().toISOString(),state:'published',published:true,publishedAt:new Date().toISOString(),publishEvidence:true,studioUrl:snap&&snap.url||existing.studioUrl||STUDIO_URL};
    writeReceipt(receipt,record);
    return{ok:true,code:'YOUTUBE_PUBLISHED',published:true,receipt,file:existing.file,title:existing.title,message:'YouTube videosu açık onay sonrası yayınlandı · '+String(existing.title||path.basename(existing.file||''))};
  }

  const uncertain={...preflight,updatedAt:new Date().toISOString(),state:'publish_uncertain',published:false,publishEvidence:false,studioUrl:snap&&snap.url||existing.studioUrl||STUDIO_URL};
  writeReceipt(receipt,uncertain);
  return{ok:false,code:'YOUTUBE_PUBLISH_UNCERTAIN',retryable:false,uncertain:true,receipt,message:'Yayınla tıklandı ancak yayın sonucu doğrulanamadı. Otomatik tekrar engellendi; Studio durumu doğrulanmalı.'};
}

module.exports={
  YOUTUBE_STUDIO_VERSION,
  STUDIO_URL,
  resolveWorkspaceVideo,
  parseUploadSpec,
  authRequired,
  status,
  missionReceiptFile,
  readReceipt,
  prepareDraft,
  publishPreparedDraft
};
