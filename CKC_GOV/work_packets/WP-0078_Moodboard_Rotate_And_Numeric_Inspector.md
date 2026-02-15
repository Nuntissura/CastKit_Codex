# Work Packet: WP-0078 — Moodboard: rotate tool + numeric inspector

Date: 2026-02-15
Owner: Codex
Status: BACKLOG

## Summary
Add rotation support for layers and an optional numeric inspector (x/y/w/h/rotation) for precise layout.

## Why
- Without rotation and numeric edit, moodboards hit a ceiling fast.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.25.

## Scope
### In
- Rotation property for images/text/shapes.
- Rotate tool or rotation handle in Transform mode.
- Optional inspector panel for numeric editing.

### Out
- Skew/perspective transforms.

## Acceptance criteria
- [ ] Can rotate a selected layer and undo/redo.
- [ ] Inspector edits are applied deterministically.

## Test plan
- [ ] Manual: rotate several layers, verify hit-test and transform still works.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (if changes beyond spec v00.051 are required).

## Notes
- Do NOT touch `D:`.

