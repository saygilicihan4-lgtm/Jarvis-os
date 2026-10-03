'use strict';
const assert=require('assert/strict');
const mobile=require('./public/mobile-language-chat');
function storage(seed={}){const m=new Map(Object.entries(seed));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(k)}}
function listMock(){const children=[];const doc={createElement:()=>({value:'',label:''})};return{ownerDocument:doc,children,get firstChild(){return children[0]||null},removeChild(node){const i=children.indexOf(node);if(i>=0)children.splice(i,1)},appendChild(node){children.push(node)}}}
(()=>{
  const now=1_000_000,store=storage();
  const ambiguous={ok:false,state:'unsupported',reason:'runtime_tts_locale_ambiguous',locale:'nl',ttsCandidates:['nl-NL','nl-BE','nl-NL','de-DE','../../bad']};
  const evidence=mobile.recordNegativeTtsEvidence(store,ambiguous,'nl',now);
  assert(evidence);assert.deepEqual(evidence.ttsCandidates,['nl-BE','nl-NL']);

  const list=listMock();mobile.renderLocaleOptions(list,store,now);
  const nlNl=list.children.filter(x=>x.value==='nl-NL');
  const nlBe=list.children.filter(x=>x.value==='nl-BE');
  assert.equal(nlNl.length,1,'common locale candidate must not be duplicated');
  assert.equal(nlBe.length,1,'non-common runtime ambiguity candidate should be added once');
  assert(nlBe[0].label.includes('runtime adayı'),'candidate must be labelled as runtime candidate');
  assert(nlBe[0].label.includes('TTS ? doğrulanmadı'),'candidate must not be presented as supported');
  assert(!nlBe[0].label.includes('TTS ✓'),'candidate list membership alone is not positive evidence');
  assert.equal(list.children.some(x=>x.value==='de-DE'&&x.label.includes('runtime adayı')),false,'cross-language candidate must never be injected');

  const positive={provider:'edge-tts',voice:'nl-BE-ArnaudNeural',localeResolution:'exact',speechEvidence:'runtime_inventory'};
  assert(mobile.recordTtsEvidence(store,positive,'nl-BE','nl-BE',now+1000));
  const verified=listMock();mobile.renderLocaleOptions(verified,store,now+1000);
  const verifiedBe=verified.children.find(x=>x.value==='nl-BE');
  assert(verifiedBe&&verifiedBe.label.includes('TTS ✓ son 5 dk'),'independent positive evidence may upgrade a candidate label');

  const expired=listMock();mobile.renderLocaleOptions(expired,store,now+mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS+1);
  assert.equal(expired.children.some(x=>x.value==='nl-BE'&&x.label.includes('runtime adayı')),false,'expired ambiguity evidence must stop injecting candidate options');
  assert.equal(expired.children.some(x=>x.value==='nl-BE'),true,'independently verified candidate may remain because positive evidence is separate');

  const onlyAmbiguous=storage();assert(mobile.recordNegativeTtsEvidence(onlyAmbiguous,ambiguous,'nl',now));
  const gone=listMock();mobile.renderLocaleOptions(gone,onlyAmbiguous,now+mobile.TTS_NEGATIVE_EVIDENCE_TTL_MS+1);
  assert.equal(gone.children.some(x=>x.value==='nl-BE'),false,'candidate with no independent evidence disappears after ambiguity TTL');

  console.log('MOBILE AMBIGUITY CANDIDATES SELFTEST PASS · runtime ambiguity candidates are deduped, same-language, explicitly unverified, and disappear with evidence TTL');
})();
