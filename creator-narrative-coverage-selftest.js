const fs=require('fs');
const assert=require('assert');
const creator=require('./jarvis-creator-engine');

const worker=fs.readFileSync('./worker.js','utf8');
function block(start,end){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  assert.ok(a>=0&&b>a,'worker helper block missing: '+start);
  return worker.slice(a,b);
}
const fresh=Function(block('function creatorPreferFreshAssetPaths(', 'function creatorRecentWebAssetSet(')+';return creatorPreferFreshAssetPaths;')();
const unseen=Function(block('function creatorPreferUnseenAssetPaths(', 'function creatorAutoWebQuery(')+';return creatorPreferUnseenAssetPaths;')();
const autoSource=block('function creatorAutoWebQuery(', 'function creatorYoutubeDescription(');
const chapters=[
  'launch rocket orbit astronauts ignition countdown capsule ascent booster mission',
  'factory robots assembly sensors welding conveyor production machinery automation workshop',
  'forest wildlife trees habitat animals conservation canopy biodiversity woodland ecosystem',
  'ocean coral reef marine waves underwater diving fish coastline seafloor'
];
const script=chapters.map(x=>[x,x,x].join(' ')+'.').join(' ');

function fixture({recent=[],fail=[],duplicate=false,empty=false,oversupply=false}={}){
  const calls=[],events=[],hookCalls=[];
  const web={
    async searchAndIngest(argsWorkspace,args){
      const index=calls.length;
      calls.push(args);
      assert.strictEqual(argsWorkspace,'test-workspace');
      if(fail.includes(index))throw new Error('provider unavailable');
      return{assets:empty?[]:Array.from({length:oversupply?20:args.count},(_,n)=>
        duplicate?'creator-assets/shared.mp4':'creator-assets/g'+index+'-'+n+'.mp4')};
    },
    sourceRecordsForAssets(){return[{mediaKind:'video'}]}
  };
  const engine={prepare:()=>({ok:true,ffprobe:'ffprobe',ffmpeg:'ffmpeg'}),inspectAsset:()=>({ok:true})};
  const auto=Function(
    'getCreatorEngine','getCreatorWebMedia','WORKSPACE','creatorRecentWebAssetSet',
    'creatorPreferFreshAssetPaths','creatorPreferRealMotionHookAssets',
    'creatorPreferUnseenAssetPaths','creatorPreferVerifiedMotionHookAssets','remember',
    autoSource+';return creatorAutoWebAssets;'
  )(
    ()=>engine,()=>web,'test-workspace',()=>new Set(recent),fresh,
    paths=>{hookCalls.push('kind');return paths},unseen,
    paths=>{hookCalls.push('motion');return{paths,verified:true,probeCount:1}},
    event=>events.push(event)
  );
  return{auto,calls,events,hookCalls};
}
function group(path){return Number(/\/g(\d+)-/.exec(path)[1])}
function assertProgressive(paths){
  assert.ok(paths.every((p,i)=>!i||group(p)>=group(paths[i-1])),'web selection must never move backwards between narrative groups');
}

