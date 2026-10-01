const fs=require('fs');
const html=fs.readFileSync('public/index.html','utf8');

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(Boolean);
if(!scripts.length)throw new Error('No inline script found');

for(const [i,s] of scripts.entries()){
  try{new Function(s)}
  catch(e){throw new Error('Inline script '+i+' syntax error: '+e.message)}
}

const required=[
  'speechLexiconAliases',
  'applyLearnedSpeechAlias',
  'loadLocalSpeechLexicon',
  'teachLocalSpeechAlias',
  'voiceCorrectionIntent',
  'maybeLearnVoiceCorrection',
  'canonicalJarvisCommand'
];
for(const name of required){
  if(!html.includes(name))throw new Error('Missing adaptive speech capability: '+name);
}

if(!html.includes('const learned=applyLearnedSpeechAlias(raw)')){
  throw new Error('canonical command path does not apply learned aliases first');
}
if(!html.includes('await maybeLearnVoiceCorrection(heard)')){
  throw new Error('local STT self-correction learning hook missing');
}
if(!html.includes('await maybeLearnVoiceCorrection(captured)')){
  throw new Error('browser recognition self-correction learning hook missing');
}
if(!html.includes('recognition.onresult=async')){
  throw new Error('browser recognition handler is not async for correction learning');
}
if(!html.includes("loadLocalSpeechLexicon().catch(()=>{})")){
  throw new Error('local speech lexicon is not refreshed with Worker health');
}
if(!html.includes('screenVision')&&!html.includes('SCREEN VISION')){
  throw new Error('current main screen-vision UI was lost');
}
if(!html.includes('localSttHealthState')||!html.includes('decode_mode')){
  throw new Error('adaptive STT v4 UI state is missing');
}
if(html.includes('\\function canonicalJarvisCommand')||html.includes('\\const escaped=from.replace')){
  throw new Error('Malformed learned-alias regex escape regression detected');
}
if(!html.includes("g,'\\\\$&');")){
  throw new Error('Learned-alias regex escaping is not using the replacement-safe form');
}

console.log('LEXICON UI SELFTEST PASS');
