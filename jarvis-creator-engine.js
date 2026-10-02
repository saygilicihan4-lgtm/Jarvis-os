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
    jobs:ensureDir(path.join(workspace,'creator-jobs')),
    thumbnails:ensureDir(path.join(workspace,'creator-thumbnails'))
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
function thumbnailTitleLines(text,{maxChars=28,maxLines=3}={}){
  const words=String(text||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(!words.length)return[];
  const limit=Math.max(12,Math.min(42,Number(maxChars)||28));
  const lineLimit=Math.max(1,Math.min(4,Number(maxLines)||3));
  const lines=[];
  let current='';
  for(const word of words){
    const next=current?(current+' '+word):word;
    if(current&&next.length>limit){
      lines.push(current);
      current=word;
      if(lines.length>=lineLimit)break;
    }else current=next;
  }
  if(lines.length<lineLimit&&current)lines.push(current);
  return lines.slice(0,lineLimit);
}
function createThumbnail(workspace,videoFile,{title='',name='',missionId='',frameAt=1.2}={}){
  const root=path.resolve(String(workspace||''));
  const raw=String(videoFile||'').trim();
  if(!raw)throw new Error('CREATOR_THUMBNAIL_VIDEO_REQUIRED');
  let rel=raw;
  if(path.isAbsolute(raw)){
    const full=path.resolve(raw);
    const relative=path.relative(root,full);
    if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error('CREATOR_THUMBNAIL_OUTSIDE_WORKSPACE');
    rel=relative.replace(/\\/g,'/');
  }
  const info=safeWorkspaceVideo(workspace,rel);
  const status=ffmpegStatus(workspace);
  if(!status.ok||!status.ffprobe){
    const e=new Error('Creator thumbnail requires FFmpeg + FFprobe');
    e.code=!status.ok?'FFMPEG_MISSING':'FFPROBE_MISSING';
    throw e;
  }
  const dirs=creatorDirs(workspace);
  const base=safeName(name||missionId||title||path.basename(info.full,path.extname(info.full)));
  const outFile=path.join(dirs.thumbnails,base+'.jpg');
  const textFile=path.join(dirs.thumbnails,base+'.title.txt');
  const lines=thumbnailTitleLines(title,{maxChars:28,maxLines:3});
  const titleText=lines.join('\n').slice(0,180);
  fs.writeFileSync(textFile,titleText,'utf8');
  const at=Math.max(0,Math.min(30,Number(frameAt)||1.2));
  const baseFilter='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=contrast=1.06:saturation=1.10';
  const draw=titleText
    ?baseFilter+",drawbox=x=0:y=400:w=1280:h=320:color=black@0.58:t=fill,drawtext=textfile='"+ffmpegFilterPath(textFile)+"':fontcolor=white:fontsize=62:borderw=3:bordercolor=black@0.9:x=64:y=448:line_spacing=12"
    :baseFilter;
  let titleBurned=!!titleText;
  const run=(filter)=>execFile(status.ffmpeg,[
    '-y','-hide_banner','-loglevel','error',
    '-ss',at.toFixed(3),'-i',info.full,
    '-frames:v','1','-vf',filter,'-q:v','2',outFile
  ],{timeout:90000,maxBuffer:1024*1024*12});
  try{
    run(draw);
  }catch(_){
    titleBurned=false;
    run(baseFilter);
  }finally{
    try{if(fs.existsSync(textFile))fs.unlinkSync(textFile)}catch(_){}
  }
  if(!fs.existsSync(outFile)||!fs.statSync(outFile).isFile()||fs.statSync(outFile).size<5000)throw new Error('CREATOR_THUMBNAIL_OUTPUT_INVALID');
  let width=0,height=0;
  try{
    const rawProbe=execFile(status.ffprobe,[
      '-v','error','-select_streams','v:0',
      '-show_entries','stream=width,height','-of','json',outFile
    ],{timeout:15000,maxBuffer:1024*1024}).trim();
    const data=JSON.parse(rawProbe||'{}');
    const stream=Array.isArray(data.streams)&&data.streams[0]?data.streams[0]:{};
    width=Number(stream.width||0);height=Number(stream.height||0);
  }catch(_){}
  if(width!==1280||height!==720)throw new Error('CREATOR_THUMBNAIL_DIMENSIONS_INVALID');
  return{
    ok:true,
    path:path.relative(root,outFile).replace(/\\/g,'/'),
    fullPath:outFile,
    width,height,
    bytes:Number(fs.statSync(outFile).size||0),
    frameAt:Number(at.toFixed(3)),
    titleBurned,
    missionId:String(missionId||'').slice(0,100)||null
  };
}

function assetSafeName(relativePath){
  const input=String(relativePath||'');
  const originalExt=path.extname(input);
  const ext=originalExt.toLowerCase();
  const stem=path.basename(input,originalExt);
  return safeName(stem)+ext;
}
function creatorAssetResolutionQuality(width,height,{minShortSide=432,minLongSide=640}={}){
  const w=Number(width),h=Number(height);
  const shortSide=Math.min(w,h),longSide=Math.max(w,h);
  const minShort=Math.max(240,Number(minShortSide)||432);
  const minLong=Math.max(minShort,Number(minLongSide)||640);
  const ok=Number.isFinite(shortSide)&&Number.isFinite(longSide)&&shortSide>=minShort&&longSide>=minLong;
  const preferred=ok&&shortSide>=540&&longSide>=960;
  return{
    ok,
    preferred,
    width:Number.isFinite(w)?w:0,
    height:Number.isFinite(h)?h:0,
    shortSide:Number.isFinite(shortSide)?shortSide:0,
    longSide:Number.isFinite(longSide)?longSide:0,
    minShortSide:minShort,
    minLongSide:minLong,
    tier:preferred?'preferred':(ok?'acceptable':'low')
  };
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
    const resolution=creatorAssetResolutionQuality(width,height);
    return{
      ok:true,
      file:info.rel,
      bytes:info.bytes,
      duration:Number(duration.toFixed(3)),
      width,
      height,
      codec:String(stream.codec_name||'').slice(0,40),
      resolution
    };
  }catch(e){
    return{ok:false,code:'CREATOR_ASSET_PROBE_FAILED',file:info.rel,message:String(e.message||e).slice(0,400)};
  }
}
function preflightAssetSelection(workspace,files,{maxScenes=24}={}){
  const rows=Array.isArray(files)?files.filter(Boolean):[];
  const accepted=[],rejected=[];
  const cap=Math.max(1,Math.min(24,Number(maxScenes)||24));
  for(const file of rows){
    if(accepted.length>=cap)break;
    const rel=path.relative(workspace,String(file||'')).replace(/\\/g,'/');
    const probe=inspectAsset(workspace,rel);
    if(probe.ok&&probe.resolution&&probe.resolution.ok){
      accepted.push(path.resolve(workspace,probe.file));
    }else{
      rejected.push({
        file:rel,
        code:String(probe.code||'CREATOR_ASSET_RESOLUTION_LOW'),
        width:Number(probe.width||0),
        height:Number(probe.height||0),
        resolution:probe.resolution||null
      });
    }
  }
  return{
    assets:accepted,
    evidence:{
      candidates:rows.length,
      accepted:accepted.length,
      rejected:rejected.length,
      minShortSide:432,
      minLongSide:640,
      rejectedAssets:rejected.slice(0,24)
    }
  };
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
function buildShortStoryboard(assets,durationSeconds,transitionSeconds=0.18,targetSceneSeconds=3.2,maxScenes=7,hookSceneSeconds=0.9){
  const list=Array.isArray(assets)?assets.filter(Boolean):[];
  if(!list.length)return[];
  const duration=Math.max(1,Number(durationSeconds)||15);
  const transition=Math.max(0,Math.min(0.28,Number(transitionSeconds)||0));
  const target=Math.max(2.4,Math.min(4.2,Number(targetSceneSeconds)||3.2));
  const cap=Math.max(list.length,Math.min(8,Number(maxScenes)||7));
  const desired=Math.max(list.length,Math.ceil(duration/target));
  const count=Math.max(2,Math.min(cap,desired));
  const hook=Math.max(0.75,Math.min(1.05,Number(hookSceneSeconds)||0.9));
  const totalSceneSeconds=duration+(transition*(count-1));
  const regularSceneSeconds=Math.max(2.2,(totalSceneSeconds-hook)/Math.max(1,count-1));
  const transitions=['fade','smoothleft','wipeleft','slideright','smoothright'];
  let cursor=0;
  return Array.from({length:count},(_,index)=>{
    const assetIndex=index%list.length;
    const cycle=Math.floor(index/list.length);
    const start=index===0?0:Math.max(0,cursor-transition);
    const planned=index===0?hook:regularSceneSeconds;
    const end=index===count-1?duration:Math.min(duration,start+planned);
    cursor=end;
    return{
      index,
      file:list[assetIndex],
      assetIndex,
      cycle,
      hook:index===0,
      sourceOffset:Number((((cycle*1.6)+(assetIndex*0.7))%8).toFixed(3)),
      motionPhase:Number(((index%7)*0.85).toFixed(3)),
      start:Number(start.toFixed(3)),
      end:Number(end.toFixed(3)),
      duration:Number((end-start).toFixed(3)),
      transition:index===0?null:transitions[(index-1)%transitions.length]
    };
  });
}
function buildShortSfxEvents(storyboard,durationSeconds,maxEvents=5){
  const duration=Math.max(1,Number(durationSeconds)||15);
  const scenes=Array.isArray(storyboard)?storyboard:[];
  const limit=Math.max(1,Math.min(6,Number(maxEvents)||5));
  const events=[];
  if(scenes.length){
    events.push({kind:'impact',time:0.03,level:0.05});
    for(const scene of scenes.slice(1)){
      const time=Number(scene&&scene.start);
      if(!Number.isFinite(time)||time<0.35||time>duration-0.18)continue;
      events.push({kind:'whoosh',time:Number(time.toFixed(3)),level:0.018});
      if(events.length>=limit)break;
    }
  }
  return events.slice(0,limit);
}
function renderShortSfxBed(ffmpeg,jobDir,storyboard,durationSeconds){
  if(!ffmpeg)return null;
  const duration=Math.max(1,Number(durationSeconds)||15);
  const events=buildShortSfxEvents(storyboard,duration,5);
  if(!events.length)return null;
  const outFile=path.join(jobDir,'short-sfx.wav');
  const args=['-y','-hide_banner','-loglevel','error',
    '-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d='+duration.toFixed(3)
  ];
  const filters=['[0:a]volume=0[base]'];
  const labels=['[base]'];
  let inputIndex=1;
  events.forEach((event,index)=>{
    const ms=Math.max(0,Math.round(Number(event.time||0)*1000));
    const label='fx'+index;
    if(event.kind==='impact'){
      args.push('-f','lavfi','-i','sine=frequency=118:sample_rate=48000:duration=0.20');
      filters.push(
        '['+inputIndex+':a]volume='+Number(event.level||0.05).toFixed(3)+
        ',lowpass=f=900,afade=t=out:st=0.04:d=0.16,'+
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,'+
        'adelay='+ms+'|'+ms+'['+label+']'
      );
    }else{
      args.push('-f','lavfi','-i','anoisesrc=color=pink:sample_rate=48000:duration=0.24');
      filters.push(
        '['+inputIndex+':a]highpass=f=650,lowpass=f=4200,'+
        'volume='+Number(event.level||0.018).toFixed(3)+
        ',afade=t=in:st=0:d=0.03,afade=t=out:st=0.08:d=0.16,'+
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,'+
        'adelay='+ms+'|'+ms+'['+label+']'
      );
    }
    labels.push('['+label+']');
    inputIndex++;
  });
  filters.push(labels.join('')+'amix=inputs='+labels.length+':duration=longest:normalize=0,alimiter=limit=0.45[sfx]');
  args.push(
    '-filter_complex',filters.join(';'),
    '-map','[sfx]','-t',duration.toFixed(3),
    '-c:a','pcm_s16le',outFile
  );
  execFile(ffmpeg,args,{timeout:60000,maxBuffer:1024*1024*8});
  if(!fs.existsSync(outFile)||fs.statSync(outFile).size<1024)throw new Error('CREATOR_SHORT_SFX_OUTPUT_INVALID');
  return{file:outFile,events,count:events.length,profile:'procedural-impact-whoosh',maxEvents:5};
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
function probeNarrationActivity(file,ffmpeg,{minMeanDb=-85,minPeakDb=-80}={}){
  const thresholds={
    meanDb:Number.isFinite(Number(minMeanDb))?Number(minMeanDb):-85,
    maxDb:Number.isFinite(Number(minPeakDb))?Number(minPeakDb):-80
  };
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',meanDb:null,maxDb:null,thresholds};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_NARRATION_MISSING',meanDb:null,maxDb:null,thresholds};
  try{
    const run=childProcess.spawnSync(ffmpeg,[
      '-hide_banner','-nostats','-i',file,
      '-map','0:a:0',
      '-af','volumedetect',
      '-f','null','-'
    ],{
      encoding:'utf8',
      windowsHide:true,
      timeout:45000,
      maxBuffer:1024*1024*4
    });
    if(run.error||run.status!==0){
      return{
        ok:false,
        code:'CREATOR_NARRATION_PROBE_FAILED',
        meanDb:null,
        maxDb:null,
        detail:String((run.error&&run.error.message)||run.stderr||'').slice(-400),
        thresholds
      };
    }
    const text=String(run.stderr||'');
    const meanMatch=/mean_volume:\s*(-?inf|-?[0-9]+(?:\.[0-9]+)?)\s*dB/i.exec(text);
    const maxMatch=/max_volume:\s*(-?inf|-?[0-9]+(?:\.[0-9]+)?)\s*dB/i.exec(text);
    const parse=(match)=>{
      if(!match)return null;
      if(/inf/i.test(match[1]))return -Infinity;
      const n=Number(match[1]);
      return Number.isFinite(n)?n:null;
    };
    const meanDb=parse(meanMatch);
    const maxDb=parse(maxMatch);
    // Reject digital silence/noise-floor-only files while still allowing very
    // quiet but recoverable narration to proceed into the loudness master.
    const ok=Number.isFinite(maxDb)&&Number.isFinite(meanDb)&&maxDb>thresholds.maxDb&&meanDb>thresholds.meanDb;
    return{
      ok,
      code:ok?'CREATOR_NARRATION_ACTIVITY_PASS':'CREATOR_NARRATION_SILENT',
      meanDb,
      maxDb,
      thresholds,
      method:'ffmpeg-volumedetect'
    };
  }catch(e){
    return{ok:false,code:'CREATOR_NARRATION_PROBE_FAILED',meanDb:null,maxDb:null,detail:String(e.message||e).slice(0,400),thresholds};
  }
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
function probeHookMotion(file,ffmpeg,{start=0,seconds=0.95,fps=8}={}){
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',start:Number(start)||0};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_HOOK_ASSET_MISSING',start:Number(start)||0};
  const at=Math.max(0,Number(start)||0);
  const span=Math.max(0.6,Math.min(1.2,Number(seconds)||0.95));
  const rate=Math.max(4,Math.min(12,Math.round(Number(fps)||8)));
  try{
    const raw=execFile(ffmpeg,[
      '-hide_banner','-loglevel','error',
      '-ss',at.toFixed(3),'-i',file,
      '-t',span.toFixed(3),
      '-an',
      '-vf','fps='+rate+',scale=64:64:flags=area,format=gray,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-',
      '-f','null','-'
    ],{timeout:20000,maxBuffer:1024*1024*2});
    const diffs=String(raw||'').split(/\r?\n/)
      .map(x=>x.trim())
      .filter(x=>x.startsWith('lavfi.signalstats.YAVG='))
      .map(x=>Number(x.split('=').pop()))
      .filter(x=>Number.isFinite(x)&&x>=0);
    const sampleCount=diffs.length;
    const meanDifference=sampleCount?diffs.reduce((a,b)=>a+b,0)/sampleCount:0;
    const peakDifference=sampleCount?Math.max(...diffs):0;
    const activeFrames=diffs.filter(x=>x>=0.12).length;
    const activeRatio=sampleCount?activeFrames/sampleCount:0;
    const ok=sampleCount>=3&&meanDifference>=0.12&&peakDifference>=0.25&&activeRatio>=0.35;
    return{
      ok,
      code:ok?'CREATOR_HOOK_MOTION_PASS':'CREATOR_HOOK_MOTION_LOW',
      start:Number(at.toFixed(3)),
      seconds:Number(span.toFixed(3)),
      fps:rate,
      sampleCount,
      meanDifference:Number(meanDifference.toFixed(4)),
      peakDifference:Number(peakDifference.toFixed(4)),
      activeFrames,
      activeRatio:Number(activeRatio.toFixed(3))
    };
  }catch(e){
    return{ok:false,code:'CREATOR_HOOK_MOTION_PROBE_FAILED',start:Number(at.toFixed(3)),message:String(e.message||e).slice(0,300)};
  }
}
function findHookMotionWindow(file,ffmpeg,{windowSeconds=0.95,maxOffsetSeconds=3,stepSeconds=0.5,fps=8}={}){
  const maxOffset=Math.max(0,Math.min(6,Number(maxOffsetSeconds)||3));
  const step=Math.max(0.25,Math.min(1,Number(stepSeconds)||0.5));
  const attempts=[];
  let best=null;
  for(let offset=0;offset<=maxOffset+0.001;offset+=step){
    const probe=probeHookMotion(file,ffmpeg,{start:offset,seconds:windowSeconds,fps});
    attempts.push(probe);
    if(!best||Number(probe.meanDifference||0)>Number(best.meanDifference||0))best=probe;
    if(probe.ok)return{...probe,offset:Number(offset.toFixed(3)),attempts:attempts.length};
  }
  return{
    ...(best||{ok:false,code:'CREATOR_HOOK_MOTION_LOW',meanDifference:0,peakDifference:0,activeFrames:0,activeRatio:0,sampleCount:0}),
    ok:false,
    code:'CREATOR_HOOK_MOTION_NOT_FOUND',
    offset:Number(best&&best.start||0),
    attempts:attempts.length
  };
}

function probeRenderedMotionWindow(file,ffmpeg,{start=0,seconds=1.1,fps=4}={}){
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',start:Number(start)||0};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_MOTION_OUTPUT_MISSING',start:Number(start)||0};
  const at=Math.max(0,Number(start)||0);
  const span=Math.max(0.8,Math.min(1.5,Number(seconds)||1.1));
  const rate=Math.max(3,Math.min(6,Math.round(Number(fps)||4)));
  try{
    const raw=execFile(ffmpeg,[
      '-hide_banner','-loglevel','error',
      '-ss',at.toFixed(3),'-i',file,
      '-t',span.toFixed(3),
      '-an',
      '-vf','fps='+rate+',scale=64:64:flags=area,format=gray,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-',
      '-f','null','-'
    ],{timeout:25000,maxBuffer:1024*1024*2});
    const diffs=String(raw||'').split(/\r?\n/)
      .map(x=>x.trim())
      .filter(x=>x.startsWith('lavfi.signalstats.YAVG='))
      .map(x=>Number(x.split('=').pop()))
      .filter(x=>Number.isFinite(x)&&x>=0);
    const sampleCount=diffs.length;
    const meanDifference=sampleCount?diffs.reduce((a,b)=>a+b,0)/sampleCount:0;
    const peakDifference=sampleCount?Math.max(...diffs):0;
    const activeFrames=diffs.filter(x=>x>=0.025).length;
    const activeRatio=sampleCount?activeFrames/sampleCount:0;
    const ok=sampleCount>=2&&meanDifference>=0.025&&peakDifference>=0.06&&activeRatio>=0.34;
    return{
      ok,
      code:ok?'CREATOR_RENDER_MOTION_PASS':'CREATOR_RENDER_MOTION_LOW',
      start:Number(at.toFixed(3)),
      seconds:Number(span.toFixed(3)),
      fps:rate,
      sampleCount,
      meanDifference:Number(meanDifference.toFixed(4)),
      peakDifference:Number(peakDifference.toFixed(4)),
      activeFrames,
      activeRatio:Number(activeRatio.toFixed(3))
    };
  }catch(e){
    return{ok:false,code:'CREATOR_RENDER_MOTION_PROBE_FAILED',start:Number(at.toFixed(3)),message:String(e.message||e).slice(0,300)};
  }
}
function probeRenderedMotionCoverage(file,ffmpeg,duration,{mode='short'}={}){
  const total=Number(duration);
  if(!Number.isFinite(total)||total<=0)return{
    ok:false,
    code:'CREATOR_RENDER_DURATION_MISSING',
    mode,
    activeWindows:0,
    requiredWindows:0,
    sampledWindows:0,
    maxInactiveRun:0,
    maxAllowedInactiveRun:0,
    coverageOk:false,
    continuityOk:false,
    windows:[]
  };
  const longform=String(mode||'short')==='longform';
  const fractions=longform
    ?Array.from({length:11},(_,index)=>0.05+((0.90*index)/10))
    :[0.08,0.36,0.64,0.9];
  const span=1.1;
  const maxStart=Math.max(0,total-span);
  const windows=fractions.map(fraction=>{
    const start=Math.max(0,Math.min(maxStart,(total*fraction)-(span/2)));
    return probeRenderedMotionWindow(file,ffmpeg,{start,seconds:span,fps:4});
  });
  const activeWindows=windows.filter(x=>x&&x.ok).length;
  const requiredWindows=longform?8:3;
  let currentInactiveRun=0,maxInactiveRun=0;
  for(const window of windows){
    if(window&&window.ok){
      currentInactiveRun=0;
    }else{
      currentInactiveRun++;
      if(currentInactiveRun>maxInactiveRun)maxInactiveRun=currentInactiveRun;
    }
  }
  const maxAllowedInactiveRun=longform?2:1;
  const coverageOk=activeWindows>=requiredWindows;
  const continuityOk=maxInactiveRun<=maxAllowedInactiveRun;
  const ok=coverageOk&&continuityOk;
  return{
    ok,
    code:ok
      ?'CREATOR_MOTION_COVERAGE_PASS'
      :(!coverageOk?'CREATOR_MOTION_COVERAGE_MISSING':'CREATOR_MOTION_CONTINUITY_MISSING'),
    mode:longform?'longform':'short',
    duration:Number(total.toFixed(3)),
    activeWindows,
    requiredWindows,
    sampledWindows:windows.length,
    maxInactiveRun,
    maxAllowedInactiveRun,
    coverageOk,
    continuityOk,
    windows
  };
}
function probeRenderedExposureWindow(file,ffmpeg,{start=0,seconds=1.1,fps=2}={}){
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',start:Number(start)||0,sampleCount:0};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_VISUAL_OUTPUT_MISSING',start:Number(start)||0,sampleCount:0};
  const at=Math.max(0,Number(start)||0);
  const span=Math.max(0.8,Math.min(1.5,Number(seconds)||1.1));
  const rate=Math.max(1,Math.min(4,Math.round(Number(fps)||2)));
  try{
    const raw=execFile(ffmpeg,[
      '-hide_banner','-loglevel','error',
      '-ss',at.toFixed(3),'-i',file,
      '-t',span.toFixed(3),
      '-an',
      '-vf','fps='+rate+',scale=64:64:flags=area,signalstats,metadata=mode=print:file=-',
      '-f','null','-'
    ],{timeout:25000,maxBuffer:1024*1024*3});
    const values=String(raw||'').split(/\r?\n/)
      .map(x=>x.trim())
      .filter(x=>x.startsWith('lavfi.signalstats.YAVG='))
      .map(x=>Number(x.split('=').pop()))
      .filter(Number.isFinite);
    const sampleCount=values.length;
    const meanY=sampleCount?values.reduce((a,b)=>a+b,0)/sampleCount:null;
    const minY=sampleCount?Math.min(...values):null;
    const maxY=sampleCount?Math.max(...values):null;
    const nearBlack=sampleCount>=2&&Number(maxY)<=18.5;
    const nearWhite=sampleCount>=2&&Number(minY)>=232.5;
    const ok=sampleCount>=2&&!nearBlack&&!nearWhite;
    return{
      ok,
      code:ok?'CREATOR_VISUAL_EXPOSURE_PASS':(nearBlack?'CREATOR_VISUAL_NEAR_BLACK':(nearWhite?'CREATOR_VISUAL_NEAR_WHITE':'CREATOR_VISUAL_EXPOSURE_PROBE_EMPTY')),
      start:Number(at.toFixed(3)),
      seconds:Number(span.toFixed(3)),
      fps:rate,
      sampleCount,
      meanY:meanY===null?null:Number(meanY.toFixed(3)),
      minY:minY===null?null:Number(minY.toFixed(3)),
      maxY:maxY===null?null:Number(maxY.toFixed(3)),
      nearBlack,
      nearWhite
    };
  }catch(e){
    return{ok:false,code:'CREATOR_VISUAL_EXPOSURE_PROBE_FAILED',start:Number(at.toFixed(3)),sampleCount:0,message:String(e.message||e).slice(0,300)};
  }
}
function probeRenderedVisualIntegrity(file,ffmpeg,duration,{mode='short'}={}){
  const total=Number(duration);
  const longform=String(mode||'short')==='longform';
  if(!Number.isFinite(total)||total<=0)return{
    ok:false,
    code:'CREATOR_RENDER_DURATION_MISSING',
    mode:longform?'longform':'short',
    usableWindows:0,
    requiredWindows:0,
    blankWindows:0,
    windows:[]
  };
  const fractions=longform?[0.1,0.3,0.5,0.7,0.9]:[0.08,0.36,0.64,0.9];
  const span=1.1;
  const maxStart=Math.max(0,total-span);
  const windows=fractions.map(fraction=>{
    const start=Math.max(0,Math.min(maxStart,(total*fraction)-(span/2)));
    return probeRenderedExposureWindow(file,ffmpeg,{start,seconds:span,fps:2});
  });
  const usableWindows=windows.filter(x=>x&&x.ok).length;
  const blankWindows=windows.length-usableWindows;
  const requiredWindows=longform?4:3;
  const ok=usableWindows>=requiredWindows;
  return{
    ok,
    code:ok?'CREATOR_VISUAL_INTEGRITY_PASS':'CREATOR_VISUAL_INTEGRITY_FAILED',
    mode:longform?'longform':'short',
    duration:Number(total.toFixed(3)),
    usableWindows,
    requiredWindows,
    blankWindows,
    sampledWindows:windows.length,
    nearBlackWindows:windows.filter(x=>x&&x.nearBlack).length,
    nearWhiteWindows:windows.filter(x=>x&&x.nearWhite).length,
    windows
  };
}

