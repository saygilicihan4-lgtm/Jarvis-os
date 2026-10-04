(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisTriCoreWebGL=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const COLORS={jarvis:[1,.42,.08],nova:[.16,.82,1],orion:[.72,.22,1],error:[1,.08,.16]};
  const CENTERS={nova:-1.75,jarvis:0,orion:1.75};
  const ORDER=['nova','jarvis','orion'];
  let instance=null;

  function shader(gl,type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s)||'shader_compile_failed';gl.deleteShader(s);throw new Error(msg)}
    return s;
  }
  function program(gl){
    const vs=shader(gl,gl.VERTEX_SHADER,'attribute vec3 aPos;attribute vec3 aColor;attribute float aSize;uniform float uAspect;varying vec3 vColor;varying float vDepth;void main(){float perspective=1.0/(1.72-aPos.z*.22);gl_Position=vec4((aPos.x*perspective)/uAspect,aPos.y*perspective,0.0,1.0);gl_PointSize=max(1.0,aSize*perspective);vColor=aColor;vDepth=clamp(.55+aPos.z*.25,0.2,1.0);}');
    const fs=shader(gl,gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vColor;varying float vDepth;uniform float uPointMode;void main(){float alpha=vDepth;if(uPointMode>0.5){vec2 p=gl_PointCoord*2.0-1.0;float d=dot(p,p);if(d>1.0)discard;alpha*=1.0-smoothstep(.05,1.0,d);}gl_FragColor=vec4(vColor,alpha*.78);}');
    const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const msg=gl.getProgramInfoLog(p)||'program_link_failed';gl.deleteProgram(p);throw new Error(msg)}
    return p;
  }
  function seeded(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
  function particleSeeds(count){
    const rand=seeded(179),out=[];
    for(const role of ORDER){
      for(let i=0;i<count;i++){
        const u=rand(),v=rand(),w=rand();
        out.push({role,theta:u*Math.PI*2,phi:Math.acos(2*v-1),radius:.42+w*.25,phase:rand()*Math.PI*2,size:1.2+rand()*2.8});
      }
    }
    return out;
  }
  function stateEnergy(state){return({idle:.55,listening:.9,thinking:1.05,speaking:1.0,working:1.15,error:1.2,waiting:.38})[state]||.55}
  function stateSpeed(state){return({idle:.18,listening:.42,thinking:.72,speaking:.5,working:.88,error:1.05,waiting:.08})[state]||.18}
  function colorFor(role,state,active){
    const base=state==='error'?COLORS.error:COLORS[role],boost=active?1:.52;
    return base.map(x=>Math.min(1,x*boost+.04));
  }
  function ringPoints(role,time,state,active){
    const points=[],c=colorFor(role,state,active),energy=stateEnergy(state),cx=CENTERS[role],layers=active?4:3;
    for(let layer=0;layer<layers;layer++){
      const n=56,r=.47+layer*.075,tilt=(layer*.43)+(role==='nova'?.22:role==='orion'?-0.31:0),spin=time*(.10+layer*.025)*stateSpeed(state)*(layer%2?1:-1);
      for(let i=0;i<=n;i++){
        const a=(i/n)*Math.PI*2+spin;
        const x=cx+Math.cos(a)*r;
        const y=Math.sin(a)*r*Math.cos(tilt);
        const z=Math.sin(a)*r*Math.sin(tilt)*.9;
        points.push(x,y,z,c[0]*energy,c[1]*energy,c[2]*energy,1.35);
      }
    }
    return points;
  }
  function bridgePoints(active,time,state){
    if(!['thinking','working'].includes(state))return[];
    const out=[],from=CENTERS[active],targets=ORDER.filter(x=>x!==active),energy=stateEnergy(state);
    for(const target of targets){
      const to=CENTERS[target],mix=COLORS[target],base=COLORS[active],segments=34;
      for(let i=0;i<=segments;i++){
        const t=i/segments,arc=Math.sin(t*Math.PI)*.14;
        const x=from+(to-from)*t,y=arc,z=Math.sin(t*Math.PI*2+time*.8)*.035;
        out.push(x,y,z,(base[0]*(1-t)+mix[0]*t)*energy,(base[1]*(1-t)+mix[1]*t)*energy,(base[2]*(1-t)+mix[2]*t)*energy,1.15);
      }
    }
    return out;
  }
  function packetPoints(active,time,state){
    if(!['thinking','working'].includes(state))return[];
    const out=[],from=CENTERS[active];
    for(const target of ORDER.filter(x=>x!==active)){
      const to=CENTERS[target],mix=COLORS[target],base=COLORS[active];
      for(let k=0;k<4;k++){
        const t=(time*(state==='working'?.42:.27)+k*.21)%1,arc=Math.sin(t*Math.PI)*.14;
        out.push(from+(to-from)*t,arc,Math.sin(t*Math.PI*2+time)*.04,Math.min(1,base[0]+mix[0]),Math.min(1,base[1]+mix[1]),Math.min(1,base[2]+mix[2]),4.5);
      }
    }
    return out;
  }
  function install(targetRoot=root){
    const host=targetRoot&&targetRoot.document?targetRoot:root,doc=host&&host.document;
    if(!doc||!doc.body)return false;
    if(instance)return true;
    const stage=doc.querySelector('.core-stage');if(!stage)return false;
    const canvas=doc.createElement('canvas');canvas.id='jarvisTriCoreWebgl';canvas.setAttribute('aria-hidden','true');stage.insertBefore(canvas,stage.firstChild);
    let gl=null;
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'})||canvas.getContext('experimental-webgl')}
    catch(_){}
    if(!gl){canvas.remove();doc.body.dataset.jarvisWebgl='fallback';return false}
    let p;
    try{p=program(gl)}catch(_){canvas.remove();doc.body.dataset.jarvisWebgl='fallback';return false}
    doc.body.dataset.jarvisWebgl='active';
    gl.useProgram(p);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
    const posLoc=gl.getAttribLocation(p,'aPos'),colorLoc=gl.getAttribLocation(p,'aColor'),sizeLoc=gl.getAttribLocation(p,'aSize'),aspectLoc=gl.getUniformLocation(p,'uAspect'),pointModeLoc=gl.getUniformLocation(p,'uPointMode');
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const stride=7*4;gl.enableVertexAttribArray(posLoc);gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(colorLoc);gl.vertexAttribPointer(colorLoc,3,gl.FLOAT,false,stride,3*4);gl.enableVertexAttribArray(sizeLoc);gl.vertexAttribPointer(sizeLoc,1,gl.FLOAT,false,stride,6*4);
    const reduced=!!(host.matchMedia&&host.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const nav=host.navigator||{},lowPower=Number(nav.deviceMemory||8)<=4||Number(nav.hardwareConcurrency||8)<=4;
    const seeds=particleSeeds(reduced?28:(lowPower?72:150));
    let raf=0,last=0,dead=false;
    function resize(){
      const dpr=Math.min(Number(host.devicePixelRatio||1),lowPower?1:1.6),w=Math.max(1,Math.floor(stage.clientWidth*dpr)),h=Math.max(1,Math.floor(stage.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
      gl.uniform1f(aspectLoc,w/Math.max(1,h));
    }
    function drawArray(values,mode,pointMode){
      if(!values.length)return;
      const data=new Float32Array(values);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.uniform1f(pointModeLoc,pointMode?1:0);gl.drawArrays(mode,0,data.length/7);
    }
    function frame(ms){
      if(dead)return;
      const hidden=doc.hidden;if(hidden){raf=host.requestAnimationFrame(frame);return}
      const fps=reduced?5:(lowPower?30:60),min=1000/fps;if(ms-last<min){raf=host.requestAnimationFrame(frame);return}last=ms;
      resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      const time=ms/1000,state=String(doc.body.dataset.jarvisCoreState||'idle'),active=String(doc.body.dataset.jarvisCore||'nova');
      const speed=stateSpeed(state),energy=stateEnergy(state),particles=[];
      for(const s of seeds){
        const isActive=s.role===active,c=colorFor(s.role,state,isActive),a=s.theta+time*speed*(isActive?1.2:.7)+s.phase*.08;
        const wobble=Math.sin(time*(state==='listening'?2.4:.8)+s.phase)*.018*energy;
        const r=s.radius*(1+wobble),sinPhi=Math.sin(s.phi),x=CENTERS[s.role]+Math.cos(a)*sinPhi*r,y=Math.cos(s.phi)*r,z=Math.sin(a)*sinPhi*r;
        particles.push(x,y,z,c[0]*energy,c[1]*energy,c[2]*energy,s.size*(isActive?1.35:.75));
      }
      drawArray(particles,gl.POINTS,true);
      for(const role of ORDER){const rings=ringPoints(role,time,state,role===active),layerSize=(56+1)*7;for(let offset=0;offset<rings.length;offset+=layerSize)drawArray(rings.slice(offset,offset+layerSize),gl.LINE_STRIP,false)}
      const bridges=bridgePoints(active,time,state),bridgeSize=(34+1)*7;for(let offset=0;offset<bridges.length;offset+=bridgeSize)drawArray(bridges.slice(offset,offset+bridgeSize),gl.LINE_STRIP,false);
      drawArray(packetPoints(active,time,state),gl.POINTS,true);
      raf=host.requestAnimationFrame(frame);
    }
    raf=host.requestAnimationFrame(frame);
    instance={canvas,gl,destroy(){dead=true;if(raf)host.cancelAnimationFrame(raf);try{gl.deleteBuffer(buffer);gl.deleteProgram(p)}catch(_){}canvas.remove();instance=null}};
    return true;
  }
  function destroy(){if(instance)instance.destroy()}
  return{COLORS,CENTERS,ORDER,stateEnergy,stateSpeed,install,destroy};
});
