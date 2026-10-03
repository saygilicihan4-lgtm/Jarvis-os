'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
(async()=>{
  const store=storage({[mobile.PREFERENCE_KEY]:'tr-TR'});let capturedLocale=null,requestedLocale=null,played=0;
  const client=mobile.createClient({storage:store,
    capture:async locale=>{capturedLocale=locale;return'hello there'},
    request:async data=>{requestedLocale=data.locale;return{ok:true,state:'reply-ready',reply:'Hello.',locale:data.locale}},
    play:async()=>{played++}
  });
  const staged=client.selectLocale('en_us');
  assert.equal(staged.ok,true);assert.equal(staged.locale,'en-US');assert.equal(staged.persisted,false);
  assert.equal(store.getItem(mobile.PREFERENCE_KEY),'tr-TR','selection alone must not persist');
  const completed=await client.run({locale:'tr-TR'});
  assert.equal(completed.state,'completed');assert.equal(capturedLocale,'en-US');assert.equal(requestedLocale,'en-US');assert.equal(played,1);
  assert.equal(completed.preferenceSaved,true);assert.equal(completed.preferenceEvidence,'explicit-picker-plus-playback');
  assert.equal(store.getItem(mobile.PREFERENCE_KEY),'en-US','successful runtime reply plus playback may persist explicit choice');
  assert.equal(client.selectedLocale,null);assert.equal(client.preferredLocale,'en-US');

  const unsupportedStore=storage({[mobile.PREFERENCE_KEY]:'tr-TR'});let unsupportedCapture=null;
  const unsupported=mobile.createClient({storage:unsupportedStore,
    capture:async locale=>{unsupportedCapture=locale;return'bonjour'},
    request:async data=>({ok:false,state:'unsupported',reason:'tts_locale_not_in_runtime_inventory',locale:data.locale}),
    play:async()=>{throw new Error('play_must_not_run')}
  });
  assert.equal(unsupported.selectLocale('fr-FR').ok,true);
  const rejected=await unsupported.run({locale:'tr-TR'});
  assert.equal(unsupportedCapture,'fr-FR');assert.equal(rejected.ok,false);assert.equal(rejected.error,'tts_locale_not_in_runtime_inventory');
  assert.equal(rejected.preferenceSaved,false);assert.equal(unsupportedStore.getItem(mobile.PREFERENCE_KEY),'tr-TR','unsupported runtime locale must not persist');
  assert.equal(unsupported.selectedLocale,'fr-FR','failed explicit choice remains session-only for a retry');

  const playbackStore=storage({[mobile.PREFERENCE_KEY]:'tr-TR'});
  const playbackFail=mobile.createClient({storage:playbackStore,capture:async()=> 'hello',
    request:async data=>({ok:true,state:'reply-ready',reply:'Hello.',locale:data.locale}),play:async()=>{throw new Error('autoplay_blocked')}});
  playbackFail.selectLocale('en-US');const playbackResult=await playbackFail.run({locale:'tr-TR'});
  assert.equal(playbackResult.ok,false);assert.equal(playbackStore.getItem(mobile.PREFERENCE_KEY),'tr-TR','unplayed reply must not persist picker choice');

  let hintCalls=0;
  const explicitWins=mobile.createClient({storage:storage(),capture:async()=> 'こんにちは',hint:()=>{hintCalls++;return'ja-JP'},
    request:async data=>({ok:true,state:'reply-ready',reply:'Hello',locale:data.locale}),play:async()=>{}});
  explicitWins.selectLocale('en-US');const explicitResult=await explicitWins.run({locale:'tr-TR'});
  assert.equal(hintCalls,1);assert.equal(explicitResult.state,'completed');assert.equal(explicitResult.nextLocale,'en-US','explicit picker must outrank script hint for that turn');

  assert.deepEqual(client.selectLocale('../../bad'),{ok:false,reason:'invalid_locale'});
  assert(mobile.COMMON_LOCALES.some(([locale])=>locale==='tr-TR'));assert(mobile.COMMON_LOCALES.some(([locale])=>locale==='en-US'));
  console.log('MOBILE EXPLICIT LOCALE SELFTEST PASS · explicit selection is session-only until runtime reply + successful playback; unsupported/unplayed choices do not persist');
})().catch(error=>{console.error(error);process.exitCode=1});
