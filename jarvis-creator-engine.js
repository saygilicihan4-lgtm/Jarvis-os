const fs=require('fs');
const path=require('path');
const os=require('os');
const childProcess=require('child_process');
const crypto=require('crypto');

const ENGINE_VERSION='1.0';

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
function listAssets(workspace){
  const dirs=creatorDirs(workspace);
  const allowed=new Set(['.mp4','.mov','.mkv','.webm','.m4v']);
  try{
    return fs.readdirSync(dirs.assets,{withFileTypes:true})
      .filter(x=>x.isFile()&&allowed.has(path.extname(x.name).toLowerCase()))
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
  const asset=pickAsset(workspace,base);

  const measured=audioDurationSeconds(voicePath,status.ffprobe);
  if(measured&&measured>19.5){
    const e=new Error('Anlatım '+measured.toFixed(1)+' sn; Shorts hedefi için metni kısaltmak gerekiyor.');
    e.code='VOICE_TOO_LONG';
    e.duration=measured;
    throw e;
  }
  const duration=measured?Math.max(12,Math.min(18.5,measured+0.35)):18;

  fs.writeFileSync(srtFile,buildSrt(cleanScript,duration),'utf8');
  const meta={
    engine:'JARVIS_CREATOR_ENGINE',
    version:ENGINE_VERSION,
    createdAt:new Date().toISOString(),
    name:base,
    script:cleanScript,
    voicePath:path.relative(workspace,voicePath),
    sourceAsset:asset?path.relative(workspace,asset):null,
    output:path.relative(workspace,outFile),
    subtitle:path.relative(workspace,srtFile),
    profile:{width:1080,height:1920,fps:30,codec:'H.264',audio:'AAC',durationTarget:'12-18s'}
  };
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),'utf8');

  let args=[];
  if(asset){
    args=[
      '-y','-hide_banner','-loglevel','error',
      '-stream_loop','-1','-i',asset,
      '-i',voicePath,
      '-t',duration.toFixed(3),
      '-filter_complex','[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v]',
      '-map','[v]','-map','1:a:0',
      '-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k',
      '-movflags','+faststart',
      outFile
    ];
  }else{
    const graph='color=c=0x030712:s=1080x1920:r=30:d='+duration.toFixed(3)+',noise=alls=8:allf=t+u';
    args=[
      '-y','-hide_banner','-loglevel','error',
      '-f','lavfi','-i',graph,
      '-i',voicePath,
      '-t',duration.toFixed(3),
      '-map','0:v:0','-map','1:a:0',
      '-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','160k',
      '-movflags','+faststart',
      outFile
    ];
  }

  try{
    execFile(status.ffmpeg,args,{timeout:8*60*1000,maxBuffer:1024*1024*32});
  }catch(err){
    const message=String((err&&err.stderr)||err.message||err).slice(-3000);
    throw new Error('FFmpeg render başarısız: '+message);
  }

  if(!fs.existsSync(outFile)||fs.statSync(outFile).size<10000)throw new Error('Rendered MP4 verification failed');

  return{
    ok:true,
    message:'Shorts videosu hazır: '+outFile+' · 1080x1920 · 30 FPS · H.264'+(asset?' · yerel klip kullanıldı':' · procedural hareketli arka plan'),
    output:outFile,
    subtitle:srtFile,
    metadata:metaFile,
    asset,
    duration
  };
}

module.exports={
  ENGINE_VERSION,
  safeName,
  ffmpegStatus,
  prepare,
  buildSrt,
  renderShort,
  listAssets
};
