# Work Packet: WP-0052 - Moodboard gradient tool upgrade

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Improve the gradient tool so it feels less “toy”:
- Drag-to-set direction (instead of only a slider).
- Optional radial gradient.
- Live preview updates while adjusting.

## Why
- Current gradient is usable but clunky and not “Photoshop-like”.

## Scope
### In
- Gradient gesture on canvas.
- Better controls for gradient parameters.

### Out
- Multi-stop gradients and blend modes (later).

## Acceptance criteria
- [x] Dragging on canvas sets the gradient direction.
- [x] Live preview while dragging/adjusting.

## Test plan
- [x] Manual: set multiple gradients quickly; verify persistence.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated with this WP status.
- [x] Spec updated + mirrored.
