# Work Packet: WP-0025 — LibraryRoot diagnostics + missing media visibility

Date: 2026-02-11
Owner: Codex
Status: BACKLOG

## Summary
Add a small diagnostics/settings surface that makes the active `libraryRoot` obvious, allows switching it, and clearly reports missing media/paths so “photos not loading” is explainable and fixable without guesswork.

## Why
- Users can end up with a valid DB but missing image files (after wipes/moves/backups), which currently manifests as “sheets load but photos don’t” and requires manual detective work.
- Drive-letter changes break absolute-path `libraryRoot` configs; the app should show what it’s using and make it easy to change.

## Scope
### In
- UI: show current `libraryRoot` and config file location; add buttons:
  - Open library folder
  - Change library folder (folder picker)
  - Rescan/refresh
- Diagnostics readouts:
  - Count of images in DB vs present on disk (original + thumbs)
  - Top missing characters (by count)
  - Missing character folders (expected vs present)
- UX: when media fails to load, show a clear error state with action (“Open diagnostics”, “Change library folder”).

### Out
- Automated image recovery/rehydration (separate WP).
- Any changes to the session dump requirements.

## Acceptance criteria
- [ ] Users can see and change `libraryRoot` from the UI.
- [ ] App reports missing-image counts and top offenders.
- [ ] Media panes show an actionable message when files are missing.

## Test plan
- [ ] Manual: point to a library with missing files; confirm diagnostics numbers match; switch root; confirm photos appear.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).
- [ ] Session dump alignment (document any representation differences).

## Implementation notes
- Key files to touch (likely):
  - `CKC_main/app/main.js` (IPC for config + diagnostics)
  - `CKC_main/app/backend/library.js` (diagnostics helpers)
  - `CKC_main/src/ui/views/LibraryView.tsx` and/or a new settings/diagnostics panel

## Risks / mitigations
- Avoid heavy filesystem scans on the UI thread; compute diagnostics in main process/backend and stream results.

## Rollback
Revert commits associated with WP-0025.

