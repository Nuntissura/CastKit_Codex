# Work Packet: WP-0053 - Moodboard zoom/pan + grid/snap

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add navigation + layout helpers:
- Zoom in/out (mousewheel + buttons).
- Pan (spacebar drag or hand tool).
- Optional grid overlay and snap-to-grid.

## Why
- Precision layout is hard without zoom/pan.
- Grid/snap helps align reference boards fast.

## Scope
### In
- View transform (zoom + pan) in the canvas renderer.
- Pointer mapping that respects zoom/pan.
- Grid overlay + snap toggle.

### Out
- Infinite canvas (later).

## Acceptance criteria
- [x] Zoom and pan work without breaking drawing/move.
- [x] Grid overlay toggle exists.
- [x] Snap-to-grid toggle affects move/transform.

## Test plan
- [x] Manual: zoom/pan and move items precisely.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated with this WP status.
- [x] Spec updated + mirrored.
