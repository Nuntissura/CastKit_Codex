# Work Packet: WP-0075 — Moodboard: vector connectors (line/arrow layers)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add vector connector layers (lines/arrows) that can be selected/moved/transformed and reordered like other moodboard layers.

## Why
- Moodboards become useful for flows, relationships, and diagramming (not just collage).
- Connectors need to be editable objects, not only ink strokes.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.22.

## Scope
### In
- New moodboard layer type: connector (line/arrow).
- Basic styling: stroke color + width.
- Connectors participate in layers panel, selection, move/transform, undo/redo.

### Out
- Auto-routing.
- Endpoint attachment to objects (optional later).

## Acceptance criteria
- [x] Can create a connector and edit its endpoints.
- [x] Connectors can be reordered/hidden/locked.
- [x] Undo/redo covers connector edits.

## Test plan
- [ ] Manual: create/edit connectors; reorder; hide/lock; undo/redo.
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (no changes required beyond spec v00.051).

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/components/MoodboardCanvas.tsx`
- Data model changes:
  - Extend moodboard JSON with `connectors?: MoodboardConnector[]`.

## Notes
- Do NOT touch `D:`.
