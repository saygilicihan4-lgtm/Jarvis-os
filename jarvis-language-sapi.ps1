param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath)
# JARVIS_LANGUAGE_SAPI_V1 - static script; voice/text are JSON data, never code.
$ErrorActionPreference='Stop'
$data=Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $data.text -or ([string]$data.text).Length -gt 900){throw 'invalid_reply_text'}
Add-Type -AssemblyName System.Speech
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
try{
  $voice=@($s.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Name -eq [string]$data.voice -and $_.VoiceInfo.Culture.Name -eq [string]$data.locale})
  if($voice.Count -ne 1){throw 'voice_locale_mismatch'}
  $s.SelectVoice([string]$data.voice)
  $s.Rate=-1
  $s.Volume=100
  $s.SetOutputToWaveFile($OutputPath)
  $s.Speak([string]$data.text)
}finally{$s.Dispose()}
