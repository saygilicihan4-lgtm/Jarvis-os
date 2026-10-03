const bt=require('./jarvis-bluetooth-audio');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
let name=process.argv.slice(2).join(' ').trim();
const report={version:1,platform:process.platform,deviceName:name,startedAt:new Date().toISOString(),steps:[]};
function step(name,result){report.steps.push({name,result});return result}
function finish(code){report.finishedAt=report.finishedAt||new Date().toISOString();const dir=path.join(__dirname,'.jarvis-memory','bluetooth-evidence');fs.mkdirSync(dir,{recursive:true});const body=JSON.stringify(report,null,2);const sha256=crypto.createHash('sha256').update(body).digest('hex');const stamp=report.finishedAt.replace(/[:.]/g,'-');const file=path.join(dir,stamp+'-'+(report.ok?'PASS':'FAIL')+'.json');fs.writeFileSync(file,body);console.log(JSON.stringify({...report,evidenceFile:file,evidenceSha256:sha256},null,2));process.exit(code)}
if(process.platform!=='win32'){report.ok=false;report.reason='windows_required';finish(2)}
if(!name){
  const auto=step('auto_audio_target',bt.autoAudioDevice());
  if(!auto.ok){report.ok=false;report.reason=auto.reason||'auto_audio_target_failed';report.candidates=auto.candidates||[];finish(2)}
  name=String(auto.device.FriendlyName||'').trim();report.deviceName=name;report.autoSelected=true;
}
const status=step('bluetooth_status',bt.status());
const found=step('find_audio',bt.findAudioDevice(name));
if(!found.ok||found.output==='[]'){report.ok=false;report.reason=found.reason||'audio_device_not_found';finish(3)}
const selected=step('select_and_verify_output',bt.selectOutput(name));
if(!selected.ok){report.ok=false;report.reason=selected.reason||'output_switch_failed';finish(4)}
const media=step('media_playpause_probe',bt.mediaKey('playpause'));
report.ok=!!media.ok;report.reason=report.ok?'bluetooth_audio_e2e_pass':'media_probe_failed';report.finishedAt=new Date().toISOString();
finish(report.ok?0:5);