param(
  [ValidateSet('x64')]
  [string]$Arch = 'x64',
  [string]$GovRoot = $null
)

$ErrorActionPreference = 'Stop'

function Resolve-FullPath([string]$PathLike) {
  return (Resolve-Path -LiteralPath $PathLike).Path
}

function Path-Combine([string[]]$Parts) {
  return [System.IO.Path]::Combine($Parts)
}

function Assert-LastExitOk([string]$Context) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Context failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = Resolve-FullPath (Join-Path $PSScriptRoot '..')
$govRootCandidate = $GovRoot
if (-not $govRootCandidate) { $govRootCandidate = $env:CKC_GOV_ROOT }
if (-not $govRootCandidate) { $govRootCandidate = (Path-Combine @($repoRoot, '..', 'CKC_GOV')) }
New-Item -ItemType Directory -Force -Path $govRootCandidate | Out-Null
$govRoot = Resolve-FullPath $govRootCandidate

$cacheRoot = Path-Combine @($govRoot, 'targets', 'cache')
$ckcTargets = Path-Combine @($govRoot, 'targets', 'CKC')

$env:npm_config_cache = Join-Path $cacheRoot 'npm'
$env:ELECTRON_CACHE = Join-Path $cacheRoot 'electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $cacheRoot 'electron-builder'

$pkgPath = Join-Path $repoRoot 'package.json'
$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
$version = [string]$pkg.version

$gitSha = 'nogit'
try {
  $gitSha = (git -C $repoRoot rev-parse --short HEAD).Trim()
} catch {
  $gitSha = 'nogit'
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$buildId = "v$version+$gitSha-$stamp"

$stageRoot = Path-Combine @($ckcTargets, 'stage', $buildId)
$artifactsRoot = Path-Combine @($ckcTargets, 'artifacts', $buildId)

New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
New-Item -ItemType Directory -Force -Path $artifactsRoot | Out-Null

Write-Host "CKC packaging (Windows) - $buildId"
Write-Host "Stage:     $stageRoot"
Write-Host "Artifacts: $artifactsRoot"

Copy-Item -Recurse -Force -LiteralPath (Join-Path $repoRoot 'app') -Destination (Join-Path $stageRoot 'app')

# Build renderer into stage\dist (keeps build output out of the repo)
Push-Location $repoRoot
try {
  npm run build -- --outDir "$stageRoot\\dist" --emptyOutDir
  Assert-LastExitOk 'vite build'
} finally {
  Pop-Location
}

# Minimal package.json for packaging, kept in stage (so the repo stays clean)
$electronVersion = ($pkg.devDependencies.electron -as [string]) -replace '^[^0-9]*', ''
if (-not $electronVersion) { $electronVersion = '34.2.0' }

$stagePkg = [ordered]@{
  name = [string]$pkg.name
  version = $version
  private = $true
  main = 'app/main.js'
  dependencies = [ordered]@{
    sqlite3 = [string]$pkg.dependencies.sqlite3
  }
  build = [ordered]@{
    appId = 'com.nuntissura.castkitcodex'
    productName = 'CastKit Codex'
    electronVersion = $electronVersion
    directories = [ordered]@{
      output = $artifactsRoot
    }
    files = @(
      'app/**/*',
      'dist/**/*',
      'node_modules/**/*',
      'package.json'
    )
    asar = $true
    asarUnpack = @('**/*.node')
    win = [ordered]@{
      target = @('nsis', 'portable')
      icon = 'app/icon.ico'
      signAndEditExecutable = $false
    }
    nsis = [ordered]@{
      oneClick = $false
      allowToChangeInstallationDirectory = $true
    }
  }
}

$stagePkgJson = $stagePkg | ConvertTo-Json -Depth 12
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $stageRoot 'package.json'), $stagePkgJson, $utf8NoBom)

# Install prod deps into stage (sqlite3)
Push-Location $stageRoot
try {
  npm install --omit=dev
  Assert-LastExitOk 'npm install (stage)'
} finally {
  Pop-Location
}

# Build installer + portable exe
Push-Location $repoRoot
try {
  npx electron-builder --projectDir "$stageRoot" --win --$Arch
  Assert-LastExitOk 'electron-builder'
} finally {
  Pop-Location
}

Write-Host "Done. Artifacts in: $artifactsRoot"

$latestInfoPath = Path-Combine @($ckcTargets, 'artifacts', 'LATEST_BUILD.txt')
$createdAt = (Get-Date -Format o)

$topFiles = Get-ChildItem -LiteralPath $artifactsRoot -File | Sort-Object Name
$manifest = [ordered]@{
  buildId = $buildId
  version = $version
  gitSha = $gitSha
  createdAt = $createdAt
  artifacts = $artifactsRoot
  files = @(
    foreach ($f in $topFiles) {
      $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $f.FullName).Hash.ToLowerInvariant()
      [ordered]@{
        name = $f.Name
        sizeBytes = $f.Length
        sha256 = $hash
      }
    }
  )
}

$manifestPath = Join-Path $artifactsRoot 'manifest.json'
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 6), $utf8NoBom)

$shaPath = Join-Path $artifactsRoot 'SHA256SUMS.txt'
$shaLines = foreach ($entry in $manifest.files) { "{0}  {1}" -f $entry.sha256, $entry.name }
[System.IO.File]::WriteAllText($shaPath, (($shaLines -join "`n") + "`n"), $utf8NoBom)

$latestInfo = @(
  "buildId: $buildId"
  "version: $version"
  "gitSha: $gitSha"
  "createdAt: $createdAt"
  "artifacts: $artifactsRoot"
  "manifest: $manifestPath"
  "sha256: $shaPath"
  ''
) -join "`n"
[System.IO.File]::WriteAllText($latestInfoPath, $latestInfo, $utf8NoBom)
Write-Host "Updated:  $latestInfoPath"
