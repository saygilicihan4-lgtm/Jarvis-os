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
  'nextWakeAcknowledgement',
  'wakeAckGeneration',
  'answerJarvisWakeWord',
  'askJarvisBrain',
  'askJarvisBrainCore',
  'shouldStreamLocalConversation',
  'splitStreamSpeechBuffer',
  'streamLocalConversation',
  'loadConversationLatencySamples',
  'recordConversationLatency',
  'conversationLatencyMedian',
  'adaptiveBackchannelDelay',
  'looksLikeLocalVoicePreference',
  'thinkingBackchannelPhrase',
  'speakThinkingBackchannel',
  'armThinkingBackchannel',
  'beginLocalBrainRequest',
  'currentBrainRequestController',
  'askNativeLocalAgent',
  'askMobileLocalBrain',
  'armMobileConversationFollowup',
  'finalizeLocalToolReply',
  'playJarvisMobileRelay',
  'analyzeFrameAiLocal',
  'capturedFrameBase64',
  'parseBargeInIntent',
  'rememberJarvisSpeechEcho',
  'jarvisEchoSimilarity',
  'isLikelyJarvisEcho',
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

if(!html.includes("localStorage.setItem('jarvisConversationLatencySamples'"))throw new Error('Conversation latency learning is not persisted locally');
if(!html.includes('const delay=adaptiveBackchannelDelay(text)'))throw new Error('Thinking backchannel still uses fixed timing');
if(!html.includes('recordConversationLatency(performance.now()-requestStarted)'))throw new Error('Native local-agent latency is not learned');
if(!html.includes('recordConversationLatency(Number(donePayload.firstDeltaMs))'))throw new Error('Streaming first-token latency is not learned');
if(/const delay=deep\?950:\(text\.length<32\?1650:1250\)/.test(html))throw new Error('Legacy fixed backchannel delay still present');

if(!html.includes('currentBrainRequestController.abort'))throw new Error('Active local reasoning is not abortable from voice interruption');
if(!html.includes('beginLocalBrainRequest(65000)'))throw new Error('Native local-agent request is not registered for cancellation');
if(!html.includes("return{handled:true,interrupted:true}"))throw new Error('Interrupted local-agent turn can still fall through to stale fallback');
if(!html.includes('VOICE: INTERRUPT READY'))throw new Error('Thinking-phase interruption readiness is not surfaced');

if(!html.includes('looksLikeLocalVoicePreference(text)'))throw new Error('Adaptive voice preference routing missing from stream guard');
if(!html.includes('adaptiveVoicePreferences'))throw new Error('Adaptive voice preference health state is not surfaced in UI');
if(!html.includes(' · LEARNED '))throw new Error('Learned voice profile is not visible in local voice status');

if(!html.includes('rememberJarvisSpeechEcho(spoken)'))throw new Error('JARVIS speech is not registered for echo rejection');
if(!html.includes('isLikelyJarvisEcho(captured)'))throw new Error('Barge-in transcript does not pass through speaker echo rejection');
if(!html.includes('SELF-ECHO IGNORED'))throw new Error('Speaker echo rejection diagnostic state missing');
if(!html.includes("if(/^jarvis\\b/.test(key))return false"))throw new Error('Explicit Jarvis interruption is not exempted from echo rejection');

if(!html.includes("SOCIAL '+String(evt.socialMode"))throw new Error('Streaming social-mode diagnostics missing');

if(!html.includes('waitForLocalTtsIdle(9000,650)'))throw new Error('Natural wake TTS-idle gate missing');
if(!html.includes('async function answerJarvisWakeWord()'))throw new Error('Wake acknowledgement is not async');
if(!html.includes("sessionStorage.setItem('jarvisWakeAckCursor'"))throw new Error('Wake acknowledgement rotation persistence missing');
const wakeStart=html.indexOf('async function answerJarvisWakeWord()');
const wakeEnd=html.indexOf('const SpeechRecognition=',wakeStart);
const wakeBlock=html.slice(wakeStart,wakeEnd);
if(wakeBlock.includes('},3000);'))throw new Error('Fixed 3-second wake delay still present');
if(!wakeBlock.includes('generation!==wakeAckGeneration'))throw new Error('Stale wake acknowledgement guard missing');

if(!html.includes('QUALITY ↑'))throw new Error('Automatic quality escalation diagnostic missing');

if(!html.includes('socialMomentum')||!html.includes('MOMENTUM'))throw new Error('Social momentum diagnostics missing from streaming UI');

if(!html.includes('cadenceMode')||!html.includes('RİTİM'))throw new Error('Adaptive conversation cadence diagnostics missing from streaming UI');
