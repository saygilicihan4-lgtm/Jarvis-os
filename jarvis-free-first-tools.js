'use strict';
const FREE_FIRST_TOOL_ROUTER_VERSION='1.0';

// Free-first routes are launch hints, not a claim that a connected service has
// completed work. The user can keep a signed-in session in the JARVIS browser
// profile; the worker never collects passwords or bypasses MFA/CAPTCHA.
const CATALOG=Object.freeze({
  research:{
    id:'gemini-notebook',label:'NotebookLM / Gemini Notebook',
    kind:'web',url:'https://notebooklm.google.com/',
    cost:'free_limited',note:'Ücretsiz katman; kullanım limitleri ve ürün adı değişebilir.'
  },
  design:{
    id:'penpot',label:'Penpot',
    kind:'web',url:'https://design.penpot.app/',
    cost:'free_tier',note:'Ücretsiz bulut planı var; ekip sınırları ve plan koşullarını kontrol et.'
  },
  notes:{
    id:'obsidian',label:'Obsidian',
    kind:'installed_app',target:'Obsidian',
    cost:'free_local',note:'Uygulama ücretsiz; notlar cihazda yerel tutulur, eşitleme ek hizmettir.'
  },
  appointments:{
    id:'cal-com',label:'Cal.com',
    kind:'web',url:'https://cal.com/',
    cost:'free_limited',note:'Bireysel plan ücretsiz; takım özellikleri ücretli olabilir.'
  },
  automation:{
    id:'n8n',label:'n8n Community',
    kind:'configured_service',url:null,
    cost:'self_host_free_hosting_cost',
    note:'Ücretsiz Community sürümü kendi sunucunda çalışır; hosting ve bakım gerekebilir. n8n Cloud ücretsiz kabul edilmez.'
  },
  marketing:{
    id:'pomelli',label:'Pomelli',
    kind:'web_experimental',url:'https://labs.google/',
    cost:'free_experimental',
    note:'Google Labs deneyi; bölgesel erişim ve özellikler değişebilir.'
  },
  youtube:{
    id:'jarvis-creator',label:'JARVIS Creator',
    kind:'native_creator',url:null,cost:'local_zero_cost',
    note:'Özgün fikir ve metin üret; lisansı doğrulanmış görüntüleri kullan; videoyu JARVIS Creator ile yerelde hazırla. YouTube yayını taslakta kalır.'
  }
});
function normalize(value){
  return String(value||'').toLocaleLowerCase('tr-TR').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[ıİ]/g,'i').replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g')
    .replace(/[üÜ]/g,'u').replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function categoryFor(value){
  const q=normalize(value);
  if(/\b(youtube|shorts?|reels?|video|icerik uretimi)\b/.test(q))return'youtube';
  if(/\b(arastirma|research|kaynak tara|belge incele|notebooklm|gemini notebook)\b/.test(q))return'research';
  if(/\b(tasarim|design|arayuz|ui|prototip|penpot|stitch)\b/.test(q))return'design';
  if(/\b(not al|notlar|obsidian|bilgi tabani)\b/.test(q))return'notes';
  if(/\b(randevu|takvim|booking|appointment|cal com|calendly)\b/.test(q))return'appointments';
  if(/\b(otomasyon|automation|is akisi|workflow|zapier|n8n)\b/.test(q))return'automation';
  if(/\b(pazarlama|marketing|kampanya|pomelli|marka icerigi)\b/.test(q))return'marketing';
  return'';
}
function resolve(query){
  const category=categoryFor(query),entry=category&&CATALOG[category];
  if(!entry)return{ok:false,reason:'unknown_category',message:'Ücretsiz aracı güvenle seçemedim. Araştırma, tasarım, not, randevu, otomasyon, pazarlama veya YouTube üretimi diye belirt.'};
  return{ok:true,category,...entry,query:String(query||'').trim().slice(0,300)};
}
function launchable(route){
  return !!(route&&route.ok&&(route.kind==='web'||route.kind==='web_experimental'||route.kind==='installed_app'));
}
module.exports={CATALOG,normalize,categoryFor,resolve,launchable};
