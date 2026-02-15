# Work Packet: WP-0083 — Global full-text search across all content

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Add a global full-text search that searches across character sheets, notes, stories, moodboard text layers, and image metadata with context previews and jump-to-result navigation.

## Why
- Command palette (Ctrl+K) navigates to entities, but users need to find *content*.
- "Where did I write about the magic system?" is a daily problem for worldbuilders with 50+ characters.
- Search is a core workflow multiplier for large libraries (500+ characters, 5000+ images).
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.1 "Global Search".

## Scope
### In
- SQLite FTS5 full-text search index for:
  - Character sheet field values (`CharacterField.value_text`)
  - Notes content (`Note.content_text`)
  - Stories content (`Story.content_text`)
  - Moodboard text layers (extracted from `Moodboard.data_json`)
  - Image metadata (`ImageAsset.tags_json`, `ImageAsset.source_note`, `ImageAsset.photo_notes`)
- Global search UI (Ctrl+Shift+F or in Command Palette):
  - Search input with live results
  - Results grouped by type (Characters, Notes, Stories, Images)
  - Context preview (surrounding text with match highlight)
  - Result count per category
  - Jump-to-result action (opens character/note/story/image)
- Scope toggle: "Current Character" vs "Entire Library"
- Search operators: phrase search ("exact match"), AND/OR/NOT

### Out
- Regex search (keep it simple for v1)
- Replace functionality (search-only for now)
- Fuzzy/typo-tolerant search (can add later)
- Search history (can add later)

## Dependencies
- SQLite FTS5 extension (already bundled with better-sqlite3/sqlite3)
- Consider adding `better-sqlite3` for FTS5 support (current `sqlite3` may need verification)

## Acceptance criteria
- [ ] Can search across all content types from a single input
- [ ] Results show context preview with match highlighting
- [ ] Jump-to-result opens the source and scrolls to match
- [ ] Search is fast (<100ms for libraries with 10k+ searchable items)
- [ ] Scope toggle works (current character vs library-wide)

## Test plan
- [ ] Unit tests for FTS indexing and query building
- [ ] Integration test: create characters/notes/stories, search, verify results
- [ ] Performance test: 1000 characters, 10k images, measure search latency
- [ ] Manual: search for known text, verify context preview accuracy
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.1).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/db/search.js` — FTS5 index creation and search queries
  - `CKC_main/app/ipc/search.js` — IPC handlers for search operations
  - `CKC_main/src/ui/components/GlobalSearch.tsx` — Search UI component
  - `CKC_main/src/ui/components/CommandPalette.tsx` — Add search mode
- Database schema changes:
  - Create FTS5 virtual tables for each content type
  - Add triggers to keep FTS indexes in sync with source tables
- Example FTS5 schema:
  ```sql
  CREATE VIRTUAL TABLE character_fts USING fts5(
    character_id UNINDEXED,
    field_id UNINDEXED,
    content,
    tokenize='porter unicode61'
  );
  ```
- Search query example:
  ```sql
  SELECT
    character_id,
    field_id,
    snippet(character_fts, 2, '<mark>', '</mark>', '...', 32) as context
  FROM character_fts
  WHERE character_fts MATCH ?
  ORDER BY rank
  LIMIT 50;
  ```

## Notes
- FTS5 `snippet()` function provides context with highlighting
- Consider debouncing search input (300ms) for live results
- Result limit: 50 per category, with "Show more" option
- Do NOT touch `D:`.
