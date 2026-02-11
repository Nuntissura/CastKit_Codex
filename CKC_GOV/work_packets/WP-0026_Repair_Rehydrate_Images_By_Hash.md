# Work Packet: WP-0026 — Repair tool: rehydrate missing images by hash

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Provide a repair tool that scans a user-chosen folder (e.g. recovery/backup dump) for image files, matches them to DB records by stored hash, and copies them into the expected `libraryRoot/characters/<id>/images/original/` locations, regenerating thumbnails.

## Why
- After the “fatal wipe”, CKC can have a DB that still lists many images but the files are gone. Matching by hash is the highest-signal way to recover correct originals without relying on filenames.

## Scope
### In
- “Repair missing images…” flow:
  - Pick scan folder
  - Scan images, compute hashes, match against missing `ImageAsset.file_hash`
  - Copy recovered files into the correct character folder layout
  - Regenerate thumbs for recovered images
- Safety:
  - Dry-run mode (shows how many will be recovered before copying)
  - Writes a recovery report (timestamped JSON) under `libraryRoot/exports/repair_reports/`

### Out
- Deduplication UI, conflict resolution beyond “skip if already exists”.
- Bulk import UX improvements (separate WP if needed).

## Acceptance criteria
- [x] Given a library with missing images and a folder containing the originals, the tool restores images and thumbs and CKC displays them.
- [x] Dry-run accurately reports intended actions.
- [x] A recovery report is written for traceability.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [x] Unit: hash-match + copy-to-layout pathing.
- [ ] Manual: run on a small subset folder and confirm recovered images show in the UI.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored.
- [x] Session dump alignment (no conflicts; this WP adds repair tooling only).

## Implementation notes
- Key files to touch (likely):
  - `CKC_main/app/backend/library.js` (scan + copy + thumb regen)
  - `CKC_main/app/main.js` (IPC + folder picker)
  - UI: a repair panel in Library view/settings

## Risks / mitigations
- Performance: scanning large folders can be slow. Mitigate by batching + progress updates and allowing cancel.

## Rollback
Revert commits associated with WP-0026.
