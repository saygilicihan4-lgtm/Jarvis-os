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
  'parseBargeInIntent',
  'isJarvisBargeInPhrase',
  'handleBargeInTranscript',
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

if(!html.includes("{listenAfter=true}={}"))throw new Error('Interrupt listenAfter option missing');
if(!html.includes("stopJarvisSpeech('voice-barge-in',{listenAfter:!hasReplacement})"))throw new Error('Replacement interruption does not suppress duplicate listening');
if(!html.includes("intent.reason==='correction'&&await maybeLearnVoiceCorrection(replacement)"))throw new Error('Mid-speech correction learning missing');
if(!html.includes("cmd.value=canonicalJarvisCommand(replacement)"))throw new Error('Replacement command dispatch missing');
if(!html.includes("DUR / BEKLE / JARVIS ..."))throw new Error('Natural interrupt UI state missing');
if(!html.includes("bare-stop")||!html.includes("wake-command"))throw new Error('Natural barge-in intent classes missing');

if(!html.includes('bs.adaptiveModelRouter'))throw new Error('Adaptive local model router is not surfaced in UI');
if(!html.includes("'FAST '+String(bs.fastModel"))throw new Error('Fast model tier is not shown in UI');
if(!html.includes("' · DEEP '+String(bs.deepModel"))throw new Error('Deep model tier is not shown in UI');

if(!html.includes('ADAPTIVE PROSODY READY'))throw new Error('Adaptive prosody UI state missing');
