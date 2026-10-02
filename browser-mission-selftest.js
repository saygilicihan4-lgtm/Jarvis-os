const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.94.0'"),'Worker 2.94.0 required');
assert.ok(worker.includes("'browser_form_mission_v1'"),'durable browser form capability missing');
assert.ok(worker.includes("'browser_form_prepare_v1'"),'browser form prepare capability missing');
assert.ok(worker.includes("'browser_click_approval_v1'"),'browser click approval capability missing');
assert.ok(worker.includes("name:'browser_form_mission'"),'native browser form mission tool missing');
assert.ok(worker.includes("else if(n==='browser_form_mission')"),'browser form mission handler missing');
assert.ok(worker.includes('function browserMissionSafeUrl(raw)'),'browser mission safe URL helper missing');
assert.ok(worker.includes('function normalizeBrowserMissionFields(args={})'),'browser field sanitizer missing');
assert.ok(worker.includes('function browserMissionHardDeniedClick(text)'),'high-risk browser click blocker missing');
assert.ok(worker.includes('function createBrowserFormMission(args={})'),'browser mission factory missing');
assert.ok(worker.includes("type:'browser_form'"),'browser_form mission type missing');
assert.ok(worker.includes("const steps=['browser_prepare'];"),'browser prepare step missing');
assert.ok(worker.includes("steps.push({name:'browser_click',meta:{requiresApproval:true}})"),'browser click must use approval gate');
assert.ok(worker.includes("steps.push('browser_verify')"),'browser verification step missing');
assert.ok(worker.includes("code:'EXPLICIT_APPROVAL_REQUIRED'"),'explicit approval barrier missing');
assert.ok(worker.includes("dependency:'approval'"),'approval dependency missing');
assert.ok(worker.includes("if(step.name==='browser_click')"),'browser click execution missing');
assert.ok(worker.includes("await browser.navigate(WORKSPACE,String(input.url||''))"),'browser mission navigation missing');
assert.ok(worker.includes("await browser.setField(WORKSPACE,String(field.label||''),String(field.value??''))"),'browser mission form fill missing');
assert.ok(worker.includes("await browser.clickByText(WORKSPACE,clickText)"),'approved browser click missing');
assert.ok(worker.includes("if(step.name==='browser_prepare'||step.name==='browser_verify')"),'safe retry verification missing');
assert.ok(worker.includes("if(step.name==='browser_click'){\n    return mission;"),'uncertain click must not auto-retry');
assert.ok(worker.includes("dependency:'browser'"),'browser readiness dependency missing');
assert.ok(worker.includes('Hassas form alanı kalıcı browser görevinde saklanamaz'),'sensitive field persistence guard missing');
assert.ok(worker.includes('Bu yüksek riskli tıklama generic browser göreviyle çalıştırılmaz'),'high-risk click guard missing');
assert.ok(worker.includes('public publish, ödeme, silme veya hesap kapatma gibi yüksek riskli eylemler generic browser göreviyle yapılmaz'),'agent browser safety guidance missing');

console.log('BROWSER MISSION SELFTEST PASS');
