# Work Packet: WP-0049 - Moodboard transform tool (resize/rotate)

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a transform tool for moodboard items:
- Resize handles for selected image/text.
- Optional rotation handle.
- Modifiers: `Shift` keep aspect, `Alt` resize from center.

## Why
- “Move-only” is limiting; moodboards need quick layout control.

## Scope
### In
- Transform tool mode (or transform handles while in Move).
- Visual handles on canvas.
- Persist per-item transform state (w/h; rotation optional).

### Out
- Perspective/skew transforms (later).

## Acceptance criteria
- [x] Selected image can be resized with handles.
- [x] Aspect lock works with `Shift`.
- [x] Locked items cannot be transformed.

## Test plan
- [x] Manual: resize multiple images with/without aspect lock.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated with this WP status.
- [x] Spec updated + mirrored.
