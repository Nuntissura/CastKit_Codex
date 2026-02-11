# Work Packet: WP-0024 — Spec v00.024: implementation mapping (no governance)

Date: 2026-02-11
Owner: Codex
Status: IN_PROGRESS

## Summary
Cut a new spec version (v00.024) that clarifies how the recovered “isCarousel/isFrontpage” concepts are represented in code, documents libraryRoot + on-disk layout, and removes workflow/repo-governance content from the spec.

## Why
- The session dump is conceptual (`isCarousel`, `isFrontpage`), while the code currently implements these concepts via tags (`carousel`, `frontpage`). This needs to be explicitly mapped so the spec stays the source of truth without rewriting the dump.
- The spec must describe product technical behavior and data layout, but NOT repo workflow/governance (those live in `CKC_GOV/PROJECT_CODEX.md` and `CKC_main/docs/WORKFLOW.md`).

## Scope
### In
- Create `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`:
  - Keep Appendix A (session dump) verbatim.
  - Add an “Implementation mapping” section:
    - `isCarousel` → tag `carousel`
    - `isFrontpage` → tag `frontpage`
    - Global carousel rule: if any `frontpage` images exist, show those, else show `carousel`.
  - Add a “Data layout” section:
    - config file location + default `libraryRoot`
    - library folder structure (db/characters/exports/templates) and per-character paths.
  - Remove workflow/repo-governance/build-artifacts guidance from the spec.
- Archive the previous spec version into `CKC_GOV/spec/archive_spec/`.
- Mirror the new spec into `CKC_main/docs/`.
- Update “current spec” references in onboarding docs to v00.024.

### Out
- Any functional code changes.
- Changing the session dump content.

## Acceptance criteria
- [ ] `CastKit_Codex_Spec_v00.024.md` exists and is the current spec.
- [ ] `CastKit_Codex_Spec_v00.023.md` is moved to `CKC_GOV/spec/archive_spec/`.
- [ ] `CKC_main/docs/CastKit_Codex_Spec_v00.024.md` mirrors the new spec.
- [ ] Onboarding docs reference v00.024 as the current spec.
- [ ] Spec contains no workflow/repo-governance rules (those live outside the spec).

## Test plan
- [ ] `rg "v00\\.023" CKC_GOV CKC_main` shows no “current spec” references remaining (historical WPs may still reference it).
- [ ] Quick human check: spec mapping section correctly points to the implemented tags and rule.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale):
  - update `CKC_GOV/spec/CastKit_Codex_Spec_v*.md` (version bump + changelog entry)
  - mirror into `CKC_main/docs/`
- [ ] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`
  - `CKC_GOV/spec/archive_spec/`
  - `CKC_main/docs/CastKit_Codex_Spec_v00.024.md`
  - `CKC_GOV/PROJECT_CODEX.md` + `CKC_main/docs/PROJECT_CODEX.md` (reference updates)
  - `CKC_main/docs/WORKFLOW.md` (reference updates)

## Risks / mitigations
- Risk: accidental session dump edits while moving content.
  - Mitigation: copy Appendix A from `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md` and do not modify it.

## Rollback
Revert the commits associated with WP-0024.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

