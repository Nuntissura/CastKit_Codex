# Work Packet: WP-0108 - Pose pipeline (React + WASM, no Python)

Date: 2026-05-06
Owner: Codex
Status: DRAFT (depends on WP-0107)

## Summary
Build the actual pose pipeline inside CKC: drop a frontal portrait, run mediapipe pose + face_mesh in a Web Worker (WASM), extract keypoints, fit them to a canonical 3D rig, render the rig in a Three.js viewport with orbital inspection, render the openpose-format 2D output at the current yaw on a canvas, and let the operator calibrate per-marker visibility + position. Replaces the OpenRepose Qt UI's primary capability surface with a CKC-native React implementation. No Python sidecar.

## Why
After WP-0107 lands the schema + tab shells, the Pose tab is empty. This WP makes it useful: drop a portrait, get an openpose JSON+PNG suitable for ComfyUI input, scoped to a CKC character. The operator wants the small-angle adherence + facial-feature preservation that drove OpenRepose's original creation, with the same 3D-vector-projection approach, but inside CKC's image library and character workflow.

The hard parts (3D viewport, mediapipe pose detection) are all available as well-maintained JS/WASM packages today; OpenRepose's Python-heavy stack was an accident of being written in <1 day on Python's batteries-included ecosystem. Rebuilding in TS does NOT mean reinventing wheels — it means leaning on different libraries that happen to live in CKC's stack.

## Scope

### In

#### 1. Pose detection (Web Worker)
- New worker: `CKC_main/src/workers/poseDetection.worker.ts`. Loads `@mediapipe/pose` and `@mediapipe/face_mesh` (WASM). Exposes a single message API: `{ kind: 'detect', imageBytes }` → `{ kind: 'result', poseJson, faceMeshJson, durationMs }`.
- Worker bundles the WASM through Vite's worker support (`?worker` import or `new Worker(new URL(...))` pattern). Verified WASM loads from the packaged Electron app's `file://` origin; if the Mediapipe loader resists, copy the WASM assets into `dist/assets/wasm/` and override the loader's base URL.
- Detection runs in a dedicated thread so the main UI never stalls during a 100-300ms inference.

#### 2. Canonical rig data model
- `CKC_main/src/pose/rig.ts` — pure TS module. Types:
  - `Keypoint = { id: string; x: number; y: number; z: number; visibility: number }`
  - `RigData = { keypoints: Keypoint[]; bones: [string, string][]; meta: { detectorVersion: string; sourceWidth: number; sourceHeight: number } }`
  - `Calibration = { perKeypoint: Record<string, { visible: boolean; offsetXY?: [number, number]; offsetZ?: number }>; reframer: { scale: number; offsetX: number; offsetY: number; anchor: 'head' | 'torso' | 'feet' } }`
- `fitMediapipeToRig(mediapipeOutput) → RigData` — converts mediapipe's 33-keypoint pose + face_mesh landmarks into the canonical rig (body + face). Uses the same keypoint id taxonomy OpenRepose used (body_0..17 for openpose body, face_0..67 for face — verify exact ids by reading OpenRepose's `.product/src/openrepose/rig/` and recreating from the spec, not by importing).
- `applyYaw(rig, yawRadians) → RigData` — rotates the rig in scene space around the world Y axis; clamps face_mesh keypoints to the visible hemisphere.
- `applyCalibration(rig, calibration) → RigData` — applies per-keypoint overrides + reframer.

#### 3. 3D viewport (Three.js)
- New component: `CKC_main/src/ui/components/Pose3DViewport.tsx`. Scene: instanced spheres for keypoints (color by body/face), `THREE.Line` segments for bones. OrbitControls for camera (mouse drag rotates camera; mouse wheel zoom; right-drag pan). Yaw is a SEPARATE input slider that rotates the rig itself in scene space.
- Renderer: WebGL2 via `<canvas>`. 60 fps target on a mid-range GPU; falls back to WebGL1 cleanly.
- Uses `react-three-fiber` (`@react-three/fiber` + `@react-three/drei`) — the standard React idiomatic Three.js wrapper. Keeps component code declarative.

