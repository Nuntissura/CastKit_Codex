# Work Packet: WP-0010 — Record open-question decisions (shortcuts + storage + frontpage)

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Capture decisions that resolve the open questions in the recovered session dump and roll them into the current spec.

## Why
The session dump ends with “Open questions to decide during rebuild”. These decisions should live in the current spec so future work packets can implement consistently.

Inputs:
- `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`

## Scope
### In
- Record rating assignment shortcuts: Right Alt + 1–5.
- Decide docs/moodboard persistence strategy: DB-first.
- Capture a tentative rule for global carousel selection using `isFrontpage` vs `isCarousel`.
- Bump spec version and mirror into `CKC_main/docs/`.
- Update Task Board to include this WP.

### Out
- Implementing ratings, docs, or carousel behavior (handled by feature WPs).

## Acceptance criteria
- [x] `CKC_GOV/spec/CastKit_Codex_Spec_v00.020.md` exists and includes the decisions.
- [x] `CKC_main/docs/CastKit_Codex_Spec_v00.020.md` matches the current spec content.
- [x] `CKC_GOV/taskboard/TASK_BOARD.md` includes WP-0010 with status DONE.

## Test plan
- N/A (documentation + governance only).

## Implementation notes
- Kept `SESSION_DUMP_2026-02-10.md` unchanged; decisions are captured in the spec as a post-session section.

## Risks / mitigations
- Risk: `isFrontpage` selection rule may change. Mitigation: marked as tentative in spec; revisit when implementing WP-0003.

## Rollback
- Revert to `CKC_GOV/spec/archive_spec/CastKit_Codex_Spec_v00.019.md` and re-point references (not recommended).

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
