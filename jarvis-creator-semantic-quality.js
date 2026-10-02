const SEMANTIC_QUALITY_VERSION='1.4';

const STOP=new Set([
  'bir','bu','su','şu','ve','veya','ile','icin','için','olan','olarak','daha','cok','çok','gibi',
  'sey','şey','video','klip','goruntu','görüntü','sahne','the','and','for','with','from','this','that'
]);

function clipNarrativeSegment(text,start,length){
  const raw=String(text||'');
  const from=Math.max(0,Math.min(raw.length,Math.floor(Number(start)||0)));
  const size=Math.max(80,Math.floor(Number(length)||0));
  let segment=raw.slice(from,Math.min(raw.length,from+size));
  if(from>0){
    const firstSpace=segment.indexOf(' ');
    if(firstSpace>=0&&firstSpace<80)segment=segment.slice(firstSpace+1);
  }
  if(from+size<raw.length){
    const lastSpace=segment.lastIndexOf(' ');
    if(lastSpace>segment.length-100)segment=segment.slice(0,lastSpace);
  }
  return segment.replace(/\s+/g,' ').trim();
}
function buildNarrativeDigest(value,{maxChars=3200}={}){
  const raw=String(value||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
  const cap=Math.max(900,Math.min(6000,Math.floor(Number(maxChars)||3200)));
  if(!raw)return{text:'',sections:[],originalChars:0,outputChars:0,truncated:false};
  if(raw.length<=cap){
    const text='[TÜM ANLATIM]\n'+raw;
    return{
      text:text.slice(0,cap),
      sections:[{label:'TÜM ANLATIM',ratio:0,text:raw}],
      originalChars:raw.length,
      outputChars:Math.min(cap,text.length),
      truncated:false
    };
  }
  const labels=['BAŞLANGIÇ','ORTA','KAPANIŞ'];
  const prefixBudget=labels.reduce((sum,label)=>sum+label.length+4,0);
  const segmentBudget=Math.max(220,Math.floor((cap-prefixBudget)/3));
  const starts=[
    0,
    Math.max(0,Math.floor((raw.length-segmentBudget)/2)),
    Math.max(0,raw.length-segmentBudget)
  ];
  const sections=starts.map((start,index)=>({
    label:labels[index],
    ratio:index===0?0:(index===1?0.5:1),
    text:clipNarrativeSegment(raw,start,segmentBudget)
  }));
  let text=sections.map(x=>'['+x.label+']\n'+x.text).join('\n\n');
  if(text.length>cap)text=text.slice(0,cap).replace(/\s+\S*$/,'').trim();
  return{
    text,
    sections,
    originalChars:raw.length,
    outputChars:text.length,
    truncated:true
  };
}

function semanticTokens(value){
  const text=Array.isArray(value)?value.join(' '):String(value||'');
  return new Set(text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9çğıöşü\s-]/gi,' ')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(x=>x.length>=3&&!STOP.has(x))
    .slice(0,800));
}
function rowTokens(row){
  const tags=Array.isArray(row&&row.tags)?row.tags:[];
  return semanticTokens(tags.join(' ')+' '+String(row&&row.summary||''));
}
function semanticSimilarity(a,b){
  const aa=a instanceof Set?a:rowTokens(a);
  const bb=b instanceof Set?b:rowTokens(b);
  if(!aa.size&&!bb.size)return 1;
  if(!aa.size||!bb.size)return 0;
  let intersection=0;
  for(const token of aa)if(bb.has(token))intersection++;
  const union=aa.size+bb.size-intersection;
  const jaccard=union?intersection/union:0;
  const smaller=Math.min(aa.size,bb.size);
  const overlap=intersection/smaller;
  // Sparse overlap is noisy: one shared generic token can otherwise make a
  // one-token description look identical to a much richer, unrelated row.
  // Trust overlap only with at least two shared semantic tokens, or when both
  // sides are genuinely tiny and Jaccard itself already carries the match.
  const overlapTrusted=intersection>=2&&smaller>=2?overlap:0;
  return Math.max(jaccard,overlapTrusted);
}
function diversifySemanticRows(rows,{
  maxItems=12,
  minScore=1,
  maxSimilarity=0.72,
  allowPaths=[]
}={}){
  const limit=Math.max(1,Math.min(20,Math.floor(Number(maxItems)||12)));
  const floor=Number.isFinite(Number(minScore))?Number(minScore):1;
  const threshold=Math.max(0.35,Math.min(0.95,Number(maxSimilarity)||0.72));
  const allowed=new Set((Array.isArray(allowPaths)?allowPaths:[]).map(x=>String(x||'')));
  const input=Array.isArray(rows)?rows.filter(Boolean):[];
  const eligible=input.filter(row=>Number(row&&row.score||0)>=floor||allowed.has(String(row&&row.path||'')));
  const relevanceFloorBlockedAll=input.length>0&&eligible.length===0;
  const selected=[],selectedTokens=[],rejectedSimilar=[],rejectedLowRelevance=[];
  for(const row of input){
    if(!eligible.includes(row)){
      rejectedLowRelevance.push(String(row&&row.path||''));
      continue;
    }
    const tokens=rowTokens(row);
    let closest=0,closestPath=null;
    for(let i=0;i<selected.length;i++){
      const similarity=semanticSimilarity(tokens,selectedTokens[i]);
      if(similarity>closest){
        closest=similarity;
        closestPath=String(selected[i]&&selected[i].path||'');
      }
    }
    if(selected.length&&closest>=threshold){
      rejectedSimilar.push({
        path:String(row&&row.path||''),
        similarTo:closestPath,
        similarity:Number(closest.toFixed(3))
      });
      continue;
    }
    selected.push(row);
    selectedTokens.push(tokens);
    if(selected.length>=limit)break;
  }
  return{
    rows:selected,
    evidence:{
      candidateCount:input.length,
      eligibleCount:eligible.length,
      selectedCount:selected.length,
      rejectedSimilarCount:rejectedSimilar.length,
      rejectedLowRelevanceCount:rejectedLowRelevance.length,
      maxSimilarity:threshold,
      minScore:floor,
      modelAllowlistCount:allowed.size,
      fallbackUsed:false,
      relevanceFloorBlockedAll,
      rejectedSimilar:rejectedSimilar.slice(0,20),
      rejectedLowRelevance:rejectedLowRelevance.slice(0,20)
    }
  };
}


