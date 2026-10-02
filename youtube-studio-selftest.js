const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const yt=require('./jarvis-youtube-studio');

(async()=>{
  assert.strictEqual(yt.YOUTUBE_STUDIO_VERSION,'1.1');
  assert.strictEqual(yt.STUDIO_URL,'https://studio.youtube.com/');

  const spec=yt.parseUploadSpec('creator-video/test.mp4 | başlık=Deneme Başlık | açıklama=Kısa açıklama');
  assert.strictEqual(spec.file,'creator-video/test.mp4');
  assert.strictEqual(spec.title,'Deneme Başlık');
  assert.strictEqual(spec.description,'Kısa açıklama');

  assert.strictEqual(yt.authRequired({url:'https://accounts.google.com/signin',text:''}),true);
  assert.strictEqual(yt.authRequired({url:'https://studio.youtube.com/',text:'Kanal içeriği Dashboard'}),false);

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-youtube-'));
  fs.mkdirSync(path.join(tmp,'creator-video'),{recursive:true});
  const video=path.join(tmp,'creator-video','demo.mp4');
  fs.writeFileSync(video,Buffer.alloc(2048,1));
  const resolved=yt.resolveWorkspaceVideo(tmp,'creator-video/demo.mp4');
  assert.strictEqual(resolved.full,video);
  assert.throws(()=>yt.resolveWorkspaceVideo(tmp,path.resolve(tmp,'..','outside.mp4')),/workspace/);

  let uploads=0;
  let publishClicks=0;
  let publishSucceeded=false;
  let allowPublishSuccess=true;
  const fakeOperator={
    status:async()=>({running:true,profile:'test',browser:'fake'}),
    navigate:async()=>({ok:true}),
    pageSnapshot:async()=>publishSucceeded
      ?({ok:true,url:'https://studio.youtube.com/video/test/edit',title:'Studio',text:'Video yayınlandı'})
      :({ok:true,url:'https://studio.youtube.com/video/test/edit',title:'Studio',text:'Ayrıntılar Görünürlük Visibility Public'}),
    evaluate:async(_workspace,expression)=>String(expression||'').includes("document.querySelector('input[type=file]')")
      ?true
      :({ok:true,text:'Public'}),
    uploadFile:async()=>{uploads++;return{ok:true}},
    setField:async()=>({ok:true}),
    clickByText:async(_workspace,label)=>{
      if(/^(?:Yayınla|Yayinla|Publish)$/i.test(String(label||''))){
        publishClicks++;
        if(allowPublishSuccess)publishSucceeded=true;
      }
      return{ok:true,text:label};
    }
  };

  const missionId='M-TEST-1234567890';
  const first=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Mission Test',
    description:'Açıklama',
    missionId
  });
  assert.strictEqual(first.ok,true);
  assert.strictEqual(first.published,false);
  assert.strictEqual(uploads,1);
  let receipt=yt.readReceipt(tmp,missionId);
  assert.strictEqual(receipt.state,'draft_prepared');

  const second=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Mission Test',
    description:'Açıklama',
    missionId
  });
  assert.strictEqual(second.ok,true);
  assert.strictEqual(second.reused,true);
  assert.strictEqual(uploads,1,'mission retry must not duplicate YouTube upload');

  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId}),
    /approval proof/
  );

  const approvedAt=new Date().toISOString();
  const published=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt});
  assert.strictEqual(published.ok,true);
  assert.strictEqual(published.published,true);
  assert.strictEqual(publishClicks,1);
  receipt=yt.readReceipt(tmp,missionId);
  assert.strictEqual(receipt.state,'published');
  assert.strictEqual(receipt.published,true);
  assert.strictEqual(receipt.approvedAt,approvedAt);

  const publishedAgain=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt});
  assert.strictEqual(publishedAgain.ok,true);
  assert.strictEqual(publishedAgain.reused,true);
  assert.strictEqual(publishClicks,1,'published mission must never click Publish twice');

  // A final Publish click with no verifiable success becomes uncertain and must never auto-click again.
  const uncertainId='M-UNCERTAIN-123456';
  publishSucceeded=false;
  allowPublishSuccess=false;
  const uncertainDraft=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Uncertain Test',
    description:'Açıklama',
    missionId:uncertainId
  });
  assert.strictEqual(uncertainDraft.ok,true);
  const beforeUncertainClicks=publishClicks;
  const uncertain=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId:uncertainId,approvedAt:new Date().toISOString()});
  assert.strictEqual(uncertain.ok,false);
  assert.strictEqual(uncertain.code,'YOUTUBE_PUBLISH_UNCERTAIN');
  assert.strictEqual(uncertain.uncertain,true);
  assert.strictEqual(publishClicks,beforeUncertainClicks+1);
  const uncertainAgain=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId:uncertainId,approvedAt:new Date().toISOString()});
  assert.strictEqual(uncertainAgain.ok,false);
  assert.strictEqual(uncertainAgain.code,'YOUTUBE_PUBLISH_UNCERTAIN');
  assert.strictEqual(publishClicks,beforeUncertainClicks+1,'uncertain publish must never click Publish twice');

  const source=fs.readFileSync('./jarvis-youtube-studio.js','utf8');
  const worker=fs.readFileSync('./worker.js','utf8');
  const server=fs.readFileSync('./server.js','utf8');
  assert.ok(source.includes("published:false"),'draft result must state not published');
  assert.ok(source.includes("state:'upload_started'"),'preflight upload receipt missing');
  assert.ok(source.includes("state:'publish_started'"),'publish preflight receipt missing');
  assert.ok(source.includes("YOUTUBE_UPLOAD_UNCERTAIN"),'uncertain upload guard missing');
  assert.ok(source.includes("YOUTUBE_PUBLISH_UNCERTAIN"),'uncertain publish guard missing');
  assert.ok(source.includes('explicit approval proof required for YouTube publish'),'module-level approval proof missing');
  assert.ok(source.includes("input[type=file]"),'file input upload path missing');
  assert.ok(worker.includes("name:'youtube_prepare_draft_upload'"),'native YouTube draft tool missing');
  assert.ok(worker.includes("name:'youtube_studio_status'"),'native YouTube status tool missing');
  assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
  assert.ok(!worker.includes("name:'youtube_publish'"),'YouTube public publish must not be a direct autonomous native tool');
  assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'generic resume must not count as YouTube publish approval');
  assert.ok(server.includes("return'youtube_upload_prepare_v1'"),'server YouTube draft routing missing');

  console.log('YOUTUBE STUDIO APPROVAL SELFTEST PASS');
})().catch(e=>{console.error(e);process.exit(1)});