function applyRenderedVisualQuality(quality,file,ffmpeg,{mode='short'}={}){
  const result=quality&&typeof quality==='object'?quality:{ok:false,code:'CREATOR_QUALITY_FAILED',message:'Creator quality result missing.'};
  if(!result.checks||typeof result.checks!=='object')result.checks={};
  if(!result.measured||typeof result.measured!=='object')result.measured={};
  const baseOk=!!result.ok;
  const duration=Number(result.measured.duration);
  const motionCoverage=probeRenderedMotionCoverage(file,ffmpeg,duration,{mode});
  const visualIntegrity=probeRenderedVisualIntegrity(file,ffmpeg,duration,{mode});
  result.checks.motionCoverage=motionCoverage.coverageOk;
  result.checks.motionContinuity=motionCoverage.continuityOk;
  result.checks.visualIntegrity=visualIntegrity.ok;
  result.motionCoverage=motionCoverage;
  result.visualIntegrity=visualIntegrity;
  result.measured.motionActiveWindows=motionCoverage.activeWindows;
  result.measured.motionRequiredWindows=motionCoverage.requiredWindows;
  result.measured.motionMaxInactiveRun=motionCoverage.maxInactiveRun;
  result.measured.motionMaxAllowedInactiveRun=motionCoverage.maxAllowedInactiveRun;
  result.measured.visualUsableWindows=visualIntegrity.usableWindows;
  result.measured.visualRequiredWindows=visualIntegrity.requiredWindows;
  result.measured.visualBlankWindows=visualIntegrity.blankWindows;
  result.measured.visualNearBlackWindows=visualIntegrity.nearBlackWindows;
  result.measured.visualNearWhiteWindows=visualIntegrity.nearWhiteWindows;
  result.ok=baseOk&&motionCoverage.ok&&visualIntegrity.ok;
  if(baseOk&&!motionCoverage.ok){
    result.code=String(motionCoverage.code||'CREATOR_MOTION_COVERAGE_MISSING');
    result.message=String(mode||'short')==='longform'
      ?'Creator long-form final görüntü hareket sürekliliği kalite kapısı başarısız.'
      :'Creator Shorts final görüntü hareketi kalite kapısı başarısız.';
  }else if(baseOk&&!visualIntegrity.ok){
    result.code=String(visualIntegrity.code||'CREATOR_VISUAL_INTEGRITY_FAILED');
    result.message=String(mode||'short')==='longform'
      ?'Creator long-form final görüntü bütünlüğü kalite kapısı başarısız.'
      :'Creator Shorts final görüntü bütünlüğü kalite kapısı başarısız.';
  }
  return result;
}

