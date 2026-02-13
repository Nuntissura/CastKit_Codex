# Incident: INC-2026-02-10-001 - Destructive delete executed against drive root

Date: 2026-02-10
Severity: HIGH
Tags: destructive-delete, cmd, powershell, recovery
Status: CLOSED
Owner: (unknown)
Projects: CastKit Codex

## What happened
- A cleanup attempt intended to delete only build artifact folders (`release_build*`, `dist`, etc.) accidentally executed a `cmd` `rmdir` call that included `\` (drive root).
- Result: deletion was attempted broadly on `D:`. Many paths failed with access/in-use errors, but significant data was removed.

## Impact
- Loss of the original CKC source repo and other data on `D:`.

## Root cause
- Used a `cmd` batch loop (`for /d ... rmdir /s /q ...`) invoked from PowerShell.
- Quoting/escaping was incorrect, causing `rmdir` to receive `\` (root) as a path argument.

## Fix / recovery
- A beginner-friendly recovery walkthrough was written to: `CKC_GOV/fail_log/DATA_RECOVERY_R_STUDIO_GUIDE.md`.

## Prevention / guardrails
- Do not run destructive deletes via `cmd` loops.
- Prefer PowerShell `Remove-Item -LiteralPath ... -WhatIf` first.
- Always enumerate targets explicitly and print them before deletion.
- Perform cleanup only in a dedicated workspace (the CKC work drive, e.g. `<CKC_ROOT>`), never on recovery drives.

## Links / evidence
- `CKC_GOV/fail_log/FAIL_LOG.md` (original narrative entry)
- `CKC_GOV/fail_log/DATA_RECOVERY_R_STUDIO_GUIDE.md`

