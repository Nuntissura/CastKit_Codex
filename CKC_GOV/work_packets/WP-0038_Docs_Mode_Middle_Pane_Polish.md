# Work Packet: WP-0038 — Docs Mode Middle Pane Polish

Date: 2026-02-12
Owner: Codex
Status: BACKLOG

## Summary
Polish the Character view docs-mode (3-panel) middle pane so Notes + Stories/Moodboard are clean and readable at typical widths, with less awkward wrapping and clutter.

## Why
The current stacked docs UI in the middle panel is functionally correct but visually messy at common panel widths (wrapping/spacing makes the editor feel chaotic). This is a UX polish pass, not a feature redesign.

Spec refs:
- `CKC_GOV/spec/CastKit_Codex_Spec_v00.032.md` §8 “Docs mode (autosave + stacked layout)”

## Scope
### In
- CSS/layout tweaks for the docs middle pane in `CharacterView`:
  - Stabilize header/action layout (reduce awkward wrapping).
  - Make Title/Tags controls layout predictably (responsive without jitter).
  - Preserve the existing stacked behavior: Notes always visible, lower pane toggles Stories/Moodboard.

### Out
- Any DB/schema changes.
- Rich text / markdown editor work.
- Replacing stacked layout with a new interaction model.

## Acceptance criteria
- [ ] In docs mode, the middle pane (Notes + Stories/Moodboard) remains readable and usable when resized narrow/wide (no “messy” wrap piles).
- [ ] Title/Tags inputs remain usable at narrow widths without pushing critical controls off-screen.
- [ ] No behavior regressions: autosave/flush behavior and Library/New/Save/Delete actions still work.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: open Character → toggle Notes (docs mode) → resize splitters → verify Notes + Stories/Moodboard panes remain clean and usable.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale):
  - No spec impact (CSS/layout polish only; behavior unchanged).
- [ ] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/views/characterView.module.css`
  - (If needed) `CKC_main/src/ui/views/CharacterView.tsx`
- Data model changes:
  - None.
- IPC/API changes:
  - None.

## Risks / mitigations
- CSS changes can have unintended effects at extreme widths → verify by resizing and checking both panes.

## Rollback
Revert the CSS changes in `characterView.module.css`.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

