const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {Readable,Transform}=require('stream');
const {pipeline}=require('stream/promises');

const CREATOR_WEB_MEDIA_VERSION='1.0';
const DEFAULT_MAX_BYTES=220*1024*1024;
const VIDEO_EXTENSIONS=new Set(['.mp4','.webm','.mov','.m4v','.mkv']);
const IMAGE_EXTENSIONS=new Set(['.jpg','.jpeg','.png','.webp']);

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function cleanText(value,max=240){
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,max);
}
function normalizeQuery(value){
  const q=cleanText(value,140);
  if(!q)throw new Error('CREATOR_WEB_QUERY_REQUIRED');
  return q;
}
function allowedProvider(value){
  const p=String(value||'auto').toLowerCase().trim();
  if(!['auto','wikimedia','pexels','pixabay'].includes(p))throw new Error('CREATOR_WEB_PROVIDER_UNSUPPORTED');
  return p;
}
function orientationValue(value){
  const v=String(value||'any').toLowerCase().trim();
  return ['portrait','landscape','any'].includes(v)?v:'any';
}
function urlHostAllowed(provider,url){
  let host='';
  try{
    const u=new URL(String(url||''));
    if(u.protocol!=='https:')return false;
    host=u.hostname.toLowerCase();
  }catch(_){return false}
  if(provider==='wikimedia')return host==='upload.wikimedia.org'||host.endsWith('.wikimedia.org');
  if(provider==='pexels')return host==='videos.pexels.com'||host.endsWith('.pexels.com');
  if(provider==='pixabay')return host==='cdn.pixabay.com'||host.endsWith('.pixabay.com');
  return false;
}
function extensionFor(candidate){
  const mime=String(candidate&&candidate.mime||'').toLowerCase();
  if(mime.includes('webm'))return '.webm';
  if(mime.includes('quicktime'))return '.mov';
  if(mime.includes('mp4'))return '.mp4';
  try{
    const ext=path.extname(new URL(candidate.downloadUrl).pathname).toLowerCase();
    if(VIDEO_EXTENSIONS.has(ext))return ext;
  }catch(_){}
  return '.mp4';
}
function imageExtensionFor(candidate){
  const mime=String(candidate&&candidate.mime||'').toLowerCase();
  if(mime.includes('jpeg')||mime.includes('jpg'))return '.jpg';
  if(mime.includes('png'))return '.png';
  if(mime.includes('webp'))return '.webp';
  try{
    const ext=path.extname(new URL(candidate.downloadUrl).pathname).toLowerCase();
    if(IMAGE_EXTENSIONS.has(ext))return ext;
  }catch(_){}
  return '.jpg';
}
function publicDomainLicense(value){
  const x=cleanText(value,120).toLowerCase().replace(/[._-]+/g,' ');
  return x.includes('public domain')||x==='pd'||x.includes('cc0')||x.includes('creative commons zero');
}
function candidateAllowed(candidate){
  if(!candidate||!candidate.provider||!candidate.downloadUrl)return{ok:false,code:'CREATOR_WEB_BAD_CANDIDATE'};
  if(!urlHostAllowed(candidate.provider,candidate.downloadUrl))return{ok:false,code:'CREATOR_WEB_HOST_BLOCKED'};
  if(candidate.provider==='wikimedia'&&!publicDomainLicense(candidate.license))return{ok:false,code:'CREATOR_WEB_LICENSE_BLOCKED'};
  if(candidate.provider==='pexels'&&String(candidate.license)!=='Pexels License')return{ok:false,code:'CREATOR_WEB_LICENSE_BLOCKED'};
  if(candidate.provider==='pixabay'&&String(candidate.license)!=='Pixabay Content License')return{ok:false,code:'CREATOR_WEB_LICENSE_BLOCKED'};
  return{ok:true};
}
function orientationMatches(candidate,orientation){
  const o=orientationValue(orientation);
  if(o==='any')return true;
  const w=Number(candidate&&candidate.width||0),h=Number(candidate&&candidate.height||0);
  if(!w||!h)return true;
  return o==='portrait'?h>=w:w>=h;
}
function pickPexelsFile(video,orientation){
  const rows=Array.isArray(video&&video.video_files)?video.video_files:[];
  const filtered=rows.filter(x=>String(x&&x.file_type||'').toLowerCase()==='video/mp4'&&x.link);
  const oriented=filtered.filter(x=>orientationMatches({width:x.width,height:x.height},orientation));
  const pool=oriented.length?oriented:filtered;
  return pool.sort((a,b)=>{
    const aScore=Math.min(Number(a.width||0),1920)*Math.min(Number(a.height||0),1920);
    const bScore=Math.min(Number(b.width||0),1920)*Math.min(Number(b.height||0),1920);
    return bScore-aScore;
  })[0]||null;
}
function normalizePexels(data,orientation='any'){
  const out=[];
  for(const video of Array.isArray(data&&data.videos)?data.videos:[]){
    const file=pickPexelsFile(video,orientation);
    if(!file)continue;
    const c={
      provider:'pexels',
      id:String(video.id||''),
      title:'Pexels video '+String(video.id||''),
      creator:cleanText(video.user&&video.user.name,160),
      sourcePage:String(video.url||''),
      downloadUrl:String(file.link||''),
      mime:'video/mp4',
      width:Number(file.width||video.width||0),
      height:Number(file.height||video.height||0),
      duration:Number(video.duration||0),
      license:'Pexels License',
      licenseUrl:'https://www.pexels.com/license/',
      attributionRequired:false
    };
    if(candidateAllowed(c).ok&&orientationMatches(c,orientation))out.push(c);
  }
  return out;
}
function normalizePixabay(data,orientation='any'){
  const out=[];
  for(const hit of Array.isArray(data&&data.hits)?data.hits:[]){
    const variants=hit&&hit.videos||{};
    const file=variants.large||variants.medium||variants.small||variants.tiny;
    if(!file||!file.url)continue;
    const c={
      provider:'pixabay',
      id:String(hit.id||''),
      title:cleanText(hit.tags||('Pixabay video '+String(hit.id||'')),180),
      creator:cleanText(hit.user,160),
      sourcePage:String(hit.pageURL||''),
      downloadUrl:String(file.url||''),
      mime:'video/mp4',
      width:Number(file.width||0),
      height:Number(file.height||0),
      duration:Number(hit.duration||0),
      license:'Pixabay Content License',
      licenseUrl:'https://pixabay.com/service/license-summary/',
      attributionRequired:false
    };
    if(candidateAllowed(c).ok&&orientationMatches(c,orientation))out.push(c);
  }
  return out;
}
function normalizeWikimedia(data,orientation='any'){
  const pages=data&&data.query&&data.query.pages&&typeof data.query.pages==='object'?Object.values(data.query.pages):[];
  const out=[];
  for(const page of pages){
    const info=Array.isArray(page&&page.imageinfo)?page.imageinfo[0]:null;
    if(!info||!info.url)continue;
    const meta=info.extmetadata||{};
    const license=cleanText(meta.LicenseShortName&&meta.LicenseShortName.value,120);
    const c={
      provider:'wikimedia',
      id:String(page.pageid||page.title||''),
      title:cleanText(page.title,200),
      creator:cleanText((meta.Artist&&meta.Artist.value)||(meta.Credit&&meta.Credit.value),180),
      sourcePage:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(String(page.title||'').replace(/ /g,'_')),
      downloadUrl:String(info.url||''),
      mime:String(info.mime||''),
      width:Number(info.width||0),
      height:Number(info.height||0),
      duration:0,
      license,
      licenseUrl:cleanText(meta.LicenseUrl&&meta.LicenseUrl.value,500),
      attributionRequired:false
    };
    if(!/video\/(?:mp4|webm)/i.test(c.mime))continue;
    if(candidateAllowed(c).ok&&orientationMatches(c,orientation))out.push(c);
  }
  return out;
}
function normalizeWikimediaImages(data,orientation='any'){
  const pages=data&&data.query&&data.query.pages&&typeof data.query.pages==='object'?Object.values(data.query.pages):[];
  const out=[];
  for(const page of pages){
    const info=Array.isArray(page&&page.imageinfo)?page.imageinfo[0]:null;
    if(!info||!(info.thumburl||info.url))continue;
    const meta=info.extmetadata||{};
    const license=cleanText(meta.LicenseShortName&&meta.LicenseShortName.value,120);
    const c={
      provider:'wikimedia',
      id:String(page.pageid||page.title||''),
      title:cleanText(page.title,200),
      creator:cleanText((meta.Artist&&meta.Artist.value)||(meta.Credit&&meta.Credit.value),180),
      sourcePage:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(String(page.title||'').replace(/ /g,'_')),
      downloadUrl:String(info.thumburl||info.url||''),
      mime:String(info.thumbmime||info.mime||''),
      width:Number(info.thumbwidth||info.width||0),
      height:Number(info.thumbheight||info.height||0),
      duration:0,
      kind:'image',
      license,
      licenseUrl:cleanText(meta.LicenseUrl&&meta.LicenseUrl.value,500),
      attributionRequired:false
    };
    if(!/^image\/(?:jpeg|png|webp)$/i.test(c.mime))continue;
    if(candidateAllowed(c).ok&&orientationMatches(c,orientation))out.push(c);
  }
  return out;
}
async function fetchJson(url,{headers={},fetchImpl=global.fetch,timeoutMs=20000}={}){
  if(typeof fetchImpl!=='function')throw new Error('CREATOR_WEB_FETCH_UNAVAILABLE');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{headers:{'User-Agent':'JARVIS-OS Creator Web Media/1.0',...headers},redirect:'follow',signal:controller.signal});
    if(!res.ok)throw new Error('CREATOR_WEB_HTTP_'+res.status);
    return await res.json();
  }finally{clearTimeout(timer)}
}
async function searchWikimedia(query,{limit=8,orientation='any',fetchImpl=global.fetch}={}){
  const q=normalizeQuery(query);
  const count=Math.max(1,Math.min(20,Number(limit)||8));
  const u=new URL('https://commons.wikimedia.org/w/api.php');
  const params={
    action:'query',format:'json',formatversion:'2',generator:'search',
    gsrsearch:'filetype:video '+q,gsrnamespace:'6',gsrlimit:String(count*3),
    prop:'imageinfo',iiprop:'url|mime|size|extmetadata',
    iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|Credit',
    iiextmetadatalanguage:'en',origin:'*'
  };
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const data=await fetchJson(u.toString(),{fetchImpl});
  return normalizeWikimedia(data,orientation).slice(0,count);
}
async function searchWikimediaImages(query,{limit=8,orientation='any',fetchImpl=global.fetch}={}){
  const q=normalizeQuery(query);
  const count=Math.max(1,Math.min(20,Number(limit)||8));
  const u=new URL('https://commons.wikimedia.org/w/api.php');
  const params={
    action:'query',format:'json',formatversion:'2',generator:'search',
    gsrsearch:'filetype:bitmap '+q,gsrnamespace:'6',gsrlimit:String(count*3),
    prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iiurlwidth:'2400',
    iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|Credit',
    iiextmetadatalanguage:'en',origin:'*'
  };
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const data=await fetchJson(u.toString(),{fetchImpl});
  return normalizeWikimediaImages(data,orientation).slice(0,count);
}
async function searchPexels(query,{limit=8,orientation='any',fetchImpl=global.fetch,apiKey=process.env.PEXELS_API_KEY||''}={}){
  if(!apiKey)return[];
  const q=normalizeQuery(query);
  const count=Math.max(1,Math.min(20,Number(limit)||8));
  const u=new URL('https://api.pexels.com/v1/videos/search');
  u.searchParams.set('query',q);
  u.searchParams.set('per_page',String(count));
  if(orientationValue(orientation)!=='any')u.searchParams.set('orientation',orientationValue(orientation));
  const data=await fetchJson(u.toString(),{fetchImpl,headers:{Authorization:String(apiKey)}});
  return normalizePexels(data,orientation).slice(0,count);
}
async function searchPixabay(query,{limit=8,orientation='any',fetchImpl=global.fetch,apiKey=process.env.PIXABAY_API_KEY||''}={}){
  if(!apiKey)return[];
  const q=normalizeQuery(query);
  const count=Math.max(3,Math.min(20,Number(limit)||8));
  const u=new URL('https://pixabay.com/api/videos/');
  u.searchParams.set('key',String(apiKey));
  u.searchParams.set('q',q);
  u.searchParams.set('per_page',String(count));
  u.searchParams.set('safesearch','true');
  const data=await fetchJson(u.toString(),{fetchImpl});
  return normalizePixabay(data,orientation).slice(0,limit);
}
async function search(query,{provider='auto',limit=8,orientation='any',fetchImpl=global.fetch}={}){
  const p=allowedProvider(provider);
  const count=Math.max(1,Math.min(20,Number(limit)||8));
  if(p==='wikimedia')return searchWikimedia(query,{limit:count,orientation,fetchImpl});
  if(p==='pexels')return searchPexels(query,{limit:count,orientation,fetchImpl});
  if(p==='pixabay')return searchPixabay(query,{limit:count,orientation,fetchImpl});
  const providers=[];
  if(process.env.PEXELS_API_KEY)providers.push('pexels');
  if(process.env.PIXABAY_API_KEY)providers.push('pixabay');
  providers.push('wikimedia');
  const out=[];
  for(const name of providers){
    try{
      const rows=await search(query,{provider:name,limit:count,orientation,fetchImpl});
      for(const row of rows){
        if(out.length>=count)break;
        if(!out.some(x=>x.provider===row.provider&&x.id===row.id))out.push(row);
      }
      if(out.length>=count)break;
    }catch(_){}
  }
  return out.slice(0,count);
}
function hashFile(file){
  const h=crypto.createHash('sha256');
  const fd=fs.openSync(file,'r');
  try{
    const buf=Buffer.alloc(1024*1024);
    let read=0,pos=0;
    while((read=fs.readSync(fd,buf,0,buf.length,pos))>0){h.update(buf.subarray(0,read));pos+=read}
  }finally{fs.closeSync(fd)}
  return h.digest('hex');
}
async function downloadCandidate(workspace,candidate,{maxBytes=DEFAULT_MAX_BYTES,fetchImpl=global.fetch}={}){
  const verdict=candidateAllowed(candidate);
  if(!verdict.ok){const e=new Error(verdict.code);e.code=verdict.code;throw e}
  if(typeof fetchImpl!=='function')throw new Error('CREATOR_WEB_FETCH_UNAVAILABLE');
  const root=path.resolve(String(workspace||''));
  const inbox=ensureDir(path.join(root,'creator-web-inbox'));
  const assets=ensureDir(path.join(root,'creator-assets'));
  const temp=path.join(inbox,'download-'+crypto.randomUUID()+'.part');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  let bytes=0;
  try{
    const res=await fetchImpl(candidate.downloadUrl,{headers:{'User-Agent':'JARVIS-OS Creator Web Media/1.0'},redirect:'follow',signal:controller.signal});
    if(!res.ok)throw new Error('CREATOR_WEB_DOWNLOAD_HTTP_'+res.status);
    if(!urlHostAllowed(candidate.provider,res.url||candidate.downloadUrl))throw new Error('CREATOR_WEB_REDIRECT_BLOCKED');
    const declared=Number(res.headers&&res.headers.get&&res.headers.get('content-length')||0);
    if(declared>maxBytes)throw new Error('CREATOR_WEB_FILE_TOO_LARGE');
    if(!res.body)throw new Error('CREATOR_WEB_EMPTY_BODY');
    const limiter=new Transform({
      transform(chunk,enc,cb){
        bytes+=chunk.length;
        if(bytes>maxBytes)return cb(new Error('CREATOR_WEB_FILE_TOO_LARGE'));
        cb(null,chunk);
      }
    });
    await pipeline(Readable.fromWeb(res.body),limiter,fs.createWriteStream(temp,{flags:'wx'}));
    if(bytes<1024)throw new Error('CREATOR_WEB_FILE_TOO_SMALL');
    const sha256=hashFile(temp);
    const ext=extensionFor(candidate);
    const name='web-'+sha256.slice(0,20)+ext;
    const final=path.join(assets,name);
    let reused=false;
    if(fs.existsSync(final)){
      if(hashFile(final)!==sha256)throw new Error('CREATOR_WEB_HASH_COLLISION');
      reused=true;
      fs.unlinkSync(temp);
    }else{
      fs.renameSync(temp,final);
    }
    return{
      ok:true,
      path:path.relative(root,final).replace(/\\/g,'/'),
      fullPath:final,
      sha256,
      bytes,
      reused,
      source:{
        provider:candidate.provider,
        id:candidate.id,
        title:candidate.title,
        creator:candidate.creator,
        sourcePage:candidate.sourcePage,
        license:candidate.license,
        licenseUrl:candidate.licenseUrl,
        attributionRequired:!!candidate.attributionRequired,
        downloadedFrom:candidate.downloadUrl
      }
    };
  }finally{
    clearTimeout(timer);
    try{if(fs.existsSync(temp))fs.unlinkSync(temp)}catch(_){}
  }
}
async function downloadImageCandidate(workspace,candidate,{maxBytes=40*1024*1024,fetchImpl=global.fetch}={}){
  const verdict=candidateAllowed(candidate);
  if(!verdict.ok){const e=new Error(verdict.code);e.code=verdict.code;throw e}
  if(typeof fetchImpl!=='function')throw new Error('CREATOR_WEB_FETCH_UNAVAILABLE');
  const root=path.resolve(String(workspace||''));
  const inbox=ensureDir(path.join(root,'creator-web-inbox'));
  const temp=path.join(inbox,'image-'+crypto.randomUUID()+'.part');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),90000);
  let bytes=0;
  try{
    const res=await fetchImpl(candidate.downloadUrl,{headers:{'User-Agent':'JARVIS-OS Creator Web Media/1.0'},redirect:'follow',signal:controller.signal});
    if(!res.ok)throw new Error('CREATOR_WEB_IMAGE_HTTP_'+res.status);
    if(!urlHostAllowed(candidate.provider,res.url||candidate.downloadUrl))throw new Error('CREATOR_WEB_REDIRECT_BLOCKED');
    const declared=Number(res.headers&&res.headers.get&&res.headers.get('content-length')||0);
    if(declared>maxBytes)throw new Error('CREATOR_WEB_IMAGE_TOO_LARGE');
    if(!res.body)throw new Error('CREATOR_WEB_EMPTY_BODY');
    const limiter=new Transform({
      transform(chunk,enc,cb){
        bytes+=chunk.length;
        if(bytes>maxBytes)return cb(new Error('CREATOR_WEB_IMAGE_TOO_LARGE'));
        cb(null,chunk);
      }
    });
    await pipeline(Readable.fromWeb(res.body),limiter,fs.createWriteStream(temp,{flags:'wx'}));
    if(bytes<1024)throw new Error('CREATOR_WEB_IMAGE_TOO_SMALL');
    const sha256=hashFile(temp);
    const ext=imageExtensionFor(candidate);
    const name='image-'+sha256.slice(0,20)+ext;
    const final=path.join(inbox,name);
    let reused=false;
    if(fs.existsSync(final)){
      if(hashFile(final)!==sha256)throw new Error('CREATOR_WEB_IMAGE_HASH_COLLISION');
      reused=true;
      fs.unlinkSync(temp);
    }else{
      fs.renameSync(temp,final);
    }
    return{
      ok:true,
      path:path.relative(root,final).replace(/\\/g,'/'),
      fullPath:final,
      sha256,
      bytes,
      reused,
      source:{
        provider:candidate.provider,
        id:candidate.id,
        title:candidate.title,
        creator:candidate.creator,
        sourcePage:candidate.sourcePage,
        license:candidate.license,
        licenseUrl:candidate.licenseUrl,
        attributionRequired:!!candidate.attributionRequired,
        downloadedFrom:candidate.downloadUrl
      }
    };
  }finally{
    clearTimeout(timer);
    try{if(fs.existsSync(temp))fs.unlinkSync(temp)}catch(_){}
  }
}
function readWebMediaManifests(workspace){
  const root=path.resolve(String(workspace||''));
  const dir=path.join(root,'creator-web-media');
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const name of fs.readdirSync(dir).filter(x=>/^manifest-.+\.json$/i.test(x)).sort()){
    try{
      const full=path.join(dir,name);
      const row=JSON.parse(fs.readFileSync(full,'utf8'));
      if(row&&Array.isArray(row.items))out.push({file:path.relative(root,full).replace(/\\/g,'/'),...row});
    }catch(_){}
  }
  return out;
}
function sourceRecordsForAssets(workspace,assetPaths){
  const wanted=new Set((Array.isArray(assetPaths)?assetPaths:[]).map(x=>String(x&&x.path||x||'').replace(/\\/g,'/')).filter(Boolean));
  if(!wanted.size)return[];
  const out=[],seen=new Set();
  for(const manifest of readWebMediaManifests(workspace).reverse()){
    for(const item of Array.isArray(manifest.items)?manifest.items:[]){
      const p=String(item&&item.path||'').replace(/\\/g,'/');
      if(!wanted.has(p)||seen.has(p))continue;
      const source=item&&item.source||{};
      out.push({
        path:p,
        provider:cleanText(source.provider,60),
        title:cleanText(source.title,180),
        creator:cleanText(source.creator,160),
        sourcePage:String(source.sourcePage||'').trim().slice(0,900),
        license:cleanText(source.license,140),
        licenseUrl:String(source.licenseUrl||'').trim().slice(0,900),
        attributionRequired:!!source.attributionRequired
      });
      seen.add(p);
    }
  }
  return out;
}
function buildAttributionText(workspace,assetPaths,{maxChars=1800}={}){
  const rows=sourceRecordsForAssets(workspace,assetPaths);
  if(!rows.length)return'';
  const lines=['','Görsel kaynakları / Visual sources:'];
  for(const row of rows){
    let line='- '+(row.title||path.basename(row.path));
    if(row.creator)line+=' — '+row.creator;
    if(row.provider)line+=' ['+row.provider+']';
    if(row.license)line+=' · '+row.license;
    if(row.sourcePage)line+=' · '+row.sourcePage;
    if(row.licenseUrl&&row.licenseUrl!==row.sourcePage)line+=' · Lisans: '+row.licenseUrl;
    lines.push(line);
  }
  return lines.join('\n').slice(0,Math.max(200,Number(maxChars)||1800));
}
function appendAttribution(description,workspace,assetPaths,maxLength=5000){
  const base=String(description||'').trim();
  const credits=buildAttributionText(workspace,assetPaths,{maxChars:Math.max(300,Number(maxLength)||5000)});
  if(!credits)return base.slice(0,maxLength);
  const room=Math.max(0,Number(maxLength)||5000);
  if(base){
    const separator='\n\n';
    const available=Math.max(0,room-credits.length-separator.length);
    return (base.slice(0,available)+separator+credits).slice(0,room);
  }
  return credits.trim().slice(0,room);
}

