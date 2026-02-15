param(
  [string]$TaskName = 'CKC_Backup_To_MIR',
  [switch]$Enable,
  [switch]$Delete
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "Scheduled task not found: $TaskName"
  exit 0
}

if ($Enable) {
  Enable-ScheduledTask -TaskName $TaskName | Out-Null
  Write-Host "Scheduled task enabled: $TaskName"
  exit 0
}

if ($Delete) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Scheduled task removed: $TaskName"
  exit 0
}

Disable-ScheduledTask -TaskName $TaskName | Out-Null
Write-Host "Scheduled task disabled: $TaskName"
Write-Host "Re-enable: powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\\unregister_backup_task.ps1`" -Enable"
Write-Host "Remove:    powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\\unregister_backup_task.ps1`" -Delete"
Write-Host "Recreate:  powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\\register_backup_task.ps1`""
