'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const vm=require('vm');
const engine=require('./jarvis-mission-engine');
const lifecycle=require('./jarvis-approval-lifecycle');

async function run(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-approval-lifecycle-'));
  const source=fs.readFileSync(path.join(__dirname,'worker.js'),'utf8');
  function extract(start,end){
    const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
    assert.ok(a>=0&&b>a,'Worker function boundary missing: '+start);
    return source.slice(a,b);
  }
  let effects=0,navigations=0,beforeField=null,youtubeResult={ok:true,title:'fixture'};
  const browser={
    navigate:async()=>{navigations++;return{ok:true}},
    setField:async()=>{if(beforeField)beforeField();return{ok:true}},
    clickByText:async()=>{effects++;return{ok:true,text:'Submit'}},
    pageSnapshot:async()=>({ok:true,url:'https://example.test/form',title:'fixture'})
  };
  const context=vm.createContext({
    require,WORKSPACE:root,fs,path,console,
    getMissionEngine:()=>engine,getBrowserOperator:()=>browser,
    getCommerceEngine:()=>({publishProduct:async()=>{effects++;return{product:{id:'fixture'},publication:{id:'fixture'}}}}),
    getYoutubeStudio:()=>({publishPreparedDraft:async()=>{effects++;return youtubeResult},readReceipt:()=>null}),
    cascadeCreatorBatchControl:()=>null
  });
  vm.runInContext([
    extract('function browserMissionHardDeniedClick(', 'function createBrowserFormMission('),
    extract('function missionControlCandidates(', 'function missionSummaryText('),
    extract('async function verifyUncertainCampaignStep(', 'let durableMissionServiceBusy=')
  ].join('\n'),context);
  const runMission=id=>context.runDurableMission(id);
  const surface=name=>name==='browser_click'?'browser':name==='shopify_publish'?'shopify':'youtube';
  function create(name='browser_click'){
    return engine.createMission(root,{type:name==='shopify_publish'?'shopify_product':'test',
      input:{url:'https://example.test/form',fields:[{label:'Name',value:'Test'}],finalClick:'Submit'},
      steps:[{name,meta:{requiresApproval:true}}]});
  }
  async function pending(name='browser_click'){
    const m=create(name);
    const out=await runMission(m.id);
    assert.strictEqual(out.status,'waiting_dependency');
    assert.strictEqual(engine.currentStep(out).error.dependency,'approval');
    return out;
  }
  function approve(m){
    return engine.approveStep(root,m.id,{surface:surface(engine.currentStep(m).name),targetReason:'explicit_mission_id'});
  }
  function mutate(id,fn){const m=engine.loadMission(root,id);fn(m,engine.currentStep(m));engine.saveMission(root,m);return m}
  function hasGrant(id){return !!engine.currentStep(engine.loadMission(root,id)).meta.approvedAt}
  try{
    // Happy path uses the actual Worker resolver + persisted engine, fake effects.
    let m=await pending();
    context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:context.captureApprovalTurn()});
    let count=effects;
    let out=await runMission(m.id);
    assert.strictEqual(out.status,'completed');assert.strictEqual(effects,count+1);
    await runMission(m.id);assert.strictEqual(effects,count+1,'completed effect must not replay');

    // A model cannot reuse one user turn for two approvals, a fresh request,
    // or an on-the-fly refreshed review after a payload change.
    m=await pending();
    let turn=context.captureApprovalTurn();
    context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:turn});
    assert.throws(()=>context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:turn}),/yeni/);
    turn=context.captureApprovalTurn();
    const createdDuringTurn=await pending();
    assert.throws(()=>context.approveMissionGate({missionId:createdDuringTurn.id,userText:'onayla '+createdDuringTurn.id,approvalContext:turn}),/sonra/);
    m=await pending();turn=context.captureApprovalTurn();
    mutate(m.id,x=>{x.input.finalClick='Different'});
    assert.throws(()=>context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:turn}),e=>e.code==='APPROVAL_REVIEW_REQUIRED');
    assert.throws(()=>context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:turn}),/yeni/);
    assert.strictEqual(hasGrant(m.id),false);

    // A legacy request upgrades once and only a subsequent real turn may grant it.
    m=await pending();mutate(m.id,(_x,s)=>{delete s.meta.approvalRequestId;delete s.meta.approvalRequestSha256});
    turn=context.captureApprovalTurn();
    assert.throws(()=>context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:turn}),/sonra/);
    assert.strictEqual(hasGrant(m.id),false);
    context.approveMissionGate({missionId:m.id,userText:'onayla '+m.id,approvalContext:context.captureApprovalTurn()});
    assert.strictEqual(hasGrant(m.id),true);

    // An approval of a reviewed snapshot cannot authorize newly edited fields.
    m=await pending();mutate(m.id,x=>{x.input.fields[0].value='Changed'});
    assert.throws(()=>approve(m),e=>e.code==='APPROVAL_REVIEW_REQUIRED');
    assert.strictEqual(hasGrant(m.id),false);
    approve(m);out=await runMission(m.id);assert.strictEqual(out.status,'completed');

    // Legacy requests require a fresh review instead of silently inheriting trust.
    m=await pending();mutate(m.id,(_x,s)=>{delete s.meta.approvalRequestSha256});
    assert.throws(()=>approve(m),e=>e.code==='APPROVAL_REVIEW_REQUIRED');
    assert.strictEqual(hasGrant(m.id),false);

    const mutations=[
      x=>{x.input.url='https://other.example.test/form'},
      x=>{x.input.finalClick='Create account'},
      x=>{x.input.fields[0].value='Different'},
      x=>{x.artifacts.changed={product:{id:'different'}}},
      (_x,s)=>{s.meta.approvedAt=new Date(Date.now()-lifecycle.APPROVAL_TTL_MS-10).toISOString();s.meta.approvalRequestedAt=s.meta.approvedAt},
      (_x,s)=>{delete s.meta.approvalPayloadSha256},
      (_x,s)=>{s.meta.approvedAt='not-a-date'},
      (_x,s)=>{s.meta.approvedAt=new Date(Date.now()+60000).toISOString()},
      (_x,s)=>{s.meta.requiresApproval=false},
      (_x,s)=>{s.meta.approvalSurface='youtube'}
    ];
    for(const change of mutations){
      m=await pending();approve(m);mutate(m.id,change);count=effects;
      const visits=navigations;out=await runMission(m.id);
      assert.strictEqual(out.status,'waiting_dependency');
      assert.strictEqual(engine.currentStep(out).error.dependency,'approval');
      assert.strictEqual(effects,count);assert.strictEqual(navigations,visits,'invalid proof must stop before browser navigation');
      assert.strictEqual(hasGrant(m.id),false);
    }

    // Grant copies cannot cross mission IDs or step identities.
    m=await pending();approve(m);
    const copy=await pending();
    const stolen=engine.currentStep(engine.loadMission(root,m.id)).meta;
    mutate(copy.id,(x,s)=>{s.meta={...stolen};x.status='queued';s.status='pending';s.error=null});
    count=effects;await runMission(copy.id);assert.strictEqual(effects,count);

    // Request age and invalid clocks cannot issue a grant.
    m=await pending();mutate(m.id,(_x,s)=>{s.meta.approvalRequestedAt=new Date(Date.now()-lifecycle.APPROVAL_TTL_MS).toISOString()});
    assert.throws(()=>approve(m),e=>e.code==='APPROVAL_REVIEW_REQUIRED');
    assert.strictEqual(hasGrant(m.id),false);

    // The v156 defect: delete fields in a caller copy; failStep reloads disk.
    for(const name of ['youtube_publish','shopify_publish','browser_click']){
      m=await pending(name);approve(m);m=engine.startStep(root,m.id);
      delete engine.currentStep(m).meta.approvedAt;
      out=engine.failStep(root,m.id,{code:'YOUTUBE_AUTH_REQUIRED',retryable:true,dependency:'youtube_auth'});
      assert.strictEqual(hasGrant(m.id),false,'disk grant survived failure for '+name);
      assert.strictEqual(engine.currentStep(out).meta.approvalRevokedReason,'youtube_auth_required');
      engine.retryBlockedStep(root,m.id);count=effects;
      out=await runMission(m.id);assert.strictEqual(effects,count);
      assert.strictEqual(engine.currentStep(out).error.dependency,'approval');
    }

    // Actual Worker auth-failure branch must durably revoke the proof.
    m=await pending('youtube_publish');approve(m);youtubeResult={ok:false,code:'YOUTUBE_AUTH_REQUIRED',message:'test auth'};
    await runMission(m.id);assert.strictEqual(hasGrant(m.id),false);
    count=effects;youtubeResult={ok:true,title:'fixture'};
    await runMission(m.id);assert.strictEqual(effects,count,'auth recovery must not reuse approval');

    // Interrupted work stays uncertain; even verified non-execution needs consent.
    m=await pending();approve(m);engine.startStep(root,m.id);
    engine.recoverInterruptedMissions(root);assert.strictEqual(hasGrant(m.id),false);
    count=effects;out=await runMission(m.id);
    assert.strictEqual(out.status,'needs_verification');assert.strictEqual(effects,count);
    engine.resolveUncertainStep(root,m.id,{completed:false});
    out=await runMission(m.id);assert.strictEqual(engine.currentStep(out).error.dependency,'approval');
    assert.strictEqual(effects,count);

    // Pausing or cancelling a queued grant must revoke it on disk.
    for(const action of ['pause','cancel']){
      m=await pending();approve(m);context.requestMissionControl({missionId:m.id,action});
      assert.strictEqual(hasGrant(m.id),false);
      if(action==='pause')context.requestMissionControl({missionId:m.id,action:'resume'});
      count=effects;await runMission(m.id);assert.strictEqual(effects,count);
    }

    // Re-check the disk grant after awaited form filling and before final click.
    for(const change of [x=>{x.input.finalClick='Changed'},(_x,s)=>{s.meta.approvedAt=new Date(Date.now()-lifecycle.APPROVAL_TTL_MS-10).toISOString()},x=>{x.control={requested:'cancel'}}]){
      m=await pending();approve(m);count=effects;
      beforeField=()=>mutate(m.id,change);
      await runMission(m.id);beforeField=null;
      assert.strictEqual(effects,count,'changed/revoked/expired grant during an await must stop final click');
    }

    // Hash stability and privacy: scheduling updates are excluded; values stay out
    // of the proof metadata, which contains only hashes and bounded enums/times.
    m=await pending();const hash=lifecycle.payloadHash(m);
    m.input={finalClick:m.input.finalClick,fields:m.input.fields,url:m.input.url};
    m.history.push({at:'later',event:'test'});m.updatedAt='later';
    assert.strictEqual(lifecycle.payloadHash(m),hash);
    approve(m);const meta=engine.currentStep(engine.loadMission(root,m.id)).meta;
    assert.ok(!JSON.stringify(meta).includes('https://example.test'));

    // Exercise the real commerce adapter with an in-memory GraphQL transport.
    // Revocation during the publication query blocks ACTIVE; after ACTIVE it
    // blocks PUBLIC and marks the partial operation uncertain.
    let commerceMode='',activeCalls=0,publicCalls=0,commerceMission=null;
    const gid='gid://shopify/Product/123456';
    const commerceContext=vm.createContext({require,module:{exports:{}},Buffer,process,console,
      fakeCredentials:()=>({ready:true,shop:'example.myshopify.com'}),
      fakeGraphQL:async(_creds,query)=>{
        if(query.includes('query JarvisPublications')){
          if(commerceMode==='before_active')mutate(commerceMission.id,x=>{x.control={requested:'cancel'}});
          return{publications:{nodes:[{id:'publication-fixture',name:'Online Store'}]}};
        }
        if(query.includes('mutation JarvisActivateProduct')){
          activeCalls++;
          if(commerceMode==='after_active')mutate(commerceMission.id,x=>{x.control={requested:'cancel'}});
          return{productUpdate:{product:{id:gid,title:'fixture',status:'ACTIVE'},userErrors:[]}};
        }
        publicCalls++;return{publishablePublish:{publishable:{publishedOnPublication:true},userErrors:[]}};
      }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'jarvis-commerce-engine.js'),'utf8')+
      '\nresolveCredentials=fakeCredentials;graphQLRequest=fakeGraphQL;',commerceContext);
    for(const mode of ['before_active','after_active','success']){
      commerceMode=mode;activeCalls=0;publicCalls=0;
      commerceMission=engine.createMission(root,{type:'shopify_product',steps:['shopify_draft',{name:'shopify_publish',meta:{requiresApproval:true}}]});
      engine.startStep(root,commerceMission.id);
      engine.completeStep(root,commerceMission.id,{artifact:{product:{id:gid,title:'fixture',status:'DRAFT'}}});
      commerceMission=await runMission(commerceMission.id);approve(commerceMission);engine.startStep(root,commerceMission.id);
      if(mode==='success'){
        const result=await commerceContext.module.exports.publishProduct(root,gid);
        assert.strictEqual(result.published,undefined);assert.strictEqual(result.publicationVerified,true);
        assert.strictEqual(activeCalls,1);assert.strictEqual(publicCalls,1);
      }else{
        await assert.rejects(()=>commerceContext.module.exports.publishProduct(root,gid),e=>
          e.code==='SHOPIFY_EXPLICIT_APPROVAL_REQUIRED'&&(mode!=='after_active'||e.uncertain===true));
        assert.strictEqual(activeCalls,mode==='before_active'?0:1);assert.strictEqual(publicCalls,0);
      }
      // The fake adapter test does not run the Worker completion transition.
      engine.failStep(root,commerceMission.id,{code:'TEST_FINISHED'});
    }

    // Packaging gates: both approval modules must reach fresh and updated PCs.
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'jarvis-update-manifest.json'),'utf8'));
    const installer=fs.readFileSync(path.join(__dirname,'JARVIS-ZERO-COST-ONECLICK.ps1'),'utf8');
    for(const name of ['jarvis-approval-intent.js','jarvis-approval-lifecycle.js']){
      assert.ok(manifest.files.some(f=>f.path===name));assert.ok(installer.includes('"'+name+'"'));
    }
    for(const entry of manifest.files){
      const data=fs.readFileSync(path.join(__dirname,entry.path),'utf8');
      assert.ok(data.includes(entry.signature),'updater would reject '+entry.path);
      assert.ok(Buffer.byteLength(data)>=entry.min_bytes,'updater size check would reject '+entry.path);
    }
    console.log('APPROVAL LIFECYCLE SELFTEST PASS · real persistence + Worker execution, fake effects only; no device E2E');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
}
run().catch(error=>{console.error(error);process.exitCode=1});
