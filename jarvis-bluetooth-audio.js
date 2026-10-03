const childProcess=require('child_process');
const path=require('path');
const VERSION='1.7';
function ps(script){
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{return{ok:true,output:childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:1024*1024}).trim()}}catch(e){return{ok:false,reason:'powershell_failed',error:String(e.message||e).slice(0,300)}}
}
function status(){
  return ps("Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object Status,FriendlyName,InstanceId | ConvertTo-Json -Compress");
}
function pairedAudioDevices(){
  return ps("Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -and ($_.Class -eq 'AudioEndpoint' -or $_.Class -eq 'Media') } | Select-Object Status,Class,FriendlyName,InstanceId | ConvertTo-Json -Compress");
}
function normalizeName(name){return String(name||'').replace(/[\r\n]/g,' ').trim().slice(0,120)}
function chooseAudioDevice(output){
  try{const v=JSON.parse(output||'[]');const a=(Array.isArray(v)?v:[v]).filter(x=>x&&x.FriendlyName&&x.InstanceId);const ok=a.filter(x=>String(x.Status||'').toLowerCase()==='ok');const pool=ok.length?ok:a;if(pool.length===1)return{ok:true,device:pool[0]};if(!pool.length)return{ok:false,reason:'audio_device_not_found'};return{ok:false,reason:'multiple_audio_devices',candidates:pool.slice(0,10)};}catch{return{ok:false,reason:'audio_device_parse_failed'}}
}
function autoAudioDevice(){
  const listed=coreAudioEndpoints();if(!listed.ok)return listed;
  const active=listed.endpoints.filter(x=>x&&x.Id&&x.Name&&Number(x.State)===1);
  if(active.length===1)return{ok:true,device:{FriendlyName:active[0].Name,Id:active[0].Id,State:active[0].State},source:'coreaudio'};
  if(!active.length)return{ok:false,reason:'audio_device_not_found',source:'coreaudio'};
  return{ok:false,reason:'multiple_audio_devices',candidates:active.slice(0,10),source:'coreaudio'};
}
function findAudioDevice(name){
  const wanted=normalizeName(name); if(!wanted)return{ok:false,reason:'device_name_required'};
  const q=wanted.replace(/'/g,"''");
  return ps("$x=Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -and ($_.Class -eq 'AudioEndpoint' -or $_.Class -eq 'Media') -and $_.FriendlyName -like '*"+q+"*' } | Select-Object -First 5 Status,Class,FriendlyName,InstanceId; if($x){$x|ConvertTo-Json -Compress}else{Write-Output '[]'}");
}
function coreAudioEndpoints(){
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{const out=childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'jarvis-list-coreaudio.ps1')],{encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:1024*1024}).trim();const v=JSON.parse(out||'[]');return{ok:true,endpoints:Array.isArray(v)?v:[v]}}catch(e){return{ok:false,reason:'coreaudio_enumeration_failed',error:String(e.message||e).slice(0,300)}}
}
function resolveCoreAudioEndpoint(name){
  const wanted=normalizeName(name).toLowerCase();if(!wanted)return{ok:false,reason:'device_name_required'};
  const listed=coreAudioEndpoints();if(!listed.ok)return listed;const matches=listed.endpoints.filter(x=>x&&x.Id&&x.Name&&String(x.Name).toLowerCase().includes(wanted));
  if(matches.length===1)return{ok:true,device:matches[0]};if(!matches.length)return{ok:false,reason:'coreaudio_endpoint_not_found'};return{ok:false,reason:'coreaudio_endpoint_ambiguous',candidates:matches.slice(0,10)};
}
function defaultAudioEndpoint(){
  return ps("$p='HKCU:\\Software\\Microsoft\\Multimedia\\Sound Mapper'; Get-ItemProperty -Path $p -ErrorAction SilentlyContinue | Select-Object Playback,Record | ConvertTo-Json -Compress");
}
function parseFoundDevice(output){
  try{const v=JSON.parse(output||'[]');const a=Array.isArray(v)?v:[v];return a.find(x=>x&&x.InstanceId&&String(x.Status||'').toLowerCase()==='ok')||a.find(x=>x&&x.InstanceId)||null}catch{return null}
}
function setDefaultEndpoint(instanceId){
  const id=String(instanceId||'').trim(); if(!id)return{ok:false,reason:'endpoint_id_required'};
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{const out=childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'jarvis-set-audio-endpoint.ps1'),'-DeviceId',id],{encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:1024*1024}).trim();return{ok:out.includes('JARVIS_AUDIO_ENDPOINT_SET'),output:out}}catch(e){return{ok:false,reason:'coreaudio_switch_failed',error:String(e.message||e).slice(0,300)}}
}
function verifyDefaultEndpoint(instanceId){
  const id=String(instanceId||'').trim(); if(!id)return{ok:false,reason:'endpoint_id_required'};
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{const out=childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'jarvis-get-default-audio.ps1')],{encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:1024*1024}).trim();const v=JSON.parse(out);const ok=['console','multimedia','communications'].every(k=>String(v[k]||'').toLowerCase()===id.toLowerCase());return{ok,reason:ok?'default_endpoint_verified':'default_endpoint_mismatch',active:v}}catch(e){return{ok:false,reason:'endpoint_verification_failed',error:String(e.message||e).slice(0,300)}}
}
function selectOutput(name){
  const resolved=resolveCoreAudioEndpoint(name);if(!resolved.ok)return resolved;const device=resolved.device;
  const switched=setDefaultEndpoint(device.Id);
  if(switched.ok){const verified=verifyDefaultEndpoint(device.Id);if(verified.ok)return{ok:true,reason:'coreaudio_endpoint_verified',device,active:verified.active};return{ok:false,reason:verified.reason,device,active:verified.active,error:verified.error};}
  const opened=openSoundOutputSettings();return{ok:false,reason:switched.reason||'manual_endpoint_selection_required',device,settingsOpened:!!opened.ok,error:switched.error};
}
function openSoundOutputSettings(){
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{childProcess.spawn('cmd.exe',['/c','start','','ms-settings:sound'],{windowsHide:true,detached:true,stdio:'ignore'}).unref();return{ok:true}}catch(e){return{ok:false,reason:'settings_failed'}}
}
function openBluetoothSettings(){
  if(process.platform!=='win32')return{ok:false,reason:'windows_required'};
  try{childProcess.spawn('cmd.exe',['/c','start','','ms-settings:bluetooth'],{windowsHide:true,detached:true,stdio:'ignore'}).unref();return{ok:true}}catch(e){return{ok:false,reason:'settings_failed'}}
}
function mediaKey(action){
  const map={playpause:179,next:176,previous:177,stop:178,volumeup:175,volumedown:174,mute:173};
  const key=map[String(action||'').toLowerCase()]; if(!key)return{ok:false,reason:'unsupported_media_action'};
  const script="$w=New-Object -ComObject WScript.Shell; $w.SendKeys([char]"+key+")";
  return ps(script);
}
function command(action,args={}){
  const a=String(action||'').toLowerCase();
  if(a==='status')return status();
  if(a==='list_audio')return pairedAudioDevices();
  if(a==='pair')return openBluetoothSettings();
  if(a==='find_audio')return findAudioDevice(args.deviceName);
  if(a==='auto_audio')return autoAudioDevice();
  if(a==='select_output'){
    return selectOutput(args.deviceName);
  }
  if(['playpause','next','previous','stop','volumeup','volumedown','mute'].includes(a))return mediaKey(a);
  return{ok:false,reason:'unsupported_action'};
}
module.exports={VERSION,status,pairedAudioDevices,chooseAudioDevice,autoAudioDevice,findAudioDevice,coreAudioEndpoints,resolveCoreAudioEndpoint,defaultAudioEndpoint,parseFoundDevice,setDefaultEndpoint,verifyDefaultEndpoint,selectOutput,openSoundOutputSettings,openBluetoothSettings,mediaKey,command};
