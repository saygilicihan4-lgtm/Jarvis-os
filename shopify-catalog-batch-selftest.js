const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.101.0'"),'Worker 2.101.0 required');
assert.ok(worker.includes("'shopify_catalog_batch_v1'"),'catalog batch capability missing');
assert.ok(worker.includes("'shopify_catalog_child_dedupe_v1'"),'catalog child dedupe capability missing');
assert.ok(worker.includes("'shopify_catalog_draft_only_v1'"),'catalog draft-only capability missing');
assert.ok(worker.includes("'shopify_catalog_batch_fingerprint_v1'"),'catalog batch fingerprint capability missing');

assert.ok(worker.includes("name:'shopify_catalog_batch_mission'"),'native catalog batch tool missing');
assert.ok(worker.includes("else if(n==='shopify_catalog_batch_mission')"),'catalog batch handler missing');
assert.ok(worker.includes("minItems:2"),'catalog batch minimum missing');
assert.ok(worker.includes("maxItems:30"),'catalog batch maximum missing');

const toolStart=worker.indexOf("name:'shopify_catalog_batch_mission'");
const nextTool=worker.indexOf("name:'shopify_product_mission'",toolStart);
assert.ok(toolStart>0&&nextTool>toolStart,'catalog tool block missing');
const toolBlock=worker.slice(toolStart,nextTool);
assert.ok(!toolBlock.includes("publish:{"),'catalog batch must expose no publish option');
assert.ok(toolBlock.includes('Bu araçta PUBLIC publish seçeneği yoktur.'),'catalog contract must state draft-only');

assert.ok(worker.includes('function normalizeShopifyCatalogProduct(args={})'),'catalog product normalizer missing');
assert.ok(worker.includes('function shopifyCatalogItemFingerprint(product)'),'product fingerprint helper missing');
assert.ok(worker.includes('function normalizeShopifyCatalogItems(args={})'),'catalog item normalizer missing');
assert.ok(worker.includes("args.items)?args.items.slice(0,30)"),'catalog must cap at 30 items');
assert.ok(worker.includes("if(rows.length<2)throw new Error('Shopify catalog batch için en az 2 ürün gerekli.')"),'catalog minimum guard missing');
assert.ok(worker.includes('if(fingerprints.has(fingerprint))'),'duplicate product fingerprint guard missing');
assert.ok(worker.includes('if(skus.has(sku))'),'duplicate SKU guard missing');

assert.ok(worker.includes('function shopifyCatalogFingerprint(items)'),'batch fingerprint helper missing');
const fpStart=worker.indexOf('function shopifyCatalogFingerprint(items)');
const fpEnd=worker.indexOf('function findShopifyCatalogBatchByFingerprint',fpStart);
const fpBlock=worker.slice(fpStart,fpEnd);
assert.ok(fpBlock.includes('.sort()'),'catalog fingerprint must be order-insensitive');
assert.ok(worker.includes('function findShopifyCatalogBatchByFingerprint(fingerprint)'),'existing catalog batch lookup missing');
assert.ok(worker.includes("m&&m.type==='shopify_catalog_batch'"),'catalog reuse must be scoped to batch missions');
assert.ok(worker.includes("!['failed','cancelled'].includes"),'failed/cancelled catalog missions must not be reused');
assert.ok(worker.includes('if(existing)return existing;'),'same catalog must reuse existing parent mission');

assert.ok(worker.includes('function findShopifyCatalogChild(parentId,index)'),'catalog child lookup missing');
assert.ok(worker.includes("m&&m.type==='shopify_product'"),'catalog child must be shopify_product mission');
assert.ok(worker.includes("String(m.input&&m.input.catalogParent||'')===pid"),'catalog child parent binding missing');
assert.ok(worker.includes("Number(m.input&&m.input.catalogIndex)===Number(index)"),'catalog child index binding missing');
assert.ok(worker.includes('function ensureShopifyCatalogChild(parentMission,index)'),'catalog child creator missing');
assert.ok(worker.includes('SHOPIFY_CATALOG_CHILD_FINGERPRINT_MISMATCH'),'catalog child fingerprint mismatch guard missing');
assert.ok(worker.includes('publish:false'),'catalog child must force publish=false');
assert.ok(worker.includes('catalogParent:String(args._catalogParent||\'\')'),'child must persist catalog parent');
assert.ok(worker.includes('catalogFingerprint:String(args._catalogFingerprint||\'\')'),'child must persist product fingerprint');

assert.ok(worker.includes("type:'shopify_catalog_batch'"),'catalog parent mission type missing');
assert.ok(worker.includes("name:'shopify_catalog_'"),'catalog step naming missing');
assert.ok(worker.includes("if(/^shopify_catalog_\\d+$/.test(step.name))"),'catalog execution/recovery missing');
assert.ok(worker.includes("dependency:'mission:'+child.id"),'catalog parent must yield to child mission scheduler');
assert.ok(worker.includes("createDraftForMission(WORKSPACE,product,id)"),'child Shopify mission idempotency must remain');
assert.ok(worker.includes("shopifyCatalogBatchReady:CAPS.includes('shopify_catalog_batch_v1')"),'PC acceptance must require catalog batch readiness');

assert.ok(worker.includes("if(/^mission:M-[A-Z0-9-]{12,80}$/.test(dep))"),'strict child mission dependency validation must remain');
assert.ok(worker.includes("if(dep.startsWith('mission:'))return false"),'malformed mission dependency must remain blocked');

assert.ok(worker.includes("if(publishRequested)steps.push({name:'shopify_publish',meta:{requiresApproval:true}})"),'single-product explicit publish gate must remain');
assert.ok(worker.includes("code:'EXPLICIT_APPROVAL_REQUIRED'"),'publish approval barrier must remain');
assert.ok(worker.includes('\"Devam et\" tek başına Shopify yayınlama onayı değildir'),'generic continue must not approve Shopify publish');
assert.ok(worker.includes('Bu batch yalnız DRAFT oluşturur; PUBLIC publish alanı yoktur.'),'agent guidance must preserve catalog draft-only policy');

console.log('SHOPIFY CATALOG BATCH V67 SELFTEST PASS');
