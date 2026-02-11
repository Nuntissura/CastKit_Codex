param(
  [string]$TaskName = 'CKC_Backup_To_MIR',
  [string]$BackupScript = $null
)

$ErrorActionPreference = 'Stop'

if (-not $BackupScript) {
  $BackupScript = Join-Path $PSScriptRoot 'backup_to_mir.ps1'
}

if (-not (Test-Path -LiteralPath $BackupScript)) {
  throw "Backup script not found: $BackupScript"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$BackupScript`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

Write-Host "Scheduled task created/updated:"
Write-Host "  Name: $TaskName"
Write-Host "  Every: 30 minutes (while logged in)"
Write-Host "  Script: $BackupScript"
