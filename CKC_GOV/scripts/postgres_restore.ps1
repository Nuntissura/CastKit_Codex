param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,
  [string]$ConnectionString = "",
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DumpPath)) {
  throw "Dump file not found: $DumpPath"
}

if (-not $ConnectionString.Trim()) {
  $ConnectionString = $env:CKC_POSTGRES_URL
}
if (-not $ConnectionString.Trim()) {
  $ConnectionString = $env:DATABASE_URL
}
if (-not $ConnectionString.Trim()) {
  $ConnectionString = "postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex"
}
if (-not $ConnectionString.Trim()) {
  throw "ConnectionString is required. Pass -ConnectionString or set CKC_POSTGRES_URL/DATABASE_URL."
}

$argsList = @("--dbname", $ConnectionString, "--no-owner")
if ($Clean) {
  $argsList += @("--clean", "--if-exists")
}
$argsList += $DumpPath

& pg_restore @argsList
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Output "PostgreSQL restore completed."
