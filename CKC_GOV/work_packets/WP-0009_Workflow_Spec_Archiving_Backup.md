# Work Packet: WP-0009 — Workflow gates + spec archiving + backup docs

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Lock in a strict workflow so CKC rebuild work stays tracked, recoverable, and push-driven:
- Work Packet before coding
- Task Board + Spec updated for every addition
- Commit + push before/after each shippable task
- Document the NAS backup scripts

## Why
We lost the original repo and had a destructive delete incident. CKC needs tight governance:
- all changes are tracked in WPs
- spec stays current
- code stays pushed to GitHub
- backups exist outside the workstation

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Incident record: `CKC_GOV/fail_log/FAIL_LOG.md`
- Backup scripts:
  - `CKC_GOV/scripts/backup_to_mir.ps1`
  - `CKC_GOV/scripts/register_backup_task.ps1`

## Scope
### In
- Update `CKC_GOV/PROJECT_CODEX.md` with:
  - Work Packet first rule
  - commit/push gates
  - spec update + archiving rules
  - backup script documentation
- Ensure Task Board reflects this WP.

### Out
- Implementing product features (handled by other WPs).

## Acceptance criteria
- [x] `CKC_GOV/PROJECT_CODEX.md` documents the workflow gates (WP → Task Board/Spec → commit/push).
- [x] `CKC_GOV/PROJECT_CODEX.md` documents NAS backup scripts + locations.
- [x] `CKC_GOV/taskboard/TASK_BOARD.md` includes WP-0009 with status DONE.

## Test plan
- N/A (documentation + process change only).