const CREATOR_AUDIO_MASTER_PROFILE=Object.freeze({
  targetIntegratedLufs:-16,
  targetLra:7,
  targetTruePeakDb:-1.5,
  sampleRate:48000,
  method:'ffmpeg-loudnorm'
});
function creatorAudioMasterFilter({pad=true}={}){
  const profile=CREATOR_AUDIO_MASTER_PROFILE;
  const filters=[];
  if(pad)filters.push('apad=pad_dur=1');
  filters.push(
    'loudnorm=I='+profile.targetIntegratedLufs+
    ':LRA='+profile.targetLra+
    ':TP='+profile.targetTruePeakDb
  );
  filters.push('aresample='+profile.sampleRate);
  return filters.join(',');
}
function creatorAudioMasterProfile(){
  return{...CREATOR_AUDIO_MASTER_PROFILE};
}

function probeRenderedAudioLoudness(file,ffmpeg,{targetLufs=-16,toleranceLufs=3,maxTruePeakDb=-0.5}={}){
  const target=Number.isFinite(Number(targetLufs))?Number(targetLufs):-16;
  const tolerance=Math.max(0.5,Math.min(6,Number(toleranceLufs)||3));
  const peakCeiling=Number.isFinite(Number(maxTruePeakDb))?Number(maxTruePeakDb):-0.5;
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',integratedLufs:null,truePeakDb:null};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_AUDIO_OUTPUT_MISSING',integratedLufs:null,truePeakDb:null};
  try{
    const run=childProcess.spawnSync(ffmpeg,[
      '-hide_banner','-nostats','-i',file,
      '-map','0:a:0',
      '-af','loudnorm=I='+target+':LRA=7:TP=-1.5:print_format=json',
      '-f','null','-'
    ],{
      encoding:'utf8',
      windowsHide:true,
      timeout:90000,
      maxBuffer:1024*1024*8
    });
    if(run.error||run.status!==0){
      return{ok:false,code:'CREATOR_AUDIO_LOUDNESS_PROBE_FAILED',integratedLufs:null,truePeakDb:null,detail:String((run.error&&run.error.message)||run.stderr||'').slice(-500)};
    }
    const text=String(run.stderr||'');
    const integratedMatch=/"input_i"\s*:\s*"(-?inf|-?[0-9]+(?:\.[0-9]+)?)"/i.exec(text);
    const peakMatch=/"input_tp"\s*:\s*"(-?inf|-?[0-9]+(?:\.[0-9]+)?)"/i.exec(text);
    const lraMatch=/"input_lra"\s*:\s*"(-?inf|-?[0-9]+(?:\.[0-9]+)?)"/i.exec(text);
    const parse=(match)=>{
      if(!match)return null;
      if(/inf/i.test(match[1]))return -Infinity;
      const n=Number(match[1]);
      return Number.isFinite(n)?n:null;
    };
    const integratedLufs=parse(integratedMatch);
    const truePeakDb=parse(peakMatch);
    const lra=parse(lraMatch);
    const inBand=Number.isFinite(integratedLufs)&&integratedLufs>=target-tolerance&&integratedLufs<=target+tolerance;
    const peakSafe=Number.isFinite(truePeakDb)&&truePeakDb<=peakCeiling;
    const ok=inBand&&peakSafe;
    return{
      ok,
      code:ok?'CREATOR_AUDIO_LOUDNESS_PASS':'CREATOR_AUDIO_LOUDNESS_OUT_OF_RANGE',
      integratedLufs,
      truePeakDb,
      lra,
      targetLufs:target,
      toleranceLufs:tolerance,
      maxTruePeakDb:peakCeiling,
      method:'ffmpeg-loudnorm-analysis'
    };
  }catch(e){
    return{ok:false,code:'CREATOR_AUDIO_LOUDNESS_PROBE_FAILED',integratedLufs:null,truePeakDb:null,detail:String(e.message||e).slice(0,500)};
  }
}

