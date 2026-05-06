param(
  [ValidateSet('x64')]
  [string]$Arch = 'x64',
  [string]$GovRoot = $null,
  [ValidateSet('dev', 'release')]
  [string]$Kind = $null
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
$baseVersion = $version
if ($version -match '^(\d+\.\d+\.\d+)') {
  $baseVersion = $matches[1]
}

$gitSha = 'nogit'
try {
  $gitSha = (git -C $repoRoot rev-parse --short HEAD).Trim()
} catch {
  $gitSha = 'nogit'
}

$dirty = ''
try {
  $dirty = (git -C $repoRoot status --porcelain) -join "`n"
} catch {
  $dirty = ''
}
if ($dirty -and $dirty.Trim().Length -gt 0) {
  throw "Working tree not clean. Commit/stash changes before packaging.`n$dirty"
}

$exactTag = $null
try {
  $exactTag = (git -C $repoRoot describe --tags --exact-match 2>$null).Trim()
} catch {
  $exactTag = $null
}

$releaseVersion = $null
if (-not $exactTag) {
  if ($env:GITHUB_REF_TYPE -eq 'tag' -and $env:GITHUB_REF_NAME) {
    $exactTag = [string]$env:GITHUB_REF_NAME
  }
}

if ($exactTag -and $exactTag -match '^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$') {
  $releaseVersion = $matches[1]
}

if (-not $Kind) {
  $Kind = if ($releaseVersion) { 'release' } else { 'dev' }
}

$effectiveVersion = $version
if ($Kind -eq 'release') {
  if (-not $releaseVersion) {
    throw "Release build requested but current commit is not tagged like vX.Y.Z (got: '$exactTag')."
  }
  $effectiveVersion = $releaseVersion
} else {
  # For dev builds, keep the app version stable and use a buildId folder for uniqueness.
  $effectiveVersion = $baseVersion
}

$stampFolder = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$buildId = if ($Kind -eq 'dev') { "dev__${stampFolder}__${gitSha}" } else { "v$effectiveVersion" }

$artifactsRelParts = @()
if ($Kind -eq 'dev') {
  $artifactsRelParts = @('dev', $buildId)
} else {
  # One folder per SemVer release (tagged vX.Y.Z on main).
  $artifactsRelParts = @('releases', "v$effectiveVersion")
}

$stageRoot = Path-Combine @($ckcTargets, 'stage', $buildId)
$artifactsRoot = Path-Combine (@($ckcTargets, 'artifacts') + $artifactsRelParts)
$artifactsRootRelFromArtifactsBase = (Path-Combine $artifactsRelParts)

New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
New-Item -ItemType Directory -Force -Path $artifactsRoot | Out-Null

Write-Host "CKC packaging (Windows) - $Kind - $buildId"
Write-Host "Version:   $effectiveVersion"
Write-Host "Stage:     $stageRoot"
Write-Host "Artifacts: $artifactsRoot"

Copy-Item -Recurse -Force -LiteralPath (Join-Path $repoRoot 'app') -Destination (Join-Path $stageRoot 'app')

# Build renderer into stage\dist (keeps build output out of the repo)
Push-Location $repoRoot
try {
  npx --no-install vite build --outDir "$stageRoot\\dist" --emptyOutDir
  Assert-LastExitOk 'vite build (stage)'

  # Guardrail: Electron packaged app loads `dist/index.html` via `file://` (loadFile),
  # so Vite output must NOT reference `/assets/...` (absolute paths) or the window will be white.
  $indexPath = Path-Combine @($stageRoot, 'dist', 'index.html')
  if (-not (Test-Path -LiteralPath $indexPath)) { throw "Missing renderer entry: $indexPath" }
  $indexHtml = Get-Content -LiteralPath $indexPath -Raw
  if ($indexHtml -match 'src=\"/assets/' -or $indexHtml -match 'href=\"/assets/') {
    throw "Renderer build emitted absolute /assets paths. Set Vite base to './' for build to avoid a white window in packaged Electron."
  }
} finally {
  Pop-Location
}

# Minimal package.json for packaging, kept in stage (so the repo stays clean)
$electronVersion = ($pkg.devDependencies.electron -as [string]) -replace '^[^0-9]*', ''
if (-not $electronVersion) { $electronVersion = '34.2.0' }

$stagePkg = [ordered]@{
  name = [string]$pkg.name
  version = $effectiveVersion
  private = $true
  main = 'app/main.js'
  dependencies = [ordered]@{
    sqlite3 = [string]$pkg.dependencies.sqlite3
  }
  overrides = [ordered]@{
    tar = '7.5.7'
  }
  build = [ordered]@{
    appId = 'com.nuntissura.castkitcodex'
    productName = 'CastKit-Codex'
    electronVersion = $electronVersion
    directories = [ordered]@{
      # Keep build metadata drive-letter agnostic: a relative output is resolved from --projectDir ($stageRoot).
      output = (Path-Combine (@('..', '..', 'artifacts') + $artifactsRelParts))
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
      artifactName = '${productName}-Setup-${version}-${arch}.${ext}'
      oneClick = $false
      allowToChangeInstallationDirectory = $true
    }
    portable = [ordered]@{
      artifactName = '${productName}-Portable-${version}-${arch}.${ext}'
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

$buildInfoText = @(
  "buildId: $buildId"
  "kind: $Kind"
  "version: $effectiveVersion"
  "sourceVersion: $version"
  "gitSha: $gitSha"
  if ($exactTag) { "gitTag: $exactTag" } else { $null }
  "createdAt: $createdAt"
  ''
) | Where-Object { $_ -ne $null } | ForEach-Object { [string]$_ } | Out-String
[System.IO.File]::WriteAllText((Join-Path $artifactsRoot 'BUILD_INFO.txt'), $buildInfoText, $utf8NoBom)

$topFiles = Get-ChildItem -LiteralPath $artifactsRoot -File | Sort-Object Name
$manifest = [ordered]@{
  buildId = $buildId
  kind = $Kind
  version = $effectiveVersion
  sourceVersion = $version
  gitSha = $gitSha
  gitTag = $exactTag
  createdAt = $createdAt
  artifacts = (Path-Combine (@('CKC_GOV', 'targets', 'CKC', 'artifacts') + $artifactsRelParts))
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
  "kind: $Kind"
  "version: $effectiveVersion"
  "sourceVersion: $version"
  "gitSha: $gitSha"
  if ($exactTag) { "gitTag: $exactTag" } else { $null }
  "createdAt: $createdAt"
  "artifacts: $artifactsRootRelFromArtifactsBase"
  "manifest: ${artifactsRootRelFromArtifactsBase}\manifest.json"
  "sha256: ${artifactsRootRelFromArtifactsBase}\SHA256SUMS.txt"
  ''
) | Where-Object { $_ -ne $null } | ForEach-Object { [string]$_ } | Out-String
[System.IO.File]::WriteAllText($latestInfoPath, $latestInfo, $utf8NoBom)
Write-Host "Updated:  $latestInfoPath"
