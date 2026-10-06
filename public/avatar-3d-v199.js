/* Original procedural 3D robot. Audio-energy jaw motion, NOT phoneme/viseme lip sync. */
(function(w){
  'use strict';
  const d=w.document, key='jarvis.avatar3d.v199.', cores=['nova','jarvis','orion'];
  const views=new Map(), enabled=new Set(), colors={nova:190,jarvis:34,orion:280};
  let frame=0,last=0,token=0,track=null,wordUntil=0,utterance=null;
  const tr=()=>d.documentElement.lang.startsWith('tr');
  const label=()=>tr()?'Özgün 3D robot · Yapay karakter':'Original 3D robot · AI character';
  function status(){
    if(track?.envelope)return tr()?'Ses genliğine bağlı çene hareketi · Fonem senkronu değil':'Audio-energy jaw motion · Not phoneme lip sync';
    if(utterance)return tr()?'Kelime olayı animasyonu · Hassas dudak senkronu değil':'Word-event animation · Not precise lip sync';
    return tr()?'Ses eşlemesi yok · Ağız kapalı':'No audio mapping · Mouth closed';
  }
  function level(){
    if(track){const {audio,src,envelope}=track;if(audio.src!==src||audio.paused||audio.ended||audio.seeking||audio.readyState<2||!envelope)return 0;
      return envelope[Math.floor(audio.currentTime*50)]||0;}
    return utterance&&performance.now()<wordUntil ? .45 : 0;
  }
  // A real xyz mesh, perspective projection, depth sorting and per-face lighting.
  function ellipsoid(out,c,r,hue,jaw=false){
    const point=(a,b)=>[c[0]+r[0]*Math.sin(a)*Math.cos(b),c[1]+r[1]*Math.cos(a),c[2]+r[2]*Math.sin(a)*Math.sin(b)];
    for(let i=0;i<10;i++)for(let j=0;j<20;j++){
      const a=i*Math.PI/10,b=j*Math.PI/10;
      const p=point(a,b),q=point(a+Math.PI/10,b),s=point(a+Math.PI/10,b+Math.PI/10),t=point(a,b+Math.PI/10);
      out.push({v:[p,q,s],hue,jaw},{v:[p,s,t],hue,jaw});
    }
  }
  function mesh(hue){const faces=[];
    ellipsoid(faces,[0,.25,0],[.74,1,.59],hue);
    ellipsoid(faces,[0,-.65,.12],[.59,.32,.49],hue,true);
    ellipsoid(faces,[0,-1.17,-.12],[.29,.26,.29],hue);
    ellipsoid(faces,[0,-1.5,-.18],[1.12,.28,.48],hue);
    ellipsoid(faces,[-.3,.3,.55],[.2,.09,.1],190);
    ellipsoid(faces,[.3,.3,.55],[.2,.09,.1],190);
    ellipsoid(faces,[0,-.13,.57],[.08,.13,.09],hue);
    return faces;
  }
  function draw(view,time){
    const {canvas,ctx,faces}=view,r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const ratio=Math.min(w.devicePixelRatio||1,1.5),width=Math.min(720,Math.round(r.width*ratio)),height=Math.min(720,Math.round(r.height*ratio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const mouth=level(),reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const angle=view.angle+(reduced?0:Math.sin(time/2400)*.08),cs=Math.cos(angle),sn=Math.sin(angle);
    const transformed=faces.map(f=>{
      const v=f.v.map(([x,y,z])=>{y-=f.jaw?mouth*.35:0;return [x*cs+z*sn,y,-x*sn+z*cs]});
      return {...f,v,z:v.reduce((n,p)=>n+p[2],0)/3};
    }).sort((a,b)=>a.z-b.z);
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    const scale=Math.min(width,height)*.27;
    for(const f of transformed){const [a,b,c]=f.v,u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
      const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const len=Math.hypot(...normal)||1,light=Math.abs((normal[0]*-.4+normal[1]*.5+normal[2]*.8)/len);
      ctx.beginPath();f.v.forEach((p,i)=>{const perspective=4/(4-p[2]),x=width/2+p[0]*scale*perspective,y=height*.43-p[1]*scale*perspective;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();
      ctx.fillStyle='hsl('+f.hue+' '+(f.hue===190?'85% ':'22% ')+(f.hue===190?35+light*40:12+light*40)+'%)';ctx.fill();
      ctx.strokeStyle='hsla('+f.hue+' 90% 75% / .12)';ctx.lineWidth=.4;ctx.stroke();
    }
    canvas.dataset.mouth=mouth.toFixed(3);canvas.dataset.sync=track?.envelope?'audio-energy':utterance?'word-event':'unavailable';
    if(view.caption)view.caption.textContent=label()+' · '+status();
  }
  function loop(time){frame=0;if(d.hidden||!views.size)return;
    if(time-last>40){last=time;for(const [canvas,view] of views){if(!canvas.isConnected){views.delete(canvas);continue}draw(view,time)}}
    if(views.size)frame=requestAnimationFrame(loop);
  }
  function start(){if(!frame&&!d.hidden&&views.size)frame=requestAnimationFrame(loop)}
  function mount(host,core,caption){const canvas=d.createElement('canvas');canvas.className='ja-robot3d';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label());host.append(canvas);
    const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();throw Error('canvas_unavailable')}
    views.set(canvas,{canvas,ctx,faces:mesh(colors[core]||34),angle:0,caption});start();return canvas;
  }
  function renderCore(core){const host=d.querySelector('.jr-core.'+core+' .jr-sphere');if(!host)return;
    host.querySelectorAll('.ja-robot3d').forEach(c=>{views.delete(c);c.remove()});host.removeAttribute('data-robot3d');
    if(enabled.has(core)){mount(host,core);host.dataset.robot3d='1';}
  }
  function setCore(core,on){if(!cores.includes(core))throw Error('invalid_core');
    if(on)localStorage.setItem(key+core,'1');else localStorage.removeItem(key+core);
    on?enabled.add(core):enabled.delete(core);renderCore(core);
    if(!enabled.size){token++;track=null;utterance=null;wordUntil=0;}
  }
  async function bindAudio(audio,bytes){
    const id=++token;track=null;utterance=null;wordUntil=0;
    if(!enabled.size||!(audio instanceof HTMLMediaElement)||!(bytes instanceof Uint8Array)||bytes.byteLength>6000000)return;
    const src=audio.src,slot={audio,src,envelope:null};track=slot;
    try{const Offline=w.OfflineAudioContext||w.webkitOfflineAudioContext;if(!Offline)return;
      const ctx=new Offline(1,1,16000),buffer=await ctx.decodeAudioData(bytes.slice().buffer);
      if(id!==token||audio.src!==src||buffer.duration>120||audio.ended)return;
      const envelope=new Float32Array(Math.ceil(buffer.duration*50)),step=Math.floor(buffer.sampleRate/50);
      for(let ch=0;ch<buffer.numberOfChannels;ch++){const pcm=buffer.getChannelData(ch);
        for(let n=0;n<envelope.length;n++){let sum=0,count=0;for(let i=n*step;i<Math.min((n+1)*step,pcm.length);i++){sum+=pcm[i]*pcm[i];count++}
          envelope[n]=Math.max(envelope[n],Math.min(1,Math.max(0,Math.sqrt(sum/(count||1))-.015)*5));}}
      if(id===token)slot.envelope=envelope;
    }catch(_){/* Fail closed: no invented sync; original playback is untouched. */}
  }
  function bindUtterance(u){const id=++token;track=null;utterance=null;wordUntil=0;if(!enabled.size)return;
    u.addEventListener('start',()=>{if(id===token){utterance=u;wordUntil=0}});
    u.addEventListener('boundary',()=>{if(utterance===u)wordUntil=performance.now()+130});
    const stop=()=>{if(utterance===u){utterance=null;wordUntil=0}};
    for(const name of ['end','error','pause'])u.addEventListener(name,stop);
  }
  for(const core of cores){try{if(localStorage.getItem(key+core)==='1')enabled.add(core)}catch(_){}renderCore(core)}
  d.addEventListener('visibilitychange',()=>{if(d.hidden){cancelAnimationFrame(frame);frame=0}else start()});
  d.addEventListener('jarvis:cockpit-locale',()=>{for(const [c] of views)c.setAttribute('aria-label',label())});
  w.addEventListener('storage',e=>{if(e.key===null||e.key.startsWith(key)){for(const core of cores){try{localStorage.getItem(key+core)==='1'?enabled.add(core):enabled.delete(core)}catch(_){}renderCore(core)}}});
  w.JarvisAvatar3D=Object.freeze({setCore,isEnabled:core=>enabled.has(core),mount,bindAudio,bindUtterance,
    rotate(canvas,degrees){const v=views.get(canvas);if(v)v.angle=Math.max(-1.1,Math.min(1.1,degrees*Math.PI/180))},status});
})(window);