function orderRowsByNarrativeSections(rows,sections){
  const input=Array.isArray(rows)?rows.filter(Boolean):[];
  const parts=Array.isArray(sections)?sections.filter(x=>x&&String(x.text||'').trim()):[];
  if(input.length<2||parts.length<2)return{rows:input.slice(),evidence:{applied:false,sectionCount:parts.length,selectedCount:input.length,assignments:[]}};
  const sectionTokens=parts.map(x=>semanticTokens(x.text));
  const capacity=Math.max(1,Math.ceil(input.length/parts.length));
  const used=new Array(parts.length).fill(0);
  const assignments=input.map((row,index)=>{
    const tokens=rowTokens(row);
    const scores=sectionTokens.map(tokens2=>semanticSimilarity(tokens,tokens2));
    let choices=scores.map((score,sectionIndex)=>({score,sectionIndex}))
      .sort((a,b)=>b.score-a.score||a.sectionIndex-b.sectionIndex);
    let chosen=choices.find(x=>used[x.sectionIndex]<capacity);
    if(!chosen){
      const fallback=Math.min(parts.length-1,Math.floor((index*parts.length)/input.length));
      chosen={score:scores[fallback]||0,sectionIndex:fallback};
    }
    if(Math.max(...scores)<=0){
      const proportional=Math.min(parts.length-1,Math.floor((index*parts.length)/input.length));
      if(used[proportional]<capacity)chosen={score:0,sectionIndex:proportional};
    }
    used[chosen.sectionIndex]++;
    return{row,index,sectionIndex:chosen.sectionIndex,sectionLabel:String(parts[chosen.sectionIndex].label||chosen.sectionIndex),similarity:Number((chosen.score||0).toFixed(3))};
  });
  assignments.sort((a,b)=>a.sectionIndex-b.sectionIndex||b.similarity-a.similarity||a.index-b.index);
  return{
    rows:assignments.map(x=>x.row),
    evidence:{
      applied:true,
      sectionCount:parts.length,
      selectedCount:input.length,
      sectionLoads:used,
      assignments:assignments.map(x=>({path:String(x.row&&x.row.path||''),section:x.sectionLabel,similarity:x.similarity}))
    }
  };
}

module.exports={
  SEMANTIC_QUALITY_VERSION,
  semanticTokens,
  buildNarrativeDigest,
  semanticSimilarity,
  diversifySemanticRows,
  orderRowsByNarrativeSections
};
