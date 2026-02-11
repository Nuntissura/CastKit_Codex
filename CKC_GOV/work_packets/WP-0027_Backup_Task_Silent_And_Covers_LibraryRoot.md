# Work Packet: WP-0027 — Backup task: silent + covers libraryRoot

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Make the scheduled NAS mirror backup run without stealing focus (no popups), improve backup logs/health visibility, and ensure the backup includes the active `libraryRoot` (or warns loudly if it’s outside `<CKC_ROOT>`).

## Why
- The scheduled task currently interrupts writing by popping up a PowerShell window.
- If `libraryRoot` points outside `<CKC_ROOT>`, it may not be included in the NAS mirror, which defeats the purpose of a “safe recovery”.

## Scope
### In
- Update `CKC_GOV/scripts/register_backup_task.ps1` to create a truly background scheduled task (hidden window) and to log success/failure reliably.
- Extend `CKC_GOV/scripts/backup_to_mir.ps1` so it:
  - reads `libraryRoot` from the app config (if available)
  - mirrors both `<CKC_ROOT>` and `libraryRoot` (if distinct), or writes a clear warning and exit code if it can’t
- Update Project Codex docs accordingly (spec stays free of governance).

### Out
- Building a full backup UI inside the app.

## Acceptance criteria
- [x] Scheduled backup does not interrupt foreground work (no visible console).
- [x] Backup logs clearly show what paths were mirrored and the result.
- [x] If `libraryRoot` is outside `<CKC_ROOT>`, backup behavior is safe and explicit (mirror it or warn).

## Test plan
- [ ] Manual: register task, observe no popups during runs.
- [ ] Manual: change `libraryRoot` and confirm backup includes it or warns.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec impact: none (backup/workflow only).

## Implementation notes
- Key files to touch:
  - `CKC_GOV/scripts/register_backup_task.ps1`
  - `CKC_GOV/scripts/backup_to_mir.ps1`
  - `CKC_GOV/PROJECT_CODEX.md` + `CKC_main/docs/PROJECT_CODEX.md`

## Risks / mitigations
- ROBOCOPY `/MIR` is destructive on the destination. Mitigate by logging and keeping the destination path explicit.

## Rollback
Revert commits associated with WP-0027.
