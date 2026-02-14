# Work Packet: WP-0055 — Inbox / Watch-Folder Import

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add an optional “Inbox” folder import flow so the user can dump screenshots into a folder and have CKC ingest them into an Unassigned/Inbox holding area, ready to be assigned to a character.

## Why
- High ROI: reduces friction for collecting reference images quickly.
- Matches common “asset manager” workflows (dump → triage → assign).
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.2.

## Scope
### In
- Setting: configurable inbox folder path.
- Action: scan inbox folder and import new images (safe, no auto-delete).
- UI view: show inbox items, with bulk assign to character and batch metadata ops.

### Out
- Aggressive real-time filesystem watching across platforms (optional later).
- Automatic deletion/moving of user files without explicit action.

## Acceptance criteria
- [x] User can set an Inbox folder path.
- [x] “Scan Inbox” imports new images into an Inbox/Unassigned area.
- [x] Imported inbox items are visible in a dedicated view.
- [x] User can assign an inbox image to a character (and it appears under that character’s Photos).
- [x] Inbox scan never deletes user files automatically.

## Test plan
- [x] `cd CKC_main; npm test`
- [ ] Manual: drop 3 images into inbox folder; scan; assign two images to a character; verify persistence across restart.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Prefer “manual scan” first; optional “scan on startup” toggle later.
- Consider representing Inbox as:
  - A system character (hidden in normal lists), or
  - A first-class Inbox table (cleaner, but more work).
- Implemented as a **system character**: `__ckc_inbox` (“Inbox”) hidden from normal character lists.
- Library UI adds an Inbox mode to the left pane with scan/assign/delete actions and multi-select batch metadata.
- Key files:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/views/LibraryView.tsx`
  - `CKC_main/src/ui/components/MediaPane.tsx`

## Risks / mitigations
- Risk: moving/copying files on assignment can be confusing.
  - Mitigation: keep user files untouched by default; copy into library (preferred) unless “reference mode” is explicitly chosen.

## Rollback
Disable inbox UI and leave imported images in the library unchanged.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
