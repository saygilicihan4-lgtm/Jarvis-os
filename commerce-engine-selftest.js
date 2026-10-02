const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const engine=require('./jarvis-commerce-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.0');
assert.strictEqual(engine.DEFAULT_API_VERSION,'2026-10');
assert.strictEqual(engine.normalizeShopDomain('https://varora-v.myshopify.com/admin'),'varora-v.myshopify.com');
assert.throws(()=>engine.normalizeShopDomain('bad domain'));

const p=engine.normalizeProduct({
  title:'  V-GAP   Organizer ',
  description:'Telefonunuz artık koltuk arasına düşmesin.',
  price:'499,90',
  tags:'otomobil, organizer, otomobil',
  images:['https://example.com/a.jpg']
});
assert.strictEqual(p.title,'V-GAP Organizer');
assert.strictEqual(p.price,499.90);
assert.deepStrictEqual(p.tags,['otomobil','organizer']);
assert.ok(p.descriptionHtml.includes('<p>'));
assert.strictEqual(p.vendor,'VAROVA');

const payload=engine.productSetPayload({
  title:'V-GAP Organizer',
  price:499.90,
  description:'Test',
  tags:['VAROVA']
},{status:'DRAFT'});
assert.strictEqual(payload.input.status,'DRAFT');
assert.strictEqual(payload.input.title,'V-GAP Organizer');
assert.ok(!payload.input.variants,'Simple product should let Shopify create the default variant first');

const variants=engine.productSetPayload({
  title:'Renkli Organizer',
  variants:[
    {price:100,options:[{name:'Renk',value:'Siyah'}]},
    {price:110,options:[{name:'Renk',value:'Kirmizi'}]}
  ]
},{status:'DRAFT'});
assert.strictEqual(variants.input.productOptions[0].name,'Renk');
assert.strictEqual(variants.input.variants.length,2);

const parsed=engine.parseKeyValueProduct('V-GAP Organizer | fiyat=499,90 | etiket=araba,organizer | açıklama=Koltuk arası düzenleyici');
assert.strictEqual(parsed.title,'V-GAP Organizer');
assert.strictEqual(parsed.price,'499,90');
assert.strictEqual(parsed.description,'Koltuk arası düzenleyici');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-commerce-'));
const draft=engine.saveLocalDraft(tmp,{title:'Deneme',price:50});
assert.strictEqual(draft.ok,true);
assert.ok(fs.existsSync(draft.file));

assert.strictEqual(engine.missionTag('M-ABC-123'),'jarvis_mission_M-ABC-123');
assert.ok(typeof engine.findProductByMission==='function');
assert.ok(typeof engine.createDraftForMission==='function');

console.log('COMMERCE ENGINE SELFTEST PASS');
