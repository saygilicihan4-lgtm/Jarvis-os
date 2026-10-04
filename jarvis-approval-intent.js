'use strict';

function normalizeApprovalIntent(text){
  return String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[’‘`]/g,"'")
    .replace(/\s+/g,' ')
    .trim();
}

function hasToken(text,token){
  const escaped=String(token).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:^|[\\s,.;:!?])'+escaped+'(?=$|[\\s,.;:!?])','i').test(text);
}

function hasPositiveApproval(intent){
  return /(?:^|[\s,.;:!?])(?:onayla|onay\s+ver|yayınla|yayinla|publish|approve)(?=$|[\s,.;:!?])/i.test(intent)
    || /(?:mağazada|magazada)\s+(?:yayınla|yayinla)(?=$|[\s,.;:!?])/i.test(intent);
}

function hasNegatedApproval(intent){
  // Turkish negative imperative / request forms. Prefix matching intentionally
  // catches suffix variants such as yayınlamayın / yayınlamayalım.
  if(/(?:^|[\s,.;:!?])(?:yayınlama|yayinlama|onaylama)(?:yın|yin|yınız|yiniz|yalım|yalim|nı|ni|nız|niz)?(?=$|[\s,.;:!?])/i.test(intent))return true;
  if(/(?:^|[\s,.;:!?])onay\s+verme(?:yin|yınız|yiniz)?(?=$|[\s,.;:!?])/i.test(intent))return true;
  if(/(?:^|[\s,.;:!?])(?:publish|approve)\s+etme(?:yin|yınız|yiniz)?(?=$|[\s,.;:!?])/i.test(intent))return true;

  // English explicit negation. Keep the scan inside the same punctuation-bounded
  // clause so forms such as "don't ever publish" and "no publish" fail closed.
  if(/(?:^|[\s,.;:!?])(?:do\s+not|don't|dont|never|not|no)(?:\s+[^,.;:!?\s]+){0,3}\s+(?:publish|approve)(?=$|[\s,.;:!?])/i.test(intent))return true;

  // Turkish prohibition tokens win over a positive action in the same turn.
  // This intentionally treats contradictory wording such as “sakın yayınla”
  // as non-approval because irreversible actions must fail closed.
  if((hasToken(intent,'sakın')||hasToken(intent,'sakin')||hasToken(intent,'asla'))&&hasPositiveApproval(intent))return true;
  return false;
}

function detectApprovalSurfaces(intent){
  const text=String(intent||'');
  const strong=[];
  // Generic words such as "kanal" are intentionally not enough to select YouTube.
  // Irreversible routing needs either a provider-specific token or an unambiguous fallback.
  if(/(?:^|[^a-z0-9])(?:youtube|you\s*tube)(?=$|[^a-z0-9])/i.test(text))strong.push('youtube');
  if(/(?:^|[^a-z0-9çğıöşü])(?:shopify|mağaza|magaza)(?=$|[^a-z0-9çğıöşü])/i.test(text))strong.push('shopify');
  if(/(?:^|[^a-z0-9çğıöşü])(?:browser|tarayıcı|tarayici|form|buton|button|link)(?=$|[^a-z0-9çğıöşü])/i.test(text))strong.push('browser');
  if(strong.length)return[...new Set(strong)];

  const fallback=[];
  if(/(?:^|[^a-z0-9çğıöşü])(?:video(?:yu|sunu)?|shorts?|reels?)(?=$|[^a-z0-9çğıöşü])/i.test(text))fallback.push('youtube');
  if(/(?:^|[^a-z0-9çğıöşü])(?:ürün(?:ü|ünü)?|urun(?:u|unu)?|product)(?=$|[^a-z0-9çğıöşü])/i.test(text))fallback.push('shopify');
  if(/(?:^|[^a-z0-9çğıöşü])(?:tıkla|tikla|click)(?=$|[^a-z0-9çğıöşü])/i.test(text))fallback.push('browser');
  return[...new Set(fallback)];
}

function classifyApprovalIntent(text){
  const intent=normalizeApprovalIntent(text);
  if(!intent)return{approved:false,reason:'missing_explicit_action',intent,surfaces:[],surface:null};
  if(hasNegatedApproval(intent))return{approved:false,reason:'negated_explicit_action',intent,surfaces:[],surface:null};
  const approved=hasPositiveApproval(intent);
  const surfaces=approved?detectApprovalSurfaces(intent):[];
  return{
    approved,
    reason:approved?'explicit_action':'missing_explicit_action',
    intent,
    surfaces,
    surface:surfaces.length===1?surfaces[0]:null
  };
}

function approvalSurfaceForStepName(stepName){
  const name=String(stepName||'').trim();
  if(name==='youtube_publish')return'youtube';
  if(name==='shopify_publish')return'shopify';
  if(name==='browser_click')return'browser';
  return'';
}

function explicitMissionIds(intent){
  const matches=String(intent||'').match(/M-[A-Z0-9-]{12,80}/gi)||[];
  return[...new Set(matches.map(x=>x.toUpperCase()))];
}

function resolveApprovalTarget({approval,pending=[],requestedMissionId=''}={}){
  if(!approval||approval.approved!==true){
    return{ok:false,code:'APPROVAL_NOT_EXPLICIT',message:'Açık kullanıcı onayı bulunamadı.'};
  }
  const rows=(Array.isArray(pending)?pending:[])
    .map(row=>({id:String(row&&row.id||'').trim(),stepName:String(row&&row.stepName||'').trim()}))
    .filter(row=>row.id&&approvalSurfaceForStepName(row.stepName));
  if(!rows.length)return{ok:false,code:'NO_PENDING_APPROVAL',message:'Açık onay bekleyen görev yok.'};

  const requested=String(requestedMissionId||'').trim();
  const mentionedIds=explicitMissionIds(approval.intent);
  const surfaces=[...new Set(Array.isArray(approval.surfaces)?approval.surfaces.filter(Boolean):[])];
  if(surfaces.length>1){
    return{ok:false,code:'AMBIGUOUS_APPROVAL_SURFACE',message:'Onay metni birden fazla geri döndürülemez hedefi belirtiyor; tek bir hedef seçilmeli.'};
  }
  let target=null;
  let reason='';

  if(mentionedIds.length){
    if(mentionedIds.length!==1){
      return{ok:false,code:'AMBIGUOUS_MISSION_ID',message:'Onay metni birden fazla missionId içeriyor; tek bir görev açıkça seçilmeli.'};
    }
    target=rows.find(row=>row.id.toUpperCase()===mentionedIds[0])||null;
    if(!target){
      return{ok:false,code:'MISSION_ID_NOT_PENDING',message:'Onay metnindeki missionId şu anda onay bekleyen bir göreve ait değil.'};
    }
    if(surfaces.length===1&&approvalSurfaceForStepName(target.stepName)!==surfaces[0]){
      return{ok:false,code:'MISSION_SURFACE_MISMATCH',message:'Onay metnindeki missionId ile açıkça belirtilen hedef yüzeyi birbiriyle uyuşmuyor.'};
    }
    reason='explicit_mission_id';
  }else if(surfaces.length===1){
    const candidates=rows.filter(row=>approvalSurfaceForStepName(row.stepName)===surfaces[0]);
    if(!candidates.length){
      return{ok:false,code:'SURFACE_NOT_PENDING',message:'Kullanıcının onayladığı hedef yüzeyinde şu anda onay bekleyen görev yok.'};
    }
    if(candidates.length>1){
      return{ok:false,code:'AMBIGUOUS_SURFACE_MISSIONS',message:'Aynı hedef yüzeyinde birden fazla görev onay bekliyor; kullanıcı mesajında tam missionId belirtilmeli.'};
    }
    target=candidates[0];
    reason='explicit_surface';
  }else{
    if(rows.length>1){
      return{ok:false,code:'AMBIGUOUS_PENDING_APPROVAL',message:'Birden fazla görev onay bekliyor; kullanıcı onay metninde hedef yüzeyi veya tam missionId belirtilmeli.'};
    }
    target=rows[0];
    reason='single_pending';
  }

  if(requested&&requested.toUpperCase()!==target.id.toUpperCase()){
    return{ok:false,code:'REQUESTED_MISSION_MISMATCH',message:'Araç tarafından seçilen missionId kullanıcının açıkça onayladığı hedefle uyuşmuyor.'};
  }
  return{
    ok:true,
    missionId:target.id,
    surface:approvalSurfaceForStepName(target.stepName),
    reason
  };
}

module.exports={
  normalizeApprovalIntent,
  classifyApprovalIntent,
  detectApprovalSurfaces,
  approvalSurfaceForStepName,
  resolveApprovalTarget
};
