'use strict';
const fs=require('fs');
const p='public/index.html';
let s=fs.readFileSync(p,'utf8');
function once(from,to,label){
  const first=s.indexOf(from);
  if(first<0)throw new Error('missing anchor: '+label);
  if(s.indexOf(from,first+from.length)>=0)throw new Error('ambiguous anchor: '+label);
  s=s.slice(0,first)+to+s.slice(first+from.length);
}
once("        if(window.voiceState)voiceState.textContent='VOICE: AHMETNEURAL RELAY';","        if(window.voiceState)voiceState.textContent='VOICE: '+String(locale||'').toUpperCase()+' RELAY';",'truthful locale status');
once("  }\n  throw new Error('mobile tts timeout');\n}\nfunction speak(text,lang=activeLanguage,tone='balanced'){","  }\n  if(activeMobileTtsRequestId===cj.id)activeMobileTtsRequestId='';\n  await fetch('/api/mobile-tts/'+encodeURIComponent(cj.id)+'/cancel',{method:'POST',credentials:'same-origin'}).catch(()=>null);\n  throw new Error('mobile tts timeout');\n}\nfunction speak(text,lang=activeLanguage,tone='balanced'){",'timeout cancellation');
fs.writeFileSync(p,s,'utf8');
console.log('v130 mobile timeout/status hardening applied');
