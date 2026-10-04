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
  if(/(?:^|[\s,.;:!?])(?:yayınlama|yayinlama|onaylama)(?:yın|yin|yinız|yiniz|yalım|yalim|nı|ni|nız|niz)?(?=$|[\s,.;:!?])/i.test(intent))return true;
  if(/(?:^|[\s,.;:!?])onay\s+verme(?:yin|yiniz|yinız)?(?=$|[\s,.;:!?])/i.test(intent))return true;
  if(/(?:^|[\s,.;:!?])(?:publish|approve)\s+etme(?:yin|yiniz|yinız)?(?=$|[\s,.;:!?])/i.test(intent))return true;

  // English explicit negation. Any explicit irreversible negation in the same
  // turn wins over a positive phrase later in the sentence (fail closed).
  if(/(?:^|[\s,.;:!?])(?:do\s+not|don't|dont|never|not)\s+(?:publish|approve)(?=$|[\s,.;:!?])/i.test(intent))return true;

  // Turkish “sakın/sakin + action” is a prohibition even when the verb itself
  // is morphologically positive (e.g. “sakın yayınla”).
  if((hasToken(intent,'sakın')||hasToken(intent,'sakin'))&&hasPositiveApproval(intent))return true;
  return false;
}

function classifyApprovalIntent(text){
  const intent=normalizeApprovalIntent(text);
  if(!intent)return{approved:false,reason:'missing_explicit_action',intent};
  if(hasNegatedApproval(intent))return{approved:false,reason:'negated_explicit_action',intent};
  const approved=hasPositiveApproval(intent);
  return{approved,reason:approved?'explicit_action':'missing_explicit_action',intent};
}

module.exports={normalizeApprovalIntent,classifyApprovalIntent};
