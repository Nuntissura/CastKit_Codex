# WP-0036 — Backup task: no popups (background) + easy enable/disable

Date: 2026-02-12
Owner: Codex
Status: DONE

## Summary
Eliminate any focus-stealing/popup behavior from the scheduled backup task so it can run in the background while writing/working, and make it easy to toggle on/off.

## Motivation / context
The backup scheduler “keeps popping up” and interrupts writing/tasks. Backups must be reliable AND invisible.

## Scope
- Audit the Scheduled Task created by `CKC_GOV/scripts/register_backup_task.ps1`:
  - confirm hidden window execution (`-WindowStyle Hidden`)
  - confirm task settings don’t surface UI
  - confirm errors are logged instead of prompting
- Add a companion script to disable/remove the task cleanly (proposed):
  - `CKC_GOV/scripts/unregister_backup_task.ps1`
- Update governance docs with:
  - how to verify the task is running hidden
  - how to temporarily disable it while debugging

## Non-goals
- Replacing ROBOCOPY `/MIR` with a different backup strategy.
- Cloud backup / offsite automation (separate effort).

## Acceptance criteria
- [x] Scheduled backups run without opening windows or interrupting typing/focus.
- [x] Logs are written to `CKC_GOV/targets/backup_logs/` and errors are discoverable there.
- [x] A simple script exists to unregister/disable the task and can be reversed by re-registering.

## Test plan
- [ ] Manual: register task, wait for at least one scheduled run, confirm no visible popup.
- [ ] Manual: check `CKC_GOV/targets/backup_logs/LAST_RUN.txt` updated.
- [ ] Manual: unregister task and confirm it stops running.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: no (workflow/governance only).
