'use strict';
const fs=require('fs'),vm=require('vm');
function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0)throw new Error('missing '+label);
  if(text.indexOf(from,i+from.length)>=0)throw new Error('ambiguous '+label);
  return text.slice(0,i)+to+text.slice(i+from.length);
}

let source=fs.readFileSync('scripts/v131-apply.js','utf8');
const oldPoll=`worker=once(worker,"      await serviceMobileTts();\\n      await serviceMobileBrain();","      await serviceMobileTts();\\n      await serviceMobileLanguage();\\n      await serviceMobileBrain();",'worker poll mobile language');`;
const newPoll=`worker=once(worker,"    await serviceMobileTts();\\n    await serviceMobileBrain();","    await serviceMobileTts();\\n    await serviceMobileLanguage();\\n    await serviceMobileBrain();",'worker poll mobile language');`;
source=replaceOnce(source,oldPoll,newPoll,'worker poll source anchor');
vm.runInThisContext(source,{filename:'v131-apply.js'});

let worker=fs.readFileSync('worker.js','utf8');
worker=replaceOnce(worker,
`  setInterval(()=>serviceMobileBrain().catch(()=>{}),650);\n  setInterval(()=>serviceMobileTts().catch(()=>{}),650);`,
`  setInterval(()=>serviceMobileBrain().catch(()=>{}),650);\n  setInterval(()=>serviceMobileTts().catch(()=>{}),650);\n  setInterval(()=>serviceMobileLanguage().catch(()=>{}),650);`,
'fast mobile language poll');
fs.writeFileSync('worker.js',worker,'utf8');

let html=fs.readFileSync('public/index.html','utf8');
html=replaceOnce(html,
`async function mobileLanguageConversationRequest(data,signal){`,
`function waitMobileLanguagePoll(signal,ms=450){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);fn(value)};
    const onAbort=()=>finish(reject,new Error('mobile_language_cancelled'));
    const timer=setTimeout(()=>finish(resolve),ms);
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted)onAbort();
  });
}
async function mobileLanguageConversationRequest(data,signal){`,
'mobile polling helper');
html=replaceOnce(html,
`      await new Promise((resolve,reject)=>{const t=setTimeout(resolve,450);if(signal)signal.addEventListener('abort',()=>{clearTimeout(t);reject(new Error('mobile_language_cancelled'))},{once:true})});`,
`      await waitMobileLanguagePoll(signal,450);`,
'mobile polling listener cleanup');
html=replaceOnce(html,
`if(!/Windows/i.test(navigator.userAgent)||isMobileJarvis()){
  languageChatBtn.disabled=true;languageChatStatus.textContent='Çok dilli sohbet: Windows PC';
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)languageChatClient?.cancel()});
window.addEventListener('pagehide',()=>languageChatClient?.cancel());`,
`if(!/Windows/i.test(navigator.userAgent)&&!isMobileJarvis()){
  languageChatBtn.disabled=true;languageChatStatus.textContent='Çok dilli sohbet: Windows PC veya desteklenen telefon tarayıcısı';
}else if(isMobileJarvis()){
  languageChatBtn.disabled=false;
  languageChatStatus.textContent=SpeechRecognition?'Çok dilli sohbet: telefon hazır · STT öğrenme kapalı':'Çok dilli sohbet: tarayıcı konuşma tanıma desteği doğrulanmadı';
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){languageChatClient?.cancel();mobileLanguageChatClient?.cancel()}});
window.addEventListener('pagehide',()=>{languageChatClient?.cancel();mobileLanguageChatClient?.cancel()});`,
'mobile button and background cancellation');
fs.writeFileSync('public/index.html',html,'utf8');
console.log('v131 fixed integration and REDTEAM lifecycle hardening applied');
