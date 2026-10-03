const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const childProcess=require('child_process');
const http=require('http');
let creatorEngine=null;
try{creatorEngine=require('./jarvis-creator-engine')}catch(_){}
let creatorWebMedia=null;
try{creatorWebMedia=require('./jarvis-creator-web-media')}catch(_){}
let creatorSemanticQuality=null;
try{creatorSemanticQuality=require('./jarvis-creator-semantic-quality')}catch(_){}
let browserOperator=null;
try{browserOperator=require('./jarvis-browser-operator')}catch(_){}
let commerceEngine=null;
try{commerceEngine=require('./jarvis-commerce-engine')}catch(_){}
let youtubeStudio=null;
try{youtubeStudio=require('./jarvis-youtube-studio')}catch(_){}
let missionEngine=null;
try{missionEngine=require('./jarvis-mission-engine')}catch(_){}
let bluetoothAudio=null;
try{bluetoothAudio=require('./jarvis-bluetooth-audio')}catch(_){}
let bluetoothSecure=null;
try{bluetoothSecure=require('./jarvis-bluetooth-secure')}catch(_){}
let workspaceFileEngine=null;
try{workspaceFileEngine=require('./jarvis-workspace-file-engine')}catch(_){}

const BASE=(process.env.JARVIS_URL||'https://jarvis-os-1iuv.onrender.com').replace(/\/$/,'');
const TOKEN=process.env.JARVIS_TOKEN||'';
const PAIR_CODE=process.env.JARVIS_PAIR_CODE||'';
const NAME=process.env.JARVIS_WORKER_NAME||os.hostname();
const DEVICE_FILE=path.join(os.homedir(),'.jarvis-device-id');
function loadDeviceId(){
  if(process.env.JARVIS_DEVICE_ID)return process.env.JARVIS_DEVICE_ID;
  try{const x=fs.readFileSync(DEVICE_FILE,'utf8').trim();if(x)return x}catch(e){}
  const id='PC-'+os.hostname().replace(/[^A-Za-z0-9_.-]/g,'-')+'-'+require('crypto').randomBytes(4).toString('hex');
  fs.writeFileSync(DEVICE_FILE,id,'utf8');return id;
}
const DEVICE_ID=loadDeviceId();
const DEVICE_TOKEN_FILE=path.join(os.homedir(),'.jarvis-device-token');
let DEVICE_TOKEN='';
try{DEVICE_TOKEN=fs.readFileSync(DEVICE_TOKEN_FILE,'utf8').trim()}catch(e){}
const WORKSPACE=path.resolve(process.env.JARVIS_WORKSPACE||path.join(process.cwd(),'jarvis-workspace'));
const MEMORY_DIR=path.join(WORKSPACE,'.jarvis-memory');
const MEMORY_FILE=path.join(MEMORY_DIR,'task-history.jsonl');
const CHECKPOINT_DIR=path.join(MEMORY_DIR,'checkpoints');
const JOURNAL_DIR=path.join(MEMORY_DIR,'journals');
const STRATEGY_FILE=path.join(MEMORY_DIR,'strategy-policy.json');
const CLOUD_STATE_FILE=path.join(MEMORY_DIR,'cloud-state.json');
const UPDATE_STATE_FILE=path.join(MEMORY_DIR,'update-state.json');
const WORKER_VERSION='2.102.0';
const CAPS=['system_status','list_files','write_note','write_file','read_file','make_folder','project_scaffold','workspace_bundle','mission_plan','strategy_metrics','strategy_selection','strategy_rollback','resume_checkpoint','multi_device_identity','cloud_state_backup','snapshot_integrity_v2','snapshot_hmac_v3','signed_bootstrap_restore_v1','task_uid_v1','safe_rehydrate_v1','transactional_plan','transaction_crash_recovery_v1','strict_journal_v2','bounded_rollback_v1','transaction_journal_v3','checkpoint_plan_hash_v1','prefix_revalidation_v1','signed_device_credential_v1','device_credential_refresh_v1','pairing_code_v1','restore_before_heartbeat_v1','single_restore_attempt_v1','auth_loss_restore_v1','global_f8_wake_v1','phone_session_code_v1','local_memory','process_list_v1','disk_status_v1','network_status_v1','local_ai_readiness_v1','wake_on_lan_readiness_v1','local_tts_v1','local_tts_bridge_v1','double_clap_wake_v2','helper_autosync_v1','python_clap_listener_v1','double_clap_transient_gate_v2','double_clap_classifier_v3','mobile_tts_relay_v1','creator_tts_v1','desktop_launch_v1','media_control_v1','power_status_v1','local_brain_v1','local_brain_memory_v2','local_brain_eval_v2','local_stt_v1','adaptive_tts_v1','turn_taking_v2','qwen3_local_brain_v1','episodic_memory_v1','stt_hotwords_v1','mobile_brain_relay_v1','mobile_adaptive_tts_v2','expressive_tone_v2','speech_naturalizer_v1','multi_action_plan_v1','workspace_search_v1','dialogue_quality_v2','interruptible_tts_v1','brain_prewarm_v1','latency_runtime_v1','tool_result_reflection_v1','agent_loop_v2','context_continuity_v1','anaphora_resolution_v1','offline_tts_fallback_v1','mobile_handsfree_loop_v1','local_rag_v1','deep_reflection_v1','grounded_workspace_context_v1','qwen35_local_brain_v1','local_multimodal_v1','camera_vision_v1','native_tool_loop_v1','adaptive_tool_chain_v1','safe_workspace_read_v1','selective_reasoning_v1','adaptive_context_v1','chunked_tts_pipeline_v1','tts_prefetch_v1','safe_tts_cache_v1','local_screen_vision_v1','explicit_screen_consent_v1'];
CAPS.push('adaptive_speech_lexicon_v1','voice_correction_learning_v1','adaptive_stt_decode_v1','dynamic_endpointing_v1','thinking_backchannel_v1','tts_backchannel_prewarm_v1','streaming_chat_v1','sentence_stream_tts_v1','natural_barge_in_v1','spoken_followup_interrupt_v1','conversation_repair_v1','misunderstanding_recovery_v1','adaptive_model_router_v1','deep_model_fallback_v1','dynamic_chunk_prosody_v1','natural_pause_timing_v1','adaptive_turn_pacing_v1','latency_learning_v1','full_duplex_interrupt_v1','cancellable_agent_v1','adaptive_voice_profile_v1','spoken_voice_preference_v1','speaker_echo_rejection_v1','social_dialogue_v1','response_variation_v1','contextual_followup_v1','dialogue_feedback_learning_v1','social_preference_adaptation_v1','dynamic_wake_ack_v1','wake_ack_turn_timing_v1','auto_quality_escalation_v1','weak_response_escalation_v1','repair_quality_escalation_v1','social_momentum_v1','elliptical_turn_resolution_v1','conversation_cadence_v1','brevity_mirroring_v1','adaptive_response_length_v1','interruption_continuity_v1','spoken_resume_v1','partial_stream_resume_v1');
CAPS.push('creator_video_v2','shorts_render_v1','ffmpeg_autosetup_v1','bootstrap_migration_v2','bootstrap_migration_v3','bootstrap_migration_v4','bootstrap_migration_v5','browser_operator_v1','dedicated_browser_profile_v1','commerce_engine_v1','shopify_product_draft_v1','shopify_publish_v1','shopify_dpapi_secret_v1','native_creator_tool_v1','native_commerce_tool_v1','draft_first_workflow_v1','youtube_studio_draft_v1','youtube_upload_prepare_v1','native_youtube_tool_v1','durable_mission_v1','mission_resume_v1','varova_campaign_mission_v1','mission_auto_resume_v1','mission_health_v1','pc_acceptance_snapshot_v1','silent_startup_diagnostics_v1','pc_acceptance_hardened_v1','bootstrap_migration_v6','mission_fair_scheduler_v1','pc_self_repair_v1','pc_runtime_integrity_repair_v1','bluetooth_secure_pairing_v1','bluetooth_password_hash_v1','bluetooth_approval_isolation_v1','bluetooth_audio_router_v1','bluetooth_media_control_v1','bluetooth_native_tool_v1','bluetooth_named_audio_target_v1','windows_audio_endpoint_verification_v1','windows_coreaudio_switch_v1','windows_coreaudio_verify_v1','bluetooth_auto_audio_target_v1','bluetooth_audio_e2e_runner_v1','bluetooth_native_acceptance_v1','bluetooth_auto_acceptance_v1','bluetooth_e2e_evidence_v1','bluetooth_hardware_honest_proof_v1','windows_coreaudio_resolver_v1','bluetooth_coreaudio_auto_target_v1','creator_multiscene_v2','creator_burned_captions_v1','cloud_mission_telemetry_v1','creator_short_mission_v1','shopify_product_mission_v1','developer_project_mission_v1','approval_gate_v1','shopify_publish_approval_v1','browser_form_mission_v1','browser_form_prepare_v1','browser_click_approval_v1','youtube_publish_approval_v1','youtube_publish_receipt_v1','developer_patch_mission_v1','developer_patch_rollback_v1','pc_safe_mission_v1','pc_safe_action_catalog_v1','pc_mission_resume_v1','workspace_file_mission_v1','workspace_file_hash_guard_v1','workspace_file_no_overwrite_v1','mission_control_v1','mission_pause_v1','mission_cancel_v1','creator_asset_mission_v1','creator_asset_probe_v1','creator_asset_hash_dedupe_v1','creator_storyboard_v1','creator_explicit_assets_v1','creator_render_mission_bind_v1','creator_batch_mission_v1','creator_batch_child_dedupe_v1','creator_batch_youtube_draft_v1','mission_cooperative_yield_v1','creator_batch_storyboard_lock_v1','creator_batch_render_binding_v1','creator_quality_gate_v1','creator_quality_recovery_v1','creator_longform_mission_v1','creator_longform_quality_v1','creator_longform_recovery_v1','creator_multilingual_voice_v1','creator_daily_longform_v1','creator_daily_idempotency_v1','creator_longform_duration_fit_v1','creator_longform_edit_rhythm_v1','creator_web_media_v1','creator_web_license_manifest_v1','creator_web_zero_key_v1','creator_asset_semantic_catalog_v1','creator_visual_relevance_v1','creator_local_vision_broll_v1','creator_youtube_attribution_v1','creator_short_motion_rhythm_v1','creator_image_motion_fallback_v1','creator_auto_web_query_v1','creator_scene_web_queries_v1','creator_narrative_visual_sync_v1','creator_short_kinetic_captions_v1','creator_web_freshness_v1','creator_real_motion_hook_v1','creator_batch_web_diversity_v1','creator_micro_hook_v1','creator_hook_motion_evidence_v1','creator_auto_hook_motion_rank_v1','creator_thumbnail_v1','creator_short_sfx_v1','creator_semantic_diversity_v1','creator_semantic_sparse_overlap_guard_v1','creator_relevance_preserving_fallback_v1','creator_semantic_relevance_floor_v1','creator_semantic_narrative_digest_v1','creator_procedural_fallback_v1','creator_procedural_visual_phases_v1','creator_procedural_narrative_phases_v1','creator_scene_semantic_order_v1','creator_longform_repeat_pressure_v1','creator_visual_integrity_density_v1');


const TTS_ENABLED=process.platform==='win32'&&process.env.JARVIS_TTS!=='0';
const TTS_VOICE='tr-TR-AhmetNeural';
const TTS_RATE='-20%';
const TTS_PITCH='-12Hz';
const TTS_VOLUME='-3%';
const MOBILE_TTS_VOLUME='+55%';

// Separate creator voice: intentionally different from JARVIS.
// Used for YouTube Shorts/video narration assets, never for JARVIS replies.
const CREATOR_TTS_VOICE='tr-TR-EmelNeural';
const CREATOR_TTS_RATE='-7%';
const CREATOR_TTS_PITCH='-6Hz';
const CREATOR_TTS_VOLUME='+14%';

// Zero-cost local conversational brain. No paid API is used.
// Default model is intentionally small enough for older Windows laptops.
const LOCAL_BRAIN_URL=String(process.env.JARVIS_LOCAL_BRAIN_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
let LOCAL_BRAIN_MODEL=String(process.env.JARVIS_LOCAL_BRAIN_MODEL||'qwen3.5:2b').trim();
const LOCAL_BRAIN_DEEP_MODEL_REQUESTED=String(process.env.JARVIS_LOCAL_BRAIN_DEEP_MODEL||'').trim();
let LOCAL_BRAIN_DEEP_MODEL=LOCAL_BRAIN_DEEP_MODEL_REQUESTED||LOCAL_BRAIN_MODEL;
const LOCAL_BRAIN_KEEP_ALIVE=String(process.env.JARVIS_LOCAL_BRAIN_KEEP_ALIVE||'30m').trim();
const LOCAL_BRAIN_CTX=Math.max(4096,Math.min(16384,Number(process.env.JARVIS_LOCAL_BRAIN_CTX)||(
  os.totalmem()>=14*1073741824?12288:os.totalmem()>=7*1073741824?8192:4096
)));
const LOCAL_BRAIN_HISTORY_FILE=path.join(MEMORY_DIR,'brain-history.jsonl');
const LOCAL_BRAIN_FACTS_FILE=path.join(MEMORY_DIR,'brain-facts.jsonl');
const LOCAL_BRAIN_EPISODES_FILE=path.join(MEMORY_DIR,'brain-episodes.jsonl');
const LOCAL_BRAIN_PERSONA_FILE=path.join(MEMORY_DIR,'brain-persona.json');
const SPEECH_LEXICON_FILE=path.join(MEMORY_DIR,'speech-lexicon.json');
const VOICE_PREFS_FILE=path.join(MEMORY_DIR,'voice-preferences.json');
const DIALOGUE_FEEDBACK_FILE=path.join(MEMORY_DIR,'dialogue-feedback.json');
const CREATOR_DAILY_PLAN_FILE=path.join(MEMORY_DIR,'creator-daily-longform.json');
const CREATOR_ASSET_CATALOG_FILE=path.join(MEMORY_DIR,'creator-asset-catalog.json');
const CREATOR_ASSET_USAGE_FILE=path.join(MEMORY_DIR,'creator-asset-usage.json');
const TEST_MODE=process.env.JARVIS_TEST_MODE==='1';
const FORCE_LOCAL_BRIDGE=process.env.JARVIS_LOCAL_BRIDGE_FORCE==='1';
const LOCAL_STT_PORT=Number(process.env.JARVIS_STT_PORT||8768);
const LOCAL_STT_MODEL=String(process.env.JARVIS_STT_MODEL||'base').trim();
let speechQueue=Promise.resolve();
const TTS_LOCK_FILE=path.join(__dirname,'jarvis-tts-active.lock');
const TTS_CACHE_DIR=path.join(MEMORY_DIR,'tts-cache');
const JARVIS_BACKCHANNEL_PHRASES=[
  'Bakıyorum.',
  'Bir bakalım.',
  'Hımm, düşünüyorum.',
  'Hemen inceliyorum.',
  'Bir saniye, kontrol ediyorum.',
  'Tamam, bakıyorum.'
];
const JARVIS_WAKE_ACK_PHRASES=[
  'Buradayım.',
  'Dinliyorum.',
  'Buyurun.',
  'Söyleyin.',
  'Buradayım Cihan Bey.'
];
let lastQueuedSpeech='';
let lastQueuedSpeechAt=0;
let ttsPendingCount=0;
let ttsSpeaking=false;
let ttsLastStartedAt=0;
let ttsLastEndedAt=0;
let ttsLastChunkCount=0;
let ttsCurrentChunk=0;
let ttsGeneration=0;
let activeSpeechText='';
let activeSpeechTone='balanced';
let activeSpeechChunks=[];
let activeSpeechGeneration=0;
let interruptedConversationState=null;
let ttsBackchannelPrewarmState={status:'idle',count:0,total:JARVIS_BACKCHANNEL_PHRASES.length+JARVIS_WAKE_ACK_PHRASES.length,error:null};
let voicePrefsCache=null;
let activeTtsPlayback=null;
let brainWarmState={status:'idle',model:null,startedAt:null,readyAt:null,latencyMs:null,error:null};
let episodeSummaryRunning=false;
let lastLocalWakeAt=0;
let localWakeCounter=0;

function runHidden(file,args,timeoutMs=60000){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn(file,args,{windowsHide:true,stdio:'ignore'});
    const finish=(err)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(err)reject(err);else resolve();
    };
    const timer=setTimeout(()=>{try{p.kill()}catch(e){};finish(new Error(file+' zaman aşımına uğradı'))},timeoutMs);
    p.on('error',finish);
    p.on('exit',code=>code===0?finish():finish(new Error(file+' çıkış kodu '+code)));
  });
}
function setTtsLock(active){
  try{
    if(active)fs.writeFileSync(TTS_LOCK_FILE,String(Date.now()),'utf8');
    else if(fs.existsSync(TTS_LOCK_FILE))fs.unlinkSync(TTS_LOCK_FILE);
  }catch(e){}
}
function killChildTree(p){
  if(!p||!p.pid)return;
  try{
    if(process.platform==='win32'){
      childProcess.spawn('taskkill.exe',['/PID',String(p.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).unref();
    }else{
      p.kill('SIGTERM');
    }
  }catch(_){}
}
function interruptionResumeIntent(text){
  const s=String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[!?.,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!s)return false;
  return /^(?:jarvis\s+)?(?:devam|devam et|kaldığın yerden devam et|kaldigin yerden devam et|sözünü tamamla|sozunu tamamla|anlatmaya devam et|söylemeye devam et|soylemeye devam et|nerede kalmıştın|nerede kalmistin)$/i.test(s);
}
function freshInterruptedConversationState(maxAgeMs=120000){
  const x=interruptedConversationState;
  if(!x)return null;
  const age=Date.now()-Number(x.at||0);
  if(age<0||age>maxAgeMs){
    interruptedConversationState=null;
    return null;
  }
  return{...x,ageMs:age};
}
function setInterruptedConversationState(next){
  if(!next)return null;
  const clean={...next,at:Number(next.at||Date.now())};
  const current=freshInterruptedConversationState(5000);
  if(current&&current.kind==='stream'&&clean.kind==='tts')return current;
  interruptedConversationState=clean;
  remember({
    kind:'conversation_interrupted',
    source:clean.kind,
    partialChars:String(clean.partialText||'').length,
    remainingChars:String(clean.remainingText||'').length
  });
  return clean;
}
function clearInterruptedConversationState(reason='cleared'){
  if(interruptedConversationState){
    remember({kind:'conversation_interrupt_cleared',reason:String(reason||'cleared').slice(0,80),source:interruptedConversationState.kind});
  }
  interruptedConversationState=null;
}
function interruptionResumeState(text){
  const x=freshInterruptedConversationState();
  if(!x||!interruptionResumeIntent(text))return null;
  return x;
}
function deterministicInterruptedSpeechResume(text){
  const x=interruptionResumeState(text);
  if(!x||x.kind!=='tts'||!String(x.remainingText||'').trim())return null;
  const reply=String(x.remainingText||'').replace(/\s+/g,' ').trim();
  if(!reply)return null;
  interruptedConversationState=null;
  return{
    handled:true,
    type:'chat',
    reply,
    command:null,
    commands:[],
    tone:String(x.tone||'balanced'),
    model:'local-interruption-resume',
    resumed:true,
    resumeSource:'tts',
    resumeAgeMs:Number(x.ageMs||0)
  };
}
function interruptedStreamResumeContext(text){
  const x=interruptionResumeState(text);
  if(!x||x.kind!=='stream'||!String(x.partialText||'').trim())return'';
  return[
    'KESİLEN KONUŞMA DEVAMI:',
    'Kullanıcı önceki JARVIS cevabını konuşurken kesti ve şimdi devam etmenizi istiyor.',
    'Baştan başlama, gereksiz özür dileme ve söylenmiş kısmı tekrar etme.',
    'Önceki kullanıcı mesajı: '+String(x.userText||'').slice(0,700),
    'Kullanıcının duyduğu/üretilmiş son kısım: '+String(x.partialText||'').slice(-1200),
    'Şimdi kaldığın noktadan doğal biçimde devam et.'
  ].join(' ');
}
function clearInterruptedStateForNewTurn(text){
  const x=freshInterruptedConversationState();
  if(!x)return;
  if(interruptionResumeIntent(text))return;
  clearInterruptedConversationState('new-user-turn');
}
function stopJarvisSpeech(reason='user'){
  let resumeState=null;
  if(ttsSpeaking&&activeSpeechGeneration===ttsGeneration&&activeSpeechChunks.length){
    const start=Math.max(0,Math.min(activeSpeechChunks.length-1,Number(ttsCurrentChunk||1)-1));
    const remaining=activeSpeechChunks.slice(start).join(' ').replace(/\s+/g,' ').trim();
    if(activeSpeechText.length>=55&&remaining.length>=20){
      resumeState=setInterruptedConversationState({
        kind:'tts',
        at:Date.now(),
        originalText:activeSpeechText,
        remainingText:remaining,
        tone:activeSpeechTone,
        currentChunk:Number(ttsCurrentChunk||1),
        totalChunks:activeSpeechChunks.length
      });
    }
  }
  ttsGeneration++;
  lastQueuedSpeech='';
  lastQueuedSpeechAt=0;
  ttsPendingCount=0;
  speechQueue=Promise.resolve();
  if(activeTtsPlayback){
    killChildTree(activeTtsPlayback);
    activeTtsPlayback=null;
  }
  ttsSpeaking=false;
  ttsCurrentChunk=0;
  activeSpeechText='';
  activeSpeechTone='balanced';
  activeSpeechChunks=[];
  activeSpeechGeneration=0;
  ttsLastEndedAt=Date.now();
  setTtsLock(false);
  remember({kind:'tts_interrupt',reason:String(reason||'user').slice(0,80),generation:ttsGeneration,resumeAvailable:!!resumeState});
  return{
    ok:true,stopped:true,generation:ttsGeneration,reason:String(reason||'user'),
    resumeAvailable:!!resumeState,
    resumeKind:resumeState&&resumeState.kind||null,
    remainingChars:resumeState?String(resumeState.remainingText||'').length:0
  };
}
async function playTtsMp3Cancelable(mp3,generation){
  if(generation!==ttsGeneration)return false;
  const safe=mp3.replace(/'/g,"''");
  const ps="Add-Type -AssemblyName PresentationCore; $p=New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'"+safe+"'); for($i=0;$i -lt 100 -and -not $p.NaturalDuration.HasTimeSpan;$i++){Start-Sleep -Milliseconds 100}; $p.Volume=1.0; $p.Play(); if($p.NaturalDuration.HasTimeSpan){Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds+220)}else{Start-Sleep -Seconds 15}; $p.Close()";
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{
      windowsHide:true,stdio:'ignore'
    });
    activeTtsPlayback=p;
    const finish=(err)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(activeTtsPlayback===p)activeTtsPlayback=null;
      if(generation!==ttsGeneration)return resolve(false);
      if(err)return reject(err);
      resolve(true);
    };
    const timer=setTimeout(()=>{
      killChildTree(p);
      finish(new Error('TTS playback zaman aşımı'));
    },45000);
    p.on('error',finish);
    p.on('exit',code=>{
      if(generation!==ttsGeneration)return finish();
      code===0?finish():finish(new Error('TTS playback çıkış kodu '+code));
    });
  });
}
function defaultVoicePreferences(){
  return{
    version:1,
    rateOffset:0,
    pitchOffset:0,
    volumeOffset:0,
    pauseScale:1,
    updatedAt:null
  };
}
function clampVoicePreferenceNumber(value,min,max,fallback){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
function sanitizeVoicePreferences(input){
  const d=defaultVoicePreferences();
  const x=input&&typeof input==='object'?input:{};
  return{
    version:1,
    rateOffset:Math.round(clampVoicePreferenceNumber(x.rateOffset,-10,10,d.rateOffset)),
    pitchOffset:Math.round(clampVoicePreferenceNumber(x.pitchOffset,-5,5,d.pitchOffset)),
    volumeOffset:Math.round(clampVoicePreferenceNumber(x.volumeOffset,-12,12,d.volumeOffset)),
    pauseScale:Number(clampVoicePreferenceNumber(x.pauseScale,0.72,1.35,d.pauseScale).toFixed(2)),
    updatedAt:x.updatedAt||null
  };
}
function readVoicePreferences(){
  if(voicePrefsCache)return voicePrefsCache;
  try{
    if(fs.existsSync(VOICE_PREFS_FILE)){
      voicePrefsCache=sanitizeVoicePreferences(JSON.parse(fs.readFileSync(VOICE_PREFS_FILE,'utf8')));
      return voicePrefsCache;
    }
  }catch(_){}
  voicePrefsCache=defaultVoicePreferences();
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(VOICE_PREFS_FILE,JSON.stringify(voicePrefsCache,null,2),'utf8');
  }catch(_){}
  return voicePrefsCache;
}
function writeVoicePreferences(next){
  const clean=sanitizeVoicePreferences({...next,updatedAt:new Date().toISOString()});
  voicePrefsCache=clean;
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(VOICE_PREFS_FILE,JSON.stringify(clean,null,2),'utf8');
  }catch(_){}
  remember({kind:'voice_preference_updated',rateOffset:clean.rateOffset,pitchOffset:clean.pitchOffset,volumeOffset:clean.volumeOffset,pauseScale:clean.pauseScale});
  return clean;
}
function resetVoicePreferences(){
  voicePrefsCache=defaultVoicePreferences();
  return writeVoicePreferences(voicePrefsCache);
}
function adjustVoicePreferences(delta={}){
  const p=readVoicePreferences();
  return writeVoicePreferences({
    ...p,
    rateOffset:Number(p.rateOffset||0)+Number(delta.rateOffset||0),
    pitchOffset:Number(p.pitchOffset||0)+Number(delta.pitchOffset||0),
    volumeOffset:Number(p.volumeOffset||0)+Number(delta.volumeOffset||0),
    pauseScale:Number(p.pauseScale||1)+Number(delta.pauseScale||0)
  });
}
function voicePreferenceIntent(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR').replace(/[’']/g,'').replace(/\s+/g,' ').trim();
  if(!s)return null;
  if(/(?:ses|konuşma|konusma).*(?:ayar|tercih).*(?:sıfırla|sifirla|reset)|(?:normal|varsayılan|varsayilan) (?:konuşma|konusma) (?:ayarına|ayarina) dön/.test(s)){
    return{action:'reset',reply:'Tamam. Konuşma sesimi varsayılan ayarıma döndürdüm.'};
  }
  if(/(?:çok|cok) hızlı konuşuyorsun|(?:biraz )?daha yavaş konuş|konuşma hızını azalt|konusma hizini azalt|yavaşla|yavasla/.test(s)){
    return{delta:{rateOffset:-2},reply:'Tamam. Konuşma hızımı biraz düşürdüm.'};
  }
  if(/(?:çok|cok) yavaş konuşuyorsun|(?:biraz )?daha hızlı konuş|konuşma hızını artır|konusma hizini artir|hızlan|hizlan/.test(s)){
    return{delta:{rateOffset:2},reply:'Tamam. Konuşma hızımı biraz artırdım.'};
  }
  if(/(?:ses tonun|sesin|kendi sesin).*(?:daha kalın|daha derin|kalın olsun|derin olsun)/.test(s)){
    return{delta:{pitchOffset:-1},reply:'Tamam. Ses tonumu biraz daha derinleştirdim.'};
  }
  if(/(?:ses tonun|sesin|kendi sesin).*(?:daha ince|biraz yükselsin|daha yüksek tonda)/.test(s)){
    return{delta:{pitchOffset:1},reply:'Tamam. Ses tonumu biraz yükselttim.'};
  }
  if(/(?:jarvis )?(?:sesin|kendi sesin|konuşma sesin).*(?:daha yüksek|yükselt|artır|arttir)/.test(s)){
    return{delta:{volumeOffset:2},reply:'Tamam. Kendi konuşma sesimi biraz yükselttim.'};
  }
  if(/(?:jarvis )?(?:sesin|kendi sesin|konuşma sesin).*(?:daha kısık|kıs|azalt|alçalt)/.test(s)){
    return{delta:{volumeOffset:-2},reply:'Tamam. Kendi konuşma sesimi biraz kıstım.'};
  }
  if(/(?:daha kısa durakla|daha az durakla|cümle aralarını kısalt|cumle aralarini kisalt)/.test(s)){
    return{delta:{pauseScale:-0.08},reply:'Tamam. Cümle aralarındaki duraklamayı azalttım.'};
  }
  if(/(?:biraz daha durakla|daha doğal durakla|daha fazla durakla|cümle aralarını uzat|cumle aralarini uzat)/.test(s)){
    return{delta:{pauseScale:0.08},reply:'Tamam. Cümle aralarına biraz daha nefes bıraktım.'};
  }
  return null;
}
function handleVoicePreferenceDirective(text){
  const intent=voicePreferenceIntent(text);
  if(!intent)return{handled:false};
  const prefs=intent.action==='reset'?resetVoicePreferences():adjustVoicePreferences(intent.delta||{});
  return{
    handled:true,type:'chat',reply:intent.reply,command:null,commands:[],tone:'warm',
    model:'local-voice-preference',voicePreferences:prefs
  };
}
function looksLikeVoicePreferenceDirective(text){
  return !!voicePreferenceIntent(text);
}
function ttsProfileForTone(tone='balanced',text=''){
  const t=String(tone||'balanced').toLowerCase();
  const profiles={
    balanced:{rate:'-18%',pitch:'-12Hz',volume:'+0%'},
    casual:{rate:'-13%',pitch:'-9Hz',volume:'+2%'},
    playful:{rate:'-9%',pitch:'-7Hz',volume:'+3%'},
    warm:{rate:'-21%',pitch:'-11Hz',volume:'+2%'},
    focused:{rate:'-14%',pitch:'-13Hz',volume:'+0%'},
    work:{rate:'-14%',pitch:'-13Hz',volume:'+0%'},
    serious:{rate:'-19%',pitch:'-14Hz',volume:'+0%'},
    excited:{rate:'-6%',pitch:'-5Hz',volume:'+3%'},
    gentle:{rate:'-24%',pitch:'-10Hz',volume:'+2%'}
  };
  const p={...(profiles[t]||profiles.balanced)};
  const clean=String(text||'');
  if(/[!?]{2,}|😂|🤣/.test(clean)&&['balanced','casual'].includes(t)){
    p.rate='-10%';p.pitch='-8Hz';p.volume='+3%';
  }
  if(clean.length>420&&t==='balanced')p.rate='-15%';
  const pref=readVoicePreferences();
  p.rate=shiftTtsNumber(p.rate,pref.rateOffset,'%',-32,8,true);
  p.pitch=shiftTtsNumber(p.pitch,pref.pitchOffset,'Hz',-22,4,true);
  p.volume=shiftTtsNumber(p.volume,pref.volumeOffset,'%',-18,18,true);
  return p;
}
function shiftTtsNumber(value,delta,suffix,min,max,forceSign=false){
  const n=Number(String(value||'').replace(suffix,'').replace('+',''))||0;
  const next=Math.max(min,Math.min(max,n+delta));
  const sign=forceSign&&next>=0?'+':'';
  return sign+Math.round(next)+suffix;
}
function ttsProfileForChunk(baseTone,chunk,index,total){
  const p={...ttsProfileForTone(baseTone,chunk)};
  const s=String(chunk||'').trim();
  const t=String(baseTone||'balanced').toLowerCase();

  // Subtle sentence-level movement: enough to avoid flat delivery without
  // turning a calm JARVIS voice into theatrical narration.
  if(/\?$/.test(s)){
    p.rate=shiftTtsNumber(p.rate,2,'%',-32,6,true);
    p.pitch=shiftTtsNumber(p.pitch,2,'Hz',-20,2,true);
  }else if(/!$/.test(s)&&!['serious','gentle'].includes(t)){
    p.rate=shiftTtsNumber(p.rate,2,'%',-32,6,true);
    p.pitch=shiftTtsNumber(p.pitch,1,'Hz',-20,2,true);
  }else if(/\b(?:ama|fakat|ancak|yalnız|yalniz|dikkat|sorun|hata)\b/i.test(s)){
    p.rate=shiftTtsNumber(p.rate,-2,'%',-32,6,true);
    p.pitch=shiftTtsNumber(p.pitch,-1,'Hz',-20,2,true);
  }else if(s.length<55&&index===0&&['casual','playful','balanced'].includes(t)){
    p.rate=shiftTtsNumber(p.rate,1,'%',-32,6,true);
  }

  if(total>1&&index===total-1&&/\.$/.test(s)&&!['excited','playful'].includes(t)){
    p.rate=shiftTtsNumber(p.rate,-1,'%',-32,6,true);
  }
  return p;
}
function speechChunkPauseMs(chunk,index,total){
  if(index>=total-1)return 0;
  const s=String(chunk||'').trim();
  let base=35;
  if(/[!?…]$/.test(s))base=105;
  else if(/[.;:]$/.test(s))base=75;
  else if(/[,]$/.test(s))base=45;
  const scale=Number(readVoicePreferences().pauseScale||1);
  return Math.max(20,Math.min(180,Math.round(base*scale)));
}
function prepareJarvisSpeechText(text,tone='balanced'){
  let s=String(text||'').replace(/\s+/g,' ').trim();
  // Convert UI/technical notation into phrases a Turkish neural voice says naturally.
  s=s
    .replace(/\s*·\s*/g,', ')
    .replace(/\s*—\s*/g,', ')
    .replace(/\bPC\b/gi,'bilgisayar')
    .replace(/\bCPU\b/gi,'işlemci')
    .replace(/\bRAM\b/gi,'ram')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*GB\b/gi,'$1 gigabayt')
    .replace(/%(\s*\d+)/g,'yüzde $1')
    .replace(/\bWi[- ]?Fi\b/gi,'vay fay')
    .replace(/\bv(\d+)\.(\d+)\.(\d+)\b/gi,'sürüm $1 nokta $2 nokta $3')
    .replace(/https?:\/\//gi,'')
    .replace(/\s*\/\s*/g,' bölü ');
  if(tone==='playful'||tone==='excited')s=s.replace(/\.{3,}/g,'…');
  if(tone==='gentle')s=s.replace(/!+/g,'.');
  return s.slice(0,900);
}
function speechSentences(text){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];
  try{
    if(typeof Intl!=='undefined'&&Intl.Segmenter){
      const seg=new Intl.Segmenter('tr',{granularity:'sentence'});
      const rows=[...seg.segment(clean)].map(x=>String(x.segment||'').trim()).filter(Boolean);
      if(rows.length)return rows;
    }
  }catch(_){}
  return clean.match(/.*?[.!?…]+(?=\s|$)|.+$/g)?.map(x=>x.trim()).filter(Boolean)||[clean];
}
function splitSpeechChunks(text,maxLen=220){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];

  const raw=speechSentences(clean);
  const out=[];
  for(const partRaw of raw){
    let part=String(partRaw||'').trim();
    while(part.length>maxLen){
      let cut=part.lastIndexOf(',',maxLen);
      if(cut<Math.floor(maxLen*0.55))cut=part.lastIndexOf(';',maxLen);
      if(cut<Math.floor(maxLen*0.55))cut=part.lastIndexOf(' ',maxLen);
      if(cut<Math.floor(maxLen*0.45))cut=maxLen;
      const chunk=part.slice(0,cut+((part[cut]===','||part[cut]===';')?1:0)).trim();
      if(chunk)out.push(chunk);
      part=part.slice(cut+((part[cut]===','||part[cut]===';')?1:0)).trim();
    }
    if(part)out.push(part);
  }
  return out.filter(Boolean).slice(0,8);
}
function prosodyPreview(text,tone='balanced'){
  const clean=prepareJarvisSpeechText(text,tone);
  const chunks=splitSpeechChunks(clean,220);
  return{
    ok:true,
    tone:String(tone||'balanced'),
    chunks:chunks.map((chunk,index)=>({
      text:chunk,
      profile:ttsProfileForChunk(tone,chunk,index,chunks.length),
      pauseMs:speechChunkPauseMs(chunk,index,chunks.length)
    }))
  };
}
function cacheableJarvisSpeech(text){
  const s=String(text||'').replace(/\s+/g,' ').trim();
  if(!s||s.length>180)return false;
  return /^(?:Buradayım|Dinliyorum|Buyurun|Söyleyin|Merhaba|Merhabalar|Sizi dinliyorum|Tamamlandı|YouTube açıldı|Google açıldı|GitHub açıldı|ChatGPT açıldı|Ses yükseltildi|Ses azaltıldı|Medya|JARVIS|Yerel AI|Sistem|Disk|Ağ|Pil|Bakıyorum|Bir bakalım|Hımm|Hemen inceliyorum|Bir saniye|Tamam, bakıyorum)/i.test(s);
}
function ttsCacheFile(text,profile){
  const key=crypto.createHash('sha1').update([
    TTS_VOICE,
    profile.rate,profile.pitch,profile.volume,
    String(text||'')
  ].join('|')).digest('hex');
  return path.join(TTS_CACHE_DIR,key+'.mp3');
}
function trimTtsCache(){
  try{
    fs.mkdirSync(TTS_CACHE_DIR,{recursive:true});
    const files=fs.readdirSync(TTS_CACHE_DIR)
      .filter(x=>x.endsWith('.mp3'))
      .map(name=>({name,file:path.join(TTS_CACHE_DIR,name),mtime:fs.statSync(path.join(TTS_CACHE_DIR,name)).mtimeMs}))
      .sort((a,b)=>b.mtime-a.mtime);
    for(const x of files.slice(80))try{fs.unlinkSync(x.file)}catch(_){}
  }catch(_){}
}
async function renderEdgeTtsChunk(text,profile,generation){
  if(generation!==ttsGeneration)return null;
  const cacheable=cacheableJarvisSpeech(text);
  let target='';
  if(cacheable){
    fs.mkdirSync(TTS_CACHE_DIR,{recursive:true});
    target=ttsCacheFile(text,profile);
    try{
      if(fs.existsSync(target)&&fs.statSync(target).size>512){
        try{fs.utimesSync(target,new Date(),new Date())}catch(_){}
        return{path:target,temporary:false,cached:true};
      }
    }catch(_){}
  }
  if(!target)target=path.join(os.tmpdir(),'jarvis-tts-chunk-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');

  try{
    await runHidden('py',[
      '-m','edge_tts',
      '--voice',TTS_VOICE,
      '--rate='+profile.rate,
      '--pitch='+profile.pitch,
      '--volume='+profile.volume,
      '--text',text,
      '--write-media',target
    ],45000);
    if(generation!==ttsGeneration){
      if(!cacheable)try{if(fs.existsSync(target))fs.unlinkSync(target)}catch(_){}
      return null;
    }
    if(!fs.existsSync(target)||fs.statSync(target).size<=512)throw new Error('empty edge tts chunk');
    if(cacheable)trimTtsCache();
    return{path:target,temporary:!cacheable,cached:false};
  }catch(e){
    if(!cacheable)try{if(fs.existsSync(target))fs.unlinkSync(target)}catch(_){}
    console.error('[JARVIS] EDGE TTS CHUNK FAILED:',e.message);
    return null;
  }
}
async function prewarmJarvisBackchannels(){
  const phrases=[...JARVIS_BACKCHANNEL_PHRASES,...JARVIS_WAKE_ACK_PHRASES];
  if(!TTS_ENABLED){
    ttsBackchannelPrewarmState={status:'disabled',count:0,total:phrases.length,error:null};
    return ttsBackchannelPrewarmState;
  }
  const generation=ttsGeneration;
  let count=0,lastError=null;
  ttsBackchannelPrewarmState={status:'warming',count:0,total:phrases.length,error:null};
  for(const phrase of phrases){
    if(generation!==ttsGeneration)break;
    try{
      const profile=ttsProfileForTone('balanced',phrase);
      const rendered=await renderEdgeTtsChunk(phrase,profile,generation);
      if(rendered&&rendered.path)count++;
    }catch(e){
      lastError=String(e.message||e).slice(0,180);
    }
  }
  ttsBackchannelPrewarmState={
    status:count>0?'ready':'fallback',
    count,
    total:phrases.length,
    error:lastError
  };
  console.log('[JARVIS] VOICE PREWARM: '+ttsBackchannelPrewarmState.status+' '+count+'/'+phrases.length);
  return ttsBackchannelPrewarmState;
}
function sapiRateForTone(tone='balanced'){
  const t=String(tone||'balanced').toLowerCase();
  if(t==='excited'||t==='playful')return 1;
  if(t==='casual'||t==='focused'||t==='work')return 0;
  if(t==='warm'||t==='serious')return -1;
  if(t==='gentle')return -2;
  return -1;
}
async function speakWindowsSapiFallback(text,tone='balanced',generation=ttsGeneration){
  if(process.platform!=='win32'||generation!==ttsGeneration)return false;
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,900);
  if(!clean)return false;
  const safe=clean.replace(/'/g,"''");
  const rate=sapiRateForTone(tone);
  const ps="Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate="+rate+"; $s.Volume=100; $s.Speak('"+safe+"'); $s.Dispose()";
  return new Promise((resolve,reject)=>{
    let settled=false;
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{
      windowsHide:true,stdio:'ignore'
    });
    activeTtsPlayback=p;
    const finish=(err)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(activeTtsPlayback===p)activeTtsPlayback=null;
      if(generation!==ttsGeneration)return resolve(false);
      if(err)return reject(err);
      resolve(true);
    };
    const timer=setTimeout(()=>{killChildTree(p);finish(new Error('SAPI TTS zaman aşımı'))},45000);
    p.on('error',finish);
    p.on('exit',code=>{
      if(generation!==ttsGeneration)return finish();
      code===0?finish():finish(new Error('SAPI TTS çıkış kodu '+code));
    });
  });
}
async function speakJarvisNow(text,tone='balanced',generation=ttsGeneration){
  if(!TTS_ENABLED||generation!==ttsGeneration)return;
  const clean=prepareJarvisSpeechText(text,tone);
  if(!clean)return;
  const chunks=splitSpeechChunks(clean,220);
  if(!chunks.length)return;
  const profiles=chunks.map((chunk,index)=>ttsProfileForChunk(tone,chunk,index,chunks.length));

  ttsSpeaking=true;
  ttsLastStartedAt=Date.now();
  ttsLastChunkCount=chunks.length;
  ttsCurrentChunk=0;
  activeSpeechText=clean;
  activeSpeechTone=String(tone||'balanced');
  activeSpeechChunks=chunks.slice();
  activeSpeechGeneration=generation;
  setTtsLock(true);

  let current=null;
  try{
    current=await renderEdgeTtsChunk(chunks[0],profiles[0],generation);
    for(let i=0;i<chunks.length;i++){
      if(generation!==ttsGeneration)break;
      ttsCurrentChunk=i+1;

      // Render the next chunk while the current chunk is playing. This hides
      // most Edge TTS network/render latency during natural speech.
      const nextPromise=(i+1<chunks.length)
        ? renderEdgeTtsChunk(chunks[i+1],profiles[i+1],generation)
        : null;

      if(current&&current.path){
        await playTtsMp3Cancelable(current.path,generation);
      }else{
        await speakWindowsSapiFallback(chunks[i],tone,generation);
      }

      if(current&&current.temporary){
        try{if(fs.existsSync(current.path))fs.unlinkSync(current.path)}catch(_){}
      }
      if(generation!==ttsGeneration)break;
      const pauseMs=speechChunkPauseMs(chunks[i],i,chunks.length);
      if(pauseMs)await new Promise(r=>setTimeout(r,pauseMs));
      if(generation!==ttsGeneration)break;
      current=nextPromise?await nextPromise:null;
    }
  }finally{
    if(current&&current.temporary){
      try{if(fs.existsSync(current.path))fs.unlinkSync(current.path)}catch(_){}
    }
    if(generation===ttsGeneration){
      await new Promise(r=>setTimeout(r,160));
      ttsSpeaking=false;
      ttsCurrentChunk=0;
      activeSpeechText='';
      activeSpeechTone='balanced';
      activeSpeechChunks=[];
      activeSpeechGeneration=0;
      ttsLastEndedAt=Date.now();
      setTtsLock(false);
    }
  }
}
async function renderJarvisMp3Base64(text,tone='balanced'){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=prepareJarvisSpeechText(text,tone).slice(0,700);
  if(!clean)throw new Error('text required');
  const profile=ttsProfileForTone(tone,clean);
  const mp3=path.join(os.tmpdir(),'jarvis-mobile-tts-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.mp3');
  try{
    await runHidden('py',[
      '-m','edge_tts',
      '--voice',TTS_VOICE,
      '--rate='+profile.rate,
      '--pitch='+profile.pitch,
      '--volume='+shiftTtsNumber(MOBILE_TTS_VOLUME,readVoicePreferences().volumeOffset,'%',0,80,true),
      '--text',clean,
      '--write-media',mp3
    ],45000);
    const buf=fs.readFileSync(mp3);
    if(!buf.length)throw new Error('empty tts audio');
    return buf.toString('base64');
  }finally{
    try{if(fs.existsSync(mp3))fs.unlinkSync(mp3)}catch(e){}
  }
}
function normalizeCreatorVoiceName(value){
  const voice=String(value||CREATOR_TTS_VOICE).trim().slice(0,96);
  if(!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice))throw new Error('Geçersiz Creator Neural voice: '+voice);
  return voice;
}
function normalizeCreatorTtsRate(value=CREATOR_TTS_RATE){
  const raw=String(value==null?CREATOR_TTS_RATE:value).trim();
  const m=raw.match(/^([+-]?)(\d{1,2})%$/);
  if(!m)throw new Error('Geçersiz Creator TTS rate: '+raw);
  const signed=Number((m[1]==='-'?'-':'')+m[2]);
  const bounded=Math.max(-30,Math.min(25,signed));
  return(bounded>=0?'+':'')+String(bounded)+'%';
}
function creatorTtsRateNumber(value=CREATOR_TTS_RATE){
  return Number(normalizeCreatorTtsRate(value).replace('%',''));
}
async function renderCreatorVoiceFile(text,name='creator-voice',voice=CREATOR_TTS_VOICE,rate=CREATOR_TTS_RATE){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,1600);
  if(!clean)throw new Error('text required');
  const selectedVoice=normalizeCreatorVoiceName(voice);
  const selectedRate=normalizeCreatorTtsRate(rate);
  const dir=path.join(WORKSPACE,'creator-audio');
  fs.mkdirSync(dir,{recursive:true});
  const safeName=String(name||'creator-voice').replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,80)||'creator-voice';
  const out=path.join(dir,safeName+(safeName.toLowerCase().endsWith('.mp3')?'':'.mp3'));
  try{if(fs.existsSync(out))fs.unlinkSync(out)}catch(_){}
  await runHidden('py',[
    '-m','edge_tts',
    '--voice',selectedVoice,
    '--rate='+selectedRate,
    '--pitch='+CREATOR_TTS_PITCH,
    '--volume='+CREATOR_TTS_VOLUME,
    '--text',clean,
    '--write-media',out
  ],60000);
  if(!fs.existsSync(out)||fs.statSync(out).size<512)throw new Error('creator audio render failed');
  return out;
}
function creatorAudioDurationSeconds(file){
  const status=getCreatorEngine().ffmpegStatus(WORKSPACE);
  if(!status.ffprobe)throw new Error('FFprobe long-form narration ölçümü için gerekli.');
  const out=childProcess.execFileSync(status.ffprobe,[
    '-v','error',
    '-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',
    file
  ],{encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:128*1024}).trim();
  const seconds=Number(out);
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Long-form narration duration ölçülemedi.');
  return seconds;
}
function splitCreatorNarrationChunks(text,maxChars=1350){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];
  const sentences=clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks=[];
  let current='';
  const pushWords=(sentence)=>{
    const words=String(sentence||'').split(/\s+/).filter(Boolean);
    let part='';
    for(const word of words){
      const candidate=part?part+' '+word:word;
      if(candidate.length>maxChars&&part){chunks.push(part);part=word}
      else part=candidate;
    }
    if(part)return part;
    return'';
  };
  for(const sentence of sentences.length?sentences:[clean]){
    if(sentence.length>maxChars){
      if(current){chunks.push(current);current=''}
      const part=pushWords(sentence);
      if(part)current=part;
      continue;
    }
    const candidate=current?current+' '+sentence:sentence;
    if(candidate.length>maxChars&&current){chunks.push(current);current=sentence}
    else current=candidate;
  }
  if(current)chunks.push(current);
  return chunks.filter(Boolean).slice(0,24);
}
async function renderCreatorLongformVoiceFile(text,name='creator-longform-voice',voice=CREATOR_TTS_VOICE){
  if(!TTS_ENABLED)throw new Error('local TTS disabled');
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,18000);
  if(!clean)throw new Error('text required');
  const selectedVoice=normalizeCreatorVoiceName(voice);
  const chunks=splitCreatorNarrationChunks(clean,1350);
  if(!chunks.length)throw new Error('long-form narration chunks missing');
  const dir=path.join(WORKSPACE,'creator-audio');
  fs.mkdirSync(dir,{recursive:true});
  const safeName=String(name||'creator-longform-voice').replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,70)||'creator-longform-voice';
  const out=path.join(dir,safeName+'.mp3');
  const status=getCreatorEngine().ffmpegStatus(WORKSPACE);
  if(!status.ffmpeg||!status.ffprobe)throw new Error('FFmpeg + FFprobe long-form narration fit için gerekli.');

  let rate=normalizeCreatorTtsRate(CREATOR_TTS_RATE);
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    const parts=[];
    try{
      for(let i=0;i<chunks.length;i++){
        const part=await renderCreatorVoiceFile(
          chunks[i],
          safeName+'-fit-'+attempt+'-part-'+String(i+1).padStart(2,'0'),
          selectedVoice,
          rate
        );
        parts.push(part);
      }
      try{if(fs.existsSync(out))fs.unlinkSync(out)}catch(_){}
      const args=['-y','-hide_banner','-loglevel','error'];
      for(const part of parts)args.push('-i',part);
      const labels=parts.map((_,i)=>'['+i+':a]').join('');
      args.push('-filter_complex',labels+'concat=n='+parts.length+':v=0:a=1[aout]','-map','[aout]','-c:a','libmp3lame','-b:a','160k',out);
      await runHidden(status.ffmpeg,args,20*60*1000);
      if(!fs.existsSync(out)||fs.statSync(out).size<4096)throw new Error('creator long-form audio render failed');

      const duration=creatorAudioDurationSeconds(out);
      last={path:out,duration:Number(duration.toFixed(3)),rate,attempts:attempt};
      if(duration>=570&&duration<=630)return last;

      const nextPercent=getCreatorEngine().fitNarrationRatePercent(duration,600,creatorTtsRateNumber(rate));
      const nextRate=normalizeCreatorTtsRate((nextPercent>=0?'+':'')+nextPercent+'%');
      if(nextRate===rate)break;
      rate=nextRate;
    }finally{
      for(const part of parts){try{if(part!==out&&fs.existsSync(part))fs.unlinkSync(part)}catch(_){}}
    }
  }

  if(last&&last.duration>=540&&last.duration<=660)return last;
  const e=new Error('Long-form anlatım süresi otomatik ayara rağmen 9-11 dakika aralığına getirilemedi: '+Number(last&&last.duration||0).toFixed(1)+' sn.');
  e.code='LONGFORM_VOICE_DURATION_FIT_FAILED';
  e.duration=Number(last&&last.duration||0);
  e.rate=String(last&&last.rate||rate);
  throw e;
}
function queueJarvisSpeech(text,tone='balanced'){
  if(!TTS_ENABLED)return;
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return;
  const now=Date.now();
  if(clean===lastQueuedSpeech && (now-lastQueuedSpeechAt)<15000){
    console.log('[JARVIS] TTS DUPLICATE SUPPRESSED');
    return;
  }
  lastQueuedSpeech=clean;
  lastQueuedSpeechAt=now;
  const generation=ttsGeneration;
  ttsPendingCount++;
  speechQueue=speechQueue
    .then(()=>generation===ttsGeneration?speakJarvisNow(clean,tone,generation):null)
    .catch(e=>console.error('[JARVIS] TTS:',e.message))
    .finally(()=>{ttsPendingCount=Math.max(0,ttsPendingCount-1)});
}

function showJarvisScreen(){
  if(process.platform!=='win32')return;
  const wakeUrl=BASE+'/?wake=clap&t='+Date.now();
  try{
    // Use the Windows default browser so Chrome, Edge, Opera GX, Brave,
    // Firefox, etc. all follow the same trusted-network wake flow.
    childProcess.spawn('cmd.exe',['/c','start','','"'+wakeUrl+'"'],{
      detached:true,windowsHide:true,stdio:'ignore'
    }).unref();
    console.log('[JARVIS] SCREEN: DEFAULT BROWSER OPEN');
  }catch(e){
    console.error('[JARVIS] SCREEN OPEN FAILED:',e.message);
  }
}

function isLocalSafeControlCommand(command){
  const c=String(command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  return /^(?:sistem durumu|system status|pc durumu|disk durumu|disk status|depolama durumu|ağ durumu|ag durumu|network status|internet durumu|pil durumu|batarya durumu|güç durumu|guc durumu|power status|sesi yükselt|sesi yukselt|ses yükselt|ses yukselt|sesi artır|sesi arttır|ses artır|volume up|sesi azalt|ses azalt|sesi kıs|sesi kis|ses kıs|ses kis|volume down|sessize al|sesi kapat|sesi sustur|mute|sesi aç|sesi ac|unmute|oynat|duraklat|devam ettir|oynat duraklat|play pause|play|pause|sonraki|sonraki şarkı|sonraki sarki|sonraki medya|next track|önceki|onceki|önceki şarkı|onceki sarki|previous track|medyayı durdur|medyayi durdur|stop media)$/i.test(c)
    || /^(?:dosyalarda ara|dosyalarda arat|workspace search)\s+.+$/i.test(c)
    || /^(?:aç|ac|open|uygulama aç|uygulama ac|program aç|program ac|site aç|site ac)\s+.+$/i.test(c)
    || /^.+?\s+(?:aç|ac)$/i.test(c)
    || /^(?:creator motor durumu|creator engine status|video motor durumu)$/i.test(c)
    || /^(?:creator motorunu hazırla|creator motorunu hazirla|creator engine hazırla|creator engine hazirla)$/i.test(c)
    || /^(?:shorts oluştur|shorts olustur|video oluştur|video olustur)(?:\s+[^:]+)?\s*:\s*[\s\S]+$/i.test(c)
    || /^(?:browser operatör durumu|browser operator durumu|browser operator status)$/i.test(c)
    || /^(?:browser profilini aç|browser profilini ac|browser operator aç|browser operator ac)$/i.test(c)
    || /^(?:youtube studio aç|youtube studio ac|shopify admin aç|shopify admin ac)$/i.test(c)
    || /^(?:browser sayfasını oku|browser sayfasini oku|browser sayfasını analiz et|browser sayfasini analiz et)$/i.test(c);
}
function speechLexiconKey(text){
  return String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9çğıöşü\s.-]/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,240);
}
function defaultSpeechLexicon(){
  return{version:1,updatedAt:null,aliases:{},hotwords:[],history:[]};
}
function readSpeechLexicon(){
  try{
    if(!fs.existsSync(SPEECH_LEXICON_FILE))return defaultSpeechLexicon();
    const x=JSON.parse(fs.readFileSync(SPEECH_LEXICON_FILE,'utf8'));
    const aliases=x&&x.aliases&&typeof x.aliases==='object'&&!Array.isArray(x.aliases)?x.aliases:{};
    return{
      version:1,
      updatedAt:x.updatedAt||null,
      aliases,
      hotwords:Array.isArray(x.hotwords)?x.hotwords.filter(Boolean).slice(-160):[],
      history:Array.isArray(x.history)?x.history.slice(-120):[]
    };
  }catch(_){return defaultSpeechLexicon()}
}
function writeSpeechLexicon(data){
  const clean={
    version:1,
    updatedAt:new Date().toISOString(),
    aliases:data&&data.aliases&&typeof data.aliases==='object'?data.aliases:{},
    hotwords:Array.isArray(data&&data.hotwords)?[...new Set(data.hotwords.map(x=>String(x||'').trim()).filter(Boolean))].slice(-160):[],
    history:Array.isArray(data&&data.history)?data.history.slice(-120):[]
  };
  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  fs.writeFileSync(SPEECH_LEXICON_FILE,JSON.stringify(clean,null,2),'utf8');
  return clean;
}
function learnSpeechAlias(heard,intended,source='voice-correction'){
  const from=speechLexiconKey(heard);
  const target=String(intended||'').replace(/\s+/g,' ').trim().slice(0,240);
  if(!from||from.length<2||!target)return{ok:false,error:'heard and intended required'};
  if(from===speechLexiconKey(target))return{ok:false,error:'correction is identical'};
  const x=readSpeechLexicon();
  x.aliases[from]=target;
  const targetWords=target.split(/\s+/).filter(y=>y.length>=3);
  x.hotwords=[...new Set([...(x.hotwords||[]),target,...targetWords])].slice(-160);
  x.history=[...(x.history||[]),{
    at:new Date().toISOString(),action:'learn',heard:from,intended:target,source:String(source||'voice-correction').slice(0,80)
  }].slice(-120);
  const saved=writeSpeechLexicon(x);
  remember({kind:'speech_lexicon_learn',heard:from,intended:target,source:String(source||'voice-correction').slice(0,80)});
  return{ok:true,heard:from,intended:target,count:Object.keys(saved.aliases).length};
}
function forgetSpeechAlias(heard){
  const key=speechLexiconKey(heard);
  const x=readSpeechLexicon();
  if(!Object.prototype.hasOwnProperty.call(x.aliases,key))return{ok:false,error:'alias not found',heard:key};
  const intended=x.aliases[key];
  delete x.aliases[key];
  x.history=[...(x.history||[]),{
    at:new Date().toISOString(),action:'forget',heard:key,intended
  }].slice(-120);
  const saved=writeSpeechLexicon(x);
  remember({kind:'speech_lexicon_forget',heard:key,intended});
  return{ok:true,heard:key,intended,count:Object.keys(saved.aliases).length};
}
function applySpeechLexicon(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const key=speechLexiconKey(raw);
  if(!key)return raw;
  const x=readSpeechLexicon();
  if(x.aliases[key])return String(x.aliases[key]);
  const entries=Object.entries(x.aliases||{}).sort((a,b)=>b[0].length-a[0].length);
  let normalized=key;
  for(const [from,to] of entries){
    if(from.length<4)continue;
    const escaped=from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('(^|\\s)'+escaped+'(?=\\s|$)','i');
    if(re.test(normalized)){
      normalized=normalized.replace(re,(m,prefix)=>prefix+String(to).toLocaleLowerCase('tr-TR'));
      break;
    }
  }
  return normalized===key?raw:normalized;
}
function handleSpeechLexiconDirective(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const plain=raw.replace(/[?.!,;:]+$/g,'').trim();
  let m=plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:dediğimde|dedigimde|dersem)\s+(.{2,120}?)\s+(?:anla|olarak anla|diye anla)$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:demek|demek istiyorum|demek istedim)\s+(.{2,120})$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s*=\s*(.{2,120})$/i)
    || plain.match(/^(?:jarvis\s+)?(.{2,80}?)\s+(?:ifadesini|kelimesini)?\s*(.{2,120}?)\s+(?:olarak düzelt|olarak duzelt|olarak anla)$/i);
  if(m){
    const learned=learnSpeechAlias(m[1],m[2],'explicit-teach');
    return learned.ok
      ?{handled:true,type:'chat',reply:'Tamam. "'+m[1].trim()+'" duyduğumda "'+m[2].trim()+'" olarak anlayacağım.',command:null,commands:[],tone:'warm'}
      :{handled:true,type:'chat',reply:'Bu düzeltmeyi kaydedemedim: '+learned.error,command:null,commands:[],tone:'warm'};
  }
  m=plain.match(/^(?:jarvis\s+)?(.{2,100}?)\s+(?:düzeltmesini|duyma düzeltmesini)\s+unut$/i);
  if(m){
    const forgotten=forgetSpeechAlias(m[1]);
    return{handled:true,type:'chat',reply:forgotten.ok?'Tamam, o ses düzeltmesini unuttum.':'Bu ifadeyle eşleşen bir ses düzeltmesi bulamadım.',command:null,commands:[],tone:'warm'};
  }
  if(/^(?:jarvis\s+)?(?:ses|konuşma|konusma)\s+düzeltmelerini\s+(?:göster|soyle|söyle)$/i.test(plain)){
    const x=readSpeechLexicon();
    const entries=Object.entries(x.aliases||{}).slice(-12);
    const reply=entries.length
      ?'Öğrendiğim son ses düzeltmeleri: '+entries.map(([a,b])=>'"'+a+'" → "'+b+'"').join(' · ')
      :'Henüz öğrendiğim özel bir ses düzeltmesi yok.';
    return{handled:true,type:'chat',reply,command:null,commands:[],tone:'focused'};
  }
  return{handled:false};
}
function brainPersona(){
  const defaults={
    version:2,
    name:'JARVIS',
    relationship:'Cihan Bey ile uzun süre çalışan kişisel yapay zeka asistanı',
    warmth:0.82,
    humor:0.68,
    directness:0.84,
    playfulness:0.62,
    verbosity:0.42,
    style:[
      'doğal Türkçe',
      'gerektiğinde kısa ve zeki espri',
      'lafı uzatmadan sohbeti taşı',
      'aynı kalıp açılışları tekrar etme',
      'emir eri gibi değil, akıllı bir yol arkadaşı gibi konuş',
      'kullanıcının enerjisine uyum sağla ama yapmacık olma'
    ]
  };
  try{
    if(fs.existsSync(LOCAL_BRAIN_PERSONA_FILE)){
      const x=JSON.parse(fs.readFileSync(LOCAL_BRAIN_PERSONA_FILE,'utf8'));
      return{...defaults,...x,style:Array.isArray(x.style)?x.style:defaults.style};
    }
  }catch(_){}
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(LOCAL_BRAIN_PERSONA_FILE,JSON.stringify(defaults,null,2),'utf8');
  }catch(_){}
  return defaults;
}
function saveBrainPersona(p){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(LOCAL_BRAIN_PERSONA_FILE,JSON.stringify(p,null,2),'utf8');
  }catch(_){}
}
function clamp01(x){return Math.max(0,Math.min(1,Number(x)||0))}
function updateBrainPersonaFromUserText(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  const p=brainPersona();
  let changed=false;
  const bump=(k,d)=>{const n=clamp01(Number(p[k]||0)+d);if(n!==p[k]){p[k]=n;changed=true}};

  if(/daha (?:eğlenceli|eglenceli|komik|şakacı|sakaci)|gırgır|girgir|şamata|samimi konuş|rahat konuş/.test(s)){bump('humor',0.14);bump('playfulness',0.14);bump('warmth',0.06)}
  if(/daha ciddi|şaka yapma|saka yapma|ciddi konuş/.test(s)){bump('humor',-0.22);bump('playfulness',-0.20);bump('directness',0.08)}
  if(/kısa konuş|kisa konus|uzatma|kısa cevap/.test(s)){bump('verbosity',-0.18);bump('directness',0.08)}
  if(/detaylı anlat|detayli anlat|uzun anlat|ayrıntılı anlat|ayrintili anlat/.test(s)){bump('verbosity',0.18)}
  if(/daha net|direkt konuş|direkt konus|lafı dolandırma|lafi dolandirma/.test(s)){bump('directness',0.12)}
  if(/daha sıcak|daha sicak|daha samimi/.test(s)){bump('warmth',0.12)}

  if(changed){
    p.updatedAt=new Date().toISOString();
    p.version=Math.max(2,Number(p.version)||2);
    saveBrainPersona(p);
    remember({kind:'brain_persona_adjusted',warmth:p.warmth,humor:p.humor,directness:p.directness,playfulness:p.playfulness,verbosity:p.verbosity});
  }
  return p;
}
function brainTokens(text){
  return [...new Set(String(text||'').toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü\s]/gi,' ')
    .split(/\s+/)
    .filter(x=>x.length>=3&&!['bir','bu','şu','icin','için','gibi','ama','daha','sonra','olan','olarak'].includes(x))
  )];
}
function brainSimilarity(query,candidate){
  const q=brainTokens(query),c=new Set(brainTokens(candidate));
  if(!q.length||!c.size)return 0;
  let hit=0;
  for(const t of q)if(c.has(t))hit++;
  return hit/Math.sqrt(q.length*c.size);
}
function readBrainFacts(limit=80){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_FACTS_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_FACTS_FILE,'utf8').split('\n').filter(Boolean)
      .slice(-limit).map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(Boolean);
  }catch(_){return []}
}
function appendBrainFact(text,kind='explicit_preference'){
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,500);
  if(!clean)return;
  const prior=readBrainFacts(120);
  if(prior.some(x=>String(x.text||'').toLocaleLowerCase('tr-TR')===clean.toLocaleLowerCase('tr-TR')))return;
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_FACTS_FILE,JSON.stringify({at:new Date().toISOString(),kind,text:clean})+'\n','utf8');
  }catch(_){}
}
function rewriteBrainFacts(rows){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    const data=(rows||[]).map(x=>JSON.stringify(x)).join('\n');
    fs.writeFileSync(LOCAL_BRAIN_FACTS_FILE,data+(data?'\n':''),'utf8');
    return true;
  }catch(_){return false}
}
function removeBrainFactsMatching(query){
  const q=String(query||'').replace(/\s+/g,' ').trim();
  if(!q)return 0;
  const rows=readBrainFacts(200);
  const kept=[],removed=[];
  for(const x of rows){
    const text=String(x.text||'');
    const same=text.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'))
      || q.toLocaleLowerCase('tr-TR').includes(text.toLocaleLowerCase('tr-TR'))
      || brainSimilarity(q,text)>=0.48;
    (same?removed:kept).push(x);
  }
  if(removed.length)rewriteBrainFacts(kept);
  return removed.length;
}
function handleBrainMemoryDirective(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const plain=raw.replace(/[?.!,;:]+$/g,'').trim();
  let m=plain.match(/^(?:jarvis\s+)?(?:şunu|sunu|bunu)?\s*(?:hatırla|hatirla|aklında tut|aklinda tut)\s*[:,-]?\s*(.+)$/i);
  if(m&&m[1]){
    appendBrainFact(m[1].trim(),'explicit_memory');
    return{handled:true,reply:'Tamam. Bunu yerel hafızama aldım.',command:null,type:'chat'};
  }
  m=plain.match(/^(?:jarvis\s+)?(?:şunu|sunu|bunu)?\s*(?:unut|unut gitsin)\s*[:,-]?\s*(.+)$/i);
  if(m&&m[1]){
    const n=removeBrainFactsMatching(m[1].trim());
    return{handled:true,reply:n?('Tamam, '+n+' hafıza kaydını çıkardım.'):'Bu ifadeyle eşleşen kalıcı bir hafıza kaydı bulamadım.',command:null,type:'chat'};
  }
  if(/^(?:jarvis\s+)?(?:benimle ilgili )?(?:ne hatırlıyorsun|ne hatirliyorsun|neleri hatırlıyorsun|neleri hatirliyorsun)$/i.test(plain)){
    const facts=readBrainFacts(12).slice(-8);
    if(!facts.length)return{handled:true,reply:'Kalıcı yerel hafızamda henüz açık bir tercih kaydı yok.',command:null,type:'chat'};
    const summary=facts.map(x=>String(x.text||'')).filter(Boolean).join(' · ');
    return{handled:true,reply:'Şu an aklımda kalanlar: '+summary.slice(0,850),command:null,type:'chat'};
  }
  return{handled:false};
}
function maybeRememberExplicitPreference(text){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean||clean.length>500)return;
  if(/\b(?:seviyorum|sevmiyorum|istemiyorum|istiyorum|tercih ediyorum|tercihim|bundan sonra|unutma|hatırla|aklında tut|böyle konuş|şöyle konuş)\b/i.test(clean)){
    appendBrainFact(clean,'explicit_preference');
  }
}
function isContextRecallQuery(query){
  const s=String(query||'').toLocaleLowerCase('tr-TR').replace(/[?.!,;:]+/g,' ').replace(/\s+/g,' ').trim();
  return /^(?:devam et|devam|oradan devam et|kaldığımız yerden devam et|kaldigimiz yerden devam et|nerede kalmıştık|nerede kalmistik|ne yapıyorduk|ne yapiyorduk|ne yapacaktık|ne yapacaktik|az önceki|az onceki|önceki konu|onceki konu|ona devam et|onu yap|onu aç|onu ac|ikincisi|ikincisini yap)$/i.test(s)
    || /\b(?:az önce|az once|bir önceki|bir onceki|kaldığımız yer|kaldigimiz yer|devam edelim)\b/i.test(s);
}
function isConversationRepairQuery(query){
  const s=String(query||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[?.!,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!s)return false;
  return /\b(?:beni yanlış anladın|beni yanlis anladin|yanlış anladın|yanlis anladin|ne alaka|öyle demedim|oyle demedim|onu demedim|ben onu demedim|ben onu sormadım|ben onu sormadim|öyle demek istemedim|oyle demek istemedim|demek istediğim bu değildi|demek istedigim bu degildi|yanlış cevap verdin|yanlis cevap verdin|başka bir şey demiştim|baska bir sey demistim)\b/i.test(s);
}
function conversationRepairContext(query,recent=[]){
  if(!isConversationRepairQuery(query))return'';
  const rows=Array.isArray(recent)?recent:[];
  let previousUser='',previousAssistant='';
  for(let i=rows.length-1;i>=0;i--){
    const role=String(rows[i]&&rows[i].role||'');
    const content=String(rows[i]&&rows[i].content||'').replace(/\s+/g,' ').trim();
    if(!content)continue;
    if(!previousAssistant&&role==='assistant'){previousAssistant=content;continue}
    if(!previousUser&&role==='user'){previousUser=content}
    if(previousUser&&previousAssistant)break;
  }
  const parts=[
    'KONUŞMA ONARIM MODU: Kullanıcı önceki cevabın yanlış anlaşıldığını söylüyor.',
    'Savunmaya geçme ve önceki hatalı yorumu tekrarlama.',
    'Kullanıcının düzeltmesini önceki kullanıcı mesajıyla birlikte yorumla.',
    'Tek bir makul yorum varsa doğrudan düzeltilmiş cevap ver; gerçekten iki veya daha fazla makul yorum varsa yalnızca bir kısa netleştirme sorusu sor.'
  ];
  if(previousUser)parts.push('Önceki kullanıcı mesajı: '+previousUser);
  if(previousAssistant)parts.push('Önceki JARVIS cevabı: '+previousAssistant);
  parts.push('Şimdiki düzeltme: '+String(query||'').replace(/\s+/g,' ').trim());
  return parts.join(' ');
}
function recentEpisodeContext(limit=3){
  return readBrainEpisodes(120).slice(-limit).reverse().map((ep,i)=>{
    const packed=[
      ep.summary,
      ...(Array.isArray(ep.decisions)?ep.decisions:[]),
      ...(Array.isArray(ep.unresolved)?ep.unresolved:[]),
      ...(Array.isArray(ep.topics)?ep.topics:[])
    ].filter(Boolean).join(' · ');
    return{score:1.40-(i*0.10),text:String(ep.summary||packed),role:'episode',packed};
  }).filter(x=>x.text);
}
function relevantBrainMemory(query,limit=5){
  const rows=[];
  try{
    if(fs.existsSync(LOCAL_BRAIN_HISTORY_FILE)){
      const all=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean).slice(-160)
        .map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
      all.forEach((x,i)=>{
        const score=brainSimilarity(query,x.content)+(i/Math.max(1,all.length))*0.08;
        if(score>0.12)rows.push({score,text:String(x.content||''),role:x.role||'unknown'});
      });
    }
  }catch(_){}
  for(const f of readBrainFacts()){
    const score=brainSimilarity(query,f.text)+0.18;
    if(score>0.18)rows.push({score,text:String(f.text||''),role:'memory'});
  }
  for(const ep of readBrainEpisodes(120)){
    const packed=[
      ep.summary,
      ...(Array.isArray(ep.topics)?ep.topics:[]),
      ...(Array.isArray(ep.decisions)?ep.decisions:[]),
      ...(Array.isArray(ep.preferences)?ep.preferences:[]),
      ...(Array.isArray(ep.unresolved)?ep.unresolved:[])
    ].filter(Boolean).join(' · ');
    const score=brainSimilarity(query,packed)+0.10;
    if(score>0.16)rows.push({score,text:String(ep.summary||packed),role:'episode'});
  }
  if(isContextRecallQuery(query)){
    for(const r of recentEpisodeContext(3)){
      rows.push({score:r.score,text:r.text,role:'episode'});
    }
  }
  rows.sort((a,b)=>b.score-a.score);
  const seen=new Set(),out=[];
  for(const r of rows){
    const key=r.role+'|'+r.text.toLocaleLowerCase('tr-TR');
    if(seen.has(key))continue;
    seen.add(key);out.push(r);
    if(out.length>=limit)break;
  }
  return out;
}
function recentBrainHistory(limit=6){
  const all=readLocalBrainHistory(Math.max(limit,6));
  return all.slice(-limit);
}
function inferBrainTurnStyle(text,persona){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  let mode='balanced',temperature=0.68;
  let instruction='Doğal ve akıcı konuş.';
  if(/\b(?:acil|hemen|hızlı|hizli|uzatma|direkt)\b/.test(s)){
    mode='focused';temperature=0.38;instruction='Bu tur hızlı ve net ol; espriyi minimumda tut.';
  }else if(/\b(?:ahah|haha|hehe|gırgır|girgir|şaka|saka|komik|eğlen|eglen)\b/.test(s)||/[😂🤣😄😅]/u.test(s)){
    mode='playful';temperature=0.82;instruction='Bu tur biraz daha oyunbaz ve esprili ol; yine de cevabı işe yarar tut.';
  }else if(/\b(?:canım sıkkın|canim sikkin|moralim bozuk|keyfim yok|yoruldum)\b/.test(s)){
    mode='warm';temperature=0.62;instruction='Bu tur sıcak ve anlayışlı ol; klişe teselli cümleleri kurma, doğal konuş.';
  }else if(/\b(?:iş|is|kod|hata|debug|proje|deploy|rapor|analiz)\b/.test(s)){
    mode='work';temperature=0.48;instruction='Bu tur çözüm odaklı ve teknik olarak net ol; gereksiz şamata yapma.';
  }else if(/^(?:naber|ne haber|napıyorsun|napion|nasılsın|nasilsin|selam|merhaba)\b/.test(s)){
    mode='casual';temperature=0.78;instruction='Gündelik sohbet tonu kullan; kısa, samimi ve hafif eğlenceli cevap ver.';
  }
  const humor=Number(persona&&persona.humor||0.68);
  if(mode==='balanced')temperature=Math.max(0.48,Math.min(0.82,0.56+humor*0.18));
  return{mode,temperature,instruction};
}
function userTurnWordCount(text){
  return String(text||'').replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]+/g,' ').trim().split(/\s+/).filter(Boolean).length;
}
function recentUserTurnLengths(recent=[],limit=4){
  const rows=Array.isArray(recent)?recent:[];
  const out=[];
  for(let i=rows.length-1;i>=0&&out.length<limit;i--){
    if(String(rows[i]&&rows[i].role||'')!=='user')continue;
    const n=userTurnWordCount(rows[i].content);
    if(n>0)out.push(n);
  }
  return out;
}
function inferConversationCadence(text,recent=[],persona=brainPersona()){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const s=raw.toLocaleLowerCase('tr-TR');
  const currentWords=userTurnWordCount(raw);
  const previous=recentUserTurnLengths(recent,4);
  const averageRecent=previous.length
    ?previous.reduce((a,b)=>a+b,0)/previous.length
    :currentWords;
  const explicitShort=/\b(?:kısa cevap|kisa cevap|uzatma|tek cümle|tek cumle|özet geç|ozet gec|kısaca|kisaca)\b/.test(s);
  const explicitDetailed=/\b(?:detaylı anlat|detayli anlat|kapsamlı anlat|kapsamli anlat|uzun anlat|ayrıntılı anlat|ayrintili anlat|derinlemesine)\b/.test(s);
  const workLike=shouldDeepReflect(raw)||/\b(?:kod|debug|deploy|rapor|analiz|strateji|dosya|sistem|proje)\b/.test(s);

  let mode='normal';
  if(explicitDetailed)mode='detailed';
  else if(explicitShort)mode='compact';
  else if(!workLike&&currentWords<=5&&averageRecent<=12)mode='compact';
  else if(!workLike&&currentWords<=14&&averageRecent<=18)mode='short';
  else if(currentWords>=45||averageRecent>=48)mode='detailed';

  if(workLike&&mode==='compact'&&!explicitShort)mode='normal';
  if(workLike&&mode==='short'&&shouldDeepReflect(raw))mode='detailed';

  const targets={
    compact:{targetWords:30,structuredPredict:190,streamPredict:110,agentPredict:220,instruction:'Kullanıcı kısa konuşuyor. Cevabı doğal biçimde kısa tut; gereksiz giriş ve açıklama ekleme.'},
    short:{targetWords:55,structuredPredict:220,streamPredict:170,agentPredict:240,instruction:'Kısa ve akıcı cevap ver; ana noktayı bir-iki kısa paragrafta bırak.'},
    normal:{targetWords:95,structuredPredict:280,streamPredict:260,agentPredict:280,instruction:'Doğal uzunlukta cevap ver; ne aşırı kısa ne gereksiz uzun ol.'},
    detailed:{targetWords:170,structuredPredict:380,streamPredict:420,agentPredict:420,instruction:'Kullanıcı ayrıntı istiyor veya uzun bağlam veriyor. Yapıyı koruyarak daha kapsamlı cevap ver.'}
  };
  const x=targets[mode]||targets.normal;
  const personaVerbosity=Math.max(0,Math.min(1,Number(persona&&persona.verbosity||0.42)));
  const adjustedTarget=Math.max(24,Math.round(x.targetWords*(0.82+personaVerbosity*0.38)));
  return{
    mode,
    currentWords,
    averageRecent:Number(averageRecent.toFixed(1)),
    targetWords:adjustedTarget,
    structuredPredict:x.structuredPredict,
    streamPredict:x.streamPredict,
    agentPredict:x.agentPredict,
    instruction:x.instruction,
    explicit:explicitShort||explicitDetailed
  };
}
function conversationCadencePrompt(cadence){
  const c=cadence||{};
  return[
    'KONUŞMA RİTMİ: '+String(c.mode||'normal')+'.',
    String(c.instruction||'Doğal uzunlukta cevap ver.'),
    'Yaklaşık hedef '+String(c.targetWords||95)+' kelime; bu sert bir kota değil, konuşmanın doğallığını koruyan bir ritim hedefidir.',
    'Kullanıcının mesajı kısa diye bilgi eksiltme; yalnızca gereksiz uzatmayı kes.'
  ].join(' ');
}

function dialogueFeedbackDefaults(){
  return{
    version:1,
    followupBias:0,
    banterBias:0,
    variationBias:0,
    positiveCount:0,
    negativeCount:0,
    updatedAt:null,
    last:null
  };
}
function clampBias(x){
  return Math.max(-1,Math.min(1,Number(x)||0));
}
function readDialogueFeedback(){
  const d=dialogueFeedbackDefaults();
  try{
    if(!fs.existsSync(DIALOGUE_FEEDBACK_FILE))return d;
    const x=JSON.parse(fs.readFileSync(DIALOGUE_FEEDBACK_FILE,'utf8'));
    return{
      ...d,
      ...x,
      followupBias:clampBias(x.followupBias),
      banterBias:clampBias(x.banterBias),
      variationBias:clampBias(x.variationBias),
      positiveCount:Math.max(0,Number(x.positiveCount)||0),
      negativeCount:Math.max(0,Number(x.negativeCount)||0)
    };
  }catch(_){return d}
}
function writeDialogueFeedback(next){
  const x={
    ...dialogueFeedbackDefaults(),
    ...next,
    followupBias:clampBias(next&&next.followupBias),
    banterBias:clampBias(next&&next.banterBias),
    variationBias:clampBias(next&&next.variationBias),
    updatedAt:new Date().toISOString()
  };
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.writeFileSync(DIALOGUE_FEEDBACK_FILE,JSON.stringify(x,null,2),'utf8');
  }catch(_){}
  return x;
}
function dialogueFeedbackIntent(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  if(!raw||raw.length>180)return null;
  const s=raw.toLocaleLowerCase('tr-TR').replace(/[!?.,;:]+/g,' ').replace(/\s+/g,' ').trim();

  const padded=' '+s+' ';
  const hasAny=phrases=>phrases.some(p=>padded.includes(' '+p+' '));
  if(hasAny(['çok soru soruyorsun','cok soru soruyorsun','bu kadar soru sorma','her seferinde soru sorma','soru sorma','takip sorusu sorma'])){
    return{kind:'followup-less',followup:-0.30,negative:true,reply:'Tamam. Takip sorularını azaltıyorum; gerektiğinde doğrudan cevabı bırakacağım.'};
  }
  if(hasAny(['bana daha çok soru sor','bana daha cok soru sor','biraz daha soru sor','sohbeti soru sorarak devam ettir','takip sorusu sorabilirsin'])){
    return{kind:'followup-more',followup:0.22,positive:true,reply:'Tamam. Sohbet uygunsa arada tek kısa takip sorusuyla devam ettireceğim.'};
  }
  if(hasAny(['gırgırı artır','girgiri artir','şakayı artır','sakayi artir','daha komik ol','biraz daha gırgır','biraz daha girgir'])){
    return{kind:'banter-more',banter:0.22,positive:true,reply:'Tamam, gırgırı bir tık yükseltiyorum; her cümleyi de stand-up gösterisine çevirmiyorum.'};
  }
  if(hasAny(['gırgırı azalt','girgiri azalt','şakayı azalt','sakayi azalt','çok şaka yapıyorsun','cok saka yapiyorsun','daha ciddi konuş','daha ciddi konus'])){
    return{kind:'banter-less',banter:-0.28,negative:true,reply:'Tamam. Şakayı geri çekiyorum; doğal ama daha ciddi kalacağım.'};
  }
  if(hasAny(['aynı giriş','ayni giris','aynı şeyleri söylüyorsun','ayni seyleri soyluyorsun','kendini tekrar etme','hep aynı konuşuyorsun','hep ayni konusuyorsun','robot gibi konuşuyorsun','robot gibi konusuyorsun'])){
    return{kind:'variation-more',variation:0.30,negative:true,reply:'Aldım. Aynı girişleri ve kalıp cümleleri tekrarlamayı daha agresif biçimde keseceğim.'};
  }
  if(/^(?:işte bu|iste bu|aynen böyle|aynen boyle|tam istediğim gibi|tam istedigim gibi|böyle iyi|boyle iyi|şimdi oldu|simdi oldu|bu cevap iyi)$/i.test(s)){
    return{kind:'positive-generic',positive:true,reply:'Aynen. Bu çizgiyi koruyorum.'};
  }
  return null;
}
function applyDialogueFeedback(text){
  const intent=dialogueFeedbackIntent(text);
  if(!intent)return{handled:false,preferences:readDialogueFeedback()};
  const x=readDialogueFeedback();
  if(intent.followup)x.followupBias=clampBias(x.followupBias+intent.followup);
  if(intent.banter)x.banterBias=clampBias(x.banterBias+intent.banter);
  if(intent.variation)x.variationBias=clampBias(x.variationBias+intent.variation);
  if(intent.positive)x.positiveCount=(Number(x.positiveCount)||0)+1;
  if(intent.negative)x.negativeCount=(Number(x.negativeCount)||0)+1;
  x.last={at:new Date().toISOString(),kind:intent.kind,text:String(text||'').slice(0,180)};
  const saved=writeDialogueFeedback(x);
  remember({
    kind:'dialogue_feedback',
    feedback:intent.kind,
    followupBias:saved.followupBias,
    banterBias:saved.banterBias,
    variationBias:saved.variationBias
  });
  return{
    handled:true,
    type:'chat',
    reply:intent.reply,
    command:null,
    commands:[],
    tone:intent.negative?'focused':'warm',
    model:'local-dialogue-feedback',
    preferences:saved
  };
}
function dialogueFeedbackPrompt(feedback){
  const f=feedback||dialogueFeedbackDefaults();
  return[
    'ÖĞRENİLMİŞ SOHBET TERCİHLERİ:',
    'takip sorusu eğilimi '+Number(f.followupBias||0).toFixed(2)+',',
    'gırgır eğilimi '+Number(f.banterBias||0).toFixed(2)+',',
    'çeşitlilik hassasiyeti '+Number(f.variationBias||0).toFixed(2)+'.',
    'Bu değerleri doğal biçimde uygula; kullanıcıdan açık geri bildirim gelmedikçe daha fazla çıkarım yapma.'
  ].join(' ');
}
function assistantOpeningSignature(text){
  return String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşüı\s]/gi,' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,4)
    .join(' ');
}
function recentAssistantOpeners(recent=[],limit=5){
  const rows=Array.isArray(recent)?recent:[];
  const out=[];
  for(let i=rows.length-1;i>=0;i--){
    if(String(rows[i]&&rows[i].role||'')!=='assistant')continue;
    const opener=assistantOpeningSignature(rows[i].content);
    if(!opener||out.includes(opener))continue;
    out.push(opener);
    if(out.length>=limit)break;
  }
  return out;
}
function conversationSocialSignals(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  const s=raw.toLocaleLowerCase('tr-TR');
  return{
    raw,s,
    repair:isConversationRepairQuery(raw),
    work:shouldDeepReflect(raw)||/\b(?:kod|hata|debug|deploy|proje|rapor|analiz|iş|is|dosya|ayar|sistem)\b/.test(s),
    playful:/\b(?:ahah|haha|hehe|gırgır|girgir|şaka|saka|komik|dalga|şamata|samimi)\b/.test(s)||/[😂🤣😄😅]/u.test(raw),
    story:/\b(?:başıma|basima|bak ne oldu|şunu anlatayım|sunu anlatayim|bir şey oldu|bir sey oldu|az önce şöyle|az once soyle)\b/.test(s)
      || /\b(?:bugün|bugun|dün|dun)\b.{0,80}\b(?:oldu|yaşadım|yasadim|başladı|basladi|gördüm|gordum)\b/.test(s),
    celebrate:/\b(?:başardım|basardim|çalıştı|calisti|süper|super|harika|mükemmel|mukemmel|satış geldi|satis geldi|kazandım|kazandim|çözüldü|cozuldu|halletti|hallettik)\b/.test(s),
    vent:/\b(?:sinir oldum|canımı sıktı|canimi sikti|saçma|sacma|yoruldum|bıktım|biktim|delireceğim|delirecegim)\b/.test(s),
    opinion:/\b(?:sence|ne dersin|fikrin ne|ne düşünüyorsun|ne dusunuyorsun|sen olsan|nasıl sence|nasil sence)\b/.test(s),
    greeting:/^(?:selam|merhaba|naber|ne haber|nasılsın|nasilsin|napıyorsun|napion)\b/.test(s),
    reset:/\b(?:neyse|konuyu değiştir|konuyu degistir|başka konu|baska konu|onu geç|onu gec)\b/.test(s)
  };
}
function socialModeFromSignals(x){
  if(!x)return'natural';
  if(x.repair)return'repair';
  if(x.work)return'work';
  if(x.celebrate)return'celebrate';
  if(x.vent)return'vent';
  if(x.playful)return'banter';
  if(x.story)return'story';
  if(x.opinion)return'opinion';
  if(x.greeting)return'casual';
  return'natural';
}
function isEllipticalSocialContinuation(text){
  const s=String(text||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[!?.,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!s||s.length>54)return false;
  return /^(?:aynen|aynen öyle|aynen oyle|evet|evet ya|hı hı|hmm|hımm|heh|hah|işte|iste|tamam|tamamdır|tamamdir|hadi|hadi bakalım|hadi bakalim|devam|devam et|oradan devam|peki|peki ya|e sonra|ee sonra|sonra|olur|doğru|dogru|tam olarak|işte bu|iste bu|bakalım|bakalim|eee|ee|yani)(?:\s+.*)?$/i.test(s);
}
function recentSocialMomentum(recent=[]){
  const rows=Array.isArray(recent)?recent:[];
  let userTurns=0;
  for(let i=rows.length-1;i>=0&&userTurns<4;i--){
    if(String(rows[i]&&rows[i].role||'')!=='user')continue;
    userTurns++;
    const sig=conversationSocialSignals(rows[i].content);
    if(sig.reset)return{mode:'natural',strength:0,source:null};
    const mode=socialModeFromSignals(sig);
    if(mode==='natural'||mode==='repair')continue;
    const strength=Math.max(0.25,1-(userTurns-1)*0.22);
    return{mode,strength:Number(strength.toFixed(2)),source:String(rows[i].content||'').slice(0,180)};
  }
  return{mode:'natural',strength:0,source:null};
}
function socialMomentumInstruction(mode){
  if(mode==='work')return'Önceki turdaki iş odağını koru; kısa devam ifadesini yeni konu sanma.';
  if(mode==='banter')return'Önceki turdaki hafif gırgır enerjisini koru; yeni şaka icat etmek için zorlama.';
  if(mode==='story')return'Kullanıcının anlattığı hikâyenin içinde kal; kısa devam ifadesini hikâyenin devamı olarak yorumla.';
  if(mode==='vent')return'Önceki turdaki rahatsızlık tonunu unutmuş gibi davranma; kısa ve doğal kal.';
  if(mode==='celebrate')return'Önceki turdaki olumlu enerjiyi bir tur daha doğal biçimde taşı.';
  if(mode==='opinion')return'Önceki değerlendirme bağlamını koru; kısa devam ifadesini aynı görüş alışverişinin parçası say.';
  if(mode==='casual')return'Gündelik sohbet ritmini koru.';
  return'Doğal karşılık ver; gereksiz rol yapma.';
}
function inferConversationSocialPolicy(text,recent=[],persona=brainPersona()){
  const signals=conversationSocialSignals(text);
  const raw=signals.raw;
  const s=signals.s;
  const {repair,work,playful,story,celebrate,vent,opinion,greeting}=signals;
  const learnedFeedback=readDialogueFeedback();
  const openers=recentAssistantOpeners(recent,Math.abs(learnedFeedback.variationBias)>=0.25?7:5);

  let mode='natural';
  let instruction='Doğal karşılık ver; gereksiz rol yapma.';
  if(repair){
    mode='repair';
    instruction='Önceki yanlış anlamayı savunmadan düzelt. Kısa ol ve düzeltilmiş anlama geç.';
  }else if(work){
    mode='work';
    instruction='İşe odaklan; sosyal tonu koru ama şamata ve gereksiz takip sorusu ekleme.';
  }else if(celebrate){
    mode='celebrate';
    instruction='Kullanıcının sevincini kısa ve doğal biçimde karşıla; abartılı tezahürat yapma.';
  }else if(vent){
    mode='vent';
    instruction='Kısa bir insanî karşılık ver, klişe teselliye kaçma; ardından konuşmanın özüne geç.';
  }else if(playful){
    mode='banter';
    instruction='Enerjiyi karşıla; kısa ve zeki gırgır serbest ama cevabın faydasını bozma.';
  }else if(story){
    mode='story';
    instruction='Bir hikâye dinliyormuş gibi tepki ver; hemen problem çözme moduna atlama.';
  }else if(opinion){
    mode='opinion';
    instruction='Net bir görüş veya değerlendirme ver; gereksiz tarafsız kalıp cümleleri kurma.';
  }else if(greeting){
    mode='casual';
    instruction='Gündelik, kısa ve rahat konuş; sohbeti doğal biçimde açık bırak.';
  }

  const explicitMode=mode!=='natural'&&mode!=='casual';
  const momentum=recentSocialMomentum(recent);
  const canCarry=!signals.reset&&!repair&&!explicitMode&&isEllipticalSocialContinuation(raw)&&momentum.mode!=='natural';
  if(canCarry){
    mode=momentum.mode;
    instruction=socialMomentumInstruction(momentum.mode);
  }

  const directQuestion=/[?？]\s*$/.test(raw)||/^(?:ne|neden|niye|nasıl|nasil|kaç|kac|kim|hangi|nerede|ne zaman)\b/i.test(s);
  let followupAllowed=!repair&&!work&&(story||playful||greeting||opinion||(!directQuestion&&raw.length>24));
  if(learnedFeedback.followupBias<=-0.20)followupAllowed=false;
  if(learnedFeedback.followupBias>=0.25&&!repair&&!work&&!directQuestion)followupAllowed=true;
  const learnedBanter=learnedFeedback.banterBias>=0.30&&!repair&&!work&&(greeting||story||(!directQuestion&&raw.length<150));
  if(learnedBanter&&(mode==='natural'||mode==='casual')){
    mode='banter';
    instruction='Kullanıcının öğrendiğin sohbet tercihine göre hafif gırgır ekle; zorlama şaka yapma.';
  }
  const maxFollowups=followupAllowed?1:0;
  const callbackAllowed=!work&&!repair&&Number(persona&&persona.warmth||0.8)>=0.6;

  return{
    mode,
    instruction,
    followupAllowed,
    maxFollowups,
    callbackAllowed,
    momentumCarried:canCarry,
    momentumMode:canCarry?momentum.mode:null,
    momentumStrength:canCarry?momentum.strength:0,
    momentumSource:canCarry?momentum.source:null,
    avoidOpeners:openers,
    learnedFeedback
  };
}
function socialPolicyPrompt(policy){
  const p=policy||{};
  const parts=[
    'SOSYAL DİYALOG MODU: '+String(p.mode||'natural')+'.',
    String(p.instruction||'Doğal karşılık ver.'),
    p.followupAllowed
      ?'Sohbet doğal biçimde devam ediyorsa en fazla bir kısa takip sorusu sorabilirsin; her cevabı soruyla bitirme.'
      :'Bu turda takip sorusu ekleme; önce kullanıcının istediğini tamamla.',
    p.callbackAllowed
      ?'Yerel hafızadaki ilgili bir eski ayrıntıya yalnızca gerçekten doğalysa bir kez gönderme yapabilirsin; zorlama callback yapma.'
      :'Eski konuşmaya sırf samimi görünmek için gönderme yapma.'
  ];
  if(p.momentumCarried&&p.momentumMode){
    parts.push('SOSYAL MOMENTUM: '+String(p.momentumMode)+' modu önceki kullanıcı turundan doğal devam olarak taşındı. Yeni mesaj bununla çelişirse önce yeni mesajı esas al.');
  }
  if(Array.isArray(p.avoidOpeners)&&p.avoidOpeners.length){
    parts.push('Son JARVIS açılışlarını tekrar etme: '+p.avoidOpeners.join(' | ')+'.');
  }
  parts.push('Aynı ünlem, aynı giriş cümlesi ve aynı kapanışı art arda kullanma. İnsan gibi ritim değiştir.');
  parts.push(dialogueFeedbackPrompt(p.learnedFeedback));
  return parts.join(' ');
}
function shouldDeepReflect(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR');
  return /\b(?:kapsamlı|kapsamli|derin düşün|derin dusun|detaylı düşün|detayli dusun|analiz et|karşılaştır|karsilastir|artıları ve eksileri|artilari ve eksileri|strateji|nedenlerini incele|mantığını incele|mantigini incele)\b/.test(s);
}
function brainResponseLooksWeak(reply,previous=[]){
  const s=String(reply||'').trim();
  if(s.length<2||s.length>900)return true;
  if(/^(?:buradayım cihan bey[.!]?|size nasıl yardımcı olabilirim[?]?|elbette[.!]?|tabii ki[.!]?)$/i.test(s))return true;
  if((s.match(/Cihan Bey/gi)||[]).length>1)return true;

  const assistant=previous.filter(x=>x.role==='assistant').slice(-5).map(x=>String(x.content||'').trim());
  if(assistant.map(x=>x.toLocaleLowerCase('tr-TR')).includes(s.toLocaleLowerCase('tr-TR')))return true;

  const opener=x=>x.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşüı\s]/gi,' ').split(/\s+/).filter(Boolean).slice(0,3).join(' ');
  const currentOpener=opener(s);
  if(currentOpener&&assistant.filter(x=>opener(x)===currentOpener).length>=2)return true;

  if(/^(?:elbette|tabii ki|memnuniyetle|harika bir soru)[,!.\s]/i.test(s)&&assistant.some(x=>/^(?:elbette|tabii ki|memnuniyetle|harika bir soru)[,!.\s]/i.test(x)))return true;
  return false;
}
function normalizeBrainReply(reply){
  let s=String(reply||'').replace(/\s+/g,' ').trim();
  s=s.replace(/^(?:Elbette|Tabii ki|Tabii),?\s+Cihan Bey[,.]?\s*/i,'');
  if(s.length>900)s=s.slice(0,897)+'...';
  return s||'Buradayım.';
}
function readBrainEpisodes(limit=80){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_EPISODES_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_EPISODES_FILE,'utf8').split('\n').filter(Boolean)
      .slice(-limit).map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(Boolean);
  }catch(_){return []}
}
function appendBrainEpisode(episode){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_EPISODES_FILE,JSON.stringify({
      at:new Date().toISOString(),...episode
    })+'\n','utf8');
    const lines=fs.readFileSync(LOCAL_BRAIN_EPISODES_FILE,'utf8').split('\n').filter(Boolean);
    if(lines.length>240)fs.writeFileSync(LOCAL_BRAIN_EPISODES_FILE,lines.slice(-180).join('\n')+'\n','utf8');
  }catch(_){}
}
async function summarizeBrainEpisodeIfNeeded(){
  if(episodeSummaryRunning)return false;
  let rows=[];
  try{
    if(!fs.existsSync(LOCAL_BRAIN_HISTORY_FILE))return false;
    rows=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean)
      .map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
  }catch(_){return false}
  if(rows.length<72)return false;

  const status=await localBrainStatus();
  if(!status.ready||!status.installed)return false;

  episodeSummaryRunning=true;
  try{
    const chunk=rows.slice(0,28);
    const transcript=chunk.map(x=>(x.role==='user'?'Kullanıcı':'JARVIS')+': '+String(x.content||'')).join('\n').slice(0,9000);
    const schema={
      type:'object',
      properties:{
        summary:{type:'string'},
        topics:{type:'array',items:{type:'string'}},
        decisions:{type:'array',items:{type:'string'}},
        preferences:{type:'array',items:{type:'string'}},
        unresolved:{type:'array',items:{type:'string'}}
      },
      required:['summary','topics','decisions','preferences','unresolved'],
      additionalProperties:false
    };
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.15,top_p:0.8,num_ctx:LOCAL_BRAIN_CTX,num_predict:260},
        messages:[
          {role:'system',content:'Aşağıdaki sohbet bölümünü gelecekte bağlamı korumak için Türkçe ve kısa biçimde özetle. Yalnızca açıkça söylenen bilgileri koru; hassas kişisel özellikler hakkında çıkarım yapma. Kararlar, tercihler ve açık kalan işleri ayrı alanlarda tut.'},
          {role:'user',content:transcript}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.summary)throw new Error('EPISODE_BAD_JSON');

    appendBrainEpisode({
      summary:String(parsed.summary).replace(/\s+/g,' ').trim().slice(0,1600),
      topics:Array.isArray(parsed.topics)?parsed.topics.slice(0,12):[],
      decisions:Array.isArray(parsed.decisions)?parsed.decisions.slice(0,12):[],
      preferences:Array.isArray(parsed.preferences)?parsed.preferences.slice(0,12):[],
      unresolved:Array.isArray(parsed.unresolved)?parsed.unresolved.slice(0,12):[],
      sourceMessages:chunk.length,
      model:LOCAL_BRAIN_MODEL
    });

    const remaining=rows.slice(28);
    fs.writeFileSync(LOCAL_BRAIN_HISTORY_FILE,remaining.map(x=>JSON.stringify(x)).join('\n')+(remaining.length?'\n':''),'utf8');
    remember({kind:'brain_episode_compacted',messages:chunk.length,remaining:remaining.length,model:LOCAL_BRAIN_MODEL});
    return true;
  }catch(e){
    remember({kind:'brain_episode_error',error:String(e.message||e).slice(0,220)});
    return false;
  }finally{
    episodeSummaryRunning=false;
  }
}
function queueBrainEpisodeSummary(){
  if(episodeSummaryRunning)return;
  setTimeout(()=>summarizeBrainEpisodeIfNeeded().catch(()=>{}),60);
}
function readLocalBrainHistory(limit=10){
  try{
    if(!fs.existsSync(LOCAL_BRAIN_HISTORY_FILE))return [];
    return fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8')
      .split('\n').filter(Boolean).slice(-Math.max(2,limit*2))
      .map(x=>{try{return JSON.parse(x)}catch(_){return null}})
      .filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string');
  }catch(_){return []}
}
function appendLocalBrainHistory(role,content){
  try{
    fs.mkdirSync(MEMORY_DIR,{recursive:true});
    fs.appendFileSync(LOCAL_BRAIN_HISTORY_FILE,JSON.stringify({
      at:new Date().toISOString(),role,content:String(content||'').slice(0,1600)
    })+'\n','utf8');
    const lines=fs.readFileSync(LOCAL_BRAIN_HISTORY_FILE,'utf8').split('\n').filter(Boolean);
    if(lines.length>180)fs.writeFileSync(LOCAL_BRAIN_HISTORY_FILE,lines.slice(-140).join('\n')+'\n','utf8');
    if(role==='assistant')queueBrainEpisodeSummary();
  }catch(_){}
}
function localModelBillions(name){
  const s=String(name||'').toLowerCase();
  const m=s.match(/:(\d+(?:\.\d+)?)b(?:\b|[-_])/i);
  if(m)return Number(m[1]);
  const m2=s.match(/(\d+(?:\.\d+)?)b(?:\b|[-_])/i);
  return m2?Number(m2[1]):0;
}
function chooseInstalledDeepModel(models,ramGb,fastModel){
  const list=(Array.isArray(models)?models:[]).map(x=>String(x||'')).filter(Boolean);
  const maxB=ramGb>=30?14:ramGb>=22?8:ramGb>=14?4:ramGb>=7?2:1;
  const candidates=list
    .filter(x=>/^qwen3\.5(?::|$)/i.test(x))
    .map(name=>({name,b:localModelBillions(name)}))
    .filter(x=>x.b>0&&x.b<=maxB)
    .sort((a,b)=>b.b-a.b);
  return candidates.length?candidates[0].name:fastModel;
}
async function localBrainStatus(){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),1800);
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/tags',{signal:ctl.signal});
    clearTimeout(timer);
    if(!r.ok)return{ready:false,model:LOCAL_BRAIN_MODEL,error:'HTTP '+r.status};
    const j=await r.json().catch(()=>({}));
    const models=(j.models||[]).map(x=>String(x.name||x.model||''));
    const has=m=>models.some(x=>x===m||x.startsWith(m+':'));

    if(!process.env.JARVIS_LOCAL_BRAIN_MODEL){
      const ramGb=os.totalmem()/1073741824;
      const candidates=ramGb>=14?['qwen3.5:4b','qwen3.5:2b','qwen3.5:0.8b','qwen3:4b','qwen3:1.7b','qwen3:0.6b']
        :ramGb>=7?['qwen3.5:2b','qwen3.5:0.8b','qwen3:1.7b','qwen3:0.6b']
        :['qwen3.5:0.8b','qwen3:0.6b','qwen3.5:2b','qwen3:1.7b'];
      const found=candidates.find(has);
      if(found)LOCAL_BRAIN_MODEL=found;
    }

    const installed=has(LOCAL_BRAIN_MODEL);
    const ramGb=os.totalmem()/1073741824;
    if(LOCAL_BRAIN_DEEP_MODEL_REQUESTED){
      LOCAL_BRAIN_DEEP_MODEL=has(LOCAL_BRAIN_DEEP_MODEL_REQUESTED)
        ?LOCAL_BRAIN_DEEP_MODEL_REQUESTED
        :LOCAL_BRAIN_MODEL;
    }else{
      LOCAL_BRAIN_DEEP_MODEL=chooseInstalledDeepModel(models,ramGb,LOCAL_BRAIN_MODEL);
    }
    const deepInstalled=has(LOCAL_BRAIN_DEEP_MODEL);
    return{
      ready:true,
      installed,
      model:LOCAL_BRAIN_MODEL,
      fastModel:LOCAL_BRAIN_MODEL,
      deepModel:LOCAL_BRAIN_DEEP_MODEL,
      deepInstalled,
      deepRequestedModel:LOCAL_BRAIN_DEEP_MODEL_REQUESTED||null,
      adaptiveModelRouter:true,
      models:models.slice(0,12),
      ramGb:Number(ramGb.toFixed(1)),
      vision:/^qwen3\.5(?::|$)/i.test(LOCAL_BRAIN_MODEL)
    };
  }catch(e){
    clearTimeout(timer);
    return{ready:false,installed:false,model:LOCAL_BRAIN_MODEL,error:String(e.message||e)};
  }
}
async function warmLocalBrain(){
  if(brainWarmState.status==='warming')return brainWarmState;
  brainWarmState={status:'warming',model:LOCAL_BRAIN_MODEL,startedAt:new Date().toISOString(),readyAt:null,latencyMs:null,error:null};
  const started=Date.now();
  try{
    const status=await localBrainStatus();
    if(!status.ready)throw new Error(status.error||'OLLAMA_OFFLINE');
    if(!status.installed)throw new Error('MODEL_NOT_INSTALLED');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0,num_ctx:1024,num_predict:2},
        messages:[
          {role:'system',content:'Bu yalnızca yerel model ısınma testidir. Kısa cevap ver.'},
          {role:'user',content:'OK'}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    brainWarmState={
      status:'ready',
      model:LOCAL_BRAIN_MODEL,
      startedAt:brainWarmState.startedAt,
      readyAt:new Date().toISOString(),
      latencyMs:Date.now()-started,
      error:null
    };
    console.log('[JARVIS] LOCAL BRAIN WARM: '+LOCAL_BRAIN_MODEL+' · '+brainWarmState.latencyMs+'ms');
  }catch(e){
    brainWarmState={
      status:'error',
      model:LOCAL_BRAIN_MODEL,
      startedAt:brainWarmState.startedAt,
      readyAt:null,
      latencyMs:Date.now()-started,
      error:String(e.message||e).slice(0,220)
    };
    console.error('[JARVIS] LOCAL BRAIN WARMUP:',brainWarmState.error);
  }
  return brainWarmState;
}
function extractLocalBrainJson(text){
  const raw=String(text||'').trim();
  try{return JSON.parse(raw)}catch(_){}
  const m=raw.match(/\{[\s\S]*\}/);
  if(m)try{return JSON.parse(m[0])}catch(_){}
  return null;
}
async function callLocalBrain(message){
  const originalText=String(message||'').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!originalText)return{ok:true,type:'chat',reply:'Sizi dinliyorum Cihan Bey.',command:null};

  const lexiconDirective=handleSpeechLexiconDirective(originalText);
  if(lexiconDirective.handled){
    appendLocalBrainHistory('user',originalText);
    appendLocalBrainHistory('assistant',lexiconDirective.reply);
    return{ok:true,...lexiconDirective,model:'local-speech-lexicon',memoryHits:0,personaVersion:brainPersona().version};
  }

  const text=applySpeechLexicon(originalText);

  const interruptedSpeechResume=deterministicInterruptedSpeechResume(text);
  if(interruptedSpeechResume){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',interruptedSpeechResume.reply);
    return{ok:true,...interruptedSpeechResume,memoryHits:0,personaVersion:brainPersona().version};
  }
  const interruptionContext=interruptedStreamResumeContext(text);
  if(!interruptionContext)clearInterruptedStateForNewTurn(text);

  const dialogueFeedbackDirective=applyDialogueFeedback(text);
  if(dialogueFeedbackDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',dialogueFeedbackDirective.reply);
    return{ok:true,...dialogueFeedbackDirective,memoryHits:0,personaVersion:brainPersona().version};
  }

  const voicePreferenceDirective=handleVoicePreferenceDirective(text);
  if(voicePreferenceDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',voicePreferenceDirective.reply);
    return{ok:true,...voicePreferenceDirective,memoryHits:0,personaVersion:brainPersona().version};
  }

  const memoryDirective=handleBrainMemoryDirective(text);
  if(memoryDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',memoryDirective.reply);
    return{ok:true,...memoryDirective,commands:[],model:'local-memory',memoryHits:0,personaVersion:brainPersona().version,tone:'warm'};
  }

  maybeRememberExplicitPreference(text);
  const adjustedPersona=updateBrainPersonaFromUserText(text);

  const status=await localBrainStatus();
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};

  // Keep enough short-term dialogue turns for natural references such as
  // "az önce", "onu", "ikincisi" even after several tool/command turns.
  const recent=recentBrainHistory(12);
  const memory=relevantBrainMemory(text,6);
  const workspaceCtx=workspaceBrainContext(text,3);
  const persona=adjustedPersona||brainPersona();
  const turnStyle=inferBrainTurnStyle(text,persona);
  const socialPolicy=inferConversationSocialPolicy(text,recent,persona);
  const cadence=inferConversationCadence(text,recent,persona);
  const deepRequested=shouldDeepReflect(text);
  const availableDeepModel=(status.deepInstalled&&status.deepModel)?status.deepModel:LOCAL_BRAIN_MODEL;
  const deepModel=deepRequested?availableDeepModel:LOCAL_BRAIN_MODEL;
  const repairContext=conversationRepairContext(text,recent);
  const memoryText=memory.length
    ? memory.map(x=>'- '+(x.role==='memory'?'Hatırlanan tercih':x.role==='episode'?'Eski sohbet özeti':'Önceki konuşma')+': '+x.text).join('\n')
    : '- İlgili eski kayıt yok.';

  const system=[
    'Sen JARVIS\'sin; Cihan Bey\'in uzun süreli kişisel yapay zeka asistanısın.',
    'Önceliklerin: doğru anlama, doğal sohbet, güvenli eylem, bağlamı koruma ve sonuç odaklılık.',
    'Türkçe konuş. İnsan gibi ritimli, sıcak, zeki ve rahat konuş; robotik kalıp cümlelerden kaçın.',
    'Gerçek bir insan sohbetindeki gibi bağlama göre bazen kısa karşılık, bazen espri, bazen doğrudan çözüm ver. Her turu aynı kalıpla açma.',
    'Kullanıcı bir şey anlatıyorsa hemen komuta dönüştürmeye çalışma; sohbeti sohbet olarak sürdürebil.',
    'Uygun olduğunda kısa gırgır, ince espri veya karşılık ver. Her cümlede şaka yapma.',
    'Kullanıcı şakalaşıyorsa enerjiyi karşıla; ciddi iş veriyorsa hızla ciddileş.',
    'Cihan Bey hitabını ara sıra kullan; her cevapta tekrarlama.',
    'Kısa soruya kısa cevap ver. Sohbet uzarsa doğal biçimde devam ettir.',
    'Önceki konuşmadaki zamirleri ve eksik ifadeleri bağlamdan çözmeye çalış.',
    'Kullanıcı sadece "devam et", "nerede kalmıştık", "onu yap", "az önceki" gibi bir bağlam ifadesi kullanırsa son konuşma ve Eski sohbet özeti kayıtlarını özellikle kullan. Tek makul referans varsa tekrar sorma; birden fazla makul referans varsa tek kısa netleştirme sorusu sor.',
    'Bilmediğin şeyi uydurma. Gerçek PC eylemi yapılmadıysa yapıldı deme.',
    'Bir bilgisayar eylemi isteniyorsa yalnızca desteklenen güvenli komutlardan birine normalize et.',
    'Kullanıcı aynı cümlede iki veya daha fazla güvenli eylem isterse type=plan kullan ve commands alanına en fazla dört komutu doğru sırayla koy.',
    'Tek eylem için type=command kullan; command alanına tek standart komut yaz ve commands boş dizi olsun.',
    'Sohbet için type=chat kullan; command null ve commands boş dizi olsun.',
    'Desteklenen güvenli komutlar: sistem durumu, disk durumu, ağ durumu, pil durumu, sesi yükselt, sesi azalt, sessize al, oynat, duraklat, sonraki, önceki, medyayı durdur, youtube aç, google aç, github aç, chatgpt aç, opera gx aç, chrome aç, edge aç, not defteri aç, hesap makinesi aç, dosya gezgini aç, görev yöneticisi aç, ayarlar aç, ses ayarları aç, bluetooth ayarları aç, wifi ayarları aç, çalışma alanı aç, dosyalarda ara <arama ifadesi>, creator motor durumu, creator motorunu hazırla, shorts oluştur <ad>: <anlatım metni>, browser operatör durumu, browser profilini aç, youtube studio aç, shopify admin aç, browser sayfasını oku.',
    'Güvenli katalog dışındaki eylemleri type=chat olarak ele al; açık ve kısa biçimde henüz bağlı olmadığını söyle.',
    'Belirsizse tek kısa soru sor. Gereksiz teyit isteme.',
    'Kullanıcının açık tercihlerini hatırla ancak hassas özellikler hakkında çıkarım yapma.',
    'Yerel ses sözlüğü daha önce yanlış duyulan ifadeleri düzeltebilir. Düzeltilmiş kullanıcı metnini esas al; eski yanlış biçimi geri üretmeye çalışma.',
    'Kişilik ayarları: sıcaklık '+persona.warmth+', mizah '+persona.humor+', doğrudanlık '+persona.directness+', oyunbazlık '+persona.playfulness+'.',
    'Bu tur konuşma modu: '+turnStyle.mode+'. '+turnStyle.instruction,
    socialPolicyPrompt(socialPolicy),
    conversationCadencePrompt(cadence),
    interruptionContext||'Bu turda devam ettirilecek kesilmiş bir JARVIS cevabı yok.',
    repairContext||'Bu tur için özel bir konuşma onarım talebi yok.',
    'tone alanı seslendirme duygusudur. balanced/casual/playful/warm/focused/work/serious/excited/gentle seçeneklerinden cevabın anlamına en uygun olanı seç.',
    'İlgili yerel hafıza:\n'+memoryText,
    workspaceCtx.context
      ?('Yerel çalışma alanından ilgili bağlam aşağıdadır. Yalnızca gerçekten ilgili olduğunda kullan; kaynakta olmayan bilgiyi uydurma.\n'+workspaceCtx.context)
      :'Yerel çalışma alanından bu istek için ek bağlam yok.',
    'SADECE verilen JSON şemasına uygun cevap üret.'
  ].join(' ');

  const schema={
    type:'object',
    properties:{
      type:{type:'string',enum:['chat','command','plan']},
      reply:{type:'string'},
      command:{anyOf:[{type:'string'},{type:'null'}]},
      commands:{type:'array',items:{type:'string'},maxItems:4},
      tone:{type:'string',enum:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']}
    },
    required:['type','reply','command','commands','tone'],
    additionalProperties:false
  };

  const makeBody=(repairNote='')=>({
    model:LOCAL_BRAIN_MODEL,
    stream:false,
    think:false,
    format:schema,
    keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
    options:{
      temperature:repairNote?0.25:turnStyle.temperature,
      top_p:0.9,
      repeat_penalty:1.10,
      num_ctx:LOCAL_BRAIN_CTX,
      num_predict:cadence.structuredPredict
    },
    messages:[
      {role:'system',content:system+(repairNote?' DÜZELTME: '+repairNote:'')},
      ...recent.map(x=>({role:x.role,content:x.content})),
      {role:'user',content:text}
    ]
  });

  const ask=async(body)=>{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
    try{
      const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body),
        signal:ctl.signal
      });
      clearTimeout(timer);
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
      return extractLocalBrainJson(j&&j.message&&j.message.content);
    }finally{clearTimeout(timer)}
  };

  try{
    let parsed=await ask(makeBody());
    if(!parsed)parsed=await ask(makeBody('Önceki çıktı geçerli JSON değildi. Şemaya eksiksiz uy.'));

    if(!parsed)throw new Error('LOCAL_BRAIN_BAD_JSON');

    let type=parsed.type==='plan'?'plan':parsed.type==='command'?'command':'chat';
    let reply=normalizeBrainReply(parsed.reply);
    let command=parsed.command==null?null:String(parsed.command).trim();
    let commands=Array.isArray(parsed.commands)?parsed.commands.map(x=>String(x||'').trim()).filter(Boolean).slice(0,4):[];
    const allowedTones=new Set(['balanced','casual','playful','warm','focused','work','serious','excited','gentle']);
    let tone=allowedTones.has(String(parsed.tone||''))?String(parsed.tone):turnStyle.mode;

    if(type==='command'){
      commands=[];
      if(!isLocalSafeControlCommand(command)){
        type='chat';command=null;
        reply='Ne demek istediğinizi anladım; fakat bu eylem henüz güvenli yerel araç listeme bağlı değil.';
      }
    }
    if(type==='plan'){
      command=null;
      if(commands.length<2||commands.some(x=>!isLocalSafeControlCommand(x))){
        type='chat';commands=[];
        reply='İsteğinizde birden fazla adım var ama bazı adımlar henüz güvenli yerel araç listemde değil. Desteklediğim kısmı netleştirirseniz uygulayabilirim.';
      }
    }

    let qualityEscalated=false;
    let qualityEscalationReason=null;
    let qualityEscalationModel=null;
    const weakReply=type==='chat'&&brainResponseLooksWeak(reply,recent);
    const canEscalateQuality=type==='chat'
      && !deepRequested
      && status.deepInstalled===true
      && availableDeepModel
      && availableDeepModel!==LOCAL_BRAIN_MODEL
      && (weakReply||!!repairContext);

    if(canEscalateQuality){
      const qualitySchema={
        type:'object',
        properties:{
          reply:{type:'string'},
          tone:{type:'string',enum:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']}
        },
        required:['reply','tone'],
        additionalProperties:false
      };
      const qualityStarted=Date.now();
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
      try{
        const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            model:availableDeepModel,
            stream:false,
            think:false,
            format:qualitySchema,
            keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
            options:{
              temperature:repairContext?0.38:0.46,
              top_p:0.90,
              repeat_penalty:1.10,
              num_ctx:LOCAL_BRAIN_CTX,
              num_predict:Math.max(180,Math.round(160+Number(persona.verbosity||0.42)*220))
            },
            messages:[
              {role:'system',content:[
                'Sen JARVIS yanıt kalite denetleyicisisin.',
                'Bu bir otomatik kalite yükseltme turudur; kullanıcı bunu ayrıca istemek zorunda değildir.',
                'Kullanıcı mesajını, kısa konuşma bağlamını ve ilk taslağı kullanarak daha doğru, doğal ve insan gibi tek bir nihai cevap üret.',
                repairContext?'Önceki yanlış anlamayı özellikle düzelt; savunmaya geçme.':'Kalıp, tekrarlı veya cansız ifadeleri düzelt.',
                'Yeni somut bilgi uydurma. Bilmediğin şeyi biliyormuş gibi yazma.',
                'Gizli düşünme sürecini açıklama. SADECE verilen JSON şemasına uy.'
              ].join(' ')},
              ...recent.slice(-6).map(x=>({role:x.role,content:x.content})),
              {role:'user',content:'ŞİMDİKİ İSTEK: '+text+'\nİLK TASLAK: '+reply}
            ]
          }),
          signal:ctl.signal
        });
        clearTimeout(timer);
        const j=await r.json().catch(()=>({}));
        if(r.ok){
          const upgraded=extractLocalBrainJson(j&&j.message&&j.message.content);
          if(upgraded&&upgraded.reply){
            reply=normalizeBrainReply(upgraded.reply);
            if(allowedTones.has(String(upgraded.tone||'')))tone=String(upgraded.tone);
            qualityEscalated=true;
            qualityEscalationReason=repairContext?'conversation-repair':'weak-response';
            qualityEscalationModel=availableDeepModel;
            remember({
              kind:'auto_quality_escalation',
              reason:qualityEscalationReason,
              model:availableDeepModel,
              fastModel:LOCAL_BRAIN_MODEL,
              latencyMs:Date.now()-qualityStarted
            });
          }
        }
      }catch(e){
        clearTimeout(timer);
        remember({kind:'auto_quality_escalation_error',error:String(e.message||e).slice(0,180),model:availableDeepModel});
      }
    }else if(weakReply){
      const repaired=await ask(makeBody('Yanıt fazla kalıp, tekrarlı veya cansız. Aynı anlamı daha doğal, insan gibi ve kısa biçimde yeniden yaz.'));
      if(repaired&&repaired.reply){
        reply=normalizeBrainReply(repaired.reply);
        if(allowedTones.has(String(repaired.tone||'')))tone=String(repaired.tone);
      }
    }

    if(type==='chat'&&deepRequested){
      const deepSchema={
        type:'object',
        properties:{
          reply:{type:'string'},
          tone:{type:'string',enum:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']}
        },
        required:['reply','tone'],
        additionalProperties:false
      };
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
      const deepStarted=Date.now();
      try{
        const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            model:deepModel,
            stream:false,
            think:true,
            format:deepSchema,
            keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
            options:{temperature:0.34,top_p:0.88,repeat_penalty:1.10,num_ctx:LOCAL_BRAIN_CTX,num_predict:Math.max(220,Math.round(180+Number(persona.verbosity||0.42)*260))},
            messages:[
              {role:'system',content:[
                'Sen JARVIS yanıt kalite denetleyicisisin.',
                'Aşağıdaki taslak cevabı kullanıcının isteğine göre bir kez iyileştir.',
                'Mantıksal tutarlılığı artır, gereksiz tekrarları çıkar, doğrudan sonuca git.',
                'Yerel kaynak bağlamı verilmişse ona sadık kal. Kaynakta veya konuşmada olmayan somut bilgi uydurma.',
                'Gizli düşünme sürecini anlatma; yalnızca geliştirilmiş nihai cevabı döndür.',
                'SADECE JSON şemasına uy.'
              ].join(' ')},
              {role:'user',content:'İSTEK: '+text+'\nTASLAK: '+reply+'\nYEREL BAĞLAM:\n'+(workspaceCtx.context||'(yok)')}
            ]
          }),
          signal:ctl.signal
        });
        clearTimeout(timer);
        const j=await r.json().catch(()=>({}));
        if(r.ok){
          const refined=extractLocalBrainJson(j&&j.message&&j.message.content);
          if(refined&&refined.reply){
            reply=normalizeBrainReply(refined.reply);
            if(allowedTones.has(String(refined.tone||'')))tone=String(refined.tone);
            remember({kind:'deep_reflection',model:deepModel,fastModel:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-deepStarted,workspaceSources:workspaceCtx.sources,thinking:true,context:LOCAL_BRAIN_CTX});
          }
        }
      }catch(e){
        clearTimeout(timer);
        remember({kind:'deep_reflection_error',error:String(e.message||e).slice(0,180)});
      }
    }

    appendLocalBrainHistory('user',text);
    if(type==='chat')appendLocalBrainHistory('assistant',reply);
    if(interruptionContext)clearInterruptedConversationState('stream-resumed-by-brain');
    remember({
      kind:'local_brain_v2',
      type,command:command||null,commands,model:LOCAL_BRAIN_MODEL,
      memoryHits:memory.length,mode:turnStyle.mode,contextRecall:isContextRecallQuery(text),conversationRepair:!!repairContext,
      workspaceSources:workspaceCtx.sources,deepReflected:deepRequested&&type==='chat',
      qualityEscalated,qualityEscalationReason,qualityEscalationModel
    });
    return{
      ok:true,type,reply,command,commands,model:LOCAL_BRAIN_MODEL,
      memoryHits:memory.length,personaVersion:persona.version,tone,
      workspaceSources:workspaceCtx.sources,deepReflected:deepRequested&&type==='chat',deepModel:deepRequested?deepModel:null,
      qualityEscalated,qualityEscalationReason,qualityEscalationModel,
      repairMode:!!repairContext,socialMode:socialPolicy.mode,followupAllowed:socialPolicy.followupAllowed,
      socialMomentum:socialPolicy.momentumCarried===true,momentumMode:socialPolicy.momentumMode||null,momentumStrength:Number(socialPolicy.momentumStrength||0),
      cadenceMode:cadence.mode,targetWords:cadence.targetWords,
      resumed:!!interruptionContext,resumeSource:interruptionContext?'stream':null
    };
  }catch(e){
    return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL};
  }
}

function isLocalVisionModel(model=LOCAL_BRAIN_MODEL){
  return /^qwen3\.5(?::|$)/i.test(String(model||''));
}
function cleanImageBase64(value){
  let s=String(value||'').trim();
  s=s.replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i,'');
  if(!s||s.length>4200000)return null;
  if(!/^[A-Za-z0-9+/=\r\n]+$/.test(s))return null;
  return s.replace(/\s+/g,'');
}
async function analyzeLocalImage(imageBase64,question='Bu görüntüde ne görüyorsun?'){
  const image=cleanImageBase64(imageBase64);
  const q=String(question||'Bu görüntüde ne görüyorsun?').replace(/\s+/g,' ').trim().slice(0,900);
  if(!image)return{ok:false,error:'INVALID_IMAGE'};
  const status=await localBrainStatus();
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};
  if(!isLocalVisionModel(status.model))return{ok:false,error:'VISION_MODEL_REQUIRED',model:status.model};

  const allowedTones=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'];
  const schema={
    type:'object',
    properties:{
      reply:{type:'string'},
      tone:{type:'string',enum:allowedTones},
      observations:{type:'array',items:{type:'string'},maxItems:6}
    },
    required:['reply','tone','observations'],
    additionalProperties:false
  };
  const system=[
    'Sen JARVIS yerel görsel analiz modülüsün.',
    'Görüntü cihazdan yalnızca bu bilgisayardaki yerel modele gönderildi; buluta gönderilmedi.',
    'Türkçe, doğal ve kısa cevap ver.',
    'Yalnızca görüntüde makul biçimde görülebilen şeyleri söyle; emin olmadığın ayrıntıları kesinmiş gibi yazma.',
    'Gerçek kişilerin kimliğini tahmin etme veya isim verme. Hassas özellik çıkarımı yapma.',
    'Metin görünüyorsa okunabilen kısmı aktarabilirsin; okunmuyorsa uydurma.',
    'Kullanıcının sorusuna doğrudan cevap ver ve SADECE JSON şemasına uy.'
  ].join(' ');

  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),60000);
  const started=Date.now();
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.28,top_p:0.86,repeat_penalty:1.06,num_ctx:LOCAL_BRAIN_CTX,num_predict:260},
        messages:[
          {role:'system',content:system},
          {role:'user',content:q,images:[image]}
        ]
      }),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.reply)throw new Error('VISION_BAD_JSON');
    const reply=normalizeBrainReply(parsed.reply);
    const tone=allowedTones.includes(String(parsed.tone||''))?String(parsed.tone):'focused';
    const observations=Array.isArray(parsed.observations)
      ? parsed.observations.map(x=>String(x||'').trim()).filter(Boolean).slice(0,6)
      : [];
    appendLocalBrainHistory('user','[Yerel görüntü sorusu] '+q);
    appendLocalBrainHistory('assistant',reply);
    remember({kind:'local_vision',model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,observations:observations.length});
    return{ok:true,reply,tone,observations,model:LOCAL_BRAIN_MODEL,localOnly:true,latencyMs:Date.now()-started};
  }catch(e){
    clearTimeout(timer);
    remember({kind:'local_vision_error',model:LOCAL_BRAIN_MODEL,error:String(e.message||e).slice(0,220)});
    return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL};
  }
}
function isExplicitScreenVisionRequest(text){
  const s=String(text||'').toLocaleLowerCase('tr-TR').replace(/[?.!,;:]+/g,' ').replace(/\s+/g,' ').trim();
  return /\b(?:ekrana bak|ekranı gör|ekrani gor|ekranda ne var|ekranda ne görüyorsun|ekranda ne goruyorsun|ekranı oku|ekrani oku|screen|screenshot|monitöre bak|monitore bak)\b/i.test(s);
}
async function capturePrimaryScreenBase64(){
  if(process.platform!=='win32')return{ok:false,error:'WINDOWS_ONLY'};
  const file=path.join(os.tmpdir(),'jarvis-screen-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.jpg');
  const safe=file.replace(/'/g,"''");
  const ps=[
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$src=New-Object System.Drawing.Bitmap $b.Width,$b.Height',
    '$g=[System.Drawing.Graphics]::FromImage($src)',
    '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)',
    '$scale=[Math]::Min(1.0,1280.0/$b.Width)',
    '$w=[Math]::Max(1,[int]($b.Width*$scale))',
    '$h=[Math]::Max(1,[int]($b.Height*$scale))',
    '$dst=New-Object System.Drawing.Bitmap $w,$h',
    '$g2=[System.Drawing.Graphics]::FromImage($dst)',
    '$g2.DrawImage($src,0,0,$w,$h)',
    "$dst.Save('"+safe+"',[System.Drawing.Imaging.ImageFormat]::Jpeg)",
    '$g2.Dispose();$dst.Dispose();$g.Dispose();$src.Dispose()'
  ].join('; ');
  try{
    await runHidden('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],15000);
    if(!fs.existsSync(file)||fs.statSync(file).size<512)throw new Error('SCREEN_CAPTURE_EMPTY');
    const buf=fs.readFileSync(file);
    return{ok:true,image:buf.toString('base64'),bytes:buf.length};
  }catch(e){
    return{ok:false,error:String(e.message||e)};
  }finally{
    try{if(fs.existsSync(file))fs.unlinkSync(file)}catch(_){}
  }
}
async function analyzeCurrentScreen(question='Ekranda ne görüyorsun?'){
  const shot=await capturePrimaryScreenBase64();
  if(!shot.ok)return{ok:false,error:shot.error||'SCREEN_CAPTURE_FAILED'};
  const result=await analyzeLocalImage(shot.image,question);
  if(result&&result.ok){
    remember({kind:'local_screen_vision',model:result.model,bytes:shot.bytes,localOnly:true});
    return{...result,screen:true,bytes:shot.bytes,localOnly:true};
  }
  return result||{ok:false,error:'SCREEN_VISION_FAILED'};
}
function nativeAgentTools(){
  return[
    {
      type:'function',
      function:{
        name:'system_status',
        description:'Bilgisayarın temel sistem durumunu getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'disk_status',
        description:'Yerel disklerin boş ve toplam alanını getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'network_status',
        description:'Bilgisayarın aktif yerel ağ arayüzlerini getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'power_status',
        description:'Pil ve güç durumunu getir.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'open_target',
        description:'Yalnızca JARVIS güvenli katalogunda bulunan uygulama, ayar veya siteyi aç.',
        parameters:{
          type:'object',
          properties:{target:{type:'string',description:'Örn. youtube, google, github, chatgpt, opera gx, chrome, edge, not defteri, hesap makinesi, dosya gezgini, görev yöneticisi, ayarlar, ses ayarları, bluetooth ayarları, wifi ayarları, çalışma alanı'}},
          required:['target'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'media_control',
        description:'Windows medya veya ses kontrolü uygula.',
        parameters:{
          type:'object',
          properties:{action:{type:'string',enum:['volume_up','volume_down','mute','play_pause','next','previous','stop']}},
          required:['action'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'bluetooth_control',
        description:'Windows Bluetooth durumunu ve eşleşmiş ses cihazlarını gör, Bluetooth eşleştirme ayarını aç veya Bluetooth/medya ses sisteminde oynat-duraklat, sonraki, önceki, stop, ses artır/azalt ve mute uygula. Bu araç PUBLIC yayınlama veya hesap onayı yapmaz.',
        parameters:{
          type:'object',
          properties:{action:{type:'string',enum:['status','list_audio','pair','find_audio','auto_audio','select_output','playpause','next','previous','stop','volumeup','volumedown','mute']},deviceName:{type:'string',description:'find_audio/select_output için hoparlör, radyo veya ses cihazının görünen adı.'}},
          required:['action'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'bluetooth_acceptance_test',
        description:'Kullanıcı açıkça Bluetooth ses donanım testini istediğinde Windows üzerinde gerçek cihaz bulma, varsayılan ses çıkışını değiştirme/doğrulama ve medya kontrolü acceptance testini çalıştır.',
        parameters:{type:'object',properties:{deviceName:{type:'string',description:'İsteğe bağlı. Test edilecek Bluetooth hoparlör, radyo veya ses cihazının görünen adı. Boşsa yalnızca tek uygun ses endpointi olduğunda otomatik seçilir.'}},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'screen_describe',
        description:'Yalnızca kullanıcı açıkça mevcut bilgisayar ekranına bakmanı istediğinde ekranı yerel olarak yakala ve yerel Qwen3.5 ile analiz et. Görüntü buluta gönderilmez.',
        parameters:{
          type:'object',
          properties:{question:{type:'string',description:'Kullanıcının ekrandan öğrenmek istediği şey.'}},
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_status',
        description:'JARVIS yerel video/Shorts üretim motorunun durumunu kontrol et. Bu araç hiçbir şey yayınlamaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'creator_render_short',
        description:'Kullanıcı açıkça video veya YouTube Shorts üretmeni istediğinde, yerel bilgisayarda 9:16 çok sahneli MP4 hazırla; mevcut yerel kliplerden dinamik kurgu, geçiş ve mümkünse videoya işlenmiş altyazı kullan. Bu araç videoyu yalnızca yerel dosya olarak üretir; YouTube veya başka bir yere yayınlamaz.',
        parameters:{
          type:'object',
          properties:{
            name:{type:'string',description:'Kısa dosya/proje adı.'},
            script:{type:'string',description:'Videoda okunacak Türkçe anlatım metni. 12-18 saniyeye uygun kısa tutulmalı.'},
            creatorAssets:{type:'array',maxItems:5,items:{type:'string'},description:'İsteğe bağlı, creator-assets/... yolları. Verilen sıra sahne sırası olur.'}
          },
          required:['script'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'shopify_status',
        description:'VAROVA/Shopify yerel bağlantısının hazır olup olmadığını kontrol et. Mağazada değişiklik yapmaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'shopify_create_draft',
        description:'Kullanıcı açıkça mağazasına ürün eklemek veya ürün taslağı hazırlamak istediğinde Shopify üzerinde yalnızca DRAFT ürün oluştur. Bu araç ürünü yayınlamaz. Eksik kritik bilgiyi uydurma.',
        parameters:{
          type:'object',
          properties:{
            title:{type:'string',description:'Ürün başlığı.'},
            description:{type:'string',description:'Ürün açıklaması.'},
            price:{type:'number',description:'Satış fiyatı, TRY.'},
            compareAtPrice:{type:'number',description:'Varsa karşılaştırma/eski fiyat.'},
            sku:{type:'string',description:'Varsa SKU.'},
            vendor:{type:'string',description:'Marka/vendor; VAROVA olabilir.'},
            productType:{type:'string',description:'Ürün tipi.'},
            tags:{type:'array',items:{type:'string'},description:'Ürün etiketleri.'},
            images:{type:'array',items:{type:'string'},description:'HTTPS görsel URL listesi.'}
          },
          required:['title'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'youtube_studio_status',
        description:'JARVIS özel browser profilinde YouTube Studio oturum ve yükleme hazırlık durumunu kontrol et. Hesapta değişiklik yapmaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'youtube_prepare_draft_upload',
        description:'Kullanıcı açıkça bir videoyu YouTube Studioya yüklemeni istediğinde, JARVIS workspace içindeki videoyu yükleme ekranına koy ve başlık/açıklamayı hazırla. Bu araç ASLA Publish/Yayınla düğmesine basmaz; yalnızca taslak yükleme hazırlar.',
        parameters:{
          type:'object',
          properties:{
            file:{type:'string',description:'JARVIS workspace içindeki video dosya yolu. Creator aracının ürettiği output yolu kullanılabilir.'},
            title:{type:'string',description:'YouTube video başlığı.'},
            description:{type:'string',description:'YouTube açıklaması.'},
            thumbnail:{type:'string',description:'İsteğe bağlı workspace içindeki JPG/PNG/WebP thumbnail yolu. Yüklenemezse video DRAFT akışı devam eder.'}
          },
          required:['file'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'pc_acceptance_snapshot',
        description:'Bilgisayardaki JARVIS Worker, sessiz açılış, Creator, Browser Operator, Shopify/YouTube bağlantıları ve kalıcı görev durumunu salt-okunur kabul testi olarak denetle. Hiçbir içerik yayınlamaz veya hesapta değişiklik yapmaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'pc_self_repair',
        description:'Kullanıcı açıkça JARVIS kendini düzelt/onar dediğinde yalnızca yerel JARVIS runtime dosyalarını, sessiz Windows açılış kaydını ve ücretsiz Creator FFmpeg hazırlığını onar. Shopify veya YouTube hesabında veri oluşturmaz, silmez veya yayınlamaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'pc_safe_mission',
        description:'Kullanıcı bir veya birden fazla güvenli yerel PC işinin kalıcı görev olarak sırayla yürütülmesini istediğinde kullan. Yalnızca salt-okunur durum kontrolleri, allowlist uygulama/site açma ve medya kontrolleri desteklenir. Shell/PowerShell komutu, keyfi exe/path, dosya silme, ödeme, yayınlama veya hesap değişikliği çalıştırmaz.',
        parameters:{
          type:'object',
          properties:{
            label:{type:'string',description:'Görev için kısa açıklama.'},
            actions:{
              type:'array',
              maxItems:8,
              items:{
                type:'object',
                properties:{
                  kind:{type:'string',enum:['status','open','media']},
                  target:{type:'string',description:'status için system/disk/network/power; open için güvenli katalog hedefi.'},
                  action:{type:'string',description:'media için volume_up/volume_down/mute/play_pause/next/previous/stop.'}
                },
                required:['kind'],
                additionalProperties:false
              }
            }
          },
          required:['actions'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'workspace_file_mission',
        description:'JARVIS workspace içindeki mevcut dosyaları kalıcı görev olarak güvenli biçimde kopyala veya taşı. Workspace dışına çıkmaz, internal/hassas yolları kullanmaz, hedefin üzerine yazmaz ve restart sonrası SHA-256 durumunu doğrulamadan tekrar etmez. move işlemi hedef doğrulandıktan sonra kaynağı kaldırır; bağımsız delete işlemi yoktur.',
        parameters:{
          type:'object',
          properties:{
            label:{type:'string',description:'Görev için kısa açıklama.'},
            operations:{
              type:'array',
              maxItems:12,
              items:{
                type:'object',
                properties:{
                  operation:{type:'string',enum:['copy','move']},
                  source:{type:'string',description:'Workspace köküne göre mevcut kaynak dosya yolu.'},
                  destination:{type:'string',description:'Workspace köküne göre yeni hedef dosya yolu; hedef klasörü önceden var olmalı.'}
                },
                required:['operation','source','destination'],
                additionalProperties:false
              }
            }
          },
          required:['operations'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'mission_control',
        description:'Yalnızca kullanıcı açıkça kalıcı görevi duraklatmak, devam ettirmek veya iptal etmek istediğinde kullan. Running adımı zorla kesmez; kontrol isteği güvenli adım sınırında uygulanır. Birden fazla uygun görev varsa missionId gerekir.',
        parameters:{
          type:'object',
          properties:{
            action:{type:'string',enum:['pause','resume','cancel']},
            missionId:{type:'string',description:'Varsa tam mission kimliği; boşsa yalnızca tek uygun görev olduğunda otomatik seçilir.'}
          },
          required:['action'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'mission_status',
        description:'En son kalıcı JARVIS iş görevinin durumunu getir. Dış sistemlerde değişiklik yapmaz.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'resume_latest_mission',
        description:'Kullanıcı açıkça devam et/sürdür dediğinde yarım kalmış en son kalıcı görevi kaldığı adımdan sürdür. Belirsiz dış yan etki varsa tekrar yapmaz; doğrulama durumunda durur.',
        parameters:{type:'object',properties:{},additionalProperties:false}
      }
    },
    {
      type:'function',
      function:{
        name:'approve_mission_action',
        description:'Yalnızca kullanıcı bu turda açıkça onayla/yayınla dediğinde, onay bekleyen tek bir kalıcı görevin geri döndürülemez sonraki adımını onayla ve çalıştır. Genel "devam et" ifadesi onay sayılmaz.',
        parameters:{
          type:'object',
          properties:{missionId:{type:'string',description:'Varsa tam mission kimliği; boşsa en yeni onay bekleyen görev kullanılır.'}},
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'browser_form_mission',
        description:'İzinli bir web sayfasını kalıcı ve yeniden başlatılabilir görev olarak aç, hassas olmayan form alanlarını doldur ve sonucu doğrula. finalClick verilirse son tıklama ayrı approval gate üzerinde durur. Şifre/token/kart/ödeme bilgileri kaydedilmez; public publish, ödeme, silme ve benzeri yüksek riskli tıklamalar generic browser göreviyle çalıştırılmaz.',
        parameters:{
          type:'object',
          properties:{
            url:{type:'string',description:'Browser Operator allowlist içindeki http/https hedef URL.'},
            label:{type:'string',description:'Görev için kısa açıklama.'},
            fields:{
              type:'array',
              maxItems:20,
              items:{
                type:'object',
                properties:{
                  label:{type:'string',description:'Form alanını bulmak için label/name/placeholder/aria metni.'},
                  value:{type:'string',description:'Hassas olmayan alan değeri.'}
                },
                required:['label','value'],
                additionalProperties:false
              }
            },
            finalClick:{type:'string',description:'İsteğe bağlı son buton/link metni. Varsa açık kullanıcı onayı olmadan tıklanmaz.'}
          },
          required:['url'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'developer_patch_mission',
        description:'Mevcut bir JARVIS workspace projesindeki güvenli metin kaynak dosyalarını kalıcı görev olarak güncelle. Görev başlatılırken her dosyanın mevcut SHA-256 özeti baseline olarak kilitlenir; dosya dışarıdan değişirse üzerine yazılmaz. Her değişiklikten önce rollback yedeği alınır ve final hash/syntax doğrulaması başarısız olursa JARVIS değişiklikleri geri alınır. Yeni dosya oluşturmaz, hassas dosyalara dokunmaz ve deploy etmez.',
        parameters:{
          type:'object',
          properties:{
            projectName:{type:'string',description:'Workspace içindeki mevcut proje klasör adı.'},
            summary:{type:'string',description:'Değişikliğin kısa amacı.'},
            patches:{
              type:'array',
              minItems:1,
              maxItems:12,
              items:{
                type:'object',
                properties:{
                  path:{type:'string',description:'Proje köküne göre mevcut güvenli kaynak dosyası.'},
                  content:{type:'string',description:'Dosyanın tam yeni metin içeriği; önce workspace_read ile mevcut içeriği oku.'}
                },
                required:['path','content'],
                additionalProperties:false
              }
            }
          },
          required:['projectName','patches'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'developer_project_mission',
        description:'Kullanıcı açıkça bir uygulama, site veya yazılım projesi oluşturmanı istediğinde kalıcı ve yeniden başlatılabilir geliştirici görevi başlat. Yalnızca JARVIS workspace içinde güvenli metin kaynak dosyaları oluşturur; mevcut farklı dosyaların üstüne otomatik yazmaz ve deploy etmez.',
        parameters:{
          type:'object',
          properties:{
            projectName:{type:'string',description:'Workspace içindeki proje klasör adı.'},
            summary:{type:'string',description:'Projenin kısa amacı.'},
            features:{type:'array',items:{type:'string'},description:'files verilmezse başlangıç web uygulamasında gösterilecek özellikler.'},
            files:{
              type:'array',
              maxItems:12,
              items:{
                type:'object',
                properties:{
                  path:{type:'string',description:'Proje köküne göre güvenli kaynak dosya yolu.'},
                  content:{type:'string',description:'Dosyanın metin içeriği.'}
                },
                required:['path','content'],
                additionalProperties:false
              }
            }
          },
          required:['projectName'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'shopify_product_mission',
        description:'Kullanıcı mağazaya ürün ekleme veya ürün taslağı hazırlama işinin bağlantı kesilse bile kaldığı yerden devam etmesini istediğinde kalıcı Shopify ürün görevi başlat. Varsayılan yalnızca DRAFT oluşturur. publish=true istenirse görev yayınlama adımında DURUR ve ayrıca açık kullanıcı onayı bekler.',
        parameters:{
          type:'object',
          properties:{
            title:{type:'string',description:'Ürün başlığı.'},
            description:{type:'string',description:'Ürün açıklaması.'},
            price:{type:'number',description:'Satış fiyatı, TRY.'},
            compareAtPrice:{type:'number',description:'Varsa eski/karşılaştırma fiyatı.'},
            sku:{type:'string'},
            vendor:{type:'string'},
            productType:{type:'string'},
            tags:{type:'array',items:{type:'string'}},
            images:{type:'array',items:{type:'string'},description:'HTTPS ürün görsel URL listesi.'},
            publish:{type:'boolean',description:'true ise taslaktan sonra yayınlama için approval gate oluşturur; bu çağrıda ürün yayınlanmaz.'}
          },
          required:['title'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_web_media',
        description:'İnternetten ücretsiz ve yeniden kullanıma izinli Creator medya kaynakları al. Önce video aranır; yetmezse Wikimedia Commons içindeki Public Domain/CC0 görseller yerelde FFmpeg ile hareketli H.264 klibe çevrilir. Auto modunda ücretsiz API anahtarı varsa Pexels/Pixabay video da kullanılabilir. Kaynak, lisans, türetme bilgisi ve SHA-256 manifesti kaydedilir. YouTube/TikTok/Instagram gibi sosyal ağlardan rastgele video sökme yapmaz ve hiçbir şeyi yayınlamaz.',
        parameters:{
          type:'object',
          properties:{
            query:{type:'string',description:'Aranacak görsel/video konusu; ör. yapay zeka robot laboratuvar.'},
            provider:{type:'string',enum:['auto','wikimedia','pexels','pixabay'],description:'Varsayılan auto.'},
            orientation:{type:'string',enum:['portrait','landscape','any'],description:'Shorts için portrait, uzun video için landscape.'},
            count:{type:'integer',minimum:1,maximum:12}
          },
          required:['query'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_asset_mission',
        description:'Workspace içindeki mevcut video kliplerini Creator asset havuzuna kalıcı ve restart-safe görev olarak ekle. Kaynak dosya silinmez. FFprobe ile gerçek video doğrulaması yapılır; hash-prefix hedef adı duplicate riskini azaltır; aynı hash zaten asset havuzundaysa reuse edilir.',
        parameters:{
          type:'object',
          properties:{
            label:{type:'string',description:'Asset ingest görevi için kısa açıklama.'},
            sourceFiles:{
              type:'array',
              minItems:1,
              maxItems:12,
              items:{type:'string',description:'JARVIS workspace köküne göre video dosyası yolu.'}
            }
          },
          required:['sourceFiles'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_batch_mission',
        description:'2-10 Shorts/Reels işini tek kalıcı batch görevinde üret. Her render ayrı restart-safe child Creator mission olarak scheduler üzerinden yürür; tamamlanan child tekrar oluşturulmaz. Her item kendi sıralı creatorAssets storyboardunu hash baseline ile korur. Önce bütün MP4 renderları tamamlanır, includeYouTube=true ise sonra her video için ayrı YouTube Studio DRAFT hazırlanır. Batch hiçbir videoyu PUBLIC yayınlamaz.',
        parameters:{
          type:'object',
          properties:{
            label:{type:'string',description:'Batch görev adı.'},
            includeYouTube:{type:'boolean',description:'true ise bütün renderlar tamamlandıktan sonra her video için ayrı YouTube Studio DRAFT hazırlanır; PUBLIC yapılmaz.'},
            items:{
              type:'array',
              minItems:2,
              maxItems:10,
              items:{
                type:'object',
                properties:{
                  campaignName:{type:'string',description:'Video/Short adı.'},
                  script:{type:'string',description:'12-18 saniyelik Türkçe anlatım metni.'},
                  youtubeTitle:{type:'string'},
                  youtubeDescription:{type:'string'},
                  creatorAssets:{type:'array',maxItems:5,items:{type:'string'},description:'İsteğe bağlı creator-assets/... yolları; verilen sıra bu videonun storyboard sahne sırası olur.'},
                  webMediaQuery:{type:'string',description:'İsteğe bağlı. Bu Short için ücretsiz/lisanslı internet B-roll arama sorgusu; creatorAssets boşsa kullanılır.'},
                  webMediaProvider:{type:'string',enum:['auto','wikimedia','pexels','pixabay'],description:'Varsayılan auto.'},
                  webMediaAuto:{type:'boolean',description:'Varsayılan true. creatorAssets yoksa başlık/senaryodan kısa yerel sorgu üretip lisanslı medya aramayı deneyebilir.'}
                },
                required:['script'],
                additionalProperties:false
              }
            }
          },
          required:['items'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_short_mission',
        description:'Kullanıcı bir Short/Reels videosunu kalıcı, yeniden başlatılabilir iş olarak üretmek istediğinde kullan. İstenirse aynı görev YouTube Studio taslağını da hazırlar. publish=true yalnızca taslaktan sonra PUBLIC yayın adımını sıraya koyar; görev approval gate üzerinde durur ve bu çağrıda yayınlamaz.',
        parameters:{
          type:'object',
          properties:{
            campaignName:{type:'string',description:'Short görev adı.'},
            script:{type:'string',description:'12-18 saniyelik Türkçe anlatım metni.'},
            youtubeTitle:{type:'string'},
            youtubeDescription:{type:'string'},
            creatorAssets:{type:'array',maxItems:5,items:{type:'string'},description:'İsteğe bağlı creator-assets/... yolları; verilen sıra storyboard sahne sırası olur.'},
            webMediaQuery:{type:'string',description:'İsteğe bağlı. İnternetten ücretsiz/lisanslı stock klip isteniyorsa konu sorgusu. creatorAssets boşsa önce Creator Web Media ile portrait klip alınır.'},
            webMediaProvider:{type:'string',enum:['auto','wikimedia','pexels','pixabay'],description:'Web medya sağlayıcısı; varsayılan auto.'},
            webMediaAuto:{type:'boolean',description:'Varsayılan true. creatorAssets yoksa JARVIS başlık/senaryodan kısa bir sorgu üretip lisanslı medya aramayı deneyebilir.'},
            includeYouTube:{type:'boolean',description:'true ise render sonrası YouTube Studio taslağı hazırlanır.'},
            publish:{type:'boolean',description:'true ise YouTube taslağından sonra PUBLIC yayın için approval gate oluşturur; bu çağrıda yayınlanmaz.'}
          },
          required:['script'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_longform_mission',
        description:'Yaklaşık 10 dakikalık 16:9 HD YouTube videosunu kalıcı, restart-safe Creator görevi olarak üret. Yerel TTS, çok sahneli kurgu, altyazı ve teknik kalite kapısı kullanılır. includeYouTube=true yalnızca YouTube Studio DRAFT hazırlar. publish=true bile PUBLIC adımı ayrı approval gate bekler.',
        parameters:{
          type:'object',
          properties:{
            campaignName:{type:'string'},
            script:{type:'string',description:'Yaklaşık 9-11 dakikalık anlatıma uygun tam metin.'},
            youtubeTitle:{type:'string'},
            youtubeDescription:{type:'string'},
            creatorVoice:{type:'string',description:'Edge TTS Neural voice adı; ör. tr-TR-EmelNeural veya en-US-AriaNeural.'},
            creatorAssets:{type:'array',maxItems:20,items:{type:'string'},description:'İsteğe bağlı creator-assets/... klipleri; sıra storyboard sırasıdır.'},
            webMediaQuery:{type:'string',description:'İsteğe bağlı. İnternetten ücretsiz/lisanslı stock klip isteniyorsa konu sorgusu. creatorAssets boşsa önce Creator Web Media ile landscape klip alınır.'},
            webMediaProvider:{type:'string',enum:['auto','wikimedia','pexels','pixabay'],description:'Web medya sağlayıcısı; varsayılan auto.'},
            webMediaAuto:{type:'boolean',description:'Varsayılan true. creatorAssets yoksa JARVIS başlık/senaryodan kısa bir sorgu üretip lisanslı medya aramayı deneyebilir.'},
            includeYouTube:{type:'boolean',description:'true ise render sonrası YouTube Studio DRAFT hazırlanır.'},
            publish:{type:'boolean',description:'true yalnızca PUBLIC approval adımını sıraya koyar; bu çağrıda yayınlamaz.'}
          },
          required:['script'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'creator_daily_longform_plan',
        description:'Her takvim günü en fazla bir yaklaşık 10 dakikalık Creator long-form görevi üreten kalıcı planı aç/kapat/durumunu göster. Plan local model ile farklı evergreen konular seçer, restart sonrası devam eder ve aynı gün duplicate mission oluşturmaz. YouTube yalnız DRAFT olabilir; günlük plan hiçbir zaman PUBLIC adımı oluşturmaz.',
        parameters:{
          type:'object',
          properties:{
            action:{type:'string',enum:['enable','disable','status']},
            timezone:{type:'string',description:'IANA timezone; varsayılan Europe/Istanbul.'},
            language:{type:'string',description:'Anlatım dili.'},
            creatorVoice:{type:'string',description:'Seçilen dil için Edge TTS Neural voice adı.'},
            topicPrompt:{type:'string',description:'Konu çeşitliliği ve kanal yönü.'},
            includeYouTube:{type:'boolean',description:'true ise günlük video render sonrası YouTube Studio DRAFT hazırlanır; PUBLIC olmaz.'},
            creatorAssets:{type:'array',maxItems:20,items:{type:'string'},description:'İsteğe bağlı sabit Creator klip havuzu seçimi; SHA-256 baseline ile korunur.'}
          },
          required:['action'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'varova_campaign_mission',
        description:'Kullanıcı VAROVA için ürün + reklam videosu + isteğe bağlı YouTube Studio taslağı gibi çok adımlı işi tek görev olarak istediğinde kalıcı ve devam ettirilebilir kampanya görevi başlat. Shopify ürünü DRAFT kalır. publishYouTube=true yalnızca YouTube PUBLIC adımını approval gate arkasına sıraya koyar; bu çağrıda yayınlamaz.',
        parameters:{
          type:'object',
          properties:{
            campaignName:{type:'string'},
            script:{type:'string',description:'12-18 saniyelik Türkçe video anlatım metni.'},
            productTitle:{type:'string'},
            productDescription:{type:'string'},
            price:{type:'number'},
            sku:{type:'string'},
            productType:{type:'string'},
            tags:{type:'array',items:{type:'string'}},
            images:{type:'array',items:{type:'string'}},
            youtubeTitle:{type:'string'},
            youtubeDescription:{type:'string'},
            creatorAssets:{type:'array',maxItems:5,items:{type:'string'},description:'İsteğe bağlı creator-assets/... yolları; verilen sıra reklam videosu sahne sırası olur.'},
            webMediaQuery:{type:'string',description:'İsteğe bağlı lisanslı B-roll arama sorgusu.'},
            webMediaProvider:{type:'string',enum:['auto','wikimedia','pexels','pixabay'],description:'Varsayılan auto.'},
            webMediaAuto:{type:'boolean',description:'Varsayılan true. creatorAssets yoksa ürün/başlık/senaryodan lisanslı B-roll aramayı deneyebilir.'},
            includeShopify:{type:'boolean'},
            includeYouTube:{type:'boolean'},
            publishYouTube:{type:'boolean',description:'true ise YouTube taslağından sonra PUBLIC yayın için approval gate oluşturur; bu çağrıda yayınlanmaz.'}
          },
          required:['script'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'workspace_search',
        description:'JARVIS çalışma alanındaki güvenli metin dosyalarında arama yap. Hassas dosyalar otomatik dışlanır.',
        parameters:{
          type:'object',
          properties:{query:{type:'string'}},
          required:['query'],
          additionalProperties:false
        }
      }
    },
    {
      type:'function',
      function:{
        name:'workspace_read',
        description:'JARVIS çalışma alanındaki güvenli bir metin dosyasını oku. Önce workspace_search ile doğru yolu bul.',
        parameters:{
          type:'object',
          properties:{path:{type:'string'}},
          required:['path'],
          additionalProperties:false
        }
      }
    }
  ];
}
function safeWorkspaceReadForAgent(relPath){
  try{
    const rel=String(relPath||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
    if(!rel)return{ok:false,message:'Dosya yolu boş.'};
    if(isSensitiveWorkspacePath(rel))return{ok:false,message:'Hassas dosya erişimi engellendi.'};
    const file=safeFile(rel);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return{ok:false,message:'Dosya bulunamadı: '+rel};
    const ext=path.extname(file).toLowerCase();
    const allowed=new Set(['.txt','.md','.json','.js','.ts','.tsx','.jsx','.css','.html','.py','.ps1','.bat','.cmd','.yml','.yaml','.csv','.log']);
    if(!allowed.has(ext))return{ok:false,message:'Bu dosya türü yerel ajan okumasına açık değil: '+ext};
    const size=fs.statSync(file).size;
    if(size>768*1024)return{ok:false,message:'Dosya ajan okuması için çok büyük: '+Math.round(size/1024)+' KB'};
    const data=fs.readFileSync(file,'utf8').replace(/\u0000/g,'').slice(0,7000);
    return{ok:true,message:'DOSYA ['+path.relative(WORKSPACE,file)+']:\n'+data};
  }catch(e){
    return{ok:false,message:'Dosya okuma hatası: '+String(e.message||e).slice(0,180)};
  }
}
function nativeToolSignature(name,args){
  let packed='';
  try{packed=JSON.stringify(args||{})}catch(_){packed=String(args||'')}
  return String(name||'')+'|'+packed;
}
async function executeNativeAgentTool(name,args,{userText=''}={}){
  const n=String(name||'').trim();
  const a=args&&typeof args==='object'?args:{};
  let command='';
  if(n==='system_status')command='sistem durumu';
  else if(n==='disk_status')command='disk durumu';
  else if(n==='network_status')command='ağ durumu';
  else if(n==='power_status')command='pil durumu';
  else if(n==='open_target'){
    const target=String(a.target||'').replace(/[\r\n]/g,' ').trim().slice(0,100);
    command=target?target+' aç':'';
  }else if(n==='media_control'){
    const map={
      volume_up:'sesi yükselt',
      volume_down:'sesi azalt',
      mute:'sessize al',
      play_pause:'oynat',
      next:'sonraki',
      previous:'önceki',
      stop:'medyayı durdur'
    };
    command=map[String(a.action||'')]||'';
  }else if(n==='bluetooth_control'){
    if(!bluetoothAudio)return{ok:false,message:'Bluetooth ses modülü yüklü değil.'};
    const action=String(a.action||'').toLowerCase();
    const result=bluetoothAudio.command(action,{deviceName:a.deviceName});
    return{ok:!!result.ok,message:result.ok?('BLUETOOTH '+action.toUpperCase()+(result.output?' · '+String(result.output).slice(0,3000):'')):('Bluetooth işlemi başarısız: '+String(result.reason||'unknown'))};
  }else if(n==='bluetooth_acceptance_test'){
    const device=String(a.deviceName||'').replace(/[\r\n]/g,' ').trim().slice(0,120);
    if(process.platform!=='win32')return{ok:false,message:'Bluetooth acceptance testi gerçek Windows Worker üzerinde çalıştırılmalı.'};
    try{
      const out=childProcess.execFileSync(process.execPath,[path.join(__dirname,'bluetooth-e2e.js'),device],{cwd:__dirname,encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1024*1024});
      const report=JSON.parse(out); return{ok:!!report.ok,message:'BLUETOOTH E2E '+(report.ok?'PASS':'FAIL')+' · '+String(report.reason||'unknown')+' · '+JSON.stringify(report).slice(0,3000)};
    }catch(e){return{ok:false,message:'Bluetooth E2E FAIL · '+String(e.stdout||e.message||e).slice(0,3000)}}
  }else if(n==='screen_describe'){
    if(!isExplicitScreenVisionRequest(userText)){
      return{ok:false,message:'Ekran yakalama yalnızca açık kullanıcı isteğiyle çalışır.'};
    }
    const q=String(a.question||userText||'Ekranda ne görüyorsun?').replace(/[\r\n]/g,' ').trim().slice(0,700);
    const vision=await analyzeCurrentScreen(q);
    if(!vision||!vision.ok)return{ok:false,message:'Yerel ekran analizi başarısız: '+String(vision&&vision.error||'unknown')};
    return{ok:true,message:'YEREL EKRAN ANALİZİ: '+String(vision.reply||'').slice(0,1800)};
  }else if(n==='creator_status'){
    const status=getCreatorEngine().ffmpegStatus(WORKSPACE);
    return{
      ok:true,
      message:'Creator v2 motoru · FFmpeg '+(status.ok?'READY':'MISSING')+' · '+status.assets+' yerel klip · çok sahneli kurgu + altyazı · çıktı '+status.outputDir
    };
  }else if(n==='creator_render_short'){
    if(!/(?:video|shorts?|youtube|reels?)/i.test(String(userText||''))){
      return{ok:false,message:'Video üretimi yalnızca açık kullanıcı isteğiyle çalışır.'};
    }
    const script=String(a.script||'').replace(/\s+/g,' ').trim().slice(0,1800);
    const name=String(a.name||('short-'+Date.now())).replace(/[\r\n]/g,' ').trim().slice(0,90);
    if(!script)return{ok:false,message:'Video anlatım metni boş.'};
    const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
    if(!ready.ok)return{ok:false,message:'Creator motoru hazır değil; FFmpeg kurulamadı.'};
    try{
      const voice=await renderCreatorVoiceFile(script,name+'-voice');
      const selected=normalizeCreatorStoryboardAssets(a.creatorAssets);
      for(const asset of selected){
        const current=getWorkspaceFileEngine().hashFile(safeFile(asset.path));
        if(current!==asset.sha256)return{ok:false,message:'Seçili Creator asset hash değişti; render durduruldu: '+asset.path};
        const inspected=getCreatorEngine().inspectAsset(WORKSPACE,asset.path);
        if(!inspected.ok)return{ok:false,message:'Seçili Creator asset video doğrulaması başarısız: '+asset.path+' · '+String(inspected.code||'INVALID')};
      }
      const out=getCreatorEngine().renderShort({
        workspace:WORKSPACE,name,script,voicePath:voice,
        assetFiles:selected.map(x=>x.path),
        assetHashes:selected.map(x=>x.sha256),
        thumbnailTitle:name
      });
      return{ok:true,message:'YEREL SHORTS HAZIR · '+out.output+' · '+Math.round(Number(out.duration||0)*10)/10+' sn · '+Number(out.sceneCount||0)+' sahne · '+(out.captionsBurned?'altyazı işlendi':'SRT hazır')+(out.soundDesign&&out.soundDesign.enabled?' · local SFX '+Number(out.soundDesign.count||0):'')+' · yayınlanmadı'};
    }catch(e){
      return{ok:false,message:'Shorts üretilemedi: '+String(e.message||e).slice(0,500)};
    }
  }else if(n==='shopify_status'){
    const status=await getCommerceEngine().status(WORKSPACE);
    return{ok:!!status.ok,message:status.message};
  }else if(n==='shopify_create_draft'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:shopify|varova|mağaza|magaza)/i.test(intent)||!/(?:ürün|urun|product|ekle|taslak)/i.test(intent)){
      return{ok:false,message:'Mağaza ürün taslağı yalnızca açık kullanıcı isteğiyle oluşturulur.'};
    }
    const product={
      title:String(a.title||'').replace(/\s+/g,' ').trim(),
      description:String(a.description||'').trim(),
      price:a.price,
      compareAtPrice:a.compareAtPrice,
      sku:String(a.sku||'').trim(),
      vendor:String(a.vendor||'VAROVA').trim()||'VAROVA',
      productType:String(a.productType||'').trim(),
      tags:Array.isArray(a.tags)?a.tags:[],
      images:Array.isArray(a.images)?a.images:[]
    };
    if(!product.title)return{ok:false,message:'Ürün başlığı olmadan Shopify taslağı oluşturulmadı.'};
    try{
      const out=await getCommerceEngine().createDraft(WORKSPACE,product);
      return{ok:true,message:'SHOPIFY DRAFT HAZIR · '+out.product.title+' · '+out.product.id+' · ürün yayınlanmadı'};
    }catch(e){
      if(String(e.message||e)==='SHOPIFY_NOT_CONNECTED'){
        return{ok:false,message:'Shopify yerel bağlantısı henüz kurulmamış. Bir kez "Shopify bağlantısını kur" komutu gerekli.'};
      }
      return{ok:false,message:'Shopify taslağı oluşturulamadı: '+String(e.message||e).slice(0,500)};
    }
  }else if(n==='youtube_studio_status'){
    try{
      const out=await getYoutubeStudio().status(getBrowserOperator(),WORKSPACE);
      return{ok:true,message:out.message};
    }catch(e){
      return{ok:false,message:'YouTube Studio durumu alınamadı: '+String(e.message||e).slice(0,400)};
    }
  }else if(n==='youtube_prepare_draft_upload'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/youtube/i.test(intent)||!/(?:yükle|yukle|upload|taslak)/i.test(intent)){
      return{ok:false,message:'YouTube yükleme yalnızca açık kullanıcı isteğiyle çalışır.'};
    }
    const file=String(a.file||'').trim();
    if(!file)return{ok:false,message:'YouTube taslağı için video dosya yolu gerekli.'};
    try{
      const out=await getYoutubeStudio().prepareDraft(getBrowserOperator(),WORKSPACE,{
        file,
        title:String(a.title||'').trim(),
        description:String(a.description||'').trim(),
        thumbnail:String(a.thumbnail||'').trim()
      });
      return{ok:!!out.ok,message:out.message};
    }catch(e){
      return{ok:false,message:'YouTube taslak yüklemesi hazırlanamadı: '+String(e.message||e).slice(0,500)};
    }
  }else if(n==='pc_acceptance_snapshot'){
    try{
      const snapshot=await buildPcAcceptanceSnapshot();
      return{ok:true,message:acceptanceSummaryText(snapshot)};
    }catch(e){
      return{ok:false,message:'PC kabul testi hazırlanamadı: '+String(e.message||e).slice(0,500)};
    }
  }else if(n==='pc_self_repair'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:kendini\s+(?:düzelt|duzelt|onar)|jarvis\s+(?:düzelt|duzelt|onar)|pc\s+onar|sistemi\s+onar|self\s*repair)/i.test(intent)){
      return{ok:false,message:'Yerel self-repair yalnızca açık kullanıcı onarım isteğiyle çalışır.'};
    }
    try{
      const out=await repairLocalRuntime();
      return{ok:!!out.ok,message:repairSummaryText(out)};
    }catch(e){
      return{ok:false,message:'JARVIS yerel onarımı tamamlanamadı: '+String(e.message||e).slice(0,500)};
    }
  }else if(n==='pc_safe_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:pc|bilgisayar|uygulama|program|aç|ac|open|ses|medya|disk|ağ|ag|pil|sistem)/i.test(intent)){
      return{ok:false,message:'Kalıcı PC görevi yalnızca açık yerel bilgisayar işi isteğiyle başlatılır.'};
    }
    try{
      const mission=createPcSafeMission(a);
      const out=await runDurableMission(mission.id);
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(out.status==='needs_verification'?' · son yerel yan etki belirsiz; otomatik tekrar durduruldu':out.status==='waiting_dependency'?' · PC çalışma koşulu hazır olduğunda devam eder':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı PC görevi başlatılamadı: '+String(e.message||e).slice(0,650)};
    }
  }else if(n==='workspace_file_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:dosya|file|workspace|çalışma alanı|calisma alani|kopyala|copy|taşı|tasi|move|yeniden adlandır|yeniden adlandir)/i.test(intent)){
      return{ok:false,message:'Kalıcı workspace dosya görevi yalnızca açık dosya kopyalama/taşıma isteğiyle başlatılır.'};
    }
    try{
      const mission=createWorkspaceFileMission(a);
      const out=await runDurableMission(mission.id);
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(out.status==='needs_verification'?' · dosya durumu belirsiz; otomatik overwrite/silme yapılmadı':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı workspace dosya görevi başlatılamadı: '+String(e.message||e).slice(0,650)};
    }
  }else if(n==='mission_control'){
    const action=String(a.action||'').trim().toLowerCase();
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    const explicit=action==='pause'
      ?/(?:duraklat|beklet|pause)/i.test(intent)
      :action==='resume'
        ?/(?:devam|sürdür|surdur|resume)/i.test(intent)
        :action==='cancel'
          ?/(?:iptal|cancel|vazgeç|vazgec|sonlandır|sonlandir)/i.test(intent)
          :false;
    if(!explicit)return{ok:false,message:'Mission control için bu turda açık duraklat/devam/iptal ifadesi gerekli.'};
    try{
      const controlled=requestMissionControl({missionId:String(a.missionId||'').trim(),action});
      if(action==='resume'){
        const out=await runDurableMission(controlled.id);
        return{ok:out.status==='completed',message:'MISSION DEVAM · '+missionSummaryText(out)};
      }
      const pending=controlled.status==='running';
      return{ok:true,message:(pending?'MISSION KONTROL İSTEĞİ KAYDEDİLDİ':action==='pause'?'MISSION DURAKLATILDI':'MISSION İPTAL EDİLDİ')+' · '+missionSummaryText(controlled)};
    }catch(e){
      return{ok:false,message:'Mission control uygulanamadı: '+String(e.message||e).slice(0,650)};
    }
  }else if(n==='mission_status'){
    const latest=getMissionEngine().latestOpenMission(WORKSPACE)||getMissionEngine().listMissions(WORKSPACE,{limit:1})[0]||null;
    return{ok:true,message:missionSummaryText(latest)};
  }else if(n==='resume_latest_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:devam|sürdür|surdur|resume|görev|gorev|mission)/i.test(intent)){
      return{ok:false,message:'Kalıcı görevi sürdürmek için açık devam komutu gerekli.'};
    }
    const latest=getMissionEngine().latestOpenMission(WORKSPACE);
    if(!latest)return{ok:true,message:'Devam ettirilecek yarım görev yok.'};
    const out=await runDurableMission(latest.id);
    return{ok:out.status==='completed',message:missionSummaryText(out)};
  }else if(n==='approve_mission_action'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:onayla|onay ver|yayınla|yayinla|publish|mağazada yayınla|magazada yayinla)/i.test(intent)){
      return{ok:false,message:'Geri döndürülemez görev adımı için bu turda açık onay/yayınla ifadesi gerekli.'};
    }
    try{
      const approved=approveMissionGate({missionId:String(a.missionId||'').trim()});
      const out=await runDurableMission(approved.id);
      return{ok:out.status==='completed',message:'AÇIK ONAY UYGULANDI · '+missionSummaryText(out)};
    }catch(e){
      return{ok:false,message:'Görev onayı uygulanamadı: '+String(e.message||e).slice(0,600)};
    }
  }else if(n==='browser_form_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:tarayıcı|tarayici|browser|web|site|form|sayfa|youtube|shopify|doldur|hazırla|hazirla)/i.test(intent)){
      return{ok:false,message:'Kalıcı browser görevi yalnızca açık web/form hazırlama isteğiyle başlatılır.'};
    }
    try{
      const mission=createBrowserFormMission(a);
      const out=await runDurableMission(mission.id);
      const current=getMissionEngine().currentStep(out);
      const approvalWait=out.status==='waiting_dependency'&&current&&current.error&&current.error.dependency==='approval';
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(approvalWait?' · SON TIKLAMA İÇİN AÇIK ONAY BEKLİYOR':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı browser görevi başlatılamadı: '+String(e.message||e).slice(0,600)};
    }
  }else if(n==='developer_patch_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:uygulama|site|web|yazılım|yazilim|proje|app|kod|dosya)/i.test(intent)||!/(?:güncelle|guncelle|düzelt|duzelt|değiştir|degistir|revize|patch|onar|iyileştir|iyilestir|geliştir|gelistir)/i.test(intent)){
      return{ok:false,message:'Kalıcı proje patch görevi yalnızca açık güncelleme/düzeltme isteğiyle başlatılır.'};
    }
    try{
      const mission=createDeveloperPatchMission(a);
      const out=await runDurableMission(mission.id);
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(out.status==='completed'?' · SHA-256 doğrulandı ve rollback yedeği korundu':out.status==='failed'?' · çakışmada otomatik üzerine yazma yapılmadı; JARVIS değişiklikleri güvenli rollback kurallarına göre geri alındı':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı proje patch görevi başlatılamadı: '+String(e.message||e).slice(0,700)};
    }
  }else if(n==='developer_project_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:uygulama|site|web|yazılım|yazilim|proje|app|kod)/i.test(intent)||!/(?:oluştur|olustur|geliştir|gelistir|hazırla|hazirla|yap|kur)/i.test(intent)){
      return{ok:false,message:'Kalıcı geliştirici görevi yalnızca açık uygulama/proje isteğiyle başlatılır.'};
    }
    try{
      const mission=createDeveloperProjectMission(a);
      const out=await runDurableMission(mission.id);
      return{ok:out.status==='completed',message:missionSummaryText(out)+(out.status==='failed'?' · mevcut dosya çakışması varsa otomatik üzerine yazılmadı':'')};
    }catch(e){
      return{ok:false,message:'Kalıcı geliştirici görevi başlatılamadı: '+String(e.message||e).slice(0,700)};
    }
  }else if(n==='shopify_product_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:shopify|mağaza|magaza|ürün|urun|varova)/i.test(intent)||!/(?:ekle|hazırla|hazirla|oluştur|olustur|taslak|yap)/i.test(intent)){
      return{ok:false,message:'Kalıcı Shopify ürün görevi yalnızca açık mağaza/ürün isteğiyle başlatılır.'};
    }
    try{
      const mission=createShopifyProductMission(a);
      const out=await runDurableMission(mission.id);
      const current=getMissionEngine().currentStep(out);
      const approvalWait=out.status==='waiting_dependency'&&current&&current.error&&current.error.dependency==='approval';
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(approvalWait?' · YAYINLAMA İÇİN AÇIK ONAY BEKLİYOR':out.status==='waiting_dependency'?' · Shopify bağlantısı hazır olduğunda aynı görev kaldığı yerden devam eder':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı Shopify ürün görevi başlatılamadı: '+String(e.message||e).slice(0,600)};
    }
  }else if(n==='creator_web_media'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:internet|web|stok|stock|telifsiz|ücretsiz|ucretsiz|commons|pexels|pixabay|video|klip)/i.test(intent)){
      return{ok:false,message:'Creator Web Media yalnızca açık internet/stok medya isteğiyle çalışır.'};
    }
    try{
      const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
      if(!ready.ok||!ready.ffprobe)return{ok:false,message:'Web medya ingest için FFmpeg/FFprobe hazır değil.'};
      const out=await getCreatorWebMedia().searchAndIngest(WORKSPACE,{
        query:String(a.query||'').trim(),
        provider:String(a.provider||'auto'),
        orientation:String(a.orientation||'any'),
        count:Math.max(1,Math.min(12,Number(a.count)||3)),
        inspect:(rel)=>getCreatorEngine().inspectAsset(WORKSPACE,rel),
        animateImage:(rel,opts)=>getCreatorEngine().animateStillAsset(WORKSPACE,rel,opts)
      });
      return{ok:true,message:'CREATOR WEB MEDIA HAZIR · '+out.assets.length+' lisanslı klip · manifest '+out.manifest+' · '+out.assets.join(', ')+' · yayınlanmadı'};
    }catch(e){
      return{ok:false,message:'Creator Web Media alınamadı: '+String(e.message||e).slice(0,650)};
    }
  }else if(n==='creator_asset_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:creator|asset|video|klip|shorts?|reels?)/i.test(intent)||!/(?:ekle|aktar|içe\s*aktar|ice\s*aktar|hazırla|hazirla|kopyala|ingest)/i.test(intent)){
      return{ok:false,message:'Creator asset görevi yalnızca açık video/klip ingest isteğiyle başlatılır.'};
    }
    try{
      const mission=createCreatorAssetMission(a);
      const out=await runDurableMission(mission.id);
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(out.status==='waiting_dependency'?' · FFmpeg/FFprobe hazır olduğunda aynı görev devam eder':out.status==='needs_verification'?' · asset hash durumu doğrulanmadan tekrar edilmiyor':'')
      };
    }catch(e){
      return{ok:false,message:'Creator asset görevi başlatılamadı: '+String(e.message||e).slice(0,650)};
    }
  }else if(n==='creator_batch_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:video|shorts?|reels?|creator)/i.test(intent)||!/(?:toplu|batch|seri|birden fazla|hazırla|hazirla|oluştur|olustur|üret|uret|yap)/i.test(intent)){
      return{ok:false,message:'Creator batch görevi yalnızca açık toplu video üretim isteğiyle başlatılır.'};
    }
    try{
      if(Array.isArray(a.items)){
        const batchWebSeen=new Set();
        for(let i=0;i<a.items.length;i++){
          const item=a.items[i]&&typeof a.items[i]==='object'?a.items[i]:null;
          if(!item||Array.isArray(item.creatorAssets)&&item.creatorAssets.length||item.webMediaAuto===false)continue;
          const assets=await creatorAutoWebAssets({
            title:String(item.youtubeTitle||item.campaignName||''),
            script:String(item.script||''),
            query:String(item.webMediaQuery||''),
            provider:String(item.webMediaProvider||'auto'),
            orientation:'portrait',
            count:5,
            maxQueries:2,
            manifestId:'batch-'+Date.now()+'-'+String(i+1).padStart(2,'0'),
            excludePaths:[...batchWebSeen]
          });
          if(assets.length){
            item.creatorAssets=assets;
            for(const rel of assets)batchWebSeen.add(String(rel||'').replace(/\\/g,'/'));
          }
        }
      }
      const mission=createCreatorBatchMission(a);
      const out=await runDurableMission(mission.id);
      return{
        ok:!['failed','cancelled'].includes(String(out.status||'')),
        message:missionSummaryText(out)+(out.status==='waiting_dependency'?' · render child scheduler üzerinden tamamlanınca aynı batch kaldığı yerden devam eder':out.status==='needs_verification'?' · child görev sonucu doğrulanmadan batch tekrar etmiyor':out.status==='completed'?' · batch tamamlandı':' · batch scheduler sırasına alındı')
      };
    }catch(e){
      return{ok:false,message:'Creator batch görevi başlatılamadı: '+String(e.message||e).slice(0,700)};
    }
  }else if(n==='creator_longform_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:youtube|video|uzun|long\s*-?form|10\s*(?:dk|dakika)|belgesel)/i.test(intent)||!/(?:hazırla|hazirla|oluştur|olustur|üret|uret|yap|yükle|yukle|yayınla|yayinla|publish)/i.test(intent)){
      return{ok:false,message:'Kalıcı long-form görevi yalnızca açık uzun video üretim isteğiyle başlatılır.'};
    }
    if(a.publish===true&&!/(?:youtube.{0,40}(?:yayınla|yayinla|publish|public)|(?:yayınla|yayinla|publish|public).{0,40}youtube)/i.test(intent)){
      return{ok:false,message:'YouTube PUBLIC adımını sıraya koymak için bu turda açık yayınlama isteği gerekli.'};
    }
    try{
      if((!Array.isArray(a.creatorAssets)||!a.creatorAssets.length)&&a.webMediaAuto!==false){
        const assets=await creatorAutoWebAssets({
          title:String(a.youtubeTitle||a.campaignName||''),
          script:String(a.script||''),
          query:String(a.webMediaQuery||''),
          provider:String(a.webMediaProvider||'auto'),
          orientation:'landscape',
          count:12,
          maxQueries:4,
          manifestId:'long-'+Date.now()
        });
        if(assets.length)a.creatorAssets=assets;
      }
      const mission=createCreatorLongformMission(a);
      return{ok:true,message:missionSummaryText(mission)+' · long-form görev scheduler sırasına alındı'+(Array.isArray(a.creatorAssets)&&a.creatorAssets.length?' · '+a.creatorAssets.length+' Creator klip kilitlendi':'')+(a.includeYouTube===true?' · YouTube yalnız DRAFT hazırlanacak':'')+(a.publish===true?' · PUBLIC için ayrıca approval gate beklenecek':' · PUBLIC yayın yok')};
    }catch(e){
      return{ok:false,message:'Kalıcı long-form görevi başlatılamadı: '+String(e.message||e).slice(0,700)};
    }
  }else if(n==='creator_daily_longform_plan'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:her\s*gün|günlük|gunluk|daily|günde\s*1|gunde\s*1)/i.test(intent)){
      return{ok:false,message:'Günlük Creator planı yalnızca açık günlük üretim isteğiyle değiştirilebilir.'};
    }
    try{
      const plan=configureCreatorDailyPlan(a);
      return{ok:true,message:'CREATOR DAILY LONGFORM '+(plan.enabled?'ENABLED':'DISABLED')+' · timezone '+plan.timezone+' · dil '+plan.language+' · YouTube '+(plan.includeYouTube?'DRAFT':'kapalı')+' · PUBLIC otomasyonu yok'+(plan.lastMissionId?' · son mission '+plan.lastMissionId:'')};
    }catch(e){
      return{ok:false,message:'Günlük Creator planı güncellenemedi: '+String(e.message||e).slice(0,700)};
    }
  }else if(n==='creator_short_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:video|shorts?|reels?|youtube)/i.test(intent)||!/(?:hazırla|hazirla|oluştur|olustur|üret|uret|yap|yükle|yukle|yayınla|yayinla|publish)/i.test(intent)){
      return{ok:false,message:'Kalıcı Short görevi yalnızca açık video üretim isteğiyle başlatılır.'};
    }
    if(a.publish===true&&!/(?:youtube.{0,40}(?:yayınla|yayinla|publish|public)|(?:yayınla|yayinla|publish|public).{0,40}youtube|shorts?.{0,30}(?:yayınla|yayinla|publish|public)|(?:yayınla|yayinla|publish|public).{0,30}shorts?)/i.test(intent)){
      return{ok:false,message:'YouTube PUBLIC adımını sıraya koymak için bu turda açık yayınlama isteği gerekli.'};
    }
    try{
      if((!Array.isArray(a.creatorAssets)||!a.creatorAssets.length)&&a.webMediaAuto!==false){
        const assets=await creatorAutoWebAssets({
          title:String(a.youtubeTitle||a.campaignName||''),
          script:String(a.script||''),
          query:String(a.webMediaQuery||''),
          provider:String(a.webMediaProvider||'auto'),
          orientation:'portrait',
          count:5,
          maxQueries:3,
          manifestId:'short-'+Date.now()
        });
        if(assets.length)a.creatorAssets=assets;
      }
      const mission=createCreatorShortMission(a);
      const out=await runDurableMission(mission.id);
      const current=getMissionEngine().currentStep(out);
      const approvalWait=out.status==='waiting_dependency'&&current&&current.error&&current.error.dependency==='approval';
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(approvalWait?' · YOUTUBE PUBLIC İÇİN AYRI AÇIK ONAY BEKLİYOR':out.status==='waiting_dependency'?' · gerekli bağlantı hazır olduğunda aynı görev kaldığı yerden devam eder':'')
      };
    }catch(e){
      return{ok:false,message:'Kalıcı Short görevi başlatılamadı: '+String(e.message||e).slice(0,600)};
    }
  }else if(n==='varova_campaign_mission'){
    const intent=String(userText||'').toLocaleLowerCase('tr-TR');
    if(!/(?:varova|mağaza|magaza|shopify|youtube|video|shorts?)/i.test(intent)||!/(?:hazırla|hazirla|oluştur|olustur|ekle|yükle|yukle|yap|yayınla|yayinla|publish)/i.test(intent)){
      return{ok:false,message:'Kalıcı kampanya görevi yalnızca açık iş isteğiyle başlatılır.'};
    }
    if(a.publishYouTube===true&&!/(?:youtube.{0,40}(?:yayınla|yayinla|publish|public)|(?:yayınla|yayinla|publish|public).{0,40}youtube|shorts?.{0,30}(?:yayınla|yayinla|publish|public)|(?:yayınla|yayinla|publish|public).{0,30}shorts?)/i.test(intent)){
      return{ok:false,message:'YouTube PUBLIC adımını sıraya koymak için bu turda açık yayınlama isteği gerekli.'};
    }
    try{
      if((!Array.isArray(a.creatorAssets)||!a.creatorAssets.length)&&a.webMediaAuto!==false){
        const assets=await creatorAutoWebAssets({
          title:String(a.youtubeTitle||a.productTitle||a.campaignName||'VAROVA'),
          script:String(a.script||''),
          query:String(a.webMediaQuery||''),
          provider:String(a.webMediaProvider||'auto'),
          orientation:'portrait',
          count:5,
          maxQueries:2,
          manifestId:'varova-'+Date.now()
        });
        if(assets.length)a.creatorAssets=assets;
      }
      const mission=createVarovaCampaignMission(a);
      const out=await runDurableMission(mission.id);
      const current=getMissionEngine().currentStep(out);
      const approvalWait=out.status==='waiting_dependency'&&current&&current.error&&current.error.dependency==='approval';
      return{
        ok:out.status==='completed',
        message:missionSummaryText(out)+(approvalWait?' · YOUTUBE PUBLIC İÇİN AYRI AÇIK ONAY BEKLİYOR':out.status==='waiting_dependency'?' · gerekli bağlantı tamamlanınca aynı görev kaldığı yerden devam eder':'')
      };
    }catch(e){
      return{ok:false,message:'Kampanya görevi başlatılamadı: '+String(e.message||e).slice(0,600)};
    }
  }else if(n==='workspace_search'){
    const query=String(a.query||'').replace(/[\r\n]/g,' ').trim().slice(0,240);
    command=query?'dosyalarda ara '+query:'';
  }else if(n==='workspace_read'){
    return safeWorkspaceReadForAgent(a.path);
  }else{
    return{ok:false,message:'Bilinmeyen yerel araç engellendi: '+n};
  }

  if(!command||!isLocalSafeControlCommand(command)){
    return{ok:false,message:'Güvenli olmayan veya geçersiz yerel araç isteği engellendi.'};
  }
  const result=await execute({command});
  return result||{ok:false,message:'Araç sonucu alınamadı.'};
}
async function runNativeAgent(message,{maxRounds=4,signal=null}={}){
  const cancelledResult=(actions=[],rounds=0)=>({
    ok:false,error:'CANCELLED',cancelled:true,model:LOCAL_BRAIN_MODEL,
    actions:Array.isArray(actions)?actions:[],rounds,nativeTools:true
  });
  if(signal&&signal.aborted)return cancelledResult([],0);
  const originalText=String(message||'').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!originalText)return{ok:true,type:'chat',reply:'Sizi dinliyorum Cihan Bey.',tone:'balanced',actions:[]};

  const lexiconDirective=handleSpeechLexiconDirective(originalText);
  if(lexiconDirective.handled){
    appendLocalBrainHistory('user',originalText);
    appendLocalBrainHistory('assistant',lexiconDirective.reply);
    return{ok:true,type:'chat',reply:lexiconDirective.reply,tone:lexiconDirective.tone||'warm',actions:[],model:'local-speech-lexicon'};
  }

  const text=applySpeechLexicon(originalText);

  const interruptedSpeechResume=deterministicInterruptedSpeechResume(text);
  if(interruptedSpeechResume){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',interruptedSpeechResume.reply);
    return{ok:true,type:'chat',reply:interruptedSpeechResume.reply,tone:interruptedSpeechResume.tone||'balanced',actions:[],model:interruptedSpeechResume.model,resumed:true,resumeSource:'tts'};
  }
  const interruptionContext=interruptedStreamResumeContext(text);
  if(!interruptionContext)clearInterruptedStateForNewTurn(text);

  const dialogueFeedbackDirective=applyDialogueFeedback(text);
  if(dialogueFeedbackDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',dialogueFeedbackDirective.reply);
    return{ok:true,type:'chat',reply:dialogueFeedbackDirective.reply,tone:dialogueFeedbackDirective.tone||'warm',actions:[],model:'local-dialogue-feedback',dialoguePreferences:dialogueFeedbackDirective.preferences};
  }

  const voicePreferenceDirective=handleVoicePreferenceDirective(text);
  if(voicePreferenceDirective.handled){
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',voicePreferenceDirective.reply);
    return{ok:true,type:'chat',reply:voicePreferenceDirective.reply,tone:voicePreferenceDirective.tone||'warm',actions:[],model:'local-voice-preference',voicePreferences:voicePreferenceDirective.voicePreferences};
  }

  if(signal&&signal.aborted)return cancelledResult([],0);
  const status=await localBrainStatus();
  if(signal&&signal.aborted)return cancelledResult([],0);
  if(!status.ready)return{ok:false,error:'OLLAMA_OFFLINE',model:LOCAL_BRAIN_MODEL};
  if(!status.installed)return{ok:false,error:'MODEL_NOT_INSTALLED',model:LOCAL_BRAIN_MODEL};

  const persona=updateBrainPersonaFromUserText(text);
  maybeRememberExplicitPreference(text);
  const recent=recentBrainHistory(10);
  const turnStyle=inferBrainTurnStyle(text,persona);
  const socialPolicy=inferConversationSocialPolicy(text,recent,persona);
  const cadence=inferConversationCadence(text,recent,persona);
  const deepRequested=shouldDeepReflect(text);
  const agentModel=(deepRequested&&status.deepInstalled&&status.deepModel)?status.deepModel:LOCAL_BRAIN_MODEL;
  const repairContext=conversationRepairContext(text,recent);
  const memory=relevantBrainMemory(text,5);
  const memoryText=memory.length
    ? memory.map(x=>'- '+(x.role==='memory'?'Hatırlanan tercih':x.role==='episode'?'Eski sohbet özeti':'Önceki konuşma')+': '+x.text).join('\n')
    : '- İlgili eski kayıt yok.';

  const system=[
    'Sen JARVIS\'sin; Cihan Bey\'in kişisel yerel yapay zeka asistanısın.',
    'Doğal Türkçe konuş; kısa soruya kısa cevap, iş sorusuna net cevap ver. Uygun olduğunda kısa espri yap ama yapmacık olma.',
    'Native tool loop da yerel ses sözlüğünden geçirilmiş kullanıcı metnini esas alır; yanlış duyulan eski ifadeyi geri üretme.',
    'Elindeki yerel araçları yalnızca gerçekten gerektiğinde kullan. Araç kullanmadan cevap verebiliyorsan doğrudan cevap ver.',
    'Bir araç sonucuna göre başka bir araca ihtiyaç varsa sonucu gördükten sonra ikinci aracı çağır. Körlemesine peş peşe araç çağırma.',
    'Video üretiminde creator_render_short yerel MP4 oluşturur ama yayınlamaz. Kullanıcı yalnızca fikir soruyorsa bu aracı çağırma.',
    'Kullanıcı tek seferlik değil, tamamlanana kadar sürecek bir Short/Reels üretimi isterse creator_short_mission kullan; bu görev disk üzerinde kalır, kesintiden sonra devam eder ve YouTube istenirse sadece Studio taslağına kadar gider.',
    'Mağaza işlerinde önce shopify_status ile bağlantıyı kontrol edebilirsin. shopify_create_draft yalnızca DRAFT ürün oluşturur; eksik fiyat, SKU veya görseli uydurma.',
    'Kullanıcı bir ürünü mağazaya ekleme işinin tamamlanana kadar sürmesini istiyorsa shopify_product_mission kullan; görev disk üzerinde kalır, bağlantı yoksa bekler ve aynı ürünü mission etiketiyle kopya oluşturmadan sürdürür.',
    'Kullanıcı uygulama/site/yazılım geliştirmeyi istediğinde developer_project_mission kullan. Bu araç kaynak dosyaları yalnızca JARVIS workspace içine yazar, mevcut farklı dosyanın üzerine otomatik yazmaz ve deploy etmez; böylece geliştirme görevi kesintiden sonra güvenle devam eder.',
    'Kullanıcı mevcut bir workspace projesini düzeltmek/güncellemek istediğinde önce workspace_search/workspace_read ile gerçek dosyayı oku, sonra developer_patch_mission kullan. Tam yeni dosya içeriğini ver; araç başlangıç SHA-256 hashini kilitler, dış değişiklikte üzerine yazmaz, rollback yedeği alır ve JS/JSON için güvenli syntax doğrulaması yapar. .env, secret, credential gibi hassas yolları patch etme ve bu araçla deploy yapma.',
    'İzinli bir web sayfasında alanları doldurup işi kesintiden sonra sürdürülebilir hazırlamak için browser_form_mission kullan. Hassas şifre/token/kart alanlarını göreve koyma. finalClick varsa görev approval gate üzerinde durur; public publish, ödeme, silme veya hesap kapatma gibi yüksek riskli eylemler generic browser göreviyle yapılmaz.',
    'Shopify ürününü halka açık mağazada yayınlama iki aşamalıdır: shopify_product_mission publish=true yalnızca yayınlama isteğini sıraya koyar ve approval gate üzerinde durur. Kullanıcı daha sonra aynı turda açıkça "onayla" veya "yayınla" demeden approve_mission_action çağırma. "Devam et" tek başına yayınlama onayı değildir.',
    'YouTube için youtube_prepare_draft_upload yalnızca dosyayı Studio yükleme ekranına koyar ve metadata hazırlar; doğrudan PUBLIC yayın aracı değildir.',
    'Kalıcı creator_short_mission publish=true veya varova_campaign_mission publishYouTube=true yalnızca PUBLIC adımını approval gate arkasına sıraya koyar. Taslak hazırlandıktan sonra kullanıcı ayrı bir turda açıkça "onayla/yayınla/publish" demeden approve_mission_action çağırma. "Devam et" tek başına YouTube PUBLIC onayı değildir.',
    'Kullanıcı aynı istekte Short üretip YouTube taslağına yüklemenizi isterse önce creator_render_short sonucundaki gerçek output yolunu al, sonra youtube_prepare_draft_upload çağır. Dosya yolu uydurma.',
    'Bir istek VAROVA ürünü + reklam videosu + YouTube taslağı gibi birden fazla dış adım içeriyorsa ayrı ayrı araç çağırmak yerine varova_campaign_mission kullan; böylece görev disk üzerinde kalıcı olur ve kesintiden sonra devam eder.',
    'Workspace içindeki gerçek video kliplerini Creator havuzuna almak için creator_asset_mission kullan. Kaynağı silme; asset FFprobe doğrulaması + SHA-256 kopya doğrulaması geçmeden Creator asset kabul etme.',
    'Kullanıcı 2-10 Shorts/Reels videosunu tek kalıcı iş olarak üretmek isterse creator_batch_mission kullan. Her item kendi creatorAssets sırasını korur ve hash baseline değişirse render durur. Batch önce tüm renderları scheduler ile tamamlar; includeYouTube=true ise sonra ayrı DRAFT yüklemelerine geçer. Batch PUBLIC yayınlamaz.',
    'Kullanıcı belirli Creator kliplerini veya sahne sırasını istiyorsa creator_short_mission / varova_campaign_mission içindeki creatorAssets alanını kullan. Yalnızca creator-assets/... yollarını ver; sıralamayı değiştirme ve seçili asset hash doğrulaması geçmezse render etme.',
    'Birden fazla güvenli yerel PC işi sırayla yapılacaksa veya iş restart sonrası sürmeliyse pc_safe_mission kullan. Yalnızca durum sorgusu, allowlist uygulama/site açma ve medya kontrollerini sıraya koy; shell/PowerShell, keyfi exe/path, silme, ödeme, public publish veya hesap değişikliği ekleme.',
    'Workspace içindeki mevcut dosyaları kopyalama/taşıma işi restart sonrası sürmeli veya birden fazla dosyayı kapsıyorsa workspace_file_mission kullan. Hedefin üzerine yazma, workspace/internal/hassas yolları kullanma, bağımsız silme işlemi yapma. move yalnızca hedef hash doğrulandıktan sonra kaynak kaldırma anlamına gelir.',
    'Kullanıcı kalıcı görevi açıkça duraklatmak, devam ettirmek veya iptal etmek isterse mission_control kullan. Running dış yan etkiyi zorla kesme; güvenli adım sınırında uygula. Birden fazla uygun görev varsa missionId olmadan seçim yapma.',
    'Kullanıcı yarım işi "devam et", "kaldığın yerden sürdür" gibi ifadeyle sürdürmek isterse önce mission_status veya doğrudan resume_latest_mission kullan. Tamamlanmış adımı yeniden yapma.',
    'Kalıcı görev needs_verification durumundaysa belirsiz dış yan etkiyi otomatik tekrar etme; kopya ürün veya kopya video riski yerine doğrulamayı bekle.',
    'Kullanıcı bilgisayar testi, JARVIS testi, hazır mı veya kabul testi isterse pc_acceptance_snapshot kullan; bu salt-okunur denetimdir ve dış hesaplarda değişiklik yapmaz.',
    'Kullanıcı açıkça "kendini düzelt", "JARVIS onar" veya benzeri onarım talebi verirse pc_self_repair kullan. Bu araç yalnızca yerel runtime/startup/Creator bileşenlerini onarır; hesaplarda içerik oluşturmaz veya yayınlamaz.',
    'Araç sonuçlarında olmayan bilgiyi uydurma. Bir eylem başarısızsa başarılı olmuş gibi konuşma.',
    'workspace_read kullanmadan önce mümkünse workspace_search ile doğru dosya yolunu bul.',
    'Gizli dosya, parola, token, anahtar veya credential aramaya çalışma.',
    'screen_describe aracını yalnızca kullanıcı mevcut ekrana bakmanı açıkça istediğinde kullan. Kendiliğinden ekran görüntüsü alma.',
    'Kullanıcı tehlikeli, katalog dışı veya geri döndürülemez bir PC eylemi isterse araç çağırma; bu eylemin bağlı olmadığını kısa söyle.',
    'Cihan Bey hitabını ara sıra kullan; her cevapta tekrarlama.',
    'Bu tur konuşma modu: '+turnStyle.mode+'. '+turnStyle.instruction,
    socialPolicyPrompt(socialPolicy),
    conversationCadencePrompt(cadence),
    interruptionContext||'Bu turda devam ettirilecek kesilmiş bir JARVIS cevabı yok.',
    repairContext||'Bu tur için özel bir konuşma onarım talebi yok.',
    'İlgili yerel hafıza:\n'+memoryText
  ].join(' ');

  const messages=[
    {role:'system',content:system},
    ...recent.map(x=>({role:x.role,content:x.content})),
    {role:'user',content:text}
  ];
  const tools=nativeAgentTools();
  const actions=[];
  const seenCalls=new Set();
  const started=Date.now();

  for(let round=0;round<Math.max(1,Math.min(6,Number(maxRounds)||4));round++){
    if(signal&&signal.aborted)return cancelledResult(actions,round);
    let timedOut=false;
    const ctl=new AbortController(),timer=setTimeout(()=>{timedOut=true;ctl.abort()},45000);
    const externalAbort=()=>{try{ctl.abort()}catch(_){}};
    if(signal)signal.addEventListener('abort',externalAbort,{once:true});
    let j;
    try{
      const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          model:agentModel,
          stream:false,
          think:deepRequested,
          keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
          options:{
            temperature:deepRequested?0.32:0.42,
            top_p:0.9,
            repeat_penalty:1.08,
            num_ctx:LOCAL_BRAIN_CTX,
            num_predict:deepRequested?Math.max(420,cadence.agentPredict):cadence.agentPredict
          },
          messages,
          tools
        }),
        signal:ctl.signal
      });
      clearTimeout(timer);
      if(signal)signal.removeEventListener('abort',externalAbort);
      j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    }catch(e){
      clearTimeout(timer);
      if(signal)signal.removeEventListener('abort',externalAbort);
      if(signal&&signal.aborted){
        remember({kind:'native_agent_cancelled',actions:actions.length,round:round+1});
        return cancelledResult(actions,round+1);
      }
      if(timedOut&&e.name==='AbortError'){
        remember({kind:'native_agent_timeout',actions:actions.length,round:round+1});
      }
      if(actions.length){
        const summaries=actions.map(x=>(x.ok?'OK ':'FAIL ')+x.tool+': '+x.result).slice(-6);
        appendLocalBrainHistory('user',text);
        const final=await finalizeToolReply(text,summaries,actions.some(x=>!x.ok)?'warm':'focused');
        remember({kind:'native_agent_post_tool_recovery',actions:actions.length,error:String(e.message||e).slice(0,180)});
        return{
          ok:true,type:'chat',
          reply:String(final&&final.reply||summaries.join('. ')),
          tone:String(final&&final.tone||(actions.some(x=>!x.ok)?'warm':'focused')),
          model:agentModel,fastModel:LOCAL_BRAIN_MODEL,actions,rounds:round+1,nativeTools:true,reasoning:deepRequested?'deep':'fast',repairMode:!!repairContext,socialMode:socialPolicy.mode,followupAllowed:socialPolicy.followupAllowed,recovered:true,
          latencyMs:Date.now()-started
        };
      }
      return{ok:false,error:String(e.message||e),model:LOCAL_BRAIN_MODEL,actions};
    }

    const msg=j&&j.message&&typeof j.message==='object'?j.message:{};
    const toolCalls=Array.isArray(msg.tool_calls)?msg.tool_calls.filter(Boolean):[];
    if(!toolCalls.length){
      const reply=normalizeBrainReply(msg.content);
      appendLocalBrainHistory('user',text);
      appendLocalBrainHistory('assistant',reply);
      if(interruptionContext)clearInterruptedConversationState('stream-resumed-by-agent');
      remember({kind:'native_agent_final',rounds:round+1,actions:actions.length,model:agentModel,fastModel:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started});
      return{
        ok:true,type:'chat',reply,tone:turnStyle.mode,model:agentModel,fastModel:LOCAL_BRAIN_MODEL,
        actions,rounds:round+1,nativeTools:true,reasoning:deepRequested?'deep':'fast',repairMode:!!repairContext,socialMode:socialPolicy.mode,followupAllowed:socialPolicy.followupAllowed,resumed:!!interruptionContext,resumeSource:interruptionContext?'stream':null,latencyMs:Date.now()-started
      };
    }

    messages.push({
      role:'assistant',
      content:String(msg.content||''),
      tool_calls:toolCalls
    });

    for(const tc of toolCalls.slice(0,3)){
      if(signal&&signal.aborted){
        remember({kind:'native_agent_cancelled_before_tool',actions:actions.length,round:round+1});
        return cancelledResult(actions,round+1);
      }
      const fn=tc&&tc.function||{};
      const name=String(fn.name||'');
      let args=fn.arguments&&typeof fn.arguments==='object'?fn.arguments:{};
      if(typeof fn.arguments==='string'){
        try{args=JSON.parse(fn.arguments)}catch(_){args={}}
      }
      const signature=nativeToolSignature(name,args);
      let result;
      if(seenCalls.has(signature)){
        result={ok:false,message:'Aynı araç çağrısı tekrarlandı; döngüyü önlemek için engellendi.'};
      }else{
        seenCalls.add(signature);
        result=await executeNativeAgentTool(name,args,{userText:text});
      }
      if(signal&&signal.aborted){
        actions.push({tool:name,args,ok:!!(result&&result.ok),result:String(result&&result.message||'Araç sonucu yok.').slice(0,900)});
        remember({kind:'native_agent_cancelled_after_tool',actions:actions.length,round:round+1});
        return cancelledResult(actions,round+1);
      }
      const content=String(result&&result.message||'Araç sonucu yok.').slice(0,7000);
      actions.push({tool:name,args,ok:!!(result&&result.ok),result:content.slice(0,900)});
      messages.push({role:'tool',content,tool_name:name});
    }
  }

  const summaries=actions.map(x=>(x.ok?'OK ':'FAIL ')+x.tool+': '+x.result).slice(-6);
  appendLocalBrainHistory('user',text);
  const final=await finalizeToolReply(text,summaries,actions.some(x=>!x.ok)?'warm':'focused');
  remember({kind:'native_agent_bounded_stop',actions:actions.length,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started});
  return{
    ok:true,type:'chat',
    reply:String(final&&final.reply||summaries.join('. ')||'Araç döngüsü güvenli sınırda durduruldu.'),
    tone:String(final&&final.tone||(actions.some(x=>!x.ok)?'warm':'focused')),
    model:LOCAL_BRAIN_MODEL,actions,rounds:maxRounds,nativeTools:true,reasoning:deepRequested?'deep':'fast',bounded:true,
    latencyMs:Date.now()-started
  };
}
function shouldReflectToolResult(command,message,resultCount=1){
  const c=String(command||'').toLocaleLowerCase('tr-TR');
  const m=String(message||'');
  return resultCount>1
    || /(?:durumu|status|dosyalarda ara|workspace search|işlemleri listele|islemleri listele|process list|yerel ai)/i.test(c)
    || m.length>150;
}
async function finalizeToolReply(userMessage,toolResults,toneHint='focused'){
  const userText=String(userMessage||'').replace(/\s+/g,' ').trim().slice(0,1800);
  const results=(Array.isArray(toolResults)?toolResults:[toolResults])
    .map(x=>String(x||'').replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .slice(0,4);
  if(!results.length)return{ok:false,error:'NO_TOOL_RESULTS'};

  const rawReply=results.join('. ').replace(/\s+/g,' ').trim().slice(0,900);
  const commandHint=userText;
  if(!shouldReflectToolResult(commandHint,rawReply,results.length)){
    appendLocalBrainHistory('assistant',rawReply);
    remember({kind:'tool_result_final',reflected:false,results:results.length,tone:toneHint});
    return{ok:true,reply:rawReply,tone:toneHint,model:'deterministic-tool-finalizer',latencyMs:0,reflected:false};
  }

  const status=await localBrainStatus();
  if(!status.ready||!status.installed){
    appendLocalBrainHistory('assistant',rawReply);
    return{ok:true,reply:rawReply,tone:toneHint,model:'tool-fallback',latencyMs:0,reflected:false};
  }

  const recent=recentBrainHistory(8);
  const allowedTones=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'];
  const schema={
    type:'object',
    properties:{
      reply:{type:'string'},
      tone:{type:'string',enum:allowedTones}
    },
    required:['reply','tone'],
    additionalProperties:false
  };
  const system=[
    'Sen JARVIS\'sin. Bir araç veya bilgisayar eylemi az önce gerçekten çalıştırıldı ve aşağıda doğrulanmış sonuçları var.',
    'Kullanıcıya yalnızca bu gerçek sonuçlara dayanarak doğal Türkçe ile, insan gibi ve kısa biçimde cevap ver.',
    'Sonuçlarda olmayan bilgi, sayı veya başarı uydurma.',
    'Ham teknik metni sesli konuşmaya uygun hale getir.',
    'Durum, arama veya çok adımlı sonuçlarda önemli noktaları seç; ekrandaki her satırı okumaya çalışma.',
    'Uygunsa tek kısa espri kullanabilirsin; sonucu gölgelememeli.',
    'Cihan Bey hitabını ara sıra kullan, her turda kullanma.',
    'SADECE JSON şemasına uy.'
  ].join(' ');
  const toolBlock=results.map((x,i)=>'SONUÇ '+(i+1)+': '+x).join('\n');
  const body={
    model:LOCAL_BRAIN_MODEL,
    stream:false,
    think:false,
    format:schema,
    keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
    options:{temperature:0.42,top_p:0.88,repeat_penalty:1.08,num_ctx:3072,num_predict:170},
    messages:[
      {role:'system',content:system},
      ...recent.map(x=>({role:x.role,content:x.content})),
      {role:'user',content:'İstek: '+userText+'\n'+toolBlock}
    ]
  };

  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
  const started=Date.now();
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    clearTimeout(timer);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.reply)throw new Error('TOOL_REFLECTION_BAD_JSON');
    const reply=normalizeBrainReply(parsed.reply);
    const tone=allowedTones.includes(String(parsed.tone||''))?String(parsed.tone):toneHint;
    appendLocalBrainHistory('assistant',reply);
    remember({kind:'tool_result_final',reflected:true,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,results:results.length,tone});
    return{ok:true,reply,tone,model:LOCAL_BRAIN_MODEL,latencyMs:Date.now()-started,reflected:true};
  }catch(e){
    clearTimeout(timer);
    appendLocalBrainHistory('assistant',rawReply);
    remember({kind:'tool_result_final',reflected:false,error:String(e.message||e).slice(0,180),results:results.length,tone:toneHint});
    return{ok:true,reply:rawReply,tone:toneHint,model:'tool-fallback',latencyMs:Date.now()-started,reflected:false};
  }
}
function isStreamableConversation(message){
  const s=String(message||'').replace(/\s+/g,' ').trim();
  if(!s||s.length>700)return false;
  if(shouldDeepReflect(s)||isContextRecallQuery(s))return false;
  if(looksLikeVoicePreferenceDirective(s))return false;
  if(dialogueFeedbackIntent(s))return false;
  if(isLocalSafeControlCommand(s))return false;
  const k=s.toLocaleLowerCase('tr-TR');
  if(/\b(?:hatırla|hatirla|unut|dediğimde|dedigimde|dersem|düzeltmesini|duzeltmesini)\b/.test(k))return false;
  if(/\b(?:(?:aç|ac)(?:ar|abilir)?|kapat(?:ır|ir|abilir)?|başlat(?:ır|ir|abilir)?|baslat(?:ir|abilir)?|çalıştır(?:ır|ir|abilir)?|calistir(?:ir|abilir)?|gir(?:er|ebilir)?|ayar|ayarlar|sesi|sesini|pil|batarya|disk|ağ|ag|wifi|bluetooth|dosya|klasör|klasor|ekran|kamera|görev yöneticisi|gorev yoneticisi|workspace|terminal|powershell)\b/.test(k))return false;
  return true;
}
function streamingConversationSystem(text,recent=[]){
  const persona=updateBrainPersonaFromUserText(text);
  maybeRememberExplicitPreference(text);
  const turnStyle=inferBrainTurnStyle(text,persona);
  const socialPolicy=inferConversationSocialPolicy(text,recent,persona);
  const cadence=inferConversationCadence(text,recent,persona);
  const repairContext=conversationRepairContext(text,recent);
  const memory=relevantBrainMemory(text,4);
  const memoryText=memory.length
    ?memory.map(x=>'- '+(x.role==='memory'?'Hatırlanan tercih':x.role==='episode'?'Eski sohbet özeti':'Önceki konuşma')+': '+x.text).join('\n')
    :'- İlgili eski kayıt yok.';
  return{
    tone:turnStyle.mode,
    temperature:turnStyle.temperature,
    repairMode:!!repairContext,
    socialMode:socialPolicy.mode,
    followupAllowed:socialPolicy.followupAllowed,
    socialMomentum:socialPolicy.momentumCarried===true,
    momentumMode:socialPolicy.momentumMode||null,
    momentumStrength:Number(socialPolicy.momentumStrength||0),
    cadenceMode:cadence.mode,
    targetWords:cadence.targetWords,
    numPredict:cadence.streamPredict,
    system:[
      'Sen JARVIS\'sin; Cihan Bey\'in uzun süreli kişisel yerel yapay zeka asistanısın.',
      'Bu kanal yalnızca doğal sohbet içindir. Bilgisayarda eylem yapma, eylem yaptığını söyleme veya araç kullandığını iddia etme.',
      'Türkçe, doğal, sıcak ve akıcı konuş. Robotik kalıp açılışlardan, gereksiz resmiyetten ve her cevapta Cihan Bey demekten kaçın.',
      'Kısa soruya kısa cevap ver. Kullanıcı şakalaşıyorsa hafif gırgır yap; ciddi soruda hızla ciddileş.',
      'Sesli okunacağı için düz yazı kullan; gereksiz markdown, başlık ve uzun liste kullanma.',
      'Bilmediğin şeyi uydurma. Yerel hafızadaki bilgiyi yalnızca ilgiliyse kullan.',
      'Bu tur modu: '+turnStyle.mode+'. '+turnStyle.instruction,
      socialPolicyPrompt(socialPolicy),
      conversationCadencePrompt(cadence),
      repairContext||'Bu tur için özel bir konuşma onarım talebi yok.',
      'İlgili yerel hafıza:\n'+memoryText
    ].join(' ')
  };
}
async function streamLocalConversationHttp(message,res){
  const original=String(message||'').replace(/\s+/g,' ').trim().slice(0,700);
  const text=applySpeechLexicon(original);
  clearInterruptedStateForNewTurn(text);
  if(!isStreamableConversation(text)){
    const e=new Error('NOT_STREAMABLE');e.code='NOT_STREAMABLE';throw e;
  }
  const status=await localBrainStatus();
  if(!status.ready){const e=new Error('OLLAMA_OFFLINE');e.code='OLLAMA_OFFLINE';throw e}
  if(!status.installed){const e=new Error('MODEL_NOT_INSTALLED');e.code='MODEL_NOT_INSTALLED';throw e}

  const recent=recentBrainHistory(10);
  const cfg=streamingConversationSystem(text,recent);
  const ctl=new AbortController();
  const timeout=setTimeout(()=>ctl.abort(),60000);
  let upstream;
  const started=Date.now();
  try{
    upstream=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:LOCAL_BRAIN_MODEL,
        stream:true,
        think:false,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{
          temperature:cfg.temperature,
          top_p:0.9,
          repeat_penalty:1.08,
          num_ctx:LOCAL_BRAIN_CTX,
          num_predict:cfg.numPredict
        },
        messages:[
          {role:'system',content:cfg.system},
          ...recent.map(x=>({role:x.role,content:x.content})),
          {role:'user',content:text}
        ]
      }),
      signal:ctl.signal
    });
    if(!upstream.ok)throw new Error('OLLAMA '+upstream.status);
  }catch(e){
    clearTimeout(timeout);
    throw e;
  }

  res.writeHead(200,{
    'content-type':'application/x-ndjson; charset=utf-8',
    'cache-control':'no-store, no-transform',
    'x-accel-buffering':'no'
  });
  const write=obj=>{
    if(res.destroyed||res.writableEnded)return false;
    try{return res.write(JSON.stringify(obj)+'\n')}catch(_){return false}
  };
  write({type:'meta',ok:true,model:LOCAL_BRAIN_MODEL,tone:cfg.tone,streaming:true,repairMode:cfg.repairMode===true,socialMode:cfg.socialMode,followupAllowed:cfg.followupAllowed===true,socialMomentum:cfg.socialMomentum===true,momentumMode:cfg.momentumMode||null,momentumStrength:Number(cfg.momentumStrength||0),cadenceMode:cfg.cadenceMode,targetWords:cfg.targetWords});

  let full='',buffer='',firstDeltaAt=0,doneSeen=false;
  const decoder=new TextDecoder();
  const onClose=()=>{if(!res.writableEnded)try{ctl.abort()}catch(_){}};
  res.on('close',onClose);
  try{
    const reader=upstream.body.getReader();
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const rows=buffer.split(/\r?\n/);
      buffer=rows.pop()||'';
      for(const row of rows){
        const line=row.trim();if(!line)continue;
        let j;try{j=JSON.parse(line)}catch(_){continue}
        const delta=String(j&&j.message&&j.message.content||'');
        if(delta){
          if(!firstDeltaAt)firstDeltaAt=Date.now();
          full+=delta;
          write({type:'delta',text:delta});
        }
        if(j&&j.done)doneSeen=true;
      }
    }
    buffer+=decoder.decode();
    if(buffer.trim()){
      try{
        const j=JSON.parse(buffer.trim());
        const delta=String(j&&j.message&&j.message.content||'');
        if(delta){
          if(!firstDeltaAt)firstDeltaAt=Date.now();
          full+=delta;
          write({type:'delta',text:delta});
        }
        if(j&&j.done)doneSeen=true;
      }catch(_){}
    }
    const final=String(full||'').replace(/\s+/g,' ').trim();
    if(!final)throw new Error('EMPTY_STREAM_REPLY');
    appendLocalBrainHistory('user',text);
    appendLocalBrainHistory('assistant',final);
    remember({
      kind:'streaming_chat',
      model:LOCAL_BRAIN_MODEL,
      repairMode:cfg.repairMode===true,
      socialMode:cfg.socialMode,
      followupAllowed:cfg.followupAllowed===true,
      socialMomentum:cfg.socialMomentum===true,
      momentumMode:cfg.momentumMode||null,
      momentumStrength:Number(cfg.momentumStrength||0),
      cadenceMode:cfg.cadenceMode,
      targetWords:cfg.targetWords,
      firstDeltaMs:firstDeltaAt?firstDeltaAt-started:null,
      latencyMs:Date.now()-started,
      chars:final.length,
      doneSeen
    });
    write({
      type:'done',
      ok:true,
      reply:final,
      tone:cfg.tone,
      model:LOCAL_BRAIN_MODEL,
      repairMode:cfg.repairMode===true,
      socialMode:cfg.socialMode,
      followupAllowed:cfg.followupAllowed===true,
      socialMomentum:cfg.socialMomentum===true,
      momentumMode:cfg.momentumMode||null,
      momentumStrength:Number(cfg.momentumStrength||0),
      cadenceMode:cfg.cadenceMode,
      targetWords:cfg.targetWords,
      firstDeltaMs:firstDeltaAt?firstDeltaAt-started:null,
      latencyMs:Date.now()-started
    });
    if(!res.writableEnded)res.end();
  }catch(e){
    const partial=String(full||'').replace(/\s+/g,' ').trim();
    if((ctl.signal.aborted||res.destroyed||e&&e.name==='AbortError')&&partial.length>=18){
      setInterruptedConversationState({
        kind:'stream',
        at:Date.now(),
        userText:text,
        partialText:partial,
        tone:cfg.tone,
        socialMode:cfg.socialMode,
        cadenceMode:cfg.cadenceMode
      });
    }
    write({type:'error',ok:false,error:String(e.message||e).slice(0,220),resumeAvailable:!!freshInterruptedConversationState()});
    if(!res.writableEnded)res.end();
  }finally{
    clearTimeout(timeout);
    res.removeListener('close',onClose);
  }
}
function startLocalTtsBridge(){
  if(!TTS_ENABLED&&!FORCE_LOCAL_BRIDGE&&!TEST_MODE)return;
  const port=Number(process.env.JARVIS_TTS_PORT||8765);
  let allowedOrigin='';
  try{allowedOrigin=new URL(BASE).origin}catch(e){}
  const server=http.createServer((req,res)=>{
    const origin=String(req.headers.origin||'');
    const allowed=!origin||origin===allowedOrigin||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if(!allowed){res.writeHead(403);return res.end('forbidden')}
    res.setHeader('Access-Control-Allow-Origin',origin||allowedOrigin||'*');
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','content-type');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(req.method==='GET'&&req.url==='/dialogue-feedback'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,...readDialogueFeedback()}));
    }
    if(req.method==='GET'&&req.url==='/voice-preferences'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,...readVoicePreferences()}));
    }
    if(req.method==='GET'&&req.url==='/speech-lexicon'){
      const x=readSpeechLexicon();
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,
        aliases:x.aliases,
        hotwords:x.hotwords,
        count:Object.keys(x.aliases||{}).length,
        updatedAt:x.updatedAt
      }));
    }
    if(req.method==='POST'&&req.url==='/speech-lexicon'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=d.action==='forget'
            ?forgetSpeechAlias(d.heard)
            :learnSpeechAlias(d.heard,d.intended,d.source||'local-ui');
          res.writeHead(result.ok?200:422,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/chat-stream'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const message=String(d.message||'').trim();
          if(!message){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'message required'}))}
          await streamLocalConversationHttp(message,res);
        }catch(e){
          if(res.headersSent)return;
          const code=String(e.code||e.message)==='NOT_STREAMABLE'?409:503;
          res.writeHead(code,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.code||e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/prosody-preview'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const preview=prosodyPreview(String(d.text||'').slice(0,900),String(d.tone||'balanced'));
          res.writeHead(200,{'content-type':'application/json'});
          return res.end(JSON.stringify(preview));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='GET'&&req.url==='/interruption-state'){
      const x=freshInterruptedConversationState();
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,
        available:!!x,
        kind:x&&x.kind||null,
        ageMs:x?Number(x.ageMs||0):null,
        remainingChars:x?String(x.remainingText||'').length:0,
        partialChars:x?String(x.partialText||'').length:0
      }));
    }
    if(req.method==='GET'&&req.url==='/mission-status'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify(missionHealthSnapshot()));
    }
    if(req.method==='GET'&&req.url==='/acceptance-snapshot'){
      buildPcAcceptanceSnapshot().then(snapshot=>{
        if(res.destroyed||res.writableEnded)return;
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify(snapshot));
      }).catch(e=>{
        if(res.destroyed||res.writableEnded)return;
        res.writeHead(500,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
      });
      return;
    }
    if(req.method==='GET'&&req.url==='/health'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,voice:TTS_VOICE,version:WORKER_VERSION,
        capabilities:CAPS,
        selfUpdate:selfUpdateState(),
        missionRuntime:missionHealthSnapshot(),
        localBrain:{model:LOCAL_BRAIN_MODEL,url:LOCAL_BRAIN_URL,personaVersion:2,memory:'semantic-local-v2',vision:isLocalVisionModel()},
        localStt:{port:LOCAL_STT_PORT,model:LOCAL_STT_MODEL,engine:'faster-whisper',adaptiveLexicon:true,adaptiveDecode:true,dynamicEndpointing:true,lexiconCount:Object.keys(readSpeechLexicon().aliases||{}).length},
        adaptiveTts:{voice:TTS_VOICE,engine:'edge-neural',interruptible:true,offlineFallback:'windows-sapi',chunkedPipeline:true,prefetch:true,safeCache:true,backchannelPrewarm:true,backchannelState:ttsBackchannelPrewarmState,wakeAckPrewarm:true,wakeAckVariants:JARVIS_WAKE_ACK_PHRASES.length,dynamicChunkProsody:true,naturalPauseTiming:true,adaptiveVoicePreferences:true,voicePreferences:readVoicePreferences(),speakerEchoRejection:true,profiles:['balanced','casual','playful','warm','focused','work','serious','excited','gentle']},
        brainRuntime:{warm:brainWarmState,keepAlive:LOCAL_BRAIN_KEEP_ALIVE,context:LOCAL_BRAIN_CTX,toolReflection:true,multimodal:isLocalVisionModel(),screenVision:process.platform==='win32'&&isLocalVisionModel(),screenVisionExplicitOnly:true,nativeTools:true,maxToolRounds:4,selectiveReasoning:true,streamingChat:true,sentenceStreamTts:true,conversationRepair:true,adaptiveModelRouter:true,fastModel:LOCAL_BRAIN_MODEL,deepModel:LOCAL_BRAIN_DEEP_MODEL,adaptiveTurnPacing:true,fullDuplexInterrupt:true,cancellableAgent:true,socialDialogue:true,responseVariation:true,contextualFollowup:true,dialogueFeedbackLearning:true,socialPreferenceAdaptation:true,socialMomentum:true,ellipticalTurnResolution:true,conversationCadence:true,brevityMirroring:true,adaptiveResponseLength:true,interruptionContinuity:true,spokenResume:true,partialStreamResume:true,autoQualityEscalation:true,weakResponseEscalation:true,repairQualityEscalation:true},
        mobileRelay:{brain:true,tts:true,pollMs:650}
      }));
    }
    if(req.method==='GET'&&req.url==='/tts-state'){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({
        ok:true,
        active:ttsSpeaking||ttsPendingCount>0,
        speaking:ttsSpeaking,
        pending:ttsPendingCount,
        startedAt:ttsLastStartedAt||null,
        endedAt:ttsLastEndedAt||null,
        generation:ttsGeneration,
        chunks:ttsLastChunkCount,
        currentChunk:ttsCurrentChunk,
        resumeAvailable:!!freshInterruptedConversationState(),
        resumeKind:(freshInterruptedConversationState()||{}).kind||null,
        interruptible:true,
        chunkedPipeline:true
      }));
    }
    if(req.method==='POST'&&req.url==='/tts-stop'){
      const stopped=stopJarvisSpeech('local-api');
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify(stopped));
    }
    if(req.method==='POST'&&req.url==='/brain-warm'){
      warmLocalBrain().then(state=>{
        const ok=state.status==='ready';
        res.writeHead(ok?200:503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok,...state}));
      }).catch(e=>{
        res.writeHead(503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:false,status:'error',error:String(e.message||e)}));
      });
      return;
    }
    if(req.method==='GET'&&req.url==='/brain-status'){
      localBrainStatus().then(status=>{
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:true,...status,warm:brainWarmState,keepAlive:LOCAL_BRAIN_KEEP_ALIVE,context:LOCAL_BRAIN_CTX,screenVision:process.platform==='win32'&&isLocalVisionModel(),screenVisionExplicitOnly:true,nativeTools:true,maxToolRounds:4,selectiveReasoning:true,conversationRepair:true,adaptiveModelRouter:true,fastModel:LOCAL_BRAIN_MODEL,deepModel:LOCAL_BRAIN_DEEP_MODEL,adaptiveTurnPacing:true,fullDuplexInterrupt:true,cancellableAgent:true,socialDialogue:true,responseVariation:true,contextualFollowup:true,dialogueFeedbackLearning:true,socialPreferenceAdaptation:true,socialMomentum:true,ellipticalTurnResolution:true,conversationCadence:true,brevityMirroring:true,adaptiveResponseLength:true,interruptionContinuity:true,spokenResume:true,partialStreamResume:true,autoQualityEscalation:true,weakResponseEscalation:true,repairQualityEscalation:true,dialogueFeedback:readDialogueFeedback(),persona:brainPersona(),memoryFacts:readBrainFacts().length,memoryEpisodes:readBrainEpisodes().length}));
      }).catch(e=>{
        res.writeHead(503,{'content-type':'application/json'});
        res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/wake'){
      const now=Date.now();
      if((now-lastLocalWakeAt)<12000){
        res.writeHead(202,{'content-type':'application/json'});
        return res.end(JSON.stringify({ok:true,suppressed:true,wake:localWakeCounter}));
      }
      lastLocalWakeAt=now;
      localWakeCounter++;
      showJarvisScreen();
      res.writeHead(202,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,wake:localWakeCounter}));
    }
    if(req.method==='GET'&&req.url.startsWith('/wake-state')){
      res.writeHead(200,{'content-type':'application/json'});
      return res.end(JSON.stringify({ok:true,wake:localWakeCounter}));
    }
    if(req.method==='POST'&&req.url==='/screen-vision'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>16384){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        if(process.platform!=='win32'){res.writeHead(501,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'WINDOWS_ONLY'}))}
        try{
          const d=JSON.parse(body||'{}');
          const question=String(d.question||'Ekranda ne görüyorsun?').trim().slice(0,700);
          const result=await analyzeCurrentScreen(question);
          res.writeHead(result&&result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result||{ok:false,error:'SCREEN_VISION_FAILED'}));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/vision'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>4500000){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'image too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await analyzeLocalImage(d.image,d.question);
          res.writeHead(result.ok?200:(result.error==='VISION_MODEL_REQUIRED'?409:503),{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/agent'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const requestCtl=new AbortController();
          const onClose=()=>{if(!res.writableEnded)try{requestCtl.abort()}catch(_){}};
          res.on('close',onClose);
          const result=await runNativeAgent(d.message,{maxRounds:d.maxRounds||4,signal:requestCtl.signal});
          res.removeListener('close',onClose);
          if(res.destroyed||res.writableEnded)return;
          const code=result.cancelled?499:(result.ok?200:503);
          res.writeHead(code,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/brain'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await callLocalBrain(d.message);
          res.writeHead(result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/brain-finalize'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const result=await finalizeToolReply(d.message,d.results,d.tone||'focused');
          res.writeHead(result.ok?200:503,{'content-type':'application/json'});
          return res.end(JSON.stringify(result));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }

    if(req.method==='POST'&&req.url==='/control'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'too large'}))}
        try{
          const d=JSON.parse(body||'{}');
          const command=String(d.command||'').trim();
          if(!command||!isLocalSafeControlCommand(command)){
            res.writeHead(403,{'content-type':'application/json'});
            return res.end(JSON.stringify({ok:false,error:'command not allowed on local safe bridge'}));
          }
          const result=await execute({command});
          res.writeHead(result&&result.ok?200:422,{'content-type':'application/json'});
          return res.end(JSON.stringify(result||{ok:false,message:'no result'}));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/creator-render'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>65536){tooLarge=true;req.destroy()}});
      req.on('end',async()=>{
        if(tooLarge){res.writeHead(413);return res.end('too large')}
        try{
          const d=JSON.parse(body||'{}');
          const text=String(d.text||'').trim();
          if(!text){res.writeHead(400);return res.end('text required')}
          const out=await renderCreatorVoiceFile(text,d.name||'creator-voice');
          res.writeHead(200,{'content-type':'application/json'});
          return res.end(JSON.stringify({
            ok:true,
            profile:'CINEMATIC_CREATOR',
            voice:CREATOR_TTS_VOICE,
            rate:CREATOR_TTS_RATE,
            pitch:CREATOR_TTS_PITCH,
            volume:CREATOR_TTS_VOLUME,
            path:out
          }));
        }catch(e){
          res.writeHead(500,{'content-type':'application/json'});
          return res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
        }
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/speak'){
      let body='',tooLarge=false;
      req.on('data',chunk=>{body+=chunk;if(body.length>32768){tooLarge=true;req.destroy()}});
      req.on('end',()=>{
        if(tooLarge){res.writeHead(413);return res.end('too large')}
        try{
          const d=JSON.parse(body||'{}'),text=String(d.text||'').trim();
          if(!text){res.writeHead(400);return res.end('text required')}
          const tone=['balanced','casual','playful','warm','focused','work','serious','excited','gentle'].includes(String(d.tone||''))?String(d.tone):'balanced';
          queueJarvisSpeech(text,tone);
          res.writeHead(202,{'content-type':'application/json'});
          return res.end(JSON.stringify({
            ok:true,queued:true,tone,
            profile:ttsProfileForTone(tone,text),
            spokenText:prepareJarvisSpeechText(text,tone)
          }));
        }catch(e){res.writeHead(400);return res.end('bad request')}
      });
      return;
    }
    res.writeHead(404);res.end('not found');
  });
  server.on('error',e=>console.error('[JARVIS] LOCAL TTS BRIDGE:',e.message));
  server.listen(port,'127.0.0.1',()=>console.log('[JARVIS] LOCAL TTS BRIDGE READY: http://127.0.0.1:'+port));
}

if(!TOKEN&&!DEVICE_TOKEN&&!PAIR_CODE){console.error('JARVIS signed cihaz kimliği veya pairing code gerekli.');process.exit(1)}
function ensureWindowsHelper(filename){
  const helper=path.join(__dirname,filename);
  if(fs.existsSync(helper))return helper;
  const url='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'+encodeURIComponent(filename);
  try{
    const safeUrl=url.replace(/'/g,"''"),safePath=helper.replace(/'/g,"''");
    const ps="$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '"+safeUrl+"' -OutFile '"+safePath+"' -TimeoutSec 20";
    childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:256*1024});
    if(fs.existsSync(helper)){console.log('[JARVIS] HELPER SYNCED: '+filename);return helper}
  }catch(e){console.error('[JARVIS] HELPER SYNC FAILED: '+filename+' · '+e.message)}
  return null;
}
function syncRepoRuntimeFile(filename,signature){
  if(process.platform!=='win32')return null;
  const target=path.join(__dirname,filename);
  const tmp=target+'.new';
  const url='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'+encodeURIComponent(filename)+'?cb='+Date.now();
  try{
    const safeUrl=url.replace(/'/g,"''"),safeTmp=tmp.replace(/'/g,"''");
    const ps="$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -Uri '"+safeUrl+"' -OutFile '"+safeTmp+"' -TimeoutSec 25";
    childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:32000,maxBuffer:512*1024});
    if(!fs.existsSync(tmp))throw new Error('download missing');
    const txt=fs.readFileSync(tmp,'utf8');
    if(signature&&!txt.includes(signature))throw new Error('signature validation failed');
    if(filename.toLowerCase().endsWith('.js')){
      childProcess.execFileSync(process.execPath,['--check',tmp],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:256*1024});
    }
    const oldHash=fs.existsSync(target)?crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'):null;
    const newHash=crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
    if(oldHash!==newHash){
      fs.copyFileSync(tmp,target);
      console.log('[JARVIS] RUNTIME SYNCED: '+filename);
    }
    try{fs.unlinkSync(tmp)}catch(_){}
    return target;
  }catch(e){
    try{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}catch(_){}
    console.error('[JARVIS] RUNTIME SYNC FAILED: '+filename+' · '+e.message);
    return fs.existsSync(target)?target:null;
  }
}
function getCreatorEngine(){
  if(creatorEngine)return creatorEngine;
  const file=syncRepoRuntimeFile('jarvis-creator-engine.js',"ENGINE_VERSION='1.4'");
  if(!file)throw new Error('Creator engine module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    creatorEngine=require(file);
    return creatorEngine;
  }catch(e){
    throw new Error('Creator engine load failed: '+e.message);
  }
}
function getCreatorWebMedia(){
  if(creatorWebMedia)return creatorWebMedia;
  const file=syncRepoRuntimeFile('jarvis-creator-web-media.js',"CREATOR_WEB_MEDIA_VERSION='1.0'");
  if(!file)throw new Error('Creator Web Media module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    creatorWebMedia=require(file);
    return creatorWebMedia;
  }catch(e){
    throw new Error('Creator Web Media load failed: '+e.message);
  }
}
function getCreatorSemanticQuality(){
  if(creatorSemanticQuality)return creatorSemanticQuality;
  const file=syncRepoRuntimeFile('jarvis-creator-semantic-quality.js',"SEMANTIC_QUALITY_VERSION='1.4'");
  if(!file)throw new Error('Creator Semantic Quality module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    creatorSemanticQuality=require(file);
    return creatorSemanticQuality;
  }catch(e){
    throw new Error('Creator Semantic Quality load failed: '+e.message);
  }
}
function getBrowserOperator(){
  if(browserOperator)return browserOperator;
  const file=syncRepoRuntimeFile('jarvis-browser-operator.js',"BROWSER_OPERATOR_VERSION='1.0'");
  if(!file)throw new Error('Browser Operator module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    browserOperator=require(file);
    return browserOperator;
  }catch(e){
    throw new Error('Browser Operator load failed: '+e.message);
  }
}
function getCommerceEngine(){
  if(commerceEngine)return commerceEngine;
  const file=syncRepoRuntimeFile('jarvis-commerce-engine.js',"ENGINE_VERSION='1.0'");
  if(!file)throw new Error('Commerce engine module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    commerceEngine=require(file);
    return commerceEngine;
  }catch(e){
    throw new Error('Commerce engine load failed: '+e.message);
  }
}
function getYoutubeStudio(){
  if(youtubeStudio)return youtubeStudio;
  const file=syncRepoRuntimeFile('jarvis-youtube-studio.js',"YOUTUBE_STUDIO_VERSION='1.1'");
  if(!file)throw new Error('YouTube Studio module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    youtubeStudio=require(file);
    return youtubeStudio;
  }catch(e){
    throw new Error('YouTube Studio module load failed: '+e.message);
  }
}
function getMissionEngine(){
  if(missionEngine)return missionEngine;
  const file=syncRepoRuntimeFile('jarvis-mission-engine.js',"MISSION_ENGINE_VERSION='1.0'");
  if(!file)throw new Error('Mission Engine module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    missionEngine=require(file);
    return missionEngine;
  }catch(e){
    throw new Error('Mission Engine load failed: '+e.message);
  }
}
function getWorkspaceFileEngine(){
  if(workspaceFileEngine)return workspaceFileEngine;
  const file=syncRepoRuntimeFile('jarvis-workspace-file-engine.js',"WORKSPACE_FILE_ENGINE_VERSION='1.0'");
  if(!file)throw new Error('Workspace File Engine module could not be prepared');
  try{
    delete require.cache[require.resolve(file)];
    workspaceFileEngine=require(file);
    return workspaceFileEngine;
  }catch(e){
    throw new Error('Workspace File Engine load failed: '+e.message);
  }
}
function normalizeCreatorStoryboardAssets(raw){
  const rows=Array.isArray(raw)?raw.slice(0,5):[];
  if(!rows.length)return[];
  const files=getWorkspaceFileEngine();
  const creator=getCreatorEngine();
  const normalized=rows.map(x=>files.normalizeRel(x));
  const resolved=creator.resolveAssetSelection(WORKSPACE,normalized,5);
  return resolved.map(full=>{
    const rel=path.relative(WORKSPACE,full).replace(/\\/g,'/');
    if(!/^creator-assets\//.test(rel))throw new Error('Creator storyboard asset kapsam dışı: '+rel);
    const sha256=files.hashFile(full);
    if(!sha256)throw new Error('Creator storyboard asset hash alınamadı: '+rel);
    return{path:rel,sha256};
  });
}
function normalizeCreatorLongformAssets(raw){
  const rows=Array.isArray(raw)?raw.slice(0,20):[];
  if(!rows.length)return[];
  const files=getWorkspaceFileEngine();
  const creator=getCreatorEngine();
  const normalized=rows.map(x=>files.normalizeRel(x));
  const resolved=creator.resolveAssetSelection(WORKSPACE,normalized,20);
  return resolved.map(full=>{
    const rel=path.relative(WORKSPACE,full).replace(/\\/g,'/');
    if(!/^creator-assets\//.test(rel))throw new Error('Creator long-form asset kapsam dışı: '+rel);
    const sha256=files.hashFile(full);
    if(!sha256)throw new Error('Creator long-form asset hash alınamadı: '+rel);
    return{path:rel,sha256};
  });
}
function verifyCreatorLongformBaselines(raw){
  const rows=Array.isArray(raw)?raw.slice(0,20):[];
  if(!rows.length)return[];
  const files=getWorkspaceFileEngine();
  return rows.map(row=>{
    const rel=files.normalizeRel(row&&row.path);
    const sha256=String(row&&row.sha256||'').toLowerCase();
    if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Creator long-form baseline hash geçersiz: '+rel);
    const full=safeFile(rel);
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Creator long-form baseline asset eksik: '+rel);
    if(files.hashFile(full)!==sha256)throw new Error('CREATOR_LONGFORM_ASSET_HASH_CONFLICT: '+rel);
    const inspected=getCreatorEngine().inspectAsset(WORKSPACE,rel);
    if(!inspected.ok)throw new Error('CREATOR_LONGFORM_ASSET_INVALID: '+rel+' · '+String(inspected.code||'INVALID'));
    return{path:rel,sha256};
  });
}

function cleanCampaignArgs(args={}){
  const tags=Array.isArray(args.tags)?args.tags.map(x=>String(x||'').trim()).filter(Boolean).slice(0,30):[];
  const images=Array.isArray(args.images)?args.images.map(x=>String(x||'').trim()).filter(x=>/^https:\/\//i.test(x)).slice(0,12):[];
  const productTitle=String(args.productTitle||'').replace(/\s+/g,' ').trim().slice(0,255);
  const campaignName=String(args.campaignName||productTitle||('varova-campaign-'+Date.now())).replace(/[\r\n]/g,' ').trim().slice(0,90);
  const script=String(args.script||'').replace(/\s+/g,' ').trim().slice(0,1800);
  const price=(args.price===undefined||args.price===null||args.price==='')?null:Number(args.price);
  return{
    campaignName,
    script,
    includeShopify:args.includeShopify===true||(args.includeShopify!==false&&!!productTitle),
    includeYouTube:args.includeYouTube!==false,
    publishYouTube:args.publishYouTube===true,
    creatorAssets:normalizeCreatorStoryboardAssets(args.creatorAssets),
    product:{
      title:productTitle,
      description:String(args.productDescription||'').trim().slice(0,6000),
      price:Number.isFinite(price)?price:null,
      sku:String(args.sku||'').trim().slice(0,120),
      vendor:'VAROVA',
      productType:String(args.productType||'').trim().slice(0,255),
      tags,
      images
    },
    youtube:{
      title:String(args.youtubeTitle||productTitle||campaignName).replace(/\s+/g,' ').trim().slice(0,100),
      description:String(args.youtubeDescription||'').trim().slice(0,5000)
    }
  };
}
function createVarovaCampaignMission(args={}){
  const input=cleanCampaignArgs(args);
  if(!input.script)throw new Error('Kampanya görevi için video anlatım metni gerekli.');
  if(input.includeShopify&&!input.product.title)throw new Error('Shopify taslağı isteniyorsa ürün başlığı gerekli.');
  if(input.publishYouTube&&!input.includeYouTube)throw new Error('YouTube PUBLIC isteniyorsa YouTube taslağı da göreve dahil edilmeli.');
  const steps=['render_short'];
  if(input.includeShopify)steps.push('shopify_draft');
  if(input.includeYouTube)steps.push('youtube_draft');
  if(input.publishYouTube)steps.push({name:'youtube_publish',meta:{requiresApproval:true}});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'varova_campaign',
    label:input.product.title||input.campaignName,
    input,
    steps
  });
}
function prepareCreatorAssetOperations(args={}){
  const sourceFiles=Array.isArray(args.sourceFiles)?args.sourceFiles.slice(0,12):[];
  if(!sourceFiles.length)throw new Error('Creator asset görevi için en az bir workspace video dosyası gerekli.');
  getCreatorEngine().ffmpegStatus(WORKSPACE);
  const files=getWorkspaceFileEngine();
  return sourceFiles.map((raw,index)=>{
    const source=files.normalizeRel(raw);
    if(/^creator-assets\//i.test(source))throw new Error('Dosya zaten Creator asset klasöründe: '+source);
    const full=safeFile(source);
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Creator asset kaynak dosyası bulunamadı: '+source);
    const expectedSha256=files.hashFile(full);
    if(!expectedSha256)throw new Error('Creator asset hash alınamadı: '+source);
    const destination='creator-assets/'+getCreatorEngine().assetDestinationName(source,expectedSha256);
    const state=files.inspectOperation(WORKSPACE,{source,destination});
    if(!state.sourceExists||state.sourceHash!==expectedSha256)throw new Error('Creator asset kaynak hash doğrulanamadı: '+source);
    if(state.destinationExists&&state.destinationHash!==expectedSha256)throw new Error('Creator asset hedefinde farklı içerik var: '+destination);
    return{
      operation:'copy',
      source,
      destination,
      expectedSha256,
      bytes:Number(fs.statSync(full).size||0),
      reused:!!state.destinationExists,
      sourceIndex:index
    };
  });
}
function createCreatorAssetMission(args={}){
  const operations=prepareCreatorAssetOperations(args);
  const label=String(args.label||'Creator asset ingest').replace(/[\r\n]+/g,' ').trim().slice(0,160)||'Creator asset ingest';
  const steps=operations.map((_,i)=>({name:'creator_asset_'+String(i+1).padStart(2,'0'),meta:{operationIndex:i}}));
  return getMissionEngine().createMission(WORKSPACE,{
    type:'creator_asset',
    label,
    input:{operations},
    steps
  });
}

function normalizeCreatorBatchItems(args={}){
  const rows=Array.isArray(args.items)?args.items.slice(0,10):[];
  if(rows.length<2)throw new Error('Creator batch görevi için en az 2 video gerekli.');
  const names=new Set();
  return rows.map((row,index)=>{
    const script=String(row&&row.script||'').replace(/\s+/g,' ').trim().slice(0,1800);
    if(!script)throw new Error('Creator batch video '+(index+1)+' için anlatım metni gerekli.');
    const fallback='batch-short-'+String(index+1).padStart(2,'0');
    let campaignName=String(row&&row.campaignName||fallback).replace(/[\r\n]/g,' ').trim().slice(0,90)||fallback;
    const base=campaignName;
    let suffix=2;
    while(names.has(campaignName.toLocaleLowerCase('tr-TR'))){
      campaignName=(base+'-'+suffix).slice(0,90);suffix++;
    }
    names.add(campaignName.toLocaleLowerCase('tr-TR'));
    return{
      campaignName,
      script,
      youtubeTitle:String(row&&row.youtubeTitle||campaignName).replace(/\s+/g,' ').trim().slice(0,100),
      youtubeDescription:String(row&&row.youtubeDescription||'').trim().slice(0,5000),
      creatorAssets:normalizeCreatorStoryboardAssets(row&&row.creatorAssets)
    };
  });
}
function defaultCreatorAssetUsage(){
  return{version:1,updatedAt:null,items:{}};
}
function readCreatorAssetUsage(){
  try{
    if(!fs.existsSync(CREATOR_ASSET_USAGE_FILE))return defaultCreatorAssetUsage();
    const x=JSON.parse(fs.readFileSync(CREATOR_ASSET_USAGE_FILE,'utf8'));
    return{
      version:1,
      updatedAt:x&&x.updatedAt||null,
      items:x&&x.items&&typeof x.items==='object'&&!Array.isArray(x.items)?x.items:{}
    };
  }catch(_){return defaultCreatorAssetUsage()}
}
function writeCreatorAssetUsage(usage){
  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  const clean={
    version:1,
    updatedAt:new Date().toISOString(),
    items:usage&&usage.items&&typeof usage.items==='object'?usage.items:{}
  };
  const tmp=CREATOR_ASSET_USAGE_FILE+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(clean,null,2),'utf8');
  fs.renameSync(tmp,CREATOR_ASSET_USAGE_FILE);
  return clean;
}
function creatorPreferFreshAssetPaths(paths,recentSet,maxItems=12){
  const limit=Math.max(1,Math.min(20,Number(maxItems)||12));
  const recent=recentSet instanceof Set?recentSet:new Set();
  const fresh=[],reused=[],seen=new Set();
  for(const raw of Array.isArray(paths)?paths:[]){
    const rel=String(raw||'').replace(/\\/g,'/').trim();
    if(!rel||seen.has(rel))continue;
    seen.add(rel);
    (recent.has(rel)?reused:fresh).push(rel);
  }
  return [...fresh,...reused].slice(0,limit);
}
function creatorRecentWebAssetSet(days=7){
  const usage=readCreatorAssetUsage();
  const age=Math.max(1,Math.min(60,Number(days)||7))*24*60*60*1000;
  const cutoff=Date.now()-age;
  const out=new Set();
  for(const [rel,row] of Object.entries(usage.items||{})){
    const t=Date.parse(String(row&&row.lastUsedAt||''));
    if(Number.isFinite(t)&&t>=cutoff)out.add(String(rel||'').replace(/\\/g,'/'));
  }
  return out;
}
function creatorPreferFreshWebAssets(paths,maxItems=12,days=7){
  return creatorPreferFreshAssetPaths(paths,creatorRecentWebAssetSet(days),maxItems);
}
function creatorMarkWebAssetsUsed(assets,context={}){
  const paths=(Array.isArray(assets)?assets:[])
    .map(x=>String(x&&x.path||x||'').replace(/\\/g,'/').trim())
    .filter(Boolean);
  if(!paths.length)return{marked:0};
  let records=[];
  try{records=getCreatorWebMedia().sourceRecordsForAssets(WORKSPACE,paths)}catch(_){records=[]}
  if(!records.length)return{marked:0};
  const usage=readCreatorAssetUsage();
  const now=new Date().toISOString();
  let marked=0;
  for(const record of records){
    const rel=String(record&&record.path||'').replace(/\\/g,'/').trim();
    if(!rel)continue;
    const prev=usage.items[rel]||{};
    usage.items[rel]={
      path:rel,
      provider:String(record.provider||prev.provider||'').slice(0,60),
      lastUsedAt:now,
      useCount:Math.max(0,Number(prev.useCount)||0)+1,
      lastContext:String(context&&context.type||context&&context.context||'creator').slice(0,100),
      missionId:String(context&&context.missionId||'').slice(0,100)||null
    };
    marked++;
  }
  if(marked)writeCreatorAssetUsage(usage);
  return{marked};
}

function creatorOrderRealMotionHookAssets(paths,mediaKinds,orientation='portrait'){
  const rows=Array.isArray(paths)?paths.map(x=>String(x||'').replace(/\\/g,'/').trim()).filter(Boolean):[];
  if(String(orientation||'').toLowerCase()!=='portrait'||rows.length<2)return rows;
  const kinds=mediaKinds instanceof Map?mediaKinds:new Map();
  const video=[],unknown=[],animated=[];
  for(const rel of rows){
    const kind=String(kinds.get(rel)||'');
    if(kind==='video')video.push(rel);
    else if(kind==='animated_still')animated.push(rel);
    else unknown.push(rel);
  }
  return [...video,...unknown,...animated];
}
function creatorPreferRealMotionHookAssets(paths,orientation='portrait'){
  const rows=Array.isArray(paths)?paths.map(x=>String(x||'').replace(/\\/g,'/').trim()).filter(Boolean):[];
  if(String(orientation||'').toLowerCase()!=='portrait'||rows.length<2)return rows;
  let records=[];
  try{records=getCreatorWebMedia().sourceRecordsForAssets(WORKSPACE,rows)}catch(_){records=[]}
  if(!records.length)return rows;
  const kinds=new Map(records.map(x=>[String(x&&x.path||'').replace(/\\/g,'/'),String(x&&x.mediaKind||'video')]));
  return creatorOrderRealMotionHookAssets(rows,kinds,orientation);
}
function creatorOrderVerifiedMotionHookAssets(paths,evidence,orientation='portrait'){
  const rows=Array.isArray(paths)?paths.map(x=>String(x||'').replace(/\\/g,'/').trim()).filter(Boolean):[];
  if(String(orientation||'').toLowerCase()!=='portrait'||rows.length<2)return rows;
  const map=evidence instanceof Map?evidence:new Map();
  const limit=Math.min(3,rows.length);
  let bestIndex=-1,bestScore=-1;
  for(let i=0;i<limit;i++){
    const probe=map.get(rows[i])||{};
    if(probe.ok!==true)continue;
    const score=(Number(probe.meanDifference)||0)*2+(Number(probe.peakDifference)||0)+(Number(probe.activeRatio)||0);
    if(score>bestScore){bestScore=score;bestIndex=i}
  }
  if(bestIndex<=0)return rows;
  return[rows[bestIndex],...rows.slice(0,bestIndex),...rows.slice(bestIndex+1)];
}
function creatorPreferVerifiedMotionHookAssets(paths,orientation='portrait',ffmpeg=''){
  const rows=Array.isArray(paths)?paths.map(x=>String(x||'').replace(/\\/g,'/').trim()).filter(Boolean):[];
  if(String(orientation||'').toLowerCase()!=='portrait'||rows.length<2||!ffmpeg){
    return{paths:rows,selected:rows[0]||null,verified:false,probeCount:0,offset:0,meanDifference:0};
  }
  const evidence=new Map();
  const limit=Math.min(3,rows.length);
  for(const rel of rows.slice(0,limit)){
    try{
      const probe=getCreatorEngine().findHookMotionWindow(safeFile(rel),ffmpeg,{
        windowSeconds:0.95,maxOffsetSeconds:1.5,stepSeconds:0.5,fps:6
      });
      evidence.set(rel,probe);
    }catch(_){evidence.set(rel,{ok:false,code:'CREATOR_AUTO_HOOK_PROBE_FAILED'})}
  }
  const ordered=creatorOrderVerifiedMotionHookAssets(rows,evidence,orientation);
  const selected=ordered[0]||null;
  const probe=selected?evidence.get(selected)||null:null;
  return{
    paths:ordered,
    selected,
    verified:!!(probe&&probe.ok===true),
    probeCount:evidence.size,
    offset:Number(probe&&probe.offset||0),
    meanDifference:Number(probe&&probe.meanDifference||0),
    peakDifference:Number(probe&&probe.peakDifference||0),
    activeRatio:Number(probe&&probe.activeRatio||0)
  };
}
function creatorPreferUnseenAssetPaths(paths,excludeSet,maxItems=12){
  const limit=Math.max(1,Math.min(20,Number(maxItems)||12));
  const excluded=excludeSet instanceof Set?excludeSet:new Set();
  const unseen=[],seenBefore=[],dedupe=new Set();
  for(const raw of Array.isArray(paths)?paths:[]){
    const rel=String(raw||'').replace(/\\/g,'/').trim();
    if(!rel||dedupe.has(rel))continue;
    dedupe.add(rel);
    (excluded.has(rel)?seenBefore:unseen).push(rel);
  }
  return [...unseen,...seenBefore].slice(0,limit);
}
function creatorAutoWebQuery(title,script,maxTerms=9){
  const stop=new Set([
    'bir','bu','şu','su','ve','veya','ile','için','icin','gibi','daha','çok','cok','olan','olarak','ama','fakat','sonra','önce','once',
    'ben','sen','biz','siz','onlar','ne','neden','nasıl','nasil','hangi','şimdi','simdi','video','short','shorts','reels','youtube',
    'the','and','for','with','from','that','this','into','about','your','you','are','was','were','will','can','how','what','why'
  ]);
  const tokenize=(value)=>String(value||'')
    .toLocaleLowerCase('tr-TR')
    .replace(/[\r\n]+/g,' ')
    .replace(/[^a-z0-9çğıöşü\s-]/gi,' ')
    .split(/\s+/)
    .map(x=>x.replace(/^-+|-+$/g,'').trim())
    .filter(x=>x.length>=3&&!stop.has(x)&&!/^\d+$/.test(x));
  const scores=new Map(),first=new Map();
  let order=0;
  const add=(token,weight)=>{
    if(!first.has(token))first.set(token,order++);
    scores.set(token,(scores.get(token)||0)+weight);
  };
  for(const token of tokenize(title).slice(0,30))add(token,5);
  for(const token of tokenize(script).slice(0,500))add(token,1);
  return [...scores.keys()]
    .sort((a,b)=>(scores.get(b)-scores.get(a))||(first.get(a)-first.get(b))||a.localeCompare(b,'tr'))
    .slice(0,Math.max(3,Math.min(12,Number(maxTerms)||9)))
    .join(' ')
    .slice(0,140);
}
function creatorSceneWebQueries(title,script,{maxQueries=3,maxTerms=7}={}){
  const raw=String(script||'').replace(/[\r\n]+/g,' ').trim();
  const global=creatorAutoWebQuery(title,raw,maxTerms);
  const sentences=raw
    .split(/(?<=[.!?…])\s+/)
    .map(x=>x.replace(/\s+/g,' ').trim())
    .filter(x=>x.length>=30)
    .slice(0,120);
  const candidates=[];
  if(global)candidates.push(global);
  if(sentences.length){
    const sceneSlots=Math.max(1,Math.min(3,Math.max(1,Number(maxQueries)||3)-1));
    const picks=[];
    for(let slot=1;slot<=sceneSlots;slot++){
      const ratio=slot/(sceneSlots+1);
      const index=Math.max(0,Math.min(sentences.length-1,Math.round((sentences.length-1)*ratio)));
      if(!picks.includes(index))picks.push(index);
    }
    if(picks.length<sceneSlots&&sentences.length>1){
      for(let index=0;index<sentences.length&&picks.length<sceneSlots;index++){
        if(!picks.includes(index))picks.push(index);
      }
    }
    for(const index of picks){
      const segment=sentences[index];
      const q=creatorAutoWebQuery(title,segment,maxTerms);
      if(q)candidates.push(q);
    }
  }
  const seen=new Set(),out=[];
  for(const q of candidates){
    const key=String(q||'').toLocaleLowerCase('tr-TR').trim();
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(q);
    if(out.length>=Math.max(1,Math.min(4,Number(maxQueries)||3)))break;
  }
  return out;
}
function creatorNarrativeWebQueries(title,script,{maxQueries=4,maxTerms=8}={}){
  const words=String(script||'').trim().split(/\s+/).filter(Boolean);
  const limit=Math.max(1,Math.min(4,Math.floor(Number(maxQueries)||4)));
  const slots=Math.min(limit,Math.max(1,Math.ceil(words.length/20)));
  const queries=[],seen=new Set();
  for(let i=0;i<slots;i++){
    // Contiguous word windows include the opening and closing, without letting
    // a repeated title displace the visual concepts of every chapter.
    const segment=words.slice(Math.floor(i*words.length/slots),Math.floor((i+1)*words.length/slots)).join(' ');
    const q=creatorAutoWebQuery('',segment,maxTerms)||creatorAutoWebQuery(title,'',maxTerms);
    if(!q||seen.has(q))continue;
    seen.add(q);queries.push(q);
  }
  return queries;
}
function creatorSelectNarrativeWebAssets(groups,recent,excluded,maxItems=12){
  const limit=Math.max(1,Math.min(12,Math.floor(Number(maxItems)||12)));
  const ranked=groups.map(group=>creatorPreferUnseenAssetPaths(
    creatorPreferFreshAssetPaths(group,recent,12),excluded,12
  ));
  const selected=ranked.map(()=>[]),seen=new Set();
  // Give each available chapter a slot before filling additional slots.
  while(seen.size<limit){
    let added=false;
    for(let i=0;i<ranked.length&&seen.size<limit;i++){
      const rel=ranked[i].find(x=>!seen.has(x));
      if(!rel)continue;
      seen.add(rel);selected[i].push(rel);added=true;
    }
    if(!added)break;
  }
  const assetQueryOrder=selected.flatMap((paths,queryIndex)=>paths.map(path=>({path,queryIndex})));
  return{paths:assetQueryOrder.map(x=>x.path),assetQueryOrder};
}
async function creatorAutoWebAssets({title='',script='',query='',provider='auto',orientation='portrait',count=5,maxQueries=3,manifestId='',excludePaths=[]}={}){
  const explicit=String(query||'').replace(/[\r\n]+/g,' ').trim().slice(0,140);
  const narrative=String(orientation||'').toLowerCase()==='landscape';
  const queryPlanner=narrative?creatorNarrativeWebQueries:creatorSceneWebQueries;
  const queries=explicit
    ?[explicit]
    :queryPlanner(title,script,{maxQueries,maxTerms:narrative?8:7});
  if(!queries.length)return[];
  try{
    const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
    if(!ready.ok||!ready.ffprobe)return[];
    const wanted=Math.max(1,Math.min(12,Number(count)||5));
    const candidateTarget=Math.min(12,wanted+Math.min(4,queries.length));
    const unique=[],seen=new Set();
    const groups=queries.map(()=>[]);
    const perQuery=Math.max(1,Math.min(4,Math.ceil(wanted/queries.length)));
    const fetchPerQuery=Math.max(perQuery,Math.min(4,perQuery+1));
    for(let i=0;i<queries.length&&unique.length<candidateTarget;i++){
      try{
        // Reserve capacity for every remaining narrative query, even when the
        // first providers return their full allowance of clips.
        const requestCount=narrative
          ?Math.min(fetchPerQuery,Math.ceil((candidateTarget-unique.length)/(queries.length-i)))
          :Math.min(fetchPerQuery,candidateTarget-unique.length);
        const media=await getCreatorWebMedia().searchAndIngest(WORKSPACE,{
          query:queries[i],
          provider:String(provider||'auto'),
          orientation:String(orientation||'portrait'),
          count:requestCount,
          inspect:(rel)=>getCreatorEngine().inspectAsset(WORKSPACE,rel),
          animateImage:(rel,opts)=>getCreatorEngine().animateStillAsset(WORKSPACE,rel,opts),
          manifestId:(String(manifestId||'auto').slice(0,78)+'-q'+String(i+1).padStart(2,'0')).slice(0,90)
        });
        for(const rel of Array.isArray(media&&media.assets)?media.assets:[]){
          const key=String(rel||'');
          if(!key||seen.has(key))continue;
          seen.add(key);unique.push(key);groups[i].push(key);
          if(unique.length>=candidateTarget||(narrative&&groups[i].length>=requestCount))break;
        }
      }catch(_){}
    }
    if(unique.length){
      const recent=creatorRecentWebAssetSet(7);
      if(narrative){
        const excluded=new Set((Array.isArray(excludePaths)?excludePaths:[]).map(x=>String(x||'').replace(/\\/g,'/')));
        const selection=creatorSelectNarrativeWebAssets(groups,recent,excluded,wanted);
        remember({
          kind:'creator_auto_web_media',
          queries:queries.slice(0,4),
          orientation:'landscape',
          count:selection.paths.length,
          candidateCount:unique.length,
          freshCount:selection.paths.filter(rel=>!recent.has(rel)).length,
          freshnessDays:7,
          unseenCount:selection.paths.filter(rel=>!excluded.has(rel)).length,
          batchExcludedCount:excluded.size,
          narrativeAssetOrder:'query-progressive',
          assetQueryOrder:selection.assetQueryOrder,
          coveredQueryCount:new Set(selection.assetQueryOrder.map(x=>x.queryIndex)).size,
          localQueryOnly:true,
          sceneAware:queries.length>1
        });
        return selection.paths;
      }
      const freshOrdered=creatorPreferFreshAssetPaths(unique,recent,wanted);
      const motionOrdered=creatorPreferRealMotionHookAssets(freshOrdered,orientation);
      const batchExcluded=new Set((Array.isArray(excludePaths)?excludePaths:[]).map(x=>String(x||'').replace(/\\/g,'/')));
      const unseenOrdered=creatorPreferUnseenAssetPaths(motionOrdered,batchExcluded,wanted);
      const hookRank=creatorPreferVerifiedMotionHookAssets(unseenOrdered,orientation,ready.ffmpeg);
      const ordered=hookRank.paths.slice(0,wanted);
      const freshCount=ordered.filter(rel=>!recent.has(rel)).length;
      const unseenCount=ordered.filter(rel=>!batchExcluded.has(rel)).length;
      let hookMediaKind='unknown';
      try{
        const first=ordered[0];
        const row=getCreatorWebMedia().sourceRecordsForAssets(WORKSPACE,[first])[0];
        hookMediaKind=String(row&&row.mediaKind||'unknown');
      }catch(_){}
      remember({
        kind:'creator_auto_web_media',
        queries:queries.slice(0,4),
        orientation:String(orientation||''),
        count:ordered.length,
        candidateCount:unique.length,
        freshCount,
        freshnessDays:7,
        unseenCount,
        batchExcludedCount:batchExcluded.size,
        hookMediaKind,
        hookMotionVerified:hookRank.verified,
        hookMotionProbeCount:hookRank.probeCount,
        hookMotionOffset:hookRank.offset,
        hookMotionMeanDifference:Number(hookRank.meanDifference||0),
        localQueryOnly:true,
        sceneAware:queries.length>1
      });
      return ordered;
    }
  }catch(_){}
  return[];
}
function creatorYoutubeDescription(description,assets){
  try{
    const rows=Array.isArray(assets)?assets:[];
    return getCreatorWebMedia().appendAttribution(String(description||''),WORKSPACE,rows,5000);
  }catch(_){
    return String(description||'').trim().slice(0,5000);
  }
}
function creatorBatchReceiptId(missionId,index){
  return String(missionId||'')+'-B'+String(Number(index)+1).padStart(2,'0');
}
function createCreatorBatchMission(args={}){
  const items=normalizeCreatorBatchItems(args);
  const includeYouTube=args.includeYouTube===true;
  const label=String(args.label||('Creator batch '+items.length+' Shorts')).replace(/[\r\n]+/g,' ').trim().slice(0,160)||'Creator batch';
  const steps=items.map((_,i)=>({name:'creator_batch_render_'+String(i+1).padStart(2,'0'),meta:{itemIndex:i}}));
  if(includeYouTube){
    for(let i=0;i<items.length;i++)steps.push({name:'creator_batch_youtube_'+String(i+1).padStart(2,'0'),meta:{itemIndex:i}});
  }
  return getMissionEngine().createMission(WORKSPACE,{
    type:'creator_batch',
    label,
    input:{items,includeYouTube},
    steps
  });
}
function findCreatorBatchChild(parentId,index){
  const pid=String(parentId||'');
  return getMissionEngine().listMissions(WORKSPACE,{limit:1000}).find(m=>
    m&&m.type==='creator_short'&&
    String(m.input&&m.input.batchParent||'')===pid&&
    Number(m.input&&m.input.batchIndex)===Number(index)
  )||null;
}
function verifyCreatorBatchItemAssets(item){
  const selected=Array.isArray(item&&item.creatorAssets)?item.creatorAssets:[];
  for(const asset of selected){
    const rel=String(asset&&asset.path||'');
    const expected=String(asset&&asset.sha256||'');
    const current=getWorkspaceFileEngine().hashFile(safeFile(rel));
    if(!current||current!==expected)throw new Error('CREATOR_STORYBOARD_HASH_CONFLICT: '+rel);
    const inspected=getCreatorEngine().inspectAsset(WORKSPACE,rel);
    if(!inspected.ok){
      const e=new Error('CREATOR_BATCH_STORYBOARD_INVALID: '+rel+' · '+String(inspected.code||'INVALID'));
      e.code=String(inspected.code||'CREATOR_BATCH_STORYBOARD_INVALID');
      throw e;
    }
  }
  return selected;
}
function creatorBatchAssetsMatch(expected,actual){
  const a=Array.isArray(expected)?expected:[],b=Array.isArray(actual)?actual:[];
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++){
    if(String(a[i]&&a[i].path||'')!==String(b[i]&&b[i].path||''))return false;
    if(String(a[i]&&a[i].sha256||'')!==String(b[i]&&b[i].sha256||''))return false;
  }
  return true;
}
function ensureCreatorBatchChild(parentMission,index){
  const input=parentMission&&parentMission.input||{};
  const items=Array.isArray(input.items)?input.items:[];
  const item=items[index];
  if(!item)throw new Error('Creator batch child item missing: '+index);
  const selected=verifyCreatorBatchItemAssets(item);
  const existing=findCreatorBatchChild(parentMission.id,index);
  if(existing){
    if(!creatorBatchAssetsMatch(selected,existing.input&&existing.input.creatorAssets)){
      throw new Error('CREATOR_BATCH_CHILD_STORYBOARD_MISMATCH: '+existing.id);
    }
    return existing;
  }
  return createCreatorShortMission({
    campaignName:item.campaignName,
    script:item.script,
    youtubeTitle:item.youtubeTitle,
    youtubeDescription:item.youtubeDescription,
    creatorAssets:selected.map(x=>x.path),
    includeYouTube:false,
    publish:false,
    _batchParent:parentMission.id,
    _batchIndex:index
  });
}
function createCreatorShortMission(args={}){
  const campaignName=String(args.campaignName||args.name||('short-'+Date.now())).replace(/[\r\n]/g,' ').trim().slice(0,90);
  const script=String(args.script||'').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!script)throw new Error('Kalıcı Short görevi için video anlatım metni gerekli.');
  const includeYouTube=args.includeYouTube===true;
  const publishYouTube=args.publish===true;
  if(publishYouTube&&!includeYouTube)throw new Error('YouTube PUBLIC isteniyorsa includeYouTube=true olmalı.');
  const youtubeTitle=String(args.youtubeTitle||campaignName).replace(/\s+/g,' ').trim().slice(0,100);
  const youtubeDescription=String(args.youtubeDescription||'').trim().slice(0,5000);
  const creatorAssets=normalizeCreatorStoryboardAssets(args.creatorAssets);
  const input={
    campaignName,
    script,
    creatorAssets,
    includeShopify:false,
    includeYouTube,
    publishYouTube,
    batchParent:String(args._batchParent||'').slice(0,90)||null,
    batchIndex:Number.isInteger(Number(args._batchIndex))?Number(args._batchIndex):null,
    product:{title:'',description:'',price:null,sku:'',vendor:'',productType:'',tags:[],images:[]},
    youtube:{title:youtubeTitle,description:youtubeDescription}
  };
  const steps=['render_short'];
  if(includeYouTube)steps.push('youtube_draft');
  if(publishYouTube)steps.push({name:'youtube_publish',meta:{requiresApproval:true}});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'creator_short',
    label:campaignName,
    input,
    steps
  });
}
function createCreatorLongformMission(args={}){
  const campaignName=String(args.campaignName||args.name||('longform-'+Date.now())).replace(/[\r\n]/g,' ').trim().slice(0,90);
  const script=String(args.script||'').replace(/\s+/g,' ').trim().slice(0,18000);
  if(!script)throw new Error('Kalıcı long-form görevi için video anlatım metni gerekli.');
  const includeYouTube=args.includeYouTube===true;
  const publishYouTube=args.publish===true;
  if(publishYouTube&&!includeYouTube)throw new Error('YouTube PUBLIC isteniyorsa includeYouTube=true olmalı.');
  const creatorVoice=normalizeCreatorVoiceName(args.creatorVoice||CREATOR_TTS_VOICE);
  const baselineOverride=Array.isArray(args._creatorAssetBaselines);
  const creatorAssets=baselineOverride
    ?verifyCreatorLongformBaselines(args._creatorAssetBaselines)
    :normalizeCreatorLongformAssets(args.creatorAssets);
  const creatorAssetMode=baselineOverride&&creatorAssets.length<6?'procedural':'auto';
  const youtubeTitle=String(args.youtubeTitle||campaignName).replace(/\s+/g,' ').trim().slice(0,100);
  const youtubeDescription=String(args.youtubeDescription||'').trim().slice(0,5000);
  const input={
    campaignName,
    script,
    creatorVoice,
    creatorAssets,
    creatorAssetMode,
    includeShopify:false,
    includeYouTube,
    publishYouTube,
    dailyPlanId:String(args._dailyPlanId||'').slice(0,90)||null,
    dailyDate:String(args._dailyDate||'').slice(0,32)||null,
    youtube:{title:youtubeTitle,description:youtubeDescription}
  };
  const steps=['render_longform'];
  if(includeYouTube)steps.push('youtube_draft');
  if(publishYouTube)steps.push({name:'youtube_publish',meta:{requiresApproval:true}});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'creator_longform',
    label:campaignName,
    input,
    steps
  });
}

function creatorDailyDefaultPlan(){
  return{
    version:1,
    planId:'creator-daily-longform-v1',
    enabled:true,
    timezone:'Europe/Istanbul',
    language:'Türkçe',
    creatorVoice:CREATOR_TTS_VOICE,
    includeYouTube:true,
    topicPrompt:'Her gün farklı bir alandan geniş kitleye hitap eden, merak uyandıran ve evergreen bir konu seç. Teknoloji, bilim, tarih, kültür, psikoloji, tasarım, uzay, internet kültürü ve günlük yaşam arasında çeşitlilik sağla.',
    creatorAssets:[],
    updatedAt:null,
    lastAttemptAt:null,
    lastAttemptDate:null,
    lastCreatedDate:null,
    lastMissionId:null,
    lastError:null
  };
}
function safeCreatorDailyTimezone(value){
  const zone=String(value||'Europe/Istanbul').trim().slice(0,80)||'Europe/Istanbul';
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date());return zone}catch(_){return'Europe/Istanbul'}
}
function readCreatorDailyPlan(){
  const base=creatorDailyDefaultPlan();
  try{
    if(!fs.existsSync(CREATOR_DAILY_PLAN_FILE))return base;
    const x=JSON.parse(fs.readFileSync(CREATOR_DAILY_PLAN_FILE,'utf8'));
    if(!x||typeof x!=='object')return base;
    return{
      ...base,
      ...x,
      version:1,
      planId:'creator-daily-longform-v1',
      enabled:x.enabled===true,
      timezone:safeCreatorDailyTimezone(x.timezone),
      creatorVoice:normalizeCreatorVoiceName(x.creatorVoice||CREATOR_TTS_VOICE),
      creatorAssets:Array.isArray(x.creatorAssets)?x.creatorAssets.slice(0,20):[]
    };
  }catch(e){
    return{...base,lastError:'DAILY_PLAN_READ_FAILED: '+String(e.message||e).slice(0,220)};
  }
}
function writeCreatorDailyPlan(plan){
  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  const clean={...creatorDailyDefaultPlan(),...(plan||{}),version:1,planId:'creator-daily-longform-v1',updatedAt:new Date().toISOString()};
  fs.writeFileSync(CREATOR_DAILY_PLAN_FILE,JSON.stringify(clean,null,2),'utf8');
  return clean;
}
function configureCreatorDailyPlan(args={}){
  const action=String(args.action||'status').trim().toLowerCase();
  const current=readCreatorDailyPlan();
  if(action==='status')return current;
  if(action==='disable')return writeCreatorDailyPlan({...current,enabled:false,lastError:null});
  if(action!=='enable')throw new Error('Creator günlük plan action enable/disable/status olmalı.');
  const next={
    ...current,
    enabled:true,
    timezone:safeCreatorDailyTimezone(args.timezone||current.timezone),
    language:String(args.language||current.language||'Türkçe').replace(/[\r\n]+/g,' ').trim().slice(0,80)||'Türkçe',
    creatorVoice:normalizeCreatorVoiceName(args.creatorVoice||current.creatorVoice||CREATOR_TTS_VOICE),
    includeYouTube:args.includeYouTube!==false,
    topicPrompt:String(args.topicPrompt||current.topicPrompt||'').replace(/\s+/g,' ').trim().slice(0,1200),
    creatorAssets:Array.isArray(args.creatorAssets)?normalizeCreatorLongformAssets(args.creatorAssets):current.creatorAssets,
    lastAttemptAt:null,
    lastAttemptDate:null,
    lastError:null
  };
  return writeCreatorDailyPlan(next);
}
function creatorDailyDateKey(timezone='Europe/Istanbul',date=new Date()){
  const zone=safeCreatorDailyTimezone(timezone);
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date);
  const map={};
  for(const part of parts)if(part.type!=='literal')map[part.type]=part.value;
  return String(map.year||'0000')+'-'+String(map.month||'00')+'-'+String(map.day||'00');
}
function findCreatorDailyMission(planId,dateKey){
  const pid=String(planId||'creator-daily-longform-v1');
  const day=String(dateKey||'');
  return getMissionEngine().listMissions(WORKSPACE,{limit:1000}).find(m=>
    m&&m.type==='creator_longform'&&
    String(m.input&&m.input.dailyPlanId||'')===pid&&
    String(m.input&&m.input.dailyDate||'')===day
  )||null;
}
function defaultCreatorAssetCatalog(){
  return{version:1,updatedAt:null,assets:{}};
}
function readCreatorAssetCatalog(){
  try{
    if(!fs.existsSync(CREATOR_ASSET_CATALOG_FILE))return defaultCreatorAssetCatalog();
    const x=JSON.parse(fs.readFileSync(CREATOR_ASSET_CATALOG_FILE,'utf8'));
    return{
      version:1,
      updatedAt:x&&x.updatedAt||null,
      assets:x&&x.assets&&typeof x.assets==='object'&&!Array.isArray(x.assets)?x.assets:{}
    };
  }catch(_){return defaultCreatorAssetCatalog()}
}
function writeCreatorAssetCatalog(catalog){
  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  const clean={
    version:1,
    updatedAt:new Date().toISOString(),
    assets:catalog&&catalog.assets&&typeof catalog.assets==='object'?catalog.assets:{}
  };
  fs.writeFileSync(CREATOR_ASSET_CATALOG_FILE,JSON.stringify(clean,null,2),'utf8');
  return clean;
}
function creatorSemanticTokens(text){
  const stop=new Set(['bir','bu','ve','veya','ile','için','icin','olan','olarak','daha','çok','cok','gibi','şey','sey','video','klip','görüntü','goruntu','sahne']);
  return new Set(String(text||'')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9çğıöşü\s-]/gi,' ')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(x=>x.length>=3&&!stop.has(x))
    .slice(0,800));
}
function creatorCatalogLexicalScore(entry,queryTokens){
  const tags=Array.isArray(entry&&entry.tags)?entry.tags:[];
  const tagTokens=creatorSemanticTokens(tags.join(' '));
  const summaryTokens=creatorSemanticTokens(entry&&entry.summary||'');
  let score=0;
  for(const token of queryTokens){
    if(tagTokens.has(token))score+=4;
    if(summaryTokens.has(token))score+=2;
  }
  return score;
}
async function creatorAssetPreviewBase64(relativePath){
  const rel=getWorkspaceFileEngine().normalizeRel(relativePath);
  const inspected=getCreatorEngine().inspectAsset(WORKSPACE,rel);
  if(!inspected.ok)return{ok:false,error:String(inspected.code||'CREATOR_ASSET_INVALID')};
  const status=getCreatorEngine().ffmpegStatus(WORKSPACE);
  if(!status.ffmpeg)return{ok:false,error:'FFMPEG_MISSING'};
  const input=safeFile(rel);
  const at=Math.max(0.15,Math.min(Math.max(0.15,Number(inspected.duration||1)-0.2),Number(inspected.duration||1)*0.38));
  const file=path.join(os.tmpdir(),'jarvis-creator-preview-'+process.pid+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.jpg');
  try{
    await runHidden(status.ffmpeg,[
      '-y','-hide_banner','-loglevel','error',
      '-ss',at.toFixed(3),'-i',input,
      '-frames:v','1','-vf','scale=768:-2:force_original_aspect_ratio=decrease',
      '-q:v','4',file
    ],30000);
    if(!fs.existsSync(file)||fs.statSync(file).size<512)return{ok:false,error:'CREATOR_PREVIEW_EMPTY'};
    const image=fs.readFileSync(file).toString('base64');
    return{ok:true,image,at:Number(at.toFixed(3)),bytes:fs.statSync(file).size,inspected};
  }catch(e){
    return{ok:false,error:String(e.message||e).slice(0,300)};
  }finally{
    try{if(fs.existsSync(file))fs.unlinkSync(file)}catch(_){}
  }
}
async function classifyCreatorAssetSemantic(relativePath){
  const rel=getWorkspaceFileEngine().normalizeRel(relativePath);
  if(!/^creator-assets\//i.test(rel))throw new Error('CREATOR_SEMANTIC_ASSET_SCOPE');
  const full=safeFile(rel);
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('CREATOR_SEMANTIC_ASSET_MISSING');
  const sha256=getWorkspaceFileEngine().hashFile(full);
  if(!sha256)throw new Error('CREATOR_SEMANTIC_HASH_MISSING');
  const catalog=readCreatorAssetCatalog();
  const existing=catalog.assets[rel];
  if(existing&&String(existing.sha256||'')===sha256&&Array.isArray(existing.tags)&&existing.tags.length){
    return{...existing,reused:true};
  }

  const status=await localBrainStatus();
  if(!status.ready||!status.installed||!isLocalVisionModel(status.model)){
    return{path:rel,sha256,indexed:false,error:'LOCAL_VISION_NOT_READY'};
  }
  const preview=await creatorAssetPreviewBase64(rel);
  if(!preview.ok)return{path:rel,sha256,indexed:false,error:preview.error};

  const schema={
    type:'object',
    properties:{
      summary:{type:'string'},
      tags:{type:'array',items:{type:'string'},minItems:3,maxItems:12}
    },
    required:['summary','tags'],
    additionalProperties:false
  };
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),60000);
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model:status.model,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.18,top_p:0.82,repeat_penalty:1.06,num_ctx:Math.min(LOCAL_BRAIN_CTX,8192),num_predict:220},
        messages:[
          {role:'system',content:'Sen JARVIS Creator yerel B-roll katalog modülüsün. Görüntüyü yalnız görünen içerikle sınıflandır. Kişi kimliği veya hassas özellik çıkarımı yapma. 5-12 kısa Türkçe görsel etiket ve tek kısa açıklama üret. SADECE JSON şemasına uy.'},
          {role:'user',content:'Bu Creator video klibinin temsilî karesini, ileride anlatıma uygun B-roll seçebilmek için etiketle.',images:[preview.image]}
        ]
      }),
      signal:ctl.signal
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    const tags=Array.isArray(parsed&&parsed.tags)
      ? parsed.tags.map(x=>String(x||'').toLocaleLowerCase('tr-TR').replace(/[\r\n]+/g,' ').trim().slice(0,60)).filter(Boolean).slice(0,12)
      : [];
    const summary=String(parsed&&parsed.summary||'').replace(/\s+/g,' ').trim().slice(0,320);
    if(tags.length<3||!summary)throw new Error('CREATOR_SEMANTIC_BAD_JSON');
    const entry={
      path:rel,sha256,summary,tags,
      previewAt:preview.at,
      model:String(status.model||'').slice(0,100),
      indexedAt:new Date().toISOString()
    };
    catalog.assets[rel]=entry;
    writeCreatorAssetCatalog(catalog);
    remember({kind:'creator_asset_semantic_index',path:rel,tags:tags.length,model:entry.model,localOnly:true});
    return{...entry,indexed:true,reused:false};
  }finally{clearTimeout(timer)}
}
let creatorAssetCatalogBusy=false;
async function serviceCreatorAssetSemanticCatalog({maxItems=1}={}){
  if(creatorAssetCatalogBusy)return{ok:true,skipped:'busy'};
  creatorAssetCatalogBusy=true;
  try{
    const files=getWorkspaceFileEngine();
    const catalog=readCreatorAssetCatalog();
    const all=getCreatorEngine().listAssets(WORKSPACE)
      .map(full=>path.relative(WORKSPACE,full).replace(/\\/g,'/'));
    const pending=[];
    for(const rel of all){
      const full=safeFile(rel);
      const sha256=files.hashFile(full);
      const entry=catalog.assets[rel];
      if(!entry||String(entry.sha256||'')!==String(sha256||'')||!Array.isArray(entry.tags)||entry.tags.length<3)pending.push(rel);
    }
    const limit=Math.max(1,Math.min(4,Number(maxItems)||1));
    const results=[];
    for(const rel of pending.slice(0,limit)){
      try{results.push(await classifyCreatorAssetSemantic(rel))}
      catch(e){results.push({path:rel,indexed:false,error:String(e.message||e).slice(0,240)})}
    }
    return{ok:true,total:all.length,pending:Math.max(0,pending.length-results.length),indexed:results.filter(x=>x&&x.indexed).length,results};
  }finally{creatorAssetCatalogBusy=false}
}
function creatorSemanticNarrativeDigest(query,maxChars=3200){
  const cap=Math.max(900,Math.min(6000,Math.floor(Number(maxChars)||3200)));
  try{
    return getCreatorSemanticQuality().buildNarrativeDigest(query,{maxChars:cap});
  }catch(_){
    const raw=String(query||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
    if(!raw)return{text:'',sections:[],originalChars:0,outputChars:0,truncated:false,fallback:true};
    if(raw.length<=cap)return{text:raw,sections:[{label:'TÜM ANLATIM',ratio:0,text:raw}],originalChars:raw.length,outputChars:raw.length,truncated:false,fallback:true};
    const part=Math.max(220,Math.floor((cap-80)/3));
    const middleStart=Math.max(0,Math.floor((raw.length-part)/2));
    const sections=[
      {label:'BAŞLANGIÇ',ratio:0,text:raw.slice(0,part)},
      {label:'ORTA',ratio:0.5,text:raw.slice(middleStart,middleStart+part)},
      {label:'KAPANIŞ',ratio:1,text:raw.slice(Math.max(0,raw.length-part))}
    ].map(x=>({...x,text:x.text.replace(/\s+/g,' ').trim()}));
    const text=sections.map(x=>'['+x.label+']\n'+x.text).join('\n\n').slice(0,cap);
    return{text,sections,originalChars:raw.length,outputChars:text.length,truncated:true,fallback:true};
  }
}

async function selectCreatorRelevantAssetBaselines(query,maxItems=12){
  const files=getWorkspaceFileEngine();
  const catalog=readCreatorAssetCatalog();
  const queryTokens=creatorSemanticTokens(query);
  const rows=[];
  for(const [rel,entry] of Object.entries(catalog.assets||{})){
    try{
      if(!/^creator-assets\//i.test(rel))continue;
      const full=safeFile(rel);
      if(!fs.existsSync(full)||!fs.statSync(full).isFile())continue;
      const sha256=files.hashFile(full);
      if(!sha256||sha256!==String(entry&&entry.sha256||''))continue;
      const score=creatorCatalogLexicalScore(entry,queryTokens);
      rows.push({id:'A'+String(rows.length+1).padStart(3,'0'),path:rel,sha256,summary:String(entry.summary||''),tags:Array.isArray(entry.tags)?entry.tags:[],score});
    }catch(_){}
  }
  if(!rows.length)return[];
  rows.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
  const narrativeDigest=creatorSemanticNarrativeDigest(query,3200);
  let ordered=rows.slice();
  let modelPickedPaths=[];
  try{
    const status=await localBrainStatus();
    if(status.ready&&status.installed){
      const candidates=rows.slice(0,40);
      const schema={
        type:'object',
        properties:{ids:{type:'array',items:{type:'string'},maxItems:20}},
        required:['ids'],
        additionalProperties:false
      };
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
      try{
        const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            model:status.deepInstalled&&status.deepModel?status.deepModel:status.model,
            stream:false,think:false,format:schema,keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
            options:{temperature:0.12,top_p:0.82,num_ctx:Math.min(LOCAL_BRAIN_CTX,8192),num_predict:180},
            messages:[
              {role:'system',content:'Sen JARVIS Creator B-roll seçicisisin. Anlatının başı, ortası ve sonunu kapsayan semantik olarak uygun ve birbirinden görsel olarak farklı klip kimliklerini sırala. Kimlikleri anlatıda kullanılacak kronolojik sırada ver: önce başlangıca, sonra orta bölüme, en son kapanışa uygun klipler. Aynı kavramı anlatan çok benzer klipleri art arda veya gereksiz tekrar seçme. Yalnız verilen kimlikleri kullan ve SADECE JSON şemasına uy.'},
              {role:'user',content:'ANLATIM ÖZETİ (başlangıç / orta / kapanış):\n'+narrativeDigest.text+'\n\nKLİPLER:\n'+candidates.map(x=>x.id+' | '+x.tags.join(', ')+' | '+x.summary).join('\n')}
            ]
          }),signal:ctl.signal
        });
        const j=await r.json().catch(()=>({}));
        if(r.ok){
          const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
          const wanted=Array.isArray(parsed&&parsed.ids)?parsed.ids.map(x=>String(x||'')):[];
          const map=new Map(candidates.map(x=>[x.id,x]));
          const picked=wanted.map(id=>map.get(id)).filter(Boolean);
          modelPickedPaths=picked.map(x=>x.path);
          if(picked.length)ordered=[...picked,...rows.filter(x=>!picked.some(p=>p.path===x.path))];
        }
      }finally{clearTimeout(timer)}
    }
  }catch(_){}
  const limit=Math.max(1,Math.min(20,Number(maxItems)||12));
  const fallbackEligible=ordered.filter(x=>Number(x&&x.score||0)>=1||modelPickedPaths.includes(String(x&&x.path||'')));
  let diversity={
    rows:fallbackEligible.slice(0,limit),
    evidence:{
      candidateCount:ordered.length,
      eligibleCount:fallbackEligible.length,
      selectedCount:Math.min(limit,fallbackEligible.length),
      rejectedSimilarCount:0,
      rejectedLowRelevanceCount:Math.max(0,ordered.length-fallbackEligible.length),
      maxSimilarity:null,
      minScore:1,
      modelAllowlistCount:modelPickedPaths.length,
      fallbackUsed:true,
      relevanceFloorBlockedAll:ordered.length>0&&fallbackEligible.length===0
    }
  };
  try{
    diversity=getCreatorSemanticQuality().diversifySemanticRows(ordered,{
      maxItems:limit,
      minScore:1,
      maxSimilarity:0.72,
      allowPaths:modelPickedPaths
    });
  }catch(_){}
  let narrativeOrder={rows:diversity.rows,evidence:{applied:false,sectionCount:0,selectedCount:diversity.rows.length,assignments:[]}};
  try{
    narrativeOrder=getCreatorSemanticQuality().orderRowsByNarrativeSections(diversity.rows,narrativeDigest.sections);
    diversity={...diversity,rows:narrativeOrder.rows};
  }catch(_){}
  remember({
    kind:'creator_semantic_diversity',
    ...diversity.evidence,
    narrativeOrderApplied:!!narrativeOrder.evidence.applied,
    narrativeOrderAssignments:Array.isArray(narrativeOrder.evidence.assignments)?narrativeOrder.evidence.assignments.slice(0,20):[],
    narrativeDigestSections:Array.isArray(narrativeDigest.sections)?narrativeDigest.sections.length:0,
    narrativeDigestChars:Number(narrativeDigest.outputChars||0),
    narrativeOriginalChars:Number(narrativeDigest.originalChars||0),
    narrativeDigestTruncated:!!narrativeDigest.truncated,
    localOnly:true
  });
  return diversity.rows.map(x=>({
    path:x.path,
    sha256:x.sha256,
    relevanceScore:x.score,
    semanticModelPicked:modelPickedPaths.includes(x.path)
  }));
}
function mergeCreatorAssetBaselines(primary,fallback,maxItems=12){
  const out=[],seen=new Set();
  for(const row of [...(Array.isArray(primary)?primary:[]),...(Array.isArray(fallback)?fallback:[])]){
    const p=String(row&&row.path||'');
    const h=String(row&&row.sha256||'');
    if(!p||!h||seen.has(p))continue;
    seen.add(p);out.push({path:p,sha256:h});
    if(out.length>=Math.max(1,Math.min(20,Number(maxItems)||12)))break;
  }
  return out;
}
function chooseCreatorDailyBaselines(web,semantic,maxItems=12){
  return mergeCreatorAssetBaselines(web,semantic,maxItems);
}

function creatorDailyAutoAssetBaselines(dateKey,maxItems=12){
  const all=getCreatorEngine().listAssets(WORKSPACE);
  if(!all.length)return[];
  const seed=crypto.createHash('sha256').update('daily-longform-assets|'+String(dateKey||'')).digest().readUInt32BE(0);
  const offset=seed%all.length;
  const rotated=all.slice(offset).concat(all.slice(0,offset));
  const selected=rotated.slice(0,Math.min(Math.max(1,Number(maxItems)||12),12,rotated.length))
    .map(full=>path.relative(WORKSPACE,full).replace(/\\/g,'/'));
  return normalizeCreatorLongformAssets(selected);
}
function creatorDailyTheme(dateKey){
  const themes=[
    'teknoloji ve yapay zeka','bilim ve uzay','tarih ve şaşırtıcı olaylar','insan davranışı ve psikoloji',
    'tasarım ve mühendislik','internet kültürü ve dijital yaşam','doğa ve dünya','gelecek fikirleri',
    'günlük yaşamı değiştiren icatlar','oyun, eğlence ve yaratıcı kültür'
  ];
  const hash=crypto.createHash('sha1').update(String(dateKey||'daily')).digest();
  return themes[hash.readUInt32BE(0)%themes.length];
}
async function generateCreatorDailyLongformBrief(plan,dateKey){
  const status=await localBrainStatus();
  if(!status.ready)throw new Error('DAILY_LOCAL_BRAIN_OFFLINE');
  if(!status.installed)throw new Error('DAILY_LOCAL_MODEL_MISSING');
  const model=status.deepInstalled&&status.deepModel?status.deepModel:status.model;
  const schema={
    type:'object',
    properties:{
      title:{type:'string'},
      description:{type:'string'},
      script:{type:'string'}
    },
    required:['title','description','script'],
    additionalProperties:false
  };
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),4*60*1000);
  try{
    const r=await fetch(LOCAL_BRAIN_URL+'/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model,
        stream:false,
        think:false,
        format:schema,
        keep_alive:LOCAL_BRAIN_KEEP_ALIVE,
        options:{temperature:0.68,top_p:0.9,repeat_penalty:1.08,num_ctx:LOCAL_BRAIN_CTX,num_predict:3600},
        messages:[
          {role:'system',content:[
            'Sen JARVIS Creator editörüsün. Ücretli API veya dış kaynak kullanmadan yaklaşık 10 dakikalık YouTube anlatım metni hazırla.',
            'Dil: '+String(plan.language||'Türkçe')+'.',
            'Bugünün tema alanı: '+creatorDailyTheme(dateKey)+'.',
            'Metin doğal seslendirmede yaklaşık 9.5-10.5 dakika sürmeli. Boş lafla uzatma; güçlü hook, anlaşılır bölümler ve net kapanış kullan.',
            'Güncel/breaking haber iddiası, sahte kaynak, sahte alıntı veya doğrulanmamış kesin sayı üretme. Evergreen ve genel bilgi ağırlıklı kal.',
            'Başlık merak uyandırsın ama yanıltıcı clickbait olmasın. Açıklama kısa ve yayın taslağına uygun olsun.',
            'Yalnızca JSON şemasına uy.'
          ].join(' ')},
          {role:'user',content:'Tarih anahtarı: '+dateKey+'\nİçerik yönü: '+String(plan.topicPrompt||'Her gün farklı ilgi çekici konu seç.')}
        ]
      }),
      signal:ctl.signal
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('OLLAMA '+r.status));
    const parsed=extractLocalBrainJson(j&&j.message&&j.message.content);
    if(!parsed||!parsed.script)throw new Error('DAILY_CREATOR_BAD_JSON');
    const script=String(parsed.script||'').replace(/\s+/g,' ').trim().slice(0,18000);
    const words=script.split(/\s+/).filter(Boolean).length;
    if(script.length<2500)throw new Error('DAILY_CREATOR_SCRIPT_TOO_SHORT');
    if(words>400&&(words<1050||words>1750))throw new Error('DAILY_CREATOR_WORD_TARGET_MISS: '+words);
    return{
      title:String(parsed.title||('JARVIS Daily '+dateKey)).replace(/\s+/g,' ').trim().slice(0,100),
      description:String(parsed.description||'').trim().slice(0,5000),
      script
    };
  }finally{clearTimeout(timer)}
}
let creatorDailyServiceBusy=false;
async function serviceCreatorDailyPlan({force=false}={}){
  if(creatorDailyServiceBusy)return{ok:true,skipped:'busy'};
  creatorDailyServiceBusy=true;
  try{
    let plan=readCreatorDailyPlan();
    if(!plan.enabled)return{ok:true,status:'disabled'};
    const dateKey=creatorDailyDateKey(plan.timezone);
    const existing=findCreatorDailyMission(plan.planId,dateKey);
    if(existing){
      if(plan.lastCreatedDate!==dateKey||plan.lastMissionId!==existing.id){
        plan=writeCreatorDailyPlan({...plan,lastCreatedDate:dateKey,lastMissionId:existing.id,lastError:null});
      }
      return{ok:true,status:'existing',dateKey,missionId:existing.id,missionStatus:existing.status};
    }
    const lastAttemptMs=Date.parse(String(plan.lastAttemptAt||''));
    if(!force&&plan.lastAttemptDate===dateKey&&Number.isFinite(lastAttemptMs)&&(Date.now()-lastAttemptMs)<10*60*1000){
      return{ok:true,status:'cooldown',dateKey,lastAttemptAt:plan.lastAttemptAt};
    }
    plan=writeCreatorDailyPlan({...plan,lastAttemptAt:new Date().toISOString(),lastAttemptDate:dateKey,lastError:null});
    try{
      const brief=await generateCreatorDailyLongformBrief(plan,dateKey);
      await serviceCreatorAssetSemanticCatalog({maxItems:2}).catch(()=>({ok:false}));
      const configured=Array.isArray(plan.creatorAssets)&&plan.creatorAssets.length
        ?verifyCreatorLongformBaselines(plan.creatorAssets)
        :[];
      const semantic=configured.length?[]:await selectCreatorRelevantAssetBaselines(brief.title+' '+brief.script,12);
      let web=[];
      if(!configured.length){
        try{
          const assets=await creatorAutoWebAssets({
            title:brief.title,
            script:brief.script,
            provider:'auto',
            orientation:'landscape',
            count:4,
            maxQueries:3,
            manifestId:'daily-'+dateKey
          });
          web=normalizeCreatorLongformAssets(assets);
        }catch(_){}
      }
      const automatic=configured.length
        ?configured
        :chooseCreatorDailyBaselines(web,semantic,12);
      const mission=createCreatorLongformMission({
        campaignName:'daily-'+dateKey+'-'+brief.title,
        script:brief.script,
        youtubeTitle:brief.title,
        youtubeDescription:brief.description,
        creatorVoice:plan.creatorVoice,
        includeYouTube:plan.includeYouTube!==false,
        publish:false,
        _creatorAssetBaselines:automatic,
        _dailyPlanId:plan.planId,
        _dailyDate:dateKey
      });
      writeCreatorDailyPlan({...plan,lastCreatedDate:dateKey,lastMissionId:mission.id,lastError:null});
      remember({kind:'creator_daily_longform_created',dateKey,missionId:mission.id,includeYouTube:plan.includeYouTube!==false,published:false,assetMode:automatic.length?'relevant':'procedural'});
      return{ok:true,status:'created',dateKey,missionId:mission.id};
    }catch(e){
      const error=String(e.message||e).slice(0,500);
      writeCreatorDailyPlan({...plan,lastError:error});
      remember({kind:'creator_daily_longform_error',dateKey,error});
      return{ok:false,status:'error',dateKey,error};
    }
  }finally{creatorDailyServiceBusy=false}
}

function normalizePcMissionActions(args={}){
  const rows=Array.isArray(args.actions)?args.actions.slice(0,8):[];
  if(!rows.length)throw new Error('Kalıcı PC görevi için en az bir güvenli action gerekli.');
  const statusTargets=new Set(['system','disk','network','power']);
  const openTargets=new Set([
    'youtube','google','github','chatgpt','opera gx','chrome','edge',
    'not defteri','notepad','hesap makinesi','calculator','dosya gezgini','gezgin',
    'görev yöneticisi','gorev yoneticisi','paint','ayarlar','settings',
    'ses ayarları','ses ayarlari','bluetooth ayarları','bluetooth ayarlari',
    'wifi ayarları','wi-fi ayarları','wifi ayarlari','çalışma alanı','calisma alani','workspace','jarvis workspace',
    'tarayıcı','tarayici','browser','internet'
  ]);
  const mediaActions=new Set(['volume_up','volume_down','mute','play_pause','next','previous','stop']);
  return rows.map((row,index)=>{
    const kind=String(row&&row.kind||'').trim().toLowerCase();
    const target=String(row&&row.target||'').replace(/[\r\n]+/g,' ').toLocaleLowerCase('tr-TR').trim().replace(/\s+/g,' ').slice(0,100);
    const action=String(row&&row.action||'').trim().toLowerCase();
    if(kind==='status'){
      if(!statusTargets.has(target))throw new Error('Desteklenmeyen PC status action '+(index+1)+': '+target);
      return{kind,target};
    }
    if(kind==='open'){
      if(!openTargets.has(target))throw new Error('Bu hedef kalıcı PC allowlist içinde değil: '+target);
      return{kind,target};
    }
    if(kind==='media'){
      if(!mediaActions.has(action))throw new Error('Desteklenmeyen medya action '+(index+1)+': '+action);
      return{kind,action};
    }
    throw new Error('Desteklenmeyen PC action türü: '+kind);
  });
}
function pcMissionCommand(action){
  const row=action&&typeof action==='object'?action:{};
  if(row.kind==='status'){
    return{system:'sistem durumu',disk:'disk durumu',network:'ağ durumu',power:'pil durumu'}[String(row.target||'')]||'';
  }
  if(row.kind==='open')return String(row.target||'').trim()+' aç';
  if(row.kind==='media'){
    return{
      volume_up:'sesi yükselt',
      volume_down:'sesi azalt',
      mute:'sessize al',
      play_pause:'oynat',
      next:'sonraki',
      previous:'önceki',
      stop:'medyayı durdur'
    }[String(row.action||'')]||'';
  }
  return'';
}
function createPcSafeMission(args={}){
  const actions=normalizePcMissionActions(args);
  const label=String(args.label||'PC güvenli görev').replace(/[\r\n]+/g,' ').trim().slice(0,160)||'PC güvenli görev';
  const steps=actions.map((_,i)=>({name:'pc_action_'+String(i+1).padStart(2,'0'),meta:{actionIndex:i}}));
  return getMissionEngine().createMission(WORKSPACE,{
    type:'pc_safe',
    label,
    input:{actions},
    steps
  });
}

function createWorkspaceFileMission(args={}){
  const operations=getWorkspaceFileEngine().normalizeOperations(WORKSPACE,args.operations);
  const label=String(args.label||'Workspace dosya görevi').replace(/[\r\n]+/g,' ').trim().slice(0,160)||'Workspace dosya görevi';
  const steps=operations.map((_,i)=>({name:'workspace_file_'+String(i+1).padStart(2,'0'),meta:{operationIndex:i}}));
  return getMissionEngine().createMission(WORKSPACE,{
    type:'workspace_file',
    label,
    input:{operations},
    steps
  });
}

function createShopifyProductMission(args={}){
  const title=String(args.title||args.productTitle||'').replace(/\s+/g,' ').trim().slice(0,255);
  if(!title)throw new Error('Kalıcı Shopify ürün görevi için ürün başlığı gerekli.');
  const tags=Array.isArray(args.tags)?args.tags.map(x=>String(x||'').trim()).filter(Boolean).slice(0,50):[];
  const images=Array.isArray(args.images)?args.images.map(x=>String(x||'').trim()).filter(x=>/^https:\/\//i.test(x)).slice(0,20):[];
  const price=(args.price===undefined||args.price===null||args.price==='')?null:Number(args.price);
  const compareAtPrice=(args.compareAtPrice===undefined||args.compareAtPrice===null||args.compareAtPrice==='')?null:Number(args.compareAtPrice);
  const publishRequested=args.publish===true;
  const input={
    campaignName:title,
    script:'',
    includeShopify:true,
    includeYouTube:false,
    publishRequested,
    product:{
      title,
      description:String(args.description||args.productDescription||'').trim().slice(0,6000),
      price:Number.isFinite(price)?price:null,
      compareAtPrice:Number.isFinite(compareAtPrice)?compareAtPrice:null,
      sku:String(args.sku||'').trim().slice(0,120),
      vendor:String(args.vendor||'VAROVA').replace(/\s+/g,' ').trim().slice(0,255)||'VAROVA',
      productType:String(args.productType||'').replace(/\s+/g,' ').trim().slice(0,255),
      tags,
      images
    },
    youtube:{title:'',description:''}
  };
  const steps=['shopify_draft'];
  if(publishRequested)steps.push({name:'shopify_publish',meta:{requiresApproval:true}});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'shopify_product',
    label:title,
    input,
    steps
  });
}

function browserMissionSafeUrl(raw){
  const text=String(raw||'').trim();
  if(!text)throw new Error('Kalıcı browser görevi için URL gerekli.');
  const safe=getBrowserOperator().safeUrl(text);
  const u=new URL(safe);
  if(u.username||u.password)throw new Error('URL içinde kullanıcı adı/parola kaydedilemez.');
  for(const [key] of u.searchParams){
    if(/(?:token|secret|pass(?:word)?|api[_-]?key|session|auth|otp|code)/i.test(String(key||''))){
      throw new Error('Hassas URL sorgu parametresi kalıcı göreve kaydedilemez: '+key);
    }
  }
  return u.toString();
}
function normalizeBrowserMissionFields(args={}){
  const rows=Array.isArray(args.fields)?args.fields.slice(0,20):[];
  const sensitive=/(?:password|parola|şifre|sifre|token|secret|api\s*key|api[_-]?key|otp|tek\s*kullanımlık|doğrulama\s*kodu|dogrulama\s*kodu|verification\s*code|cvv|cvc|card\s*number|kart\s*numarası|kart\s*numarasi|iban|banka\s*hesap|bank\s*account|kredi\s*kart)/i;
  return rows.map((row,index)=>{
    const label=String(row&&row.label||'').replace(/[\r\n]+/g,' ').trim().slice(0,180);
    const value=String((row&&row.value)??'');
    if(!label)throw new Error('Browser form alan etiketi gerekli: '+(index+1));
    if(sensitive.test(label))throw new Error('Hassas form alanı kalıcı browser görevinde saklanamaz: '+label);
    if(Buffer.byteLength(value,'utf8')>4000)throw new Error('Browser form alan değeri 4KB sınırını aşıyor: '+label);
    return{label,value};
  });
}
function browserMissionHardDeniedClick(text){
  return /(?:publish|yayınla|yayinla|public|satın\s*al|satin\s*al|buy\s*now|purchase|checkout|öde|ode|pay\s*now|place\s*order|confirm\s*order|sipariş(?:i)?\s*onayla|siparis(?:i)?\s*onayla|delete|sil|hesabı\s*kapat|hesabi\s*kapat|remove\s*account|transfer|havale|withdraw|para\s*çek|para\s*cek|bet|bahis)/i.test(String(text||''));
}
function createBrowserFormMission(args={}){
  const url=browserMissionSafeUrl(args.url);
  const fields=normalizeBrowserMissionFields(args);
  const label=String(args.label||'Web form hazırlığı').replace(/[\r\n]+/g,' ').trim().slice(0,160)||'Web form hazırlığı';
  const finalClick=String(args.finalClick||'').replace(/[\r\n]+/g,' ').trim().slice(0,180);
  if(finalClick&&browserMissionHardDeniedClick(finalClick)){
    throw new Error('Bu yüksek riskli tıklama generic browser göreviyle çalıştırılmaz; ilgili özel approval-gated akış kullanılmalı.');
  }
  const steps=['browser_prepare'];
  if(finalClick)steps.push({name:'browser_click',meta:{requiresApproval:true}});
  steps.push('browser_verify');
  return getMissionEngine().createMission(WORKSPACE,{
    type:'browser_form',
    label,
    input:{url,fields,finalClick},
    steps
  });
}

function developerProjectSlug(value){
  const s=String(value||'').trim().replace(/\s+/g,'-').replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'').slice(0,80);
  if(!s||s==='.'||s==='..')throw new Error('Geçerli proje adı gerekli.');
  return s;
}
function normalizeDeveloperFiles(args={},projectName='project'){
  const allowedExt=new Set(['.html','.css','.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.md','.txt','.py','.yml','.yaml']);
  const raw=Array.isArray(args.files)?args.files.slice(0,12):[];
  let files=raw.map(x=>({
    path:String(x&&x.path||'').replace(/\\/g,'/').replace(/^\/+/, '').trim(),
    content:String(x&&x.content||'')
  }));
  if(!files.length){
    const title=String(args.title||args.projectName||projectName).replace(/[<>]/g,'').trim().slice(0,100)||projectName;
    const summary=String(args.summary||'JARVIS tarafından oluşturulan yerel web uygulaması.').replace(/[<>]/g,'').trim().slice(0,1200);
    const features=Array.isArray(args.features)?args.features.map(x=>String(x||'').replace(/[<>]/g,'').trim()).filter(Boolean).slice(0,8):[];
    const featureHtml=features.length?features.map(x=>'<li>'+x.replace(/&/g,'&amp;')+'</li>').join(''):'<li>Başlangıç sürümü hazır</li>';
    files=[
      {path:'index.html',content:'<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>'+title+'</h1><p>'+summary.replace(/&/g,'&amp;')+'</p><ul>'+featureHtml+'</ul><button id="jarvisAction">Çalıştır</button><p id="status"></p></main><script src="app.js"></script></body></html>\n'},
      {path:'styles.css',content:'*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#07111f;color:#eaf7ff}main{max-width:760px;margin:10vh auto;padding:32px;border:1px solid #2a607d;border-radius:18px;background:#0b1c2e}h1{margin-top:0}button{padding:12px 18px;border:0;border-radius:10px;cursor:pointer}#status{opacity:.8}\n'},
      {path:'app.js',content:"document.getElementById('jarvisAction').addEventListener('click',()=>{document.getElementById('status').textContent='JARVIS proje başlangıcı çalışıyor.'})\n"},
      {path:'README.md',content:'# '+title+'\n\n'+summary+'\n\n## Çalıştırma\n\nindex.html dosyasını tarayıcıda açın.\n'}
    ];
  }
  let total=0;
  const seen=new Set();
  files=files.map((x,i)=>{
    const rel=String(x.path||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
    if(!rel||rel.includes('..')||path.isAbsolute(rel))throw new Error('Geçersiz proje dosya yolu: '+rel);
    if(isSensitiveWorkspacePath(projectName+'/'+rel))throw new Error('Hassas proje dosya yolu engellendi: '+rel);
    const ext=path.extname(rel).toLowerCase();
    if(!allowedExt.has(ext))throw new Error('Bu proje dosya türüne izin verilmiyor: '+ext);
    const key=rel.toLowerCase();
    if(seen.has(key))throw new Error('Tekrarlanan proje dosyası: '+rel);
    seen.add(key);
    const content=String(x.content||'');
    const bytes=Buffer.byteLength(content,'utf8');
    if(bytes>60000)throw new Error('Proje dosyası 60KB sınırını aşıyor: '+rel);
    total+=bytes;
    return{path:rel,content,sha256:crypto.createHash('sha256').update(content,'utf8').digest('hex'),index:i};
  });
  if(total>240000)throw new Error('Proje toplam içerik sınırı 240KB.');
  return files;
}
function createDeveloperProjectMission(args={}){
  const projectName=developerProjectSlug(args.projectName||args.name);
  const files=normalizeDeveloperFiles(args,projectName);
  if(!files.length)throw new Error('En az bir proje dosyası gerekli.');
  const summary=String(args.summary||'').replace(/[\r\n]+/g,' ').trim().slice(0,1200);
  const steps=[{name:'dev_prepare'}];
  files.forEach((file,i)=>steps.push({name:'dev_file_'+String(i+1).padStart(2,'0'),meta:{fileIndex:i}}));
  steps.push({name:'dev_verify'});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'developer_project',
    label:projectName,
    input:{projectName,summary,files},
    steps
  });
}
function developerMissionTarget(input,file){
  const projectName=developerProjectSlug(input&&input.projectName||'project');
  const rel=String(file&&file.path||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
  if(!rel||rel.includes('..')||isSensitiveWorkspacePath(projectName+'/'+rel))throw new Error('Geçersiz geliştirici dosya yolu.');
  const root=safeFile(projectName);
  const target=path.resolve(root,rel);
  if(!(target===root||target.startsWith(root+path.sep)))throw new Error('Proje kökü dışına yazma engellendi.');
  return{root,target,relative:path.relative(WORKSPACE,target)};
}
function createDeveloperPatchMission(args={}){
  const projectName=developerProjectSlug(args.projectName||args.name);
  const raw=Array.isArray(args.patches)?args.patches.slice(0,12):[];
  if(!raw.length)throw new Error('En az bir mevcut proje dosyası patch için gerekli.');
  const root=safeFile(projectName);
  if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw new Error('Patch uygulanacak mevcut proje klasörü bulunamadı: '+projectName);
  const normalized=normalizeDeveloperFiles({files:raw},projectName);
  const patches=normalized.map(file=>{
    const loc=developerMissionTarget({projectName},file);
    if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile())throw new Error('Patch yalnızca mevcut dosyalara uygulanır: '+file.path);
    return{...file,expectedSha256:fileHash(loc.target)};
  });
  const summary=String(args.summary||'').replace(/[\r\n]+/g,' ').trim().slice(0,1200);
  const steps=[{name:'dev_patch_prepare'}];
  patches.forEach((file,i)=>steps.push({name:'dev_patch_file_'+String(i+1).padStart(2,'0'),meta:{fileIndex:i}}));
  steps.push({name:'dev_patch_verify'});
  return getMissionEngine().createMission(WORKSPACE,{
    type:'developer_patch',
    label:projectName,
    input:{projectName,summary,patches},
    steps
  });
}
function developerPatchBackupLocation(missionId,input,file){
  const missionKey=String(missionId||'').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100);
  if(!missionKey)throw new Error('Patch mission id gerekli.');
  const rel=String(file&&file.path||'').replace(/\\/g,'/').replace(/^\/+/, '').trim();
  const root=path.resolve(MEMORY_DIR,'developer-patches',missionKey);
  const target=path.resolve(root,rel+'.bak');
  if(!(target===root||target.startsWith(root+path.sep)))throw new Error('Patch backup yolu güvenli değil.');
  return{root,target,relative:path.relative(WORKSPACE,target)};
}
function validateDeveloperPatchedFile(target){
  const ext=path.extname(target).toLowerCase();
  if(ext==='.json'){
    JSON.parse(fs.readFileSync(target,'utf8'));
    return{ok:true,validator:'json-parse'};
  }
  if(new Set(['.js','.cjs','.mjs']).has(ext)){
    childProcess.execFileSync(process.execPath,['--check',target],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:512*1024});
    return{ok:true,validator:'node-check'};
  }
  return{ok:true,validator:'hash'};
}
function rollbackDeveloperPatchMission(mission){
  const actions=[];
  if(!mission||mission.type!=='developer_patch')return{ok:true,actions};
  const input=mission.input||{};
  const patches=Array.isArray(input.patches)?input.patches:[];
  for(const patch of patches){
    try{
      const loc=developerMissionTarget(input,patch);
      const backup=developerPatchBackupLocation(mission.id,input,patch);
      const baseline=String(patch.expectedSha256||'');
      const desired=String(patch.sha256||'');
      if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile()){
        if(fs.existsSync(backup.target)){
          fs.mkdirSync(path.dirname(loc.target),{recursive:true});
          fs.copyFileSync(backup.target,loc.target);
          const restored=fileHash(loc.target);
          actions.push({file:loc.relative,restored:restored===baseline,reason:'target_missing'});
        }else actions.push({file:loc.relative,restored:false,reason:'backup_missing'});
        continue;
      }
      const current=fileHash(loc.target);
      if(current===baseline){
        actions.push({file:loc.relative,restored:true,reused:true});
        continue;
      }
      if(current!==desired){
        actions.push({file:loc.relative,restored:false,reason:'external_conflict'});
        continue;
      }
      if(!fs.existsSync(backup.target)||!fs.statSync(backup.target).isFile()){
        actions.push({file:loc.relative,restored:false,reason:'backup_missing'});
        continue;
      }
      fs.copyFileSync(backup.target,loc.target);
      const restored=fileHash(loc.target);
      actions.push({file:loc.relative,restored:restored===baseline});
    }catch(e){
      actions.push({file:String(patch&&patch.path||''),restored:false,reason:String(e.message||e).slice(0,220)});
    }
  }
  return{ok:actions.every(x=>x.restored===true),actions};
}

function creatorBatchActiveChild(mission){
  if(!mission||mission.type!=='creator_batch')return null;
  const step=getMissionEngine().currentStep(mission);
  if(!step||!/^creator_batch_render_\d+$/.test(String(step.name||'')))return null;
  const index=Math.max(0,Number(step.meta&&step.meta.itemIndex)||0);
  return findCreatorBatchChild(mission.id,index);
}
function cascadeCreatorBatchControl(mission,action){
  const child=creatorBatchActiveChild(mission);
  if(!child||['completed','failed','cancelled'].includes(String(child.status||'')))return child;
  const op=String(action||'');
  if(op==='resume'){
    if(child.status==='paused'){
      try{return requestMissionControl({missionId:child.id,action:'resume'})}catch(_){return child}
    }
    return child;
  }
  if(!['pause','cancel'].includes(op))return child;
  try{return requestMissionControl({missionId:child.id,action:op})}catch(_){return child}
}

function missionControlCandidates(action){
  const engine=getMissionEngine();
  const rows=engine.listMissions(WORKSPACE,{limit:50});
  if(action==='resume')return rows.filter(x=>String(x.status||'')==='paused');
  if(action==='pause')return rows.filter(x=>new Set(['queued','running','waiting_dependency','needs_verification']).has(String(x.status||'')));
  if(action==='cancel')return rows.filter(x=>new Set(['queued','running','waiting_dependency','needs_verification','paused']).has(String(x.status||'')));
  return[];
}
function applyPendingMissionControl(mission){
  if(!mission||!mission.id)return mission;
  const action=String(mission.control&&mission.control.requested||'');
  if(!['pause','cancel'].includes(action))return mission;
  if(['completed','failed','cancelled'].includes(String(mission.status||'')))return mission;
  const engine=getMissionEngine();
  const at=new Date().toISOString();
  if(action==='pause'){
    const currentStatus=String(mission.status||'queued');
    const resumeStatus=['waiting_dependency','needs_verification'].includes(currentStatus)?currentStatus:'queued';
    mission.status='paused';
    mission.control={...(mission.control||{}),requested:null,state:'paused',appliedAt:at,resumeStatus};
    if(Array.isArray(mission.history)){
      mission.history.push({at,event:'mission_paused',resumeStatus});
      if(mission.history.length>200)mission.history=mission.history.slice(-200);
    }
  }else{
    mission.status='cancelled';
    mission.completedAt=mission.completedAt||at;
    mission.control={...(mission.control||{}),requested:null,state:'cancelled',appliedAt:at};
    if(Array.isArray(mission.history)){
      mission.history.push({at,event:'mission_cancelled'});
      if(mission.history.length>200)mission.history=mission.history.slice(-200);
    }
  }
  return engine.saveMission(WORKSPACE,mission);
}
function requestMissionControl({missionId='',action=''}={}){
  const engine=getMissionEngine();
  const op=String(action||'').trim().toLowerCase();
  if(!['pause','resume','cancel'].includes(op))throw new Error('Geçersiz mission control action.');
  let mission=null;
  const id=String(missionId||'').trim();
  if(id){
    mission=engine.loadMission(WORKSPACE,id);
    if(!mission)throw new Error('Mission bulunamadı: '+id);
  }else{
    const candidates=missionControlCandidates(op);
    if(!candidates.length)throw new Error('Bu işlem için uygun kalıcı görev yok.');
    if(candidates.length>1)throw new Error('Birden fazla uygun görev var; missionId ile hangisini kontrol edeceğini belirt.');
    mission=candidates[0];
  }
  const status=String(mission.status||'');
  if(op==='resume'){
    if(status!=='paused')throw new Error('Yalnızca paused görev devam ettirilebilir.');
    const resumeStatus=['waiting_dependency','needs_verification'].includes(String(mission.control&&mission.control.resumeStatus||''))
      ?String(mission.control.resumeStatus)
      :'queued';
    mission.status=resumeStatus;
    mission.control={...(mission.control||{}),requested:null,state:'resumed',resumedAt:new Date().toISOString(),resumeStatus:null};
    if(Array.isArray(mission.history)){
      mission.history.push({at:new Date().toISOString(),event:'mission_resumed',status:resumeStatus});
      if(mission.history.length>200)mission.history=mission.history.slice(-200);
    }
    mission=engine.saveMission(WORKSPACE,mission);
    cascadeCreatorBatchControl(mission,'resume');
    return mission;
  }
  if(['completed','failed','cancelled'].includes(status))throw new Error('Tamamlanmış/sonlanmış görev kontrol edilemez.');
  if(op==='cancel'&&status==='paused'){
    mission.control={...(mission.control||{}),requested:'cancel',requestedAt:new Date().toISOString()};
    mission=engine.saveMission(WORKSPACE,mission);
    cascadeCreatorBatchControl(mission,'cancel');
    return applyPendingMissionControl(mission);
  }
  mission.control={...(mission.control||{}),requested:op,requestedAt:new Date().toISOString()};
  if(Array.isArray(mission.history)){
    mission.history.push({at:new Date().toISOString(),event:'mission_control_requested',action:op});
    if(mission.history.length>200)mission.history=mission.history.slice(-200);
  }
  mission=engine.saveMission(WORKSPACE,mission);
  cascadeCreatorBatchControl(mission,op);
  if(status!=='running')return applyPendingMissionControl(mission);
  return mission;
}

function approveMissionGate({missionId=''}={}){
  const engine=getMissionEngine();
  let mission=null;
  const id=String(missionId||'').trim();
  if(id){
    mission=engine.loadMission(WORKSPACE,id);
    if(!mission)throw new Error('Onaylanacak görev bulunamadı: '+id);
  }else{
    const pending=engine.listMissions(WORKSPACE,{limit:50}).filter(row=>{
      if(row.status!=='waiting_dependency')return false;
      const step=engine.currentStep(row);
      return !!(step&&step.error&&step.error.dependency==='approval');
    });
    if(!pending.length)throw new Error('Açık onay bekleyen görev yok.');
    if(pending.length>1)throw new Error('Birden fazla görev onay bekliyor; missionId ile hangisinin onaylandığını belirt.');
    mission=pending[0];
  }
  const step=engine.currentStep(mission);
  if(!step||mission.status!=='waiting_dependency'||!step.error||step.error.dependency!=='approval'){
    throw new Error('Bu görev şu anda açık kullanıcı onayı beklemiyor.');
  }
  step.meta={...(step.meta||{}),approvedAt:new Date().toISOString(),approvalKind:'explicit_user'};
  step.status='pending';
  step.error=null;
  mission.status='queued';
  if(Array.isArray(mission.history)){
    mission.history.push({at:new Date().toISOString(),event:'step_explicitly_approved',step:step.name});
    if(mission.history.length>200)mission.history=mission.history.slice(-200);
  }
  return engine.saveMission(WORKSPACE,mission);
}
function missionSummaryText(m){
  if(!m)return'Kayıtlı görev bulunamadı.';
  const x=getMissionEngine().summarizeMission(m),step=x&&x.step;
  return[
    'MISSION '+x.id,
    'durum '+x.status,
    step?('adım '+step.name+' / '+step.status+' / deneme '+step.attempts):'adım yok',
    x.artifacts&&x.artifacts.length?('çıktılar '+x.artifacts.join(', ')):'çıktı henüz yok'
  ].join(' · ');
}
async function verifyUncertainCampaignStep(mission){
  const engine=getMissionEngine();
  const step=engine.currentStep(mission);
  if(!step||step.status!=='uncertain')return mission;
  const input=mission.input||{};

  if(/^creator_batch_render_\d+$/.test(step.name)){
    const index=Math.max(0,Number(step.meta&&step.meta.itemIndex)||0);
    const child=findCreatorBatchChild(mission.id,index);
    if(!child){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'No batch render child mission exists; safe to create child'});
    }
    if(child.status==='completed'){
      const item=Array.isArray(input.items)?input.items[index]:null;
      if(!item||!creatorBatchAssetsMatch(item.creatorAssets,child.input&&child.input.creatorAssets))return mission;
      const rendered=child.artifacts&&child.artifacts.render_short;
      const metaFile=rendered&&rendered.metadata;
      if(!metaFile||!fs.existsSync(metaFile))return mission;
      try{
        const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
        if(String(meta&&meta.missionId||'')!==String(child.id))return mission;
        const expectedHashes=(Array.isArray(item.creatorAssets)?item.creatorAssets:[]).map(x=>String(x&&x.sha256||''));
        const actualHashes=Array.isArray(meta&&meta.sourceAssetHashes)?meta.sourceAssetHashes.map(x=>String(x||'')):[];
        if(expectedHashes.length&&JSON.stringify(expectedHashes)!==JSON.stringify(actualHashes))return mission;
      }catch(_){return mission}
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{childMissionId:child.id,status:'completed',itemIndex:index,recovered:true,artifacts:child.artifacts||{}},
        note:'Batch render child + storyboard + mission-bound metadata verified completed'
      });
    }
    if(['failed','cancelled'].includes(String(child.status||''))){
      return engine.failStep(WORKSPACE,mission.id,{
        code:'BATCH_CHILD_'+String(child.status||'failed').toUpperCase(),
        message:'Creator batch render child tamamlanamadı: '+child.id,
        retryable:false
      });
    }
    return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Existing batch render child is preserved for scheduler resume'});
  }
  if(/^creator_batch_youtube_\d+$/.test(step.name)){
    const index=Math.max(0,Number(step.meta&&step.meta.itemIndex)||0);
    const receiptId=creatorBatchReceiptId(mission.id,index);
    const receipt=getYoutubeStudio().readReceipt(WORKSPACE,receiptId);
    if(receipt&&receipt.state==='draft_prepared'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{itemIndex:index,receipt:getYoutubeStudio().missionReceiptFile(WORKSPACE,receiptId),file:receipt.file,recovered:true,published:false},
        note:'Batch YouTube DRAFT receipt verified'
      });
    }
    if(!receipt){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'No batch YouTube receipt; safe retry'});
    }
    return mission;
  }

  if(/^creator_asset_\d+$/.test(step.name)){
    const operations=Array.isArray(input.operations)?input.operations:[];
    const index=Math.max(0,Number(step.meta&&step.meta.operationIndex)||0);
    const op=operations[index];
    if(!op)return mission;
    const check=getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op);
    if(check.decision==='completed'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{source:op.source,destination:op.destination,sha256:op.expectedSha256,bytes:Number(op.bytes||0),recovered:true},
        note:'Creator asset copy verified by SHA-256 after interruption'
      });
    }
    if(check.decision==='retry'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Creator asset copy did not start; source hash still matches baseline'});
    }
    return mission;
  }

  if(/^workspace_file_\d+$/.test(step.name)){
    const operations=Array.isArray(input.operations)?input.operations:[];
    const index=Math.max(0,Number(step.meta&&step.meta.operationIndex)||0);
    const op=operations[index];
    if(!op)return mission;
    const check=getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op);
    if(check.decision==='completed'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{operation:op.operation,source:op.source,destination:op.destination,sha256:op.expectedSha256,bytes:Number(op.bytes||0),recovered:true},
        note:'Workspace file operation verified by source/destination hashes'
      });
    }
    if(check.decision==='retry'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Workspace file operation did not start; baseline still safe to retry'});
    }
    return mission;
  }

  if(/^pc_action_\d+$/.test(step.name)){
    const actions=Array.isArray(input.actions)?input.actions:[];
    const index=Math.max(0,Number(step.meta&&step.meta.actionIndex)||0);
    const action=actions[index];
    if(action&&action.kind==='status'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Read-only PC status action is safe to retry'});
    }
    return mission;
  }

  if(step.name==='browser_prepare'||step.name==='browser_verify'){
    return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Browser preparation/verification is safe to retry'});
  }
  if(step.name==='browser_click'){
    return mission;
  }

  if(step.name==='dev_patch_prepare'||step.name==='dev_patch_verify'){
    return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Developer patch prepare/verify is safe to retry'});
  }
  if(/^dev_patch_file_\d+$/.test(step.name)){
    const patches=Array.isArray(input.patches)?input.patches:[];
    const index=Math.max(0,Number(step.meta&&step.meta.fileIndex)||0);
    const patch=patches[index];
    if(!patch)return mission;
    const loc=developerMissionTarget(input,patch);
    if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile())return mission;
    const current=fileHash(loc.target);
    const desired=String(patch.sha256||'');
    const baseline=String(patch.expectedSha256||'');
    if(current===desired){
      const backup=developerPatchBackupLocation(mission.id,input,patch);
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{file:loc.relative,beforeSha256:baseline,afterSha256:desired,backup:backup.relative,changed:true,recovered:true},
        note:'Patched file hash verified after interruption'
      });
    }
    if(current===baseline){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Patch write did not persist; safe retry'});
    }
    return mission;
  }

  if(step.name==='render_longform'){
    const creator=getCreatorEngine();
    const status=creator.ffmpegStatus(WORKSPACE);
    const base=creator.safeName(input.campaignName);
    const expected=path.join(status.outputDir,base+'.mp4');
    const metaFile=path.join(WORKSPACE,'creator-jobs',base,'job.json');
    if(fs.existsSync(expected)&&fs.statSync(expected).size>=1024*1024&&fs.existsSync(metaFile)){
      try{
        const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
        if(String(meta&&meta.missionId||'')===String(mission.id)&&String(meta&&meta.mode||'')==='longform'){
          const quality=creator.applyRenderedAudioQuality(creator.probeRenderedLongform(expected,status.ffprobe),expected,status.ffmpeg,{mode:'longform'});
          creator.applyRenderedVisualQuality(quality,expected,status.ffmpeg,{mode:'longform'});
          if(quality.ok){
            try{creatorMarkWebAssetsUsed(meta&&meta.sourceAssets,{missionId:mission.id,type:String(mission.type||'creator_longform_recovery')})}catch(_){}
            return engine.resolveUncertainStep(WORKSPACE,mission.id,{
              completed:true,
              artifact:{output:expected,metadata:metaFile,quality,thumbnail:meta&&meta.thumbnail||null,recovered:true},
              note:'long-form output + mission-bound metadata + quality gate verified on disk'
            });
          }
          return mission;
        }
      }catch(_){}
      return mission;
    }
    if(!fs.existsSync(expected)&&!fs.existsSync(metaFile)){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'long-form render output absent; safe retry'});
    }
    return mission;
  }

  if(step.name==='render_short'){
    const creator=getCreatorEngine();
    const status=creator.ffmpegStatus(WORKSPACE);
    const base=creator.safeName(input.campaignName);
    const expected=path.join(status.outputDir,base+'.mp4');
    const metaFile=path.join(WORKSPACE,'creator-jobs',base,'job.json');
    if(fs.existsSync(expected)&&fs.statSync(expected).size>=10000&&fs.existsSync(metaFile)){
      try{
        const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
        if(String(meta&&meta.missionId||'')===String(mission.id)){
          const quality=creator.applyRenderedAudioQuality(creator.probeRenderedShort(expected,status.ffprobe),expected,status.ffmpeg,{mode:'short'});
          creator.applyRenderedVisualQuality(quality,expected,status.ffmpeg,{mode:'short'});
          if(quality.ok){
            try{creatorMarkWebAssetsUsed(meta&&meta.sourceAssets,{missionId:mission.id,type:String(mission.type||'creator_short_recovery')})}catch(_){}
            return engine.resolveUncertainStep(WORKSPACE,mission.id,{
              completed:true,
              artifact:{output:expected,metadata:metaFile,quality,thumbnail:meta&&meta.thumbnail||null,recovered:true},
              note:'render output + mission-bound metadata + Creator quality gate verified on disk'
            });
          }
          return mission;
        }
      }catch(_){}
      return mission;
    }
    if(!fs.existsSync(expected)&&!fs.existsSync(metaFile)){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'render output absent; safe retry'});
    }
    return mission;
  }

  if(step.name==='shopify_draft'){
    try{
      const found=await getCommerceEngine().findProductByMission(WORKSPACE,mission.id);
      if(found&&found.product){
        return engine.resolveUncertainStep(WORKSPACE,mission.id,{
          completed:true,
          artifact:{product:found.product,recovered:true},
          note:'Shopify mission tag verified'
        });
      }
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Shopify mission tag absent; safe retry'});
    }catch(e){
      if(String(e.message||e)==='SHOPIFY_NOT_CONNECTED')return mission;
      throw e;
    }
  }

  if(step.name==='youtube_draft'){
    const receipt=getYoutubeStudio().readReceipt(WORKSPACE,mission.id);
    if(receipt&&receipt.state==='draft_prepared'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{receipt:getYoutubeStudio().missionReceiptFile(WORKSPACE,mission.id),file:receipt.file,recovered:true},
        note:'YouTube mission receipt verified'
      });
    }
    if(!receipt){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'No upload receipt; safe retry'});
    }
    return mission;
  }
  if(step.name==='youtube_publish'){
    const receipt=getYoutubeStudio().readReceipt(WORKSPACE,mission.id);
    if(receipt&&receipt.state==='published'&&receipt.published===true){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{
        completed:true,
        artifact:{receipt:getYoutubeStudio().missionReceiptFile(WORKSPACE,mission.id),published:true,recovered:true},
        note:'YouTube PUBLIC receipt verified'
      });
    }
    if(receipt&&receipt.state==='draft_prepared'){
      return engine.resolveUncertainStep(WORKSPACE,mission.id,{completed:false,note:'Publish click did not start; safe retry with existing approval'});
    }
    return mission;
  }
  return mission;
}
async function runDurableMission(id){
  const engine=getMissionEngine();
  let mission=engine.loadMission(WORKSPACE,id);
  if(!mission)throw new Error('Mission not found: '+id);

  for(let guard=0;guard<Math.max(4,mission.steps.length+2);guard++){
    mission=engine.loadMission(WORKSPACE,id);
    if(!mission)throw new Error('Mission disappeared: '+id);
    mission=applyPendingMissionControl(mission);
    if(['completed','failed','cancelled','paused'].includes(String(mission.status||'')))return mission;

    if(mission.status==='waiting_dependency'){
      const blocked=engine.currentStep(mission);
      if(blocked&&blocked.error&&blocked.error.dependency==='approval')return mission;
      mission=engine.retryBlockedStep(WORKSPACE,id);
    }
    if(mission.status==='needs_verification'){
      mission=await verifyUncertainCampaignStep(mission);
      if(mission.status==='needs_verification')return mission;
    }

    mission=engine.startStep(WORKSPACE,id);
    if(mission.status==='needs_verification')return mission;
    if(mission.status==='completed')return mission;
    const step=engine.currentStep(mission);
    if(!step)throw new Error('Mission current step missing');

    try{
      if(/^creator_batch_render_\d+$/.test(step.name)){
        const index=Math.max(0,Number(step.meta&&step.meta.itemIndex)||0);
        let child;
        try{child=ensureCreatorBatchChild(mission,index)}
        catch(e){
          const code=String(e&&e.code||e&&e.message||'CREATOR_BATCH_CHILD_CREATE_FAILED');
          if(code==='FFPROBE_MISSING'||/FFPROBE_MISSING/.test(code)){
            mission=engine.failStep(WORKSPACE,id,{code:'FFPROBE_MISSING',message:'Batch storyboard doğrulaması için FFprobe gerekli.',retryable:true,dependency:'creator_probe'});
            return mission;
          }
          mission=engine.failStep(WORKSPACE,id,{code:/CREATOR_STORYBOARD_HASH_CONFLICT/.test(code)?'CREATOR_STORYBOARD_HASH_CONFLICT':'CREATOR_BATCH_CHILD_CREATE_FAILED',message:String(e.message||e).slice(0,900),retryable:false});
          return mission;
        }
        if(child.status==='completed'){
          mission=engine.completeStep(WORKSPACE,id,{artifact:{
            childMissionId:child.id,
            itemIndex:index,
            status:'completed',
            artifacts:child.artifacts||{}
          }});
          return mission;
        }
        if(['failed','cancelled'].includes(String(child.status||''))){
          mission=engine.failStep(WORKSPACE,id,{
            code:'BATCH_CHILD_'+String(child.status||'failed').toUpperCase(),
            message:'Creator batch render child tamamlanamadı: '+child.id,
            retryable:false
          });
          return mission;
        }
        mission=engine.failStep(WORKSPACE,id,{
          code:'BATCH_CHILD_WAITING',
          message:'Creator batch render child scheduler tarafından tamamlanmayı bekliyor: '+child.id,
          retryable:true,
          dependency:'mission:'+child.id
        });
        return mission;
      }

      if(/^creator_batch_youtube_\d+$/.test(step.name)){
        const input=mission.input||{};
        const items=Array.isArray(input.items)?input.items:[];
        const index=Math.max(0,Number(step.meta&&step.meta.itemIndex)||0);
        const item=items[index];
        const child=findCreatorBatchChild(id,index);
        if(!item||!child||child.status!=='completed'){
          mission=engine.failStep(WORKSPACE,id,{code:'BATCH_RENDER_NOT_READY',message:'Batch YouTube DRAFT için tamamlanmış render child bulunamadı.',retryable:false});
          return mission;
        }
        if(!creatorBatchAssetsMatch(item.creatorAssets,child.input&&child.input.creatorAssets)){
          mission=engine.failStep(WORKSPACE,id,{code:'BATCH_CHILD_STORYBOARD_MISMATCH',message:'Batch child storyboard parent kaydıyla eşleşmiyor.',retryable:false});
          return mission;
        }
        const rendered=child.artifacts&&child.artifacts.render_short;
        const file=rendered&&rendered.output;
        const metaFile=rendered&&rendered.metadata;
        if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()||fs.statSync(file).size<10000||!metaFile||!fs.existsSync(metaFile)){
          mission=engine.failStep(WORKSPACE,id,{code:'VIDEO_ARTIFACT_MISSING',message:'Batch YouTube DRAFT için render çıktısı/metadata doğrulanamadı.',retryable:false});
          return mission;
        }
        try{
          const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
          if(String(meta&&meta.missionId||'')!==String(child.id))throw new Error('mission mismatch');
          const expectedHashes=(Array.isArray(item.creatorAssets)?item.creatorAssets:[]).map(x=>String(x&&x.sha256||''));
          const actualHashes=Array.isArray(meta&&meta.sourceAssetHashes)?meta.sourceAssetHashes.map(x=>String(x||'')):[];
          if(expectedHashes.length&&JSON.stringify(expectedHashes)!==JSON.stringify(actualHashes))throw new Error('asset hash mismatch');
        }catch(e){
          mission=engine.failStep(WORKSPACE,id,{code:'BATCH_RENDER_BINDING_MISMATCH',message:'Batch YouTube DRAFT için render mission/storyboard binding doğrulanamadı.',retryable:false});
          return mission;
        }
        const receiptId=creatorBatchReceiptId(id,index);
        const out=await getYoutubeStudio().prepareDraft(getBrowserOperator(),WORKSPACE,{
          file,
          title:String(item.youtubeTitle||item.campaignName||'').trim(),
          description:creatorYoutubeDescription(item.youtubeDescription,item.creatorAssets),
          thumbnail:String(rendered.thumbnail||'').trim(),
          missionId:receiptId
        });
        if(!out.ok){
          if(out.code==='YOUTUBE_AUTH_REQUIRED'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,retryable:true,dependency:'youtube_auth'});
            return mission;
          }
          if(out.code==='YOUTUBE_UPLOAD_UNCERTAIN'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,uncertain:true});
            return mission;
          }
          mission=engine.failStep(WORKSPACE,id,{code:out.code||'YOUTUBE_DRAFT_FAILED',message:out.message||'Batch YouTube taslağı hazırlanamadı.',retryable:out.retryable===true,dependency:'youtube_studio'});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          itemIndex:index,
          receipt:out.receipt,
          file:out.file,
          title:out.title,
          reused:!!out.reused,
          published:false
        }});
        return mission;
      }

      if(/^creator_asset_\d+$/.test(step.name)){
        const input=mission.input||{};
        const operations=Array.isArray(input.operations)?input.operations:[];
        const index=Math.max(0,Number(step.meta&&step.meta.operationIndex)||0);
        const op=operations[index];
        if(!op){
          mission=engine.failStep(WORKSPACE,id,{code:'CREATOR_ASSET_OP_MISSING',message:'Creator asset operation girdisi bulunamadı.',retryable:false});
          return mission;
        }
        const state=getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op);
        if(op.reused&&state.decision!=='completed'){
          mission=engine.failStep(WORKSPACE,id,{code:'CREATOR_ASSET_REUSE_CONFLICT',message:'Daha önce eşleşen Creator asset artık kaynak/hedef hashleriyle doğrulanmıyor.',retryable:false,uncertain:true});
          return mission;
        }
        const inspected=getCreatorEngine().inspectAsset(WORKSPACE,op.source);
        if(!inspected.ok){
          if(inspected.code==='FFPROBE_MISSING'){
            mission=engine.failStep(WORKSPACE,id,{code:'FFPROBE_MISSING',message:'Creator asset doğrulaması için FFprobe gerekli.',retryable:true,dependency:'creator_probe'});
            return mission;
          }
          mission=engine.failStep(WORKSPACE,id,{code:String(inspected.code||'CREATOR_ASSET_INVALID'),message:'Creator asset video doğrulaması başarısız: '+String(op.source),retryable:false});
          return mission;
        }
        if(op.reused){
          mission=engine.completeStep(WORKSPACE,id,{artifact:{
            source:op.source,destination:op.destination,sha256:op.expectedSha256,bytes:Number(op.bytes||0),
            duration:inspected.duration,width:inspected.width,height:inspected.height,codec:inspected.codec,reused:true
          }});
          continue;
        }
        const copied=getWorkspaceFileEngine().applyOperation(WORKSPACE,op);
        if(!copied||copied.ok!==true){
          mission=engine.failStep(WORKSPACE,id,{
            code:String(copied&&copied.code||'CREATOR_ASSET_COPY_FAILED'),
            message:String(copied&&copied.message||'Creator asset kopyası doğrulanamadı.').slice(0,900),
            retryable:false,
            uncertain:!!(copied&&copied.uncertain)
          });
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          source:op.source,destination:op.destination,sha256:op.expectedSha256,bytes:Number(op.bytes||0),
          duration:inspected.duration,width:inspected.width,height:inspected.height,codec:inspected.codec,reused:false
        }});
        continue;
      }

      if(/^workspace_file_\d+$/.test(step.name)){
        const input=mission.input||{};
        const operations=Array.isArray(input.operations)?input.operations:[];
        const index=Math.max(0,Number(step.meta&&step.meta.operationIndex)||0);
        const op=operations[index];
        if(!op){
          mission=engine.failStep(WORKSPACE,id,{code:'WORKSPACE_FILE_OP_MISSING',message:'Workspace dosya operation girdisi bulunamadı.',retryable:false});
          return mission;
        }
        const out=getWorkspaceFileEngine().applyOperation(WORKSPACE,op);
        if(!out||out.ok!==true){
          mission=engine.failStep(WORKSPACE,id,{
            code:String(out&&out.code||'WORKSPACE_FILE_OP_FAILED'),
            message:String(out&&out.message||'Workspace dosya işlemi doğrulanamadı.').slice(0,900),
            retryable:false,
            uncertain:!!(out&&out.uncertain)
          });
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          operation:out.operation,
          source:out.source,
          destination:out.destination,
          sha256:out.sha256,
          bytes:Number(out.bytes||0)
        }});
        continue;
      }

      if(/^pc_action_\d+$/.test(step.name)){
        const input=mission.input||{};
        const actions=Array.isArray(input.actions)?input.actions:[];
        const index=Math.max(0,Number(step.meta&&step.meta.actionIndex)||0);
        const action=actions[index];
        if(!action){
          mission=engine.failStep(WORKSPACE,id,{code:'PC_ACTION_MISSING',message:'PC action girdisi bulunamadı.',retryable:false});
          return mission;
        }
        const command=pcMissionCommand(action);
        if(!command||!isLocalSafeControlCommand(command)){
          mission=engine.failStep(WORKSPACE,id,{code:'PC_ACTION_NOT_SAFE',message:'PC action güvenli katalog dışına çıktı.',retryable:false});
          return mission;
        }
        const out=await execute({command});
        if(!out||out.ok!==true){
          mission=engine.failStep(WORKSPACE,id,{code:'PC_ACTION_FAILED',message:String(out&&out.message||'PC action başarısız').slice(0,800),retryable:out&&out.retryable===true,dependency:out&&out.retryable===true?'pc_runtime':null});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          kind:String(action.kind||''),
          target:action.target||null,
          action:action.action||null,
          command,
          message:String(out.message||'').slice(0,900)
        }});
        continue;
      }

      if(step.name==='browser_prepare'){
        const input=mission.input||{};
        const browser=getBrowserOperator();
        await browser.navigate(WORKSPACE,String(input.url||''));
        const fields=Array.isArray(input.fields)?input.fields:[];
        const prepared=[];
        for(const field of fields){
          const result=await browser.setField(WORKSPACE,String(field.label||''),String(field.value??''));
          if(!result||result.ok!==true){
            mission=engine.failStep(WORKSPACE,id,{code:'BROWSER_FIELD_NOT_FOUND',message:'Browser form alanı bulunamadı: '+String(field.label||''),retryable:false});
            return mission;
          }
          prepared.push(String(field.label||'').slice(0,180));
        }
        const snap=await browser.pageSnapshot(WORKSPACE);
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          url:String(snap&&snap.url||input.url||'').slice(0,1200),
          title:String(snap&&snap.title||'').slice(0,300),
          preparedFields:prepared,
          finalClickQueued:!!String(input.finalClick||'')
        }});
        continue;
      }

      if(step.name==='browser_click'){
        if(!(step.meta&&step.meta.approvedAt)){
          mission=engine.failStep(WORKSPACE,id,{
            code:'EXPLICIT_APPROVAL_REQUIRED',
            message:'Browser görevinin son tıklaması için açık kullanıcı onayı gerekli.',
            retryable:true,
            dependency:'approval'
          });
          return mission;
        }
        const input=mission.input||{};
        const clickText=String(input.finalClick||'').trim();
        if(!clickText||browserMissionHardDeniedClick(clickText)){
          mission=engine.failStep(WORKSPACE,id,{code:'BROWSER_CLICK_BLOCKED',message:'Yüksek riskli veya boş browser tıklaması engellendi.',retryable:false});
          return mission;
        }
        const browser=getBrowserOperator();
        await browser.navigate(WORKSPACE,String(input.url||''));
        for(const field of Array.isArray(input.fields)?input.fields:[]){
          const result=await browser.setField(WORKSPACE,String(field.label||''),String(field.value??''));
          if(!result||result.ok!==true){
            mission=engine.failStep(WORKSPACE,id,{code:'BROWSER_FIELD_NOT_FOUND',message:'Onaylı tıklama öncesi form alanı yeniden hazırlanamadı: '+String(field.label||''),retryable:false});
            return mission;
          }
        }
        const clicked=await browser.clickByText(WORKSPACE,clickText);
        if(!clicked||clicked.ok!==true){
          mission=engine.failStep(WORKSPACE,id,{code:'BROWSER_CLICK_TARGET_NOT_FOUND',message:'Onaylanan browser tıklama hedefi bulunamadı: '+clickText,retryable:false});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          clicked:true,
          text:String(clicked.text||clickText).slice(0,220),
          approvedAt:String(step.meta.approvedAt)
        }});
        continue;
      }

      if(step.name==='browser_verify'){
        const snap=await getBrowserOperator().pageSnapshot(WORKSPACE);
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          url:String(snap&&snap.url||'').slice(0,1200),
          title:String(snap&&snap.title||'').slice(0,300),
          verified:true
        }});
        continue;
      }

      if(step.name==='render_longform'){
        const input=mission.input||{};
        const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
        if(!ready.ok||!ready.ffprobe){
          mission=engine.failStep(WORKSPACE,id,{
            code:!ready.ok?'FFMPEG_NOT_READY':'FFPROBE_MISSING',
            message:'Long-form Creator için FFmpeg + FFprobe hazır olmalı.',
            retryable:true,
            dependency:!ready.ok?'ffmpeg':'creator_probe'
          });
          return mission;
        }
        const selected=Array.isArray(input.creatorAssets)?input.creatorAssets:[];
        for(const asset of selected){
          const rel=String(asset&&asset.path||'');
          const current=getWorkspaceFileEngine().hashFile(safeFile(rel));
          if(!current||current!==String(asset&&asset.sha256||'')){
            mission=engine.failStep(WORKSPACE,id,{code:'CREATOR_LONGFORM_ASSET_HASH_CONFLICT',message:'Seçili long-form Creator asset hash değişti: '+rel,retryable:false});
            return mission;
          }
          const inspected=getCreatorEngine().inspectAsset(WORKSPACE,rel);
          if(!inspected.ok){
            if(inspected.code==='FFPROBE_MISSING'){
              mission=engine.failStep(WORKSPACE,id,{code:'FFPROBE_MISSING',message:'Long-form storyboard doğrulaması için FFprobe gerekli.',retryable:true,dependency:'creator_probe'});
              return mission;
            }
            mission=engine.failStep(WORKSPACE,id,{code:String(inspected.code||'CREATOR_LONGFORM_INVALID_ASSET'),message:'Seçili long-form Creator asset geçersiz: '+rel,retryable:false});
            return mission;
          }
        }
        const voiceFit=await renderCreatorLongformVoiceFile(
          String(input.script||''),
          String(input.campaignName||'longform')+'-voice',
          String(input.creatorVoice||CREATOR_TTS_VOICE)
        );
        const out=getCreatorEngine().renderLongform({
          workspace:WORKSPACE,
          name:String(input.campaignName||'longform'),
          script:String(input.script||''),
          voicePath:voiceFit.path,
          assetFiles:selected.map(x=>x.path),
          assetHashes:selected.map(x=>x.sha256),
          assetMode:String(input.creatorAssetMode||'auto'),
          missionId:id,
          thumbnailTitle:String(input.youtube&&input.youtube.title||input.campaignName||'')
        });
        try{creatorMarkWebAssetsUsed(out.assets.map(x=>path.relative(WORKSPACE,x).replace(/\\/g,'/')),{missionId:id,type:String(mission.type||'creator_longform')})}catch(_){}
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          output:out.output,
          subtitle:out.subtitle,
          metadata:out.metadata,
          duration:out.duration,
          quality:out.quality,
          thumbnail:out.thumbnail||null,
          thumbnailTitleBurned:!!out.thumbnailTitleBurned,
          assets:out.assets.map(x=>path.relative(WORKSPACE,x).replace(/\\/g,'/')),
          assetSelection:String(out.assetSelection||'automatic'),
          creatorVoice:String(input.creatorVoice||CREATOR_TTS_VOICE),
          voiceDuration:voiceFit.duration,
          voiceRate:voiceFit.rate,
          voiceFitAttempts:voiceFit.attempts
        }});
        continue;
      }

      if(step.name==='render_short'){
        const input=mission.input||{};
        const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
        if(!ready.ok){
          mission=engine.failStep(WORKSPACE,id,{code:'FFMPEG_NOT_READY',message:'Creator motoru hazır değil.',retryable:true,dependency:'ffmpeg'});
          return mission;
        }
        const selected=Array.isArray(input.creatorAssets)?input.creatorAssets:[];
        for(const asset of selected){
          const rel=String(asset&&asset.path||'');
          const current=getWorkspaceFileEngine().hashFile(safeFile(rel));
          if(!current||current!==String(asset&&asset.sha256||'')){
            mission=engine.failStep(WORKSPACE,id,{code:'CREATOR_STORYBOARD_HASH_CONFLICT',message:'Seçili Creator asset hash değişti: '+rel,retryable:false});
            return mission;
          }
          const inspected=getCreatorEngine().inspectAsset(WORKSPACE,rel);
          if(!inspected.ok){
            if(inspected.code==='FFPROBE_MISSING'){
              mission=engine.failStep(WORKSPACE,id,{code:'FFPROBE_MISSING',message:'Seçili storyboard kliplerini doğrulamak için FFprobe gerekli.',retryable:true,dependency:'creator_probe'});
              return mission;
            }
            mission=engine.failStep(WORKSPACE,id,{code:String(inspected.code||'CREATOR_STORYBOARD_INVALID_ASSET'),message:'Seçili Creator asset geçersiz: '+rel,retryable:false});
            return mission;
          }
        }
        const voice=await renderCreatorVoiceFile(String(input.script||''),String(input.campaignName||'campaign')+'-voice');
        const out=getCreatorEngine().renderShort({
          workspace:WORKSPACE,
          name:String(input.campaignName||'campaign'),
          script:String(input.script||''),
          voicePath:voice,
          assetFiles:selected.map(x=>x.path),
          assetHashes:selected.map(x=>x.sha256),
          missionId:id,
          thumbnailTitle:String(input.youtube&&input.youtube.title||input.campaignName||'')
        });
        try{creatorMarkWebAssetsUsed(out.assets.map(x=>path.relative(WORKSPACE,x).replace(/\\/g,'/')),{missionId:id,type:String(mission.type||'creator_short')})}catch(_){}
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          output:out.output,
          subtitle:out.subtitle,
          metadata:out.metadata,
          duration:out.duration,
          quality:out.quality,
          thumbnail:out.thumbnail||null,
          thumbnailTitleBurned:!!out.thumbnailTitleBurned,
          soundDesign:out.soundDesign||null,
          assets:out.assets.map(x=>path.relative(WORKSPACE,x).replace(/\\/g,'/')),
          assetSelection:selected.length?'explicit':'automatic'
        }});
        continue;
      }

      if(step.name==='shopify_draft'){
        const product={...(mission.input&&mission.input.product||{})};
        const out=await getCommerceEngine().createDraftForMission(WORKSPACE,product,id);
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          product:out.product,
          missionTag:out.missionTag,
          reused:!!out.reused
        }});
        continue;
      }

      if(step.name==='shopify_publish'){
        if(!(step.meta&&step.meta.approvedAt)){
          mission=engine.failStep(WORKSPACE,id,{
            code:'EXPLICIT_APPROVAL_REQUIRED',
            message:'Shopify ürününü Online Store kanalında yayınlamak için açık kullanıcı onayı gerekli.',
            retryable:true,
            dependency:'approval'
          });
          return mission;
        }
        const draft=mission.artifacts&&mission.artifacts.shopify_draft;
        const product=draft&&draft.product;
        const productId=String(product&&product.id||'').trim();
        if(!productId){
          mission=engine.failStep(WORKSPACE,id,{code:'SHOPIFY_PRODUCT_ID_MISSING',message:'Yayınlanacak Shopify ürün kimliği bulunamadı.',retryable:false});
          return mission;
        }
        const out=await getCommerceEngine().publishProduct(WORKSPACE,productId);
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          product:out.product,
          publication:out.publication,
          published:true,
          approvedAt:String(step.meta.approvedAt)
        }});
        continue;
      }

      if(step.name==='youtube_draft'){
        const rendered=mission.artifacts&&(mission.artifacts.render_longform||mission.artifacts.render_short);
        const file=rendered&&rendered.output;
        if(!file){
          mission=engine.failStep(WORKSPACE,id,{code:'VIDEO_ARTIFACT_MISSING',message:'YouTube adımı için render çıktısı bulunamadı.',retryable:false});
          return mission;
        }
        const yt=mission.input&&mission.input.youtube||{};
        const out=await getYoutubeStudio().prepareDraft(getBrowserOperator(),WORKSPACE,{
          file,
          title:String(yt.title||'').trim(),
          description:creatorYoutubeDescription(yt.description,mission.input&&mission.input.creatorAssets),
          thumbnail:String(rendered.thumbnail||'').trim(),
          missionId:id
        });
        if(!out.ok){
          if(out.code==='YOUTUBE_AUTH_REQUIRED'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,retryable:true,dependency:'youtube_auth'});
            return mission;
          }
          if(out.code==='YOUTUBE_UPLOAD_UNCERTAIN'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,uncertain:true});
            return mission;
          }
          mission=engine.failStep(WORKSPACE,id,{code:out.code||'YOUTUBE_DRAFT_FAILED',message:out.message||'YouTube taslağı hazırlanamadı.',retryable:out.retryable===true,dependency:'youtube_studio'});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          receipt:out.receipt,
          file:out.file,
          title:out.title,
          reused:!!out.reused,
          published:false
        }});
        continue;
      }

      if(step.name==='youtube_publish'){
        if(!(step.meta&&step.meta.approvedAt)){
          mission=engine.failStep(WORKSPACE,id,{
            code:'EXPLICIT_APPROVAL_REQUIRED',
            message:'YouTube videosunu PUBLIC yayınlamak için taslak hazırlandıktan sonra ayrı açık kullanıcı onayı gerekli.',
            retryable:true,
            dependency:'approval'
          });
          return mission;
        }
        const out=await getYoutubeStudio().publishPreparedDraft(getBrowserOperator(),WORKSPACE,{
          missionId:id,
          approvedAt:String(step.meta.approvedAt)
        });
        if(!out.ok){
          if(out.code==='YOUTUBE_AUTH_REQUIRED'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,retryable:true,dependency:'youtube_auth'});
            return mission;
          }
          if(out.code==='YOUTUBE_PUBLISH_UNCERTAIN'){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,uncertain:true});
            return mission;
          }
          if(['YOUTUBE_PUBLISH_CONTEXT_REQUIRED','YOUTUBE_VISIBILITY_STEP_NOT_FOUND','YOUTUBE_PUBLIC_OPTION_NOT_FOUND','YOUTUBE_PUBLISH_BUTTON_NOT_FOUND'].includes(out.code)){
            mission=engine.failStep(WORKSPACE,id,{code:out.code,message:out.message,retryable:true,dependency:'youtube_publish_context'});
            return mission;
          }
          mission=engine.failStep(WORKSPACE,id,{code:out.code||'YOUTUBE_PUBLISH_FAILED',message:out.message||'YouTube PUBLIC yayın doğrulanamadı.',retryable:false});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{
          receipt:out.receipt,
          title:out.title,
          published:true,
          approvedAt:String(step.meta.approvedAt)
        }});
        continue;
      }

      if(step.name==='dev_patch_prepare'){
        const input=mission.input||{};
        const patches=Array.isArray(input.patches)?input.patches:[];
        if(!patches.length){
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_EMPTY',message:'Patch dosyası bulunamadı.',retryable:false});
          return mission;
        }
        const checked=[];
        for(const patch of patches){
          const loc=developerMissionTarget(input,patch);
          if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile()){
            mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_TARGET_MISSING',message:'Patch hedefi bulunamadı: '+patch.path,retryable:false});
            return mission;
          }
          const current=fileHash(loc.target);
          if(current!==String(patch.expectedSha256||'')){
            mission=engine.failStep(WORKSPACE,id,{code:'PROJECT_FILE_CONFLICT',message:'Patch başlamadan dosya değişmiş; otomatik üzerine yazma engellendi: '+patch.path,retryable:false});
            return mission;
          }
          checked.push(loc.relative);
        }
        const backupRoot=path.resolve(MEMORY_DIR,'developer-patches',String(id).replace(/[^A-Za-z0-9_-]/g,'_'));
        fs.mkdirSync(backupRoot,{recursive:true});
        mission=engine.completeStep(WORKSPACE,id,{artifact:{project:developerProjectSlug(input.projectName),files:checked,baselineVerified:true,backupRoot:path.relative(WORKSPACE,backupRoot)}});
        continue;
      }

      if(/^dev_patch_file_\d+$/.test(step.name)){
        const input=mission.input||{};
        const patches=Array.isArray(input.patches)?input.patches:[];
        const index=Math.max(0,Number(step.meta&&step.meta.fileIndex)||0);
        const patch=patches[index];
        if(!patch){
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_FILE_MISSING',message:'Patch dosya girdisi bulunamadı. rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        const loc=developerMissionTarget(input,patch);
        const baseline=String(patch.expectedSha256||'');
        const desired=String(patch.sha256||crypto.createHash('sha256').update(String(patch.content||''),'utf8').digest('hex'));
        if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile()){
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_TARGET_MISSING',message:'Patch hedefi kayboldu: '+patch.path+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        const current=fileHash(loc.target);
        if(current===desired){
          const backup=developerPatchBackupLocation(id,input,patch);
          mission=engine.completeStep(WORKSPACE,id,{artifact:{file:loc.relative,beforeSha256:baseline,afterSha256:desired,backup:backup.relative,reused:true,recovered:true}});
          continue;
        }
        if(current!==baseline){
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'PROJECT_FILE_CONFLICT',message:'Dosya patch baseline sonrası değişmiş; üzerine yazma durduruldu: '+patch.path+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        const backup=developerPatchBackupLocation(id,input,patch);
        fs.mkdirSync(path.dirname(backup.target),{recursive:true});
        if(fs.existsSync(backup.target)){
          if(!fs.statSync(backup.target).isFile()||fileHash(backup.target)!==baseline){
            const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
            mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_BACKUP_CONFLICT',message:'Rollback yedeği doğrulanamadı: '+patch.path+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
            return mission;
          }
        }else{
          fs.copyFileSync(loc.target,backup.target);
          if(fileHash(backup.target)!==baseline){
            mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_BACKUP_VERIFY_FAILED',message:'Rollback yedeği doğrulanamadı: '+patch.path,retryable:false});
            return mission;
          }
        }
        const tmp=loc.target+'.jarvis-patch-'+process.pid+'-'+Date.now()+'.tmp';
        fs.writeFileSync(tmp,String(patch.content||''),'utf8');
        if(fileHash(tmp)!==desired){
          try{fs.unlinkSync(tmp)}catch(_){}
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_TEMP_VERIFY_FAILED',message:'Geçici patch dosyası doğrulanamadı: '+patch.path+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        fs.copyFileSync(tmp,loc.target);
        try{fs.unlinkSync(tmp)}catch(_){}
        const actual=fileHash(loc.target);
        if(actual!==desired){
          try{fs.copyFileSync(backup.target,loc.target)}catch(_){}
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_WRITE_VERIFY_FAILED',message:'Patch yazımı doğrulanamadı: '+patch.path+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{file:loc.relative,beforeSha256:baseline,afterSha256:actual,backup:backup.relative,changed:true,reused:false}});
        continue;
      }

      if(step.name==='dev_patch_verify'){
        const input=mission.input||{};
        const patches=Array.isArray(input.patches)?input.patches:[];
        const verified=[];
        try{
          for(const patch of patches){
            const loc=developerMissionTarget(input,patch);
            const desired=String(patch.sha256||'');
            if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile()||fileHash(loc.target)!==desired){
              throw new Error('Patch final hash doğrulaması başarısız: '+String(patch.path||''));
            }
            const validation=validateDeveloperPatchedFile(loc.target);
            verified.push({file:loc.relative,validator:validation.validator});
          }
        }catch(e){
          const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_PATCH_VERIFY_FAILED',message:String(e.message||e).slice(0,700)+' · rollback='+(rollback.ok?'ok':'check'),retryable:false});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{project:developerProjectSlug(input.projectName),files:verified,verified:true,rollbackAvailable:true}});
        continue;
      }

      if(step.name==='dev_prepare'){
        const input=mission.input||{};
        const projectName=developerProjectSlug(input.projectName||mission.label);
        const root=safeFile(projectName);
        fs.mkdirSync(root,{recursive:true});
        mission=engine.completeStep(WORKSPACE,id,{artifact:{project:projectName,path:root}});
        continue;
      }

      if(/^dev_file_\d+$/.test(step.name)){
        const input=mission.input||{};
        const files=Array.isArray(input.files)?input.files:[];
        const index=Math.max(0,Number(step.meta&&step.meta.fileIndex)||0);
        const file=files[index];
        if(!file){
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_FILE_MISSING',message:'Proje dosya girdisi bulunamadı.',retryable:false});
          return mission;
        }
        const loc=developerMissionTarget(input,file);
        fs.mkdirSync(path.dirname(loc.target),{recursive:true});
        const expected=String(file.sha256||crypto.createHash('sha256').update(String(file.content||''),'utf8').digest('hex'));
        if(fs.existsSync(loc.target)){
          if(!fs.statSync(loc.target).isFile()){
            mission=engine.failStep(WORKSPACE,id,{code:'PROJECT_PATH_CONFLICT',message:'Proje yolu dosya değil: '+file.path,retryable:false});
            return mission;
          }
          const existing=fileHash(loc.target);
          if(existing!==expected){
            mission=engine.failStep(WORKSPACE,id,{code:'PROJECT_FILE_CONFLICT',message:'Mevcut proje dosyası farklı; otomatik üzerine yazma durduruldu: '+file.path,retryable:false});
            return mission;
          }
          mission=engine.completeStep(WORKSPACE,id,{artifact:{file:loc.relative,sha256:expected,reused:true}});
          continue;
        }
        const tmp=loc.target+'.jarvis-'+process.pid+'-'+Date.now()+'.tmp';
        fs.writeFileSync(tmp,String(file.content||''),'utf8');
        fs.renameSync(tmp,loc.target);
        const actual=fileHash(loc.target);
        if(actual!==expected){
          try{fs.unlinkSync(loc.target)}catch(_){}
          mission=engine.failStep(WORKSPACE,id,{code:'DEV_FILE_VERIFY_FAILED',message:'Yazılan proje dosyası doğrulanamadı: '+file.path,retryable:false});
          return mission;
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{file:loc.relative,sha256:actual,reused:false}});
        continue;
      }

      if(step.name==='dev_verify'){
        const input=mission.input||{};
        const files=Array.isArray(input.files)?input.files:[];
        const verified=[];
        for(const file of files){
          const loc=developerMissionTarget(input,file);
          const expected=String(file.sha256||'');
          if(!fs.existsSync(loc.target)||!fs.statSync(loc.target).isFile()||fileHash(loc.target)!==expected){
            mission=engine.failStep(WORKSPACE,id,{code:'DEV_PROJECT_VERIFY_FAILED',message:'Proje doğrulaması başarısız: '+String(file.path||''),retryable:false});
            return mission;
          }
          verified.push(loc.relative);
        }
        mission=engine.completeStep(WORKSPACE,id,{artifact:{project:developerProjectSlug(input.projectName),files:verified,verified:true}});
        continue;
      }

      mission=engine.failStep(WORKSPACE,id,{code:'UNKNOWN_MISSION_STEP',message:'Bilinmeyen görev adımı: '+step.name,retryable:false});
      return mission;
    }catch(e){
      let message=String(e&&e.message||e).slice(0,1000);
      if(mission&&mission.type==='developer_patch'){
        const rollback=rollbackDeveloperPatchMission(engine.loadMission(WORKSPACE,id));
        message=(message+' · rollback='+(rollback.ok?'ok':'check')).slice(0,1000);
      }
      if(message==='SHOPIFY_NOT_CONNECTED'){
        mission=engine.failStep(WORKSPACE,id,{code:'SHOPIFY_NOT_CONNECTED',message:'Shopify yerel bağlantısı kurulmalı.',retryable:true,dependency:'shopify'});
        return mission;
      }
      if(/(?:Browser Operator is not running|Chrome, Edge veya Opera GX bulunamadı|Browser debugging endpoint did not become ready)/i.test(message)){
        mission=engine.failStep(WORKSPACE,id,{code:'BROWSER_NOT_READY',message,retryable:true,dependency:'browser'});
        return mission;
      }
      mission=engine.failStep(WORKSPACE,id,{code:String(e&&e.code||'MISSION_STEP_ERROR'),message,retryable:false});
      return mission;
    }
  }
  return engine.loadMission(WORKSPACE,id);
}
let durableMissionServiceBusy=false;
let durableMissionLastRunAt=0;
let durableMissionLastResult=null;

function missionHealthSnapshot(){
  try{
    const engine=getMissionEngine();
    const rows=engine.listMissions(WORKSPACE,{limit:50});
    const latest=rows[0]||null;
    const open=engine.schedulerOrder(rows);
    const paused=rows.filter(x=>String(x.status||'')==='paused');
    const counts={queued:0,waitingDependency:0,needsVerification:0,running:0,paused:paused.length};
    for(const row of open){
      if(row.status==='queued')counts.queued++;
      else if(row.status==='waiting_dependency')counts.waitingDependency++;
      else if(row.status==='needs_verification')counts.needsVerification++;
      else if(row.status==='running')counts.running++;
    }
    return{
      ok:true,
      autoResume:true,
      scheduler:'oldest-ready-first',
      openCount:open.length+paused.length,
      counts,
      queue:[...open,...paused]
        .sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))
        .slice(0,10)
        .map(x=>engine.summarizeMission(x)),
      latest:latest?engine.summarizeMission(latest):null,
      serviceBusy:durableMissionServiceBusy,
      lastRunAt:durableMissionLastRunAt||null,
      lastResult:durableMissionLastResult
    };
  }catch(e){
    return{ok:false,autoResume:true,scheduler:'oldest-ready-first',openCount:0,counts:{queued:0,waitingDependency:0,needsVerification:0,running:0,paused:0},queue:[],latest:null,error:String(e.message||e).slice(0,240)};
  }
}
function cloudMissionTelemetry(){
  const h=missionHealthSnapshot();
  const cleanQueue=Array.isArray(h.queue)?h.queue.slice(0,8).map(m=>({
    id:String(m&&m.id||'').slice(0,90),
    type:String(m&&m.type||'').slice(0,80),
    label:String(m&&m.label||'').slice(0,160),
    status:String(m&&m.status||'').slice(0,40),
    currentStep:Number(m&&m.currentStep||0),
    step:m&&m.step?{
      name:String(m.step.name||'').slice(0,80),
      status:String(m.step.status||'').slice(0,40),
      attempts:Number(m.step.attempts||0),
      dependency:String(m.step.error&&m.step.error.dependency||'').slice(0,80)
    }:null,
    artifacts:Array.isArray(m&&m.artifacts)?m.artifacts.slice(0,20):[]
  })):[];
  return{
    ok:!!h.ok,
    scheduler:String(h.scheduler||'').slice(0,80),
    openCount:Number(h.openCount||0),
    counts:h.counts&&typeof h.counts==='object'?{
      queued:Number(h.counts.queued||0),
      waitingDependency:Number(h.counts.waitingDependency||0),
      needsVerification:Number(h.counts.needsVerification||0),
      running:Number(h.counts.running||0),
      paused:Number(h.counts.paused||0)
    }:{queued:0,waitingDependency:0,needsVerification:0,running:0,paused:0},
    queue:cleanQueue,
    lastRunAt:Number(h.lastRunAt||0)||null,
    lastResult:h.lastResult&&typeof h.lastResult==='object'?{
      status:String(h.lastResult.status||'').slice(0,40),
      missionId:String(h.lastResult.missionId||'').slice(0,90),
      dependency:String(h.lastResult.dependency||'').slice(0,80),
      at:String(h.lastResult.at||'').slice(0,64)
    }:null
  };
}
async function missionDependencyReady(mission){
  const engine=getMissionEngine();
  const step=engine.currentStep(mission);
  const dep=String(step&&step.error&&step.error.dependency||'');
  if(!dep)return true;

  if(/^mission:M-[A-Z0-9-]{12,80}$/.test(dep)){
    const childId=dep.slice('mission:'.length);
    const child=getMissionEngine().loadMission(WORKSPACE,childId);
    if(!child)return true;
    return ['completed','failed','cancelled'].includes(String(child.status||''));
  }
  if(dep.startsWith('mission:'))return false;
  if(dep==='pc_runtime'){
    return process.platform==='win32';
  }
  if(dep==='browser'){
    try{
      const st=await getBrowserOperator().status(WORKSPACE);
      return !!(st&&st.executable);
    }catch(_){return false}
  }
  if(dep==='shopify'){
    try{
      const st=await getCommerceEngine().status(WORKSPACE);
      return !!(st&&st.connected&&st.ok);
    }catch(_){return false}
  }
  if(dep==='youtube_auth'){
    try{
      const st=await getYoutubeStudio().status(getBrowserOperator(),WORKSPACE);
      return !!(st&&st.running&&st.loggedIn);
    }catch(_){return false}
  }
  if(dep==='creator_probe'){
    try{
      const st=getCreatorEngine().ffmpegStatus(WORKSPACE);
      return !!(st&&st.ffmpeg&&st.ffprobe);
    }catch(_){return false}
  }
  if(dep==='ffmpeg'){
    try{return !!getCreatorEngine().ffmpegStatus(WORKSPACE).ok}catch(_){return false}
  }
  if(dep==='youtube_studio'){
    try{
      const st=await getYoutubeStudio().status(getBrowserOperator(),WORKSPACE);
      return !!(st&&st.running);
    }catch(_){return false}
  }
  return false;
}
function visibleJarvisShellWindows(){
  if(process.platform!=='win32')return[];
  const ps="Get-CimInstance Win32_Process | Where-Object { @('cmd.exe','powershell.exe','pwsh.exe') -contains $_.Name -and $_.CommandLine -like '*JARVIS*' } | ForEach-Object { $p=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -ne 0){ [pscustomobject]@{ pid=$_.ProcessId; name=$_.Name; title=$p.MainWindowTitle } } } | ConvertTo-Json -Compress";
  try{
    const out=childProcess.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:256*1024}).trim();
    if(!out)return[];
    const parsed=JSON.parse(out);
    return(Array.isArray(parsed)?parsed:[parsed]).map(x=>({pid:Number(x.pid)||0,name:String(x.name||'').slice(0,80),title:String(x.title||'').slice(0,200)}));
  }catch(_){return[]}
}
function startupAcceptanceSnapshot(){
  const jarvisDir=path.join(os.homedir(),'JARVIS-OS');
  const startupPs=path.join(jarvisDir,'jarvis-startup.ps1');
  const hiddenVbs=path.join(jarvisDir,'JARVIS-STARTUP-HIDDEN.vbs');
  const installer=path.join(jarvisDir,'install-jarvis-startup.ps1');
  const fallback=process.platform==='win32'&&process.env.APPDATA?path.join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','Startup','JARVIS-Silent-Startup.vbs'):null;
  const canonicalFiles={startup:fs.existsSync(startupPs),hiddenLauncher:fs.existsSync(hiddenVbs),installer:fs.existsSync(installer)};
  let taskRegistered=false,hiddenTaskAction=false,taskError=null;
  if(process.platform==='win32'){
    try{
      const out=childProcess.execFileSync('schtasks.exe',['/Query','/TN','JARVIS Silent Startup','/FO','LIST','/V'],{encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:512*1024});
      taskRegistered=true;
      hiddenTaskAction=/wscript\.exe/i.test(out)&&/JARVIS-STARTUP-HIDDEN\.vbs/i.test(out);
    }catch(e){taskError=String(e.message||e).slice(0,220)}
  }
  const fallbackRegistered=!!(fallback&&fs.existsSync(fallback));
  const visibleShells=visibleJarvisShellWindows();
  let logTail=[];
  try{
    const file=path.join(WORKSPACE,'.jarvis-memory','startup.log');
    if(fs.existsSync(file))logTail=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(-12);
  }catch(_){ }
  const canonicalOk=Object.values(canonicalFiles).every(Boolean);
  const registrationOk=process.platform==='win32'?((taskRegistered&&hiddenTaskAction)||fallbackRegistered):null;
  const silentOk=process.platform==='win32'?(canonicalOk&&registrationOk&&visibleShells.length===0):null;
  const selfUpdate=selfUpdateState();
  return{platform:process.platform,windows:process.platform==='win32',canonicalFiles,canonicalOk,taskRegistered,hiddenTaskAction,fallbackRegistered,visibleJarvisShells:visibleShells,registrationOk,silentOk,selfUpdate,taskError,startupLogTail:logTail};
}
async function buildPcAcceptanceSnapshot(){
  const generatedAt=new Date().toISOString();
  const startup=startupAcceptanceSnapshot();
  let creator=null,browser=null,commerce=null,youtube=null;
  try{creator=getCreatorEngine().ffmpegStatus(WORKSPACE)}catch(e){creator={ok:false,error:String(e.message||e).slice(0,240)}}
  try{browser=await getBrowserOperator().status(WORKSPACE)}catch(e){browser={ok:false,running:false,error:String(e.message||e).slice(0,240)}}
  try{commerce=await getCommerceEngine().status(WORKSPACE)}catch(e){commerce={ok:false,connected:false,error:String(e.message||e).slice(0,240)}}
  try{youtube=await getYoutubeStudio().status(getBrowserOperator(),WORKSPACE)}catch(e){youtube={ok:false,running:false,loggedIn:false,error:String(e.message||e).slice(0,240)}}
  const missions=missionHealthSnapshot();
  const checks={workerVersion:WORKER_VERSION==='2.102.0',creatorQualityGateReady:CAPS.includes('creator_quality_gate_v1')&&CAPS.includes('creator_quality_recovery_v1'),creatorShortMotionReady:CAPS.includes('creator_short_motion_rhythm_v1'),creatorImageMotionReady:CAPS.includes('creator_image_motion_fallback_v1'),creatorAutoWebReady:CAPS.includes('creator_auto_web_query_v1'),creatorSceneWebReady:CAPS.includes('creator_scene_web_queries_v1'),creatorNarrativeSyncReady:CAPS.includes('creator_narrative_visual_sync_v1'),creatorKineticCaptionsReady:CAPS.includes('creator_short_kinetic_captions_v1'),creatorWebFreshnessReady:CAPS.includes('creator_web_freshness_v1'),creatorRealMotionHookReady:CAPS.includes('creator_real_motion_hook_v1'),creatorBatchWebDiversityReady:CAPS.includes('creator_batch_web_diversity_v1'),creatorMicroHookReady:CAPS.includes('creator_micro_hook_v1'),creatorHookMotionReady:CAPS.includes('creator_hook_motion_evidence_v1'),creatorAutoHookRankReady:CAPS.includes('creator_auto_hook_motion_rank_v1'),creatorThumbnailReady:CAPS.includes('creator_thumbnail_v1'),creatorShortSfxReady:CAPS.includes('creator_short_sfx_v1'),creatorLongformReady:CAPS.includes('creator_longform_mission_v1')&&CAPS.includes('creator_longform_quality_v1')&&CAPS.includes('creator_longform_recovery_v1')&&CAPS.includes('creator_multilingual_voice_v1')&&CAPS.includes('creator_daily_longform_v1')&&CAPS.includes('creator_daily_idempotency_v1')&&CAPS.includes('creator_longform_duration_fit_v1')&&CAPS.includes('creator_longform_edit_rhythm_v1'),creatorBatchMissionReady:CAPS.includes('creator_batch_mission_v1')&&CAPS.includes('creator_batch_child_dedupe_v1')&&CAPS.includes('creator_batch_youtube_draft_v1')&&CAPS.includes('mission_cooperative_yield_v1')&&CAPS.includes('creator_batch_storyboard_lock_v1')&&CAPS.includes('creator_batch_render_binding_v1'),creatorAssetMissionReady:CAPS.includes('creator_asset_mission_v1')&&CAPS.includes('creator_asset_probe_v1')&&CAPS.includes('creator_asset_hash_dedupe_v1'),creatorVisualRelevanceReady:CAPS.includes('creator_asset_semantic_catalog_v1')&&CAPS.includes('creator_visual_relevance_v1')&&CAPS.includes('creator_local_vision_broll_v1')&&CAPS.includes('creator_semantic_diversity_v1')&&CAPS.includes('creator_relevance_preserving_fallback_v1')&&CAPS.includes('creator_semantic_relevance_floor_v1')&&CAPS.includes('creator_semantic_narrative_digest_v1')&&CAPS.includes('creator_procedural_fallback_v1'),creatorStoryboardReady:CAPS.includes('creator_storyboard_v1')&&CAPS.includes('creator_explicit_assets_v1')&&CAPS.includes('creator_render_mission_bind_v1'),pcMissionReady:CAPS.includes('pc_safe_mission_v1')&&CAPS.includes('pc_safe_action_catalog_v1'),workspaceFileMissionReady:CAPS.includes('workspace_file_mission_v1')&&CAPS.includes('workspace_file_hash_guard_v1')&&CAPS.includes('workspace_file_no_overwrite_v1'),missionControlReady:CAPS.includes('mission_control_v1')&&CAPS.includes('mission_pause_v1')&&CAPS.includes('mission_cancel_v1'),missionRuntime:!!(missions&&missions.ok&&missions.autoResume),creatorEngineLoaded:!!(creator&&!creator.error),browserOperatorLoaded:!!(browser&&!browser.error),commerceEngineLoaded:!!(commerce&&!commerce.error),youtubeStudioLoaded:!!(youtube&&!youtube.error),silentStartup:process.platform==='win32'?startup.silentOk:true,autoUpdateReady:!!(startup.selfUpdate&&startup.selfUpdate.configured)};
  const corePass=Object.values(checks).every(Boolean);
  const accountSetup={shopifyConnected:!!(commerce&&commerce.ok&&commerce.connected),youtubeLoggedIn:!!(youtube&&youtube.ok&&youtube.loggedIn)};
  const snapshot={ok:true,generatedAt,worker:{version:WORKER_VERSION,name:NAME,platform:process.platform,arch:process.arch},checks,corePass,startup,update:startup.selfUpdate,creator:{ready:!!(creator&&creator.ok),assets:Number(creator&&creator.assets||0),outputDir:creator&&creator.outputDir||null,installable:!!(creator&&creator.installable)},browser:{running:!!(browser&&browser.running),browser:browser&&browser.browser||null,tabs:Array.isArray(browser&&browser.tabs)?browser.tabs.length:0,profile:browser&&browser.profile||null},commerce:{connected:accountSetup.shopifyConnected,shop:commerce&&commerce.shop||null,apiVersion:commerce&&commerce.apiVersion||null,message:String(commerce&&commerce.message||'').slice(0,300)},youtube:{running:!!(youtube&&youtube.running),loggedIn:accountSetup.youtubeLoggedIn,title:youtube&&youtube.title||null,url:youtube&&youtube.url||null,message:String(youtube&&youtube.message||'').slice(0,300)},missions,accountSetup};
  const report=path.join(MEMORY_DIR,'acceptance-snapshot.json');
  try{fs.writeFileSync(report,JSON.stringify(snapshot,null,2),'utf8');snapshot.report=report}catch(e){snapshot.report=null;snapshot.reportError=String(e.message||e).slice(0,220)}
  return snapshot;
}
function acceptanceSummaryText(x){
  const startup=x&&x.startup||{},accounts=x&&x.accountSetup||{},creator=x&&x.creator||{},missions=x&&x.missions||{};
  return['PC ACCEPTANCE '+(x&&x.corePass?'CORE PASS':'CORE CHECK'),'Worker '+String(x&&x.worker&&x.worker.version||WORKER_VERSION),process.platform==='win32'?('startup '+(startup.silentOk?'SILENT':'CHECK')):'startup Windows testinde doğrulanacak','update '+String(x&&x.update&&x.update.status||'unknown').toUpperCase(),'Creator '+(creator.ready?'READY':'SETUP'),'Shopify '+(accounts.shopifyConnected?'READY':'SETUP'),'YouTube '+(accounts.youtubeLoggedIn?'READY':'LOGIN'),'open missions '+Number(missions.openCount||0),x&&x.report?('report '+x.report):''].filter(Boolean).join(' · ');
}
async function repairLocalRuntime(){
  const actions=[];
  if(process.platform!=='win32'){
    const snapshot=await buildPcAcceptanceSnapshot();
    return{ok:true,skipped:true,actions:[{name:'windows_runtime',ok:true,detail:'Windows dışı ortamda onarım uygulanmadı.'}],snapshot};
  }

  const runtimeFiles=[
    ['jarvis-self-update.ps1',"UPDATER_VERSION='5.0'"],
    ['jarvis-update-manifest.json','"schema": 1'],
    ['jarvis-startup.ps1','JARVIS_CINEMATIC_STARTUP_V1'],
    ['JARVIS-STARTUP-HIDDEN.vbs','jarvis-startup.ps1'],
    ['install-jarvis-startup.ps1','JARVIS Silent Startup'],
    ['jarvis-creator-engine.js',"ENGINE_VERSION='1.4'"],
    ['jarvis-creator-semantic-quality.js',"SEMANTIC_QUALITY_VERSION='1.4'"],
    ['jarvis-bluetooth-secure.js',"const VERSION='1.0'"],
    ['jarvis-bluetooth-audio.js',"const VERSION='1.7'"],
    ['jarvis-creator-web-media.js',"CREATOR_WEB_MEDIA_VERSION='1.0'"],
    ['jarvis-browser-operator.js',"BROWSER_OPERATOR_VERSION='1.0'"],
    ['jarvis-commerce-engine.js',"ENGINE_VERSION='1.0'"],
    ['jarvis-shopify-connect.ps1','SHOPIFY SECURE CONNECT'],
    ['jarvis-youtube-studio.js',"YOUTUBE_STUDIO_VERSION='1.1'"],
    ['jarvis-mission-engine.js',"MISSION_ENGINE_VERSION='1.0'"],
    ['jarvis-workspace-file-engine.js',"WORKSPACE_FILE_ENGINE_VERSION='1.0'"],
    ['JARVIS-PC-ACCEPTANCE.ps1','JARVIS PC ACCEPTANCE V1']
  ];

  for(const [name,signature] of runtimeFiles){
    try{
      const file=syncRepoRuntimeFile(name,signature);
      actions.push({name:'sync:'+name,ok:!!file,detail:file?'ready':'sync failed'});
    }catch(e){
      actions.push({name:'sync:'+name,ok:false,detail:String(e.message||e).slice(0,240)});
    }
  }

  try{
    const installer=path.join(__dirname,'install-jarvis-startup.ps1');
    childProcess.execFileSync('powershell.exe',[
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',installer
    ],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1024*1024});
    actions.push({name:'silent_startup_registration',ok:true,detail:'canonical startup re-registered'});
  }catch(e){
    actions.push({name:'silent_startup_registration',ok:false,detail:String(e.message||e).slice(0,300)});
  }

  try{
    const before=getCreatorEngine().ffmpegStatus(WORKSPACE);
    const after=before.ok?before:getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
    actions.push({name:'creator_ffmpeg',ok:!!after.ok,detail:after.ok?'FFmpeg ready':'FFmpeg setup unavailable'});
  }catch(e){
    actions.push({name:'creator_ffmpeg',ok:false,detail:String(e.message||e).slice(0,300)});
  }

  try{
    cleanupOrphanedJarvisHelpers();
    actions.push({name:'orphan_helper_cleanup',ok:true,detail:'stale JARVIS helpers cleaned'});
  }catch(e){
    actions.push({name:'orphan_helper_cleanup',ok:false,detail:String(e.message||e).slice(0,300)});
  }

  const snapshot=await buildPcAcceptanceSnapshot();
  const required=actions.filter(x=>x.name!=='orphan_helper_cleanup');
  const ok=required.every(x=>x.ok)&&snapshot.corePass;
  remember({kind:'pc_self_repair',ok,actions:actions.map(x=>({name:x.name,ok:x.ok})),corePass:snapshot.corePass});
  return{ok,actions,snapshot};
}
function repairSummaryText(out){
  const failed=(out.actions||[]).filter(x=>!x.ok).map(x=>x.name);
  return[
    out.ok?'JARVIS SELF-REPAIR PASS':'JARVIS SELF-REPAIR CHECK',
    'Worker '+WORKER_VERSION,
    out.snapshot&&out.snapshot.startup&&out.snapshot.startup.windows?('startup '+(out.snapshot.startup.silentOk?'SILENT':'CHECK')):'startup Windows testinde doğrulanacak',
    out.snapshot&&out.snapshot.creator?('Creator '+(out.snapshot.creator.ready?'READY':'SETUP')):'',
    failed.length?('kalan '+failed.join(', ')):'yerel onarım adımları tamam'
  ].filter(Boolean).join(' · ');
}
async function serviceDurableMissions(){
  if(durableMissionServiceBusy)return{ok:true,skipped:'busy'};
  durableMissionServiceBusy=true;
  durableMissionLastRunAt=Date.now();
  try{
    const engine=getMissionEngine();
    const ordered=engine.schedulerOrder(engine.listMissions(WORKSPACE,{limit:50}));
    if(!ordered.length){
      durableMissionLastResult={ok:true,status:'idle',scheduler:'oldest-ready-first',at:new Date().toISOString()};
      return durableMissionLastResult;
    }

    let candidate=null;
    let blockedDependencies=0;
    let unresolvedVerification=0;
    let runningSkipped=0;

    for(const row of ordered.slice(0,30)){
      let mission=engine.loadMission(WORKSPACE,row.id)||row;

      if(mission.status==='needs_verification'){
        const checked=await verifyUncertainCampaignStep(mission);
        mission=checked||mission;
        if(mission.status==='needs_verification'){
          unresolvedVerification++;
          continue;
        }
        if(mission.status==='completed'||mission.status==='failed')continue;
      }

      if(mission.status==='waiting_dependency'){
        const ready=await missionDependencyReady(mission);
        if(!ready){
          blockedDependencies++;
          continue;
        }
      }

      if(mission.status==='running'){
        runningSkipped++;
        continue;
      }

      if(['queued','waiting_dependency'].includes(mission.status)){
        candidate=mission;
        break;
      }
    }

    if(!candidate){
      durableMissionLastResult={
        ok:true,
        status:'no_runnable_mission',
        scheduler:'oldest-ready-first',
        openCount:ordered.length,
        blockedDependencies,
        unresolvedVerification,
        runningSkipped,
        at:new Date().toISOString()
      };
      return durableMissionLastResult;
    }

    const before=engine.summarizeMission(candidate);
    const out=await runDurableMission(candidate.id);
    const after=engine.summarizeMission(out);
    durableMissionLastResult={
      ok:out.status==='completed'||out.status==='waiting_dependency'||out.status==='needs_verification',
      status:out.status,
      scheduler:'oldest-ready-first',
      missionId:out.id,
      blockedDependencies,
      unresolvedVerification,
      at:new Date().toISOString()
    };
    remember({kind:'durable_mission_auto_resume',scheduler:'oldest-ready-first',before,after,blockedDependencies,unresolvedVerification});
    if(out.status==='completed'){
      console.log('[JARVIS] MISSION AUTO-RESUME COMPLETE: '+out.id);
    }else{
      console.log('[JARVIS] MISSION AUTO-RESUME: '+out.id+' -> '+out.status);
    }
    return durableMissionLastResult;
  }catch(e){
    durableMissionLastResult={ok:false,status:'error',scheduler:'oldest-ready-first',error:String(e.message||e).slice(0,400),at:new Date().toISOString()};
    console.error('[JARVIS] MISSION AUTO-RESUME:',e.message);
    return durableMissionLastResult;
  }finally{
    durableMissionServiceBusy=false;
  }
}
function openShopifyConnectWindow(){
  if(process.platform!=='win32')return{ok:false,message:'Shopify güvenli bağlantı sihirbazı şu anda Windows için hazır.'};
  const script=syncRepoRuntimeFile('jarvis-shopify-connect.ps1','SHOPIFY SECURE CONNECT');
  if(!script)return{ok:false,message:'Shopify bağlantı dosyası hazırlanamadı.'};
  try{
    const p=childProcess.spawn('powershell.exe',[
      '-NoLogo','-NoExit','-ExecutionPolicy','Bypass','-File',script
    ],{windowsHide:false,detached:true,stdio:'ignore'});
    p.unref();
    return{ok:true,message:'Shopify güvenli bağlantı penceresi açıldı. Token yalnızca bu PC’de Windows DPAPI ile şifreli saklanacak.'};
  }catch(e){
    return{ok:false,message:'Shopify bağlantı penceresi açılamadı: '+e.message};
  }
}
function bootstrapRuntimeUpgrade(){
  if(process.platform!=='win32'||TEST_MODE)return{ok:false,skipped:true};
  const marker=path.join(MEMORY_DIR,'bootstrap-v48.json');
  try{
    if(fs.existsSync(marker)){
      const x=JSON.parse(fs.readFileSync(marker,'utf8'));
      if(x&&x.version===48&&x.ok)return{ok:true,already:true};
    }
  }catch(_){}

  const files=[
    ['jarvis-self-update.ps1',"UPDATER_VERSION='5.0'"],
    ['jarvis-update-manifest.json','"schema": 1'],
    ['jarvis-startup.ps1','JARVIS_CINEMATIC_STARTUP_V1'],
    ['JARVIS-STARTUP-HIDDEN.vbs','jarvis-startup.ps1'],
    ['install-jarvis-startup.ps1','JARVIS Silent Startup'],
    ['jarvis-creator-engine.js',"ENGINE_VERSION='1.4'"],
    ['jarvis-browser-operator.js',"BROWSER_OPERATOR_VERSION='1.0'"],
    ['jarvis-commerce-engine.js',"ENGINE_VERSION='1.0'"],
    ['jarvis-shopify-connect.ps1','SHOPIFY SECURE CONNECT'],
    ['jarvis-youtube-studio.js',"YOUTUBE_STUDIO_VERSION='1.1'"],
    ['jarvis-mission-engine.js',"MISSION_ENGINE_VERSION='1.0'"],
    ['jarvis-workspace-file-engine.js',"WORKSPACE_FILE_ENGINE_VERSION='1.0'"],
    ['JARVIS-PC-ACCEPTANCE.ps1','JARVIS PC ACCEPTANCE V1']
  ];
  const synced=[];
  for(const [name,signature] of files){
    const p=syncRepoRuntimeFile(name,signature);
    if(!p)throw new Error('bootstrap file missing: '+name);
    synced.push(name);
  }

  const installer=path.join(__dirname,'install-jarvis-startup.ps1');
  try{
    childProcess.execFileSync('powershell.exe',[
      '-NoProfile','-ExecutionPolicy','Bypass','-File',installer
    ],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1024*1024});
  }catch(e){
    throw new Error('canonical startup install failed: '+e.message);
  }

  fs.mkdirSync(MEMORY_DIR,{recursive:true});
  fs.writeFileSync(marker,JSON.stringify({
    version:48,ok:true,at:new Date().toISOString(),worker:WORKER_VERSION,synced
  },null,2),'utf8');
  console.log('[JARVIS] BOOTSTRAP MIGRATION V48: READY');
  return{ok:true,synced};
}
function cleanupOrphanedJarvisHelpers(){
  if(process.platform!=='win32')return;
  // Keep this PowerShell as one syntactically complete pipeline. The previous
  // version inserted semicolons inside Where-Object and caused ParserError.
  const ps="Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match 'jarvis-double-clap-v\\d+\\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  try{
    childProcess.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{windowsHide:true,timeout:8000,maxBuffer:128*1024});
    console.log('[JARVIS] ORPHAN CLAP CLEANUP: OK');
  }catch(e){
    console.error('[JARVIS] ORPHAN CLAP CLEANUP:',e.message);
  }
}

function startWindowsWakeHelper(){
  if(process.platform!=='win32')return;
  const helper=ensureWindowsHelper('jarvis-wake-hotkey.ps1');
  if(!helper){console.error('[JARVIS] F8 WAKE: helper hazirlanamadi');return}
  try{
    const p=childProcess.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',helper],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] F8 WAKE ERROR: '+String(d)));
    p.on('exit',code=>{if(code!==0)console.error('[JARVIS] F8 WAKE helper kapandi. code='+code)});
    p.on('error',e=>console.error('[JARVIS] F8 WAKE baslatilamadi:',e.message));
  }catch(e){console.error('[JARVIS] F8 WAKE baslatma hatasi:',e.message)}
}

function startWindowsClapHelper(){
  if(process.platform!=='win32')return;
  const helper=ensureWindowsHelper('jarvis-double-clap-v9.py');
  if(!helper){console.error('[JARVIS] DOUBLE CLAP: helper hazirlanamadi');return}
  try{
    const p=childProcess.spawn('py',[helper],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] DOUBLE CLAP ERROR: '+String(d)));
    p.on('exit',code=>{if(code!==0)console.error('[JARVIS] DOUBLE CLAP helper kapandi. code='+code)});
    p.on('error',e=>console.error('[JARVIS] DOUBLE CLAP baslatilamadi:',e.message));
  }catch(e){console.error('[JARVIS] DOUBLE CLAP baslatma hatasi:',e.message)}
}
function startWindowsLocalSttHelper(){
  if(process.platform!=='win32'||TEST_MODE)return;
  const helper=ensureWindowsHelper('jarvis-local-stt-v4.py');
  if(!helper){console.error('[JARVIS] LOCAL STT: helper hazırlanamadı');return}
  try{
    const env={
      ...process.env,
      JARVIS_STT_PORT:String(LOCAL_STT_PORT),
      JARVIS_STT_MODEL:LOCAL_STT_MODEL,
      JARVIS_WEB_ORIGIN:new URL(BASE).origin,
      JARVIS_SPEECH_LEXICON_FILE:SPEECH_LEXICON_FILE
    };
    const p=childProcess.spawn('py',[helper],{windowsHide:true,stdio:['ignore','pipe','pipe'],env});
    p.stdout.on('data',d=>process.stdout.write(String(d)));
    p.stderr.on('data',d=>process.stderr.write('[JARVIS] LOCAL STT ERROR: '+String(d)));
    p.on('exit',code=>{
      if(code===2)console.error('[JARVIS] LOCAL STT dependency eksik; browser speech fallback aktif.');
      else if(code!==0)console.error('[JARVIS] LOCAL STT helper kapandı. code='+code);
    });
    p.on('error',e=>console.error('[JARVIS] LOCAL STT başlatılamadı:',e.message));
  }catch(e){console.error('[JARVIS] LOCAL STT başlatma hatası:',e.message)}
}

fs.mkdirSync(WORKSPACE,{recursive:true});
fs.mkdirSync(MEMORY_DIR,{recursive:true});
fs.mkdirSync(CHECKPOINT_DIR,{recursive:true});
fs.mkdirSync(JOURNAL_DIR,{recursive:true});
function remember(record){
  const safe={at:new Date().toISOString(),...record};
  fs.appendFileSync(MEMORY_FILE,JSON.stringify(safe)+'\n','utf8');
}
function strategyMetrics(){
  if(!fs.existsSync(MEMORY_FILE))return{steps:0,repairs:0,successes:0,failures:0,byAction:{}};
  const lines=fs.readFileSync(MEMORY_FILE,'utf8').split('\n').filter(Boolean).slice(-2000);
  const out={steps:0,repairs:0,successes:0,failures:0,byAction:{}};
  for(const line of lines){
    let x;try{x=JSON.parse(line)}catch(e){continue}
    if(x.kind==='repair'){out.repairs++;continue}
    if(x.kind!=='plan_step')continue;
    out.steps++;
    if(x.ok)out.successes++;else out.failures++;
    const a=String(x.action||'unknown');
    if(!out.byAction[a])out.byAction[a]={attempts:0,successes:0,failures:0};
    out.byAction[a].attempts++;
    if(x.ok)out.byAction[a].successes++;else out.byAction[a].failures++;
  }
  return out;
}
function strategySelection(){
  const m=strategyMetrics();
  const MIN_EVIDENCE=5;
  const eligible=[];
  for(const [action,v] of Object.entries(m.byAction)){
    if(v.attempts<MIN_EVIDENCE)continue;
    const successRate=v.successes/v.attempts;
    const failureRate=v.failures/v.attempts;
    const score=Math.max(0,successRate-(failureRate*0.5));
    eligible.push({action,attempts:v.attempts,successRate:Number(successRate.toFixed(3)),score:Number(score.toFixed(3))});
  }
  eligible.sort((a,b)=>b.score-a.score||b.attempts-a.attempts||a.action.localeCompare(b.action));
  return{minimumEvidence:MIN_EVIDENCE,repairEvents:m.repairs,candidates:eligible,recommended:eligible[0]||null};
}
function readStrategyPolicy(){
  try{return JSON.parse(fs.readFileSync(STRATEGY_FILE,'utf8'))}catch(e){return{version:1,active:null,previous:null,baseline:null,updatedAt:null}}
}
function writeStrategyPolicy(p){
  const tmp=STRATEGY_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(p,null,2),'utf8');fs.renameSync(tmp,STRATEGY_FILE);
}
function evaluateStrategyPolicy(){
  const selection=strategySelection(),policy=readStrategyPolicy(),candidate=selection.recommended;
  if(!candidate)return{changed:false,rolledBack:false,policy,reason:'Yeterli kanıt yok'};
  const MIN_IMPROVEMENT=0.05,ROLLBACK_DROP=0.10;
  if(policy.active&&policy.baseline&&policy.active.action===candidate.action){
    const drop=Number(policy.baseline.score||0)-candidate.score;
    if(drop>=ROLLBACK_DROP&&policy.previous){
      const next={...policy,active:policy.previous,previous:policy.active,baseline:policy.previous,updatedAt:new Date().toISOString(),lastDecision:'rollback'};
      writeStrategyPolicy(next);remember({kind:'strategy_rollback',from:policy.active,to:policy.previous,drop});
      return{changed:true,rolledBack:true,policy:next,reason:'Performans düşüşü '+drop.toFixed(3)};
    }
    return{changed:false,rolledBack:false,policy,reason:'Etkin strateji korunuyor'};
  }
  const activeScore=policy.baseline?Number(policy.baseline.score||0):0;
  if(!policy.active||candidate.score>=activeScore+MIN_IMPROVEMENT){
    const next={version:Number(policy.version||1)+1,active:candidate,previous:policy.active||null,baseline:candidate,updatedAt:new Date().toISOString(),lastDecision:'promote'};
    writeStrategyPolicy(next);remember({kind:'strategy_promote',from:policy.active||null,to:candidate});
    return{changed:true,rolledBack:false,policy:next,reason:'Kanıt eşiğini geçen strateji etkinleştirildi'};
  }
  return{changed:false,rolledBack:false,policy,reason:'Aday mevcut politikayı yeterince aşmadı'};
}
function memoryStats(){
  if(!fs.existsSync(MEMORY_FILE))return{records:0,bytes:0,lastAt:null};
  const raw=fs.readFileSync(MEMORY_FILE,'utf8');
  const lines=raw.split('\n').filter(Boolean);
  let lastAt=null;
  if(lines.length){try{lastAt=JSON.parse(lines[lines.length-1]).at||null}catch(e){}}
  return{records:lines.length,bytes:Buffer.byteLength(raw),lastAt};
}
function selfUpdateState(){
  const updater=path.join(__dirname,'jarvis-self-update.ps1');
  const manifest=path.join(__dirname,'jarvis-update-manifest.json');
  const configured=fs.existsSync(updater)&&fs.existsSync(manifest);
  let state=null;
  try{
    if(fs.existsSync(UPDATE_STATE_FILE))state=JSON.parse(fs.readFileSync(UPDATE_STATE_FILE,'utf8'));
  }catch(_){state=null}
  const checkedAt=state&&state.checked_at?String(state.checked_at):null;
  const success=state&&typeof state.success==='boolean'?state.success:null;
  const changed=state&&Array.isArray(state.changed)?state.changed.map(x=>String(x||'').replace(/[\\/]/g,'/').slice(0,120)).filter(Boolean).slice(0,40):[];
  let ageMinutes=null;
  if(checkedAt){
    const t=Date.parse(checkedAt);
    if(Number.isFinite(t))ageMinutes=Math.max(0,Math.round((Date.now()-t)/60000));
  }
  const status=!configured?'not_configured':success===true?(changed.length?'updated':'current'):success===false?'check_failed':'not_checked';
  return{
    configured,
    status,
    success,
    checkedAt,
    ageMinutes,
    changedCount:changed.length,
    changed,
    updaterVersion:state&&state.updater_version?String(state.updater_version).slice(0,32):null,
    restartPolicy:'startup-before-worker'
  };
}

async function api(route,options={}){
  const auth=DEVICE_TOKEN?'Device '+DEVICE_TOKEN:'Bearer '+TOKEN;
  options.headers={...(options.headers||{}),authorization:auth,'x-jarvis-device-id':DEVICE_ID};
  const r=await fetch(BASE+route,options);
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
function deviceTokenExp(token){
  try{const body=String(token||'').split('.')[0];return Number(JSON.parse(Buffer.from(body,'base64url').toString('utf8')).exp)||0}catch(e){return 0}
}
async function saveDeviceToken(token,kind){
  const tmp=DEVICE_TOKEN_FILE+'.tmp';fs.writeFileSync(tmp,token,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,DEVICE_TOKEN_FILE);DEVICE_TOKEN=token;
  remember({kind,deviceId:DEVICE_ID});
}
async function pairDevice(){
  if(DEVICE_TOKEN||!PAIR_CODE)return false;
  try{
    const r=await fetch(BASE+'/api/pairing/exchange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:PAIR_CODE,deviceId:DEVICE_ID,name:NAME,version:WORKER_VERSION,capabilities:CAPS})});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j.token)throw new Error(j.error||('HTTP '+r.status));
    await saveDeviceToken(j.token,'device_paired');return true;
  }catch(e){console.error('[JARVIS] Pairing:',e.message);return false}
}
async function migrateDeviceCredential(){
  const exp=deviceTokenExp(DEVICE_TOKEN),nowMs=Date.now();
  if(DEVICE_TOKEN&&exp>nowMs+24*60*60*1000)return false;
  if(!DEVICE_TOKEN&&!TOKEN)return false;
  const auths=[];
  if(DEVICE_TOKEN&&exp>nowMs)auths.push('Device '+DEVICE_TOKEN);
  if(TOKEN)auths.push('Bearer '+TOKEN);
  for(const auth of auths.slice(0,2)){
    try{
      const r=await fetch(BASE+'/api/worker/device-token',{method:'POST',headers:{authorization:auth,'x-jarvis-device-id':DEVICE_ID,'content-type':'application/json'},body:JSON.stringify({deviceId:DEVICE_ID})});
      const j=await r.json().catch(()=>({}));if(!r.ok||!j.token)continue;
      await saveDeviceToken(j.token,'device_credential_migrated');return true;
    }catch(e){}
  }
  return false;
}
function listFiles(){
  return fs.readdirSync(WORKSPACE,{withFileTypes:true}).slice(0,100).map(e=>e.name+(e.isDirectory()?'/':''));
}
function safeFile(name){
  const clean=String(name||'').trim().replace(/^[\\/]+/,'');
  if(!clean||clean.includes('..'))throw new Error('Geçersiz dosya yolu');
  const target=path.resolve(WORKSPACE,clean);
  if(!(target===WORKSPACE||target.startsWith(WORKSPACE+path.sep)))throw new Error('Workspace dışına erişim engellendi');
  return target;
}
function verifyPath(rel,type){
  const target=safeFile(rel);
  if(!fs.existsSync(target))return false;
  if(type==='dir')return fs.statSync(target).isDirectory();
  if(type==='file')return fs.statSync(target).isFile();
  return true;
}
function fileHash(file){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function journalFile(task){
  const key=String(task.uid||('legacy-'+task.id)).replace(/[^A-Za-z0-9_.-]/g,'_');
  return path.join(JOURNAL_DIR,key+'.json');
}
function freshJournal(task){return{version:3,task:{uid:task.uid,command:task.command,plan:task.plan,createdAt:task.createdAt},entries:[]}}
function readJournal(task){
  const f=journalFile(task);
  try{return JSON.parse(fs.readFileSync(f,'utf8'))}
  catch(e){
    if(e&&e.code==='ENOENT')return freshJournal(task);
    throw new Error('Transaction journal okunamadı/bozuk; otomatik işlem durduruldu: '+path.basename(f));
  }
}
function writeJournal(task,j){
  const f=journalFile(task),tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(j),'utf8');fs.renameSync(tmp,f);
}
function journalBefore(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target);
  if(j.version!==3)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(j.entries.some(x=>x.path===rel))return;
  if(j.entries.length>=32)throw new Error('Transaction journal 32 öğe sınırını aştı');
  const backupBytes=j.entries.reduce((n,e)=>n+(e.type==='file'&&e.existed&&e.data?Buffer.from(e.data,'base64').length:0),0);
  if(type==='file'){
    if(fs.existsSync(target)){
      const st=fs.statSync(target);if(!st.isFile())throw new Error('Rollback hedefi dosya değil: '+rel);
      if(st.size>512*1024)throw new Error('Rollback limiti: mevcut dosya 512KB üzerinde: '+rel);
      if(backupBytes+st.size>2*1024*1024)throw new Error('Transaction toplam rollback bütçesi 2MB sınırını aştı');
      j.entries.push({path:rel,type:'file',state:'prepared',existed:true,beforeHash:fileHash(target),expectedAfterHash:null,data:fs.readFileSync(target).toString('base64')});
    }else j.entries.push({path:rel,type:'file',state:'prepared',existed:false,beforeHash:null,expectedAfterHash:null});
  }else if(type==='dir')j.entries.push({path:rel,type:'dir',state:'prepared',existed:fs.existsSync(target),expectedAfterExists:null});
  writeJournal(task,j);
}
function journalAfter(task,target,type){
  const j=readJournal(task),rel=path.relative(WORKSPACE,target),e=j.entries.find(x=>x.path===rel);
  if(j.version!==3)throw new Error('Eski transaction journal sürümü otomatik değiştirilemez');
  if(!e)throw new Error('Transaction journal girdisi bulunamadı: '+rel);
  if(type==='file')e.expectedAfterHash=fileHash(target);else e.expectedAfterExists=fs.existsSync(target);
  e.state='applied';writeJournal(task,j);
}
function journalConsistency(task){
  const j=readJournal(task),conflicts=[];
  if(j.version!==3)return{ok:false,conflicts:[{path:'journal',expected:'v3',current:String(j.version)}]};
  for(const e of j.entries){
    const target=safeFile(e.path);
    if(e.type==='file'){
      const current=fileHash(target);
      if(e.state==='applied'&&current!==e.expectedAfterHash)conflicts.push({path:e.path,expected:e.expectedAfterHash,current});
      if(e.state==='prepared'){
        const unchanged=e.existed?current===e.beforeHash:current===null;
        if(!unchanged)conflicts.push({path:e.path,expected:'prepared preimage',current});
      }
    }else if(e.type==='dir'){
      const current=fs.existsSync(target);
      if(e.state==='applied'&&current!==e.expectedAfterExists)conflicts.push({path:e.path,expected:e.expectedAfterExists,current});
      if(e.state==='prepared'&&current!==!!e.existed)conflicts.push({path:e.path,expected:!!e.existed,current});
    }
  }
  return{ok:conflicts.length===0,conflicts};
}
function rollbackJournal(task){
  const consistency=journalConsistency(task);
  if(!consistency.ok){remember({kind:'transaction_conflict',taskUid:task.uid||null,conflicts:consistency.conflicts});return consistency.conflicts.map(x=>({path:x.path,ok:false,error:'external or ambiguous change detected'}))}
  const j=readJournal(task),out=[];
  for(const e of [...j.entries].reverse()){
    const target=safeFile(e.path);
    try{
      if(e.state==='prepared'){out.push({path:e.path,ok:true,skipped:true});continue}
      if(e.type==='file'){
        if(e.existed){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(e.data||'','base64'))}
        else if(fs.existsSync(target)&&fs.statSync(target).isFile())fs.unlinkSync(target);
      }else if(e.type==='dir'&&!e.existed&&fs.existsSync(target))fs.rmdirSync(target);
      out.push({path:e.path,ok:true});
    }catch(err){out.push({path:e.path,ok:false,error:err.message})}
  }
  remember({kind:'transaction_rollback',taskUid:task.uid||null,entries:out});return out;
}
function clearJournal(task){try{fs.unlinkSync(journalFile(task))}catch(e){}}
function planHash(plan){return crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex')}
function verifyCompletedStep(step){
  if(!step||!step.action)return false;
  if(step.action==='make_folder'||step.action==='verify_folder')return verifyPath(step.path,'dir');
  if(step.action==='write_file'){
    const file=safeFile(step.path);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;
    return fileHash(file)===crypto.createHash('sha256').update(String(step.content||''),'utf8').digest('hex');
  }
  if(step.action==='verify_file')return verifyPath(step.path,'file');
  return false;
}
function verifyPlanPrefix(plan,count){
  const failures=[];
  for(let i=0;i<count;i++)if(!verifyCompletedStep(plan.steps[i]))failures.push(i+1);
  return{ok:failures.length===0,failures};
}
function checkpointFile(task){
  const key=String(task.uid||('legacy-'+task.id)).replace(/[^A-Za-z0-9_.-]/g,'_');
  return path.join(CHECKPOINT_DIR,key+'.json');
}
function readCheckpoint(task){
  const f=checkpointFile(task);
  if(!fs.existsSync(f))return{nextStep:0,planVersion:null};
  try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return{nextStep:0,planVersion:null}}
}
function saveCheckpoint(task,data){
  const f=checkpointFile(task),tmp=f+'.tmp';
  const envelope={at:new Date().toISOString(),task:{uid:task.uid,id:task.id,command:task.command,createdAt:task.createdAt,plan:task.plan},...data};
  fs.writeFileSync(tmp,JSON.stringify(envelope),'utf8');
  fs.renameSync(tmp,f);
}
function clearCheckpoint(task){try{fs.unlinkSync(checkpointFile(task))}catch(e){}}
async function runPlan(task){
  const plan=task.plan;
  if(!plan||!Array.isArray(plan.steps)||plan.steps.length<1||plan.steps.length>8)throw new Error('Plan 1-8 adım içermeli');
  const results=[];
  const MAX_STEP_ATTEMPTS=2;
  const cp=readCheckpoint(task),expectedPlanHash=planHash(plan);
  let startAt=(cp.planVersion===plan.version&&cp.planHash===expectedPlanHash&&Number.isInteger(cp.nextStep))?Math.max(0,Math.min(cp.nextStep,plan.steps.length)):0;
  if(cp.nextStep>0&&cp.planHash!==expectedPlanHash)throw new Error('Checkpoint plan hash uyuşmazlığı; otomatik resume reddedildi');
  if(startAt>0){
    const prefix=verifyPlanPrefix(plan,startAt);
    if(!prefix.ok)throw new Error('Checkpoint prefix yeniden doğrulanamadı; adımlar: '+prefix.failures.join(','));
    remember({kind:'resume_revalidated',taskUid:task.uid||null,nextStep:startAt+1,totalSteps:plan.steps.length,planHash:expectedPlanHash});
  }
  for(let i=startAt;i<plan.steps.length;i++){
    const step=plan.steps[i]||{};
    let result=null,lastError=null;
    for(let attempt=1;attempt<=MAX_STEP_ATTEMPTS;attempt++){
      try{
        if(step.action==='make_folder'){
          const dir=safeFile(step.path); journalBefore(task,dir,'dir'); fs.mkdirSync(dir,{recursive:true}); journalAfter(task,dir,'dir');
          result={ok:verifyPath(step.path,'dir'),message:'Klasör: '+step.path};
        }else if(step.action==='write_file'){
          const file=safeFile(step.path),parent=path.dirname(file);
          if(!fs.existsSync(parent))journalBefore(task,parent,'dir');
          journalBefore(task,file,'file'); fs.mkdirSync(parent,{recursive:true});
          if(readJournal(task).entries.some(e=>e.path===path.relative(WORKSPACE,parent)&&e.type==='dir'))journalAfter(task,parent,'dir');
          fs.writeFileSync(file,String(step.content||''),'utf8'); journalAfter(task,file,'file');
          result={ok:verifyPath(step.path,'file'),message:'Dosya: '+step.path};
        }else if(step.action==='verify_file'){
          result={ok:verifyPath(step.path,'file'),message:'Dosya doğrulama: '+step.path};
        }else if(step.action==='verify_folder'){
          result={ok:verifyPath(step.path,'dir'),message:'Klasör doğrulama: '+step.path};
        }else throw new Error('İzin verilmeyen plan aksiyonu: '+String(step.action||''));
        remember({kind:'plan_step',taskUid:task.uid||null,action:step.action,path:step.path||null,step:i+1,attempt,ok:!!result.ok});
        if(result.ok){
          results.push({step:i+1,action:step.action,attempts:attempt,...result});
          saveCheckpoint(task,{planVersion:plan.version,planHash:planHash(plan),nextStep:i+1,totalSteps:plan.steps.length});
          break;
        }
        lastError=new Error('Doğrulama başarısız: '+result.message);
      }catch(e){
        lastError=e;
        remember({kind:'plan_step',taskUid:task.uid||null,action:step.action,path:step.path||null,step:i+1,attempt,ok:false,error:e.message});
      }
      if(attempt<MAX_STEP_ATTEMPTS)remember({kind:'repair',taskUid:task.uid||null,step:i+1,action:step.action,reason:lastError&&lastError.message});
    }
    if(!result||!result.ok){
      const rollback=rollbackJournal(task);
      const failedRollback=rollback.filter(x=>!x.ok);
      if(!failedRollback.length){clearJournal(task);clearCheckpoint(task)}
      throw new Error('Adım '+(i+1)+' iki denemede doğrulanamadı: '+(lastError?lastError.message:'bilinmeyen hata')+' · rollback '+(failedRollback.length?'KISMİ':'OK'));
    }
  }
  clearCheckpoint(task);clearJournal(task);
  return{ok:true,message:'Plan doğrulandı · '+plan.steps.length+' adım · kesintiden devam koruması aktif',steps:results,resumedFrom:startAt};
}
function createBundle(name,description){
  const dir=safeFile(name);
  const existed=fs.existsSync(dir);
  fs.mkdirSync(dir,{recursive:true});
  const created=[];
  try{
    const files={
      'README.md':'# '+path.basename(dir)+'\n\n'+description+'\n',
      'TASKS.md':'# Tasks\n\n- [ ] İlk hedefi tanımla\n- [ ] Uygulamayı geliştir\n- [ ] Doğrulama testlerini çalıştır\n',
      '.gitignore':'node_modules/\n.env\n.env.*\n.DS_Store\n'
    };
    for(const [rel,data] of Object.entries(files)){
      const target=path.join(dir,rel);
      if(!fs.existsSync(target)){fs.writeFileSync(target,data,'utf8');created.push(target)}
    }
    for(const rel of Object.keys(files)){
      const target=path.join(dir,rel);
      if(!fs.existsSync(target)||!fs.statSync(target).isFile())throw new Error('Doğrulama başarısız: '+rel);
    }
    return{ok:true,message:'Proje paketi doğrulandı: '+path.relative(WORKSPACE,dir)+' · '+Object.keys(files).join(', ')};
  }catch(e){
    for(const file of created.reverse()){try{fs.unlinkSync(file)}catch(_){}}
    if(!existed){try{fs.rmdirSync(dir)}catch(_){}}
    throw e;
  }
}
function startDetached(exe,args=[]){
  const p=childProcess.spawn(exe,args,{detached:true,windowsHide:false,stdio:'ignore'});
  p.unref();
}
function openDefaultUrl(url){
  childProcess.spawn('cmd.exe',['/c','start','','"'+url+'"'],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
}
function firstExisting(paths){
  for(const p of paths)try{if(p&&fs.existsSync(p))return p}catch(_){}
  return null;
}
function sendWindowsMediaKey(vk,presses=1){
  if(process.platform!=='win32')throw new Error('Windows media control only');
  const count=Math.max(1,Math.min(12,Number(presses)||1));
  const ps=[
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; namespace Jarvis { public static class Keys { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); } }' -ErrorAction SilentlyContinue",
    "$vk="+Number(vk),
    "1.."+count+" | ForEach-Object { [Jarvis.Keys]::keybd_event([byte]$vk,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 35; [Jarvis.Keys]::keybd_event([byte]$vk,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 45 }"
  ].join('; ');
  childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536});
}
function windowsPowerStatus(){
  if(process.platform!=='win32')return{ok:false,message:'Güç durumu şu anda Windows için etkin'};
  let battery=null;
  try{
    const ps="Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress";
    const raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:65536}).trim();
    if(raw)battery=JSON.parse(raw);
  }catch(_){}
  const free=Math.round(os.freemem()/1073741824*10)/10;
  const total=Math.round(os.totalmem()/1073741824*10)/10;
  const uptimeMin=Math.round(os.uptime()/60);
  const cpu=os.cpus()&&os.cpus()[0]?String(os.cpus()[0].model||'CPU').replace(/\s+/g,' ').trim():'CPU';
  const parts=['RAM '+free+' / '+total+' GB boş','çalışma süresi '+uptimeMin+' dakika',cpu];
  if(battery&&Number.isFinite(Number(battery.EstimatedChargeRemaining)))parts.unshift('pil %'+Number(battery.EstimatedChargeRemaining));
  else parts.unshift('pil bilgisi alınamadı');
  return{ok:true,message:'PC güç durumu · '+parts.join(' · ')};
}
function isSensitiveWorkspacePath(rel){
  const s=String(rel||'').replace(/\\/g,'/').toLocaleLowerCase('tr-TR');
  const base=path.basename(s);
  if(s.includes('/.git/')||s.includes('/node_modules/')||s.includes('/.jarvis-memory/'))return true;
  if(/(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|private[-_]?key(?:\..*)?|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$/i.test(s))return true;
  if(/(?:token|password|passwd|apikey|api_key|secret)[-_]?(?:backup|dump|export)?\.(?:txt|json|log|csv)$/i.test(base))return true;
  return false;
}
function workspaceSearchHits(query,{limit=5,maxScanned=220,maxDepth=5}={}){
  const raw=String(query||'').replace(/\s+/g,' ').trim();
  const tokens=[...new Set(raw.toLocaleLowerCase('tr-TR').split(/[^a-z0-9çğıöşüı._-]+/i).filter(x=>x.length>=2))]
    .filter(x=>!['nedir','nasil','nasıl','icin','için','bana','bir','ile','olan','son','devam'].includes(x))
    .slice(0,14);
  if(!tokens.length)return{raw,tokens,hits:[],scanned:0};

  const allowedExt=new Set(['.txt','.md','.json','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.csv','.html','.css','.yml','.yaml','.log']);
  const hits=[];
  let scanned=0;
  const walk=(dir,depth=0)=>{
    if(depth>maxDepth||scanned>=maxScanned)return;
    let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch(_){return}
    for(const e of entries){
      if(scanned>=maxScanned)break;
      const full=path.join(dir,e.name);
      const rel=path.relative(WORKSPACE,full);
      if(isSensitiveWorkspacePath(rel))continue;
      if(e.name==='.jarvis-memory'||e.name==='node_modules'||e.name==='.git')continue;
      if(e.isDirectory()){walk(full,depth+1);continue}
      if(!e.isFile()||!allowedExt.has(path.extname(e.name).toLowerCase()))continue;
      scanned++;
      let stat;try{stat=fs.statSync(full)}catch(_){continue}
      if(stat.size>1024*1024)continue;
      let data;try{data=fs.readFileSync(full,'utf8')}catch(_){continue}
      if(/(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]|api[_ -]?key\s*[:=])/i.test(data.slice(0,12000)))continue;

      const lower=data.toLocaleLowerCase('tr-TR');
      const relLower=rel.toLocaleLowerCase('tr-TR');
      let score=0,first=-1,matched=0;
      for(const t of tokens){
        let idx=0,count=0;
        if(relLower.includes(t)){score+=5;matched++}
        while((idx=lower.indexOf(t,idx))!==-1&&count<8){
          if(first<0||idx<first)first=idx;
          count++;idx+=t.length;
        }
        if(count){score+=Math.min(8,count);matched++}
      }
      if(!score)continue;
      // Favor files matching multiple distinct query tokens.
      score+=matched*2;
      const pos=Math.max(0,first);
      const snipStart=Math.max(0,pos-180),snipEnd=Math.min(data.length,pos+620);
      const snippet=data.slice(snipStart,snipEnd).replace(/\s+/g,' ').trim();
      hits.push({score,matched,path:rel,snippet});
    }
  };
  walk(WORKSPACE,0);
  hits.sort((a,b)=>b.score-a.score||b.matched-a.matched||a.path.localeCompare(b.path));
  return{raw,tokens,hits:hits.slice(0,Math.max(1,limit)),scanned};
}
function searchWorkspaceText(query){
  const found=workspaceSearchHits(query,{limit:5});
  if(!found.tokens.length)return{ok:false,message:'Arama ifadesi boş.'};
  if(!found.hits.length)return{ok:true,message:'Çalışma alanında "'+found.raw+'" için eşleşme bulamadım.'};
  return{
    ok:true,
    message:'Çalışma alanı araması · '+found.hits.length+' sonuç: '+found.hits.map((x,i)=>(i+1)+') '+x.path+' — '+x.snippet).join(' | ')
  };
}
function shouldUseWorkspaceContext(query){
  const s=String(query||'').toLocaleLowerCase('tr-TR');
  if(/\b(?:dosya|workspace|çalışma alanı|calisma alani|repo|kod|proje|readme|notlar|notlarım|notlarim)\b/.test(s))return true;
  if(/\b(?:varova|fikir2app|lifecv|hakkım ai|hakkim ai|raporasistan|aynı hamurdan|ayni hamurdan|sentrya|pati alan|zeka aynası|zeka aynasi|yolzeka)\b/.test(s))return true;
  if(isContextRecallQuery(query)&&/\b(?:proje|iş|is|kod|uygulama|site)\b/.test(s))return true;
  return false;
}
function workspaceBrainContext(query,limit=3){
  if(!shouldUseWorkspaceContext(query))return{context:'',sources:[]};
  const found=workspaceSearchHits(query,{limit,maxScanned:180,maxDepth:5});
  const useful=found.hits.filter(x=>x.score>=5).slice(0,limit);
  if(!useful.length)return{context:'',sources:[]};
  const context=useful.map((x,i)=>'KAYNAK '+(i+1)+' ['+x.path+']: '+x.snippet.slice(0,720)).join('\n');
  return{context,sources:useful.map(x=>x.path)};
}

function openKnownDesktopTarget(raw){
  if(process.platform!=='win32')return{ok:false,message:'Masaüstü açma komutları şu anda Windows için etkin'};
  let key=String(raw||'').toLocaleLowerCase('tr-TR').trim()
    .replace(/\s+/g,' ')
    .replace(/^(?:uygulama|program|site)\s+/,'')
    .replace(/\s+(?:uygulamasını|uygulamasini|programını|programini|sitesini)$/,'')
    .replace(/['’](?:y)?[ıiuü]$/,'')
    .trim();

  const appAliases={
    'hesap makinesini':'hesap makinesi',
    'not defterini':'not defteri',
    'dosya gezginini':'dosya gezgini',
    'görev yöneticisini':'görev yöneticisi',
    'gorev yoneticisini':'gorev yoneticisi',
    'çalışma alanını':'çalışma alanı',
    'calisma alanini':'calisma alani'
  };
  key=appAliases[key]||key;

  const urls={
    'youtube':'https://www.youtube.com/',
    'google':'https://www.google.com/',
    'github':'https://github.com/',
    'chatgpt':'https://chatgpt.com/'
  };
  if(urls[key]){openDefaultUrl(urls[key]);return{ok:true,message:key+' açıldı'}}

  const settingsUris={
    'ayarlar':'ms-settings:',
    'settings':'ms-settings:',
    'ses ayarları':'ms-settings:sound',
    'ses ayarlari':'ms-settings:sound',
    'bluetooth ayarları':'ms-settings:bluetooth',
    'bluetooth ayarlari':'ms-settings:bluetooth',
    'wifi ayarları':'ms-settings:network-wifi',
    'wi-fi ayarları':'ms-settings:network-wifi',
    'wifi ayarlari':'ms-settings:network-wifi'
  };
  if(settingsUris[key]){
    childProcess.spawn('cmd.exe',['/c','start','',settingsUris[key]],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
    return{ok:true,message:key+' açıldı'};
  }

  if(['tarayıcı','tarayici','browser','internet'].includes(key)){
    openDefaultUrl('https://www.google.com/');
    return{ok:true,message:'Varsayılan tarayıcı açıldı'};
  }
  if(['çalışma alanı','calisma alani','workspace','jarvis workspace'].includes(key)){
    startDetached('explorer.exe',[WORKSPACE]);
    return{ok:true,message:'JARVIS çalışma alanı açıldı'};
  }

  const builtins={
    'not defteri':['notepad.exe',[]],
    'notepad':['notepad.exe',[]],
    'hesap makinesi':['calc.exe',[]],
    'calculator':['calc.exe',[]],
    'dosya gezgini':['explorer.exe',[]],
    'gezgin':['explorer.exe',[]],
    'görev yöneticisi':['taskmgr.exe',[]],
    'gorev yoneticisi':['taskmgr.exe',[]],
    'paint':['mspaint.exe',[]],
    'powershell':['powershell.exe',[]],
    'terminal':['powershell.exe',[]]
  };
  if(builtins[key]){
    startDetached(builtins[key][0],builtins[key][1]);
    return{ok:true,message:key+' açıldı'};
  }

  const home=os.homedir();
  const browserCandidates={
    'opera gx':[
      path.join(home,'AppData','Local','Programs','Opera GX','launcher.exe'),
      path.join(home,'AppData','Local','Programs','Opera GX','opera.exe'),
      'C:\\Program Files\\Opera GX\\launcher.exe',
      'C:\\Program Files\\Opera GX\\opera.exe'
    ],
    'chrome':[
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(home,'AppData','Local','Google','Chrome','Application','chrome.exe')
    ],
    'edge':[
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ]
  };
  if(browserCandidates[key]){
    const exe=firstExisting(browserCandidates[key]);
    if(!exe)return{ok:false,message:key+' bilgisayarda bulunamadı'};
    startDetached(exe,[]);
    return{ok:true,message:key+' açıldı'};
  }

  return{ok:false,message:'Bu uygulama güvenli açma listesinde yok: '+raw};
}
async function execute(task){
  if(task.plan)return runPlan(task);
  const c=String(task.command||'').trim().replace(/^(pc|bilgisayar)\s*:\s*/i,'');
  if(/^(optimizasyonu uygula|optimizasyon uygula|apply optimization)/i.test(c)){
    const e=evaluateStrategyPolicy(),a=e.policy.active;
    return{ok:true,message:(e.rolledBack?'ROLLBACK · ':e.changed?'POLICY UPDATE · ':'NO CHANGE · ')+e.reason+(a?' · aktif '+a.action+' · skor '+a.score:' · aktif strateji yok')};
  }
  if(/^(optimizasyon durumu|strategy selection|en iyi strateji)/i.test(c)){
    const s=strategySelection();
    if(!s.recommended)return{ok:true,message:'Optimizasyon için yeterli kanıt yok · her strateji için en az '+s.minimumEvidence+' deneme gerekli'};
    const r=s.recommended;
    return{ok:true,message:'Kanıta dayalı öneri · '+r.action+' · '+r.attempts+' deneme · başarı '+Math.round(r.successRate*100)+'% · skor '+r.score+' · otomatik kod değişikliği yapılmadı'};
  }
  if(/^(öğrenme durumu|ogrenme durumu|strategy metrics|learning status)/i.test(c)){
    const m=strategyMetrics();
    const actions=Object.entries(m.byAction).map(([k,v])=>k+': '+v.successes+'/'+v.attempts+' başarılı').join(' · ');
    return{ok:true,message:'Strateji ölçümü · '+m.steps+' adım · '+m.repairs+' repair · '+m.successes+' başarılı · '+m.failures+' başarısız'+(actions?' · '+actions:' · henüz yeterli veri yok')};
  }
  if(/^(hafıza durumu|hafiza durumu|memory status)/i.test(c)){
    const s=memoryStats();
    return{ok:true,message:'Yerel kalıcı hafıza aktif · '+s.records+' kayıt · '+s.bytes+' bayt · '+MEMORY_FILE};
  }
  if(/^(yerel ai durumu|local ai status|ai readiness)/i.test(c)){
    const bins=['tesseract','ollama'];
    const found=[];
    for(const bin of bins){
      try{
        const cmd=process.platform==='win32'?'where.exe':'which';
        const out=childProcess.execFileSync(cmd,[bin],{encoding:'utf8',windowsHide:true,timeout:3000,maxBuffer:65536}).trim();
        if(out)found.push(bin);
      }catch(e){}
    }
    return{ok:true,message:'Yerel AI hazırlık · OCR '+(found.includes('tesseract')?'READY':'NOT INSTALLED')+' · VISION '+(found.includes('ollama')?'RUNTIME FOUND':'NOT INSTALLED')+' · yalnızca yerel binary kontrolü'};
  }
  if(/^(sistem durumu|system status|pc durumu)/i.test(c)){
    return{ok:true,message:'PC aktif · '+os.platform()+' '+os.release()+' · Node '+process.version+' · RAM '+Math.round(os.freemem()/1024/1024)+'MB boş'};
  }
  if(/^(işlemleri listele|islemleri listele|process list|çalışan işlemler|calisan islemler)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Process list şu anda Windows için etkin'};
    const out=childProcess.execFileSync('tasklist.exe',['/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:512*1024});
    const rows=out.split(/\r?\n/).filter(Boolean).slice(0,40).map(x=>x.replace(/^"|"$/g,'').split('","').slice(0,2).join(' #'));
    return{ok:true,message:'Çalışan işlemler (ilk '+rows.length+'): '+rows.join(' · ')};
  }
  if(/^(disk durumu|disk status|depolama durumu)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Disk status şu anda Windows için etkin'};
    const ps='Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress';
    const raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:256*1024}).trim();
    const data=raw?JSON.parse(raw):[]; const list=Array.isArray(data)?data:[data];
    return{ok:true,message:list.map(d=>d.DeviceID+' '+Math.round(Number(d.FreeSpace||0)/1073741824)+'GB boş / '+Math.round(Number(d.Size||0)/1073741824)+'GB').join(' · ')||'Yerel disk bulunamadı'};
  }
  if(/^(wake on lan durumu|wol durumu|uzaktan açma durumu|uzaktan acma durumu|wake on lan readiness)/i.test(c)){
    if(process.platform!=='win32')return{ok:false,retryable:false,message:'Wake-on-LAN readiness şu anda Windows için etkin'};
    const ps="$ad=Get-CimInstance Win32_NetworkAdapter -Filter \"PhysicalAdapter=True\" | Where-Object {$_.MACAddress -and $_.NetEnabled} | Select-Object -First 5 Name,MACAddress,NetConnectionID; $ad | ConvertTo-Json -Compress";
    let raw='';
    try{raw=childProcess.execFileSync('powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:256*1024}).trim()}catch(e){}
    const data=raw?JSON.parse(raw):[];const list=Array.isArray(data)?data:[data];
    const adapters=list.filter(Boolean).map(x=>(x.NetConnectionID||x.Name||'Adapter')+' '+x.MACAddress);
    return{ok:true,message:'WoL ön kontrol · aktif fiziksel ağ adaptörü: '+(adapters.join(' · ')||'bulunamadı')+' · BIOS/UEFI ve adaptör wake ayarı ayrıca doğrulanmalı · PC kapalıyken magic packet gönderecek sürekli açık LAN köprüsü henüz bağlı değil'};
  }
  if(/^(ağ durumu|ag durumu|network status|internet durumu)/i.test(c)){
    const nets=os.networkInterfaces(),active=[];
    for(const [name,arr] of Object.entries(nets))for(const x of (arr||[]))if(!x.internal&&x.family==='IPv4')active.push(name+' '+x.address);
    return{ok:true,message:'Ağ arayüzleri: '+(active.join(' · ')||'aktif IPv4 arayüzü bulunamadı')};
  }
  // JARVIS_MEDIA_CONTROL_V1
  if(/^(?:sesi yükselt|sesi yukselt|ses yükselt|ses yukselt|sesi artır|sesi arttır|ses artır|volume up)$/i.test(c)){
    sendWindowsMediaKey(0xAF,4);
    return{ok:true,message:'Ses yükseltildi'};
  }
  if(/^(?:sesi azalt|ses azalt|sesi kıs|sesi kis|ses kıs|ses kis|volume down)$/i.test(c)){
    sendWindowsMediaKey(0xAE,4);
    return{ok:true,message:'Ses azaltıldı'};
  }
  if(/^(?:sessize al|sesi kapat|sesi sustur|mute|sesi aç|sesi ac|unmute)$/i.test(c)){
    sendWindowsMediaKey(0xAD,1);
    return{ok:true,message:'Ses mute durumu değiştirildi'};
  }
  if(/^(?:oynat|duraklat|devam ettir|oynat duraklat|play pause|play|pause)$/i.test(c)){
    sendWindowsMediaKey(0xB3,1);
    return{ok:true,message:'Medya oynat/duraklat komutu gönderildi'};
  }
  if(/^(?:sonraki|sonraki şarkı|sonraki sarki|sonraki medya|next track)$/i.test(c)){
    sendWindowsMediaKey(0xB0,1);
    return{ok:true,message:'Sonraki medya komutu gönderildi'};
  }
  if(/^(?:önceki|onceki|önceki şarkı|onceki sarki|previous track)$/i.test(c)){
    sendWindowsMediaKey(0xB1,1);
    return{ok:true,message:'Önceki medya komutu gönderildi'};
  }
  if(/^(?:medyayı durdur|medyayi durdur|stop media)$/i.test(c)){
    sendWindowsMediaKey(0xB2,1);
    return{ok:true,message:'Medya durduruldu'};
  }
  if(/^(?:pil durumu|batarya durumu|güç durumu|guc durumu|power status)$/i.test(c)){
    return windowsPowerStatus();
  }

  const wsSearch=c.match(/^(?:dosyalarda ara|dosyalarda arat|workspace search)\s+(.+)$/i);
  if(wsSearch){
    const r=searchWorkspaceText(wsSearch[1]);
    return{ok:!!r.ok,retryable:false,message:r.message};
  }

  const openTarget=c.match(/^(?:aç|ac|open|uygulama aç|uygulama ac|program aç|program ac|site aç|site ac)\s+(.+)$/i)
    || c.match(/^(.+?)\s+(?:aç|ac)$/i);
  if(openTarget){
    const r=openKnownDesktopTarget(openTarget[1]);
    return{ok:!!r.ok,retryable:false,message:r.message};
  }

  if(/^(?:browser operatör durumu|browser operator durumu|browser operator status)$/i.test(c)){
    const s=await getBrowserOperator().status(WORKSPACE);
    return{
      ok:true,
      message:'Browser Operator · '+(s.running?'ONLINE':'OFFLINE')+' · '+(s.browser||'tarayıcı bulunamadı')+' · profil '+s.profile+' · '+s.tabs.length+' sekme'
    };
  }

  if(/^(?:browser profilini aç|browser profilini ac|browser operator aç|browser operator ac)$/i.test(c)){
    const s=await getBrowserOperator().start(WORKSPACE,{url:'https://studio.youtube.com/'});
    return{
      ok:true,
      message:'JARVIS özel browser profili açıldı · '+s.browser+' · ilk kullanımda YouTube/Shopify oturumlarını bu profilde bir kez açabilirsiniz'
    };
  }

  if(/^(?:youtube studio aç|youtube studio ac)$/i.test(c)){
    const s=await getBrowserOperator().start(WORKSPACE,{url:'https://studio.youtube.com/'});
    return{ok:true,message:'YouTube Studio JARVIS browser profilinde açıldı · '+s.browser};
  }

  if(/^(?:youtube yükleme durumu|youtube yukleme durumu|youtube taslak durumu|youtube upload status)$/i.test(c)){
    const out=await getYoutubeStudio().status(getBrowserOperator(),WORKSPACE);
    return{ok:true,message:out.message};
  }

  const youtubeDraft=c.match(/^(?:youtube taslak yükle|youtube taslak yukle|youtube studio taslak yükle|youtube studio taslak yukle)\s+([\s\S]+)$/i);
  if(youtubeDraft){
    const spec=getYoutubeStudio().parseUploadSpec(youtubeDraft[1]);
    if(!spec||!spec.file)return{ok:false,retryable:false,message:'YouTube taslak yükleme için video dosyası gerekli.'};
    const out=await getYoutubeStudio().prepareDraft(getBrowserOperator(),WORKSPACE,spec);
    return{ok:!!out.ok,retryable:out.retryable===true,message:out.message};
  }

  if(/^(?:shopify admin aç|shopify admin ac)$/i.test(c)){
    const s=await getBrowserOperator().start(WORKSPACE,{url:'https://admin.shopify.com/'});
    return{ok:true,message:'Shopify Admin JARVIS browser profilinde açıldı · '+s.browser};
  }

  if(/^(?:browser sayfasını oku|browser sayfasini oku|browser sayfasını analiz et|browser sayfasini analiz et)$/i.test(c)){
    const snap=await getBrowserOperator().pageSnapshot(WORKSPACE);
    const text=String(snap.text||'').replace(/\s+/g,' ').slice(0,1800);
    return{ok:true,message:'Aktif JARVIS browser sayfası · '+snap.title+' · '+snap.url+' · '+text};
  }

  if(/^(?:jarvis testi|jarvis test|pc kabul testi|pc acceptance|bilgisayar testi|hazır mısın|hazir misin)$/i.test(c)){
    const snapshot=await buildPcAcceptanceSnapshot();
    return{ok:true,retryable:false,message:acceptanceSummaryText(snapshot)};
  }

  if(/^(?:jarvis kendini düzelt|jarvis kendini duzelt|jarvis onar|pc onar|sistemi onar|self repair)$/i.test(c)){
    const out=await repairLocalRuntime();
    return{ok:!!out.ok,retryable:false,message:repairSummaryText(out)};
  }

  if(/^(?:mağaza durumu|magaza durumu|shopify durumu|shopify status|varova mağaza durumu|varova magaza durumu)$/i.test(c)){
    const st=await getCommerceEngine().status(WORKSPACE);
    return{ok:!!st.ok,retryable:false,message:st.message};
  }

  if(/^(?:shopify bağlantısını kur|shopify baglantisini kur|mağaza bağlantısını kur|magaza baglantisini kur|shopify bağla|shopify bagla)$/i.test(c)){
    return openShopifyConnectWindow();
  }

  const localProductJson=c.match(/^(?:ürün taslağını hazırla|urun taslagini hazirla|yerel ürün taslağı oluştur|yerel urun taslagi olustur)\s*:\s*(\{[\s\S]+\})$/i);
  if(localProductJson){
    let product;
    try{product=JSON.parse(localProductJson[1])}catch(e){return{ok:false,retryable:false,message:'Ürün JSON okunamadı: '+e.message}}
    try{
      const out=getCommerceEngine().saveLocalDraft(WORKSPACE,product);
      return{ok:true,message:out.message};
    }catch(e){return{ok:false,retryable:false,message:'Ürün taslağı hazırlanamadı: '+e.message}}
  }

  const shopifyDraftJson=c.match(/^(?:shopify ürün taslağı ekle|shopify urun taslagi ekle|mağazaya taslak ürün ekle|magazaya taslak urun ekle|varova taslak ürün ekle|varova taslak urun ekle)\s*:\s*(\{[\s\S]+\})$/i);
  if(shopifyDraftJson){
    let product;
    try{product=JSON.parse(shopifyDraftJson[1])}catch(e){return{ok:false,retryable:false,message:'Ürün JSON okunamadı: '+e.message}}
    try{
      const out=await getCommerceEngine().createDraft(WORKSPACE,product);
      return{ok:true,message:out.message+' · yayınlanmadı; DRAFT olarak bırakıldı'};
    }catch(e){
      const m=e.message==='SHOPIFY_NOT_CONNECTED'
        ?'Shopify yerel bağlantısı kurulmamış. "Shopify bağlantısını kur" diyerek tek seferlik güvenli bağlantıyı açın.'
        :'Shopify ürün taslağı oluşturulamadı: '+e.message;
      return{ok:false,retryable:false,message:m};
    }
  }

  const shopifyDraftPipe=c.match(/^(?:shopify ürün taslağı ekle|shopify urun taslagi ekle|mağazaya taslak ürün ekle|magazaya taslak urun ekle|varova taslak ürün ekle|varova taslak urun ekle)\s+(.+)$/i);
  if(shopifyDraftPipe){
    try{
      const product=getCommerceEngine().parseKeyValueProduct(shopifyDraftPipe[1]);
      const out=await getCommerceEngine().createDraft(WORKSPACE,product);
      return{ok:true,message:out.message+' · yayınlanmadı; DRAFT olarak bırakıldı'};
    }catch(e){
      const m=e.message==='SHOPIFY_NOT_CONNECTED'
        ?'Shopify yerel bağlantısı kurulmamış. "Shopify bağlantısını kur" diyerek tek seferlik güvenli bağlantıyı açın.'
        :'Shopify ürün taslağı oluşturulamadı: '+e.message;
      return{ok:false,retryable:false,message:m};
    }
  }

  const shopifyPublish=c.match(/^(?:shopify ürünü yayınla|shopify urunu yayinla|ürünü yayınla|urunu yayinla|mağazada yayınla|magazada yayinla)\s+(gid:\/\/shopify\/Product\/\d+)$/i);
  if(shopifyPublish){
    try{
      const out=await getCommerceEngine().publishProduct(WORKSPACE,shopifyPublish[1]);
      return{ok:true,message:out.message};
    }catch(e){
      const m=e.message==='SHOPIFY_NOT_CONNECTED'
        ?'Shopify yerel bağlantısı kurulmamış.'
        :'Ürün yayınlanamadı: '+e.message;
      return{ok:false,retryable:false,message:m};
    }
  }

  if(/^(?:creator motor durumu|creator engine status|video motor durumu)$/i.test(c)){
    const s=getCreatorEngine().ffmpegStatus(WORKSPACE);
    return{
      ok:true,
      message:'Creator motoru · FFmpeg '+(s.ok?'READY':'MISSING')+' · '+s.assets+' yerel klip · '+s.assetDir+(s.ok?'':' · gerekirse otomatik ücretsiz kurulum kullanılabilir')
    };
  }

  if(/^(?:creator motorunu hazırla|creator motorunu hazirla|creator engine hazırla|creator engine hazirla)$/i.test(c)){
    const s=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
    return{
      ok:!!s.ok,
      retryable:false,
      message:s.ok
        ?'Creator motoru hazır · FFmpeg doğrulandı · çıktı: '+s.outputDir
        :'Creator motoru hazırlanamadı · FFmpeg bulunamadı ve otomatik kurulum kullanılamadı'
    };
  }

  const creatorVideo=c.match(/^(?:shorts oluştur|shorts olustur|video oluştur|video olustur)(?:\s+([^:]+))?\s*:\s*([\s\S]+)$/i);
  if(creatorVideo){
    const requestedName=(creatorVideo[1]||('short-'+Date.now())).trim();
    const narration=String(creatorVideo[2]||'').trim();
    const ready=getCreatorEngine().prepare(WORKSPACE,{allowInstall:true});
    if(!ready.ok)return{ok:false,retryable:false,message:'Creator motoru hazır değil · FFmpeg kurulamadı'};
    const voice=await renderCreatorVoiceFile(narration,requestedName+'-voice');
    const out=getCreatorEngine().renderShort({
      workspace:WORKSPACE,
      name:requestedName,
      script:narration,
      voicePath:voice
    });
    return{
      ok:true,
      message:out.message+' · altyazı dosyası: '+out.subtitle
    };
  }

  const creatorVoice=c.match(/^(?:creator sesi oluştur|creator sesi olustur|video sesi oluştur|video sesi olustur|shorts sesi oluştur|shorts sesi olustur)(?:\s+([^:]+))?\s*:\s*([\s\S]+)$/i);
  if(creatorVoice){
    const requestedName=(creatorVoice[1]||('creator-'+Date.now())).trim();
    const out=await renderCreatorVoiceFile(creatorVoice[2],requestedName);
    return{ok:true,message:'Creator anlatım sesi hazır: '+out+' · profil CINEMATIC_CREATOR · Emel'};
  }

  if(/^(dosyaları listele|dosya listesi|list files)/i.test(c)){
    return{ok:true,message:'Workspace: '+(listFiles().join(', ')||'(boş)')};
  }
  const bundle=c.match(/^(?:proje paketi oluştur|proje paketi olustur|workspace bundle)\s+([^:]+)(?::\s*(.*))?$/i);
  if(bundle){
    return createBundle(bundle[1],(bundle[2]||'JARVIS tarafından oluşturulan ve doğrulanan proje çalışma alanı.').trim());
  }
  const folder=c.match(/^(?:klasör oluştur|klasor olustur|make folder|proje klasörü oluştur|proje klasoru olustur)\s+(.+)$/i);
  if(folder){
    const dir=safeFile(folder[1]);
    fs.mkdirSync(dir,{recursive:true});
    return{ok:true,message:'Klasör hazırlandı: '+path.relative(WORKSPACE,dir)};
  }
  const project=c.match(/^(?:proje oluştur|proje olustur|yeni proje|project create)\s+([^:]+)(?::\s*(.*))?$/i);
  if(project){
    const dir=safeFile(project[1]);
    fs.mkdirSync(dir,{recursive:true});
    const readme=path.join(dir,'README.md');
    const desc=(project[2]||'JARVIS tarafından oluşturulan yerel proje.').trim();
    if(!fs.existsSync(readme))fs.writeFileSync(readme,'# '+path.basename(dir)+'\n\n'+desc+'\n','utf8');
    return{ok:true,message:'Proje klasörü hazırlandı: '+path.relative(WORKSPACE,dir)+' · README.md oluşturuldu'};
  }
  const write=c.match(/^(?:dosya oluştur|dosya olustur|write file)\s+([^:]+)\s*:\s*([\s\S]+)$/i);
  if(write){
    const file=safeFile(write[1]);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,write[2],'utf8');
    return{ok:true,message:'Dosya oluşturuldu: '+path.relative(WORKSPACE,file)+' · '+Buffer.byteLength(write[2],'utf8')+' bayt'};
  }
  const read=c.match(/^(?:dosya oku|read file)\s+(.+)$/i);
  if(read){
    const file=safeFile(read[1]);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return{ok:false,retryable:false,message:'Dosya bulunamadı: '+read[1]};
    const data=fs.readFileSync(file,'utf8');
    return{ok:true,message:'Dosya '+path.relative(WORKSPACE,file)+': '+data.slice(0,4000)};
  }
  const m=c.match(/^not al\s+(.+)/i);
  if(m){
    const file=path.join(WORKSPACE,'notes.md');
    fs.appendFileSync(file,'- '+new Date().toISOString()+' '+m[1]+'\n');
    return{ok:true,message:'Not kaydedildi: notes.md'};
  }
  return{ok:false,retryable:false,message:'Bu görev henüz güvenli PC araç kataloğunda yok; tamamlandı sayılmadı.'};
}
async function recoverTransactionJournals(){
  let files=[];try{files=fs.readdirSync(JOURNAL_DIR).filter(x=>x.endsWith('.json')).slice(0,50)}catch(e){return}
  for(const name of files){
    try{
      const j=JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR,name),'utf8')),t=j.task;
      if(!t||!t.uid||!t.command||!t.plan)continue;
      const consistency=journalConsistency(t);
      if(!consistency.ok){
        remember({kind:'transaction_recovery_blocked',taskUid:t.uid,conflicts:consistency.conflicts});
        console.error('[JARVIS] Transaction dış değişiklik nedeniyle durduruldu:',t.uid);continue;
      }
      const cp=readCheckpoint(t),expectedHash=planHash(t.plan);
      if(cp.planVersion===t.plan.version&&cp.planHash===expectedHash&&Number.isInteger(cp.nextStep)){
        const prefix=verifyPlanPrefix(t.plan,Math.max(0,Math.min(cp.nextStep,t.plan.steps.length)));
        if(!prefix.ok){remember({kind:'transaction_recovery_blocked',taskUid:t.uid,reason:'prefix mismatch',steps:prefix.failures});continue}
        await api('/api/worker/rehydrate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t)});
        remember({kind:'transaction_resume_ready',taskUid:t.uid,nextStep:cp.nextStep,planHash:expectedHash});
      }else{
        const rb=rollbackJournal(t);
        if(rb.every(x=>x.ok)){clearJournal(t);clearCheckpoint(t)}
      }
    }catch(e){remember({kind:'transaction_recovery_error',file:name,error:e.message})}
  }
}
async function rehydrateCheckpoints(){
  let files=[];try{files=fs.readdirSync(CHECKPOINT_DIR).filter(x=>x.endsWith('.json')).slice(0,50)}catch(e){return}
  for(const name of files){
    try{
      const cp=JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR,name),'utf8')),t=cp.task;
      if(!t||!t.uid||!t.command||!t.plan)continue;
      await api('/api/worker/rehydrate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t)});
    }catch(e){}
  }
}
async function syncCloudState(){
  try{
    const s=await api('/api/state/snapshot');
    if(s.schemaVersion!==3||!Number.isSafeInteger(s.revision)||!s.signature)throw new Error('İmzalı Cloud snapshot v3 doğrulanamadı');
    let local=null;try{local=JSON.parse(fs.readFileSync(CLOUD_STATE_FILE,'utf8'))}catch(e){}
    if(local&&Number.isSafeInteger(local.revision)&&local.revision>s.revision)return;
    const tmp=CLOUD_STATE_FILE+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(s),'utf8');fs.renameSync(tmp,CLOUD_STATE_FILE);
  }catch(e){}
}
async function tryRestoreCloudState(){
  if(!fs.existsSync(CLOUD_STATE_FILE))return;
  try{
    const s=JSON.parse(fs.readFileSync(CLOUD_STATE_FILE,'utf8'));
    if(s.schemaVersion!==3||!s.signature){remember({kind:'state_restore_refused',reason:'unsigned_or_legacy_snapshot'});return}
    await api('/api/state/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)});
    console.log('[JARVIS] Cloud state yerel snapshot ile geri yüklendi.');
  }catch(e){
    if(!/not empty|approved device required|device awaiting approval/i.test(e.message))console.error('[JARVIS] State restore:',e.message);
  }
}
let lastStateSync=0;
let restoreAttempted=false;
let lastAuthRecovery=0;
let phoneSessionCodeShown=false;
let mobileTtsBusy=false;
let mobileBrainBusy=false;
async function serviceMobileTts(){
  if(mobileTtsBusy)return false;
  mobileTtsBusy=true;
  try{
    const r=await api('/api/worker/mobile-tts-next');
    if(!r||!r.request)return false;
    const q=r.request;
    try{
      const audio=await renderJarvisMp3Base64(q.text,q.tone||'balanced');
      await api('/api/worker/mobile-tts-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:true,audio})
      });
      console.log('[JARVIS] MOBILE TTS READY: '+q.id+' tone='+(q.tone||'balanced'));
    }catch(e){
      await api('/api/worker/mobile-tts-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})
      }).catch(()=>{});
      console.error('[JARVIS] MOBILE TTS:',e.message);
    }
    return true;
  }catch(e){
    if(!/404|not found/i.test(String(e.message||'')))console.error('[JARVIS] MOBILE TTS POLL:',e.message);
    return false;
  }finally{
    mobileTtsBusy=false;
  }
}
async function serviceMobileBrain(){
  if(mobileBrainBusy)return false;
  mobileBrainBusy=true;
  try{
    const r=await api('/api/worker/mobile-brain-next');
    if(!r||!r.request)return false;
    const q=r.request;
    try{
      let result=await runNativeAgent(q.message,{maxRounds:4});
      if(!result||result.ok!==true){
        result=await callLocalBrain(q.message);
      }
      if(!result||result.ok!==true)throw new Error(result&&result.error||'local brain failed');

      if(result.type==='plan'&&Array.isArray(result.commands)&&result.commands.length){
        const actionResults=[];
        let allOk=true;
        for(const command of result.commands.slice(0,4)){
          if(!isLocalSafeControlCommand(command)){allOk=false;actionResults.push({ok:false,message:'Güvenli olmayan adım engellendi: '+command});break}
          const action=await execute({command});
          actionResults.push(action||{ok:false,message:command+' sonucu alınamadı'});
          if(!action||!action.ok){allOk=false;break}
        }
        const summary=actionResults.map(x=>String(x&&x.message||'')).filter(Boolean).join('. ');
        const final=await finalizeToolReply(
          q.message,
          actionResults.map(x=>String(x&&x.message||'')).filter(Boolean),
          allOk?String(result.tone||'focused'):'warm'
        );
        result={
          ok:true,
          type:'chat',
          reply:String(final&&final.reply||summary||result.reply||'Plan işlendi.'),
          command:null,
          commands:result.commands.slice(0,4),
          executed:allOk,
          actionResults,
          model:result.model,
          finalizerModel:final&&final.model||null,
          reflected:!!(final&&final.reflected),
          tone:String(final&&final.tone||(allOk?result.tone||'focused':'warm')),
          memoryHits:result.memoryHits||0,
          personaVersion:result.personaVersion||2
        };
      }else if(result.type==='command'&&result.command){
        const action=await execute({command:result.command});
        const raw=String(action&&action.message||result.reply||'Komut işlendi.');
        const final=await finalizeToolReply(
          q.message,
          [raw],
          action&&action.ok?String(result.tone||'focused'):'warm'
        );
        result={
          ok:true,
          type:'chat',
          reply:String(final&&final.reply||raw),
          command:result.command,
          commands:[],
          executed:!!(action&&action.ok),
          actionResult:action||null,
          model:result.model,
          finalizerModel:final&&final.model||null,
          reflected:!!(final&&final.reflected),
          tone:String(final&&final.tone||(action&&action.ok?result.tone||'focused':'warm')),
          memoryHits:result.memoryHits||0,
          personaVersion:result.personaVersion||2
        };
      }

      await api('/api/worker/mobile-brain-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:true,result})
      });
      console.log('[JARVIS] MOBILE BRAIN READY: '+q.id+' type='+result.type);
    }catch(e){
      await api('/api/worker/mobile-brain-result',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:q.id,ok:false,error:String(e.message||e)})
      }).catch(()=>{});
      console.error('[JARVIS] MOBILE BRAIN:',e.message);
    }
    return true;
  }catch(e){
    if(!/404|not found/i.test(String(e.message||'')))console.error('[JARVIS] MOBILE BRAIN POLL:',e.message);
    return false;
  }finally{
    mobileBrainBusy=false;
  }
}
async function poll(){
  try{
    await pairDevice();
    await migrateDeviceCredential();
    if(!restoreAttempted){restoreAttempted=true;await tryRestoreCloudState();}
    try{
      await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,deviceId:DEVICE_ID,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats(),missions:cloudMissionTelemetry(),update:selfUpdateState()})});
    }catch(e){
      const authLost=/revoked|not approved|awaiting approval/i.test(String(e.message||''));
      if(!authLost||Date.now()-lastAuthRecovery<60000)throw e;
      lastAuthRecovery=Date.now();
      remember({kind:'auth_recovery',reason:String(e.message||'authorization lost')});
      await tryRestoreCloudState();
      await api('/api/worker/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:NAME,deviceId:DEVICE_ID,version:WORKER_VERSION,capabilities:CAPS,memory:memoryStats(),missions:cloudMissionTelemetry(),update:selfUpdateState()})});
      console.log('[JARVIS] Cloud restart recovery tamamlandı; Worker yeniden yetkilendirildi.');
    }
    if(!phoneSessionCodeShown){
      const p=await api('/api/session/create',{method:'POST'});
      phoneSessionCodeShown=true;
      console.log('[JARVIS] TELEFON SESSION CODE: '+p.code+' (5 dakika, tek kullanim)');
    }
    await serviceMobileTts();
    await serviceMobileBrain();
    if(Date.now()-lastStateSync>30000){
      await recoverTransactionJournals();
      await rehydrateCheckpoints();
      await syncCloudState();
      lastStateSync=Date.now();
    }
    const r=await api('/api/worker/next');
    if(!r.task)return;
    let result;
    try{result=await execute(r.task)}
    catch(e){result={ok:false,retryable:true,message:'Worker hatası: '+e.message}}
    remember({kind:'task_result',taskId:r.task.id,taskUid:r.task.uid,command:r.task.command,agent:r.task.agent,result});
    await api('/api/worker/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:r.task.id,uid:r.task.uid,...result})});
    queueJarvisSpeech(result.message);
    console.log('#'+r.task.id+' '+(result.ok?'OK':'FAIL')+' '+result.message);
  }catch(e){console.error(new Date().toISOString(),e.message)}
}
console.log('JARVIS PC Worker '+WORKER_VERSION+' başladı');
if(!TEST_MODE){
  try{bootstrapRuntimeUpgrade()}catch(e){console.error('[JARVIS] BOOTSTRAP MIGRATION:',e.message)}
  try{
    const recovered=getMissionEngine().recoverInterruptedMissions(WORKSPACE);
    if(recovered.length)console.log('[JARVIS] MISSION RECOVERY: '+recovered.length+' görev doğrulama bekliyor');
  }catch(e){console.error('[JARVIS] MISSION RECOVERY:',e.message)}
  cleanupOrphanedJarvisHelpers();
  startWindowsWakeHelper();
  startWindowsClapHelper();
  startWindowsLocalSttHelper();
}
startLocalTtsBridge();
if(!TEST_MODE){
  setTimeout(()=>{
    warmLocalBrain().then(state=>{
      if(state.status!=='ready'){
        setTimeout(()=>warmLocalBrain().catch(()=>{}),8000);
      }
    }).catch(()=>{});
  },900);
  setTimeout(()=>prewarmJarvisBackchannels().catch(()=>{}),2200);
  setTimeout(()=>serviceDurableMissions().catch(()=>{}),5000);
  setTimeout(()=>serviceCreatorDailyPlan().catch(()=>{}),12000);
  setTimeout(()=>serviceCreatorAssetSemanticCatalog({maxItems:1}).catch(()=>{}),25000);
}
console.log('Cloud:',BASE);
console.log('Workspace:',WORKSPACE);
if(!TEST_MODE){
  poll();
  setInterval(poll,3000);
  // Phone conversation relay runs faster than the general task poll so
  // speech feels conversational instead of waiting up to three seconds.
  setInterval(()=>serviceMobileBrain().catch(()=>{}),650);
  setInterval(()=>serviceMobileTts().catch(()=>{}),650);
  // Previously authorized draft-only missions may continue after their
  // dependency becomes ready. The service never auto-publishes content.
  setInterval(()=>serviceDurableMissions().catch(()=>{}),20000);
  setInterval(()=>serviceCreatorDailyPlan().catch(()=>{}),60000);
  // Index at most one Creator clip per cycle so background vision work cannot starve missions.
  setInterval(()=>serviceCreatorAssetSemanticCatalog({maxItems:1}).catch(()=>{}),180000);
}else{
  console.log('[JARVIS] TEST MODE: cloud polling and Windows helpers disabled');
}
