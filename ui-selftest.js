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
  'applyLearnedSpeechAlias',
  'loadLocalSpeechLexicon',
  'teachLocalSpeechAlias',
  'maybeLearnVoiceCorrection',
  'listenWithLocalStt',
  'scheduleVoiceConversationFollowup',
  'askJarvisBrain',
  'askNativeLocalAgent',
  'askMobileLocalBrain',
  'armMobileConversationFollowup',
  'finalizeLocalToolReply',
  'playJarvisMobileRelay',
  'analyzeFrameAiLocal',
  'capturedFrameBase64',
  'isJarvisBargeInPhrase',
  'stopJarvisSpeech',
  'armBargeInRecognition',
  'executeDirectLocalPcControl',
  'tryDirectLocalPcControl'
];
for(const name of required){
  if(!html.includes(name))throw new Error('Missing UI capability: '+name);
}
console.log('UI SELFTEST PASS · '+scripts.length+' script block(s)');
