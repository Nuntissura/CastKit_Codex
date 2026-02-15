# Work Packet: WP-0062 — Stories Corkboard / Outliner

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a corkboard/outliner view for Stories to manage story chunks as reorderable cards, with links to characters/images.

## Why
- High ROI for writing workflows (Scrivener-like “cards/outliner”).
- Fits CKC’s “docs library” model while staying local-first.
- Spec: `CastKit_Codex_Spec_v00.039.md` §11.9.

## Scope
### In
- Stories have an additional “Board” view:
  - Cards represent story items (either stories themselves or sub-items within a story; implementation-defined).
  - Drag/drop reorder persists.
- Cards can contain link syntax per WP-0054 (no automatic rewriting).

### Out
- Full writing suite features (compile templates, snapshots, etc.).
- Collaboration/sync.

## Acceptance criteria
- [x] User can switch Stories to Board/Outliner mode.
- [x] Cards can be reordered and the order persists across restart.
- [x] Cards can link to characters/images using `[[...]]` conventions.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] Manual: create 5 cards, reorder them, restart app, verify order; click a link and navigate.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (no spec changes required beyond existing §11.9; references updated to v00.039).

## Implementation notes
- Data model: `StoryBoard` table keyed by `doc_id` storing `board_json` (versioned JSON with ordered cards).
- Board card text participates in link index/backlinks.
- Key files:
  - `CKC_main/app/backend/db.js`
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/views/CharacterView.tsx`

## Rollback
Remove board UI; keep story content unchanged.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
