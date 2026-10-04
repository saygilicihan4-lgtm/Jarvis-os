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