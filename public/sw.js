function missionIdFromTag(tag){
  const match=String(tag||'').match(/^jarvis-mission-(M-[A-Z0-9-]{12,80})$/);
  return match?match[1]:'';
}
function safeNotificationUrl(value,tag){
  const missionId=missionIdFromTag(tag);
  if(missionId)return '/?mission='+encodeURIComponent(missionId);
  const url=String(value||'/').trim();
  return /^\/(?!\/)/.test(url)?url:'/';
}
self.addEventListener('push',event=>{
  let data={title:'JARVIS',body:'Yeni bir hatırlatmanız var.',url:'/'};
  try{data={...data,...event.data.json()}}catch(e){}
  const tag=String(data.tag||'jarvis-reminder');
  const url=safeNotificationUrl(data.url,tag);
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag,data:{url}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=safeNotificationUrl(event.notification.data&&event.notification.data.url,event.notification.tag);
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if('focus'in w){w.navigate(url);return w.focus()}}
    return clients.openWindow?clients.openWindow(url):undefined;
  }));
});