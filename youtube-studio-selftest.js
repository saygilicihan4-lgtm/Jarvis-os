const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const yt=require('./jarvis-youtube-studio');

(async()=>{
  assert.strictEqual(yt.YOUTUBE_STUDIO_VERSION,'1.1');
  assert.strictEqual(yt.STUDIO_URL,'https://studio.youtube.com/');
  assert.ok(typeof yt.resolveYouTubePublishApproval==='function');

  const spec=yt.parseUploadSpec('creator-video/test.mp4 | başlık=Deneme Başlık | açıklama=Kısa açıklama');
  assert.strictEqual(spec.file,'creator-video/test.mp4');
  assert.strictEqual(spec.title,'Deneme Başlık');
  assert.strictEqual(spec.description,'Kısa açıklama');

  assert.strictEqual(yt.authRequired({url:'https://accounts.google.com/signin',text:''}),true);
  assert.strictEqual(yt.authRequired({url:'https://studio.youtube.com/',text:'Kanal içeriği Dashboard'}),false);

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-youtube-'));
  fs.mkdirSync(path.join(tmp,'creator-video'),{recursive:true});
  const missionDir=path.join(tmp,'.jarvis-missions');
  fs.mkdirSync(missionDir,{recursive:true});
  const video=path.join(tmp,'creator-video','demo.mp4');
  fs.writeFileSync(video,Buffer.alloc(2048,1));
  const resolved=yt.resolveWorkspaceVideo(tmp,'creator-video/demo.mp4');
  assert.strictEqual(resolved.full,video);
  assert.throws(()=>yt.resolveWorkspaceVideo(tmp,path.resolve(tmp,'..','outside.mp4')),/workspace/);

  let uploads=0;
  let publishClicks=0;
  let publishSucceeded=false;
  let allowPublishSuccess=true;
  let staleSuccessMarker=false;
  let publishSuccessUrl='https://studio.youtube.com/video/test/edit';
  const fakeOperator={
    status:async()=>({running:true,profile:'test',browser:'fake'}),
    navigate:async()=>({ok:true}),
    pageSnapshot:async()=>{
      if(publishSucceeded)return{ok:true,url:publishSuccessUrl,title:'Studio',text:'Video yayınlandı'};
      if(staleSuccessMarker)return{ok:true,url:'https://studio.youtube.com/video/test/edit',title:'Studio',text:'Ayrıntılar Görünürlük Visibility Public · Video yayınlandı'};
      return{ok:true,url:'https://studio.youtube.com/video/test/edit',title:'Studio',text:'Ayrıntılar Görünürlük Visibility Public'};
    },
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

  function saveMissionApproval(id,approvedAt,opts={}){
    const receipt=yt.readReceipt(tmp,id);
    assert.ok(receipt,'draft receipt required for mission fixture');
    const draftCompletedAt=opts.draftCompletedAt||receipt.updatedAt||receipt.createdAt;
    const publishStartedAt=opts.publishStartedAt||approvedAt;
    const mission={
      schema:1,
      engine:'JARVIS_MISSION_ENGINE',
      version:'1.0',
      id,
      type:opts.type||'creator_short',
      status:opts.missionStatus||'running',
      createdAt:receipt.createdAt,
      updatedAt:publishStartedAt,
      completedAt:null,
      currentStep:opts.currentStep===undefined?1:opts.currentStep,
      input:{publishYouTube:true},
      artifacts:{},
      history:[],
      steps:[
        {
          index:0,
          name:'youtube_draft',
          status:opts.draftStatus||'completed',
          attempts:1,
          startedAt:receipt.createdAt,
          completedAt:draftCompletedAt,
          error:null,
          artifact:{receipt:yt.missionReceiptFile(tmp,id),published:false},
          meta:{}
        },
        {
          index:1,
          name:'youtube_publish',
          status:opts.publishStatus||'running',
          attempts:1,
          startedAt:publishStartedAt,
          completedAt:null,
          error:null,
          artifact:null,
          meta:{requiresApproval:opts.requiresApproval===undefined?true:opts.requiresApproval,approvedAt}
        }
      ]
    };
    fs.writeFileSync(path.join(missionDir,id+'.json'),JSON.stringify(mission,null,2),'utf8');
    return mission;
  }
  function approvalRequired(promiseFactory){
    return assert.rejects(promiseFactory,err=>err&&err.code==='YOUTUBE_EXPLICIT_APPROVAL_REQUIRED');
  }

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

  const beforeInvalidProofClicks=publishClicks;
  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId}),
    /approval proof/
  );
  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt:'yes'}),
    /valid explicit approval timestamp/
  );
  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt:'2000-01-01T00:00:00.000Z'}),
    /predates draft receipt/
  );
  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt:new Date(Date.now()+60000).toISOString()}),
    /timestamp is in the future/
  );
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'invalid approval proof must fail before Publish click');

  // A caller-supplied current timestamp is not enough: the active mission must carry the same approval.
  const forgedAt=new Date().toISOString();
  await approvalRequired(()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt:forgedAt}));
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'forged timestamp must fail before Publish click');

  const approvedAt=new Date().toISOString();
  let mission=saveMissionApproval(missionId,approvedAt);
  let provenance=yt.resolveYouTubePublishApproval(tmp,receipt,missionId,approvedAt);
  assert.strictEqual(provenance.missionId,missionId);
  assert.strictEqual(provenance.approvedAt,approvedAt);
  assert.strictEqual(provenance.draftCompletedAt,mission.steps[0].completedAt);
  assert.strictEqual(provenance.publishStartedAt,mission.steps[1].startedAt);

  // Exact approval timestamp binding: a nearby but different caller timestamp must not be accepted.
  const mismatchedAt=new Date(Date.parse(approvedAt)+1).toISOString();
  await approvalRequired(()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt:mismatchedAt}));
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'timestamp mismatch must fail before Publish click');

  mission=saveMissionApproval(missionId,approvedAt,{requiresApproval:false});
  await approvalRequired(()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt}));
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'requiresApproval=false must fail closed before Publish click');

  mission=saveMissionApproval(missionId,approvedAt,{draftStatus:'pending'});
  await approvalRequired(()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt}));
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'incomplete YouTube draft step must fail before Publish click');

  mission=saveMissionApproval(missionId,approvedAt,{publishStatus:'pending'});
  await approvalRequired(()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt}));
  assert.strictEqual(publishClicks,beforeInvalidProofClicks,'non-running YouTube publish step must fail before Publish click');

  // Stale success text visible before the click must never be accepted as evidence for this publish attempt.
  const staleId='M-STALE-123456789';
  publishSucceeded=false;
  staleSuccessMarker=false;
  allowPublishSuccess=true;
  const staleDraft=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Stale Success Test',
    description:'Açıklama',
    missionId:staleId
  });
  assert.strictEqual(staleDraft.ok,true);
  const staleApprovedAt=new Date().toISOString();
  saveMissionApproval(staleId,staleApprovedAt);
  staleSuccessMarker=true;
  const beforeStaleClicks=publishClicks;
  const stale=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId:staleId,approvedAt:staleApprovedAt});
  assert.strictEqual(stale.ok,false);
  assert.strictEqual(stale.code,'YOUTUBE_STALE_SUCCESS_MARKER');
  assert.strictEqual(stale.uncertain,true);
  assert.strictEqual(publishClicks,beforeStaleClicks,'stale pre-click success marker must stop before Publish click');
  assert.strictEqual(yt.readReceipt(tmp,staleId).state,'draft_prepared','stale marker must not poison receipt into publish_started');
  staleSuccessMarker=false;

  saveMissionApproval(missionId,approvedAt);
  publishSucceeded=false;
  publishSuccessUrl='https://studio.youtube.com/video/test/edit';
  const published=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId,approvedAt});
  assert.strictEqual(published.ok,true);
  assert.strictEqual(published.published,true);
  assert.strictEqual(publishClicks,beforeStaleClicks+1);
  receipt=yt.readReceipt(tmp,missionId);
  assert.strictEqual(receipt.state,'published');
  assert.strictEqual(receipt.published,true);
  assert.strictEqual(receipt.approvedAt,approvedAt);
  assert.strictEqual(receipt.approvalMissionId,missionId);
  assert.strictEqual(receipt.approvalDraftCompletedAt,mission.steps[0].completedAt);
  assert.strictEqual(receipt.approvalPublishStartedAt,mission.steps[1].startedAt);
  assert.ok(/^https:\/\/studio\.youtube\.com\//.test(receipt.publishEvidenceBaselineUrl));
  assert.ok(/^https:\/\/studio\.youtube\.com\//.test(receipt.publishEvidenceUrl));

  const publishedAgain=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId});
  assert.strictEqual(publishedAgain.ok,true);
  assert.strictEqual(publishedAgain.reused,true);
  assert.strictEqual(publishClicks,beforeStaleClicks+1,'published mission must never click Publish twice');

  // A success-looking string off YouTube Studio origin is not valid PUBLIC evidence.
  const offOriginId='M-OFFORIGIN-123456';
  publishSucceeded=false;
  staleSuccessMarker=false;
  allowPublishSuccess=true;
  publishSuccessUrl='https://example.com/not-youtube';
  const offOriginDraft=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Off Origin Test',
    description:'Açıklama',
    missionId:offOriginId
  });
  assert.strictEqual(offOriginDraft.ok,true);
  const offOriginApprovedAt=new Date().toISOString();
  saveMissionApproval(offOriginId,offOriginApprovedAt);
  const beforeOffOriginClicks=publishClicks;
  const offOrigin=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId:offOriginId,approvedAt:offOriginApprovedAt});
  assert.strictEqual(offOrigin.ok,false);
  assert.strictEqual(offOrigin.code,'YOUTUBE_PUBLISH_UNCERTAIN');
  assert.strictEqual(offOrigin.uncertain,true);
  assert.strictEqual(publishClicks,beforeOffOriginClicks+1);
  assert.strictEqual(yt.readReceipt(tmp,offOriginId).state,'publish_started');
  publishSuccessUrl='https://studio.youtube.com/video/test/edit';

  // A tampered receipt must never let approval from one mission authorize another mission's draft.
  const mismatchId='M-MISMATCH-123456';
  publishSucceeded=false;
  allowPublishSuccess=true;
  const mismatchDraft=await yt.prepareDraft(fakeOperator,tmp,{
    file:'creator-video/demo.mp4',
    title:'Mismatch Test',
    description:'Açıklama',
    missionId:mismatchId
  });
  assert.strictEqual(mismatchDraft.ok,true);
  const mismatchReceiptFile=yt.missionReceiptFile(tmp,mismatchId);
  const mismatchReceipt=JSON.parse(fs.readFileSync(mismatchReceiptFile,'utf8'));
  mismatchReceipt.missionId='M-OTHER-123456';
  fs.writeFileSync(mismatchReceiptFile,JSON.stringify(mismatchReceipt,null,2),'utf8');
  const beforeMismatchClicks=publishClicks;
  await assert.rejects(
    ()=>yt.publishPreparedDraft(fakeOperator,tmp,{missionId:mismatchId,approvedAt:new Date().toISOString()}),
    /mission receipt mismatch/
  );
  assert.strictEqual(publishClicks,beforeMismatchClicks,'mission-mismatched approval must fail before Publish click');

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
  const uncertainApprovedAt=new Date().toISOString();
  saveMissionApproval(uncertainId,uncertainApprovedAt);
  const beforeUncertainClicks=publishClicks;
  const uncertain=await yt.publishPreparedDraft(fakeOperator,tmp,{missionId:uncertainId,approvedAt:uncertainApprovedAt});
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
  assert.ok(source.includes("YOUTUBE_STALE_SUCCESS_MARKER"),'stale success marker guard missing');
  assert.ok(source.includes('publishEvidenceBaselineUrl'),'pre-click publish evidence baseline missing');
  assert.ok(source.includes('publishEvidenceUrl'),'post-click publish evidence URL missing');
  assert.ok(source.includes("return /studio\\.youtube\\.com/.test(url)&&"),'publish success must be bound to YouTube Studio origin');
  assert.ok(source.includes('explicit approval proof required for YouTube publish'),'module-level approval proof missing');
  assert.ok(source.includes('valid explicit approval timestamp required for YouTube publish'),'approval timestamp validation missing');
  assert.ok(source.includes('YouTube approval mission receipt mismatch'),'approval mission binding missing');
  assert.ok(source.includes('YouTube approval predates draft receipt'),'approval lifecycle lower bound missing');
  assert.ok(source.includes('YouTube approval timestamp is in the future'),'approval lifecycle upper bound missing');
  assert.ok(source.includes("path.resolve(workspace),'.jarvis-missions'"),'mission-disk approval provenance missing');
  assert.ok(source.includes("publishStep.meta.requiresApproval===true"),'YouTube publish approval requirement binding missing');
  assert.ok(source.includes('diskApproved.value!==approved.value'),'caller proof must equal active mission approvedAt');
  assert.ok(source.includes("draftStep.status!=='completed'"),'completed YouTube draft lifecycle binding missing');
  assert.ok(source.includes("publishStep.status!=='running'"),'active YouTube publish step binding missing');
  assert.ok(source.includes("input[type=file]"),'file input upload path missing');
  assert.ok(worker.includes("name:'youtube_prepare_draft_upload'"),'native YouTube draft tool missing');
  assert.ok(worker.includes("name:'youtube_studio_status'"),'native YouTube status tool missing');
  assert.ok(worker.includes("'youtube_publish_approval_v1'"),'YouTube publish approval capability missing');
  assert.ok(!worker.includes("function:{\n        name:'youtube_publish',"),'YouTube public publish must not be a direct autonomous native tool');
  assert.ok(worker.includes('"Devam et" tek başına YouTube PUBLIC onayı değildir'),'generic resume must not count as YouTube publish approval');
  assert.ok(server.includes("return'youtube_upload_prepare_v1'"),'server YouTube draft routing missing');

  console.log('YOUTUBE STUDIO APPROVAL SELFTEST PASS · PUBLIC success requires fresh YouTube Studio evidence after exact mission-bound approval');
})().catch(e=>{console.error(e);process.exit(1)});