async function searchAndIngest(workspace,{query,provider='auto',orientation='any',count=3,fetchImpl=global.fetch,inspect=null,animateImage=null,manifestId=''}={}){
  const q=normalizeQuery(query);
  const wanted=Math.max(1,Math.min(12,Number(count)||3));
  const requestedProvider=allowedProvider(provider);
  const candidates=await search(q,{provider:requestedProvider,limit:Math.max(wanted*3,wanted),orientation,fetchImpl});
  const accepted=[],errors=[];

  for(const candidate of candidates){
    if(accepted.length>=wanted)break;
    try{
      const item=await downloadCandidate(workspace,candidate,{fetchImpl});
      if(typeof inspect==='function'){
        const probe=inspect(item.path);
        if(!probe||probe.ok!==true){
          try{fs.unlinkSync(item.fullPath)}catch(_){}
          throw new Error('CREATOR_WEB_PROBE_FAILED_'+String(probe&&probe.code||'INVALID'));
        }
        item.probe={duration:probe.duration,width:probe.width,height:probe.height,codec:probe.codec};
      }
      accepted.push(item);
    }catch(e){
      errors.push({provider:candidate.provider,id:candidate.id,error:String(e.code||e.message||e).slice(0,180)});
    }
  }

  if(accepted.length<wanted&&typeof animateImage==='function'&&(requestedProvider==='auto'||requestedProvider==='wikimedia')){
    let imageCandidates=[];
    try{
      imageCandidates=await searchWikimediaImages(q,{
        limit:Math.max((wanted-accepted.length)*3,wanted-accepted.length),
        orientation,
        fetchImpl
      });
    }catch(e){
      errors.push({provider:'wikimedia',id:'image-search',error:String(e.code||e.message||e).slice(0,180)});
    }
    for(const candidate of imageCandidates){
      if(accepted.length>=wanted)break;
      try{
        const image=await downloadImageCandidate(workspace,candidate,{fetchImpl});
        const mode=orientationValue(orientation)==='landscape'?'landscape':'portrait';
        const animated=await animateImage(image.path,{orientation:mode,duration:mode==='landscape'?8:6});
        if(!animated||animated.ok!==true||!animated.path)throw new Error('CREATOR_WEB_IMAGE_ANIMATION_FAILED');
        let probe=null;
        if(typeof inspect==='function'){
          probe=inspect(animated.path);
          if(!probe||probe.ok!==true)throw new Error('CREATOR_WEB_IMAGE_ANIMATED_PROBE_FAILED_'+String(probe&&probe.code||'INVALID'));
        }
        accepted.push({
          ok:true,
          path:animated.path,
          fullPath:animated.fullPath||path.resolve(workspace,animated.path),
          sha256:animated.sha256,
          bytes:Number(animated.bytes||0),
          reused:!!animated.reused,
          probe:probe?{duration:probe.duration,width:probe.width,height:probe.height,codec:probe.codec}:null,
          source:image.source,
          derived:{
            kind:'animated_still',
            sourcePath:image.path,
            sourceSha256:image.sha256,
            orientation:mode
          }
        });
      }catch(e){
        errors.push({provider:candidate.provider,id:candidate.id,error:String(e.code||e.message||e).slice(0,180)});
      }
    }
  }

  if(!accepted.length)throw new Error(candidates.length?'CREATOR_WEB_ALL_CANDIDATES_REJECTED':'CREATOR_WEB_NO_LICENSED_MEDIA_FOUND');
  const dir=ensureDir(path.join(path.resolve(workspace),'creator-web-media'));
  const id=cleanText(manifestId,90).replace(/[^A-Za-z0-9._-]+/g,'-')||crypto.randomUUID();
  const manifest=path.join(dir,'manifest-'+id+'.json');
  const payload={
    version:CREATOR_WEB_MEDIA_VERSION,
    createdAt:new Date().toISOString(),
    query:q,
    requestedProvider,
    orientation:orientationValue(orientation),
    strictRightsPolicy:'Wikimedia video/image only Public Domain/CC0; still images are locally animated to H.264; Pexels/Pixabay provider licenses; arbitrary social-video ripping blocked',
    items:accepted.map(x=>({path:x.path,sha256:x.sha256,bytes:x.bytes,reused:x.reused,probe:x.probe||null,derived:x.derived||null,source:x.source})),
    rejected:errors
  };
  fs.writeFileSync(manifest,JSON.stringify(payload,null,2),'utf8');
  return{
    ok:true,
    query:q,
    manifest:path.relative(path.resolve(workspace),manifest).replace(/\\/g,'/'),
    assets:accepted.map(x=>x.path),
    items:payload.items,
    rejected:errors
  };
}

module.exports={
  CREATOR_WEB_MEDIA_VERSION,
  normalizeQuery,
  allowedProvider,
  orientationValue,
  urlHostAllowed,
  publicDomainLicense,
  candidateAllowed,
  orientationMatches,
  normalizePexels,
  normalizePixabay,
  normalizeWikimedia,
  normalizeWikimediaImages,
  searchWikimedia,
  searchWikimediaImages,
  searchPexels,
  searchPixabay,
  search,
  downloadCandidate,
  downloadImageCandidate,
  searchAndIngest,
  readWebMediaManifests,
  sourceRecordsForAssets,
  buildAttributionText,
  appendAttribution,
  extensionFor,
  imageExtensionFor
};
