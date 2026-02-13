# Work Packet: WP-0045 - Photo Mode Metadata Panel + Image Dropzone

Date: 2026-02-13
Owner: Codex
Status: DONE

## Summary
Improve the photo viewing workflow:
- In photo mode, clicking an image should immediately show its notes/tags/controls.
- Group "favorite + rating + notes" together, keep filters at the top.
- Add a drag-and-drop image import dropzone near the Character header (next to the character name box).

## Why
Current UX friction:
- Controls/notes/tags are behind a separate toggle.
- Per-image controls feel split across different areas.
- Importing images requires clicking a button and using a file picker; a dropzone is faster.

## Scope
### In
- Media pane behavior/layout tweaks (renderer-only) to match the desired layout.
- Add optional "import from dropped file paths" path in IPC so dropzone can import without opening a dialog.

### Out
- Any new metadata fields.
- Moodboard changes.

## Acceptance criteria
- [x] In photo mode, selecting an image automatically reveals notes/tags/controls for that image.
- [x] Filters remain at the top; per-image controls live together near notes.
- [x] Dragging one or more image files onto the dropzone imports them into the current character.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: Character -> Photos mode -> click thumbs; verify metadata shows and saves; drag-drop images imports.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly "No spec impact" with rationale):
  - No spec impact (UI workflow polish for CKC testbed).
- [x] Session dump alignment: no conflicts.

## Implementation notes
- Likely files:
  - `CKC_main/src/ui/components/MediaPane.tsx`
  - `CKC_main/src/ui/components/mediaPane.module.css`
  - `CKC_main/src/ui/views/CharacterView.tsx`
  - `CKC_main/app/main.js` (optional filePaths import)
  - `CKC_main/app/preload.js` + `CKC_main/src/vite-env.d.ts` (IPC typing surface)

## Rollback
Revert UI + IPC changes.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
