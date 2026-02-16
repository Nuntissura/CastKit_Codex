# Work Packet: WP-0080 — Moodboard: layer folders + board search/tags

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Upgrade the layers panel with folders (nested groups), per-layer tags, and search within a board.

## Why
- Power users need organization tools once boards grow.
- Makes masking/framing and complex compositions manageable.
- Spec: `CastKit_Codex_Spec_v00.052.md` §11.27.

## Scope
### In
- Layer folders (nested).
- Optional per-layer tags (board-local).
- Search box filtering layer list by name/tags.
- Folder-level hide/lock.

### Out
- Global tag taxonomy (this is board-local only).

## Acceptance criteria
- [x] Folders can be created/renamed/nested and persist in moodboard JSON.
- [x] Search filters the layers list deterministically (name + tags).

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm test`
- [ ] Manual: large board organization flow.

## Notes
- Do NOT touch `D:`.
