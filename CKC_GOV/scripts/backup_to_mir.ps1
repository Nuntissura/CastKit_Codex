param(
  [string]$SourceRoot = $null,
  [string]$DestinationRoot = $null,
  [string]$LogDir = $null
)

$ErrorActionPreference = 'Stop'

function Ensure-Dir([string]$PathLike) {
  if (-not (Test-Path -LiteralPath $PathLike)) {
    New-Item -ItemType Directory -Force -Path $PathLike | Out-Null
  }
}

function Write-Utf8NoBom([string]$PathLike, [string]$Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($PathLike, $Text, $utf8NoBom)
}

function Exit-With([int]$Code, [string]$Message) {
  Write-Host $Message
  exit $Code
}

function Normalize-Path([string]$PathLike) {
  if (-not $PathLike) { return $null }
  try {
    return ([System.IO.Path]::GetFullPath($PathLike)).TrimEnd('\')
  } catch {
    return $PathLike.TrimEnd('\')
  }
}

function Get-CkcConfigPath() {
  if (-not $env:APPDATA) { return $null }
  return (Join-Path $env:APPDATA 'castkit-codex\\ckc-config.json')
}

function Get-LibraryRootInfo() {
  $configPath = Get-CkcConfigPath
  $info = [ordered]@{
    configPath = $configPath
    configured = $false
    missingOnDisk = $false
    libraryRoot = $null
    warning = $null
  }

  if (-not $configPath) {
    $info.warning = 'APPDATA not set; cannot locate CKC config.'
    return [pscustomobject]$info
  }
  if (-not (Test-Path -LiteralPath $configPath)) {
    $info.warning = "CKC config not found: $configPath"
    return [pscustomobject]$info
  }

  try {
    $raw = Get-Content -LiteralPath $configPath -Raw
    if (-not $raw) {
      $info.warning = "CKC config is empty: $configPath"
      return [pscustomobject]$info
    }
    $config = $raw | ConvertFrom-Json
  } catch {
    $info.warning = "Failed to read CKC config: $configPath ($($_.Exception.Message))"
    return [pscustomobject]$info
  }

  $candidate = $config.libraryRoot
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $info.warning = "CKC config missing libraryRoot: $configPath"
    return [pscustomobject]$info
  }

  $info.configured = $true

  $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
  if (-not (Test-Path -LiteralPath $expanded)) {
    $info.missingOnDisk = $true
    $info.warning = "CKC libraryRoot not found on disk: $expanded (from $configPath)"
    return [pscustomobject]$info
  }

  try {
    $info.libraryRoot = (Resolve-Path -LiteralPath $expanded).Path
    return [pscustomobject]$info
  } catch {
    $info.warning = "Failed to resolve CKC libraryRoot path: $expanded"
    return [pscustomobject]$info
  }
}

function Resolve-DefaultCkcRoot() {
  # This script lives in: <CKC_ROOT>\CKC_GOV\scripts\
  # So the CKC root is two levels up from $PSScriptRoot.
  return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\\..')).Path
}

$sourceRootProvided = [bool]$SourceRoot
if (-not $SourceRoot) { $SourceRoot = $env:CKC_ROOT }
if (-not $SourceRoot) { $SourceRoot = Resolve-DefaultCkcRoot }

$libInfo = Get-LibraryRootInfo
$libraryRoot = $libInfo.libraryRoot
$libraryRootWarning = $libInfo.warning
$libraryRootConfigured = [bool]$libInfo.configured
$libraryRootMissingOnDisk = [bool]$libInfo.missingOnDisk

if (-not $DestinationRoot) { $DestinationRoot = $env:CKC_BACKUP_DEST }
if (-not $DestinationRoot) { $DestinationRoot = '\\MIR\home\LLM\CastKit Codex remote\K_CastKit_Codex' }
$DestinationRoot = $DestinationRoot.TrimEnd('\')

if (-not $LogDir) { $LogDir = (Join-Path $PSScriptRoot '..\\targets\\backup_logs') }

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  Exit-With 2 "Source not found: $SourceRoot"
}

if ($libraryRootWarning) {
  Write-Host "WARNING: $libraryRootWarning"
}

# Safety: destination must be the expected UNC prefix unless explicitly changed by editing this script.
$expectedPrefix = '\\MIR\home\LLM\CastKit Codex remote\'
if (-not ($DestinationRoot.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
  Exit-With 3 "Refusing to run: DestinationRoot must start with '$expectedPrefix' (got: $DestinationRoot)"
}

Ensure-Dir $LogDir

$lockPath = Join-Path $LogDir 'backup.lock'
$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
  Exit-With 0 "Backup already running (lock held): $lockPath"
}

try {
  Ensure-Dir $DestinationRoot

  $sentinelPath = Join-Path $DestinationRoot 'CKC_BACKUP_SENTINEL.txt'
  if (-not (Test-Path -LiteralPath $sentinelPath)) {
    Write-Utf8NoBom $sentinelPath @"
This folder is managed by CastKit Codex backup.

Source:      $SourceRoot
Destination: $DestinationRoot

This backup uses ROBOCOPY /MIR, so files removed from the source may be removed from the destination.
"@
  }

  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $logPath = Join-Path $LogDir "backup_$stamp.log"

  Write-Host "Backup start: $stamp"
  Write-Host "Repo from: $SourceRoot"
  Write-Host "Repo to:   $DestinationRoot"
  if ($libraryRoot) { Write-Host "Library from: $libraryRoot" }
  Write-Host "Log:  $logPath"

  $rcRepo = $null
  $rcLibrary = $null
  $destinationLibrary = $null
  $libraryMirrored = $false

  # ROBOCOPY exit codes:
  # 0-7 = success (including 'no changes'), 8+ = failure.
  $repoArgs = @(
    "`"$SourceRoot`"",
    "`"$DestinationRoot`"",
    '/MIR',
    '/Z',
    '/R:2',
    '/W:3',
    '/MT:16',
    '/FFT',
    '/DCOPY:DAT',
    '/COPY:DAT',
    '/XJ',
    '/XF',
    'backup.lock',
    '/NP',
    "/LOG:`"$logPath`""
  )

  & robocopy @repoArgs | Out-Null
  $rcRepo = $LASTEXITCODE

  if ($libraryRoot) {
    $normalizedSource = Normalize-Path $SourceRoot
    $normalizedLibrary = Normalize-Path $libraryRoot
    $needsSeparateMirror = $true
    if ($normalizedSource -and $normalizedLibrary) {
      $s = $normalizedSource.TrimEnd('\') + '\'
      $l = $normalizedLibrary.TrimEnd('\') + '\'
      if ($l.StartsWith($s, [System.StringComparison]::OrdinalIgnoreCase)) {
        $needsSeparateMirror = $false
      }
    }

    if ($needsSeparateMirror) {
      $destinationLibrary = $env:CKC_BACKUP_DEST_LIBRARY
      if (-not $destinationLibrary) { $destinationLibrary = ($DestinationRoot.TrimEnd('\') + '__libraryRoot') }
      if (-not ($destinationLibrary.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        Exit-With 3 "Refusing to run: DestinationRootLibrary must start with '$expectedPrefix' (got: $destinationLibrary)"
      }

      Ensure-Dir $destinationLibrary

      $sentinelLibPath = Join-Path $destinationLibrary 'CKC_LIBRARY_BACKUP_SENTINEL.txt'
      if (-not (Test-Path -LiteralPath $sentinelLibPath)) {
        Write-Utf8NoBom $sentinelLibPath @"
This folder is managed by CastKit Codex backup (libraryRoot mirror).

Source:      $libraryRoot
Destination: $destinationLibrary
Config:      $($libInfo.configPath)

This backup uses ROBOCOPY /MIR, so files removed from the source may be removed from the destination.
"@
      }

      Write-Host "Library to: $destinationLibrary"

      $libArgs = @(
        "`"$libraryRoot`"",
        "`"$destinationLibrary`"",
        '/MIR',
        '/Z',
        '/R:2',
        '/W:3',
        '/MT:16',
        '/FFT',
        '/DCOPY:DAT',
        '/COPY:DAT',
        '/XJ',
        '/XF',
        'backup.lock',
        '/NP',
        "/LOG+:`"$logPath`""
      )

      & robocopy @libArgs | Out-Null
      $rcLibrary = $LASTEXITCODE
      $libraryMirrored = $true
    } else {
      Write-Host "LibraryRoot is under SourceRoot; no separate library mirror needed."
    }
  }

  $statusPath = Join-Path $LogDir 'LAST_RUN.txt'
  $statusText = @(
    "finishedAt: $(Get-Date -Format o)"
    "exitCodeRepo: $rcRepo"
    "sourceRepo: $SourceRoot"
    "destinationRepo: $DestinationRoot"
    "configPath: $($libInfo.configPath)"
    "libraryRoot: $libraryRoot"
    "libraryConfigured: $libraryRootConfigured"
    "libraryMissingOnDisk: $libraryRootMissingOnDisk"
    "libraryMirrored: $libraryMirrored"
    "destinationLibrary: $destinationLibrary"
    "exitCodeLibrary: $rcLibrary"
    "warning: $libraryRootWarning"
    "log: $logPath"
    ''
  ) -join "`n"
  Write-Utf8NoBom $statusPath $statusText

  if ($rcRepo -ge 8) {
    Exit-With $rcRepo "Backup FAILED (repo robocopy exit code $rcRepo). See log: $logPath"
  }

  if ($libraryRootConfigured -and $libraryRootMissingOnDisk) {
    Exit-With 10 "Backup FAILED: CKC libraryRoot configured but missing on disk. $libraryRootWarning"
  }

  if ($libraryMirrored -and $rcLibrary -ge 8) {
    Exit-With $rcLibrary "Backup FAILED (library robocopy exit code $rcLibrary). See log: $logPath"
  }

  Exit-With 0 "Backup OK (repo=$rcRepo, library=$rcLibrary)."
} finally {
  if ($lockStream) { $lockStream.Dispose() }
}
