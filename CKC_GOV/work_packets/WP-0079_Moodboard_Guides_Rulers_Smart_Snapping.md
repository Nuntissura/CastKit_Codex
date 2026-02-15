# Work Packet: WP-0079 — Moodboard: guides/rulers + smart snapping

Date: 2026-02-15
Owner: Codex
Status: BACKLOG

## Summary
Add rulers and guides plus smart snapping/alignment lines (center/edges/gaps) to enable precise layouts.

## Why
- Grid snap is helpful but not enough for real composition work.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.26.

## Scope
### In
- Rulers along top/left.
- Add/move/remove guides.
- Smart snapping toggles:
  - Snap to guides
  - Snap to other objects (edges/centers)
  - Optional gap snapping (distribute spacing)

### Out
- Full constraints system.

## Acceptance criteria
- [ ] Guides can be created and moved.
- [ ] Snapping shows visible alignment cues.

## Test plan
- [ ] Manual: create guides, move layers with snap on/off.

## Notes
- Do NOT touch `D:`.

