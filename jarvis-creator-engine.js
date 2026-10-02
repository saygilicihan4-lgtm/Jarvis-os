const fs=require('fs');
const path=require('path');
const os=require('os');
const childProcess=require('child_process');
const crypto=require('crypto');

const ENGINE_VERSION='1.4';
const CREATOR_PROFILE_VERSION='2.0';

function execFile(exe,args,opts={}){
  return childProcess.execFileSync(exe,args,{
    encoding:'utf8',
    windowsHide:true,
    timeout:opts.timeout||120000,
    maxBuffer:opts.maxBuffer||1024*1024*8,
    stdio:opts.stdio||['ignore','pipe','pipe']
  });
}
function commandPath(name){
  try{
    const finder=process.platform==='win32'?'where.exe':'which';
    const out=execFile(finder,[name],{timeout:5000}).trim().split(/\r?\n/).filter(Boolean)[0];
    return out||null;
  }catch(_){return null}
}
function safeName(name){
  return String(name||'short')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'')
    .slice(0,72)||('short-'+Date.now());
}
function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function creatorDirs(workspace){
  return{
    assets:ensureDir(path.join(workspace,'creator-assets')),
    output:ensureDir(path.join(workspace,'creator-video')),
    jobs:ensureDir(path.join(workspace,'creator-jobs'))
  };
}
const CREATOR_ASSET_EXTENSIONS=new Set(['.mp4','.mov','.mkv','.webm','.m4v']);
const CREATOR_IMAGE_EXTENSIONS=new Set(['.jpg','.jpeg','.png','.webp']);
function safeWorkspaceVideo(workspace,relativePath){
  const root=path.resolve(String(workspace||''));
  const original=String(relativePath||'').trim();
  if(!original||original.includes('\0')||/^[\\/]/.test(original)||/^[A-Za-z]:[\\/]/.test(original))throw new Error('CREATOR_ASSET_BAD_PATH');
  const rel=original.replace(/\\/g,'/').replace(/^\/+/, '').trim();
  if(!rel||rel.split('/').some(x=>x==='.'||x==='..'))throw new Error('CREATOR_ASSET_BAD_PATH');
  const lower=rel.toLocaleLowerCase('tr-TR');
  if(/(?:^|\/)(?:\.git|node_modules|\.jarvis-memory|\.jarvis-missions|\.jarvis-browser-profile)(?:\/|$)/.test(lower))throw new Error('CREATOR_ASSET_INTERNAL_PATH');
  const full=path.resolve(root,rel);
  if(!(full===root||full.startsWith(root+path.sep)))throw new Error('CREATOR_ASSET_OUTSIDE_WORKSPACE');
  if(!fs.existsSync(full))throw new Error('CREATOR_ASSET_SOURCE_MISSING');
  const lst=fs.lstatSync(full);
  if(lst.isSymbolicLink())throw new Error('CREATOR_ASSET_SYMLINK_BLOCKED');
  if(!lst.isFile())throw new Error('CREATOR_ASSET_NOT_FILE');
  const realRoot=fs.realpathSync(root),real=fs.realpathSync(full);
  if(!(real===realRoot||real.startsWith(realRoot+path.sep)))throw new Error('CREATOR_ASSET_SYMLINK_ESCAPE');
  const ext=path.extname(full).toLowerCase();
  if(!CREATOR_ASSET_EXTENSIONS.has(ext))throw new Error('CREATOR_ASSET_UNSUPPORTED_EXTENSION');
  if(lst.size<1024)throw new Error('CREATOR_ASSET_TOO_SMALL');
  if(lst.size>1024*1024*1024)throw new Error('CREATOR_ASSET_TOO_LARGE');
  return{root,rel,full,real,ext,bytes:lst.size};
}
function safeWorkspaceImage(workspace,relativePath){
  const root=path.resolve(String(workspace||''));
  const original=String(relativePath||'').trim();
  if(!original||original.includes('\0')||/^[\\/]/.test(original)||/^[A-Za-z]:[\\/]/.test(original))throw new Error('CREATOR_IMAGE_BAD_PATH');
  const rel=original.replace(/\\/g,'/').replace(/^\/+/, '').trim();
  if(!rel||rel.split('/').some(x=>x==='.'||x==='..'))throw new Error('CREATOR_IMAGE_BAD_PATH');
  const parts=rel.split('/').filter(Boolean);
  if(parts.length!==2||parts[0]!=='creator-web-inbox')throw new Error('CREATOR_IMAGE_SCOPE');
  const full=path.resolve(root,rel);
  if(path.dirname(full)!==path.resolve(root,'creator-web-inbox'))throw new Error('CREATOR_IMAGE_SCOPE');
  if(!fs.existsSync(full))throw new Error('CREATOR_IMAGE_SOURCE_MISSING');
  const lst=fs.lstatSync(full);
  if(lst.isSymbolicLink())throw new Error('CREATOR_IMAGE_SYMLINK_BLOCKED');
  if(!lst.isFile())throw new Error('CREATOR_IMAGE_NOT_FILE');
  const realRoot=fs.realpathSync(root),real=fs.realpathSync(full);
  if(!(real===realRoot||real.startsWith(realRoot+path.sep)))throw new Error('CREATOR_IMAGE_SYMLINK_ESCAPE');
  const ext=path.extname(full).toLowerCase();
  if(!CREATOR_IMAGE_EXTENSIONS.has(ext))throw new Error('CREATOR_IMAGE_UNSUPPORTED_EXTENSION');
  if(lst.size<1024)throw new Error('CREATOR_IMAGE_TOO_SMALL');
  if(lst.size>50*1024*1024)throw new Error('CREATOR_IMAGE_TOO_LARGE');
  return{root,rel,full,real,ext,bytes:lst.size};
}
function sha256File(file){
  const h=crypto.createHash('sha256');
  const fd=fs.openSync(file,'r');
  try{
    const buf=Buffer.alloc(1024*1024);
    let read=0,pos=0;
    while((read=fs.readSync(fd,buf,0,buf.length,pos))>0){
      h.update(buf.subarray(0,read));
      pos+=read;
    }
  }finally{fs.closeSync(fd)}
  return h.digest('hex');
}
function animateStillAsset(workspace,relativePath,{orientation='portrait',duration=6}={}){
  const info=safeWorkspaceImage(workspace,relativePath);
  const status=ffmpegStatus(workspace);
  if(!status.ok||!status.ffprobe){
    const e=new Error('Still image animation requires FFmpeg + FFprobe');
    e.code=!status.ok?'FFMPEG_MISSING':'FFPROBE_MISSING';
    throw e;
  }
  const mode=String(orientation||'portrait').toLowerCase()==='landscape'?'landscape':'portrait';
  const seconds=Math.max(4,Math.min(12,Number(duration)||6));
  const sourceSha256=sha256File(info.full);
  const styleHash=crypto.createHash('sha256').update(sourceSha256+'|'+mode+'|'+seconds.toFixed(3)).digest('hex').slice(0,20);
  const dirs=creatorDirs(workspace);
  const outFile=path.join(dirs.assets,'still-'+styleHash+'.mp4');
  let reused=false;
  if(fs.existsSync(outFile)){
    const probe=inspectAsset(workspace,path.relative(workspace,outFile).replace(/\\/g,'/'));
    if(!probe.ok)throw new Error('CREATOR_IMAGE_MOTION_EXISTING_INVALID');
    reused=true;
  }else{
    const filter=mode==='landscape'
      ?"scale=2048:1152:force_original_aspect_ratio=increase,crop=1920:1080:x='(in_w-out_w)/2+40*sin(t*0.75)':y='(in_h-out_h)/2+22*cos(t*0.55)',fps=30,setsar=1,format=yuv420p"
      :"scale=1180:2100:force_original_aspect_ratio=increase,crop=1080:1920:x='(in_w-out_w)/2+35*sin(t*0.95)':y='(in_h-out_h)/2+55*cos(t*0.72)',fps=30,setsar=1,format=yuv420p";
    try{
      execFile(status.ffmpeg,[
        '-y','-hide_banner','-loglevel','error',
        '-loop','1','-i',info.full,
        '-t',seconds.toFixed(3),
        '-vf',filter,
        '-an',
        '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
        '-movflags','+faststart',
        outFile
      ],{timeout:4*60*1000,maxBuffer:1024*1024*16});
    }catch(err){
      const message=String((err&&err.stderr)||err.message||err).slice(-2500);
      throw new Error('Creator still image animation failed: '+message);
    }
  }
  const rel=path.relative(workspace,outFile).replace(/\\/g,'/');
  const probe=inspectAsset(workspace,rel);
  const expectedWidth=mode==='landscape'?1920:1080;
  const expectedHeight=mode==='landscape'?1080:1920;
  if(!probe.ok||String(probe.codec||'').toLowerCase()!=='h264'||Number(probe.width)!==expectedWidth||Number(probe.height)!==expectedHeight||Number(probe.duration)<seconds-0.35){
    if(!reused){try{fs.unlinkSync(outFile)}catch(_){}}
    const e=new Error('CREATOR_IMAGE_MOTION_VERIFY_FAILED');
    e.code='CREATOR_IMAGE_MOTION_VERIFY_FAILED';
    e.probe=probe;
    throw e;
  }
  return{
    ok:true,
    path:rel,
    fullPath:outFile,
    sha256:sha256File(outFile),
    bytes:Number(fs.statSync(outFile).size||0),
    sourceSha256,
    sourcePath:info.rel,
    orientation:mode,
    duration:Number(probe.duration||seconds),
    width:Number(probe.width||0),
    height:Number(probe.height||0),
    codec:String(probe.codec||''),
    reused,
    derivedFromImage:true
  };
}
function assetSafeName(relativePath){
  const input=String(relativePath||'');
  const originalExt=path.extname(input);
  const ext=originalExt.toLowerCase();
  const stem=path.basename(input,originalExt);
  return safeName(stem)+ext;
}
function inspectAsset(workspace,relativePath){
  let info;
  try{info=safeWorkspaceVideo(workspace,relativePath)}catch(e){return{ok:false,code:String(e.message||e)}}
  const status=ffmpegStatus(workspace);
  if(!status.ffprobe)return{ok:false,code:'FFPROBE_MISSING',file:info.rel};
  try{
    const raw=execFile(status.ffprobe,[
      '-v','error',
      '-select_streams','v:0',
      '-show_entries','stream=codec_name,width,height:format=duration',
      '-of','json',
      info.full
    ],{timeout:20000,maxBuffer:1024*1024}).trim();
    const data=JSON.parse(raw||'{}');
    const stream=Array.isArray(data.streams)&&data.streams[0]?data.streams[0]:null;
    const duration=Number(data&&data.format&&data.format.duration);
    const width=Number(stream&&stream.width),height=Number(stream&&stream.height);
    if(!stream||!Number.isFinite(width)||width<16||!Number.isFinite(height)||height<16||!Number.isFinite(duration)||duration<=0){
      return{ok:false,code:'CREATOR_ASSET_INVALID_VIDEO',file:info.rel};
    }
    if(duration>600)return{ok:false,code:'CREATOR_ASSET_DURATION_LIMIT',file:info.rel,duration};
    return{
      ok:true,
      file:info.rel,
      bytes:info.bytes,
      duration:Number(duration.toFixed(3)),
      width,
      height,
      codec:String(stream.codec_name||'').slice(0,40)
    };
  }catch(e){
    return{ok:false,code:'CREATOR_ASSET_PROBE_FAILED',file:info.rel,message:String(e.message||e).slice(0,400)};
  }
}
function assetDestinationName(relativePath,sha256){
  const ext=path.extname(String(relativePath||'')).toLowerCase();
  if(!CREATOR_ASSET_EXTENSIONS.has(ext))throw new Error('CREATOR_ASSET_UNSUPPORTED_EXTENSION');
  const hash=String(sha256||'').replace(/[^a-f0-9]/gi,'').toLowerCase().slice(0,16);
  if(hash.length<16)throw new Error('CREATOR_ASSET_HASH_REQUIRED');
  return 'asset-'+hash+ext;
}
function listAssets(workspace){
  const dirs=creatorDirs(workspace);
  try{
    return fs.readdirSync(dirs.assets,{withFileTypes:true})
      .filter(x=>x.isFile()&&CREATOR_ASSET_EXTENSIONS.has(path.extname(x.name).toLowerCase()))
      .map(x=>path.join(dirs.assets,x.name))
      .sort((a,b)=>a.localeCompare(b));
  }catch(_){return[]}
}
function pickAsset(workspace,name){
  const assets=listAssets(workspace);
  if(!assets.length)return null;
  const h=crypto.createHash('sha1').update(String(name||'')).digest();
  const n=h.readUInt32BE(0)%assets.length;
  return assets[n];
}
function selectAssets(workspace,name,maxScenes=5){
  const assets=listAssets(workspace);
  if(!assets.length)return[];
  const limit=Math.max(1,Math.min(24,Number(maxScenes)||5,assets.length));
  const h=crypto.createHash('sha1').update('storyboard:'+String(name||'')).digest();
  const offset=h.readUInt32BE(0)%assets.length;
  const rotated=assets.slice(offset).concat(assets.slice(0,offset));
  return rotated.slice(0,limit);
}
function resolveAssetSelection(workspace,assetFiles,maxScenes=5){
  const rows=Array.isArray(assetFiles)?assetFiles.filter(Boolean).slice(0,Math.max(1,Math.min(24,Number(maxScenes)||5))):[];
  if(!rows.length)return[];
  const dirs=creatorDirs(workspace);
  const assetRoot=fs.realpathSync(dirs.assets);
  const out=[],seen=new Set();
  for(const raw of rows){
    const input=String(raw||'').trim();
    if(!input||input.includes('\0')||/^[\\/]/.test(input)||/^[A-Za-z]:[\\/]/.test(input))throw new Error('CREATOR_STORYBOARD_BAD_PATH');
    const rel=input.replace(/\\/g,'/').replace(/^\/+/, '').trim();
    const parts=rel.split('/').filter(Boolean);
    if(parts.length!==2||parts[0]!=='creator-assets'||parts.some(x=>x==='.'||x==='..'))throw new Error('CREATOR_STORYBOARD_ASSET_SCOPE');
    const full=path.resolve(workspace,rel);
    if(path.dirname(full)!==path.resolve(dirs.assets))throw new Error('CREATOR_STORYBOARD_ASSET_SCOPE');
    if(!fs.existsSync(full))throw new Error('CREATOR_STORYBOARD_ASSET_MISSING');
    const lst=fs.lstatSync(full);
    if(lst.isSymbolicLink())throw new Error('CREATOR_STORYBOARD_SYMLINK_BLOCKED');
    if(!lst.isFile())throw new Error('CREATOR_STORYBOARD_NOT_FILE');
    if(!CREATOR_ASSET_EXTENSIONS.has(path.extname(full).toLowerCase()))throw new Error('CREATOR_STORYBOARD_UNSUPPORTED_EXTENSION');
    const real=fs.realpathSync(full);
    if(path.dirname(real)!==assetRoot)throw new Error('CREATOR_STORYBOARD_SYMLINK_ESCAPE');
    if(seen.has(real))continue;
    seen.add(real);out.push(real);
  }
  if(!out.length)throw new Error('CREATOR_STORYBOARD_EMPTY');
  return out;
}
function buildStoryboard(assets,durationSeconds,transitionSeconds=0.18){
  const list=Array.isArray(assets)?assets.filter(Boolean):[];
  if(!list.length)return[];
  const duration=Math.max(1,Number(durationSeconds)||15);
  const transition=list.length>1?Math.max(0,Math.min(0.35,Number(transitionSeconds)||0)):0;
  const sceneDuration=(duration+(transition*(list.length-1)))/list.length;
  return list.map((file,index)=>{
    const start=index*(sceneDuration-transition);
    const end=Math.min(duration,start+sceneDuration);
    return{
      index,
      file,
      start:Number(start.toFixed(3)),
      end:Number(end.toFixed(3)),
      duration:Number((end-start).toFixed(3)),
      transition:index===0?null:'fade'
    };
  });
}
function buildShortStoryboard(assets,durationSeconds,transitionSeconds=0.18,targetSceneSeconds=3.2,maxScenes=7){
  const list=Array.isArray(assets)?assets.filter(Boolean):[];
  if(!list.length)return[];
  const duration=Math.max(1,Number(durationSeconds)||15);
  const transition=Math.max(0,Math.min(0.28,Number(transitionSeconds)||0));
  const target=Math.max(2.4,Math.min(4.2,Number(targetSceneSeconds)||3.2));
  const cap=Math.max(list.length,Math.min(8,Number(maxScenes)||7));
  const desired=Math.max(list.length,Math.ceil(duration/target));
  const count=Math.min(cap,desired);
  const sceneDuration=(duration+(transition*(count-1)))/count;
  const transitions=['fade','smoothleft','wipeleft','slideright','smoothright'];
  return Array.from({length:count},(_,index)=>{
    const assetIndex=index%list.length;
    const cycle=Math.floor(index/list.length);
    const start=index*(sceneDuration-transition);
    const end=Math.min(duration,start+sceneDuration);
    return{
      index,
      file:list[assetIndex],
      assetIndex,
      cycle,
      sourceOffset:Number((((cycle*1.6)+(assetIndex*0.7))%8).toFixed(3)),
      motionPhase:Number(((index%7)*0.85).toFixed(3)),
      start:Number(start.toFixed(3)),
      end:Number(end.toFixed(3)),
      duration:Number((end-start).toFixed(3)),
      transition:index===0?null:transitions[(index-1)%transitions.length]
    };
  });
}
function buildLongformStoryboard(assets,durationSeconds,transitionSeconds=0.35,targetSceneSeconds=25,maxScenes=28){
  const list=Array.isArray(assets)?assets.filter(Boolean):[];
  if(!list.length)return[];
  const duration=Math.max(1,Number(durationSeconds)||600);
  const transition=list.length>0?Math.max(0,Math.min(0.5,Number(transitionSeconds)||0)):0;
  const target=Math.max(18,Math.min(30,Number(targetSceneSeconds)||25));
  const cap=Math.max(list.length,Math.min(36,Number(maxScenes)||28));
  const desired=Math.max(list.length,Math.ceil(duration/target));
  const count=Math.min(cap,desired);
  const sceneDuration=(duration+(transition*(count-1)))/count;
  const transitions=['fade','smoothleft','wipeleft','slideright','smoothright'];

  const narrativeOrdered=list.length>=6;
  return Array.from({length:count},(_,index)=>{
    const assetIndex=narrativeOrdered
      ?Math.min(list.length-1,Math.floor((index*list.length)/count))
      :index%list.length;
    const firstIndex=narrativeOrdered
      ?Math.floor((assetIndex*count)/list.length)
      :assetIndex;
    const cycle=narrativeOrdered
      ?Math.max(0,index-firstIndex)
      :Math.floor(index/list.length);
    const start=index*(sceneDuration-transition);
    const end=Math.min(duration,start+sceneDuration);
    return{
      index,
      file:list[assetIndex],
      assetIndex,
      cycle,
      narrativeOrder:narrativeOrdered?'progressive':'cyclic',
      sourceOffset:Number((((cycle*7)+(assetIndex*3))%45).toFixed(3)),
      motionPhase:Number(((index%8)*0.7).toFixed(3)),
      start:Number(start.toFixed(3)),
      end:Number(end.toFixed(3)),
      duration:Number((end-start).toFixed(3)),
      transition:index===0?null:transitions[(index-1)%transitions.length]
    };
  });
}
function supportsSubtitles(ffmpeg){
  if(!ffmpeg)return false;
  try{
    const out=execFile(ffmpeg,['-hide_banner','-filters'],{timeout:10000,maxBuffer:1024*1024*8});
    return /\bsubtitles\b/.test(out);
  }catch(_){return false}
}
function ffmpegFilterPath(file){
  return path.resolve(file)
    .replace(/\\/g,'/')
    .replace(/:/g,'\\:')
    .replace(/'/g,"\\'");
}
function ffmpegStatus(workspace){
  const ffmpeg=commandPath('ffmpeg');
  const ffprobe=commandPath('ffprobe');
  return{
    ok:!!ffmpeg,
    version:ENGINE_VERSION,
    ffmpeg,
    ffprobe,
    assets:listAssets(workspace).length,
    assetDir:path.join(workspace,'creator-assets'),
    outputDir:path.join(workspace,'creator-video'),
    installable:process.platform==='win32'&&!!commandPath('winget')
  };
}
function prepare(workspace,{allowInstall=false}={}){
  let s=ffmpegStatus(workspace);
  if(s.ok||!allowInstall)return s;
  if(process.platform!=='win32')return s;
  const winget=commandPath('winget');
  if(!winget)return s;
  try{
    execFile(winget,[
      'install','--id','Gyan.FFmpeg','-e',
      '--accept-source-agreements','--accept-package-agreements',
      '--silent','--disable-interactivity'
    ],{timeout:10*60*1000,maxBuffer:1024*1024*16});
  }catch(_){}
  s=ffmpegStatus(workspace);
  return s;
}
function audioDurationSeconds(file,ffprobe){
  if(!ffprobe)return null;
  try{
    const out=execFile(ffprobe,[
      '-v','error',
      '-show_entries','format=duration',
      '-of','default=noprint_wrappers=1:nokey=1',
      file
    ],{timeout:15000}).trim();
    const n=Number(out);
    return Number.isFinite(n)&&n>0?n:null;
  }catch(_){return null}
}
function fitNarrationRatePercent(measuredSeconds,targetSeconds=600,currentRatePercent=-7){
  const measured=Number(measuredSeconds);
  const target=Number(targetSeconds);
  const current=Number(currentRatePercent);
  if(!Number.isFinite(measured)||measured<=0||!Number.isFinite(target)||target<=0||!Number.isFinite(current)){
    return Math.max(-30,Math.min(25,Number.isFinite(current)?current:-7));
  }
  const currentFactor=Math.max(0.5,1+(current/100));
  const desiredFactor=currentFactor*(measured/target);
  const next=(desiredFactor-1)*100;
  return Math.max(-30,Math.min(25,Math.round(next)));
}
function probeRenderedShort(file,ffprobe){
  if(!ffprobe)return{ok:false,code:'FFPROBE_MISSING',message:'Rendered Shorts kalite doğrulaması için FFprobe gerekli.'};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_OUTPUT_MISSING',message:'Rendered MP4 bulunamadı.'};
  try{
    const raw=execFile(ffprobe,[
      '-v','error',
      '-show_entries','stream=index,codec_type,codec_name,width,height,r_frame_rate:format=duration',
      '-of','json',
      file
    ],{timeout:20000,maxBuffer:1024*1024*2}).trim();
    const data=JSON.parse(raw||'{}');
    const streams=Array.isArray(data.streams)?data.streams:[];
    const video=streams.find(x=>x&&x.codec_type==='video');
    const audio=streams.find(x=>x&&x.codec_type==='audio');
    const duration=Number(data&&data.format&&data.format.duration);
    const rate=String(video&&video.r_frame_rate||'0/1').split('/');
    const fpsDen=Number(rate[1]||1),fpsNum=Number(rate[0]||0);
    const fps=fpsDen?fpsNum/fpsDen:0;
    const checks={
      video:!!video,
      audio:!!audio,
      codec:String(video&&video.codec_name||'').toLowerCase()==='h264',
      width:Number(video&&video.width)===1080,
      height:Number(video&&video.height)===1920,
      fps:Number.isFinite(fps)&&Math.abs(fps-30)<=0.05,
      duration:Number.isFinite(duration)&&duration>=11.8&&duration<=18.8
    };
    const ok=Object.values(checks).every(Boolean);
    return{
      ok,
      code:ok?'CREATOR_QUALITY_PASS':'CREATOR_QUALITY_FAILED',
      checks,
      measured:{
        videoCodec:String(video&&video.codec_name||''),
        audioCodec:String(audio&&audio.codec_name||''),
        width:Number(video&&video.width||0),
        height:Number(video&&video.height||0),
        fps:Number(Number(fps||0).toFixed(3)),
        duration:Number(Number(duration||0).toFixed(3))
      },
      message:ok?'Creator Shorts kalite kapısı geçti.':'Creator Shorts teknik kalite kapısı başarısız.'
    };
  }catch(e){
    return{ok:false,code:'CREATOR_QUALITY_PROBE_FAILED',message:String(e.message||e).slice(0,500)};
  }
}
function probeRenderedLongform(file,ffprobe){
  if(!ffprobe)return{ok:false,code:'FFPROBE_MISSING',message:'Long-form kalite doğrulaması için FFprobe gerekli.'};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_LONGFORM_OUTPUT_MISSING',message:'Long-form MP4 bulunamadı.'};
  try{
    const raw=execFile(ffprobe,[
      '-v','error',
      '-show_entries','stream=index,codec_type,codec_name,width,height,r_frame_rate:format=duration,size,format_name',
      '-of','json',
      file
    ],{timeout:30000,maxBuffer:1024*1024*2}).trim();
    const data=JSON.parse(raw||'{}');
    const streams=Array.isArray(data.streams)?data.streams:[];
    const video=streams.find(x=>x&&x.codec_type==='video');
    const audio=streams.find(x=>x&&x.codec_type==='audio');
    const format=data&&data.format||{};
    const duration=Number(format.duration);
    const declaredSize=Number(format.size);
    const actualSize=Number(fs.statSync(file).size||0);
    const rate=String(video&&video.r_frame_rate||'0/1').split('/');
    const fpsDen=Number(rate[1]||1),fpsNum=Number(rate[0]||0);
    const fps=fpsDen?fpsNum/fpsDen:0;
    const checks={
      video:!!video,
      audio:!!audio,
      codec:String(video&&video.codec_name||'').toLowerCase()==='h264',
      width:Number(video&&video.width)===1920,
      height:Number(video&&video.height)===1080,
      fps:Number.isFinite(fps)&&Math.abs(fps-30)<=0.05,
      duration:Number.isFinite(duration)&&duration>=540&&duration<=660,
      container:String(format.format_name||'').toLowerCase().split(',').includes('mp4'),
      size:Number.isFinite(actualSize)&&actualSize>=1024*1024&&(!Number.isFinite(declaredSize)||Math.abs(declaredSize-actualSize)<=16)
    };
    const ok=Object.values(checks).every(Boolean);
    return{
      ok,
      code:ok?'CREATOR_LONGFORM_QUALITY_PASS':'CREATOR_LONGFORM_QUALITY_FAILED',
      checks,
      measured:{
        videoCodec:String(video&&video.codec_name||''),
        audioCodec:String(audio&&audio.codec_name||''),
        width:Number(video&&video.width||0),
        height:Number(video&&video.height||0),
        fps:Number(Number(fps||0).toFixed(3)),
        duration:Number(Number(duration||0).toFixed(3)),
        bytes:actualSize,
        container:String(format.format_name||'')
      },
      message:ok?'Creator long-form kalite kapısı geçti.':'Creator long-form teknik kalite kapısı başarısız.'
    };
  }catch(e){
    return{ok:false,code:'CREATOR_LONGFORM_QUALITY_PROBE_FAILED',message:String(e.message||e).slice(0,500)};
  }
}

function splitCaptionSegments(text){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];
  const sentences=clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out=[];
  for(const sentence of sentences){
    const words=sentence.split(/\s+/).filter(Boolean);
    for(let i=0;i<words.length;i+=7)out.push(words.slice(i,i+7).join(' '));
  }
  return out.length?out:[clean];
}
function srtTime(seconds){
  const ms=Math.max(0,Math.round(Number(seconds||0)*1000));
  const h=Math.floor(ms/3600000);
  const m=Math.floor((ms%3600000)/60000);
  const s=Math.floor((ms%60000)/1000);
  const z=ms%1000;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(z).padStart(3,'0');
}
function buildSrt(text,durationSeconds=15){
  const parts=splitCaptionSegments(text);
  const duration=Math.max(1,Number(durationSeconds)||15);
  if(!parts.length)return'';
  const weights=parts.map(x=>Math.max(1,x.split(/\s+/).length));
  const total=weights.reduce((a,b)=>a+b,0);
  let cursor=0;
  const lines=[];
  parts.forEach((part,i)=>{
    const slice=duration*(weights[i]/total);
    const start=cursor;
    const end=i===parts.length-1?duration:Math.min(duration,cursor+slice);
    cursor=end;
    lines.push(String(i+1));
    lines.push(srtTime(start)+' --> '+srtTime(end));
    lines.push(part);
    lines.push('');
  });
  return lines.join('\n');
}
function renderShort({workspace,name,script,voicePath,assetFiles=[],missionId='',assetHashes=[]}){
  if(!workspace)throw new Error('workspace required');
  if(!voicePath||!fs.existsSync(voicePath))throw new Error('creator voice file missing');
  const status=ffmpegStatus(workspace);
  if(!status.ok){
    const e=new Error('FFmpeg bulunamadı. Önce "creator motorunu hazırla" komutunu çalıştır.');
    e.code='FFMPEG_MISSING';
    throw e;
  }

  const cleanScript=String(script||'').replace(/\s+/g,' ').trim();
  if(!cleanScript)throw new Error('script required');

  const dirs=creatorDirs(workspace);
  const base=safeName(name);
  const jobDir=ensureDir(path.join(dirs.jobs,base));
  const outFile=path.join(dirs.output,base+'.mp4');
  const srtFile=path.join(jobDir,base+'.srt');
  const metaFile=path.join(jobDir,'job.json');

  const measured=audioDurationSeconds(voicePath,status.ffprobe);
  if(measured&&measured>19.5){
    const e=new Error('Anlatım '+measured.toFixed(1)+' sn; Shorts hedefi için metni kısaltmak gerekiyor.');
    e.code='VOICE_TOO_LONG';
    e.duration=measured;
    throw e;
  }
  const duration=measured?Math.max(12,Math.min(18.5,measured+0.35)):18;
  const explicitAssets=Array.isArray(assetFiles)&&assetFiles.length>0;
  const assets=explicitAssets?resolveAssetSelection(workspace,assetFiles,5):selectAssets(workspace,base,5);
  const transition=assets.length?0.18:0;
  const storyboard=buildShortStoryboard(assets,duration,transition,3.2,7);
  const maxSceneDuration=storyboard.length?Math.max(...storyboard.map(x=>Number(x.duration||0))):0;
  const visualEdit={
    ok:!assets.length||(storyboard.length>=Math.min(4,Math.ceil(duration/4.2))&&maxSceneDuration<=4.5),
    sceneCount:storyboard.length,
    distinctAssets:assets.length,
    averageSceneSeconds:storyboard.length?Number((duration/storyboard.length).toFixed(3)):0,
    maxSceneSeconds:Number(maxSceneDuration.toFixed(3)),
    transitions:[...new Set(storyboard.map(x=>x.transition).filter(Boolean))],
    motion:assets.length?'dynamic-pan-crop':'procedural'
  };
  if(assets.length&&!visualEdit.ok){
    const e=new Error('Creator Shorts edit rhythm quality gate failed.');
    e.code='CREATOR_SHORT_EDIT_RHYTHM_FAILED';
    e.visualEdit=visualEdit;
    throw e;
  }
  const captionsBurned=supportsSubtitles(status.ffmpeg);

  fs.writeFileSync(srtFile,buildSrt(cleanScript,duration),'utf8');

  let args=[];
  if(assets.length){
    args=['-y','-hide_banner','-loglevel','error'];
    for(const scene of storyboard)args.push('-stream_loop','-1','-i',scene.file);
    args.push('-i',voicePath);

    const filters=[];
    storyboard.forEach((scene,i)=>{
      const phase=Number(scene.motionPhase||0).toFixed(3);
      filters.push(
        '['+i+':v]'+
        'trim=start='+Number(scene.sourceOffset||0).toFixed(3)+':duration='+scene.duration.toFixed(3)+','+
        'setpts=PTS-STARTPTS,'+
        'scale=1180:2100:force_original_aspect_ratio=increase,'+
        "crop=1080:1920:x='(in_w-out_w)/2+35*sin(t*1.15+"+phase+")':y='(in_h-out_h)/2+55*cos(t*0.85+"+phase+")',"+
        'fps=30,setsar=1,'+
        'format=yuv420p[v'+i+']'
      );
    });

    let videoLabel='v0';
    if(storyboard.length>1){
      for(let i=1;i<storyboard.length;i++){
        const out='vx'+i;
        const offset=Number(storyboard[i].start||0).toFixed(3);
        const transitionName=String(storyboard[i].transition||'fade');
        filters.push('['+videoLabel+'][v'+i+']xfade=transition='+transitionName+':duration='+transition.toFixed(3)+':offset='+offset+'['+out+']');
        videoLabel=out;
      }
    }

    if(captionsBurned){
      const subtitlePath=ffmpegFilterPath(srtFile);
      filters.push(
        '['+videoLabel+']subtitles=filename=\''+subtitlePath+'\':'+
        "force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=105'"+
        '[vout]'
      );
      videoLabel='vout';
    }

    args.push(
      '-t',duration.toFixed(3),
      '-filter_complex',filters.join(';'),
      '-map','['+videoLabel+']',
      '-map',String(storyboard.length)+':a:0',
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k','-af','apad=pad_dur=1',
      '-movflags','+faststart',
      outFile
    );
  }else{
    const graph='color=c=0x030712:s=1080x1920:r=30:d='+duration.toFixed(3)+',noise=alls=8:allf=t+u';
    args=[
      '-y','-hide_banner','-loglevel','error',
      '-f','lavfi','-i',graph,
      '-i',voicePath,
      '-t',duration.toFixed(3)
    ];
    if(captionsBurned){
      args.push(
        '-vf',"subtitles=filename='"+ffmpegFilterPath(srtFile)+"':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=105'"
      );
    }
    args.push(
      '-map','0:v:0','-map','1:a:0',
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k','-af','apad=pad_dur=1',
      '-movflags','+faststart',
      outFile
    );
  }

  try{
    execFile(status.ffmpeg,args,{timeout:8*60*1000,maxBuffer:1024*1024*32});
  }catch(err){
    const message=String((err&&err.stderr)||err.message||err).slice(-3000);
    throw new Error('FFmpeg render başarısız: '+message);
  }

  if(!fs.existsSync(outFile)||fs.statSync(outFile).size<10000)throw new Error('Rendered MP4 verification failed');
  const quality=probeRenderedShort(outFile,status.ffprobe);
  if(!quality.ok){
    const e=new Error(String(quality.message||'Creator Shorts quality gate failed')+' · '+String(quality.code||'CREATOR_QUALITY_FAILED'));
    e.code=String(quality.code||'CREATOR_QUALITY_FAILED');
    e.quality=quality;
    throw e;
  }

  const meta={
    engine:'JARVIS_CREATOR_ENGINE',
    version:ENGINE_VERSION,
    profileVersion:CREATOR_PROFILE_VERSION,
    createdAt:new Date().toISOString(),
    missionId:String(missionId||'').trim().slice(0,100)||null,
    name:base,
    script:cleanScript,
    assetSelection:explicitAssets?'explicit':'automatic',
    sourceAssetHashes:Array.isArray(assetHashes)?assetHashes.map(x=>String(x||'').slice(0,64)).filter(Boolean).slice(0,5):[],
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:assets[0]?path.relative(workspace,assets[0]):null,
    sourceAssets:assets.map(x=>path.relative(workspace,x)),
    storyboard:storyboard.map(x=>({...x,file:path.relative(workspace,x.file)})),
    captionsBurned,
    quality,
    visualEdit,
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    profile:{width:1080,height:1920,fps:30,codec:'H.264',audio:'AAC',durationTarget:'12-18s',multiScene:true,transition:'varied',sceneTarget:'2.5-4s',motion:'dynamic-pan-crop'}
  };
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),'utf8');

  return{
    ok:true,
    message:'Shorts videosu hazır: '+outFile+' · 1080x1920 · 30 FPS · H.264 · '+(assets.length?(storyboard.length+' sahne / '+assets.length+' klip · hareketli kurgu'):'procedural hareketli arka plan')+(captionsBurned?' · altyazı videoya işlendi':' · altyazı ayrı SRT'),
    output:outFile,
    subtitle:srtFile,
    metadata:metaFile,
    asset:assets[0]||null,
    assets,
    storyboard,
    sceneCount:storyboard.length,
    captionsBurned,
    duration,
    quality,
    visualEdit,
    profileVersion:CREATOR_PROFILE_VERSION
  };
}

