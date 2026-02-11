# Work Packet: WP-0019 - Drive-letter agnostic paths (docs + backup scripts)

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Remove hard-coded drive-letter paths from onboarding docs and operational scripts so CKC can run from any disk letter (for example when moving from `K:` to `P:`).

## Inputs
- Existing docs/scripts that referenced `K:\\CastKit Codex\\...` directly.
- Planned external-disk drive-letter changes.

## Changes
- Docs: replaced `K:\\CastKit Codex\\...` with `<CKC_ROOT>\\...` and/or relative paths in onboarding/workflow docs.
- Backup scripts:
  - `CKC_GOV/scripts/backup_to_mir.ps1` now defaults `SourceRoot` from `$env:CKC_ROOT` or from the script location (`$PSScriptRoot\\..\\..`).
  - `CKC_GOV/scripts/register_backup_task.ps1` no longer hard-codes the backup script path.
- Packaging metadata:
  - `CKC_main/scripts/package_win.ps1` now writes drive-letter agnostic paths into `LATEST_BUILD.txt` and per-build `manifest.json`.

## Acceptance criteria
- [x] `rg "\\b[A-Z]:\\\\"` finds no drive-letter absolute paths in onboarding docs and scripts.
- [x] Backup script can run without explicitly passing `-SourceRoot` when invoked from `CKC_GOV/scripts/`.
- [x] `LATEST_BUILD.txt` and `manifest.json` avoid embedding drive-letter paths.

## Test plan
- [x] `rg -n "\\b[A-Z]:\\\\" -S CKC_main --glob "!**/node_modules/**"` returns no matches.
- [x] `rg -n "\\b[A-Z]:\\\\" -S CKC_GOV --glob "!CKC_GOV/targets/**"` returns no matches.
