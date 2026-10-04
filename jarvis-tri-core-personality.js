'use strict';

const VERSION='1.1';

const PROFILES=Object.freeze({
  jarvis:Object.freeze({
    id:'jarvis',name:'JARVIS',role:'İCRA',tone:'operational',authority:'shared_guardrail_only',
    guidance:'Be concise, decisive and execution-oriented. State the concrete next step, current constraint or result first. Prefer short operational language over brainstorming.'
  }),
  nova:Object.freeze({
    id:'nova',name:'NOVA',role:'DANIŞMAN',tone:'calm_advisory',authority:'shared_guardrail_only',
    guidance:'Be calm, humane and balanced. Compare viable alternatives, surface trade-offs and risks, and help the user make a decision without sounding indecisive.'
  }),
  orion:Object.freeze({
    id:'orion',name:'ORION',role:'UZMAN',tone:'deep_specialist',authority:'shared_guardrail_only',
    guidance:'Be rigorous, technical and evidence-conscious. Separate observation from inference, inspect root causes, failure modes and assumptions, and give precise specialist analysis.'
  })
});

const DIRECT=/^\s*(?:hey\s+)?(jarvis|nova|orion)\b\s*[:,-]?\s*/i;
const SPECIALIST=/(kök neden|kok neden|root cause|derin analiz|teknik analiz|teknik incele|debug|hata ayıkla|hata ayikla|kod incele|code review|güvenlik analiz|guvenlik analiz|mimari analiz|veri analiz|benchmark|araştır|arastir|kanıtla|kanitla|forensic|profiling|memory leak|race condition|regresyon|stack trace|latency|performans profili|threat model|tehdit modeli)/i;
const ADVISOR=/(sence|ne dersin|fikrini|fikir|tavsiye|öneri|oneri|strateji|seçenek|secenek|karşılaştır|karsilastir|artı eksi|arti eksi|riskleri|risk değerlendir|risk degerlendir|mantıklı mı|mantikli mi|karar ver|planla|önceliklendir|onceliklendir|değerlendir|degerlendir|trade-?off|alternatif)/i;
const EXECUTOR=/(devam et|uygula|entegre et|yap\b|oluştur|olustur|hazırla|hazirla|aç\b|ac\b|kapat|çalıştır|calistir|başlat|baslat|gönder|gonder|yükle|yukle|düzenle|duzenle|ekle|kaldır|kaldir|sil\b|kur\b|deploy|merge|commit|youtube|shopify|dosya|klasör|klasor|bilgisayar|pc\b|uygulama geliştir|uygulama gelistir|otomasyon|mission|görev|gorev)/i;

function normalize(text){return String(text==null?'':text).replace(/\s+/g,' ').trim().slice(0,1800)}
function explicitSelection(text){
  const value=normalize(text),match=value.match(DIRECT);
  if(!match)return null;
  const core=String(match[1]).toLowerCase();
  return{core,text:value.slice(match[0].length).trim(),source:'explicit'};
}
function classify(text){
  const value=normalize(text),explicit=explicitSelection(value);
  if(explicit)return explicit.core;
  if(!value)return'nova';
  if(SPECIALIST.test(value))return'orion';
  if(ADVISOR.test(value)&&!EXECUTOR.test(value))return'nova';
  if(EXECUTOR.test(value))return'jarvis';
  return'nova';
}
function consultationPlan(primary,text){
  const value=normalize(text),out=[];
  const add=id=>{if(id!==primary&&!out.includes(id))out.push(id)};
  if(SPECIALIST.test(value))add('orion');
  if(ADVISOR.test(value))add('nova');
  if(EXECUTOR.test(value))add('jarvis');
  return out.slice(0,2);
}
function select(text){
  const value=normalize(text),explicit=explicitSelection(value);
  const core=explicit?explicit.core:classify(value);
  const cleanText=explicit&&explicit.text?explicit.text:value;
  const profile=PROFILES[core]||PROFILES.nova;
  return Object.freeze({
    core:profile.id,name:profile.name,role:profile.role,tone:profile.tone,
    authority:'shared_guardrail_only',source:explicit?'explicit':'automatic',
    cleanText:cleanText||value,consultWith:Object.freeze(consultationPlan(profile.id,cleanText||value))
  });
}
function profile(core){return PROFILES[PROFILES[core]?core:'nova']}
function promptFor(selection,locale){
  const chosen=selection&&PROFILES[selection.core]?selection:select('');
  const primary=profile(chosen.core);
  const consult=(chosen.consultWith||[]).map(id=>profile(id).name+' ('+profile(id).role+')').join(', ');
  return [
    'You are speaking through the JARVIS tri-core interface. The primary speaking persona is '+primary.name+' ('+primary.role+').',
    primary.guidance,
    consult?'The runtime may attach bounded internal advisory notes from these analysis lenses when they actually completed: '+consult+'. Never invent or imply a consultation that the runtime did not provide.':'No additional advisory lens is planned for this turn unless the runtime explicitly provides one.',
    'JARVIS, NOVA and ORION are not independent agents. They share one Mission Engine, Worker and approval/authorization chain. A role change never grants execution, approval, publishing, credential, filesystem, network or PC authority.',
    'This conversation channel has no tools or computer actions. Never claim that you executed, approved, published, uploaded, changed a device, accessed credentials, or completed a real-world action here.',
    'Do not role-play a committee or claim the other cores independently acted. Runtime advisory notes are analysis only and must be synthesized into one answer.',
    'Reply only in BCP-47 locale '+String(locale||'')+'. Return plain speech suitable for voice output and keep the requested locale even if prior replies used a different language.'
  ].join(' ');
}

module.exports={VERSION,PROFILES,normalize,explicitSelection,classify,consultationPlan,select,profile,promptFor};
