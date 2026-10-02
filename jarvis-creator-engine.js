const fs=require('fs');
const path=require('path');
const os=require('os');
const childProcess=require('child_process');
const crypto=require('crypto');

const ENGINE_VERSION='1.1';
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
function assetSafeName(relativePath){
  const ext=path.extname(String(relativePath||'')).toLowerCase();
  const stem=path.basename(String(relativePath||''),ext);
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
  const limit=Math.max(1,Math.min(5,Number(maxScenes)||5,assets.length));
  const h=crypto.createHash('sha1').update('storyboard:'+String(name||'')).digest();
  const offset=h.readUInt32BE(0)%assets.length;
  const rotated=assets.slice(offset).concat(assets.slice(0,offset));
  return rotated.slice(0,limit);
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
function renderShort({workspace,name,script,voicePath}){
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
  const assets=selectAssets(workspace,base,5);
  const transition=assets.length>1?0.18:0;
  const storyboard=buildStoryboard(assets,duration,transition);
  const captionsBurned=supportsSubtitles(status.ffmpeg);

  fs.writeFileSync(srtFile,buildSrt(cleanScript,duration),'utf8');

  let args=[];
  if(assets.length){
    args=['-y','-hide_banner','-loglevel','error'];
    for(const asset of assets)args.push('-stream_loop','-1','-i',asset);
    args.push('-i',voicePath);

    const filters=[];
    storyboard.forEach((scene,i)=>{
      filters.push(
        '['+i+':v]'+
        'scale=1080:1920:force_original_aspect_ratio=increase,'+
        'crop=1080:1920,'+
        'fps=30,setsar=1,'+
        'trim=duration='+scene.duration.toFixed(3)+','+
        'setpts=PTS-STARTPTS,'+
        'format=yuv420p[v'+i+']'
      );
    });

    let videoLabel='v0';
    if(storyboard.length>1){
      for(let i=1;i<storyboard.length;i++){
        const out='vx'+i;
        const offset=(i*(storyboard[0].duration-transition));
        filters.push('['+videoLabel+'][v'+i+']xfade=transition=fade:duration='+transition.toFixed(3)+':offset='+offset.toFixed(3)+'['+out+']');
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
      '-map',String(assets.length)+':a:0',
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

  const meta={
    engine:'JARVIS_CREATOR_ENGINE',
    version:ENGINE_VERSION,
    profileVersion:CREATOR_PROFILE_VERSION,
    createdAt:new Date().toISOString(),
    name:base,
    script:cleanScript,
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:assets[0]?path.relative(workspace,assets[0]):null,
    sourceAssets:assets.map(x=>path.relative(workspace,x)),
    storyboard:storyboard.map(x=>({...x,file:path.relative(workspace,x.file)})),
    captionsBurned,
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    profile:{width:1080,height:1920,fps:30,codec:'H.264',audio:'AAC',durationTarget:'12-18s',multiScene:true,transition:'fade'}
  };
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),'utf8');

  return{
    ok:true,
    message:'Shorts videosu hazır: '+outFile+' · 1080x1920 · 30 FPS · H.264 · '+(assets.length?assets.length+' sahne':'procedural hareketli arka plan')+(captionsBurned?' · altyazı videoya işlendi':' · altyazı ayrı SRT'),
    output:outFile,
    subtitle:srtFile,
    metadata:metaFile,
    asset:assets[0]||null,
    assets,
    storyboard,
    sceneCount:assets.length,
    captionsBurned,
    duration,
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
  supportsSubtitles,
  ffmpegFilterPath,
  renderShort,
  listAssets,
  inspectAsset,
  assetSafeName,
  assetDestinationName,
  CREATOR_ASSET_EXTENSIONS
};
