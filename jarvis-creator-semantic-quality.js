const SEMANTIC_QUALITY_VERSION='1.0';

const STOP=new Set([
  'bir','bu','su','şu','ve','veya','ile','icin','için','olan','olarak','daha','cok','çok','gibi',
  'sey','şey','video','klip','goruntu','görüntü','sahne','the','and','for','with','from','this','that'
]);

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
  return union?intersection/union:0;
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
  let eligible=input.filter(row=>Number(row&&row.score||0)>=floor||allowed.has(String(row&&row.path||'')));
  let fallbackUsed=false;
  if(!eligible.length){
    eligible=input.slice();
    fallbackUsed=true;
  }
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
      fallbackUsed,
      rejectedSimilar:rejectedSimilar.slice(0,20),
      rejectedLowRelevance:rejectedLowRelevance.slice(0,20)
    }
  };
}

module.exports={
  SEMANTIC_QUALITY_VERSION,
  semanticTokens,
  semanticSimilarity,
  diversifySemanticRows
};
