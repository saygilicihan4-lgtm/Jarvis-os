param(
  [switch]$Silent,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$UPDATER_VERSION='5.0'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Workspace = if ($env:JARVIS_WORKSPACE) { $env:JARVIS_WORKSPACE } else { Join-Path $env:USERPROFILE 'JARVIS-Workspace' }
$MemoryDir = Join-Path $Workspace '.jarvis-memory'
$LogFile = Join-Path $MemoryDir 'update.log'
$StateFile = Join-Path $MemoryDir 'update-state.json'
$BackupRoot = Join-Path $MemoryDir 'update-backups'
$BaseUrl = 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'
$ManifestName = 'jarvis-update-manifest.json'
$MinCheckMinutes = 30

New-Item -ItemType Directory -Force -Path $MemoryDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

function Write-UpdateLog([string]$Message) {
  try {
    $line = ('[{0}] [updater {1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'), $UPDATER_VERSION, $Message)
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if (-not $Silent) { Write-Host $line }
  } catch {}
}

function Save-UpdateState([bool]$Success, [string[]]$Changed, [string]$ErrorText) {
  try {
    $state = [ordered]@{
      updater_version = $UPDATER_VERSION
      checked_at = (Get-Date).ToUniversalTime().ToString('o')
      success = $Success
      changed = @($Changed)
      error = $ErrorText
    }
    $state | ConvertTo-Json -Depth 4 | Set-Content -Path $StateFile -Encoding UTF8
  } catch {}
}

function Test-DownloadedFile($Entry, [string]$FilePath) {
  if (-not (Test-Path -LiteralPath $FilePath)) { throw ('Missing staged file: ' + $Entry.path) }

  $fileInfo = Get-Item -LiteralPath $FilePath
  $minBytes = [int64]$Entry.min_bytes
  if ($fileInfo.Length -lt $minBytes) {
    throw ('File too small: {0} ({1} < {2})' -f $Entry.path, $fileInfo.Length, $minBytes)
  }

  $text = Get-Content -LiteralPath $FilePath -Raw
  $signature = [string]$Entry.signature
  if ($signature -and -not $text.Contains($signature)) {
    throw ('Signature validation failed: ' + $Entry.path)
  }

  switch ([string]$Entry.kind) {
    'node' {
      $node = Get-Command node -ErrorAction SilentlyContinue
      if (-not $node) { throw 'Node.js is required to validate worker.js.' }
      & node --check $FilePath | Out-Null
      if ($LASTEXITCODE -ne 0) { throw ('Node syntax validation failed: ' + $Entry.path) }
    }
    'powershell' {
      [scriptblock]::Create($text) | Out-Null
    }
    'powershell-next' {
      [scriptblock]::Create($text) | Out-Null
    }
    'python' {
      $python = Get-Command python -ErrorAction SilentlyContinue
      if ($python) {
        & python -m py_compile $FilePath 2>$null
        if ($LASTEXITCODE -ne 0) { throw ('Python syntax validation failed: ' + $Entry.path) }
      }
    }
    'json' {
      $null = $text | ConvertFrom-Json
    }
    default {}
  }
}

