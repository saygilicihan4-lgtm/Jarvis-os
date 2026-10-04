'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const vm=require('vm');
const actions=require('./public/mission-actions');

// Minimal DOM boundary with HTML sinks forbidden. Rendering must use text nodes.
function dom(){
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.style={};this.attrs={};this.listeners={};this.textContent='';this.disabled=false;this.replacements=0}
    set innerHTML(_){throw new Error('HTML sink forbidden')}
    setAttribute(key,value){this.attrs[key]=value}
    addEventListener(type,fn){this.listeners[type]=fn}
    append(...children){for(const child of children){child.parentNode=this;this.children.push(child)}}
    replaceChildren(...children){this.replacements++;for(const child of this.children)child.parentNode=null;this.children=[];this.append(...children)}
    insertAdjacentElement(where,element){assert.equal(where,'afterend');const siblings=this.parentNode.children;assert.ok(siblings.includes(this));element.parentNode=this.parentNode;siblings.splice(siblings.indexOf(this)+1,0,element)}
    remove(){if(this.parentNode){const parent=this.parentNode;parent.children.splice(parent.children.indexOf(this),1);this.parentNode=null}}
    click(){if(!this.disabled)this.listeners.click()}
  }
  const body=new Element('body'),tasks=new Element('div');tasks.id='tasks';body.append(tasks);
  const walk=node=>[node,...node.children.flatMap(walk)];
  const document={createElement:tag=>new Element(tag),getElementById:id=>walk(body).find(node=>node.id===id)||null,
    querySelectorAll:()=>[]};
  const values=new Map(),calls=[];
  const root={document,localMissionCard:()=>'',location:{search:''},
    sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
    fetch(...args){calls.push(args);throw new Error('Receipt trail must not perform network actions')}};
  return{root,body,tasks,values,calls,walk,
    view(){const panel=document.getElementById('jarvisMissionReceiptTrail');return{panel,list:panel.children.find(x=>x.tagName==='ol'),button:panel.children.find(x=>x.tagName==='button'),status:panel.children.find(x=>x.attrs.role==='status')}}};
}
const receipt={v:1,action:'approve',mission:'AAAAAAAA',req:'cdefabcd',proof:'worker_receipt+durable_state',state:'approval_request_consumed',at:'2026-10-04T16:00:00.000Z'};

