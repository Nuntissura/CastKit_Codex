# Work Packet: WP-0082 — Moodboard: export powerhouse (hi-res + selection + PDF)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add higher quality export options for moodboards: hi-res PNG, export selection only, and PDF export/print.

## Why
- Moodboards become shareable artifacts.
- Current export uses viewport canvas; needs a “real export” path.
- Spec: `CastKit_Codex_Spec_v00.052.md` §11.29.

## Scope
### In
- Hi-res PNG export with scale factor.
- Export selected layers only (tight bounding box).
- PDF export or print-to-PDF.

### Out
- Animated exports.

## Acceptance criteria
- [x] Export resolution matches requested scale without UI chrome.
- [x] Selection-only export is cropped correctly.
- [x] PDF export works on Windows.

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm test`
- [ ] Manual: export flows from Export Hub (recommended).

## Notes
- Do NOT touch `D:`.