function Invoke-JarvisSelfUpdate {
  if (-not $Force -and (Test-Path -LiteralPath $StateFile)) {
    try {
      $previous = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
      if ($previous.success -eq $true -and $previous.checked_at) {
        $last = [DateTimeOffset]::Parse([string]$previous.checked_at)
        if ($last -gt [DateTimeOffset]::UtcNow.AddMinutes(-$MinCheckMinutes)) {
          Write-UpdateLog 'Recent successful update check exists; skipping duplicate check.'
          return 0
        }
      }
    } catch {}
  }

  $stageRoot = Join-Path $env:TEMP ('jarvis-update-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
  $changedNames = New-Object System.Collections.Generic.List[string]
  $staged = New-Object System.Collections.Generic.List[object]

  try {
    Write-UpdateLog 'Checking trusted stable manifest.'
    $cache = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $manifestPath = Join-Path $stageRoot $ManifestName
    $manifestUrl = $BaseUrl + $ManifestName + '?cb=' + $cache

    try {
      Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -Uri $manifestUrl -OutFile $manifestPath -TimeoutSec 20
    } catch {
      Write-UpdateLog ('Manifest unavailable; current JARVIS preserved. ' + $_.Exception.Message)
      Save-UpdateState $false @() $_.Exception.Message
      return 20
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ([int]$manifest.schema -ne 1) { throw 'Unsupported update manifest schema.' }
    if (-not $manifest.files -or @($manifest.files).Count -lt 1) { throw 'Update manifest contains no files.' }

    foreach ($entry in @($manifest.files)) {
      $relative = [string]$entry.path
      if (-not $relative -or $relative.Contains('..') -or [IO.Path]::IsPathRooted($relative)) {
        throw ('Unsafe manifest path: ' + $relative)
      }

      $stageName = $relative.Replace('\','__').Replace('/','__')
      $stagePath = Join-Path $stageRoot $stageName
      $fileUrl = $BaseUrl + $relative + '?cb=' + $cache

      Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -Uri $fileUrl -OutFile $stagePath -TimeoutSec 25
      Test-DownloadedFile $entry $stagePath

      $destination = Join-Path $Root $relative
      $same = $false
      if (Test-Path -LiteralPath $destination) {
        $same = ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $stagePath -Algorithm SHA256).Hash)
      }

      if (-not $same) {
        $item = [pscustomobject]@{
          entry = $entry
          relative = $relative
          stage = $stagePath
          destination = $destination
          existed = (Test-Path -LiteralPath $destination)
        }
        $staged.Add($item)
        $changedNames.Add($relative)
      }
    }

    if ($staged.Count -eq 0) {
      Write-UpdateLog 'All managed local components are current.'
      Save-UpdateState $true @() ''
      return 0
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $backupDir = Join-Path $BackupRoot $stamp
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    foreach ($item in $staged) {
      if ($item.existed) {
        $backupPath = Join-Path $backupDir $item.relative
        $backupParent = Split-Path -Parent $backupPath
        if ($backupParent) { New-Item -ItemType Directory -Force -Path $backupParent | Out-Null }
        Copy-Item -LiteralPath $item.destination -Destination $backupPath -Force
      }
    }

    try {
      foreach ($item in $staged) {
        $entryKind = [string]$item.entry.kind

        if ($entryKind -eq 'powershell-next' -and $item.relative -eq 'jarvis-self-update.ps1') {
          $pending = Join-Path $Root 'jarvis-self-update.next.ps1'
          Copy-Item -LiteralPath $item.stage -Destination $pending -Force
          if ((Get-FileHash -LiteralPath $pending -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $item.stage -Algorithm SHA256).Hash) {
            throw 'Pending updater hash verification failed.'
          }
          continue
        }

        $parent = Split-Path -Parent $item.destination
        if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
        Copy-Item -LiteralPath $item.stage -Destination $item.destination -Force

        if ((Get-FileHash -LiteralPath $item.destination -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $item.stage -Algorithm SHA256).Hash) {
          throw ('Post-copy hash verification failed: ' + $item.relative)
        }
      }
    } catch {
      Write-UpdateLog ('Apply failed; rolling back. ' + $_.Exception.Message)
      foreach ($item in $staged) {
        try {
          if ([string]$item.entry.kind -eq 'powershell-next' -and $item.relative -eq 'jarvis-self-update.ps1') {
            Remove-Item -LiteralPath (Join-Path $Root 'jarvis-self-update.next.ps1') -Force -ErrorAction SilentlyContinue
            continue
          }

          $backupPath = Join-Path $backupDir $item.relative
          if ($item.existed -and (Test-Path -LiteralPath $backupPath)) {
            Copy-Item -LiteralPath $backupPath -Destination $item.destination -Force
          } elseif (-not $item.existed) {
            Remove-Item -LiteralPath $item.destination -Force -ErrorAction SilentlyContinue
          }
        } catch {}
      }

      Save-UpdateState $false @($changedNames) $_.Exception.Message
      return 30
    }

    Write-UpdateLog ('Update applied safely: ' + (($changedNames.ToArray()) -join ', '))
    Save-UpdateState $true @($changedNames) ''

    try {
      Get-ChildItem -LiteralPath $BackupRoot -Directory |
        Sort-Object CreationTime -Descending |
        Select-Object -Skip 5 |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    } catch {}

    return 0
  } catch {
    Write-UpdateLog ('Validation failed; current JARVIS preserved. ' + $_.Exception.Message)
    Save-UpdateState $false @($changedNames) $_.Exception.Message
    return 30
  } finally {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\JARVIS_SELF_UPDATE_V5', [ref]$created)
if (-not $created) {
  Write-UpdateLog 'Another update check is already active.'
  try { $mutex.Dispose() } catch {}
  exit 10
}

$exitCode = 0
try {
  $exitCode = Invoke-JarvisSelfUpdate
} finally {
  try {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
  } catch {}
}

exit $exitCode
