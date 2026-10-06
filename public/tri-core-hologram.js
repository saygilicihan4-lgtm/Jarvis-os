(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.JarvisTriCoreHologram=factory(root);
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const VERSION='1.0';
  const ROLE_INDEX={nova:0,jarvis:1,orion:2};
  const STATE_INDEX={idle:0,waiting:1,listening:2,thinking:3,speaking:4,working:5,error:6};
  function safeIndex(map,value,fallback=0){return Object.prototype.hasOwnProperty.call(map,value)?map[value]:fallback}
  function lowPower(host){
    const nav=host&&host.navigator||{};
    return Number(nav.hardwareConcurrency||8)<=4||Number(nav.deviceMemory||8)<=4;
  }
  function reduced(host){
    try{return !!(host&&host.matchMedia&&host.matchMedia('(prefers-reduced-motion: reduce)').matches)}catch(_){return false}
  }
  function compile(gl,type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader)||'shader_compile_failed';gl.deleteShader(shader);throw new Error(error)}
    return shader;
  }
  function createProgram(gl){
    const vertex='attribute vec2 aPos; varying vec2 vUv; void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
    const fragment=[
      'precision mediump float;','varying vec2 vUv;','uniform vec2 uResolution;','uniform float uTime;','uniform float uRole;','uniform float uState;','uniform float uConsult;','uniform float uMotion;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
      'float ring(vec2 p,vec2 c,float r,float w){float d=abs(length(p-c)-r);return smoothstep(w,0.0,d);}',
      'float orb(vec2 p,vec2 c,float phase){vec2 q=p-c;float d=length(q);float a=atan(q.y,q.x);float rings=ring(p,c,.118,.008)+.65*ring(p,c,.086,.006)+.45*ring(p,c,.054,.005);float rays=pow(max(0.0,cos(a*18.0+uTime*(.7+phase))),18.0)*smoothstep(.17,.035,d);float core=smoothstep(.055,0.0,d);float cell=hash(floor((q+vec2(.22))*75.0));float sparks=step(.986,cell)*smoothstep(.18,.035,d)*(0.45+0.55*sin(uTime*3.0+cell*30.0));return rings+rays*.8+core*1.6+sparks*.85;}',
      'void main(){vec2 p=vUv-.5;float aspect=uResolution.x/max(uResolution.y,1.0);p.x*=aspect;float spread=min(.36*aspect,.47);vec2 c0=vec2(-spread,0.0),c1=vec2(0.0,0.0),c2=vec2(spread,0.0);float e0=orb(p,c0,.13),e1=orb(p,c1,.37),e2=orb(p,c2,.71);vec3 cyan=vec3(.396,.902,1.0),amber=vec3(1.0,.604,.184),violet=vec3(.776,.361,1.0);float a0=(uRole<.5?1.0:.48),a1=(uRole>.5&&uRole<1.5?1.0:.48),a2=(uRole>1.5?1.0:.48);if(uConsult>.5){a0=max(a0,.78);a1=max(a1,.78);a2=max(a2,.78);}float stateBoost=1.0;if(uState>1.5&&uState<6.5)stateBoost=1.28;if(uState>5.5)stateBoost=1.55;vec3 col=(cyan*e0*a0+amber*e1*a1+violet*e2*a2)*stateBoost;float line=smoothstep(.012,0.0,abs(p.y))*smoothstep(spread+.03,spread-.01,abs(p.x));float pulse=.45+.55*sin((p.x+uTime*.22)*36.0);float flow=(uConsult>.5||uState>2.5?line*(.25+.7*pulse):line*.08);col+=mix(cyan,violet,smoothstep(-spread,spread,p.x))*flow;float vign=smoothstep(.78,.18,length(p));col*=vign;float alpha=clamp(max(max(col.r,col.g),col.b)*.72,0.0,.92);if(uState>5.5){col=mix(col,vec3(1.0,.12,.2),.48+.18*sin(uTime*16.0));}gl_FragColor=vec4(col,alpha);}'
    ].join('\n');
    const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const error=gl.getProgramInfoLog(program)||'program_link_failed';gl.deleteProgram(program);throw new Error(error)}
    return program;
  }
  function install(host=root){
    const doc=host&&host.document;if(!doc||!doc.body)return false;
    if(doc.body.dataset.referenceCockpit==='1')return false;
    const stage=doc.querySelector('.core-stage');if(!stage)return false;
    if(doc.getElementById('jarvisTriCoreWebgl'))return true;
    if(lowPower(host)){doc.body.dataset.jarvisCoreFx='lite';return false}
    const canvas=doc.createElement('canvas');canvas.id='jarvisTriCoreWebgl';canvas.setAttribute('aria-hidden','true');stage.prepend(canvas);
    let gl;
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,powerPreference:'low-power'})}catch(_){}
    if(!gl){canvas.remove();doc.body.dataset.jarvisCoreFx='lite';return false}
    let program;
    try{program=createProgram(gl)}catch(_){canvas.remove();doc.body.dataset.jarvisCoreFx='lite';return false}
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.useProgram(program);const pos=gl.getAttribLocation(program,'aPos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const uniforms={};for(const name of ['uResolution','uTime','uRole','uState','uConsult','uMotion'])uniforms[name]=gl.getUniformLocation(program,name);
    const motion=reduced(host)?0:1;let raf=0,dead=false,lastW=0,lastH=0,resizeObserver=null;
    function dispose(){if(dead)return;dead=true;if(raf)host.cancelAnimationFrame(raf);resizeObserver?.disconnect();gl.deleteBuffer(buffer);gl.deleteProgram(program);canvas.remove();doc.removeEventListener('jarvis:cockpit-ready',dispose);doc.removeEventListener('visibilitychange',visibility);doc.body.dataset.jarvisCoreFx='superseded'}
    function visibility(){if(dead)return;if(doc.hidden){if(raf)host.cancelAnimationFrame(raf);raf=0}else draw()}
    function resize(){
      const rect=stage.getBoundingClientRect(),dpr=Math.min(Number(host.devicePixelRatio||1),1.5),w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
      if(w!==lastW||h!==lastH){canvas.width=w;canvas.height=h;lastW=w;lastH=h;gl.viewport(0,0,w,h)}
    }
    function snapshot(){
      const role=doc.body.dataset.jarvisCore||'nova',state=doc.body.dataset.jarvisCoreState||'idle',consult=doc.body.dataset.jarvisCoreCollab==='1';
      return{role:safeIndex(ROLE_INDEX,role,0),state:safeIndex(STATE_INDEX,state,0),consult:consult?1:0};
    }
    function draw(ms=0){
      raf=0;if(doc.body.dataset.referenceCockpit==='1'){dispose();return}if(doc.hidden)return;
      if(dead)return;resize();const s=snapshot();gl.useProgram(program);gl.uniform2f(uniforms.uResolution,lastW,lastH);gl.uniform1f(uniforms.uTime,motion?ms/1000:0);gl.uniform1f(uniforms.uRole,s.role);gl.uniform1f(uniforms.uState,s.state);gl.uniform1f(uniforms.uConsult,s.consult);gl.uniform1f(uniforms.uMotion,motion);gl.drawArrays(gl.TRIANGLES,0,6);
      if(motion)raf=host.requestAnimationFrame(draw);
    }
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();dead=true;if(raf)host.cancelAnimationFrame(raf);doc.body.dataset.jarvisCoreFx='lite'},{once:true});
    doc.addEventListener('jarvis:cockpit-ready',dispose,{once:true});doc.addEventListener('visibilitychange',visibility);
    if(typeof host.ResizeObserver==='function'){resizeObserver=new host.ResizeObserver(()=>{if(!motion)draw(0)});resizeObserver.observe(stage)}
    draw(0);doc.body.dataset.jarvisCoreFx='webgl';return true;
  }
  return Object.freeze({VERSION,ROLE_INDEX,STATE_INDEX,lowPower,reduced,install});
});

