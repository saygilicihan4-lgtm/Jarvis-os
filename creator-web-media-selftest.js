const fs=require('fs');
const assert=require('assert');
const web=require('./jarvis-creator-web-media');

const worker=fs.readFileSync('./worker.js','utf8');
assert.strictEqual(web.CREATOR_WEB_MEDIA_VERSION,'1.0');

assert.strictEqual(web.publicDomainLicense('Public domain'),true);
assert.strictEqual(web.publicDomainLicense('CC0 1.0'),true);
assert.strictEqual(web.publicDomainLicense('CC BY 4.0'),false);

assert.strictEqual(web.urlHostAllowed('wikimedia','https://upload.wikimedia.org/example.webm'),true);
assert.strictEqual(web.urlHostAllowed('pexels','https://videos.pexels.com/video-files/example.mp4'),true);
assert.strictEqual(web.urlHostAllowed('pixabay','https://cdn.pixabay.com/video/example.mp4'),true);
assert.strictEqual(web.urlHostAllowed('pexels','https://youtube.com/watch?v=x'),false);
assert.strictEqual(web.urlHostAllowed('wikimedia','http://upload.wikimedia.org/example.webm'),false);

const commons={
  query:{pages:[
    {pageid:1,title:'File:Safe.webm',imageinfo:[{
      url:'https://upload.wikimedia.org/safe.webm',
      mime:'video/webm',width:1920,height:1080,
      extmetadata:{
        LicenseShortName:{value:'CC0 1.0'},
        LicenseUrl:{value:'https://creativecommons.org/publicdomain/zero/1.0/'},
        Artist:{value:'Example Creator'}
      }
    }]},
    {pageid:2,title:'File:Attribution.webm',imageinfo:[{
      url:'https://upload.wikimedia.org/by.webm',
      mime:'video/webm',width:1920,height:1080,
      extmetadata:{LicenseShortName:{value:'CC BY 4.0'}}
    }]}
  ]}
};
const wikimedia=web.normalizeWikimedia(commons,'landscape');
assert.strictEqual(wikimedia.length,1,'autonomous Commons import must fail closed to Public Domain/CC0');
assert.strictEqual(wikimedia[0].license,'CC0 1.0');
assert.strictEqual(web.candidateAllowed(wikimedia[0]).ok,true);

const pexels=web.normalizePexels({videos:[{
  id:42,url:'https://www.pexels.com/video/42',duration:12,user:{name:'Creator'},
  video_files:[
    {file_type:'video/mp4',width:1080,height:1920,link:'https://videos.pexels.com/video-files/portrait.mp4'},
    {file_type:'video/mp4',width:1920,height:1080,link:'https://videos.pexels.com/video-files/landscape.mp4'}
  ]
}]},'portrait');
assert.strictEqual(pexels.length,1);
assert.ok(pexels[0].downloadUrl.includes('portrait.mp4'));
assert.strictEqual(pexels[0].license,'Pexels License');

const pixabay=web.normalizePixabay({hits:[{
  id:7,pageURL:'https://pixabay.com/videos/id-7/',user:'Creator',tags:'robot, ai',
  videos:{medium:{url:'https://cdn.pixabay.com/video/medium.mp4',width:720,height:1280,size:1000}}
}]},'portrait');
assert.strictEqual(pixabay.length,1);
assert.strictEqual(pixabay[0].license,'Pixabay Content License');

for(const cap of ['creator_web_media_v1','creator_web_license_manifest_v1','creator_web_zero_key_v1']){
  assert.ok(worker.includes("'"+cap+"'"),cap+' missing');
}
assert.ok(worker.includes("name:'creator_web_media'"),'native Creator web media tool missing');
assert.ok(worker.includes("else if(n==='creator_web_media')"),'native Creator web media handler missing');
assert.ok(worker.includes("syncRepoRuntimeFile('jarvis-creator-web-media.js'"),'runtime sync for Creator web media missing');
assert.ok(worker.includes("webMediaQuery:{type:'string'"),'Creator mission webMediaQuery schema missing');
assert.ok(worker.includes("orientation:'portrait'"),'Short web-media orientation missing');
assert.ok(worker.includes("orientation:'landscape'"),'long-form web-media orientation missing');
assert.ok(worker.includes("inspect:(rel)=>getCreatorEngine().inspectAsset(WORKSPACE,rel)"),'downloaded web media must pass Creator FFprobe inspection');
assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'YouTube explicit approval policy must remain');
assert.ok(worker.includes('"Devam et" tek başına yayınlama onayı değildir'),'Shopify explicit approval policy must remain');

console.log('CREATOR WEB MEDIA V70 SELFTEST PASS');
