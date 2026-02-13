[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [string]$Title,

  [ValidateSet('LOW', 'MEDIUM', 'HIGH')]
  [string]$Severity = 'MEDIUM',

  [string[]]$Tags = @(),

  [string]$Owner = '',

  [string]$Projects = 'CastKit Codex',

  [string]$FailLogRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-Slug([string]$text) {
  if ($null -eq $text) { $text = '' }
  $slug = $text.ToLowerInvariant()
  $slug = [Regex]::Replace($slug, '[^a-z0-9]+', '-')
  $slug = [Regex]::Replace($slug, '-{2,}', '-').Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) { return 'incident' }
  return $slug
}

$scriptRoot = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
  $PSScriptRoot
} else {
  Split-Path -Parent $MyInvocation.MyCommand.Path
}

if ([string]::IsNullOrWhiteSpace($FailLogRoot)) {
  $FailLogRoot = Join-Path $scriptRoot '..\\fail_log'
}

$resolvedFailLogRoot = (Resolve-Path -LiteralPath $FailLogRoot).Path
$incidentsDir = Join-Path $resolvedFailLogRoot 'incidents'
$indexPath = Join-Path $resolvedFailLogRoot 'INDEX.md'
$templatePath = Join-Path $resolvedFailLogRoot 'INCIDENT_TEMPLATE.md'

$today = Get-Date -Format 'yyyy-MM-dd'

if (-not (Test-Path -LiteralPath $incidentsDir)) {
  if ($PSCmdlet.ShouldProcess($incidentsDir, 'Create incidents directory')) {
    New-Item -ItemType Directory -Force -Path $incidentsDir | Out-Null
  }
}

$nextSeq = 1
if (Test-Path -LiteralPath $incidentsDir) {
  foreach ($name in (Get-ChildItem -LiteralPath $incidentsDir -File -Filter "INC-$today`_*.md" | Select-Object -ExpandProperty Name)) {
    if ($name -match "^INC-$today`_(\\d{3})_") {
      $n = [int]$Matches[1]
      if ($n -ge $nextSeq) { $nextSeq = $n + 1 }
    }
  }
}

$seqStr = $nextSeq.ToString('000')
$slug = New-Slug $Title
$fileName = "INC-$today`_$seqStr`_$slug.md"
$filePath = Join-Path $incidentsDir $fileName
$id = "INC-$today-$seqStr"

$tagsText = if ($Tags -and $Tags.Length -gt 0) { ($Tags -join ', ') } else { '' }
$ownerText = if ([string]::IsNullOrWhiteSpace($Owner)) { '(unknown)' } else { $Owner }
$projectsText = if ([string]::IsNullOrWhiteSpace($Projects)) { '' } else { $Projects }

if (-not (Test-Path -LiteralPath $templatePath)) {
  throw "Missing incident template: $templatePath"
}

$template = Get-Content -LiteralPath $templatePath -Raw
$content = $template
$content = $content.Replace('{{ID}}', $id)
$content = $content.Replace('{{TITLE}}', $Title)
$content = $content.Replace('{{DATE}}', $today)
$content = $content.Replace('{{TAGS}}', $tagsText)
$content = $content.Replace('{{OWNER}}', $ownerText)
$content = $content.Replace('{{PROJECTS}}', $projectsText)

if ($PSCmdlet.ShouldProcess($filePath, 'Create incident file')) {
  if (Test-Path -LiteralPath $filePath) {
    throw "Incident file already exists: $filePath"
  }
  Set-Content -LiteralPath $filePath -Value $content -Encoding utf8 -NoNewline
  Add-Content -LiteralPath $filePath -Value "`n" -Encoding utf8
}

if (-not (Test-Path -LiteralPath $indexPath)) {
  $indexInit = @(
    '# Incident Index',
    '',
    'Newest first. Each incident is one file under `incidents/`.',
    '',
    '| ID | Date | Severity | Title |',
    '|---|---|---|---|'
  ) -join "`n"
  if ($PSCmdlet.ShouldProcess($indexPath, 'Create incident index')) {
    Set-Content -LiteralPath $indexPath -Value $indexInit -Encoding utf8 -NoNewline
    Add-Content -LiteralPath $indexPath -Value "`n" -Encoding utf8
  }
}

$relativeLink = "incidents/$fileName"
$row = "| $id | $today | $Severity | [$Title]($relativeLink) |"

if ($PSCmdlet.ShouldProcess($indexPath, 'Update incident index')) {
  $lines = Get-Content -LiteralPath $indexPath
  $dividerIdx = ($lines | Select-String -SimpleMatch '|---|---|---|---|' | Select-Object -First 1).LineNumber
  if (-not $dividerIdx) {
    throw "Unexpected INDEX.md format (missing divider row): $indexPath"
  }

  $insertAt = $dividerIdx # LineNumber is 1-based; insert after divider -> index position equals LineNumber
  $before = @()
  $after = @()
  if ($lines.Length -gt 0) {
    $before = $lines[0..($insertAt - 1)]
    if ($insertAt -lt $lines.Length) { $after = $lines[$insertAt..($lines.Length - 1)] }
  }

  $next = @($before + $row + $after) -join "`n"
  Set-Content -LiteralPath $indexPath -Value $next -Encoding utf8 -NoNewline
  Add-Content -LiteralPath $indexPath -Value "`n" -Encoding utf8
}

Write-Host "Created incident: $id"
Write-Host "File: $filePath"
Write-Host "Index: $indexPath"
