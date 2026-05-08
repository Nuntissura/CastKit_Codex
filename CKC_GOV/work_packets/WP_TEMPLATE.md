# Work Packet: WP-XXXX — <Title>

Date: YYYY-MM-DD
Owner: <name>
Status: BACKLOG | IN_PROGRESS | BLOCKED | DONE

## Implementation contract (MUST)
- [ ] Read `CKC_GOV/build_rules.md` before drafting/implementation. This is a deferred read for WP work, not a session-startup read.

## Summary
One paragraph describing what ships.

## Why
What problem this solves; link to spec/session dump sections.

## Field research / prior art
- Research applicability: REQUIRED | NOT APPLICABLE
- Sources checked:
  -
- Findings:
  -
- Impact on WP design:
  -

## Scope
### In
- 

### Out
- 

## Acceptance criteria
- [ ] 

## Test plan
- [ ] Unit tests (if applicable)
- [ ] Manual verification steps

## Governance checklist (MUST)
- [ ] Build rules contract satisfied: `CKC_GOV/build_rules.md` was read before implementation and any exceptions are documented in this WP.
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated (or explicitly “No spec impact” with rationale):
  - update `CKC_GOV/spec/CastKit_Codex_Spec_v*.md` (version bump + changelog entry)
- [ ] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - 
- Data model changes:
  - 
- IPC/API changes:
  - 

## Risks / mitigations
- 

## Rollback
How to revert safely.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Keep all work under `<CKC_ROOT>` unless explicitly requested.
- Do not introduce spaces in file names, folder names, or generated artifact names.

