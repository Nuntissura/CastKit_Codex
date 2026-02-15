# Work Packet: WP-0071 — Moodboard arrange tools

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Add basic arrange tools for moodboard selections: align, distribute, group/ungroup, and a simple auto-pack “tidy” action.

## Why
- Huge UX win once boards get busy (Milanote-like productivity).
- Complements existing layers + transform tools.
- Spec: `CastKit_Codex_Spec_v00.047.md` §11.18.

## Scope
### In
- Align: left/center/right, top/middle/bottom.
- Distribute: horizontal/vertical.
- Group/ungroup (treat as a single selectable unit).
- Auto-pack (“tidy selection”) with a simple deterministic layout.
- All operations undoable.

### Out
- Constraints/auto-layout systems.
- Advanced snapping guides.

## Acceptance criteria
- [ ] Arrange actions work on multi-select and are undoable.
- [ ] Group behaves as a single unit for move/transform.

## Test plan
- [ ] Manual: add 5+ items, align/distribute, group/ungroup, undo/redo.

## Notes
- Do NOT touch `D:`.
