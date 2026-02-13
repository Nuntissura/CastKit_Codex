# Work Packet: WP-0044 - Portable Data Root + Folder Settings

Date: 2026-02-13
Owner: Codex
Status: DONE

## Summary
Make CKC default all data (db, characters, exports) to the portable `.exe` folder by default, and make it easy to switch/reset the data folder from the UI.

## Why
User discovered exports landing on `D:`. In CKC, exports default to `<libraryRoot>\\exports`, so if `libraryRoot` ends up on an unsafe drive (or a redirected Documents folder), exports go there too.

CKC should feel "portable and safe" by default:
- if you run the portable `.exe`, your data should live next to it unless you explicitly choose otherwise.

## Scope
### In
- Portable-first behavior for `libraryRoot`:
  - Avoid silent reuse of an external `libraryRoot` when switching from installed -> portable.
  - Provide a one-click "Reset to portable default" action.
- UI affordance:
  - Make the active data folder obvious and easy to change from the app UI (not buried).

### Out
- Moving/copying existing libraries automatically (no migration wizard).
- Any DB/schema changes.

## Acceptance criteria
- [x] On a portable run, CKC defaults to `<portable_dir>\\CastKit Codex Library` unless the user explicitly chooses a different folder.
- [x] If a portable run detects an existing libraryRoot outside the portable folder, CKC asks once what to do (keep vs switch vs pick).
- [x] UI includes a clear way to:
  - open the current data folder
  - change it
  - reset to portable default
- [x] Exports default under `<libraryRoot>\\exports` and therefore follow the chosen data folder.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: run portable build -> verify data folder selection/reset works and exports land under the chosen folder.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (or explicitly "No spec impact" with rationale):
  - No spec impact (behavioral default + UI affordance only; spec not required for CKC testbed).
- [x] Session dump alignment: no conflicts.

## Implementation notes
- Likely files:
  - `CKC_main/app/main.js` (portable libraryRoot decision + IPC)
  - `CKC_main/src/ui/views/LibraryView.tsx` and/or `CKC_main/src/ui/views/CharacterView.tsx` (UI entrypoints)

## Risks / mitigations
- Risk: user thinks data is "gone" if we switch to a new libraryRoot.
  - Mitigation: show the exact path in the prompt and provide "Keep using current" option.

## Rollback
Revert the portable prompt/reset changes.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.
