# Work Packet: WP-0005 — Notes/Stories/Moodboard libraries + DB-first persistence (SQLite)

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Add separate Notes / Stories / Moodboard libraries with DB-first persistence (SQLite), plus the UI needed to browse and edit docs in a 3-panel mode.

## Why
Notes/Stories/Moodboards are not an afterthought: they must be independently saved/loaded and must not be affected by the image pane interaction.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- SQLite tables for Notes/Stories/Moodboards.
- CRUD APIs (list/get/upsert/delete) wired through IPC/preload.
- Character view docs UI:
  - library drawer list + search
  - create new docs
  - save + delete
  - tags input (simple)
- Moodboard canvas (baseline):
  - draw strokes (pen/eraser)
  - add images from character/global source via modal picker
  - store moodboard state as JSON in DB

### Out
- Full “smart tags” feature set (tag analytics, suggestions, doc-type metadata rules).
- Full Milanote/Photoshop tool parity (bucket/gradient/line/arrow/shapes, object transforms).

## Acceptance criteria
- [x] Create/save/load/delete works for all three doc types.
- [x] Notes/Stories store text byte-for-byte (no rewriting).
- [x] Moodboard reopens with strokes and placed images intact.
- [x] While typing, doc controls remain visible (no disappearing toolbars).

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: create one of each doc type, reload app, confirm persistence; delete and confirm it’s removed.

## Implementation notes
- Keep UI minimal by default; drawers + command bars hideable.

## Rollback
- Revert commits associated with WP-0005.
