# Work Packet: WP-0091 - Governance Canonical Docs Cleanup

Date: 2026-05-04
Owner: Codex
Status: DONE

## Summary
Remove stale governance mirrors from product docs and make `CKC_GOV/` the only canonical governance location.

## Why
`CKC_GOV/PROJECT_CODEX.md` now defines the repo split: `CKC_main/` is product code, `CKC_GOV/` is governance. Old mirror references create drift and conflict with the current operating model.

## Scope
### In
- Remove or accept removal of `CKC_main/docs/` governance mirrors.
- Update stale references in the WP template and style guide that mention mirroring to `CKC_main/docs/`.
- Keep `AGENTS.md` short and pointed at `CKC_GOV/PROJECT_CODEX.md`.
- Document the no-spaces rule for filenames, folders, and artifacts in canonical governance.
- Rename current governance paths that still contain spaces when they are in scope and safe to change.

### Out
- Product behavior changes.
- Rewriting historical archived specs except where a current pointer is wrong.

## Acceptance criteria
- [x] No current governance instruction requires mirroring files into `CKC_main/docs/`.
- [x] `CKC_GOV/PROJECT_CODEX.md` remains the authority.
- [x] Current templates mention `CKC_GOV/` only for governance.
- [x] Current canonical governance paths changed by this WP do not contain spaces.

## Test plan
- [x] Search current docs for `CKC_main/docs` and `mirror`.
- [x] Review `git status` to confirm only intended governance/doc changes.

## Governance checklist
- [x] Task Board updated with this WP status.
- [x] Spec updated to `CastKit_Codex_Spec_v00.060.md`; previous v00.059 archived.
- [x] Session dump alignment checked; no conflict expected.

## Result
- `CKC_GOV/PROJECT_CODEX.md` remains the canonical governance authority.
- `CKC_main/docs/` governance mirrors are removed from the product tree.
- `CKC_GOV/templates/character sheet templates/` was renamed to `CKC_GOV/templates/character_sheet_templates/`.
- Current references now point at `CastKit_Codex_Spec_v00.060.md`.

## Implementation notes
- Key files to touch:
  - `CKC_GOV/PROJECT_CODEX.md`
  - `CKC_GOV/work_packets/WP_TEMPLATE.md`
  - `CKC_GOV/references/style_guide/UI_STYLE_GUIDE.md`
  - `CKC_GOV/templates/character_sheet_templates/`
  - `AGENTS.md`
- Data model changes: none.
- IPC/API changes: none.

## Risks / mitigations
- Risk: deleting product docs that still contain unique information.
- Mitigation: verify canonical copies exist in `CKC_GOV/` before accepting deletion.

## Rollback
Restore removed mirror docs from git if unique content is discovered.
