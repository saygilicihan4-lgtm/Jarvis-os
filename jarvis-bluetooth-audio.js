const childProcess=require('child_process');
const VERSION='1.0';
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
function command(action){
  const a=String(action||'').toLowerCase();
  if(a==='status')return status();
  if(a==='list_audio')return pairedAudioDevices();
  if(a==='pair')return openBluetoothSettings();
  if(['playpause','next','previous','stop','volumeup','volumedown','mute'].includes(a))return mediaKey(a);
  return{ok:false,reason:'unsupported_action'};
}
module.exports={VERSION,status,pairedAudioDevices,openBluetoothSettings,mediaKey,command};
