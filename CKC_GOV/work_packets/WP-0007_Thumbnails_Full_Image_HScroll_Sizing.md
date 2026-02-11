# Work Packet: WP-0007 — Thumbnails: full image (no crop), horizontal scroll, sizing

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Tighten the MediaPane thumbnail strip to match the recovered session dump:
- Thumbnails show the entire image (no unintended crop).
- Thumbnails are horizontal and scroll with the mousewheel.
- Thumbnails can be hidden/shown with a toggle to maximize the main image surface.

## Why
On large displays, the product goal is “image surface first”. Thumbnails must not steal space or crop content unexpectedly, and they must be easy to flick through.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`

## Scope
### In
- MediaPane thumbnail strip uses `object-fit: contain` (full image visible).
- Horizontal thumbnail strip with wheel-to-horizontal scrolling.
- Toggle to hide/show thumbnails.

### Out
- Thumbnail sizing presets UI.
- Per-user persisted thumbnail size.

## Acceptance criteria
- [x] Thumbnails show the full image (no crop).
- [x] Thumbnails are horizontal and mousewheel scroll works.
- [x] Thumbnail strip can be hidden/shown with a toggle.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: verify thumbnails across varied aspect ratios.

## Implementation notes
- Implemented in:
  - `CKC_main/src/ui/components/MediaPane.tsx`
  - `CKC_main/src/ui/components/mediaPane.module.css`

## Rollback
- Revert commits associated with MediaPane thumbnail strip behavior.
