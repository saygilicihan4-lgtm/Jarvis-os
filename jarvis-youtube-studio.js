const fs=require('fs');
const path=require('path');

const YOUTUBE_STUDIO_VERSION='1.1';
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
function resolveWorkspaceImage(workspace,filePath){
  if(!workspace)throw new Error('workspace required');
  const raw=safeText(filePath,1200);
  if(!raw)throw new Error('thumbnail file required');
  const full=path.isAbsolute(raw)?path.resolve(raw):path.resolve(workspace,raw);
  if(!isInside(workspace,full))throw new Error('YouTube thumbnail is limited to the JARVIS workspace');
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Thumbnail file not found: '+raw);
  const ext=path.extname(full).toLowerCase();
  if(!new Set(['.jpg','.jpeg','.png','.webp']).has(ext))throw new Error('Unsupported thumbnail file type: '+ext);
  const size=fs.statSync(full).size;
  if(size<1024||size>5*1024*1024)throw new Error('Thumbnail file size is invalid');
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
function isYouTubeStudioSnapshot(snap){
  try{
    const url=new URL(String(snap&&snap.url||''));
    return url.protocol==='https:'&&url.hostname.toLowerCase()==='studio.youtube.com';
  }catch(_){return false}
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
async function thumbnailInputExists(operator,workspace){
  try{return !!(await operator.evaluate(workspace,"!!document.querySelector('input[type=file][accept*=image]')"))}catch(_){return false}
}
async function tryUploadThumbnail(operator,workspace,thumbnail){
  if(!thumbnail)return{ok:false,skipped:true,reason:'missing'};
  const start=Date.now();
  while(Date.now()-start<4500){
    if(await thumbnailInputExists(operator,workspace)){
      try{
        await operator.uploadFile(workspace,'input[type=file][accept*=image]',thumbnail.full);
        await sleep(700);
        return{ok:true};
      }catch(e){
        return{ok:false,reason:String(e.message||e).slice(0,220)};
      }
    }
    await sleep(350);
  }
  return{ok:false,skipped:true,reason:'image-input-not-found'};
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
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){return null}
}
function writeReceipt(file,record){
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(record,null,2),'utf8');
  fs.renameSync(tmp,file);
}
async function prepareDraft(operator,workspace,{file,title='',description='',thumbnail='',missionId=''}={}){
  if(!operator)throw new Error('browser operator required');
  const video=resolveWorkspaceVideo(workspace,file);
  const cleanTitle=safeText(title||path.basename(video.full,path.extname(video.full)),100);
  const cleanDescription=safeText(description,5000);
  let thumb=null,thumbnailError=null;
  if(String(thumbnail||'').trim()){
    try{thumb=resolveWorkspaceImage(workspace,thumbnail)}
    catch(e){thumbnailError=String(e.message||e).slice(0,240)}
  }
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
      thumbnailSet:!!existing.thumbnailSet,
      thumbnail:existing.thumbnail||null,
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
    thumbnail:thumb&&thumb.full||null,
    thumbnailSet:false,
    thumbnailError,
    published:false
  };
  writeReceipt(receipt,preflight);

  await operator.uploadFile(workspace,'input[type=file]',video.full);
  await sleep(1700);

  const titleSet=await setAnyField(operator,workspace,['Başlık','Baslik','Title'],cleanTitle);
  const descriptionSet=await setAnyField(operator,workspace,['Açıklama','Aciklama','Description'],cleanDescription);
  const thumbnailSet=thumb?await tryUploadThumbnail(operator,workspace,thumb):{ok:false,skipped:true,reason:thumbnailError||'missing'};
  snap=await snapshot(operator,workspace);

  const record={
    ...preflight,
    updatedAt:new Date().toISOString(),
    state:'draft_prepared',
    titleSet:!!titleSet.ok,
    descriptionSet:!!descriptionSet.ok,
    thumbnailSet:!!thumbnailSet.ok,
    thumbnail:thumb&&thumb.full||null,
    thumbnailError:thumbnailSet.ok?null:String(thumbnailSet.reason||thumbnailError||'').slice(0,240)||null,
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
    thumbnailSet:!!thumbnailSet.ok,
    thumbnail:thumb&&thumb.full||null,
    receipt,
    message:'YouTube Studio taslak yüklemesi başlatıldı · '+path.basename(video.full)+(thumb?(thumbnailSet.ok?' · thumbnail eklendi':' · thumbnail yüklenemedi, taslak devam etti'):'')+' · PUBLIC/YAYINLA adımına dokunulmadı'
  };
}

