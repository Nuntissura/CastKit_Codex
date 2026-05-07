# Work Packet: WP-0116 - Extended keyboard shortcuts

Date: 2026-05-07
Owner: Codex
Status: PLANNED (low priority; depends on WP-0109 stable build)

## Summary
Define and wire a CKC-wide keyboard shortcut set for the Pose and Workflow surfaces after their core commands settle. This is UX polish: use CKC's existing command-dispatch and manual patterns, avoid OS-global shortcuts, and respect focused form controls.

Carry-over citation: derived from OpenRepose `WP-I1-004` (planned, not implemented beyond primary menu shortcuts).

## OpenRepose source audit

- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\main_window.py:89-112` wires only the primary menu shortcuts (`Ctrl+O`, `Ctrl+E`, `Ctrl+Shift+E`, `Ctrl+Q`).
- `D:\Projects\LLM projects\OpenRepose\.gov\workflow\workpackets\WP-I1-004-extended-keyboard-shortcuts.md:16` records the planned shortcut WP, and `:30-35` lists examples such as `Ctrl+R`, `Ctrl+1..9`, `[`, `]`, Shift variants, and `F5`.

No broader `.product` implementation exists. CKC should design the final shortcut map around CKC command names, CKC navigation, and Electron focus rules.

## Scope

### In
1. Final shortcut map for Pose / Workflow actions, including open/import, export current pose, export angle batch, replay workflow, switch rig tabs, switch major panels, and reset active control.
2. Electron/React event handling that ignores shortcuts while text inputs, textareas, contenteditable nodes, select boxes, sliders, and modal dialogs own focus unless the shortcut is explicitly safe.
3. In-app manual command reference and visible shortcut labels where CKC already shows shortcut hints.
4. Tests for shortcut registry uniqueness, focus-safety, and command dispatch.

### Out
- OS-global shortcuts.
- Shortcuts for features that have not shipped by WP-0116 start.
- Replacing CKC's existing navigation model.

## Acceptance criteria

- [ ] Shortcut registry has no duplicate active chords and no collisions with existing CKC shortcuts.
- [ ] Shortcuts dispatch through existing CKC command surfaces rather than bypassing backend/manual contracts.
- [ ] Text entry and modal focus are protected from accidental shortcut activation.
- [ ] Manual and test suite list every shipped shortcut.
- [ ] Packaged smoke verifies key actions on Windows.