#### 4. 2D openpose viewport (canvas)
- New component: `Pose2DViewport.tsx`. Reads `RigData` at current yaw + calibration, renders the canonical openpose color palette (body limbs + face mesh) on a `<canvas>` at the source image resolution.
- Background option: source portrait at low alpha so the operator can see the alignment.
- Export: a single `exportOpenposePng(rig, calibration, yaw, options) → Promise<Blob>` that produces a clean openpose PNG (no background, only the markers) suitable for ComfyUI's openpose preprocessor.

#### 5. Calibration / Markers / Reframer panels
- `CalibrationPanel.tsx` — per-marker visibility + per-marker offset XY/Z sliders. Live updates the 3D + 2D viewports.
- `MarkersPanel.tsx` — quick checkbox list of every keypoint with visibility toggle (subset of Calibration; faster path).
- `ReframerPanel.tsx` — scale / offsetX / offsetY / anchor selector. Live preview on the 2D viewport.
- All three panels write to a single `Calibration` object stored in `Rig.calibration_json`. Auto-save debounced ~500 ms.

#### 6. Backend wiring
Implement the stubs from WP-0107:
- `createRig({ characterId, portraitImageId, poseJson })` — INSERTs a `Rig` row.
- `updateRigCalibration({ rigId, calibrationJson })` — updates and bumps `updated_at`.
- New: `listRigsForCharacter({ characterId })` — convenience.
- New: `exportOpenposePng({ rigId, yawRadians, options })` — runs the canvas export logic in the renderer (the backend is invoked by the renderer with the resulting blob and persists it under `characters/<id>/images/openpose/<contentHashPrefix>.png`, hash-addressed per the identity-decoupling rule).
- New: `setRigPortrait({ rigId, portraitImageId })` — swap portraits without losing calibration (refits the rig but preserves the Calibration object).

#### 7. Pose tab UI assembly
- Layout: left sidebar with the panel list (Calibration / Markers / Reframer); center column with the 3D viewport on top + 2D openpose viewport on bottom; right column with a yaw slider, an "Export openpose PNG" button, and a "Replay in ComfyUI" button (which becomes wired in WP-0109).
- Drag-drop a portrait into the tab → runs detection in the worker → shows progress → opens the calibration view.
- "Save rig" button creates the `Rig` row and links it to the character.

#### 8. Tests
- `test/pose_rig_math.test.js` — pure-TS tests for `fitMediapipeToRig`, `applyYaw`, `applyCalibration`. Use a fixture mediapipe output (small JSON file) instead of running detection. Cases: identity yaw, ±15°, ±90°, calibration-disables-keypoint, reframer-scales.
- `test/pose_export_png_invariants.test.js` — assert the exported PNG byte size + SHA-256 stay stable across re-runs given identical inputs (deterministic export).
- `test/backend_rig_lifecycle.test.js` — full `createRig` / `updateRigCalibration` / `setRigPortrait` round-trip on PG + SQLite.
- `test/pose_worker_smoke.test.js` — boots the worker, sends a tiny test image, asserts a result comes back. Requires the WASM bundle; skipped in CI if not available.

#### 9. Spec bump (next available after WP-0107). Manual MANUAL_VERSION bumped. Test suite Section M expanded.

#### 10. Ship as packaged build. v0.2.12.