(async()=>{
  const f=fixture({recent:Array.from({length:3},(_,n)=>'creator-assets/g0-'+n+'.mp4')});
  const paths=await f.auto({title:'Journey of discovery',script,orientation:'landscape',count:12,maxQueries:4});
  assert.strictEqual(f.calls.length,4,'full long-form pool must still search the closing narrative query');
  assert.strictEqual(paths.length,12);
  assert.ok(f.calls.every(x=>x.count>=1&&x.count<=4),'provider request cap must remain bounded');
  assert.ok(f.calls.reduce((n,x)=>n+x.count,0)<=12,'candidate budget must stay at 12');
  assert.ok(/launch|rocket|astronauts/.test(f.calls[0].query),'opening search must cover the opening chapter');
  assert.ok(/ocean|coral|reef/.test(f.calls[3].query),'closing search must cover the closing chapter');
  assert.ok(f.calls.every(x=>x.query.length<=140&&x.query.split(/\s+/).length<=8&&!x.query.includes(script)),'only short local queries may leave the worker');
  assertProgressive(paths);
  assert.deepStrictEqual([...new Set(paths.map(group))],[0,1,2,3]);
  assert.strictEqual(group(paths[0]),0,'reused opening clips must not move behind fresh closing clips');
  assert.strictEqual(group(paths[paths.length-1]),3);
  assert.deepStrictEqual(f.hookCalls,[],'portrait hook promotion must not reorder long-form narration');
  const evidence=f.events[0];
  assert.strictEqual(evidence.narrativeAssetOrder,'query-progressive');
  assert.deepStrictEqual(evidence.assetQueryOrder.map(x=>x.path),paths);
  assert.deepStrictEqual(evidence.assetQueryOrder.map(x=>x.queryIndex),paths.map(group));
  assert.strictEqual(evidence.coveredQueryCount,4);
  const board=creator.buildLongformStoryboard(paths,600);
  assert.strictEqual(board.length,24);
  assertProgressive(board.map(x=>x.file));
  assert.strictEqual(group(board[0].file),0);
  assert.strictEqual(group(board[board.length-1].file),3);
  assert.ok(board.every(x=>x.duration>20&&x.duration<30.5));
  assert.notStrictEqual(board[0].sourceOffset,board[1].sourceOffset);

  const daily=fixture({recent:['creator-assets/g0-0.mp4']});
  const dailyPaths=await daily.auto({title:'Journey',script,orientation:'landscape',count:4,maxQueries:3});
  assert.strictEqual(daily.calls.length,3);
  assert.strictEqual(dailyPaths.length,4);
  assertProgressive(dailyPaths);
  assert.deepStrictEqual([...new Set(dailyPaths.map(group))],[0,1,2],'small budgets must retain every available chapter');
  assert.strictEqual(dailyPaths[0],'creator-assets/g0-1.mp4','freshness should still rank clips within their own chapter');
  assert.ok(creator.buildLongformStoryboard(dailyPaths,600).every(x=>x.narrativeOrder==='cyclic'),'small pools must retain v77 cyclic fallback');

  const failed=fixture({fail:[0,2]});
  const fallback=await failed.auto({title:'Journey',script,orientation:'landscape',count:12,maxQueries:4});
  assert.strictEqual(failed.calls.length,4,'a failed provider query must not suppress later chapters');
  assertProgressive(fallback);
  assert.deepStrictEqual([...new Set(fallback.map(group))],[1,3]);
  assert.strictEqual(failed.events[0].coveredQueryCount,2,'coverage evidence must reflect missing chapters');

  const duplicates=fixture({duplicate:true});
  const deduped=await duplicates.auto({title:'Journey',script,orientation:'landscape',count:12,maxQueries:4});
  assert.deepStrictEqual(deduped,['creator-assets/shared.mp4']);
  assert.strictEqual(duplicates.calls.length,4);
  assert.strictEqual(duplicates.events[0].coveredQueryCount,1,'duplicate clips must not fabricate multi-chapter coverage');
  const empty=fixture({empty:true});
  assert.deepStrictEqual(await empty.auto({title:'Journey',script,orientation:'landscape',count:12,maxQueries:4}),[]);
  const explicit=fixture();
  await explicit.auto({title:'Journey',script,query:'approved ocean footage',orientation:'landscape',count:4,maxQueries:4});
  assert.deepStrictEqual(explicit.calls.map(x=>x.query),['approved ocean footage'],'explicit query must still override automatic narration queries');
  const over=fixture({oversupply:true});
  const bounded=await over.auto({title:'Journey',script,orientation:'landscape',count:12,maxQueries:4});
  assert.strictEqual(over.calls.length,4,'excess provider results must not consume later query slots');
  assert.strictEqual(bounded.length,12);
  assertProgressive(bounded);

  const portrait=fixture({recent:['creator-assets/g0-0.mp4']});
  const short=await portrait.auto({title:'Journey',script,orientation:'portrait',count:5,maxQueries:3});
  assert.strictEqual(short.length,5);
  assert.deepStrictEqual(portrait.hookCalls,['kind','motion'],'Shorts must retain media-kind and verified motion ranking');
  assert.strictEqual(portrait.events[0].hookMotionVerified,true);
  console.log('CREATOR NARRATIVE COVERAGE V87 SELFTEST PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