;(function(host){
  if(!host||!host.document)return;
  const doc=host.document;
  if(doc.getElementById('jarvisReferenceCockpitScript'))return;
  const script=doc.createElement('script');
  script.id='jarvisReferenceCockpitScript';
  script.src='/reference-cockpit.js';
  script.async=false;
  (doc.head||doc.documentElement).appendChild(script);
})(typeof window!=='undefined'?window:null);

;(function(host){
  if(!host||!host.document)return;
  const doc=host.document;
  function boot(attempt=0){
    if(doc.getElementById('jarvisReferenceCockpitI18nScript'))return true;
    if(!doc.getElementById('jarvisReferenceCockpit')&&attempt<80){setTimeout(()=>boot(attempt+1),100);return false}
    const script=doc.createElement('script');script.id='jarvisReferenceCockpitI18nScript';script.src='/reference-cockpit-i18n.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  setTimeout(()=>boot(0),0);
})(typeof window!=='undefined'?window:null);

// v185 canonical portrait cockpit loader. Presentation-only: authority remains on the legacy cockpit/mission bridges.
;(function(host){
  if(!host||!host.document)return;
  const doc=host.document;
  function boot(attempt=0){
    if(doc.getElementById('jarvisMobileCanonicalScript'))return true;
    if(!doc.getElementById('jarvisReferenceCockpit')&&attempt<100){setTimeout(()=>boot(attempt+1),80);return false}
    const script=doc.createElement('script');script.id='jarvisMobileCanonicalScript';script.src='/mobile-canonical-cockpit.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  setTimeout(()=>boot(0),0);
})(typeof window!=='undefined'?window:null);

// v189 phone visual-fit loader. Presentation-only: fixes viewport/touch rendering and owns no execution authority.
;(function(host){
  if(!host||!host.document)return;
  const doc=host.document;
  function boot(attempt=0){
    if(doc.getElementById('jarvisMobileVisualFitV189Script'))return true;
    if(!doc.getElementById('jarvisMobileCanonical')&&attempt<140){setTimeout(()=>boot(attempt+1),60);return false}
    const script=doc.createElement('script');script.id='jarvisMobileVisualFitV189Script';script.src='/mobile-visual-fit-v189.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  setTimeout(()=>boot(0),0);
})(typeof window!=='undefined'?window:null);

// v186 mobile approval review loader. Review UI proxies the existing mission approval buttons; it owns no approval authority.
;(function(host){
  if(!host||!host.document)return;
  const doc=host.document;
  function boot(attempt=0){
    if(doc.getElementById('jarvisMobileApprovalReviewScript'))return true;
    if(!doc.getElementById('jarvisMobileCanonical')&&attempt<120){setTimeout(()=>boot(attempt+1),80);return false}
    const script=doc.createElement('script');script.id='jarvisMobileApprovalReviewScript';script.src='/mobile-approval-review.js';script.async=false;
    (doc.head||doc.documentElement).appendChild(script);return true;
  }
  setTimeout(()=>boot(0),0);
})(typeof window!=='undefined'?window:null);
