const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("'creator_auto_web_query_v1'"),'auto web query capability missing');
assert.ok(worker.includes("creatorAutoWebReady:CAPS.includes('creator_auto_web_query_v1')"),'PC acceptance auto-web readiness missing');
assert.ok(worker.includes('function creatorAutoWebQuery(title,script,maxTerms=9)'),'local deterministic query planner missing');
assert.ok(worker.includes('async function creatorAutoWebAssets('),'central auto-web asset helper missing');
assert.ok(worker.includes("localQueryOnly:true"),'auto-web evidence must record local query planning');
assert.ok(worker.includes("if(!queries.length)return[];"),'empty auto query set must fail open');
assert.ok(worker.includes("}catch(_){}\n  return[];"),'auto-web fetch failure must fail open');
assert.ok(worker.includes("const assets=await creatorAutoWebAssets({\n            title:brief.title,\n            script:brief.script"),'daily long-form must use local scene-aware web helper');
assert.ok((worker.match(/webMediaAuto:\{type:'boolean'/g)||[]).length>=4,'batch/Short/long-form/VAROVA auto-web controls missing');
assert.ok(worker.includes("item.webMediaAuto===false"),'batch auto-web opt-out missing');
assert.ok((worker.match(/a\.webMediaAuto!==false/g)||[]).length>=3,'Short/long-form/VAROVA auto-web default-on guard missing');

const start=worker.indexOf('function creatorAutoWebQuery(title,script,maxTerms=9)');
const end=worker.indexOf('function creatorSceneWebQueries',start);
assert.ok(start>0&&end>start,'query planner block missing');
const fnSource=worker.slice(start,end);
const planner=Function(fnSource+'; return creatorAutoWebQuery;')();

const title='Robotik Laboratuvar Geleceği';
const script='Bir robot laboratuvarda çalışıyor ve yapay zeka robot hareketlerini analiz ediyor. Geleceğin üretim hattında robot kolu hassas montaj yapıyor.';
const q1=planner(title,script,9);
const q2=planner(title,script,9);
assert.strictEqual(q1,q2,'auto web query must be deterministic');
assert.ok(q1.length>0&&q1.length<=140,'auto web query length must stay bounded');
assert.ok(/robot|robotik/.test(q1),'important visual concept missing from query');
assert.ok(/laboratuvar/.test(q1),'title concept should receive priority');
assert.ok(!/(^|\s)(bir|ve|için|icin)(\s|$)/.test(q1),'stop words must be filtered');
assert.ok(!q1.includes('robot laboratuvarda çalışıyor ve yapay zeka robot hareketlerini analiz ediyor'),'full script must not be sent as search query');

assert.ok(worker.includes("'creator_image_motion_fallback_v1'"),'Image Motion v74 capability regressed');
assert.ok(worker.includes("'creator_short_motion_rhythm_v1'"),'Short Motion v73 capability regressed');
assert.ok(worker.includes("'creator_youtube_attribution_v1'"),'YouTube attribution capability regressed');
assert.ok(worker.includes('\"Devam et\" tek başına YouTube PUBLIC onayı değildir'),'YouTube PUBLIC approval policy regressed');
assert.ok(worker.includes('\"Devam et\" tek başına yayınlama onayı değildir'),'Shopify approval policy regressed');

console.log('CREATOR AUTO WEB V75 SELFTEST PASS');
