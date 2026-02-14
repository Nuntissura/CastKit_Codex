# Work Packet: WP-0048 - Moodboard layers

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a minimal, useful layers system to the Moodboard:
- List elements (starting with images; later extend to text).
- Reorder (bring forward/back).
- Hide/show.
- Lock/unlock (prevent accidental moves).
- Make “Ink” (strokes) behave like a layer (hide/lock).

## Why
- Moodboards get messy quickly without z-order control.
- Hide/lock prevents accidental edits while arranging.

## Scope
### In
- A `Layers` panel/toggle in the Moodboard toolbar.
- Z-order changes for images (array order).
- Persist per-image layer flags (`hidden`, `locked`, `name`).
- Persist ink layer flags (`strokesHidden`, `strokesLocked`).

### Out
- Drag-and-drop reordering (optional later).
- Advanced blend modes (later).

## Acceptance criteria
- [x] Layers panel can be opened/closed.
- [x] Selected image can be moved up/down/top/bottom in stack.
- [x] Hidden images do not render or receive hit-testing.
- [x] Locked images cannot be moved/resized.
- [x] Ink layer can be hidden/locked.

## Test plan
- [x] Manual: add multiple images; reorder; verify draw order.
- [x] Manual: hide/lock images; verify behavior.
- [x] Manual: toggle ink hidden; verify strokes visibility.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or “No spec impact” with rationale).
