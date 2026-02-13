# Work Packet: WP-0042 - Docs Middle Pane Layout Fix

Date: 2026-02-13
Owner: Codex
Status: DONE

## Summary
Fix the Character view docs-mode (3-panel) middle pane so Notes + Stories/Moodboard headers wrap cleanly and form fields/textarea have usable space (no tiny fields or header text overlapping buttons).

## Why
Even after WP-0038 polish, the middle pane can still collapse awkwardly at some panel sizes, producing very small editing fields and visually messy headers (controls look like they overlap).

## Scope
### In
- CSS/layout tweaks for the docs middle pane in `CharacterView`.

### Out
- Any DB/schema changes.
- Any behavior changes to autosave or doc CRUD.

## Acceptance criteria
- [x] Docs mode middle pane headers do not visually overlap when resized narrow.
- [x] Notes/Stories textareas and Title/Tags inputs remain usable (not collapsed to tiny controls).
- [x] No behavior regressions.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: open Character -> toggle Notes (docs mode) -> resize splitters -> verify headers + inputs remain readable.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly "No spec impact" with rationale):
  - No spec impact (CSS/layout only; behavior unchanged).
- [x] Session dump alignment: no conflicts.

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/views/characterView.module.css`
- Data model changes:
  - None.
- IPC/API changes:
  - None.

## Risks / mitigations
- CSS changes can have unintended effects at extreme widths -> verify by resizing.

## Rollback
Revert the CSS changes in `CKC_main/src/ui/views/characterView.module.css`.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

