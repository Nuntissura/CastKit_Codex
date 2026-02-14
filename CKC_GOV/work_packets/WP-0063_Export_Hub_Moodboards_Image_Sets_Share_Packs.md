# Work Packet: WP-0063 — Export Hub (Moodboards + Image Sets + Share Packs)

Date: 2026-02-14
Owner: Codex
Status: BACKLOG

## Summary
Add a centralized export hub UI for common exports: moodboard to PNG/PDF, filtered/selected image sets, and per-character “share packs”.

## Why
- High ROI: makes CKC outputs reusable without hunting through hidden buttons.
- Supports portfolio use (image sets) and LLM pack workflows (share packs).
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.10.

## Scope
### In
- Export hub UI reachable from Library and Character Tools.
- Export moodboard to PNG (PDF optional).
- Export selected/filtered image sets to a chosen folder (zip optional).
- Export “share pack” per character:
  - Sheet text
  - Selected images
  - Selected docs (notes/stories/moodboards)

### Out
- Cloud publishing.
- Automatic “best-of” curation.

## Acceptance criteria
- [ ] Export hub exists and is discoverable.
- [ ] Moodboard exports to a PNG file that visually matches the canvas.
- [ ] Image set export copies the expected image files to the selected folder.
- [ ] Share pack export creates a folder with sheet + selected assets under `<libraryRoot>/exports/` by default.
- [ ] No exports default to `D:`; default is near `<libraryRoot>/exports/`.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: export a moodboard PNG; export a filtered image set; export a share pack; verify files on disk.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Key files:
  - `CKC_main/app/backend/library.js` (export helpers)
  - `CKC_main/src/ui/views/*`
- Avoid introducing new heavy deps unless necessary (zip/PDF can be optional).

## Rollback
Remove export hub UI; keep existing exports intact.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

