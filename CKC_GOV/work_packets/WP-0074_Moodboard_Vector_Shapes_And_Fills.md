# Work Packet: WP-0074 — Moodboard: vector shapes + per-layer fills (solid/gradient)

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Add vector shape layers (rect/ellipse) to the moodboard and allow bucket/gradient tools to apply fills to selected shapes (instead of only the background).

## Why
- Moodboards need non-destructive design primitives (cards, frames, highlight boxes).
- Gradients should be usable inside shapes without affecting other layers.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.21 and “Moodboard canvas”.

## Scope
### In
- New moodboard layer type: vector shapes (rect/ellipse).
- Bucket tool:
  - Applies solid fill to selected shapes (if any).
  - Otherwise fills background (existing behavior).
- Gradient tool:
  - Applies gradient fill to selected shapes (if any) with live drag preview.
  - Otherwise sets background gradient (existing behavior).
- Layers panel:
  - Shapes appear alongside images/text.
  - Hide/lock and reorder within the moodboard.
- Shapes participate in:
  - Move + transform (resize)
  - Arrange tools (align/distribute/tidy)
  - Group/ungroup

### Out
- Complex vector path editing (Bezier, boolean ops).
- Rotation (tracked separately).
- Advanced styling (blend modes/shadows) (tracked separately).

## Acceptance criteria
- [ ] Can create rect/ellipse shape layers.
- [ ] Bucket fills selected shapes without changing background.
- [ ] Gradient fills selected shapes without changing background, with live preview.
- [ ] Shapes can be moved/resized, reordered, hidden/locked.

## Test plan
- [ ] Manual: create shapes, apply bucket+gradient, reorder vs images/text, hide/lock, resize, undo/redo.
- [ ] Add/extend unit tests if feasible (state persistence + tool behavior).

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored:
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.051.md`
  - mirror into `CKC_main/docs/`
- [ ] Session dump alignment: no conflicts; representation documented in spec.

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/components/MoodboardCanvas.tsx`
  - `CKC_main/src/ui/components/moodboardCanvas.module.css` (if needed)
- Data model changes:
  - Extend moodboard JSON with `shapes?: MoodboardShape[]` (backwards compatible).
- IPC/API changes:
  - None (moodboard stored as JSON doc content).

## Risks / mitigations
- Risk: breaking older saved moodboards.
  - Mitigation: normalize/migrate missing `shapes` to empty list; keep optional fields.

## Rollback
- Revert changes in `MoodboardCanvas.tsx`; existing moodboards remain readable (shapes data would be ignored).

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

