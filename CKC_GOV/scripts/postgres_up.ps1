$ErrorActionPreference = "Stop"

$ckcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $ckcRoot "CKC_GOV\postgres\docker-compose.yml"

if (-not (Test-Path -LiteralPath $composeFile)) {
  throw "PostgreSQL compose file not found: $composeFile"
}

& docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed with exit code $LASTEXITCODE"
}

Write-Output "PostgreSQL is starting at postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex"
