self.addEventListener('push',event=>{
  let data={title:'JARVIS',body:'Yeni bir hatırlatmanız var.',url:'/'};
  try{data={...data,...event.data.json()}}catch(e){}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag||'jarvis-reminder',data:{url:data.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=(event.notification.data&&event.notification.data.url)||'/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if('focus'in w){w.navigate(url);return w.focus()}}
    return clients.openWindow?clients.openWindow(url):undefined;
  }));
});