# WP-0030 — Media panel chrome: filters, thumbs, hotkeys, and overlap fixes

Date: 2026-02-11
Owner: Codex
Status: DONE

NOTE: Some items in the manual test plan are pending user smoke verification in the packaged build.

## Summary
Improve the media panel UX to match “portfolio book” expectations: navigation with arrow keys, larger thumbnails, stable filters that never trap the user, and move media controls out of the image area (plus fix the hamburger overlap with the Carousel/Photos toggle).

## Motivation / context
- Current filters can hide the selected image and then the filter UI disappears (user gets stuck).
- Media controls are currently drawn on top of the image; user wants them next to the Carousel/Photos toggle.
- Thumbnails are too small for a 4K/TV workflow.
- Hamburger icon overlaps the Carousel/Photos toggle in some layouts.

## Scope
- Media navigation:
  - Arrow Left/Right to navigate images (respect “ignore while typing”).
- Rating assignment:
  - LAlt+0-5 sets rating 0-5 (0 clears) and ignores keybinds while typing.
- Filters:
  - Filters remain accessible even when there is no selected image / zero matches.
  - Add a clear “No images match filters” message + “Clear filters” action.
- Chrome placement:
  - Controls (Controls/Thumbs/Fullscreen) and filter toggles live in the panel header next to Carousel/Photos (not on top of the image).
- Thumbnails:
  - Double thumbnail size (and keep full-image contain behavior).
  - In Photos mode, show a per-thumbnail “carousel” toggle (adds/removes `carousel` tag).
- Frontpage:
  - Increase character icon/thumbnail size in the frontpage list/grid.
- Hamburger overlap:
  - Ensure the fixed menu button does not cover the media header buttons.

## Non-goals
- Reworking the slideshow/fullscreen design beyond control placement.

## Acceptance criteria
- [x] Arrow keys navigate media outside fullscreen.
- [x] LAlt+0-5 assigns rating (0 clears).
- [x] Filters never trap the user (controls still visible at zero results).
- [x] Media controls are not drawn on top of the image.
- [x] Thumbnails are ~2× larger.
- [x] Photos mode exposes a quick “carousel” toggle per image.
- [x] Menu button no longer overlaps Carousel/Photos toggle.

## Test plan
- [ ] Manual: filter down to 0 results; confirm you can clear filters without restarting.
- [ ] Manual: arrow nav works while not typing; does nothing while typing in inputs.
- [ ] Manual: LAlt+0 clears rating; LAlt+1..5 assigns rating; does nothing while typing in inputs.
- [ ] Manual: toggle carousel per thumbnail; confirm carousel mode updates.
- [x] Automated: `npm test`.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [x] Spec impact: yes (media UX). Bump spec + mirror into `CKC_main/docs/`.
