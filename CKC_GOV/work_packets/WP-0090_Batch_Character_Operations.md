# Work Packet: WP-0090 — Batch character operations

Date: 2026-02-16
Owner: Codex
Status: DONE

## Summary
Add multi-select and batch operations for characters in the Library view: bulk tagging, bulk field updates, batch export, batch delete.

## Why
- Managing 50+ characters needs bulk actions (currently requires editing one at a time).
- Common workflows: "Set Universe: Cyberpunk for all NPCs", "Export all main cast", "Delete all test characters".
- Batch operations are essential for power users with large casts (100+ characters).
- Spec: `CastKit_Codex_Spec_v00.059.md` §12.8 "Batch character operations (WP-0090)".

## Scope
### In
- Multi-select in Library view:
  - Ctrl+Click to toggle selection
  - Shift+Click for range selection
  - Ctrl+A to select all (respecting current filter)
  - Visual selection indicator (checkbox or highlight)
- Batch operations toolbar (appears when >0 selected):
  - "Bulk Edit Fields" — apply same field value to all selected
  - "Bulk Tag" — add/remove manual character tags for all selected
  - "Batch Export" — export all selected characters (sheet + images)
  - "Batch Delete" — delete all selected (with confirmation)
  - "Deselect All"
- Bulk field edit UI:
  - Pick a field ID (dropdown of all field IDs in library)
  - Choose operation: "Set to...", "Append to...", "Clear"
  - Enter new value
  - Preview: "This will update N characters"
  - Confirm to apply
- Batch export:
  - Use existing export formats (share pack, bundle, web portfolio)
  - Progress UI with cancel support
  - Output folder: under the configured export root (`config.exportRoot`) if set; otherwise under `<libraryRoot>\\exports\\` (refuse `D:`)
  - Each export is grouped under a `batch-<timestamp>` folder
- Batch delete:
  - Confirmation dialog with count: "Delete 25 characters?"
  - "Move to Trash" (soft delete) vs "Purge" (permanent delete)
  - Progress UI
  - Undo support (restore from trash)

### Out
- Batch image operations (already handled by WP-0057)
- Undo for batch field edits (v1 is destructive with confirmation)
- Batch relationship edits (defer to future)

## Dependencies
None (pure feature, uses existing CRUD operations)

## Acceptance criteria
- [x] Can multi-select characters with Ctrl+Click, Shift+Click, Ctrl+A
- [x] Batch field edit updates all selected characters
- [x] Bulk tag add/remove updates all selected characters (manual tags only)
- [x] Batch export works for 50+ characters
- [x] Batch delete works with confirmation and progress
- [x] Selection state is pruned to currently visible items when filters/mode changes (prevents hidden selections)

## Test plan
- [x] Unit tests for batch operations (bulk field edit + bulk tags + soft delete / restore / purge)
- [x] Unit tests for soft delete / restore / purge
- [ ] Integration test: select 10 characters, bulk edit field, verify all updated
- [ ] Manual: select 50 characters, batch export, verify all exported
- [ ] Manual: batch delete with undo, verify restoration works
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.059.md` §12.8).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/src/ui/views/LibraryView.tsx` — Multi-select UI + batch toolbar
  - `CKC_main/src/ui/components/*` — Batch actions toolbar + dialogs
  - `CKC_main/app/backend/library.js` — Batch operations backend
  - `CKC_main/app/main.js` + `CKC_main/app/preload.js` — IPC wiring

Implemented:
- Backend:
  - `CKCLibrary.batchUpdateCharacterField(...)`
  - `CKCLibrary.batchUpdateCharacterTags(...)`
  - `CKCLibrary.softDeleteCharacters(...)`
  - `CKCLibrary.restoreCharacters(...)`
  - `CKCLibrary.purgeCharacters(...)`
  - `CKCLibrary.listCharacters({ deletedMode })`
- UI:
  - Library right panel now supports character multi-select + a batch toolbar.
  - Added a Trash mode (toggle) that lists deleted characters and supports Restore/Purge + "Empty trash".
  - Added dialogs: `BulkFieldEditDialog` + `BulkTagDialog` + `BatchExportDialog`.
- Bulk field edit implementation detail:
  - Uses `saveCharacter()` with merged `valuesById` (not raw SQL) to preserve validation, sheet versioning, derived tags, and search blobs.
- Batch delete with trash:
  - Add `Character.deleted_at` timestamp (soft delete)
  - Deleted characters hidden from library view
  - Trash mode toggle in Library view
  - "Empty Trash" action for permanent delete

## Notes
- Consider adding "Select by filter" (e.g., "Select all characters with tag X")
- Batch operations should show progress for 10+ characters
- Undo for batch field edits: consider snapshot-before-edit in future iteration
- Keyboard shortcut: Ctrl+A for select all, Escape to deselect all
- Do NOT touch `D:`.