function probeAudioContinuity(file,ffmpeg,{maxSilentSeconds=3,minSilenceSeconds=1.2,noiseDb=-50}={}){
  const maxGap=Math.max(1,Math.min(30,Number(maxSilentSeconds)||3));
  const minGap=Math.max(0.5,Math.min(maxGap,Number(minSilenceSeconds)||1.2));
  const noise=Math.max(-80,Math.min(-20,Number(noiseDb)||-50));
  if(!ffmpeg)return{ok:false,code:'FFMPEG_MISSING',maxSilenceSeconds:null,silenceEvents:0,maxAllowedSeconds:maxGap};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_AUDIO_OUTPUT_MISSING',maxSilenceSeconds:null,silenceEvents:0,maxAllowedSeconds:maxGap};
  try{
    const run=childProcess.spawnSync(ffmpeg,[
      '-hide_banner','-nostats','-i',file,
      '-map','0:a:0',
      '-af','silencedetect=noise='+noise+'dB:d='+minGap,
      '-f','null','-'
    ],{
      encoding:'utf8',
      windowsHide:true,
      timeout:90000,
      maxBuffer:1024*1024*8
    });
    if(run.error||run.status!==0){
      return{
        ok:false,
        code:'CREATOR_AUDIO_CONTINUITY_PROBE_FAILED',
        maxSilenceSeconds:null,
        silenceEvents:0,
        maxAllowedSeconds:maxGap,
        detail:String((run.error&&run.error.message)||run.stderr||'').slice(-500)
      };
    }
    const text=String(run.stderr||'');
    const durations=[...text.matchAll(/silence_duration:\s*([0-9]+(?:\.[0-9]+)?)/gi)]
      .map(m=>Number(m[1]))
      .filter(Number.isFinite);
    const maxSilenceSeconds=durations.length?Math.max(...durations):0;
    const ok=maxSilenceSeconds<=maxGap;
    return{
      ok,
      code:ok?'CREATOR_AUDIO_CONTINUITY_PASS':'CREATOR_AUDIO_DROPOUT',
      maxSilenceSeconds:Number(maxSilenceSeconds.toFixed(3)),
      silenceEvents:durations.length,
      maxAllowedSeconds:maxGap,
      minSilenceSeconds:minGap,
      noiseDb:noise,
      method:'ffmpeg-silencedetect'
    };
  }catch(e){
    return{ok:false,code:'CREATOR_AUDIO_CONTINUITY_PROBE_FAILED',maxSilenceSeconds:null,silenceEvents:0,maxAllowedSeconds:maxGap,detail:String(e.message||e).slice(0,500)};
  }
}

