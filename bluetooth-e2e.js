const bt=require('./jarvis-bluetooth-audio');
const name=process.argv.slice(2).join(' ').trim();
const report={version:1,platform:process.platform,deviceName:name,startedAt:new Date().toISOString(),steps:[]};
function step(name,result){report.steps.push({name,result});return result}
if(process.platform!=='win32'){report.ok=false;report.reason='windows_required';console.log(JSON.stringify(report,null,2));process.exit(2)}
if(!name){report.ok=false;report.reason='device_name_required';console.log(JSON.stringify(report,null,2));process.exit(2)}
const status=step('bluetooth_status',bt.status());
const found=step('find_audio',bt.findAudioDevice(name));
if(!found.ok||found.output==='[]'){report.ok=false;report.reason=found.reason||'audio_device_not_found';console.log(JSON.stringify(report,null,2));process.exit(3)}
const selected=step('select_and_verify_output',bt.selectOutput(name));
if(!selected.ok){report.ok=false;report.reason=selected.reason||'output_switch_failed';console.log(JSON.stringify(report,null,2));process.exit(4)}
const media=step('media_playpause_probe',bt.mediaKey('playpause'));
report.ok=!!media.ok;report.reason=report.ok?'bluetooth_audio_e2e_pass':'media_probe_failed';report.finishedAt=new Date().toISOString();
console.log(JSON.stringify(report,null,2));process.exit(report.ok?0:5);