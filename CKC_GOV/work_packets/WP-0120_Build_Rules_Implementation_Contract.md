# Work Packet: WP-0120 — Deferred build rules implementation contract

Date: 2026-05-08
Owner: Codex
Status: DONE

## Implementation contract (MUST)
- [x] Read `CKC_GOV/build_rules.md` before drafting/implementation. This WP created the file and applies the contract to future WPs.

## Summary
Create `CKC_GOV/build_rules.md` as a deferred implementation/build contract, link it from the Project Codex, reinforce it at the top of the Task Board, and update the WP template so future WPs must explicitly confirm the file was read.

## Why
The startup binding contract is already large. Build, verification, PostgreSQL-first testing, artifact placement, visual-debugger gates, and WP implementation rules should be available as a focused implementation contract without bloating every session bootstrap.

## Field research / prior art
Not applicable. This is a trivial governance/template change requested by the operator, not a technical implementation WP.

## Scope
### In
- Add `CKC_GOV/build_rules.md`.
- Link `build_rules.md` from `CKC_GOV/PROJECT_CODEX.md` as a deferred implementation contract.
- Reinforce the rule at the top of `CKC_GOV/taskboard/TASK_BOARD.md`.
- Update `CKC_GOV/work_packets/WP_TEMPLATE.md` so every future WP has a build-rules checklist item.

### Out
- Product code changes.
- Spec behavior changes.
- Adding `build_rules.md` to startup bootstrap reads.

## Acceptance criteria
- [x] `CKC_GOV/build_rules.md` exists.
- [x] `PROJECT_CODEX.md` links `build_rules.md` without adding it to the startup read list.
- [x] Task Board top block states the WP implementation gate.
- [x] WP template includes an explicit build-rules checklist item.

## Test plan
- [x] Governance file inspection.
- [x] No automated product tests required; no product code changed.

## Governance checklist (MUST)
- [x] Build rules contract satisfied: `CKC_GOV/build_rules.md` was created and linked as the deferred implementation contract.
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated: No spec impact. This changes governance workflow only, not product behavior.
- [x] Session dump alignment: no conflict; this is a new operator-directed governance rule.

## Implementation notes
- Key files touched:
  - `CKC_GOV/build_rules.md`
  - `CKC_GOV/PROJECT_CODEX.md`
  - `CKC_GOV/taskboard/TASK_BOARD.md`
  - `CKC_GOV/work_packets/WP_TEMPLATE.md`
- Data model changes: none.
- IPC/API changes: none.

## Risks / mitigations
- Risk: agents treat `build_rules.md` as part of startup bootstrap and bloat context.
- Mitigation: The file, Project Codex, Task Board, and WP template all state that this is a deferred read for WP work.

## Rollback
Remove `CKC_GOV/build_rules.md` and revert the Project Codex, Task Board, and WP template references.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Keep all work under `<CKC_ROOT>` unless explicitly requested.
- Do not introduce spaces in file names, folder names, or generated artifact names.