function applyRenderedAudioQuality(quality,file,ffmpeg,{mode='short'}={}){
  const result=quality&&typeof quality==='object'?quality:{ok:false,code:'CREATOR_QUALITY_FAILED',message:'Creator quality result missing.'};
  if(!result.checks||typeof result.checks!=='object')result.checks={};
  if(!result.measured||typeof result.measured!=='object')result.measured={};
  const baseOk=!!result.ok;
  const outputAudioActivity=probeNarrationActivity(file,ffmpeg,{minMeanDb:-45,minPeakDb:-30});
  const outputLoudness=probeRenderedAudioLoudness(file,ffmpeg);
  const longform=String(mode||'short')==='longform';
  const audioContinuity=probeAudioContinuity(file,ffmpeg,{maxSilentSeconds:longform?8:3,minSilenceSeconds:1.2,noiseDb:-50});
  result.checks.audioSignal=outputAudioActivity.ok;
  result.checks.audioLoudness=outputLoudness.ok;
  result.checks.audioContinuity=audioContinuity.ok;
  result.measured.audioMeanDb=outputAudioActivity.meanDb;
  result.measured.audioPeakDb=outputAudioActivity.maxDb;
  result.measured.audioIntegratedLufs=outputLoudness.integratedLufs;
  result.measured.audioTruePeakDb=outputLoudness.truePeakDb;
  result.measured.maxAudioSilenceSeconds=audioContinuity.maxSilenceSeconds;
  result.audioSignal=outputAudioActivity;
  result.audioLoudness=outputLoudness;
  result.audioContinuity=audioContinuity;
  result.ok=baseOk&&outputAudioActivity.ok&&outputLoudness.ok&&audioContinuity.ok;
  if(baseOk&&!outputAudioActivity.ok){
    result.code='CREATOR_AUDIO_SIGNAL_MISSING';
    result.message=mode==='longform'
      ?'Creator long-form final ses sinyali kalite kapısı başarısız.'
      :'Creator Shorts final ses sinyali kalite kapısı başarısız.';
  }else if(baseOk&&!outputLoudness.ok){
    result.code='CREATOR_AUDIO_LOUDNESS_OUT_OF_RANGE';
    result.message=mode==='longform'
      ?'Creator long-form final loudness kalite kapısı başarısız.'
      :'Creator Shorts final loudness kalite kapısı başarısız.';
  }else if(baseOk&&!audioContinuity.ok){
    result.code='CREATOR_AUDIO_DROPOUT';
    result.message=mode==='longform'
      ?'Creator long-form final ses sürekliliği kalite kapısı başarısız.'
      :'Creator Shorts final ses sürekliliği kalite kapısı başarısız.';
  }
  return result;
}

