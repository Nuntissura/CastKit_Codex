# Work Packet: WP-0077 — Moodboard: selection power tools (lasso + copy/paste + nudge + context menu)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add pro selection workflows: lasso/box selection, duplicate/copy/paste, keyboard nudging, and a context menu for common layer actions.

## Why
- Moodboards become “slow” without fast selection and duplication tools.
- High ROI UX: makes every other feature feel better.
- Spec: `CastKit_Codex_Spec_v00.052.md` §11.24.

## Scope
### In
- Box select (drag empty space to select multiple).
- Copy/paste/duplicate selection (preserving relative layout).
- Arrow-key nudging (with Shift for bigger step).
- Context menu (right-click) for: duplicate, delete, bring forward/back, group/ungroup.

### Out
- Multi-board clipboard.
- Cross-app paste.

## Acceptance criteria
- [x] Box select works with shapes/images/text.
- [x] Copy/paste duplicates items with new IDs.
- [x] Nudge respects snapping setting (if enabled).
- [x] Context menu actions are undoable.

## Test plan
- [ ] Manual: selection + copy/paste + nudge + context menu.
- [x] `npx tsc --noEmit`
- [x] `npm test`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md`).

## Notes
- Do NOT touch `D:`.
