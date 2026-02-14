# Work Packet: WP-0057 — Multi-Select + Batch Image Metadata

Date: 2026-02-14
Owner: Codex
Status: BACKLOG

## Summary
Enable multi-select in the thumbnail strip and apply batch actions (rating/favorite/tags) to the whole selection.

## Why
- Tagging/triage is painful one-image-at-a-time.
- Matches established UX in photo/asset managers.
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.4.

## Scope
### In
- Multi-select on thumbnails:
  - Ctrl-click toggles selection
  - Shift-click selects a range
- Batch actions:
  - Set rating (0–5)
  - Toggle favorite on/off
  - Add/remove tags (including `carousel`/`frontpage`)

### Out
- Complex batch “notes stamping” UI (optional later).
- Heavy undo/redo across DB operations (a simple “last action undo” is ok if feasible).

## Acceptance criteria
- [ ] User can select multiple thumbnails (Ctrl/Shift).
- [ ] Batch rating/favorite/tag changes apply to all selected images.
- [ ] UI clearly shows selection count and which actions are batch vs single-image.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: select 5 images, set rating=3, add tag `foo`, toggle favorite; verify each image updated.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Key files:
  - `CKC_main/src/ui/components/MediaPane.tsx`
  - `CKC_main/app/backend/library.js` (batch update endpoints)

## Risks / mitigations
- Risk: accidental batch changes.
  - Mitigation: show selection count + a clear “Clear selection” affordance; consider confirmation for destructive operations only.

## Rollback
Revert to single-selection behavior and remove batch endpoints.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

