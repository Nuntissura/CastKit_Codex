# Work Packet: WP-0058 — Duplicate Detection (Exact Hash) + Safe Cleanup

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a duplicates view that groups images by exact hash (byte-identical) and provides safe, explicit cleanup actions.

## Why
- Libraries get messy fast when collecting references.
- CKC already computes/stores hashes for repair; reuse that for user-facing cleanup.
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.5.

## Scope
### In
- Duplicates view (global across library).
- Grouping by stored file hash.
- Safe cleanup actions (explicit confirmation):
  - Remove redundant DB entries (keep one “canonical” asset).
  - Optional: remove orphaned copied files when no longer referenced.

### Out
- Perceptual similarity (pHash) matching.
- Auto-de-duplication.

## Acceptance criteria
- [x] CKC shows groups of duplicates (hash groups with >1 image).
- [x] User can open duplicates in context (jump to character + image).
- [x] User can remove selected duplicate DB rows safely (no silent disk deletes).

## Test plan
- [x] `cd CKC_main; npm test`
- [ ] Manual: import same file twice; verify duplicates view shows group; remove one; confirm remaining works.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Key files:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/views/LibraryView.tsx` (or a Tools view)
- Data model:
  - Reuse existing `file_hash` on image assets.
- Implemented `listDuplicateGroups()` backend + Library→Duplicates UI with “Delete extras (keep best)” + per-image open-in-context.

## Rollback
Remove duplicates UI and keep data unchanged.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