function streamTimelineCoverage(stream,containerDuration){
  const finite=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
  const start=finite(stream&&stream.start_time);
  const duration=finite(stream&&stream.duration);
  const target=finite(containerDuration);
  const end=start!==null&&duration!==null?start+duration:null;
  // Allow muxing/encoder rounding and the renderer's short end padding, but
  // never accept a container duration as evidence of complete media tracks.
  const tolerance=0.5;
  const ok=start!==null&&duration!==null&&duration>0&&target!==null&&target>0&&
    Math.abs(start)<=tolerance&&Math.abs(end-target)<=tolerance;
  return{ok,start,duration,end,tolerance};
}
function probeRenderedShort(file,ffprobe){
  if(!ffprobe)return{ok:false,code:'FFPROBE_MISSING',message:'Rendered Shorts kalite doğrulaması için FFprobe gerekli.'};
  if(!file||!fs.existsSync(file))return{ok:false,code:'CREATOR_OUTPUT_MISSING',message:'Rendered MP4 bulunamadı.'};
  try{
    const raw=execFile(ffprobe,[
      '-v','error',
      '-show_entries','stream=index,codec_type,codec_name,width,height,r_frame_rate,start_time,duration:format=duration',
      '-of','json',
      file
    ],{timeout:20000,maxBuffer:1024*1024*2}).trim();
    const data=JSON.parse(raw||'{}');
    const streams=Array.isArray(data.streams)?data.streams:[];
    const video=streams.find(x=>x&&x.codec_type==='video');
    const audio=streams.find(x=>x&&x.codec_type==='audio');
    const duration=Number(data&&data.format&&data.format.duration);
    const videoTimeline=streamTimelineCoverage(video,duration);
    const audioTimeline=streamTimelineCoverage(audio,duration);
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
      duration:Number.isFinite(duration)&&duration>=11.8&&duration<=18.8,
      videoTimeline:videoTimeline.ok,
      audioTimeline:audioTimeline.ok
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
        duration:Number(Number(duration||0).toFixed(3)),
        videoStart:videoTimeline.start,
        videoDuration:videoTimeline.duration,
        audioStart:audioTimeline.start,
        audioDuration:audioTimeline.duration
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
      '-show_entries','stream=index,codec_type,codec_name,width,height,r_frame_rate,start_time,duration:format=duration,size,format_name',
      '-of','json',
      file
    ],{timeout:30000,maxBuffer:1024*1024*2}).trim();
    const data=JSON.parse(raw||'{}');
    const streams=Array.isArray(data.streams)?data.streams:[];
    const video=streams.find(x=>x&&x.codec_type==='video');
    const audio=streams.find(x=>x&&x.codec_type==='audio');
    const format=data&&data.format||{};
    const duration=Number(format.duration);
    const videoTimeline=streamTimelineCoverage(video,duration);
    const audioTimeline=streamTimelineCoverage(audio,duration);
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
      videoTimeline:videoTimeline.ok,
      audioTimeline:audioTimeline.ok,
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
        videoStart:videoTimeline.start,
        videoDuration:videoTimeline.duration,
        audioStart:audioTimeline.start,
        audioDuration:audioTimeline.duration,
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
function assTime(seconds){
  const cs=Math.max(0,Math.round(Number(seconds||0)*100));
  const h=Math.floor(cs/360000);
  const m=Math.floor((cs%360000)/6000);
  const sec=Math.floor((cs%6000)/100);
  const centi=cs%100;
  return String(h)+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')+'.'+String(centi).padStart(2,'0');
}
function assEscape(text){
  return String(text||'')
    .replace(/\\/g,'\\\\')
    .replace(/\{/g,'\\{')
    .replace(/\}/g,'\\}')
    .replace(/[\r\n]+/g,'\\N')
    .trim();
}
function splitShortCaptionSegments(text){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];
  const sentences=clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out=[];
  for(const sentence of sentences){
    const words=sentence.split(/\s+/).filter(Boolean);
    for(let i=0;i<words.length;i+=5)out.push(words.slice(i,i+5).join(' '));
  }
  return out.length?out:[clean];
}
function buildShortAss(text,durationSeconds=15){
  const parts=splitShortCaptionSegments(text);
  const duration=Math.max(1,Number(durationSeconds)||15);
  if(!parts.length)return'';
  const weights=parts.map(x=>Math.max(1,x.split(/\s+/).length));
  const total=weights.reduce((a,b)=>a+b,0);
  let cursor=0;
  const lines=[
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    'Style: Default,Arial,62,&H00FFFFFF,&H0000FFFF,&H78000000,&H50000000,-1,0,0,0,100,100,0,0,1,4,0,2,70,70,135,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  parts.forEach((part,i)=>{
    const slice=duration*(weights[i]/total);
    const start=cursor;
    const end=i===parts.length-1?duration:Math.min(duration,cursor+slice);
    cursor=end;
    const text=assEscape(part);
    const tag='{\\an2\\pos(540,1640)\\bord4\\shad0\\fad(55,85)\\fscx118\\fscy118\\t(0,170,\\fscx100\\fscy100)}';
    lines.push('Dialogue: 0,'+assTime(start)+','+assTime(end)+',Default,,0,0,0,,'+tag+text);
  });
  return lines.join('\n');
}

