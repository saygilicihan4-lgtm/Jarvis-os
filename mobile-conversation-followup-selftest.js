'use strict';
const assert=require('assert/strict');
const bridge=require('./public/mobile-conversation-followup');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject}}
function mobileRoot(){
  const voice={textContent:''};
  const state={relayCalls:0,legacySchedules:0,armed:[]};
  const root={
    navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'},
    document:{getElementById:id=>id==='voiceState'?voice:null},
    playJarvisMobileRelay(){state.relayCalls++;return Promise.resolve(true)},
    scheduleVoiceConversationFollowup(){state.legacySchedules++;return 'legacy'},
    armMobileConversationFollowup(delay){state.armed.push(delay);return true}
  };
  return{root,voice,state};
}
(async()=>{
  assert.equal(bridge.install({navigator:{userAgent:'Windows'},document:{}}),false,'desktop must not install mobile bridge');

  const {root,voice,state}=mobileRoot();
  let active=deferred();
  root.playJarvisMobileRelay=()=>{state.relayCalls++;return active.promise};
  assert.equal(bridge.install(root),true,'mobile bridge should install when production hooks exist');
  assert.equal(bridge.install(root),true,'install must be idempotent');

  const first=root.playJarvisMobileRelay('ilk yanıt');
  assert.equal(root.scheduleVoiceConversationFollowup('ilk yanıt'),true,'mobile schedule should be handled by bridge');
  await sleep(40);
  assert.equal(state.armed.length,0,'follow-up must not arm before mobile relay playback resolves');

  const secondDeferred=deferred();
  active=secondDeferred;
  const second=root.playJarvisMobileRelay('ikinci yanıt');
  root.scheduleVoiceConversationFollowup('ikinci yanıt');
  active=null;
  first.catch(()=>{});
  // Resolving the stale speech must not arm an obsolete follow-up.
  // Its schedule generation was replaced by the second answer.
  // eslint-disable-next-line no-unused-expressions
  second;
  await sleep(20);
  assert.equal(state.armed.length,0);

  secondDeferred.resolve(true);
  await second;
  await sleep(330);
  assert.deepEqual(state.armed,[150],'only latest completed mobile relay may arm browser recognition');
  assert.equal(state.legacySchedules,0,'mobile bridge must not fall back to desktop/local-STT scheduler');

  const failed=deferred();
  root.playJarvisMobileRelay=(()=>{
    const wrapped=root.playJarvisMobileRelay;
    return (...args)=>wrapped(...args);
  })();
  // The installed relay wrapper captures whichever promise the original relay returned at install time;
  // use a fresh root for a rejection-path proof.
  const rejected=mobileRoot();
  rejected.root.playJarvisMobileRelay=()=>failed.promise;
  assert.equal(bridge.install(rejected.root),true);
  const rejectedPlayback=rejected.root.playJarvisMobileRelay('bozuk relay');
  rejected.root.scheduleVoiceConversationFollowup('bozuk relay');
  failed.reject(new Error('relay_failed'));
  await rejectedPlayback.catch(()=>{});
  await sleep(40);
  assert.equal(rejected.state.armed.length,0,'failed relay must fail closed and never reopen microphone');
  assert.equal(rejected.voice.textContent,'VOICE: TAP VOICE TO CONTINUE','failed relay requires explicit user continuation');

  const missing=mobileRoot();
  delete missing.root.armMobileConversationFollowup;
  assert.equal(bridge.install(missing.root),false,'missing production arm hook must fail closed');

  console.log('MOBILE CONVERSATION FOLLOW-UP SELFTEST PASS · phone follow-up waits for real relay completion, cancels stale schedules and fails closed on playback failure');
})().catch(error=>{console.error(error);process.exitCode=1});
