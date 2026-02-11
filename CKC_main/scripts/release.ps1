param(
  [string]$Version = $null,
  [ValidateSet('patch', 'minor', 'major')]
  [string]$Bump = 'patch'
)

$ErrorActionPreference = 'Stop'

function Assert-LastExitOk([string]$Context) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Context failed with exit code $LASTEXITCODE"
  }
}

function Run-Git([string[]]$Args) {
  & git @Args | Out-Null
  Assert-LastExitOk ("git " + ($Args -join ' '))
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$dirty = git status --porcelain
if ($dirty) {
  throw "Working tree not clean. Commit/stash changes first.`n$dirty"
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  throw "Release builds must run from branch 'main' (current: '$branch')."
}

Write-Host "Bumping version..."
if ($Version) {
  & npm version $Version --no-git-tag-version | Out-Null
  Assert-LastExitOk "npm version $Version"
} else {
  & npm version $Bump --no-git-tag-version | Out-Null
  Assert-LastExitOk "npm version $Bump"
}

$pkg = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$ver = [string]$pkg.version
if (-not $ver) { throw "Failed to read version from package.json" }
$tag = "v$ver"

Run-Git @('add', '--', 'package.json', 'package-lock.json')
Run-Git @('commit', '-m', "release: $tag")
Run-Git @('tag', $tag)

Write-Host "Packaging installer + portable..."
& npm run package:win:raw | Out-Host
Assert-LastExitOk "npm run package:win:raw"

Write-Host "Pushing commit + tag..."
Run-Git @('push', 'origin', $branch)
Run-Git @('push', 'origin', $tag)

Write-Host "Done. Tag pushed: $tag"
