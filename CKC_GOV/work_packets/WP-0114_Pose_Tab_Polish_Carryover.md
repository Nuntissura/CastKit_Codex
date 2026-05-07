# Work Packet: WP-0114 - Pose tab polish carry-over

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0109 stable build)

## Summary
Bundle small Pose-tab workflow improvements after the core rebuild lands: multi-file drag/drop import, multi-angle batch export, clear workspace, synchronized viewport zoom / framing, and import of existing OpenPose JSON. These are CKC-native React/TS/PG features, not a port of the historical Python/Qt code.

Carry-over citations: derived from OpenRepose `WP-I1-005`, `WP-I1-010`, `WP-I1-016`, `WP-I1-022`, and `WP-I1-024`.

## OpenRepose source audit

- Multi-file drag/drop: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\drop_helper.py:1-78` validates local image drops; `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\main_window.py:415-448` handles dropped paths.
- Multi-file workspace slots/tabs: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:207-223` defines file slots, `:677-708` opens/closes/lists files, and `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\main_window.py:130-139` creates closeable/movable tabs.
- Multi-angle export: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\yaw_bin.py:81-88` pins the 13 standard yaw bins; `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:819-931` exports batch JSON/PNG plus a manifest.
- Clear workspace: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:1042-1062`, `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\toolbar.py:42-57`, and `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\main_window.py:115-123` / `:450-454`.
- Reframing / synchronized framing: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\openpose_schema.py:281-361`, `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\gui\reframer.py:39-153`, and `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\commands.py:1642-1710`. Synchronized viewport zoom was planned in `D:\Projects\LLM projects\OpenRepose\.gov\workflow\workpackets\WP-I1-024-synchronized-viewport-zoom.md:16-31`.
- Import existing OpenPose JSON: no `.product` implementation found. Design intent is from `D:\Projects\LLM projects\OpenRepose\.gov\workflow\workpackets\WP-I1-022-read-openpose-json-input.md:16-35`.

## Scope

### In
1. Multi-file drag/drop in Pose tab: accept N local PNG/JPG/JPEG/WebP files, create/import one rig task per file, and report rejected files with reasons.
2. Multi-angle batch export command `exportOpenposeAngleBatch({ rigId, angleSet })`: render content-hash-addressed PNG/JSON pairs for the standard 13 bins by default and save a CKC manifest.
3. Clear workspace command `clearPoseWorkspace({ scope })`: reset active transient Pose-tab state without deleting database rows or image assets.
4. Synchronized viewport framing: one reframer state drives the 3D viewport, 2D openpose viewport, and reference preview.
5. Import existing OpenPose JSON command `importOpenposeJson({ characterId, jsonText, sourceImageId? })`: validate canonical OpenPose JSON and create a `Rig` row without running detector fitting.
6. Manual, automation command map, preload/types, and test-suite Section M updates.

### Out
- New detector providers.
- Multi-rig tab strip ownership; that is WP-0115.
- Changing CKC export naming away from content-hash addressing.

## Acceptance criteria

- [ ] Dropping multiple image files queues one rig/import operation per accepted file and reports rejected paths.
- [ ] Batch export writes deterministic JSON/PNG outputs plus a manifest for the 13 standard yaw bins.
- [ ] Clear workspace resets UI state but leaves `Rig`, `ImageAsset`, prompts, and workflow history untouched.
- [ ] Reframer state is shared across Pose-tab viewports without visual desync.
- [ ] Valid OpenPose JSON imports into a `Rig` row; invalid JSON returns a structured validation error.
- [ ] Manual, command map, types, tests, and packaged smoke are updated.
