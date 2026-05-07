# Work Packet: WP-0115 - Multi-rig workspace tabs

Date: 2026-05-07
Owner: Codex
Status: DONE (dev/live, 2026-05-07)

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

## Field research / prior art

- WAI-ARIA APG Tabs pattern (2026-05-07): closeable workspace tabs should use `tablist` / `tab` / `tabpanel`, `aria-controls`, active `aria-selected`, Left/Right/Home/End navigation, and optional Delete-to-close. Source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- MDN `tab` role reference confirms `tab` children must belong to a `tablist`, coordinate `aria-selected`, and can support Delete removal when tab closing is allowed. Source: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tab_role
- React's current state-identity guidance says state belongs to render-tree position and stable keys/IDs define independent conceptual workspaces. CKC therefore keeps the durable selected rig in lifted state and keys visible tabs by `rigId`, not index. Source: https://react.dev/learn/preserving-and-resetting-state
- Electron's current `contextBridge` guidance favors a narrow preload wrapper over exposing `ipcRenderer` directly. CKC therefore adds explicit preload methods for the five workspace commands. Source: https://www.electronjs.org/docs/latest/api/context-bridge/
- Hugging Face Spaces and Civitai/practitioner scan found no better rig-tab-specific implementation pattern. The useful lesson from practitioner multi-reference workflows is compact in-app switching instead of relying on many browser tabs; CKC implements that as a Pose-local tab strip and defers drag/reorder UI until the app has a consistent accessible drag pattern.

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

- [x] Opening multiple rigs shows one tab per rig and preserves active-tab state across navigation within the running session.
- [x] Closing a tab removes it from the workspace without deleting database rows or image assets.
- [x] Switching tabs updates the Pose tab viewports, controls, calibration, and export target to the selected rig.
- [x] Per-tab unsaved state is visible and cannot be silently discarded.
- [x] Tests cover open/close/activate/reorder commands and UI smoke covers two open rigs.

## Implementation notes

- Added session-scoped rig workspace state to `CKCLibrary`: ordered open rig IDs, active rig ID, and optional transient state map.
- Added backend/IPC/preload/automation/manual/type wiring for `listOpenRigs`, `openRigWorkspace`, `setActiveRig`, `closeRigWorkspace`, and `reorderOpenRigWorkspaces`.
- Added the Pose workspace tab strip above the rig workspace with stable automation selectors: `pose-workspace-tabs`, `pose-workspace-tab`, and `pose-close-workspace-tab`.
- The Pose Library panel now opens/activates a rig workspace when a rig is selected. Create/detect flows also open the resulting rig workspace.
- Switching or closing the active rig persists dirty calibration before the active workspace changes. The active dirty workspace shows a visible indicator.
- Backend reorder is implemented and covered by tests. Drag/reorder UI is intentionally deferred because CKC does not yet have an established accessible drag pattern in this surface.

## Verification

- `node --test test/rig_workspace_tabs.test.js test/posekit_ui_static.test.js test/automation_manual_consistency.test.js`
- `npx tsc --noEmit`
- Live Electron/CDP automation used `CKC_GOV/references/posekit_samples/wp-0115-813965426.jpg` and `CKC_GOV/references/posekit_samples/wp-0111-1085406391.jpg`.
- Live result: character `char_c2fcc4dcd3f6316682239f968df787ed`, rig tabs `rig_69deb074d2fc64941d0f954325704b07` and `rig_4b3063cf3132a41077cc87ed907eec9d`; per-tab Tools/Markers state restored, closing the active second tab left the first tab active, and both Rig rows persisted.
- Captures: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_200417170Z_no_session_wp-0115-final-two-rig-tabs.png` and `CKC_GOV/targets/CKC/automation_captures/2026-05-07_200417510Z_no_session_wp-0115-final-after-close.png`.
