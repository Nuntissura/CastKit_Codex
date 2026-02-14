# Work Packet: WP-0050 - Moodboard undo/redo history

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add real undo/redo:
- One history stack for strokes + moves + background changes + deletions.
- UI buttons and hotkeys (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`).

## Why
- Current “undo stroke / undo last image” is too limited and punishing.

## Scope
### In
- History stack scoped to a moodboard editing session.
- Coalescing: dragging/resizing commits one history entry per gesture (not every pointer move).

### Out
- Persisted history across app restarts (not needed).

## Acceptance criteria
- [x] Undo/redo works for move + draw + delete + background.
- [x] Hotkeys work and do not interfere with text editing fields.

## Test plan
- [x] Manual: make 10 edits; undo/redo through all.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated with this WP status.
- [x] Spec updated + mirrored.
