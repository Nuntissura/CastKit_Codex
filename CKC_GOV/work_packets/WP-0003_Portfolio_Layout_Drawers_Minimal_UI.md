# Work Packet: WP-0003 — Portfolio layout + drawers + minimal UI

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Implement the “portfolio viewer” layout from the recovered session dump:
- 2-panel default (images + character sheet)
- 3-panel docs mode (images + docs + sheet)
- menu drawer + library drawer on the same side
- minimal UI by default (hideable command/search bar; hideable photo controls)

## Why
This is the core product direction: “Character sheet + portfolio viewer”, with images as the hero and a minimal, fast UI on large displays.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Menu drawer (hamburger + `Ctrl+B`; `Esc` closes).
- Docs mode becomes a true 3-panel mode (doesn’t exit when changing photo mode).
- Add a docs “Library” drawer (Notes/Stories/Moodboard list) sliding from the same side as the menu drawer.
- Add a hideable command bar to group search + filters (hidden by default).
- Ensure MediaPane defaults to minimal UI (controls + thumbnails hidden by default).

### Out
- Ratings operators + slideshow (WP-0004).
- Full Notes/Stories/Moodboard implementations (WP-0005).

## Acceptance criteria
- [x] Menu drawer opens/closes via button and `Ctrl+B`; `Esc` closes.
- [x] In docs mode, left pane stays interactive and does not kick out of docs.
- [x] Library drawer and menu drawer share the same side and “switch” (opening one closes the other).
- [x] Command bar is hidden by default and toggled via a single control.

## Test plan
- [x] `npm test`
- [ ] Manual smoke test: open character, enter docs mode, toggle photos/carousel, open/close both drawers, toggle command bar.

## Implementation notes
- Keep corners sharp and chrome minimal.
- Avoid large refactors; build on current `Drawer` + `MediaPane` patterns.

## Risks / mitigations
- Risk: keyboard shortcut conflicts. Mitigation: keep `Ctrl+B` for menu and reserve others for later WPs.

## Rollback
- Revert commits associated with WP-0003.
