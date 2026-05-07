# Work Packet: WP-0115 - Multi-rig workspace tabs

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0109 stable build)

## Summary
Add a Pose-tab tab strip for working with multiple rigs at once. Each tab owns one rig/portrait workspace with its own yaw, calibration, reframer, head pose, selected subject, and dirty/save state. CKC persists the durable rig data in the database and keeps only open-tab ordering/active-tab state as UI session state.

Carry-over citation: derived from OpenRepose `WP-I1-037` (REVIEW status in the historical taskboard).

## OpenRepose source audit

- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:207-223` defines a `FileSlot` for multi-file workspace state.
- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:248-255` stores open file IDs and active file ID.
- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:677-708` implements open/close/set-active/list file commands.
- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\main_window.py:130-139` creates a closeable/movable tab widget.
- `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\drop_helper.py:1-67` validates multi-file drops that feed the workspace.
- `D:\Projects\LLM projects\OpenRepose\.gov\workflow\workpackets\WP-I1-037-multi-file-workspace-implementation.md:17-27` records the historical implementation scope.

Implementation comments in CKC product code may cite these exact file/line ranges for recreated behavior. They must not use the historical project name as a product identifier, UI/manual phrase, test name, fixture path, generated artifact path, or export name.

## Scope

### In
1. Backend commands:
   - `listOpenRigs({ characterId? })`
   - `openRigWorkspace({ rigId })`
   - `setActiveRig({ rigId })`
   - `closeRigWorkspace({ rigId })`
   - `reorderOpenRigWorkspaces({ rigIds })`
2. Pose-tab UI tab strip with close buttons, dirty indicators, keyboard-accessible activation, and drag/reorder if CKC's existing UI patterns support it.
3. Per-tab transient state for viewport camera, selected panel, selected marker, selected subject, and pending export options.
4. Durable per-rig state remains in existing/future `Rig.calibration_json` and related tables; closing a tab never deletes data.
5. Manual, automation command map, preload/types, and tests.

### Out
- Multi-subject rig schema changes; that is WP-0112.
- Multi-file drag/drop import; that is WP-0114.
- Cross-tab diff/compare tooling.

## Acceptance criteria

- [ ] Opening multiple rigs shows one tab per rig and preserves active-tab state across navigation within the running session.
- [ ] Closing a tab removes it from the workspace without deleting database rows or image assets.
- [ ] Switching tabs updates the Pose tab viewports, controls, calibration, and export target to the selected rig.
- [ ] Per-tab unsaved state is visible and cannot be silently discarded.
- [ ] Tests cover open/close/activate/reorder commands and UI smoke covers two open rigs.
