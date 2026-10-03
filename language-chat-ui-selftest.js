'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {createClient}=require('./public/language-chat');
(async()=>{
  let calls=[],states=[],replies=[],playMode='success',finishTurn;
  const response={ok:true,state:'audio-ready',receipt:'r1',locale:'de-DE',voice:'de-DE-ConradNeural',reply:'Hallo',audio:'SUQz',mime:'audio/mpeg'};
  const request=async(data,signal)=>{
    calls.push(data);
    if(data.action==='create')return{ok:true,sessionId:'session'};
    if(data.action==='turn'&&playMode==='delayed')return new Promise(resolve=>finishTurn=()=>resolve(response));
    if(data.action==='turn')return response;
    return{ok:true};
  };
  const client=createClient({request,play:async()=>{if(playMode==='failure')throw new Error('autoplay_blocked')},onState:s=>states.push(s),onReply:x=>replies.push(x)});
  await client.run();assert.equal(client.busy,false);assert.equal(calls.filter(x=>x.played===true).length,1);assert.ok(states.includes('completed'));
  calls=[];states=[];playMode='failure';await client.run();
  assert.equal(calls.some(x=>x.played===true),false,'failed playback never reports success');assert.equal(calls.filter(x=>x.played===false).length,1);
  assert.ok(states.includes('error'));
  calls=[];states=[];replies=[];playMode='delayed';const pending=client.run();
  assert.equal(client.busy,true);await client.cancel();finishTurn();await pending;
  assert.equal(replies.length,0,'late response after cancellation cannot play or display');assert.equal(calls.some(x=>x.played===true),false);
  assert.equal(client.busy,false);
  const confirm=createClient({request:async d=>d.action==='create'?{sessionId:'s'}:{ok:true,state:'confirm-language'},play:async()=>assert.fail('ambiguous language must not play')});
  await confirm.run();assert.equal(confirm.busy,false);

  // Exercise the actual page's playback adapter with a fake HTMLAudioElement.
  const html=fs.readFileSync('public/index.html','utf8');
  const start=html.indexOf('function playLanguageConversationAudio('),end=html.indexOf('async function runLanguageChat()',start);
  assert.ok(start>0&&end>start);
  const audios=[],revoked=[],timers=[];let mode='ended';
  class Audio{
    constructor(){audios.push(this)}
    pause(){this.paused=true}
    play(){
      if(mode==='throw')throw new Error('sync_play_failure');
      if(mode==='reject')return Promise.reject(new Error('blocked'));
      if(mode==='ended')queueMicrotask(()=>this.onended?.());
      return Promise.resolve();
    }
  }
  const scope={Audio,Uint8Array,Blob,atob,Promise,Error,URL:{createObjectURL:()=>String(audios.length),revokeObjectURL:url=>revoked.push(url)},
    document:{body:{classList:{add(){},remove(){}}}},setTimeout:fn=>{const t={fn};timers.push(t);return t},clearTimeout:t=>t.cleared=true};
  vm.runInNewContext(html.slice(start,end),scope);
  await scope.playLanguageConversationAudio(response,new AbortController().signal);
  assert.equal(revoked.length,1);assert.equal(audios[0].paused,true);
  mode='reject';await assert.rejects(scope.playLanguageConversationAudio(response,new AbortController().signal),/blocked/);
  mode='throw';await assert.rejects(scope.playLanguageConversationAudio(response,new AbortController().signal),/sync_play_failure/);
  mode='wait';const controller=new AbortController();const playing=scope.playLanguageConversationAudio(response,controller.signal);controller.abort();
  await assert.rejects(playing,/cancelled/);assert.equal(revoked.length,4);assert.ok(timers.every(t=>t.cleared));
  const waiting=scope.playLanguageConversationAudio(response,new AbortController().signal);timers.at(-1).fn();await assert.rejects(waiting,/timeout/);
  assert.ok(html.includes("if(document.hidden)languageChatClient?.cancel()"));
  assert.ok(html.includes("if(!ok)languageChatClient?.cancel()"));
  assert.ok(html.includes('languageChatStarting=true'));
  console.log('LANGUAGE CHAT UI SELFTEST PASS · success/error/cancel/timeout and stale response behavior; simulated audio element');
})().catch(error=>{console.error(error);process.exitCode=1});
