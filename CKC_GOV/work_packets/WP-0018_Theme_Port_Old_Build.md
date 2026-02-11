# Work Packet: WP-0018 — Theme port from old build (palette + typography)

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Port the visual theme (CSS variables + typography) from the recovered old build into the current app so the look/feel matches: palette, accent glow, font stacks, and key field styling (Field ID + optional marker).

## Inputs
- Old install: `<CKC_ROOT>\CKC_recovery\CKC_old_install`
  - Renderer CSS source: `...\resources\app.asar\dist\assets\index-C1dBN_6i.css`

## Changes
- Global theme variables updated to match old build (`--accent-glow`, background gradients, scrollbar styling, font stacks).
- Sheet editor Field ID and optional marker styling aligned with old build.

## Acceptance criteria
- [x] Global palette + typography match old build (vars + font stacks).
- [x] Field IDs render as accent-colored pills; optional marker is subdued/italic.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
