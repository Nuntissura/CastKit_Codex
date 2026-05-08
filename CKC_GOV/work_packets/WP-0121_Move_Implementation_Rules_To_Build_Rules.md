# Work Packet: WP-0121 - Move Implementation Rules To Build Rules

Date: 2026-05-08
Owner: Codex
Status: DONE

## Implementation contract (MUST)
- [x] Read `CKC_GOV/build_rules.md` before drafting/implementation. This is a deferred read for WP work, not a session-startup read.

## Summary
Move strong implementation/build candidates out of `CKC_GOV/PROJECT_CODEX.md` and into `CKC_GOV/build_rules.md`, while keeping session startup and general working-process rules in Codex. Reinforce PostgreSQL-first testing, research-first methodology, and spec maintenance in the build rules contract.

## Why
`PROJECT_CODEX.md` had grown into a mixed startup guide, working-process guide, and implementation contract. The operator decided that implementation rules should live in `build_rules.md`, read only when drafting or implementing WPs, so session startup stays lighter while WP execution stays governed.

## Field research / prior art
- Research applicability: NOT APPLICABLE
- Rationale: Governance-only rule relocation. No product behavior, external library choice, architecture technique, or runtime implementation changed.

## Scope
### In
- Move or mirror the strong implementation-rule candidates into `CKC_GOV/build_rules.md`.
- Move detailed PostgreSQL-first testing requirements into `CKC_GOV/build_rules.md`.
- Copy and reinforce research-first methodology so every WP accounts for research and non-trivial WPs do real field research.
- Copy and reinforce spec-maintenance requirements in `CKC_GOV/build_rules.md`.
- Keep remaining startup, taskboard, commit/push, and working-process guidance in `PROJECT_CODEX.md`.
- Update the WP template with a required field-research section.
- Update the Task Board status and current-focus notes.

### Out
- Product code changes.
- Spec behavior changes.
- Test harness conversion work; WP-0119 remains the planned implementation WP for PostgreSQL-first test conversion and SQLite quarantine/removal decisions.

## Acceptance criteria
- [x] `build_rules.md` contains detailed rules for PostgreSQL-first testing, app-driving automation, visual verification, test-suite maintenance, internal-manual maintenance, spec maintenance, packaging/release, and research-first WP planning.
- [x] `PROJECT_CODEX.md` keeps concise pointers to `build_rules.md` for deferred implementation/build rules.
- [x] `WP_TEMPLATE.md` includes `## Field research / prior art`.
- [x] Task Board records WP-0121 as done.
- [x] No product code or spec behavior changed.

## Test plan
- [x] Governance diff inspection.
- [x] `git diff --check` for touched governance files.
- [x] Text search for moved headings and build-rules references.

## Governance checklist (MUST)
- [x] Build rules contract satisfied: `CKC_GOV/build_rules.md` was read before implementation and any exceptions are documented in this WP.
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated (or explicitly "No spec impact" with rationale): No spec impact because this changes governance only, not CKC product behavior.
- [x] Session dump alignment: no conflicts; this WP implements the operator instruction from 2026-05-08 to move strong implementation candidates into build rules while keeping other working process in Codex.

## Implementation notes
- Key files touched:
  - `CKC_GOV/PROJECT_CODEX.md`
  - `CKC_GOV/build_rules.md`
  - `CKC_GOV/taskboard/TASK_BOARD.md`
  - `CKC_GOV/work_packets/WP_TEMPLATE.md`
- Data model changes: none.
- IPC/API changes: none.

## Risks / mitigations
- Risk: duplicated research/spec language can drift.
- Mitigation: Codex keeps high-level methodology and pointers; `build_rules.md` is the deferred implementation contract agents must read for WP execution.

## Rollback
Revert this WP commit to restore the previous governance split.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Keep all work under `<CKC_ROOT>` unless explicitly requested.
- Do not introduce spaces in file names, folder names, or generated artifact names.