(async()=>{
  const h=dom();
  assert.equal(actions.install(h.root),true,'install must mount the trail');
  let view=h.view();
  assert.equal(h.body.children.indexOf(view.panel),h.body.children.indexOf(h.tasks)+1,'trail must remain outside replaceable mission cards');
  assert.equal(view.list.children.length,0);
  assert.equal(view.button.disabled,true);
  assert.match(view.status.textContent,/henüz karar kaydı yok/);
  h.values.set('unrelated-key','keep');
  for(let i=0;i<12;i++)actions.storeVerifiedReceipt({...receipt,at:new Date(Date.parse(receipt.at)+i*1000).toISOString()},h.root);
  assert.equal(actions.renderReceiptTrail(h.root),true);
  view=h.view();
  assert.equal(view.list.children.length,8);
  assert.match(view.list.children[0].textContent,/16:00:11.000Z/);
  assert.match(view.list.children.at(-1).textContent,/16:00:04.000Z/);
  assert.ok(view.list.children.every(item=>item.textContent.startsWith('KAYIT · ONAY')),'stored history must be labelled as a record, not a live re-verification');
  assert.equal(view.button.disabled,false);
  const replacements=view.list.replacements;
  actions.renderReceiptTrail(h.root);actions.install(h.root);
  assert.equal(view.list.replacements,replacements,'unchanged data must not churn DOM/accessibility announcements');
  assert.equal(h.walk(h.body).filter(e=>e.id==='jarvisMissionReceiptTrail').length,1);
  // Queue refresh does not remove the sibling trail.
  h.tasks.replaceChildren();actions.renderReceiptTrail(h.root);
  assert.equal(h.view().panel,view.panel);
  assert.equal(h.view().list.children.length,8);

  const attack='<img src=x onerror=alert(1)>';
  h.values.set(actions.RECEIPT_STORAGE_KEY,JSON.stringify([{...receipt,payload:attack},{...receipt,mission:attack}]));
  actions.renderReceiptTrail(h.root);
  assert.equal(view.list.children.length,1);
  assert.equal(h.walk(view.panel).some(el=>el.textContent.includes(attack)),false);
  assert.equal(h.values.get(actions.RECEIPT_STORAGE_KEY).includes(attack),false);
  assert.equal(h.calls.length,0,'hydration/rendering must never execute or revalidate a mission');
  const buttons=h.walk(view.panel).filter(el=>el.tagName==='button');
  assert.equal(buttons.length,1,'history must not expose retry/approve/cancel actions');

  view.button.click();
  assert.equal(h.values.has(actions.RECEIPT_STORAGE_KEY),false);
  assert.equal(h.values.get('unrelated-key'),'keep','clear must be scoped to receipt history');
  assert.equal(view.list.children.length,0);
  assert.equal(view.button.disabled,true);
  assert.equal(h.calls.length,0,'clearing is local only');

  actions.storeVerifiedReceipt(receipt,h.root);actions.renderReceiptTrail(h.root);
  h.root.sessionStorage.removeItem=()=>{throw new Error('blocked')};
  view.button.click();
  assert.equal(view.list.children.length,1,'failed deletion must not falsely hide records');
  assert.match(view.status.textContent,/temizlenemedi/);
  assert.equal(h.values.has(actions.RECEIPT_STORAGE_KEY),true);

  // Module reinstallation must replace its existing panel, never duplicate IDs.
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync('./public/mission-actions.js','utf8'),{module,URLSearchParams});
  assert.equal(module.exports.install(h.root),true);
  assert.equal(h.walk(h.body).filter(e=>e.id==='jarvisMissionReceiptTrail').length,1);
  assert.equal(h.view().list.children.length,1);

  const denied=dom();
  Object.defineProperty(denied.root,'sessionStorage',{get(){throw new Error('SecurityError')}});
  assert.equal(actions.renderReceiptTrail(denied.root),true);
  assert.equal(denied.view().list.children.length,0);
  assert.equal(actions.clearVerifiedReceipts(denied.root),false);
  assert.equal(actions.renderReceiptTrail({document:{getElementById:()=>null}}),false,'missing optional UI cannot break proof');
  const broken=dom();broken.tasks.insertAdjacentElement=()=>{throw new Error('DOM unavailable')};
  assert.equal(actions.renderReceiptTrail(broken.root),false);
  const recovering=dom();actions.renderReceiptTrail(recovering.root);
  const list=recovering.view().list,replace=list.replaceChildren;
  actions.storeVerifiedReceipt(receipt,recovering.root);
  list.replaceChildren=()=>{throw new Error('temporary DOM failure')};
  assert.equal(actions.renderReceiptTrail(recovering.root),false);
  list.replaceChildren=replace;
  assert.equal(actions.renderReceiptTrail(recovering.root),true);
  assert.equal(list.children.length,1,'a failed render must be retryable with unchanged receipts');

  // A real act() success must refresh the visible trail; a failed proof must not.
  const live=dom(),id='M-TRAIL-AAAAAAAA',req='0123456789abcdefabcd';
  const mission={id,label:'ONAY · REQ '+req,status:'waiting_dependency',step:{status:'blocked',dependency:'approval'}};
  const card={textContent:mission.label,dataset:{jarvisMissionId:id},querySelector:()=>({textContent:mission.label}),querySelectorAll:()=>[]};
  let stateCalls=0,missingReceipt=false;
  live.root.fetch=async url=>({ok:true,status:200,json:async()=>{
    if(url==='/api/mobile-brain')return{id:'abcd1234-abcd'};
    if(url==='/api/mobile-brain/abcd1234-abcd')return{status:'ready',result:{message:missingReceipt?'Komut alındı.':'AÇIK ONAY UYGULANDI'}};
    const queue=stateCalls++===0?[mission]:[];
    return{workers:{pc:{online:true,missions:{ok:true,openCount:queue.length,queue}}}};
  }});
  assert.equal(await actions.act(card,'approve',live.root),true);
  assert.equal(live.view().list.children.length,1,'proof success must update the actual UI');
  const text=live.view().list.children[0].textContent;
  missingReceipt=true;stateCalls=0;
  assert.equal(await actions.act(card,'approve',live.root),false);
  assert.equal(live.view().list.children.length,1);
  assert.equal(live.view().list.children[0].textContent,text,'failed action must not create or update a historical receipt');
  console.log('MOBILE MISSION TRAIL SELFTEST PASS · text-only · bounded · rehydration · scoped clear · no authority/network');
})().catch(error=>{console.error(error);process.exitCode=1});
