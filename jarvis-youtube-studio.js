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

module.exports={
  YOUTUBE_STUDIO_VERSION,
  STUDIO_URL,
  resolveWorkspaceVideo,
  parseUploadSpec,
  authRequired,
  status,
  missionReceiptFile,
  readReceipt,
  prepareDraft
};
