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

function Resolve-DefaultCkcRoot() {
  # This script lives in: <CKC_ROOT>\CKC_GOV\scripts\
  # So the CKC root is two levels up from $PSScriptRoot.
  return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\\..')).Path
}

if (-not $SourceRoot) { $SourceRoot = $env:CKC_ROOT }
if (-not $SourceRoot) { $SourceRoot = Resolve-DefaultCkcRoot }

if (-not $DestinationRoot) { $DestinationRoot = $env:CKC_BACKUP_DEST }
if (-not $DestinationRoot) { $DestinationRoot = '\\MIR\home\LLM\CastKit Codex remote\K_CastKit_Codex' }

if (-not $LogDir) { $LogDir = (Join-Path $PSScriptRoot '..\\targets\\backup_logs') }

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  Exit-With 2 "Source not found: $SourceRoot"
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
  Write-Host "From: $SourceRoot"
  Write-Host "To:   $DestinationRoot"
  Write-Host "Log:  $logPath"

  # ROBOCOPY exit codes:
  # 0-7 = success (including 'no changes'), 8+ = failure.
  $robocopyArgs = @(
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

  & robocopy @robocopyArgs | Out-Null
  $rc = $LASTEXITCODE

  $statusPath = Join-Path $LogDir 'LAST_RUN.txt'
  $statusText = @(
    "finishedAt: $(Get-Date -Format o)"
    "exitCode: $rc"
    "source: $SourceRoot"
    "destination: $DestinationRoot"
    "log: $logPath"
    ''
  ) -join "`n"
  Write-Utf8NoBom $statusPath $statusText

  if ($rc -ge 8) {
    Exit-With $rc "Backup FAILED (robocopy exit code $rc). See log: $logPath"
  }

  Exit-With 0 "Backup OK (robocopy exit code $rc)."
} finally {
  if ($lockStream) { $lockStream.Dispose() }
}
