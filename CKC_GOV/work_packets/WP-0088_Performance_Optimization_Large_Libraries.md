# Work Packet: WP-0088 — Performance optimization for large libraries

Date: 2026-02-15
Owner: Codex
Status: DONE (2026-02-16)

## Summary
Improve CKC responsiveness for large libraries by bounding renderer DOM size (pagination + thumbnail caps) and adding database indexes for common query paths.

## Why
- Current implementation may slow down with large libraries (no virtualization).
- Users with 500+ characters or 5000+ images will experience lag.
- Performance issues cause user churn (if it's slow, they abandon the tool).
- Gallery scroll, character list rendering, and search need to scale.
- Spec: `CastKit_Codex_Spec_v00.057.md` §12.6 "Performance & Scalability".

## Scope
### In
- Pagination/caps (renderer-side):
  - Character list: 200 per page (Prev/Next)
  - Image gallery thumbnails: capped rendering (default 500) with "Load more" and auto-expand to keep selection visible
- Lazy-loading hints:
  - Use `loading="lazy"` and `decoding="async"` on thumbs where applicable
- Database indexing:
  - Index `Character.public_id`, `Character.created_at`, `Character.updated_at`
  - Index `ImageAsset.character_id`, `ImageAsset.added_at`, `ImageAsset.tags_json`
  - Index `FieldValue.field_id`

### Out
- Server-side rendering (keep it Electron-local)
- Database sharding (SQLite is fast enough for expected scale)
- Cloud sync (separate feature, not performance-related)

## Dependencies
None (no new runtime dependencies).

## Acceptance criteria
- [x] Character list does not render unbounded DOM (paged at 200 items)
- [x] Thumbnail strip does not render unbounded DOM (capped at 500; can load more)
- [x] Added DB indexes for common query paths (schema upgrades)
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Test plan
- [ ] Manual: open a large library, verify paging + thumbnail "Load more" behavior
- [ ] Manual: monitor memory usage (Task Manager / Activity Monitor)
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.057.md` §12.6).

## Implementation notes
- Key files to modify:
  - `CKC_main/src/ui/views/LibraryView.tsx` — Character list pagination
  - `CKC_main/src/ui/components/MediaPane.tsx` — Thumbnail cap + "Load more"
  - `CKC_main/app/backend/db.js` — Database indexes (schema upgrades)

## Notes
- Consider migrating from `sqlite3` to `better-sqlite3` (synchronous API, faster)
- Thumbnail size: 256px max (balance between quality and file size)
- Cache thumbnail paths in memory (avoid repeated filesystem checks)
- Background thumbnail generation: use worker threads if needed (avoid blocking main thread)
- Do NOT touch `D:`.