function renderLongform({workspace,name,script,voicePath,assetFiles=[],missionId='',assetHashes=[]}){
  if(!workspace)throw new Error('workspace required');
  if(!voicePath||!fs.existsSync(voicePath))throw new Error('creator long-form voice file missing');
  const status=ffmpegStatus(workspace);
  if(!status.ok||!status.ffprobe){
    const e=new Error('Long-form Creator için FFmpeg + FFprobe gerekli.');
    e.code=!status.ok?'FFMPEG_MISSING':'FFPROBE_MISSING';
    throw e;
  }

  const cleanScript=String(script||'').replace(/\s+/g,' ').trim();
  if(!cleanScript)throw new Error('script required');

  const measured=audioDurationSeconds(voicePath,status.ffprobe);
  if(!measured||measured<539.5||measured>659.5){
    const e=new Error('Long-form anlatım süresi 9-11 dakika aralığında olmalı; ölçülen '+Number(measured||0).toFixed(1)+' sn.');
    e.code='LONGFORM_VOICE_DURATION_OUT_OF_RANGE';
    e.duration=measured||0;
    throw e;
  }
  const duration=Math.max(540,Math.min(660,measured+0.35));
  const dirs=creatorDirs(workspace);
  const base=safeName(name);
  const jobDir=ensureDir(path.join(dirs.jobs,base));
  const outFile=path.join(dirs.output,base+'.mp4');
  const srtFile=path.join(jobDir,base+'.srt');
  const metaFile=path.join(jobDir,'job.json');

  const explicitAssets=Array.isArray(assetFiles)&&assetFiles.length>0;
  const assets=explicitAssets?resolveAssetSelection(workspace,assetFiles,20):selectAssets(workspace,base,12);
  const transition=assets.length>0?0.35:0;
  const storyboard=buildLongformStoryboard(assets,duration,transition,25,28);
  const maxSceneDuration=storyboard.length?Math.max(...storyboard.map(x=>Number(x.duration||0))):0;
  const visualEdit={
    ok:!assets.length||(storyboard.length>=Math.ceil(duration/30)&&maxSceneDuration<=30.5),
    sceneCount:storyboard.length,
    distinctAssets:assets.length,
    averageSceneSeconds:storyboard.length?Number((duration/storyboard.length).toFixed(3)):0,
    maxSceneSeconds:Number(maxSceneDuration.toFixed(3)),
    transitions:[...new Set(storyboard.map(x=>x.transition).filter(Boolean))],
    motion:assets.length?'subtle-pan-crop':'procedural',
    narrativeAssetOrder:assets.length>=6?'progressive':'cyclic'
  };
  if(assets.length&&!visualEdit.ok){
    const e=new Error('Creator long-form edit rhythm quality gate failed.');
    e.code='CREATOR_LONGFORM_EDIT_RHYTHM_FAILED';
    e.visualEdit=visualEdit;
    throw e;
  }
  const captionsBurned=supportsSubtitles(status.ffmpeg);
  fs.writeFileSync(srtFile,buildSrt(cleanScript,duration),'utf8');

  let args=[];
  if(assets.length){
    args=['-y','-hide_banner','-loglevel','error'];
    for(const scene of storyboard)args.push('-stream_loop','-1','-i',scene.file);
    args.push('-i',voicePath);

    const filters=[];
    storyboard.forEach((scene,i)=>{
      const phase=Number(scene.motionPhase||0).toFixed(3);
      filters.push(
        '['+i+':v]'+
        'trim=start='+Number(scene.sourceOffset||0).toFixed(3)+':duration='+scene.duration.toFixed(3)+','+
        'setpts=PTS-STARTPTS,'+
        'scale=2048:1152:force_original_aspect_ratio=increase,'+
        "crop=1920:1080:x='(in_w-out_w)/2+40*sin(t/3+"+phase+")':y='(in_h-out_h)/2+22*cos(t/4+"+phase+")',"+
        'fps=30,setsar=1,'+
        'format=yuv420p[v'+i+']'
      );
    });

    let videoLabel='v0';
    if(storyboard.length>1){
      for(let i=1;i<storyboard.length;i++){
        const out='lx'+i;
        const offset=Number(storyboard[i].start||0).toFixed(3);
        const transitionName=String(storyboard[i].transition||'fade');
        filters.push('['+videoLabel+'][v'+i+']xfade=transition='+transitionName+':duration='+transition.toFixed(3)+':offset='+offset+'['+out+']');
        videoLabel=out;
      }
    }

    if(captionsBurned){
      const subtitlePath=ffmpegFilterPath(srtFile);
      filters.push(
        '['+videoLabel+']subtitles=filename=\''+subtitlePath+'\':'+
        "force_style='FontName=Arial,FontSize=26,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=62'"+
        '[lvout]'
      );
      videoLabel='lvout';
    }

    args.push(
      '-t',duration.toFixed(3),
      '-filter_complex',filters.join(';'),
      '-map','['+videoLabel+']',
      '-map',String(storyboard.length)+':a:0',
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','192k','-af','apad=pad_dur=1',
      '-movflags','+faststart',
      outFile
    );
  }else{
    const graph='color=c=0x030712:s=1920x1080:r=30:d='+duration.toFixed(3)+',noise=alls=7:allf=t+u';
    args=[
      '-y','-hide_banner','-loglevel','error',
      '-f','lavfi','-i',graph,
      '-i',voicePath,
      '-t',duration.toFixed(3)
    ];
    if(captionsBurned){
      args.push(
        '-vf',"subtitles=filename='"+ffmpegFilterPath(srtFile)+"':force_style='FontName=Arial,FontSize=26,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=62'"
      );
    }
    args.push(
      '-map','0:v:0','-map','1:a:0',
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','192k','-af','apad=pad_dur=1',
      '-movflags','+faststart',
      outFile
    );
  }

  try{
    execFile(status.ffmpeg,args,{timeout:45*60*1000,maxBuffer:1024*1024*48});
  }catch(err){
    const message=String((err&&err.stderr)||err.message||err).slice(-4000);
    throw new Error('FFmpeg long-form render başarısız: '+message);
  }

  if(!fs.existsSync(outFile)||fs.statSync(outFile).size<1024*1024)throw new Error('Rendered long-form MP4 verification failed');
  const quality=probeRenderedLongform(outFile,status.ffprobe);
  if(!quality.ok){
    const e=new Error(String(quality.message||'Creator long-form quality gate failed')+' · '+String(quality.code||'CREATOR_LONGFORM_QUALITY_FAILED'));
    e.code=String(quality.code||'CREATOR_LONGFORM_QUALITY_FAILED');
    e.quality=quality;
    throw e;
  }

  const meta={
    engine:'JARVIS_CREATOR_ENGINE',
    version:ENGINE_VERSION,
    profileVersion:CREATOR_PROFILE_VERSION,
    mode:'longform',
    createdAt:new Date().toISOString(),
    missionId:String(missionId||'').trim().slice(0,100)||null,
    name:base,
    script:cleanScript,
    assetSelection:explicitAssets?'explicit':'automatic',
    sourceAssetHashes:Array.isArray(assetHashes)?assetHashes.map(x=>String(x||'').slice(0,64)).filter(Boolean).slice(0,20):[],
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:assets[0]?path.relative(workspace,assets[0]):null,
    sourceAssets:assets.map(x=>path.relative(workspace,x)),
    storyboard:storyboard.map(x=>({...x,file:path.relative(workspace,x.file)})),
    captionsBurned,
    quality,
    visualEdit,
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    profile:{width:1920,height:1080,fps:30,codec:'H.264',audio:'AAC',durationTarget:'9-11m',multiScene:true,transition:'varied',sceneTarget:'20-30s',motion:'subtle-pan-crop',narrativeAssetOrder:assets.length>=6?'progressive':'cyclic'}
  };
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),'utf8');

  return{
    ok:true,
    message:'Long-form video hazır: '+outFile+' · 1920x1080 · 30 FPS · H.264 · '+Number(duration/60).toFixed(1)+' dk · '+(assets.length?(storyboard.length+' sahne / '+assets.length+' klip'):'procedural hareketli arka plan')+(captionsBurned?' · altyazı videoya işlendi':' · altyazı ayrı SRT'),
    output:outFile,
    subtitle:srtFile,
    metadata:metaFile,
    asset:assets[0]||null,
    assets,
    storyboard,
    sceneCount:storyboard.length,
    captionsBurned,
    duration,
    quality,
    visualEdit,
    profileVersion:CREATOR_PROFILE_VERSION
  };
}

module.exports={
  ENGINE_VERSION,
  CREATOR_PROFILE_VERSION,
  safeName,
  ffmpegStatus,
  prepare,
  buildSrt,
  selectAssets,
  buildStoryboard,
  buildShortStoryboard,
  buildLongformStoryboard,
  supportsSubtitles,
  ffmpegFilterPath,
  renderShort,
  renderLongform,
  fitNarrationRatePercent,
  probeRenderedShort,
  probeRenderedLongform,
  listAssets,
  resolveAssetSelection,
  inspectAsset,
  assetSafeName,
  assetDestinationName,
  animateStillAsset,
  CREATOR_ASSET_EXTENSIONS,
  CREATOR_IMAGE_EXTENSIONS
};
