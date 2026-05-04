param(
  [string]$ConnectionString = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

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

$ckcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutDir.Trim()) {
  $OutDir = Join-Path $ckcRoot "CKC_GOV\targets\CKC\postgres_dumps"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outPath = Join-Path $OutDir "ckc_postgres_$stamp.dump"

& pg_dump --format=custom --no-owner --file $outPath $ConnectionString
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Output $outPath
