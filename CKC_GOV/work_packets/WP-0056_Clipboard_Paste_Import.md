# Work Packet: WP-0056 — Clipboard Image Paste Import

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Support pasting an image from the clipboard into CKC so screenshots can be captured and imported without touching the filesystem first.

## Why
- High ROI for fast capture workflows.
- Common expectation in reference/asset tools.
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.3.

## Scope
### In
- Paste from clipboard into:
  - Character view (imports into that character)
  - Library/Inbox view (imports as Unassigned/Inbox)
- Visible feedback and error messages (no silent failure).

### Out
- Clipboard auto-monitoring.
- Multi-item clipboard galleries.

## Acceptance criteria
- [x] With an image in clipboard, pressing paste in CKC imports it and shows it in the UI.
- [x] Paste works in Character view and Library/Inbox view with the expected destination.
- [x] If clipboard has no image, CKC shows a clear “no image in clipboard” message.

## Test plan
- [x] `cd CKC_main; npm test`
- [ ] Manual: take a screenshot → copy → paste in CKC → verify stored image + thumbnail.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Likely uses Electron `clipboard` (main process) and existing import pipeline.
- Implemented `ckc:importClipboardImage` IPC + UI hotkeys:
  - Library view: paste imports to Inbox.
  - Character view: paste imports to current character.
- Key files:
  - `CKC_main/app/main.js` (clipboard IPC)
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/views/*`

## Rollback
Remove clipboard IPC and paste affordances.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
