# Work Packet: WP-0069 — Collections / playlists

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add named collections of images across characters, with slideshow playback and export.

## Why
- “Casting” and vibe passes are inherently cross-character.
- Collections are a simple primitive that unlocks many workflows.
- Spec: `CastKit_Codex_Spec_v00.046.md` §11.16.

## Scope
### In
- Create/rename/delete collections.
- Add/remove images to a collection (from Library/Character).
- View a collection as a slideshow (respect existing slideshow controls).
- Export collection images to a user-selected folder (default under `<libraryRoot>/exports/`).

### Out
- Advanced ordering rules (shuffle, weighted) beyond manual reorder.

## Acceptance criteria
- [x] Collections persist in DB and survive restarts.
- [x] Slideshow works for a collection.
- [x] Export destination is user-selectable and never defaults to `D:`.

## Test plan
- [x] `cd CKC_main; npm test`
- [ ] Manual: build a collection, run slideshow, export to a folder under libraryRoot.

## Notes
- Do NOT touch `D:`.
