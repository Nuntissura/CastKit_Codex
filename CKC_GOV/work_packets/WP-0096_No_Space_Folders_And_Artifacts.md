# Work Packet: WP-0096 - No-Space Folders And Generated Artifacts

Date: 2026-05-05
Owner: Codex
Status: DONE

## Summary
Remove blank spaces from the CKC checkout name, repo-local file/folder names, default app data folder, generated export/backup names, and packaging artifact names.

## Why
The repo already requires no spaces in filenames, folder names, and generated artifact names. The current checkout, default `libraryRoot`, packaging config, export sanitizers, and some repo-local ignored assets still violated that rule.

## Scope
### In
- Rename the checkout folder from `CastKit Codex` to `CastKit-Codex`.
- Update repo-local path references that pointed at the old checkout name.
- Update Electron packaging config/scripts so generated installer, portable, DMG, and ZIP names use no-space names.
- Update app default `libraryRoot` from `CastKit Codex Library` to `CastKit-Codex-Library`.
- Make export and backup filename/folder sanitizers replace blanks with `_`.
- Rename existing space-bearing files/folders inside the CKC checkout where safe.

### Out
- Do not touch sibling projects under `D:\Projects\LLM projects`.
- Do not rewrite user-entered character/template content.
- Do not remove branding/display copy solely because it contains spaces.

## Acceptance Criteria
- [x] Top-level checkout folder has no spaces.
- [x] No repo-local file/folder path under CKC contains blank spaces.
- [x] New app-generated library, export, backup, and packaging artifact names do not contain blank spaces.
- [x] Relevant tests cover generated export/backup path names.

## Test Plan
- [ ] `npm test` timed out in this Node/sqlite environment before reporting pass/fail.
- [x] `node --test --test-force-exit test/backend_export_hub.test.js`
- [x] `node --test --test-force-exit test/backend_backup_restore.test.js`
- [x] `npx tsc --noEmit`
- [x] Path inventory scan for blank-space file/folder names inside CKC.

## Governance Checklist
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated:
  - update `CKC_GOV/spec/CastKit_Codex_Spec_v00.064.md`
- [x] Session dump alignment: no conflict; this tightens repo naming hygiene and generated path behavior only.

## Implementation Notes
- Key files:
  - `CKC_main/app/main.js`
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/backend/backup.js`
  - `CKC_main/package.json`
  - `CKC_main/scripts/package_win.ps1`
  - `CKC_main/scripts/package_mac.sh`
  - `CKC_GOV/scripts/backup_to_mir.ps1`
- Data model changes: none.
- IPC/API changes: none.

## Risks / Mitigations
- Existing user configs may still point at a prior `CastKit Codex Library`; do not rewrite external user data automatically.
- Existing ignored build artifacts may have space-bearing historical names; new packaging config prevents recurrence.

## Rollback
Revert the source/config changes and rename `CastKit-Codex` back to `CastKit Codex` if required.
