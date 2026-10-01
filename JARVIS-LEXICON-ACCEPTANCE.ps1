$ErrorActionPreference = "Stop"

$Workspace = Join-Path $env:USERPROFILE "JARVIS-Workspace"
$ReportDir = Join-Path $Workspace ".jarvis-memory"
$ReportPath = Join-Path $ReportDir "speech-lexicon-acceptance.json"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$results = New-Object System.Collections.Generic.List[object]
function Add-Result([string]$Name,[bool]$Ok,[string]$Detail) {
  $results.Add([pscustomobject]@{name=$Name;ok=$Ok;detail=$Detail})
  $tag=if($Ok){"PASS"}else{"FAIL"}
  $color=if($Ok){"Green"}else{"Red"}
  Write-Host ("[{0}] {1} · {2}" -f $tag,$Name,$Detail) -ForegroundColor $color
}
function Invoke-Json([string]$Uri,[string]$Method="GET",$Body=$null,[int]$Timeout=20) {
  if($null -eq $Body){return Invoke-RestMethod -Uri $Uri -Method $Method -TimeoutSec $Timeout}
  return Invoke-RestMethod -Uri $Uri -Method $Method -ContentType "application/json" -Body ($Body|ConvertTo-Json -Depth 7 -Compress) -TimeoutSec $Timeout
}

$heard="jarvis-kabul-zumrut-tup-941"
$taught="jarvis-kabul-gok-yakut-812"
try {
  $h=Invoke-Json "http://127.0.0.1:8765/health"
  Add-Result "Worker lexicon capability" ($h.ok -eq $true -and $h.localStt.adaptiveLexicon -eq $true) ("v"+$h.version+" lexicon="+$h.localStt.lexiconCount)

  $learn=Invoke-Json "http://127.0.0.1:8765/speech-lexicon" "POST" @{heard=$heard;intended="youtube aç";source="live-lexicon-acceptance"}
  Add-Result "Learn correction" ($learn.ok -eq $true) ($learn.heard+" -> "+$learn.intended)

  $state=Invoke-Json "http://127.0.0.1:8765/speech-lexicon"
  $persisted=($state.ok -eq $true -and [string]$state.aliases.$heard -eq "youtube aç")
  Add-Result "Persist correction" $persisted ("count="+$state.count)

  $brain=Invoke-Json "http://127.0.0.1:8765/brain" "POST" @{message=$heard} 45
  $brainOk=($brain.ok -eq $true -and $brain.type -eq "command" -and [string]$brain.command -match "youtube")
  Add-Result "Brain reuse" $brainOk ("type="+$brain.type+" command="+$brain.command)

  $agent=Invoke-Json "http://127.0.0.1:8765/agent" "POST" @{message="$taught dersem google aç anla";maxRounds=2} 45
  $agentOk=($agent.ok -eq $true -and [string]$agent.model -eq "local-speech-lexicon")
  Add-Result "Natural teaching phrase" $agentOk ([string]$agent.reply)

  $stt=Invoke-Json "http://127.0.0.1:8768/health"
  $sttOk=($stt.ok -eq $true -and $stt.adaptive_lexicon -eq $true -and [int]$stt.lexicon_count -ge 1)
  Add-Result "Dynamic STT hotwords" $sttOk ("model="+$stt.model+" aliases="+$stt.lexicon_count)
  $adaptiveOk=($stt.adaptive_decode -eq $true -and [int]$stt.retry_beam -ge [int]$stt.fast_beam)
  Add-Result "Adaptive STT decode" $adaptiveOk ("fast="+$stt.fast_beam+" retry="+$stt.retry_beam)
  $endpointOk=($null -ne $stt.endpointing -and [int]$stt.endpointing.short_silence_ms -le 550 -and [int]$stt.endpointing.long_silence_ms -le 750)
  Add-Result "Dynamic endpointing" $endpointOk ("short="+$stt.endpointing.short_silence_ms+"ms long="+$stt.endpointing.long_silence_ms+"ms")

  $forget=Invoke-Json "http://127.0.0.1:8765/speech-lexicon" "POST" @{action="forget";heard=$heard}
  Add-Result "Forget correction" ($forget.ok -eq $true) ([string]$forget.heard)
} catch {
  Add-Result "Unexpected exception" $false $_.Exception.Message
} finally {
  try { $null=Invoke-Json "http://127.0.0.1:8765/speech-lexicon" "POST" @{action="forget";heard=$heard} 5 } catch {}
  try { $null=Invoke-Json "http://127.0.0.1:8765/speech-lexicon" "POST" @{action="forget";heard=$taught} 5 } catch {}
}

$passed=@($results|Where-Object {$_.ok}).Count
$total=$results.Count
$success=($total -ge 9 -and $passed -eq $total)
[pscustomobject]@{
  at=(Get-Date).ToString("o")
  passed=$passed
  total=$total
  success=$success
  results=$results
}|ConvertTo-Json -Depth 7|Set-Content -Encoding UTF8 $ReportPath

Write-Host ("Adaptive speech acceptance: {0}/{1} PASS" -f $passed,$total)
Write-Host ("Report: {0}" -f $ReportPath)
if(-not $success){exit 1}
exit 0