function publishContextReady(snap){
  const text=String(snap&&snap.text||'').toLocaleLowerCase('tr-TR');
  return isYouTubeStudioSnapshot(snap)&&/(?:görünürlük|gorunurluk|visibility|ayrıntılar|ayrintilar|details|kontroller|checks|video öğeleri|video ogeleri|video elements|ileri|next)/i.test(text);
}
function publishSuccess(snap){
  const text=String(snap&&snap.text||'').toLocaleLowerCase('tr-TR');
  return isYouTubeStudioSnapshot(snap)&&/(?:video\s+(?:yayınlandı|yayinlandi)|(?:yayınlandı|yayinlandi)\s+video|video\s+published|published\s+successfully)/i.test(text);
}
async function selectPublicVisibility(operator,workspace){
  const expression=[
    "(()=>{",
    "const els=[...document.querySelectorAll('tp-yt-paper-radio-button,[role=radio],label')];",
    "const txt=e=>String(e.innerText||e.textContent||e.getAttribute('aria-label')||'').trim().toLocaleLowerCase('tr-TR');",
    "const e=els.find(x=>/^(herkese açık|herkese acik|public)$/.test(txt(x)))||els.find(x=>/(herkese açık|herkese acik|public)/.test(txt(x)));",
    "if(!e)return{ok:false};",
    "e.scrollIntoView({block:'center'});e.click();",
    "return{ok:true,text:String(e.innerText||e.textContent||'').trim().slice(0,120)}",
    "})()"
  ].join('');
  try{return await operator.evaluate(workspace,expression)}catch(e){return{ok:false,error:String(e.message||e)}}
}
async function advanceToVisibility(operator,workspace){
  for(let i=0;i<4;i++){
    const snap=await snapshot(operator,workspace);
    const text=String(snap&&snap.text||'').toLocaleLowerCase('tr-TR');
    if(/(?:görünürlük|gorunurluk|visibility)/i.test(text))return{ok:true,snapshot:snap};
    const next=await clickAny(operator,workspace,['İleri','Ileri','Next']);
    if(!next.ok)return{ok:false,snapshot:snap};
    await sleep(650);
  }
  const snap=await snapshot(operator,workspace);
  return{ok:/(?:görünürlük|gorunurluk|visibility)/i.test(String(snap&&snap.text||'')),snapshot:snap};
}
function canonicalUtcIso(value){
  const s=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s))return null;
  const ms=Date.parse(s);
  if(!Number.isFinite(ms))return null;
  try{if(new Date(ms).toISOString()!==s)return null}catch(_){return null}
  return{value:s,ms};
}
function youtubeApprovalError(message='YouTube PUBLIC için aktif mission ile bağlı açık kullanıcı onayı gerekli.'){
  const e=new Error('YOUTUBE_EXPLICIT_APPROVAL_REQUIRED');
  e.code='YOUTUBE_EXPLICIT_APPROVAL_REQUIRED';
  e.detail=message;
  return e;
}
function resolveYouTubePublishApproval(workspace,existing,id,proof,{nowMs=Date.now()}={}){
  const missionId=String(id||'').trim();
  const value=String(proof||'').trim();
  if(!value)throw new Error('explicit approval proof required for YouTube publish');
  const approved=canonicalUtcIso(value);
  if(!approved)throw new Error('valid explicit approval timestamp required for YouTube publish');
  if(!existing||String(existing.missionId||'').trim()!==missionId)throw new Error('YouTube approval mission receipt mismatch');
  const created=canonicalUtcIso(existing.createdAt);
  if(!created||approved.ms<created.ms)throw new Error('YouTube approval predates draft receipt');
  const now=Number(nowMs);
  if(!Number.isFinite(now)||approved.ms>now+5000)throw new Error('YouTube approval timestamp is in the future');

  const missionFile=path.join(path.resolve(workspace),'.jarvis-missions',missionId+'.json');
  const mission=readJson(missionFile);
  if(!mission||mission.schema!==1||mission.engine!=='JARVIS_MISSION_ENGINE'||String(mission.id||'')!==missionId){
    throw youtubeApprovalError('YouTube approval mission kaydı bulunamadı veya geçersiz.');
  }
  if(mission.status!=='running'||!Array.isArray(mission.steps))throw youtubeApprovalError('YouTube approval yalnız aktif mission için kullanılabilir.');
  const currentIndex=Number(mission.currentStep);
  if(!Number.isInteger(currentIndex)||currentIndex<0||currentIndex>=mission.steps.length)throw youtubeApprovalError('YouTube mission current step geçersiz.');
  const publishStep=mission.steps[currentIndex];
  if(!publishStep||publishStep.name!=='youtube_publish'||publishStep.status!=='running')throw youtubeApprovalError('Aktif mission adımı youtube_publish değil.');
  if(!(publishStep.meta&&publishStep.meta.requiresApproval===true))throw youtubeApprovalError('YouTube publish step explicit approval gerektirmiyor olarak işaretlenmiş; fail-closed.');
  if(!require('./jarvis-approval-lifecycle').validateApproval(mission,{nowMs:now}).ok)throw youtubeApprovalError('YouTube approval süresi veya içerik bağı geçersiz.');
  const diskApproved=canonicalUtcIso(publishStep.meta.approvedAt);
  const publishStarted=canonicalUtcIso(publishStep.startedAt);
  if(!diskApproved||diskApproved.value!==approved.value)throw youtubeApprovalError('Caller approval timestamp aktif mission onayıyla birebir eşleşmiyor.');
  if(!publishStarted||approved.ms>publishStarted.ms)throw youtubeApprovalError('YouTube approval publish step başladıktan sonra üretilmiş görünüyor.');
  const draftStep=mission.steps.find(x=>x&&x.name==='youtube_draft');
  if(!draftStep||draftStep.status!=='completed')throw youtubeApprovalError('Aynı mission için tamamlanmış youtube_draft adımı yok.');
  const draftCompleted=canonicalUtcIso(draftStep.completedAt);
  if(!draftCompleted||approved.ms<draftCompleted.ms)throw youtubeApprovalError('YouTube approval tamamlanmış draft adımından önce verilmiş.');
  return{
    missionId,
    approvedAt:approved.value,
    approvalRequestId:publishStep.meta.approvalRequestId,
    approvalPayloadSha256:publishStep.meta.approvalPayloadSha256,
    draftCompletedAt:draftCompleted.value,
    publishStartedAt:publishStarted.value
  };
}
function validateApprovalProof(existing,id,proof,nowMs=Date.now()){
  const value=String(proof||'').trim();
  if(!value)throw new Error('explicit approval proof required for YouTube publish');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))throw new Error('valid explicit approval timestamp required for YouTube publish');
  const approvedMs=Date.parse(value),createdMs=Date.parse(String(existing&&existing.createdAt||''));
  if(!Number.isFinite(approvedMs))throw new Error('valid explicit approval timestamp required for YouTube publish');
  if(!existing||String(existing.missionId||'').trim()!==id)throw new Error('YouTube approval mission receipt mismatch');
  if(!Number.isFinite(createdMs)||approvedMs<createdMs)throw new Error('YouTube approval predates draft receipt');
  if(!Number.isFinite(nowMs)||approvedMs>nowMs+5000)throw new Error('YouTube approval timestamp is in the future');
  return value;
}
async function publishPreparedDraft(operator,workspace,{missionId='',approvedAt=''}={}){
  if(!operator)throw new Error('browser operator required');
  const id=String(missionId||'').trim();
  if(!id)throw new Error('mission id required for YouTube publish');
  const receipt=missionReceiptFile(workspace,id);
  const existing=readReceipt(workspace,id);
  if(!existing)return{ok:false,code:'YOUTUBE_DRAFT_RECEIPT_MISSING',retryable:false,message:'YouTube publish için mission draft receipt bulunamadı.'};
  if(existing.state==='published'&&existing.published===true){
    return{ok:true,code:'YOUTUBE_PUBLISHED',reused:true,published:true,receipt,title:existing.title||'',message:'YouTube videosu bu mission için zaten PUBLIC olarak doğrulanmış.'};
  }
  if(existing.state==='publish_started'){
    return{ok:false,code:'YOUTUBE_PUBLISH_UNCERTAIN',retryable:false,uncertain:true,receipt,message:'Önceki YouTube Publish tıklaması tamamlanmış olabilir. Kopya/yanlış tekrar riskine karşı otomatik publish tekrar edilmiyor; Studio ekranı doğrulanmalı.'};
  }
  if(existing.state!=='draft_prepared'){
    return{ok:false,code:'YOUTUBE_DRAFT_NOT_READY',retryable:false,receipt,message:'YouTube PUBLIC için önce aynı mission taslağı hazırlanmalı.'};
  }
  validateApprovalProof(existing,id,approvedAt);
  const approval=resolveYouTubePublishApproval(workspace,existing,id,approvedAt);
  const proof=approval.approvedAt;

  const browser=await operator.status(workspace);
  if(!browser.running){
    return{ok:false,code:'YOUTUBE_PUBLISH_CONTEXT_REQUIRED',retryable:true,receipt,message:'YouTube taslak penceresi açık değil. PUBLIC adımı uygulanmadı.'};
  }
  let snap=await snapshot(operator,workspace);
  if(authRequired(snap))return{ok:false,code:'YOUTUBE_AUTH_REQUIRED',retryable:true,receipt,message:'YouTube Studio oturumu gerekli. PUBLIC adımı uygulanmadı.'};
  if(!publishContextReady(snap)){
    return{ok:false,code:'YOUTUBE_PUBLISH_CONTEXT_REQUIRED',retryable:true,receipt,message:'Doğru YouTube yükleme/taslak ekranı doğrulanamadı. Yanlış videoyu yayınlamamak için PUBLIC adımı durduruldu.'};
  }

  const advanced=await advanceToVisibility(operator,workspace);
  if(!advanced.ok){
    return{ok:false,code:'YOUTUBE_VISIBILITY_STEP_NOT_FOUND',retryable:true,receipt,message:'YouTube görünürlük adımına ulaşılamadı. PUBLIC adımı uygulanmadı.'};
  }
  const selected=await selectPublicVisibility(operator,workspace);
  if(!selected||selected.ok!==true){
    return{ok:false,code:'YOUTUBE_PUBLIC_OPTION_NOT_FOUND',retryable:true,receipt,message:'YouTube Public/Herkese Açık seçeneği bulunamadı. PUBLIC adımı uygulanmadı.'};
  }

  const preClickSnap=await snapshot(operator,workspace);
  if(!(preClickSnap&&preClickSnap.ok)||!isYouTubeStudioSnapshot(preClickSnap)){
    return{ok:false,code:'YOUTUBE_PUBLISH_CONTEXT_REQUIRED',retryable:true,receipt,message:'Publish öncesi YouTube Studio bağlamı doğrulanamadı. PUBLIC adımı uygulanmadı.'};
  }
  if(publishSuccess(preClickSnap)){
    return{ok:false,code:'YOUTUBE_STALE_SUCCESS_MARKER',retryable:false,uncertain:true,receipt,message:'Publish tıklamasından önce sayfada eski bir yayın başarı işareti zaten görünüyordu. Yanlış başarı kanıtını kullanmamak için PUBLIC adımı durduruldu.'};
  }

  // Re-read the persisted grant after browser awaits, immediately before effect.
  const latestApproval=resolveYouTubePublishApproval(workspace,existing,id,approvedAt);
  if(latestApproval.approvalRequestId!==approval.approvalRequestId||latestApproval.approvalPayloadSha256!==approval.approvalPayloadSha256){
    throw youtubeApprovalError('YouTube onayı işlem sırasında değişti.');
  }
  const preflight={
    ...existing,
    updatedAt:new Date().toISOString(),
    action:'PUBLIC_PUBLISH_STARTED',
    state:'publish_started',
    approvedAt:proof,
    approvalMissionId:approval.missionId,
    approvalDraftCompletedAt:approval.draftCompletedAt,
    approvalPublishStartedAt:approval.publishStartedAt,
    publishEvidenceBaselineUrl:String(preClickSnap.url||''),
    published:false
  };
  writeReceipt(receipt,preflight);

  const clicked=await clickAny(operator,workspace,['Yayınla','Yayinla','Publish']);
  if(!clicked.ok){
    writeReceipt(receipt,{...preflight,updatedAt:new Date().toISOString(),action:'DRAFT_PREPARED',state:'draft_prepared',published:false,publishError:'publish_button_not_found'});
    return{ok:false,code:'YOUTUBE_PUBLISH_BUTTON_NOT_FOUND',retryable:true,receipt,message:'YouTube Publish/Yayınla düğmesi bulunamadı. Video PUBLIC yapılmadı.'};
  }

  await sleep(1200);
  snap=await snapshot(operator,workspace);
  if(!publishSuccess(snap)){
    return{ok:false,code:'YOUTUBE_PUBLISH_UNCERTAIN',retryable:false,uncertain:true,receipt,message:'Publish tıklaması yapıldı ancak PUBLIC sonucu doğrulanamadı. Otomatik tekrar engellendi; Studio ekranı doğrulanmalı.'};
  }

  const record={
    ...preflight,
    updatedAt:new Date().toISOString(),
    action:'PUBLIC_PUBLISHED',
    state:'published',
    published:true,
    publishedAt:new Date().toISOString(),
    publishEvidenceUrl:String(snap&&snap.url||''),
    studioUrl:String(snap&&snap.url||existing.studioUrl||STUDIO_URL)
  };
  writeReceipt(receipt,record);
  return{ok:true,code:'YOUTUBE_PUBLISHED',published:true,receipt,title:record.title||'',message:'YouTube videosu açık onay sonrası PUBLIC olarak doğrulandı.'};
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
  resolveYouTubePublishApproval,
  publishPreparedDraft
};
