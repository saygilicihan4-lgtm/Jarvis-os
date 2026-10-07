(function(w){'use strict';const d=w.document;let panel,frame;
 function open(){if(!panel){panel=d.createElement('dialog');panel.style.cssText='padding:0;border:1px solid #66d8ff;background:#000;color:white;width:96vw;height:94dvh;max-width:none;max-height:none';
  const close=d.createElement('button');close.type='button';close.style.cssText='display:block;min-height:44px;min-width:80px;margin:4px;background:#10212d;color:white;border:1px solid #72d9ff';close.textContent=d.documentElement.lang.startsWith('tr')?'Kapat':'Close';
  frame=d.createElement('iframe');frame.title='JARVIS human projection';frame.allow='fullscreen';frame.style.cssText='border:0;width:100%;height:calc(100% - 52px);display:block';
  frame.src='/human-avatar-v200.html?lang='+encodeURIComponent(d.documentElement.lang.startsWith('tr')?'tr':'en');
  const stop=()=>{try{frame.contentWindow.JarvisHumanStage?.stop()}catch(_){}};close.onclick=()=>{stop();panel.close()};panel.addEventListener('cancel',stop);panel.append(close,frame);d.body.append(panel);
 }panel.showModal();try{frame.contentWindow.JarvisHumanStage?.resume()}catch(_){}}
 function bindAudio(media,bytes){if(!panel?.open)return;try{Promise.resolve(frame.contentWindow.JarvisHumanStage?.bindAudio(media,bytes)).catch(()=>{})}catch(_){}}
 w.JarvisHumanAvatar=Object.freeze({open,bindAudio});
})(window);
