# Work Packet: WP-0068 — Reference window power modes

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Enhance the pop-out reference window with opacity and click-through, plus quick toggles/hotkeys.

## Why
- PureRef-like “overlay” workflows (trace/compare while working elsewhere).
- High ROI for artist/reference use without adding heavy UI.
- Spec: `CastKit_Codex_Spec_v00.044.md` §11.15.

## Scope
### In
- Opacity slider (persisted).
- Click-through toggle (persisted; hotkey to toggle).
- Always-on-top toggle (baseline).

### Out
- Full multi-image boards inside the reference window (belongs in moodboard).

## Acceptance criteria
- [ ] Opacity changes apply instantly and persist.
- [ ] Click-through works and is easy to disable via hotkey.

## Test plan
- [ ] Manual: pop out viewer, enable click-through, confirm hotkey toggles it back.

## Notes
- Do NOT touch `D:`.
