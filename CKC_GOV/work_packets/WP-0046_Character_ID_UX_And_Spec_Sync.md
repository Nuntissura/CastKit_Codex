# Work Packet: WP-0046 - Character ID UX + Spec Sync

Date: 2026-02-13
Owner: Codex
Status: DONE

## Summary
Make Character ID less confusing and safer:
- Treat `CHAR-ID-001` as system-managed (enforced to match the internal `characterId`).
- Surface the Character ID as a copyable chip in the Character header.
- Reduce sheet clutter by hiding `CHAR-ID-001` from the main sheet editor UI.
- Update the technical spec to match current behavior (portable/non-portable libraryRoot defaults, UI actions, and Character ID behavior).

## Why
- A long random Character ID is hard to use and easy to accidentally corrupt.
- If `CHAR-ID-001` diverges from the internal `characterId`, links/imports/exports become confusing.
- The spec had drifted from the shipped behavior (notably `libraryRoot` defaults).

## Scope
### In
- Backend enforcement of `CHAR-ID-001` on save/import.
- Renderer UX: copy-to-clipboard affordance for the Character ID.
- Spec bump + mirror into `CKC_main/docs/`.

### Out
- Redesigning Character ID format rules (sequential/public IDs) and migration strategy (tracked separately).

## Acceptance criteria
- [x] Character header shows a copyable Character ID chip.
- [x] `CHAR-ID-001` is enforced to match the internal `characterId` on save/import.
- [x] `CHAR-ID-001` is not presented as a normal editable sheet field in the UI.
- [x] Spec is bumped and updated to match product behavior.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: Open a character, copy ID from header, export/import a sheet and confirm `CHAR-ID-001` remains consistent.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored:
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.035.md`
  - Mirror: `CKC_main/docs/CastKit_Codex_Spec_v00.035.md`

## Implementation notes
- Key files:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/components/SheetEditor.tsx`
  - `CKC_main/src/ui/views/CharacterView.tsx`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/vite-env.d.ts`

## Rollback
Revert the UI/clipboard + enforcement changes and restore prior spec version.