function renderShort({workspace,name,script,voicePath,assetFiles=[],missionId='',assetHashes=[],thumbnailTitle=''}){
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
  const assFile=path.join(jobDir,base+'.ass');
  const metaFile=path.join(jobDir,'job.json');

  const measured=audioDurationSeconds(voicePath,status.ffprobe);
  const narrationActivity=probeNarrationActivity(voicePath,status.ffmpeg);
  if(!narrationActivity.ok){
    const e=new Error('Creator narration audio is silent or unreadable.');
    e.code=String(narrationActivity.code||'CREATOR_NARRATION_SILENT');
    e.narrationActivity=narrationActivity;
    throw e;
  }
  if(measured&&measured>19.5){
    const e=new Error('Anlatım '+measured.toFixed(1)+' sn; Shorts hedefi için metni kısaltmak gerekiyor.');
    e.code='VOICE_TOO_LONG';
    e.duration=measured;
    throw e;
  }
  const duration=measured?Math.max(12,Math.min(18.5,measured+0.35)):18;
  const explicitAssets=Array.isArray(assetFiles)&&assetFiles.length>0;
  const assetCandidates=explicitAssets?resolveAssetSelection(workspace,assetFiles,5):selectAssets(workspace,base,24);
  const assetPreflight=preflightAssetSelection(workspace,assetCandidates,{maxScenes:5});
  const assets=assetPreflight.assets;
  const transition=assets.length?0.18:0;
  const storyboard=buildShortStoryboard(assets,duration,transition,3.2,7,0.9);
  const hookMotion=assets.length
    ?findHookMotionWindow(assets[0],status.ffmpeg,{windowSeconds:0.95,maxOffsetSeconds:3,stepSeconds:0.5,fps:8})
    :{ok:true,code:'CREATOR_HOOK_PROCEDURAL',offset:0,attempts:0,changeRatio:1,sampleCount:0,uniqueFrames:0};
  if(assets.length&&hookMotion.ok&&storyboard[0])storyboard[0].sourceOffset=Number(hookMotion.offset||0);
  const maxSceneDuration=storyboard.length?Math.max(...storyboard.map(x=>Number(x.duration||0))):0;
  const hookScene=storyboard[0]||null;
  const hookSeconds=Number(hookScene&&hookScene.duration||0);
  const visualEdit={
    ok:!assets.length||(storyboard.length>=Math.min(4,Math.ceil(duration/4.2))&&maxSceneDuration<=4.5&&hookSeconds>=0.75&&hookSeconds<=1.05&&hookScene&&hookScene.hook===true&&hookMotion.ok===true),
    sceneCount:storyboard.length,
    distinctAssets:assets.length,
    averageSceneSeconds:storyboard.length?Number((duration/storyboard.length).toFixed(3)):0,
    maxSceneSeconds:Number(maxSceneDuration.toFixed(3)),
    hookSeconds:Number(hookSeconds.toFixed(3)),
    hookAssetIndex:hookScene?Number(hookScene.assetIndex):-1,
    hookMotion,
    transitions:[...new Set(storyboard.map(x=>x.transition).filter(Boolean))],
    motion:assets.length?'dynamic-pan-crop':'procedural'
  };
  if(assets.length&&!hookMotion.ok){
    const e=new Error('Creator Shorts hook gerçek hareket doğrulaması başarısız.');
    e.code='CREATOR_SHORT_HOOK_MOTION_MISSING';
    e.visualEdit=visualEdit;
    throw e;
  }
  if(assets.length&&!visualEdit.ok){
    const e=new Error('Creator Shorts edit rhythm quality gate failed.');
    e.code='CREATOR_SHORT_EDIT_RHYTHM_FAILED';
    e.visualEdit=visualEdit;
    throw e;
  }
  const captionsBurned=supportsSubtitles(status.ffmpeg);

  fs.writeFileSync(srtFile,buildSrt(cleanScript,duration),'utf8');
  fs.writeFileSync(assFile,buildShortAss(cleanScript,duration),'utf8');

  let sfx=null;
  try{sfx=assets.length?renderShortSfxBed(status.ffmpeg,jobDir,storyboard,duration):null}
  catch(e){sfx={file:null,events:[],count:0,profile:'voice-only-fallback',error:String(e.message||e).slice(0,240)}}
  const soundDesign={
    enabled:!!(sfx&&sfx.file),
    count:Number(sfx&&sfx.count||0),
    profile:String(sfx&&sfx.profile||'voice-only'),
    error:sfx&&sfx.error||null
  };

  let args=[];
  if(assets.length){
    args=['-y','-hide_banner','-loglevel','error'];
    for(const scene of storyboard)args.push('-stream_loop','-1','-i',scene.file);
    const voiceInput=storyboard.length;
    args.push('-i',voicePath);
    const sfxInput=soundDesign.enabled?voiceInput+1:null;
    if(soundDesign.enabled)args.push('-i',sfx.file);

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
      const subtitlePath=ffmpegFilterPath(assFile);
      filters.push(
        '['+videoLabel+']subtitles=filename=\''+subtitlePath+'\''+
        '[vout]'
      );
      videoLabel='vout';
    }

    let audioMap=String(voiceInput)+':a:0';
    if(soundDesign.enabled){
      filters.push('['+voiceInput+':a]aresample=48000,apad=pad_dur=1,volume=1[voicea]');
      filters.push('['+sfxInput+':a]aresample=48000,volume=1[sfxa]');
      filters.push('[voicea][sfxa]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,'+creatorAudioMasterFilter({pad:false})+'[aout]');
      audioMap='[aout]';
    }

    args.push(
      '-t',duration.toFixed(3),
      '-filter_complex',filters.join(';'),
      '-map','['+videoLabel+']',
      '-map',audioMap,
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k'
    );
    if(!soundDesign.enabled)args.push('-af',creatorAudioMasterFilter());
    args.push('-movflags','+faststart',outFile);
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
        '-vf',"subtitles=filename='"+ffmpegFilterPath(assFile)+"'"
      );
    }
    args.push(
      '-map','0:v:0','-map','1:a:0',
      '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k','-af',creatorAudioMasterFilter(),
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
  const quality=applyRenderedAudioQuality(
    probeRenderedShort(outFile,status.ffprobe),
    outFile,
    status.ffmpeg,
    {mode:'short'}
  );
  applyRenderedVisualQuality(quality,outFile,status.ffmpeg,{mode:'short'});
  if(!quality.ok){
    const e=new Error(String(quality.message||'Creator Shorts quality gate failed')+' · '+String(quality.code||'CREATOR_QUALITY_FAILED'));
    e.code=String(quality.code||'CREATOR_QUALITY_FAILED');
    e.quality=quality;
    throw e;
  }

  let thumbnail=null;
  try{
    thumbnail=createThumbnail(workspace,outFile,{
      title:String(thumbnailTitle||name||''),
      name:base+'-thumb',
      missionId,
      frameAt:0.45
    });
  }catch(e){
    thumbnail={ok:false,error:String(e.message||e).slice(0,300)};
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
    assetPreflight:assetPreflight.evidence,
    sourceAssetHashes:Array.isArray(assetHashes)?assetHashes.map(x=>String(x||'').slice(0,64)).filter(Boolean).slice(0,5):[],
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:assets[0]?path.relative(workspace,assets[0]):null,
    sourceAssets:assets.map(x=>path.relative(workspace,x)),
    storyboard:storyboard.map(x=>({...x,file:path.relative(workspace,x.file)})),
    captionsBurned,
    captionAnimation:captionsBurned?'pop-fade':'none',
    quality,
    visualEdit,
    thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null,
    thumbnailTitleBurned:!!(thumbnail&&thumbnail.ok&&thumbnail.titleBurned),
    soundDesign,
    audioMaster:creatorAudioMasterProfile(),
    narrationActivity,
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    burnedSubtitle:path.relative(workspace,assFile),
    profile:{width:1080,height:1920,fps:30,codec:'H.264',audio:'AAC',durationTarget:'12-18s',multiScene:true,transition:'varied',hookTarget:'0.75-1.05s',sceneTarget:'2.5-4s',motion:'dynamic-pan-crop',captions:'kinetic-pop-fade',sfx:'procedural-impact-whoosh'}
  };
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),'utf8');

  return{
    ok:true,
    message:'Shorts videosu hazır: '+outFile+' · 1080x1920 · 30 FPS · H.264 · '+(assets.length?(storyboard.length+' sahne / '+assets.length+' klip · hareketli kurgu'):'procedural hareketli arka plan')+(captionsBurned?' · altyazı videoya işlendi':' · altyazı ayrı SRT'),
    output:outFile,
    subtitle:srtFile,
    burnedSubtitle:assFile,
    metadata:metaFile,
    asset:assets[0]||null,
    assets,
    storyboard,
    sceneCount:storyboard.length,
    captionsBurned,
    captionAnimation:captionsBurned?'pop-fade':'none',
    duration,
    quality,
    visualEdit,
    thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null,
    thumbnailTitleBurned:!!(thumbnail&&thumbnail.ok&&thumbnail.titleBurned),
    soundDesign,
    audioMaster:creatorAudioMasterProfile(),
    narrationActivity,
    profileVersion:CREATOR_PROFILE_VERSION
  };
}

