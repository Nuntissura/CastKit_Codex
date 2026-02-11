# Work Packet: WP-0011 — Rating hotkeys (RAlt+1..5)

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Add the rating assignment hotkeys (`RAlt+1..5`) so the selected image can be rated without opening the controls UI.

## Why
This was decided after the recovered session dump and recorded in the current spec (v00.020). The MediaPane already supports rating assignment via clicks; hotkeys make it Adobe-like and faster.

## Scope
### In
- Implement `RAlt+1..5` to set rating 1–5 on the currently selected image in the active MediaPane.
- Ignore the hotkeys when focus is in an editable element (input/textarea/select/contenteditable) to avoid interfering with typing.

### Out
- Rating filters/operators and slideshow behavior (tracked separately).
- Deciding a hotkey for “clear rating to 0” (still TBD; UI already has a Clear button).

## Acceptance criteria
- [x] While an image is selected in the MediaPane, pressing `RAlt+1..5` updates the rating to 1–5.
- [x] Hotkeys do nothing while typing in an editable element.

## Test plan
- [x] `npm test`
- [ ] Manual: open the app, select an image, press `RAlt+3`, confirm 3 stars; press `RAlt+1`, confirm 1 star.

## Implementation notes
- Key files touched:
  - `CKC_main/src/ui/components/MediaPane.tsx`
- Key detection:
  - Uses `KeyboardEvent.getModifierState('AltGraph')` or `ctrl+alt` as a fallback (Windows AltGr behavior).

## Risks / mitigations
- Risk: keyboard layouts differ in how Right Alt is reported. Mitigation: support both `AltGraph` and `Ctrl+Alt`.

## Rollback
- Revert the commit that adds the MediaPane hotkey handler.

