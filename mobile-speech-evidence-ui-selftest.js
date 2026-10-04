'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const chat=require('./public/mobile-language-chat');
const ui=require('./public/mobile-speech-evidence-ui');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k)}}
function docMock(){
  const nodes=new Map(),parent={children:[],appendChild(node){node.parentNode=this;this.children.push(node);nodes.set(node.id,node);return node},insertBefore(node,before){node.parentNode=this;const i=this.children.indexOf(before);if(i<0)this.children.push(node);else this.children.splice(i,0,node);nodes.set(node.id,node);return node}};
  function node(id){return{id,parentNode:parent,nextSibling:null,dataset:{},style:{},textContent:'',value:'',listeners:{},setAttribute(k,v){this[k]=v},addEventListener(k,fn){this.listeners[k]=fn}}}
  const status=node('languageChatStatus'),picker=node('jarvisMobileLocalePicker'),input=node('jarvisMobileLocaleInput'),button=node('localeButton');
  input.value='';parent.appendChild(status);parent.appendChild(picker);parent.appendChild(input);picker.button=button;
  nodes.set(status.id,status);nodes.set(picker.id,picker);nodes.set(input.id,input);
  return{parent,nodes,getElementById:id=>nodes.get(id)||null,createElement:()=>node(''),querySelector:q=>q==='#jarvisMobileLocalePicker button'?button:null};
}
(()=>{
  const now=4_000_000,store=storage(),doc=docMock();
  assert.equal(ui.ready(),true);
  assert.equal(ui.chooseLocale({input:doc.getElementById('jarvisMobileLocaleInput'),storage:store,nowMs:now,fallback:'tr-TR'}),'tr-TR');

  assert(chat.recordSttCaptureEvidence(store,'de-DE','hallo welt',now));
  assert.equal(ui.newestLocale(store,now),'de-DE');
  assert.equal(ui.chooseLocale({input:doc.getElementById('jarvisMobileLocaleInput'),storage:store,nowMs:now,fallback:'tr-TR'}),'de-DE','newest evidence should guide badge only when no explicit input or preference exists');

  chat.savePreference(store,'en-US');
  assert.equal(ui.chooseLocale({input:doc.getElementById('jarvisMobileLocaleInput'),storage:store,nowMs:now,fallback:'tr-TR'}),'en-US','device-local preference outranks passive evidence for badge selection');
  doc.getElementById('jarvisMobileLocaleInput').value='fr-FR';
  assert.equal(ui.chooseLocale({input:doc.getElementById('jarvisMobileLocaleInput'),storage:store,nowMs:now,fallback:'tr-TR'}),'fr-FR','typed explicit locale outranks preference');

  const badge=ui.ensureBadge(doc);assert(badge);assert.equal(badge.id,'jarvisMobileSpeechEvidenceStatus');assert.equal(badge.role,'status');
  const rendered=ui.refresh(doc,{storage:store,nowMs:now,fallback:'tr-TR'});assert(rendered);assert.equal(rendered.locale,'fr-FR');
  assert(badge.textContent.startsWith('KANIT · fr-FR ·'));
  assert(badge.textContent.includes('STT capture ? henüz gözlenmedi'));
  assert(badge.textContent.includes('Otomatik STT/dil öğrenimi kapalı'));
  assert.equal(badge.dataset.sttVerified,'false');assert.equal(badge.dataset.languageVerified,'false');assert.equal(badge.dataset.deviceE2eVerified,'false');assert.equal(badge.dataset.automaticLearning,'false');
  assert(!badge.textContent.includes('STT ✓'));assert(!badge.textContent.includes('dil doğrulandı'));

  const tts={provider:'edge-tts',voice:'fr-FR-HenriNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'};
  const ttsReceipt=chat.recordTtsEvidence(store,tts,'fr-FR','fr-FR',now);assert(ttsReceipt);
  const sttReceipt=chat.recordSttCaptureEvidence(store,'fr-FR','bonjour',now);assert(sttReceipt);
  const live=ui.refresh(doc,{storage:store,nowMs:now,fallback:'tr-TR'});
  assert(badge.textContent.includes('TTS ✓ runtime + playback · geçici kanıt'));
  assert(badge.textContent.includes('STT capture ◇ gözlendi · geçici kanıt · dil doğruluğu doğrulanmadı'));
  assert(!badge.textContent.includes('STT ✓'));
  assert.equal(badge.dataset.ttsEvidenceObservedAt,String(ttsReceipt.verifiedAt));
  assert.equal(badge.dataset.ttsEvidenceExpiresAt,String(ttsReceipt.expiresAt));
  assert.equal(badge.dataset.ttsEvidenceRemainingMs,String(ttsReceipt.expiresAt-now));
  assert.equal(badge.dataset.sttEvidenceObservedAt,String(sttReceipt.capturedAt));
  assert.equal(badge.dataset.sttEvidenceExpiresAt,String(sttReceipt.expiresAt));
  assert.equal(badge.dataset.sttEvidenceRemainingMs,String(sttReceipt.expiresAt-now));

  assert.equal(ui.nextEvidenceExpiryDelay(live,now),sttReceipt.expiresAt-now+1,'earliest evidence expiry must drive the one-shot truth refresh');
  assert.equal(ui.nextEvidenceExpiryDelay(live,sttReceipt.expiresAt),1,'exact expiry boundary must schedule a refresh one millisecond later');
  assert.equal(ui.nextEvidenceExpiryDelay({tts:{freshness:{expiresAt:now-1}},stt:{freshness:null}},now),null,'already expired evidence must not schedule a future timer');
  assert.equal(ui.nextEvidenceExpiryDelay(null,now),null);

  const timerRoot={scheduled:[],cleared:[],setTimeout(fn,delay){this.scheduled.push({fn,delay});return this.scheduled.length},clearTimeout(id){this.cleared.push(id)}};
  const run=()=>{};
  const firstDelay=ui.scheduleExpiryRefresh(timerRoot,live,run,now);
  assert.equal(firstDelay,sttReceipt.expiresAt-now+1);assert.equal(timerRoot.scheduled.length,1);assert.equal(timerRoot.scheduled[0].fn,run);assert.equal(timerRoot.scheduled[0].delay,firstDelay);
  const ttsOnly={tts:{freshness:{expiresAt:ttsReceipt.expiresAt}},stt:{freshness:null},transcript:'must-not-matter'};
  const secondDelay=ui.scheduleExpiryRefresh(timerRoot,ttsOnly,run,now);
  assert.equal(secondDelay,ttsReceipt.expiresAt-now+1);assert.deepEqual(timerRoot.cleared,[1],'reschedule must clear the older expiry timer first');assert.equal(timerRoot.scheduled.length,2);
  assert.equal(ui.scheduleExpiryRefresh(timerRoot,{tts:{freshness:null},stt:{freshness:null}},run,now),null,'no live evidence means no one-shot expiry timer');
  assert.deepEqual(timerRoot.cleared,[1,2],'losing all evidence must clear the prior expiry timer');assert.equal(timerRoot.__jarvisMobileSpeechEvidenceExpiryTimer,null);

  ui.refresh(doc,{storage:store,nowMs:sttReceipt.expiresAt,fallback:'tr-TR'});
  assert(badge.textContent.includes('STT capture ◇ gözlendi · geçici kanıt'),'capture evidence remains visible at exact expiry boundary');
  assert.equal(badge.dataset.sttEvidenceRemainingMs,'0');

  ui.refresh(doc,{storage:store,nowMs:sttReceipt.expiresAt+1,fallback:'tr-TR'});
  assert(badge.textContent.includes('TTS ✓ runtime + playback · geçici kanıt'),'longer-lived TTS evidence must survive STT receipt expiry');
  assert(badge.textContent.includes('STT capture ? henüz gözlenmedi'),'expired STT receipt must disappear from visible badge');
  assert.equal(badge.dataset.sttEvidenceObservedAt,'');assert.equal(badge.dataset.sttEvidenceExpiresAt,'');assert.equal(badge.dataset.sttEvidenceRemainingMs,'','expired STT freshness dataset must clear');
  assert(Number(badge.dataset.ttsEvidenceRemainingMs)>0,'TTS freshness remains independently live');
  assert(!badge.textContent.includes('bonjour'),'transcript content must never leak into badge');

  const source=fs.readFileSync(require.resolve('./public/language-chat'),'utf8');
  const waitIndex=source.indexOf('if(!root.JarvisMobileLanguageChat)');
  const coreIndex=source.indexOf("/mobile-speech-evidence-status.js");
  const uiIndex=source.indexOf("/mobile-speech-evidence-ui.js");
  assert(waitIndex>=0&&coreIndex>waitIndex&&uiIndex>coreIndex,'bootstrap must wait for mobile chat, then load status core before UI adapter');
  assert(source.includes('/iPhone|iPad|iPod|Android/i'),'bootstrap must stay mobile-only');
  assert.equal(source.includes('innerHTML='),false,'integration must not introduce HTML injection');

  console.log('MOBILE SPEECH EVIDENCE UI SELFTEST PASS · expiry-bound one-shot refresh complements periodic polling without weakening STT/language/privacy truth boundaries');
})();
