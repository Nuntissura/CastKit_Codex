$ErrorActionPreference = "Stop"

$ckcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $ckcRoot "CKC_GOV\postgres\docker-compose.yml"

if (-not (Test-Path -LiteralPath $composeFile)) {
  throw "PostgreSQL compose file not found: $composeFile"
}

& docker compose -f $composeFile down
if ($LASTEXITCODE -ne 0) {
  throw "docker compose down failed with exit code $LASTEXITCODE"
}

Write-Output "PostgreSQL container stopped. Data remains under CKC_GOV\targets\postgres\data."
