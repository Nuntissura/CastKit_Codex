# Work Packet: WP-0066 — Color tools (palettes + search)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Compute and store dominant color palettes for images and add a “filter by color” control.

## Why
- High ROI browsing for visual reference libraries.
- Enables fast “find images with this vibe color” workflows.
- Spec: `CastKit_Codex_Spec_v00.043.md` §11.13.

## Scope
### In
- Extract dominant palette (e.g. 5–8 colors) per image and cache it in DB.
- UI: show palette chips in image metadata.
- UI: pick a color → show similar images (threshold slider optional).

### Out
- Advanced color analytics (temperature, harmonies, clustering UI).

## Acceptance criteria
- [x] Palette extraction runs lazily and persists (no rework every view).
- [x] Color filter finds visually relevant matches in typical libraries.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] Manual: run palette scan on a small set; verify chips and filtering.

## Implementation notes
- Use a lightweight JS image decode path (existing thumbs PNGs are ideal input).
  - Implementation uses Electron `nativeImage` on thumbs when available and caches into `ImageAsset.palette_json`.

## Notes
- Do NOT touch `D:`.
