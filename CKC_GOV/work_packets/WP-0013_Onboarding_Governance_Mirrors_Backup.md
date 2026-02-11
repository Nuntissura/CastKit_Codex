# Work Packet: WP-0013 — New dev onboarding + governance mirrors + NAS backup usage

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Make it obvious for any new coder how to work in this repo:
- where governance lives (`CKC_GOV`)
- the required workflow (WP -> Spec -> Git)
- commit/push conventions
- how to run the NAS mirror backup script
- mirrored governance docs inside `CKC_main/docs/` for GitHub visibility

## Why
This project has a strict separation between code (`CKC_main`) and governance/targets (`CKC_GOV`). New contributors must follow the workflow so work stays recoverable and safe.

## Scope
### In
- Update `CKC_GOV/PROJECT_CODEX.md` with a "New developer" onboarding section and backup commands.
- Mirror governance docs into the git repo under `CKC_main/docs/`:
  - `PROJECT_CODEX.md`
  - `TASK_BOARD.md`
- Update `CKC_main/README.md` and `CKC_main/docs/WORKFLOW.md` to point to the right files and include typical commands.

### Out
- Changing the underlying workflow rules (only documenting the current rules).

## Acceptance criteria
- [x] A new dev can find the correct governance files and workflow from GitHub (via `CKC_main/docs/`).
- [x] Backup script usage is documented, including where logs live.
- [x] Commit/push commands and WP ID convention are documented.

## Test plan
- [ ] N/A (docs-only)

## Rollback
- Revert docs changes and remove mirrored files from `CKC_main/docs/`.
