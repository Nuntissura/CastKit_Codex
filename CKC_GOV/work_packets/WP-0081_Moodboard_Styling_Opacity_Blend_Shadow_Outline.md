# Work Packet: WP-0081 — Moodboard: styling (opacity + blend + shadow + outline)

Date: 2026-02-15
Owner: Codex
Status: BACKLOG

## Summary
Add per-layer styling controls so moodboards can be used for real composition: opacity, blend modes, shadows, and outlines.

## Why
- Without styling, shapes/masks feel limited.
- Spec: `CastKit_Codex_Spec_v00.051.md` §11.28.

## Scope
### In
- Per-layer opacity.
- Blend modes: at least normal/multiply/screen.
- Shadow toggle + basic params.
- Outline toggle + basic params.

### Out
- Full Photoshop-level layer effects.

## Acceptance criteria
- [ ] Styling is non-destructive and persists in moodboard JSON.
- [ ] Exported PNG matches on-canvas rendering.

## Test plan
- [ ] Manual: styling combinations and export check.

## Notes
- Do NOT touch `D:`.

