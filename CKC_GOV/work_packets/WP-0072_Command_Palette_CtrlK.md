# Work Packet: WP-0072 — Command palette (Ctrl+K)

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Add a keyboard-first command palette (`Ctrl+K`) to jump to characters/docs/tags and run common actions.

## Why
- Big speed multiplier for power users.
- Helps keep UI minimal while still making everything reachable.
- Spec: `CastKit_Codex_Spec_v00.048.md` §11.19.

## Scope
### In
- `Ctrl+K` opens palette; `Esc` closes.
- Fuzzy search across:
  - Characters
  - Notes/Stories/Moodboards
  - Tags (quick filter)
  - Key actions (exports/tools/toggles)
- Keyboard navigation (up/down/enter).

### Out
- Scripting/macros.

## Acceptance criteria
- [ ] Palette opens instantly and does not steal focus unexpectedly.
- [ ] Selecting an item navigates correctly.

## Test plan
- [ ] Manual: use palette to navigate to a character, open a doc, and apply a tag filter.

## Notes
- Do NOT touch `D:`.