function renderLongform({workspace,name,script,voicePath,assetFiles=[],missionId='',assetHashes=[],thumbnailTitle=''}){
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
  const narrationActivity=probeNarrationActivity(voicePath,status.ffmpeg);
  if(!narrationActivity.ok){
    const e=new Error('Creator long-form narration audio is silent or unreadable.');
    e.code=String(narrationActivity.code||'CREATOR_NARRATION_SILENT');
    e.narrationActivity=narrationActivity;
    throw e;
  }
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
  const assetCandidates=explicitAssets?resolveAssetSelection(workspace,assetFiles,20):selectAssets(workspace,base,24);
  const assetPreflight=preflightAssetSelection(workspace,assetCandidates,{maxScenes:explicitAssets?20:12});
  const assets=assetPreflight.assets;
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
      '-c:a','aac','-b:a','192k','-af',creatorAudioMasterFilter(),
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
      '-c:a','aac','-b:a','192k','-af',creatorAudioMasterFilter(),
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
  const quality=applyRenderedAudioQuality(
    probeRenderedLongform(outFile,status.ffprobe),
    outFile,
    status.ffmpeg,
    {mode:'longform'}
  );
  applyRenderedVisualQuality(quality,outFile,status.ffmpeg,{mode:'longform'});
  if(!quality.ok){
    const e=new Error(String(quality.message||'Creator long-form quality gate failed')+' · '+String(quality.code||'CREATOR_LONGFORM_QUALITY_FAILED'));
    e.code=String(quality.code||'CREATOR_LONGFORM_QUALITY_FAILED');
    e.quality=quality;
    throw e;
  }

  let thumbnail=null;
  try{
    thumbnail=createThumbnail(workspace,outFile,{
      title:String(thumbnailTitle||name||''),
      name:base+'-thumb',
      missionId,
      frameAt:3
    });
  }catch(e){
    thumbnail={ok:false,error:String(e.message||e).slice(0,300)};
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
    assetPreflight:assetPreflight.evidence,
    sourceAssetHashes:Array.isArray(assetHashes)?assetHashes.map(x=>String(x||'').slice(0,64)).filter(Boolean).slice(0,20):[],
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:assets[0]?path.relative(workspace,assets[0]):null,
    sourceAssets:assets.map(x=>path.relative(workspace,x)),
    storyboard:storyboard.map(x=>({...x,file:path.relative(workspace,x.file)})),
    captionsBurned,
    quality,
    visualEdit,
    thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null,
    thumbnailTitleBurned:!!(thumbnail&&thumbnail.ok&&thumbnail.titleBurned),
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    audioMaster:creatorAudioMasterProfile(),
    narrationActivity,
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
    thumbnail:thumbnail&&thumbnail.ok?thumbnail.path:null,
    thumbnailTitleBurned:!!(thumbnail&&thumbnail.ok&&thumbnail.titleBurned),
    audioMaster:creatorAudioMasterProfile(),
    narrationActivity,
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
  buildShortAss,
  selectAssets,
  buildStoryboard,
  buildShortStoryboard,
  buildShortSfxEvents,
  renderShortSfxBed,
  buildLongformStoryboard,
  supportsSubtitles,
  ffmpegFilterPath,
  renderShort,
  renderLongform,
  fitNarrationRatePercent,
  probeRenderedShort,
  probeRenderedLongform,
  streamTimelineCoverage,
  creatorAudioMasterFilter,
  creatorAudioMasterProfile,
  probeNarrationActivity,
  probeRenderedAudioLoudness,
  probeAudioContinuity,
  applyRenderedAudioQuality,
  probeHookMotion,
  findHookMotionWindow,
  probeRenderedMotionWindow,
  probeRenderedMotionCoverage,
  probeRenderedExposureWindow,
  probeRenderedVisualIntegrity,
  applyRenderedVisualQuality,
  listAssets,
  resolveAssetSelection,
  inspectAsset,
  creatorAssetResolutionQuality,
  preflightAssetSelection,
  assetSafeName,
  assetDestinationName,
  animateStillAsset,
  thumbnailTitleLines,
  createThumbnail,
  CREATOR_ASSET_EXTENSIONS,
  CREATOR_IMAGE_EXTENSIONS
};
