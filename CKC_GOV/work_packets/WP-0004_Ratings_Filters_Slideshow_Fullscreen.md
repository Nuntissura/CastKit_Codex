# Work Packet: WP-0004 — Ratings (0–5) assign + operator filters + fullscreen/slideshow

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Implement ratings assignment + operator filters + fullscreen/slideshow behavior for the image surface, aligned with the recovered session dump.

## Why
Ratings are a first-class workflow tool (Adobe-like): quickly rate images, then filter + run slideshows on the filtered subset.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Assign rating 1–5 with `RAlt+1..5` on the selected image.
- Rating star UI (click to set 1–5; clear to 0).
- Rating operator filters: `=`, `<`, `≤`, `>`, `≥` (plus `Any`).
- Fullscreen viewer for MediaPane (keyboard nav + slideshow).
- Slideshow respects active filters.

### Out
- Customizable hotkeys beyond the chosen set.
- Advanced rating UX (hover scrubbing / drag, etc).

## Acceptance criteria
- [x] `RAlt+1..5` sets rating on the selected image (does not trigger while typing in an input/textarea).
- [x] Filter operators work for both character list filtering and carousel filtering.
- [x] Fullscreen can be opened/closed; left/right navigation works.
- [x] Slideshow advances through the filtered set only.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: rate images, filter by each operator, verify slideshow/fullscreen respects the filtered subset.

## Implementation notes
- Treat `AltGraph` (AltGr) as `RAlt` on Windows; also accept `Ctrl+Alt` fallback.

## Rollback
- Revert commits associated with WP-0004.
