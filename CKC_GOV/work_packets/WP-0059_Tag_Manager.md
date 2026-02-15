# Work Packet: WP-0059 — Tag Manager

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a tag management UI to rename/merge tags globally and show tag counts across images + docs.

## Why
- Tags inevitably drift (typos, variants, duplicates).
- A tag manager prevents long-term entropy and makes filters usable.
- Spec: `CastKit_Codex_Spec_v00.039.md` §11.6.

## Scope
### In
- List all tags with counts per entity type (images, notes, stories, moodboards).
- Rename tag globally.
- Merge tags (A -> B) globally.
- Pin/favorite tags for quick access.

### Out
- Editing free-text to rewrite tags inside user content.
- Complex tag namespaces.

## Acceptance criteria
- [ ] Tag manager shows global tag list + counts.
- [ ] Rename/merge updates all affected entities.
- [ ] Pinned tags appear in filter UI for quick selection.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: create tags on images and notes, rename a tag, verify both updated and filterable.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Key files:
  - `CKC_main/app/backend/library.js` (tag queries + rename/merge operations)
  - `CKC_main/src/ui/views/*` (tag manager UI)
- Data:
  - Images: `ImageAsset.tags_json`
  - Docs: per-doc tags field(s) in SQLite

## Risks / mitigations
- Risk: accidental global changes.
  - Mitigation: confirm rename/merge, show affected counts preview.

## Rollback
No rollback for tag changes without backups; ensure the operation is explicit and confirmable.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
