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
  'localSttHealthState',
  'listenWithLocalStt',
  'scheduleVoiceConversationFollowup',
  'askJarvisBrain',
  'askJarvisBrainCore',
  'shouldStreamLocalConversation',
  'splitStreamSpeechBuffer',
  'streamLocalConversation',
  'thinkingBackchannelPhrase',
  'speakThinkingBackchannel',
  'armThinkingBackchannel',
  'askNativeLocalAgent',
  'askMobileLocalBrain',
  'armMobileConversationFollowup',
  'finalizeLocalToolReply',
  'playJarvisMobileRelay',
  'analyzeFrameAiLocal',
  'capturedFrameBase64',
  'isJarvisBargeInPhrase',
  'parseNaturalBargeIn',
  'routeNaturalBargeIn',
  'stopJarvisSpeech',
  'armBargeInRecognition',
  'executeDirectLocalPcControl',
  'tryDirectLocalPcControl'
];
for(const name of required){
  if(!html.includes(name))throw new Error('Missing UI capability: '+name);
}
if(!html.includes('SCREEN VISION: LOCAL READY · EXPLICIT ONLY'))throw new Error('Missing explicit-only screen vision UI state');
console.log('UI SELFTEST PASS · '+scripts.length+' script block(s)');

if(!html.includes('decode_mode'))throw new Error('Adaptive STT decode mode is not shown in UI');

if(!html.includes('const cancelThinkingBackchannel=shouldStreamLocalConversation(message)?(()=>{}):armThinkingBackchannel(message)'))throw new Error('Thinking backchannel wrapper missing');

if(!html.includes('currentChatStreamController.abort'))throw new Error('Voice interruption does not abort chat stream');
if(!html.includes("fetch('http://127.0.0.1:8765/chat-stream'"))throw new Error('Local chat stream endpoint is not wired');
if(!html.includes('shouldStreamLocalConversation(message)?(()=>{})'))throw new Error('Streaming path still arms filler backchannel');

if(!html.includes("stopJarvisSpeech(reason='voice-interrupt',{listenAfter=true}={})"))throw new Error('Barge-in stop API missing listenAfter control');
if(!html.includes("stopJarvisSpeech('voice-barge-in-followup',{listenAfter:false})"))throw new Error('Spoken follow-up interrupt still forces an extra listening pass');
if(!html.includes('await routeNaturalBargeIn(captured)'))throw new Error('Recognition barge-in is not routed through natural interruption parser');
if(!html.includes("return{interrupt:true,hardStop:false,followup:canonicalJarvisCommand(command)}"))throw new Error('Wake-word interruption cannot carry a new spoken request');
if(!html.includes("/^(?:hayır|hayir|yok)[, ]+(.+)$/i"))throw new Error('Natural correction interruption phrases missing');
