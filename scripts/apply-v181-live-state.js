'use strict';
const fs=require('fs');

function replaceOnce(file,from,to,label){
  let source=fs.readFileSync(file,'utf8');
  if(source.includes(to))return false;
  const first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0)throw new Error(label+': anchor missing');
  if(first!==last)throw new Error(label+': anchor not unique');
  source=source.slice(0,first)+to+source.slice(first+from.length);
  fs.writeFileSync(file,source);
  return true;
}

let changed=0;
changed+=replaceOnce('worker.js',
`            case 'create':result=conversation.create({requested:d.requested});break;
            case 'turn':result=await conversation.turn(sessionId,{signal:controller.signal});break;`,
`            case 'create':result=conversation.create({requested:d.requested});break;
            case 'state':result=conversation.state(sessionId);break;
            case 'turn':result=await conversation.turn(sessionId,{signal:controller.signal});break;`,
'worker desktop cognitive state action');

changed+=replaceOnce('worker.js',
`    let result;
    try{result=await getMobileLanguageEngine().turn(q)}catch(e){result={ok:false,state:'failed',reason:String(e.message||e),locale:q.locale,learning:false,deviceE2eVerified:false}}
    await api('/api/worker/mobile-language-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,locale:q.locale,ok:result.ok===true,result,error:result.ok===true?null:String(result.reason||'mobile language failed')})});`,
`    let result,stateChain=Promise.resolve();
    const pushCognitive=raw=>{
      const source=raw&&typeof raw==='object'?raw:{},allowed=new Set(['jarvis','nova','orion']),phases=new Set(['idle','listening','thinking','consulting','synthesizing','waiting','speaking','error']);
      const primary=allowed.has(source.primary)?source.primary:null,clean=list=>Array.isArray(list)?list.filter((id,index,array)=>allowed.has(id)&&id!==primary&&array.indexOf(id)===index).slice(0,2):[];
      const state={phase:phases.has(source.phase)?source.phase:'waiting',primary,consulting:clean(source.consulting),completed:clean(source.completed),revision:Number.isSafeInteger(Number(source.revision))?Number(source.revision):0,authority:'shared_guardrail_only'};
      stateChain=stateChain.then(()=>api('/api/worker/mobile-language-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,state})})).catch(()=>null);
    };
    try{result=await getMobileLanguageEngine().turn(q,{onCognitiveState:pushCognitive})}catch(e){result={ok:false,state:'failed',reason:String(e.message||e),locale:q.locale,learning:false,deviceE2eVerified:false}}
    await stateChain;
    await api('/api/worker/mobile-language-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:q.id,locale:q.locale,ok:result.ok===true,result,error:result.ok===true?null:String(result.reason||'mobile language failed')})});`,
'worker mobile cognitive state transport');

changed+=replaceOnce('server.js',
`    if(r.status==='ready')return json(res,200,{ok:true,status:'ready',result:r.result,learning:false});
    if(r.status==='failed')return json(res,200,{ok:false,status:'failed',error:r.error||'mobile language failed',learning:false});
    return json(res,200,{ok:true,status:r.status,learning:false});`,
`    const cognitive=mobileLanguageRelay.getCognitive(r);
    if(r.status==='ready')return json(res,200,{ok:true,status:'ready',result:r.result,cognitive,learning:false});
    if(r.status==='failed')return json(res,200,{ok:false,status:'failed',error:r.error||'mobile language failed',cognitive,learning:false});
    return json(res,200,{ok:true,status:r.status,cognitive,learning:false});`,
'server mobile cognitive polling response');

changed+=replaceOnce('server.js',
`  if(pathname==='/api/worker/mobile-language-result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{`,
`  if(pathname==='/api/worker/mobile-language-state'&&req.method==='POST'){
    return readJson(req,(err,d)=>{
      if(err)return json(res,400,{error:'bad json'});
      const r=state.mobileLanguageRequests.get(String(d.id||''));
      if(!r)return json(res,404,{error:'mobile language request not found'});
      const deviceId=String(req.headers['x-jarvis-device-id']||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'pc';
      const updated=mobileLanguageRelay.updateCognitive(r,{workerId:deviceId,state:d.state});
      if(!updated.ok)return json(res,409,{error:updated.reason,status:r.status});
      return json(res,200,{ok:true,cognitive:updated.cognitive});
    });
  }
  if(pathname==='/api/worker/mobile-language-result'&&req.method==='POST'){
    return readJson(req,(err,d)=>{`,
'server worker cognitive state endpoint');

changed+=replaceOnce('public/index.html',
`async function mobileLanguageConversationRequest(data,signal){`,
`function applyMobileTriCoreCognitive(value){
  try{
    const source=value&&typeof value==='object'?value:{},allowed=new Set(['jarvis','nova','orion']),phaseState={idle:'idle',listening:'listening',thinking:'thinking',consulting:'thinking',synthesizing:'thinking',waiting:'waiting',speaking:'speaking',error:'error'};
    const core=allowed.has(source.primary)?source.primary:null,consultWith=[];
    for(const id of [...(Array.isArray(source.consulting)?source.consulting:[]),...(Array.isArray(source.completed)?source.completed:[])])if(allowed.has(id)&&id!==core&&!consultWith.includes(id)&&consultWith.length<2)consultWith.push(id);
    document.dispatchEvent(new CustomEvent('jarvis:conversation-state',{detail:{state:phaseState[source.phase]||'waiting',core,consultWith,authority:'shared_guardrail_only'}}));
  }catch(_){}
}
async function mobileLanguageConversationRequest(data,signal){`,
'mobile UI cognitive state mapper');

changed+=replaceOnce('public/index.html',
`      const state=await api('/api/mobile-language/'+encodeURIComponent(id),{cache:'no-store',signal});
      if(state.status==='ready'&&state.result){finished=true;return state.result}`,
`      const state=await api('/api/mobile-language/'+encodeURIComponent(id),{cache:'no-store',signal});
      if(state.cognitive)applyMobileTriCoreCognitive(state.cognitive);
      if(state.status==='ready'&&state.result){finished=true;return state.result}`,
'mobile UI cognitive polling dispatch');

console.log('v181 deterministic live-state patch complete; changed anchors:',changed);
