# CKC — Fail / Incident Log (append-only)

This log exists so future work can avoid repeating mistakes.

## 2026-02-10 — Destructive delete executed against drive root (at the time: D:)
**What happened**
- A cleanup attempt intended to delete only build artifact folders (`release_build*`, `dist`, etc.) accidentally executed a `cmd` `rmdir` call that included `\` (drive root).
- Result: deletion was attempted broadly on `D:`. Many paths failed with access/in-use errors, but significant data was removed.

**Root cause**
- Used a `cmd` batch loop (`for /d ... rmdir /s /q ...`) invoked from PowerShell.
- Quoting/escaping was incorrect, causing `rmdir` to receive `\` (root) as a path argument.

**Impact**
- Loss of the original CKC source repo and other data on `D:`.

**Mitigations / new rules**
- Do not run destructive deletes via `cmd` loops.
- Prefer PowerShell `Remove-Item -LiteralPath ... -WhatIf` first.
- Always enumerate targets explicitly and print them before deletion.
- Perform cleanup only in a dedicated workspace (the CKC work drive, e.g. `<CKC_ROOT>`), never on recovery drives.

**Recovery help**
- A beginner-friendly recovery walkthrough was written to: `CKC_GOV/fail_log/DATA_RECOVERY_R_STUDIO_GUIDE.md`.

