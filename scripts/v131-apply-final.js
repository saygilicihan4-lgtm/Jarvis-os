'use strict';
const fs=require('fs');
require('./v131-apply-fixed');
function once(text,from,to,label){const i=text.indexOf(from);if(i<0)throw new Error('missing '+label);if(text.indexOf(from,i+from.length)>=0)throw new Error('ambiguous '+label);return text.slice(0,i)+to+text.slice(i+from.length)}
let html=fs.readFileSync('public/index.html','utf8');
html=once(html,
"  if(!ok){languageChatClient?.cancel();mobileLanguageChatClient?.cancel();}",
"  if(!ok)languageChatClient?.cancel();\n  if(!ok)mobileLanguageChatClient?.cancel();",
'legacy auth cancellation contract');
html=once(html,
"document.addEventListener('visibilitychange',()=>{if(document.hidden){languageChatClient?.cancel();mobileLanguageChatClient?.cancel()}});\nwindow.addEventListener('pagehide',()=>{languageChatClient?.cancel();mobileLanguageChatClient?.cancel()});",
"document.addEventListener('visibilitychange',()=>{if(document.hidden)languageChatClient?.cancel();if(document.hidden)mobileLanguageChatClient?.cancel()});\nwindow.addEventListener('pagehide',()=>{languageChatClient?.cancel();mobileLanguageChatClient?.cancel()});",
'legacy visibility cancellation contract');
fs.writeFileSync('public/index.html',html,'utf8');
console.log('v131 legacy PC cancellation contracts preserved with mobile cancellation');