### Out
- ComfyUI integration (the "Replay in ComfyUI" button is wired in WP-0109; this WP just renders it disabled).
- Multi-image batch yaw export (drag a folder, get N openpose PNGs at -90° to +90° in 15° increments). Slot for a future WP.
- Hand pose / arm pose detection beyond mediapipe's body 33-keypoint set. Slot for a future WP.
- Animation / interpolation between two rigs. Out of scope.
- Lora training pair extraction from rigged image sets. Out of scope; that's Handshake's pillar.
- Custom keypoint set authoring (operator-defined extra keypoints beyond mediapipe's). Out of scope.

## Acceptance criteria
- [ ] Drop a 1024×1024 portrait into the Pose tab → mediapipe pose + face_mesh runs in the worker → `RigData` materializes within 1 second on a typical operator machine.
- [ ] 3D viewport renders the rig with all 33 body + 68 face keypoints; orbital camera works smoothly; yaw slider rotates the rig (NOT the camera).
- [ ] 2D openpose viewport renders the canonical openpose colors at the current yaw; flipping yaw to ±90° clamps face_mesh keypoints to the visible hemisphere.
- [ ] Calibration / Markers / Reframer panels live-update both viewports; auto-save persists changes to `Rig.calibration_json` within 1 second of last edit.
- [ ] Export openpose PNG produces a deterministic file (same SHA-256 across runs given the same inputs); file lands at `characters/<id>/images/openpose/<hash>.png`; `ImageAsset` row created with `openpose_png_path` populated.
- [ ] All `Rig`-related backend commands listed in the manual; self-consistency test passes.
- [ ] All new tests pass; existing tests still pass.
- [ ] Spec bumped, manual bumped, test suite expanded.
- [ ] `npm run package:win` produces v0.2.12; smoke verifies pose detection + viewports + export work in the packaged build.

## Test plan
- **Unit (math)**: rig math + yaw + calibration with fixture inputs.
- **Unit (worker)**: detection round-trip on a tiny image.
- **Unit (backend)**: rig lifecycle CRUD on both providers.
- **Smoke (manual, dev)**: full pipeline on Aeri's master_base portrait. Compare 0° / +15° / -15° / +90° outputs visually.
- **Smoke (manual, packaged)**: same flow on v0.2.12 NSIS install.

## Governance checklist
- [ ] Task Board: WP-0108 row → IN_PROGRESS / DONE.
- [ ] Spec bump + archive.
- [ ] Codex bullet referencing the OpenRepose absorption rule from WP-0107.
- [ ] Planning-checkpoint commit pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit.
- [ ] Test suite Section M expanded.
- [ ] Live verification via CDP — captures of: Pose tab with rig loaded, 3D viewport at multiple yaws, 2D viewport at multiple yaws, exported openpose PNG.
- [ ] NAS mirror backup script run after shipping commit.

## Implementation notes
- `@mediapipe/pose` and `@mediapipe/face_mesh` are official Google packages. Mediapipe's WASM is ~5-10 MB total — acceptable in CKC's installer.
- `react-three-fiber` is the de-facto React+Three.js wrapper (~900k weekly downloads). Use `@react-three/drei` for OrbitControls and stats overlays.
- The keypoint taxonomy: don't import OpenRepose's exact ids by file copy — recreate from mediapipe's documented `POSE_LANDMARKS` constants. This guarantees CKC's rig is forward-compatible with mediapipe upgrades.
- Worker WASM loading inside Electron + Vite: use Vite's `import.meta.url` worker pattern; verify the WASM resolver finds bytes via the `file://` protocol once packaged. If it doesn't, override `Pose.wasmFileset` with explicit URLs to copies in the renderer's `dist/assets/wasm/`.
- Calibration auto-save: debounce by 500 ms; on tab close, force-flush.
- Identity decoupling: openpose PNGs are content-hash addressed under `images/openpose/`; never include character name.
- The "Replay in ComfyUI" button rendered in this WP is disabled with a tooltip pointing at WP-0109.

## Risks / mitigations
- **Risk**: mediapipe WASM doesn't load cleanly under Electron's `file://` packaging. **Mitigation**: copy WASM artifacts to `dist/assets/wasm/` at build time (Vite plugin) and override the mediapipe loader's base URL in the worker. Pre-validated against the mediapipe team's known issue tracker.
- **Risk**: 3D viewport perf on integrated GPUs. **Mitigation**: use instanced meshes for keypoints (one draw call), keep bone count modest, default to a 60fps cap; degrade to 30fps if frame budget exceeded.
- **Risk**: pose detection fails on stylized portraits (anime, painted). **Mitigation**: ship the manual calibration path as the recovery — operator places keypoints by hand on the 2D viewport and the 3D viewport reflects the manual rig. (This is also OpenRepose's escape hatch.)
- **Risk**: yaw rotation distorts face_mesh in unflattering ways at extreme angles. **Mitigation**: face_mesh keypoints clamped to visible hemisphere; document the tradeoff; future WP could add per-yaw retargeting.

## Rollback
- Revert the WP commit. Pose tab returns to the WP-0107 placeholder. `Rig` rows already created stay valid (their `pose_json` is opaque and survives schema-level read).
