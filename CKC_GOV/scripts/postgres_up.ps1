$ErrorActionPreference = "Stop"

$ckcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $ckcRoot "CKC_GOV\postgres\docker-compose.yml"
$containerName = "castkit-codex-postgres"

if (-not $env:CKC_POSTGRES_HOST_PORT) {
  $defaultPortOwner = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($defaultPortOwner) {
    $ownerProcess = Get-Process -Id $defaultPortOwner.OwningProcess -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { "$($ownerProcess.ProcessName) PID $($ownerProcess.Id)" } else { "PID $($defaultPortOwner.OwningProcess)" }
    $env:CKC_POSTGRES_HOST_PORT = "55432"
    Write-Output "Port 5432 is already owned by $ownerName; using CKC_POSTGRES_HOST_PORT=55432 for CKC Docker PostgreSQL."
  }
}

$hostPort = if ($env:CKC_POSTGRES_HOST_PORT) { $env:CKC_POSTGRES_HOST_PORT } else { "5432" }

if (-not (Test-Path -LiteralPath $composeFile)) {
  throw "PostgreSQL compose file not found: $composeFile"
}

& docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed with exit code $LASTEXITCODE"
}

for ($i = 0; $i -lt 60; $i++) {
  & docker exec $containerName pg_isready -U castkit_codex -d castkit_codex *> $null
  if ($LASTEXITCODE -eq 0) {
    & docker exec $containerName psql -U castkit_codex -d castkit_codex -v ON_ERROR_STOP=1 -c "ALTER ROLE castkit_codex WITH PASSWORD 'castkit_codex';" *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "failed to normalize local PostgreSQL dev password"
    }
    Write-Output "PostgreSQL is ready at postgres://castkit_codex:castkit_codex@127.0.0.1:$hostPort/castkit_codex"
    exit 0
  }
  Start-Sleep -Seconds 1
}

throw "PostgreSQL container did not become ready within 60 seconds"
