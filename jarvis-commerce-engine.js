const fs=require('fs');
const path=require('path');
const childProcess=require('child_process');
const https=require('https');

const ENGINE_VERSION='1.0';
const DEFAULT_API_VERSION='2026-10';

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir}
function safeName(name){
  return String(name||'product')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'')
    .slice(0,90)||('product-'+Date.now());
}
function commerceDirs(workspace){
  return{
    secrets:ensureDir(path.join(workspace,'.jarvis-secrets')),
    drafts:ensureDir(path.join(workspace,'commerce-drafts')),
    receipts:ensureDir(path.join(workspace,'commerce-receipts'))
  };
}
function normalizeShopDomain(value){
  let s=String(value||'').trim().toLowerCase();
  s=s.replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  if(!s)return'';
  if(!s.includes('.'))s+='.myshopify.com';
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s))throw new Error('Geçersiz Shopify mağaza alan adı');
  return s;
}
function stripDangerousHtml(value){
  let s=String(value||'').trim();
  if(!s)return'';
  s=s.replace(/<script[\s\S]*?<\/script>/gi,'')
     .replace(/<style[\s\S]*?<\/style>/gi,'')
     .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi,'')
     .replace(/javascript\s*:/gi,'');
  if(!/[<>]/.test(s)){
    const parts=s.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
    s=parts.map(x=>'<p>'+x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>').join('');
  }
  return s;
}
function normalizeTags(value){
  const arr=Array.isArray(value)?value:String(value||'').split(',');
  return [...new Set(arr.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,50);
}
function normalizeImages(value){
  const arr=Array.isArray(value)?value:(value?[value]:[]);
  return arr.map((x,i)=>{
    if(typeof x==='string')return{url:x.trim(),alt:''};
    return{url:String(x&&x.url||'').trim(),alt:String(x&&x.alt||'').trim()};
  }).filter(x=>/^https:\/\//i.test(x.url)).slice(0,20);
}
function normalizeMoney(value){
  if(value===undefined||value===null||value==='')return null;
  const n=Number(String(value).replace(',','.'));
  if(!Number.isFinite(n)||n<0)throw new Error('Geçersiz fiyat');
  return Number(n.toFixed(2));
}
function normalizeProduct(input={}){
  const title=String(input.title||input.name||'').replace(/\s+/g,' ').trim();
  if(!title)throw new Error('Ürün başlığı gerekli');
  const handle=String(input.handle||'').trim().toLowerCase()
    .normalize('NFKD').replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  const variants=Array.isArray(input.variants)?input.variants.slice(0,100).map((v,idx)=>{
    const options=(Array.isArray(v.options)?v.options:[]).map(o=>({
      name:String(o&&o.name||o&&o.optionName||'').trim(),
      value:String(o&&o.value||o&&o.nameValue||o&&o.optionValue||'').trim()
    })).filter(o=>o.name&&o.value).slice(0,3);
    return{
      title:String(v.title||'').trim(),
      price:normalizeMoney(v.price),
      compareAtPrice:normalizeMoney(v.compareAtPrice),
      sku:String(v.sku||'').trim().slice(0,120),
      options,
      inventory:Number.isFinite(Number(v.inventory))?Math.max(0,Math.floor(Number(v.inventory))):null,
      position:idx+1
    };
  }):[];
  return{
    title,
    descriptionHtml:stripDangerousHtml(input.descriptionHtml||input.description||''),
    vendor:String(input.vendor||'VAROVA').replace(/\s+/g,' ').trim().slice(0,255)||'VAROVA',
    productType:String(input.productType||input.type||'').replace(/\s+/g,' ').trim().slice(0,255),
    handle,
    tags:normalizeTags(input.tags),
    images:normalizeImages(input.images||input.imageUrls||input.image),
    price:normalizeMoney(input.price),
    compareAtPrice:normalizeMoney(input.compareAtPrice),
    sku:String(input.sku||'').trim().slice(0,120),
    variants
  };
}
function productSetPayload(product,{status='DRAFT'}={}){
  const p=normalizeProduct(product);
  const input={
    title:p.title,
    descriptionHtml:p.descriptionHtml,
    vendor:p.vendor,
    status:String(status||'DRAFT').toUpperCase()
  };
  if(p.productType)input.productType=p.productType;
  if(p.handle)input.handle=p.handle;
  if(p.tags.length)input.tags=p.tags;
  if(p.images.length){
    input.files=p.images.map(x=>({
      originalSource:x.url,
      alt:x.alt||p.title,
      contentType:'IMAGE'
    }));
  }
  if(p.variants.length){
    const optionMap=new Map();
    for(const v of p.variants){
      for(const o of v.options){
        if(!optionMap.has(o.name))optionMap.set(o.name,new Set());
        optionMap.get(o.name).add(o.value);
      }
    }
    if(optionMap.size){
      input.productOptions=[...optionMap.entries()].map(([name,values],i)=>({
        name,
        position:i+1,
        values:[...values].map(name=>({name}))
      }));
    }
    input.variants=p.variants.map(v=>{
      const out={};
      if(v.options.length)out.optionValues=v.options.map(o=>({optionName:o.name,name:o.value}));
      if(v.price!==null)out.price=v.price;
      if(v.compareAtPrice!==null)out.compareAtPrice=v.compareAtPrice;
      if(v.sku)out.sku=v.sku;
      return out;
    });
  }
  return{normalized:p,input};
}
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){return null}
}
function loadConfig(workspace){
  const dirs=commerceDirs(workspace);
  const file=path.join(dirs.secrets,'shopify.json');
  const disk=readJson(file)||{};
  const shop=normalizeShopDomain(process.env.JARVIS_SHOPIFY_SHOP||disk.shop||'');
  const apiVersion=String(process.env.JARVIS_SHOPIFY_API_VERSION||disk.apiVersion||DEFAULT_API_VERSION).trim();
  const tokenFile=path.resolve(dirs.secrets,String(disk.tokenFile||'shopify.token.dpapi'));
  return{shop,apiVersion,tokenFile,configFile:file,hasConfig:!!shop};
}
function decryptDpapiToken(tokenFile){
  if(process.platform!=='win32')return'';
  if(!fs.existsSync(tokenFile))return'';
  const escaped=tokenFile.replace(/'/g,"''");
  const ps="$e=Get-Content -LiteralPath '"+escaped+"' -Raw; $s=ConvertTo-SecureString $e; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
  try{
    return childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{
      encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:64*1024
    }).trim();
  }catch(_){return''}
}
function resolveCredentials(workspace){
  const config=loadConfig(workspace);
  const token=String(process.env.JARVIS_SHOPIFY_TOKEN||decryptDpapiToken(config.tokenFile)||'').trim();
  return{...config,token,ready:!!(config.shop&&token)};
}
function graphQLRequest({shop,apiVersion,token},query,variables={}){
  if(!shop||!token)throw new Error('SHOPIFY_NOT_CONNECTED');
  const body=JSON.stringify({query,variables});
  const options={
    hostname:shop,
    port:443,
    path:'/admin/api/'+encodeURIComponent(apiVersion||DEFAULT_API_VERSION)+'/graphql.json',
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Content-Length':Buffer.byteLength(body),
      'X-Shopify-Access-Token':token
    },
    timeout:25000
  };
  return new Promise((resolve,reject)=>{
    const req=https.request(options,res=>{
      const chunks=[];
      res.on('data',d=>chunks.push(d));
      res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        let json;
        try{json=JSON.parse(raw)}catch(_){return reject(new Error('Shopify geçersiz JSON döndürdü'))}
        if(res.statusCode<200||res.statusCode>=300){
          const e=new Error('Shopify HTTP '+res.statusCode);
          e.statusCode=res.statusCode;e.payload=json;return reject(e);
        }
        if(Array.isArray(json.errors)&&json.errors.length){
          const e=new Error('Shopify GraphQL: '+json.errors.map(x=>x.message).join(' | '));
          e.payload=json;return reject(e);
        }
        resolve(json.data||{});
      });
    });
    req.on('timeout',()=>req.destroy(new Error('Shopify isteği zaman aşımına uğradı')));
    req.on('error',reject);
    req.write(body);req.end();
  });
}
function summarizeErrors(errors){
  return (Array.isArray(errors)?errors:[]).map(x=>({
    field:Array.isArray(x.field)?x.field.join('.'):String(x.field||''),
    message:String(x.message||''),
    code:String(x.code||'')
  }));
}
async function status(workspace){
  const creds=resolveCredentials(workspace);
  if(!creds.ready)return{
    ok:false,connected:false,shop:creds.shop||null,apiVersion:creds.apiVersion,
    message:'Shopify yerel bağlantısı kurulmamış. Bir kez jarvis-shopify-connect.ps1 çalıştırılmalı.'
  };
  try{
    const data=await graphQLRequest(creds,`query JarvisShopStatus { shop { name myshopifyDomain currencyCode } }`);
    return{
      ok:true,connected:true,shop:data.shop||null,apiVersion:creds.apiVersion,
      message:'Shopify bağlantısı hazır · '+String(data.shop&&data.shop.name||creds.shop)+' · '+String(data.shop&&data.shop.currencyCode||'')
    };
  }catch(err){
    return{ok:false,connected:false,shop:creds.shop||null,apiVersion:creds.apiVersion,message:'Shopify bağlantı testi başarısız: '+err.message};
  }
}
function saveLocalDraft(workspace,product){
  const dirs=commerceDirs(workspace);
  const payload=productSetPayload(product,{status:'DRAFT'});
  const id=safeName(payload.normalized.title)+'-'+Date.now();
  const file=path.join(dirs.drafts,id+'.json');
  const data={
    schema:1,
    engine:'JARVIS_COMMERCE_ENGINE',
    version:ENGINE_VERSION,
    createdAt:new Date().toISOString(),
    mode:'DRAFT',
    product:payload.normalized
  };
  fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');
  return{ok:true,file,data,message:'Yerel ürün taslağı hazır: '+file};
}
async function updateDefaultVariant(creds,productId,variantId,p){
  if(!variantId)return null;
  const variant={id:variantId};
  if(p.price!==null)variant.price=p.price;
  if(p.compareAtPrice!==null)variant.compareAtPrice=p.compareAtPrice;
  if(p.sku)variant.inventoryItem={sku:p.sku};
  if(Object.keys(variant).length===1)return null;
  const query=`mutation JarvisVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product { id }
      productVariants { id title price compareAtPrice inventoryItem { sku } }
      userErrors { field message }
    }
  }`;
  const data=await graphQLRequest(creds,query,{productId,variants:[variant]});
  const out=data.productVariantsBulkUpdate||{};
  const errors=summarizeErrors(out.userErrors);
  if(errors.length){
    const e=new Error('Varyant güncellenemedi: '+errors.map(x=>x.message).join(' | '));
    e.userErrors=errors;throw e;
  }
  return out.productVariants&&out.productVariants[0]||null;
}
async function createDraft(workspace,product){
  const creds=resolveCredentials(workspace);
  if(!creds.ready)throw new Error('SHOPIFY_NOT_CONNECTED');
  const payload=productSetPayload(product,{status:'DRAFT'});
  const query=`mutation JarvisProductDraft($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        id
        title
        handle
        status
        vendor
        variants(first: 25) { nodes { id title price compareAtPrice sku } }
      }
      userErrors { code field message }
    }
  }`;
  const data=await graphQLRequest(creds,query,{input:payload.input});
  const out=data.productSet||{};
  const errors=summarizeErrors(out.userErrors);
  if(errors.length){
    const e=new Error('Shopify ürün taslağı oluşturulamadı: '+errors.map(x=>x.message).join(' | '));
    e.userErrors=errors;throw e;
  }
  if(!out.product||!out.product.id)throw new Error('Shopify ürün ID döndürmedi');

  if(!payload.normalized.variants.length){
    const defaultVariant=out.product.variants&&out.product.variants.nodes&&out.product.variants.nodes[0];
    const updated=await updateDefaultVariant(creds,out.product.id,defaultVariant&&defaultVariant.id,payload.normalized);
    if(updated&&out.product.variants&&out.product.variants.nodes)out.product.variants.nodes[0]=updated;
  }

  const dirs=commerceDirs(workspace);
  const receipt=path.join(dirs.receipts,'draft-'+safeName(out.product.title)+'-'+Date.now()+'.json');
  fs.writeFileSync(receipt,JSON.stringify({
    engine:'JARVIS_COMMERCE_ENGINE',
    version:ENGINE_VERSION,
    createdAt:new Date().toISOString(),
    shop:creds.shop,
    apiVersion:creds.apiVersion,
    action:'CREATE_DRAFT_PRODUCT',
    product:out.product
  },null,2),'utf8');

  return{
    ok:true,
    product:out.product,
    receipt,
    message:'Shopify taslak ürün oluşturuldu · '+out.product.title+' · '+out.product.id
  };
}
async function findOnlineStorePublication(creds){
  const data=await graphQLRequest(creds,`query JarvisPublications { publications(first: 50) { nodes { id name } } }`);
  const nodes=data.publications&&data.publications.nodes||[];
  return nodes.find(x=>/online store/i.test(String(x.name||'')))||null;
}
function canonicalUtcIso(value){
  const s=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s))return null;
  const ms=Date.parse(s);
  if(!Number.isFinite(ms))return null;
  try{if(new Date(ms).toISOString()!==s)return null}catch(_){return null}
  return{value:s,ms};
}
function shopifyApprovalError(message='Shopify PUBLIC yayınlama için aynı ürün ve aktif mission ile bağlı açık kullanıcı onayı gerekli.'){
  const e=new Error('SHOPIFY_EXPLICIT_APPROVAL_REQUIRED');
  e.code='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED';
  e.detail=message;
  return e;
}
function resolveShopifyPublishApproval(workspace,productId,{nowMs=Date.now()}={}){
  const id=String(productId||'').trim();
  if(!/^gid:\/\/shopify\/Product\/\d+$/.test(id))throw new Error('Geçersiz Shopify Product GID');
  const missionRoot=path.join(path.resolve(workspace),'.jarvis-missions');
  let names=[];
  try{names=fs.readdirSync(missionRoot).filter(x=>/^M-[A-Z0-9-]{12,80}\.json$/.test(x))}catch(_){throw shopifyApprovalError()}
  const clock=Number(nowMs);
  const now=Number.isFinite(clock)?clock:Date.now();
  const matches=[];
  for(const name of names){
    const mission=readJson(path.join(missionRoot,name));
    if(!mission||mission.schema!==1||mission.engine!=='JARVIS_MISSION_ENGINE'||mission.type!=='shopify_product')continue;
    if(!/^M-[A-Z0-9-]{12,80}$/.test(String(mission.id||'')))continue;
    if(mission.status!=='running'||!Array.isArray(mission.steps))continue;
    const currentIndex=Number(mission.currentStep);
    if(!Number.isInteger(currentIndex)||currentIndex<0||currentIndex>=mission.steps.length)continue;
    const publishStep=mission.steps[currentIndex];
    if(!publishStep||publishStep.name!=='shopify_publish'||publishStep.status!=='running')continue;
    if(!(publishStep.meta&&publishStep.meta.requiresApproval===true))continue;
    const approved=canonicalUtcIso(publishStep.meta.approvedAt);
    const publishStarted=canonicalUtcIso(publishStep.startedAt);
    if(!approved||!publishStarted||approved.ms>now||approved.ms>publishStarted.ms)continue;
    const draftStep=mission.steps.find(x=>x&&x.name==='shopify_draft');
    if(!draftStep||draftStep.status!=='completed')continue;
    const draftCompleted=canonicalUtcIso(draftStep.completedAt);
    if(!draftCompleted||approved.ms<draftCompleted.ms)continue;
    const artifact=draftStep.artifact||(mission.artifacts&&mission.artifacts.shopify_draft)||null;
    const draftProductId=String(artifact&&artifact.product&&artifact.product.id||'').trim();
    if(draftProductId!==id)continue;
    matches.push({
      missionId:mission.id,
      productId:id,
      approvedAt:approved.value,
      draftCompletedAt:draftCompleted.value,
      publishStartedAt:publishStarted.value
    });
  }
  if(matches.length!==1){
    if(matches.length>1)throw shopifyApprovalError('Aynı ürün için birden fazla aktif onaylı Shopify mission bulundu; fail-closed.');
    throw shopifyApprovalError();
  }
  return matches[0];
}
function assertActiveProduct(update,productId){
  const id=String(productId||'').trim();
  const product=update&&update.product||null;
  if(!product||String(product.id||'')!==id||String(product.status||'').toUpperCase()!=='ACTIVE'){
    const e=new Error('SHOPIFY_ACTIVE_POSTCONDITION_FAILED');
    e.code='SHOPIFY_ACTIVE_POSTCONDITION_FAILED';
    e.productId=id;
    throw e;
  }
  return product;
}
function assertPublishedOnPublication(out,publication){
  const publicationId=String(publication&&publication.id||'').trim();
  const published=!!(out&&out.publishable&&out.publishable.publishedOnPublication===true);
  if(!publicationId||!published){
    const e=new Error('SHOPIFY_PUBLICATION_POSTCONDITION_FAILED');
    e.code='SHOPIFY_PUBLICATION_POSTCONDITION_FAILED';
    e.publicationId=publicationId||null;
    throw e;
  }
  return true;
}
async function publishProduct(workspace,productId){
  const id=String(productId||'').trim();
  if(!/^gid:\/\/shopify\/Product\/\d+$/.test(id))throw new Error('Geçersiz Shopify Product GID');
  const approval=resolveShopifyPublishApproval(workspace,id);
  const creds=resolveCredentials(workspace);
  if(!creds.ready)throw new Error('SHOPIFY_NOT_CONNECTED');

  const publication=await findOnlineStorePublication(creds);
  if(!publication)throw new Error('Online Store publication bulunamadı');

  const active=await graphQLRequest(creds,`mutation JarvisActivateProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id title status }
      userErrors { field message }
    }
  }`,{product:{id,status:'ACTIVE'}});
  const update=active.productUpdate||{};
  const updateErrors=summarizeErrors(update.userErrors);
  if(updateErrors.length)throw new Error('Ürün ACTIVE yapılamadı: '+updateErrors.map(x=>x.message).join(' | '));
  const activeProduct=assertActiveProduct(update,id);

  const pub=await graphQLRequest(creds,`mutation JarvisPublishProduct($id: ID!, $input: [PublicationInput!]!, $publicationId: ID!) {
    publishablePublish(id: $id, input: $input) {
      publishable { publishedOnPublication(publicationId: $publicationId) }
      userErrors { field message }
    }
  }`,{
    id,
    input:[{publicationId:publication.id}],
    publicationId:publication.id
  });
  const out=pub.publishablePublish||{};
  const errors=summarizeErrors(out.userErrors);
  if(errors.length)throw new Error('Ürün yayınlanamadı: '+errors.map(x=>x.message).join(' | '));
  const publicationVerified=assertPublishedOnPublication(out,publication);
  const dirs=commerceDirs(workspace);
  const receipt=path.join(dirs.receipts,'publish-'+safeName(activeProduct.title||id)+'-'+Date.now()+'.json');
  fs.writeFileSync(receipt,JSON.stringify({
    engine:'JARVIS_COMMERCE_ENGINE',
    version:ENGINE_VERSION,
    createdAt:new Date().toISOString(),
    shop:creds.shop,
    apiVersion:creds.apiVersion,
    action:'PUBLISH_PRODUCT',
    missionId:approval.missionId,
    approvedAt:approval.approvedAt,
    draftCompletedAt:approval.draftCompletedAt,
    product:activeProduct,
    publication,
    publicationVerified
  },null,2),'utf8');
  return{
    ok:true,
    product:activeProduct,
    publication,
    publicationVerified,
    approval,
    receipt,
    message:'Ürün Online Store kanalında yayınlandı · '+String(activeProduct.title||id)
  };
}
function missionTag(missionId){
  const id=String(missionId||'').trim().replace(/[^A-Za-z0-9_-]/g,'_').slice(0,90);
  if(!id)throw new Error('mission id required');
  return 'jarvis_mission_'+id;
}
async function findProductByMission(workspace,missionId){
  const creds=resolveCredentials(workspace);
  if(!creds.ready)throw new Error('SHOPIFY_NOT_CONNECTED');
  const tag=missionTag(missionId);
  const query=`query JarvisMissionProduct($query: String!) {
    products(first: 5, query: $query) {
      nodes { id title handle status tags }
    }
  }`;
  const data=await graphQLRequest(creds,query,{query:'tag:'+tag});
  const nodes=data.products&&data.products.nodes||[];
  const product=nodes.find(x=>Array.isArray(x.tags)&&x.tags.includes(tag))||nodes[0]||null;
  return{ok:true,tag,product};
}
async function createDraftForMission(workspace,product,missionId){
  const tag=missionTag(missionId);
  const existing=await findProductByMission(workspace,missionId);
  if(existing.product){
    return{
      ok:true,reused:true,missionTag:tag,product:existing.product,
      message:'Shopify mission taslağı zaten mevcut · '+existing.product.title+' · '+existing.product.id
    };
  }
  const input={...(product||{})};
  input.tags=[...new Set([...normalizeTags(input.tags),tag])];
  const out=await createDraft(workspace,input);
  return{...out,reused:false,missionTag:tag};
}
function parseKeyValueProduct(text){
  const raw=String(text||'').trim();
  if(!raw)return null;
  const parts=raw.split('|').map(x=>x.trim()).filter(Boolean);
  if(!parts.length)return null;
  const product={title:parts.shift()};
  for(const part of parts){
    const m=part.match(/^([^=]+)=(.*)$/s);
    if(!m)continue;
    const key=m[1].trim().toLocaleLowerCase('tr-TR');
    const value=m[2].trim();
    if(['fiyat','price'].includes(key))product.price=value;
    else if(['karşılaştırma','karsilastirma','compare','compareatprice'].includes(key))product.compareAtPrice=value;
    else if(['sku','stok kodu'].includes(key))product.sku=value;
    else if(['açıklama','aciklama','description'].includes(key))product.description=value;
    else if(['tip','type','ürün tipi','urun tipi'].includes(key))product.productType=value;
    else if(['etiket','etiketler','tags'].includes(key))product.tags=value;
    else if(['görsel','gorsel','image','images'].includes(key))product.images=value.split(',').map(x=>x.trim());
    else if(['vendor','marka'].includes(key))product.vendor=value;
    else if(['handle','slug'].includes(key))product.handle=value;
  }
  return product;
}

module.exports={
  ENGINE_VERSION,
  DEFAULT_API_VERSION,
  normalizeShopDomain,
  normalizeProduct,
  productSetPayload,
  parseKeyValueProduct,
  loadConfig,
  resolveCredentials,
  status,
  saveLocalDraft,
  createDraft,
  missionTag,
  findProductByMission,
  createDraftForMission,
  resolveShopifyPublishApproval,
  assertActiveProduct,
  assertPublishedOnPublication,
  publishProduct
};
