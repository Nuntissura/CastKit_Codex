# Work Packet: WP-0090 — Batch character operations

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Add multi-select and batch operations for characters in the Library view: bulk tagging, bulk field updates, batch export, batch delete.

## Why
- Managing 50+ characters needs bulk actions (currently requires editing one at a time).
- Common workflows: "Set Universe: Cyberpunk for all NPCs", "Export all main cast", "Delete all test characters".
- Batch operations are essential for power users with large casts (100+ characters).
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.8 "Batch Character Operations".

## Scope
### In
- Multi-select in Library view:
  - Ctrl+Click to toggle selection
  - Shift+Click for range selection
  - Ctrl+A to select all (respecting current filter)
  - Visual selection indicator (checkbox or highlight)
- Batch operations toolbar (appears when >0 selected):
  - "Bulk Edit Fields" — apply same field value to all selected
  - "Bulk Tag" — add/remove tags (if character tags are added in future)
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
  - Use existing export formats (canonical, LLM-friendly, web portfolio)
  - Progress UI with cancel support
  - Output folder: `<libraryRoot>/exports/batch-<timestamp>/`
- Batch delete:
  - Confirmation dialog with count: "Delete 25 characters?"
  - Optional "Move to Trash" vs "Permanent Delete"
  - Progress UI
  - Undo support (restore from trash)

### Out
- Batch image operations (already handled by WP-0057)
- Undo for batch field edits (v1 is destructive with confirmation)
- Batch relationship edits (defer to future)

## Dependencies
None (pure feature, uses existing CRUD operations)

## Acceptance criteria
- [ ] Can multi-select characters with Ctrl+Click, Shift+Click, Ctrl+A
- [ ] Batch field edit updates all selected characters
- [ ] Batch export works for 50+ characters
- [ ] Batch delete works with confirmation and progress
- [ ] Selection state persists during filter changes (or clears, decide during implementation)

## Test plan
- [ ] Unit tests for batch update queries
- [ ] Integration test: select 10 characters, bulk edit field, verify all updated
- [ ] Manual: select 50 characters, batch export, verify all exported
- [ ] Manual: batch delete with undo, verify restoration works
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.8).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/src/ui/components/LibraryView.tsx` — Multi-select UI
  - `CKC_main/src/ui/components/BatchOperationsToolbar.tsx` — Batch actions toolbar
  - `CKC_main/src/ui/components/BulkFieldEditDialog.tsx` — Bulk edit UI
  - `CKC_main/app/ipc/batch-character.js` — Batch IPC handlers
- Multi-select state:
  ```tsx
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());

  const handleClick = (charId: string, event: React.MouseEvent) => {
    if (event.ctrlKey) {
      // Toggle selection
      setSelectedCharacterIds(prev => {
        const next = new Set(prev);
        next.has(charId) ? next.delete(charId) : next.add(charId);
        return next;
      });
    } else if (event.shiftKey) {
      // Range selection (from last selected to current)
      // ... implement range logic
    } else {
      // Single selection
      setSelectedCharacterIds(new Set([charId]));
    }
  };
  ```
- Bulk field update query:
  ```sql
  UPDATE CharacterField
  SET value_text = ?
  WHERE character_id IN (?, ?, ...) AND field_id = ?;
  ```
- Batch delete with trash:
  - Add `Character.deleted_at` timestamp (soft delete)
  - Deleted characters hidden from library view
  - "Trash" folder in Library sidebar
  - "Empty Trash" action for permanent delete

## Notes
- Consider adding "Select by filter" (e.g., "Select all characters with tag X")
- Batch operations should show progress for 10+ characters
- Undo for batch field edits: consider snapshot-before-edit in future iteration
- Keyboard shortcut: Ctrl+A for select all, Escape to deselect all
- Do NOT touch `D:`.
