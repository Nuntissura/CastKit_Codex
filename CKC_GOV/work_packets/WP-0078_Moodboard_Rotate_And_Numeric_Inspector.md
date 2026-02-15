# Work Packet: WP-0078 — Moodboard: rotate tool + numeric inspector

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add rotation support for layers and an optional numeric inspector (x/y/w/h/rotation) for precise layout.

## Why
- Without rotation and numeric edit, moodboards hit a ceiling fast.
- Spec: `CastKit_Codex_Spec_v00.052.md` §11.25.

## Scope
### In
- Rotation property for images/text/shapes.
- Rotate tool or rotation handle in Transform mode.
- Optional inspector panel for numeric editing.

### Out
- Skew/perspective transforms.

## Acceptance criteria
- [x] Can rotate a selected layer and undo/redo.
- [x] Inspector edits are applied deterministically.

## Test plan
- [ ] Manual: rotate several layers, verify hit-test and transform still works.
- [x] `npx tsc --noEmit`
- [x] `npm test`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md`).

## Notes
- Do NOT touch `D:`.
