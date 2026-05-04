param(
  [string]$LibraryRoot = "",
  [string]$SqlitePath = "",
  [string]$ConnectionString = "",
  [switch]$Truncate,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ckcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeScript = Join-Path $ckcRoot "CKC_main\scripts\sqlite_to_postgres.js"

if (-not (Test-Path -LiteralPath $nodeScript)) {
  throw "Migration script not found: $nodeScript"
}

$argsList = @($nodeScript)
if ($LibraryRoot.Trim()) {
  $argsList += @("--library-root", $LibraryRoot)
}
if ($SqlitePath.Trim()) {
  $argsList += @("--sqlite", $SqlitePath)
}
if ($ConnectionString.Trim()) {
  $argsList += @("--connection-string", $ConnectionString)
}
if ($Truncate) {
  $argsList += "--truncate"
}
if ($DryRun) {
  $argsList += "--dry-run"
}

Push-Location (Join-Path $ckcRoot "CKC_main")
try {
  & node @argsList
  if ($LASTEXITCODE -ne 0) {
    throw "SQLite-to-PostgreSQL migration failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
