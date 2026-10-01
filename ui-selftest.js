const fs=require('fs');
const html=fs.readFileSync('public/index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
if(!scripts.length)throw new Error('No inline script found');
for(const [i,s] of scripts.entries()){
  try{new Function(s)}
  catch(e){throw new Error('Inline script '+i+' syntax error: '+e.message)}
}
const required=[
  'canonicalJarvisCommand',
  'listenWithLocalStt',
  'scheduleVoiceConversationFollowup',
  'askJarvisBrain',
  'askMobileLocalBrain',
  'playJarvisMobileRelay',
  'startMobileBrowserFollowup',
  'waitForLocalTtsIdle',
  'executeDirectLocalPcControl',
  'tryDirectLocalPcControl'
];
for(const name of required){
  if(!html.includes(name))throw new Error('Missing UI capability: '+name);
}
console.log('UI SELFTEST PASS · '+scripts.length+' script block(s)');

if(!html.includes('mobileSpeechPromise=playJarvisMobileRelay'))throw new Error('Mobile speech completion tracking missing');
if(!html.includes("startMobileBrowserFollowup()"))throw new Error('Mobile hands-free follow-up routing missing');
if(!html.includes("VOICE: CONVERSATION LISTENING"))throw new Error('Mobile conversation listening state missing');
console.log('MOBILE HANDSFREE SELFTEST PASS');
