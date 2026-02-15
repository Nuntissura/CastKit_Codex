# Work Packet: WP-0076 — Moodboard: vector masks / clipping frames

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Allow an image layer to be clipped by a vector shape (frame/mask) so gradients/shapes can act as masks without affecting other layers.

## Why
- “Frames” are the backbone of Milanote/Figma-style boards.
- Operator wants gradients inside shapes and masking without touching background or other layers.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.23 and “Moodboard canvas”.

## Scope
### In
- A shape can act as a mask for a single image layer (non-destructive).
- UI to apply/remove a mask (frame) for a selected image.
- Rendering clips the image to the mask shape.

### Out
- Complex multi-mask stacks.
- Vector path editing beyond rect/ellipse masks.

## Acceptance criteria
- [x] Can mask an image with a rect/ellipse shape.
- [x] Masked image can still be moved/resized independently (or as a frame unit).
- [x] Undo/redo covers mask apply/remove.

## Test plan
- [ ] Manual: apply/remove mask; export moodboard PNG; verify clipping.
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (no changes required beyond spec v00.051).

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/components/MoodboardCanvas.tsx`
- Data model changes:
  - Add `mask?: { shapeId: string }` to image layers OR define `frameId` relation (decide during implementation).

## Notes
- Do NOT touch `D:`.
