function missionIdFromTag(tag){
  const match=String(tag||'').match(/^jarvis-mission-(M-[A-Z0-9-]{12,80})$/);
  return match?match[1]:'';
}
function completedMissionTitle(title){
  return /(?:görev\s+tamamlandı|kalıcı\s+görev\s+tamamlandı|mission\s+completed)/i.test(String(title||''));
}
function safeNotificationUrl(value,tag,title=''){
  const missionId=missionIdFromTag(tag);
  if(missionId&&!completedMissionTitle(title))return '/?mission='+encodeURIComponent(missionId);
  const url=String(value||'/').trim();
  if(!/^\/(?!\/)/.test(url)||/[\\\r\n]/.test(url))return'/';
  return url;
}

const MISSION_ACTION_REPLAY_TTL_MS=45000;
const missionActionReplay=new Map();
function missionActionReplayKeyFromMessage(value){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  const match=text.match(/^(onayla|iptal et)\s+(M-[A-Z0-9-]{12,80})\s+req\s+([a-f0-9]{20})$/i);
  if(!match)return'';
  const action=match[1].toLowerCase()==='onayla'?'approve':'cancel';
  return'mission-action:'+action+':'+match[2].toUpperCase()+':'+match[3].toLowerCase();
}
async function missionActionReplayKey(request){
  if(!request||String(request.method||'').toUpperCase()!=='POST')return'';
  try{
    const data=await request.clone().json();
    return missionActionReplayKeyFromMessage(data&&data.message);
  }catch(_){return''}
}
function pruneMissionActionReplay(now=Date.now()){
  const stamp=Number(now)||Date.now();
  for(const [key,item] of missionActionReplay.entries()){
    if(stamp-Number(item&&item.createdAt||0)>=MISSION_ACTION_REPLAY_TTL_MS)missionActionReplay.delete(key);
  }
}
function clearMissionActionReplay(){missionActionReplay.clear()}
async function coalesceMissionActionRequest(request,networkFetch,now=Date.now()){
  if(typeof networkFetch!=='function')throw new Error('mission_replay_fetch_unavailable');
  const key=await missionActionReplayKey(request);
  if(!key)return networkFetch(request);
  const stamp=Number(now)||Date.now();
  pruneMissionActionReplay(stamp);
  const existing=missionActionReplay.get(key);
  if(existing){
    const cached=await existing.promise;
    return cached.clone();
  }
  const promise=Promise.resolve()
    .then(()=>networkFetch(request))
    .then(response=>{
      if(!response||typeof response.clone!=='function')throw new Error('mission_replay_response_invalid');
      const cached=response.clone();
      if(response.ok!==true)missionActionReplay.delete(key);
      return cached;
    })
    .catch(error=>{missionActionReplay.delete(key);throw error});
  missionActionReplay.set(key,{createdAt:stamp,promise});
  const cached=await promise;
  return cached.clone();
}

self.addEventListener('push',event=>{
  let data={title:'JARVIS',body:'Yeni bir hatırlatmanız var.',url:'/'};
  try{data={...data,...event.data.json()}}catch(e){}
  const tag=String(data.tag||'jarvis-reminder');
  const url=safeNotificationUrl(data.url,tag,data.title);
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag,data:{url,title:String(data.title||'')}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{};
  const url=safeNotificationUrl(data.url,event.notification.tag,data.title||event.notification.title);
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if('focus'in w){w.navigate(url);return w.focus()}}
    return clients.openWindow?clients.openWindow(url):undefined;
  }));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  let url;
  try{url=new URL(request.url)}catch(_){return}
  if(String(request.method||'').toUpperCase()!=='POST'||url.origin!==self.location.origin||url.pathname!=='/api/mobile-brain')return;
  event.respondWith(coalesceMissionActionRequest(request,input=>fetch(input)));
});