# Work Packet: WP-0110 - Pitch / roll head pose extension

Date: 2026-05-07
Owner: Codex
Status: DONE (dev/live verified; packaged release gate deferred)

## Summary
Extend the pose pipeline from yaw-only rotation to full head pose: yaw + pitch + roll. New backend command `setRigHeadPose`, quaternion-backed `applyHeadRotation` / `applyHeadPose` math, and UI sliders alongside the existing yaw slider. The 3D viewport applies the head pose to the rig; the 2D openpose viewport renders the projected keypoints. Calibration and head-local offsets follow the convention below.

Carry-over citation: derived from OpenRepose `WP-I1-007` (planned, not implemented; design intent only).

## Completion Notes

Implemented 2026-05-07 in CKC's PoseKit stack.

- Product code: `CKC_main/src/posekit/core.mjs`, `core.d.mts`, `PoseView.tsx`, `Pose3DViewport.tsx`, `poseView.module.css`, `library.js`, `main.js`, `preload.js`, `vite-env.d.ts`, `automationCommandMap.js`, and `automationManual.js`.
- Stored contract: `Rig.calibration_json.headPose` contains `{ schemaVersion: 1, order: "YXZ", yaw, pitch, roll, quaternion: [x, y, z, w] }`; legacy `calibration.yaw` remains synchronized for backward compatibility.
- Backend gateway: `setRigHeadPose({ rigId, headPose })` persists normalized head pose and derives a quaternion from yaw/pitch/roll when callers omit one.
- UI: Pose toolbar has yaw/pitch/roll numeric inputs, range sliders, and per-axis reset buttons; Tools / Calibration shows `YXZ` and quaternion readout.
- Live gate: hidden CKC Electron automation, using `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`, detected rig `rig_d815e8ea6a53933eacdf681f84ce6325`, persisted `yaw=30`, `pitch=-15`, `roll=10`, captured `CKC_GOV/targets/CKC/automation_captures/2026-05-07_175728510Z_no_session_wp-0110-head-pose-live.png`, and exported deterministic openpose PNG hash `15e1ec81aed024e92db747aea026ef073bb9701bab0de25fd8124f80a0273116`.
- Verification: focused WP-0110 suite passed, `npx tsc --noEmit` passed, `npm run build` passed, and `npm test -- --test-reporter=spec` passed with 197 passing / 1 skipped.
- Packaged release smoke remains deferred because unrelated future-WP planning files are still dirty in the worktree.

---

## Why
Yaw alone covers half the LoRA-training pose sweep — characters need pitch (looking up/down) and roll (head tilt) for full coverage. WP-0108 establishes yaw-only rig projection; this WP extends that math with a pinned quaternion convention so downstream ComfyUI workflows (and future skill-distillation pipelines per Handshake's pillar 20) can drive head pose deterministically.

## Pre-flight read list

| File | Lines | Why |
|---|---|---|
| `CKC_main/src/pose/rig.ts` | full | The `applyYaw` function and `RigData` types this WP extends. |
| `CKC_main/src/pose/calibration.ts` | full | Calibration-then-rotation order. |
| `CKC_main/src/ui/views/PoseView.tsx` | full | Yaw slider pattern to replicate for pitch + roll. |
| `CKC_main/app/backend/library.js` | search "createRig" | Backend wiring pattern. |
| `CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md` | search "Yaw rotation convention" | The math contract. Pitch + roll add to the same convention. |

Historical source audit: `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\rotation.py:36-81` is a yaw-only baseline. Pitch/roll were planned, not implemented, in `D:\Projects\LLM projects\OpenRepose\.gov\workflow\workpackets\WP-I1-007-pitch-roll-rotation.md:16` and `:25-34`. Do not import or port source.

## Rotation conventions (lock these)

- **Yaw** — rotation around world/subject Y axis. Positive = avatar's head turns to her left (image-right). Anchor: neck position (`body[1]`). (Already pinned by WP-0108.)
- **Pitch** — rotation around local X axis. Positive = avatar's head tips up (chin lifts). Anchor: same neck position.
- **Roll** — rotation around local Z axis. Positive = avatar's head tilts to her right shoulder. Anchor: same neck position.
- **Order/storage**: Tait-Bryan intrinsic `YXZ` using Three.js `Quaternion` as the stored representation. UI yaw/pitch/roll degrees convert at the boundary with `new Euler(pitch, yaw, roll, 'YXZ')`.
- All angles in degrees at the UI; radians only at the math/Three.js boundary; persisted head pose is quaternion + explicit order metadata.

## Field research / prior art

**Pass date**: 2026-05-07
**Searched**:
- GitHub (6DRepNet, DWPose, openpose, controlnet_aux, three.js issues)
- arXiv (last 18 months: head pose, 6D rotation, diffusion conditioning)
- ComfyUI / Civitai docs and articles
- Google AI Edge MediaPipe docs
- Three.js docs and discourse
- Reddit (r/StableDiffusion, r/comfyui — limited useful hits)
- Search queries: "MediaPipe pose_landmarker head pose yaw pitch roll", "ComfyUI ControlNet OpenPose head pose 3-axis", "DWPose openpose 18 keypoints face head pose", "Three.js Euler quaternion intrinsic extrinsic order YXZ head pose", "6DRepNet WHENet head pose", "head pose preservation diffusion conditioning small angle drift", "Civitai openpose 3d editor head rotation pitch roll workflow", "openpose JSON face keypoints 70 head orientation"

**Findings (most relevant)**:

- **OpenPose output spec — face is 2D-only, no head Euler angles** (CMU OpenPose docs) — https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/doc/02_output.md
  - JSON emits `face_keypoints_2d` (x,y,c) plus body head landmarks (nose=0, R/L eye=15/16, R/L ear=17/18 in BODY_25; same five points in COCO_18). No yaw/pitch/roll fields exist downstream — pose-conditioning pipelines that consume openpose JSON cannot read explicit head rotation; they only see those five points and infer orientation from their geometry. Confirms the "head tilt is implicit, not parametric" assumption for ComfyUI/openpose conditioning.

- **DWPose (IDEA-Research, ICCV 2023) — same 18-point body / 68-point face taxonomy as openpose** — https://github.com/IDEA-Research/DWPose
  - DWPose is the de-facto preprocessor in `comfyui_controlnet_aux` and emits the same body-18 schema CKC already uses. Confirms our keypoint contract is wire-compatible with the dominant ComfyUI preprocessor; no head-pose angle is added by DWPose either — head pose lives entirely in the geometry of nose/eyes/ears.

- **comfyui_controlnet_aux preprocessor catalog** (Fannovel16) — https://github.com/Fannovel16/comfyui_controlnet_aux
  - Documents `openpose`, `openpose_hand`, `openpose_faceonly`, `dwpose`. None expose a head-pose angle channel; pitch/roll arrives at ControlNet purely as the 2D arrangement of the five head keypoints relative to the neck. So "ship 3-axis head pose" really means "produce a five-point head splash whose 2D projection encodes pitch and roll correctly."

- **6DRepNet — 6D continuous rotation representation for unconstrained head pose** (Hempel et al., IEEE TIP 33, 2024) — https://github.com/thohemp/6DRepNet
  - Argues against Euler-angle regression specifically because narrow-range Euler representations break for full-range head pose; uses the first two columns of the rotation matrix instead. Even when CKC stores user-facing yaw/pitch/roll, internal rotation should be quaternion or matrix to avoid gimbal lock at pitch = ±90°, then convert at the boundary.

- **Three.js Quaternion / Euler API** — https://threejs.org/docs/pages/Quaternion.html and Euler-order discussion https://github.com/mrdoob/three.js/issues/25275
  - Three.js Euler supports orders XYZ (default), YXZ, ZXY, ZYX, YZX, XZY — all **intrinsic** by convention. `Quaternion.setFromEuler(euler)` and `quaternion.multiply(q)` give us composition without hand-rolled trig. YXZ ("yaw-then-pitch-then-roll", intrinsic) is the standard order for head/camera tracking and is what we should pin.

- **MediaPipe Pose Landmarker does not output head Euler angles** (Google AI Edge docs, last revised Jan 2025) — https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
  - Confirms the worker we already run cannot give us head yaw/pitch/roll natively — pitch/roll must be derived (FaceMesh + solvePnP, or estimated from rig geometry). Long-standing open issue: https://github.com/google-ai-edge/mediapipe/issues/3171 . CKC's source of truth for head pose stays "user-edited rig," not "pulled from MediaPipe."

- **Civitai "Head rotation poses" pack and 3D OpenPose Editor** — https://civitai.com/models/17362 and https://civitai.com/posts/282850
  - Practitioners ship pose packs that combine openpose JSON + depth/normal maps for head pitch/roll because openpose alone is widely acknowledged to be weak for non-yaw head rotation. Reinforces that 3-axis head pose is a real user need that current preprocessors do not solve.

- **"From Large Angles to Consistent Faces"** (arXiv 2508.09476, Aug 2025) — https://arxiv.org/html/2508.09476v2
  - Documents the "identity drift under abrupt head rotation" failure mode in current diffusion video models. Useful framing for WP-0110: small-/mid-angle pitch & roll preservation is exactly the under-served regime that better pose conditioning could improve.

**How findings inform WP-0110**:
- **Pin convention**: Tait-Bryan, **intrinsic YXZ (yaw-Y, pitch-X, roll-Z)**, right-handed (matches Three.js default head/camera convention and the existing `applyYaw` Y-axis rotation). Document in the `RigData` schema. **Supersedes the "yaw → pitch → roll extrinsic" wording in the original draft above.**
- **Use Three.js Quaternion as internal storage**; expose yaw/pitch/roll as derived getters/setters via `Quaternion.setFromEuler(new Euler(pitch, yaw, roll, 'YXZ'))`. No hand-rolled trig, no gl-matrix or mathjs dep — Three.js already in bundle. **Replaces** the `applyPitch` / `applyRoll` Euler-style functions; canonical entry point is `applyHeadRotation(rig, quat, anchor)` with `applyHeadPose({yaw, pitch, roll})` as a thin convenience wrapper that builds the quat.
- **Avoid Euler at the storage boundary** (per 6DRepNet): rig persists rotation as quaternion (4 floats) in `Rig.calibration_json`. Yaw/pitch/roll only at the UI/serialization edge, with explicit `'YXZ'` tag.
- **Output contract stays 2D openpose-18 / face-70**: the deliverable is a re-projection of the five head keypoints (nose, R/L eye, R/L ear) under the new rotation, NOT a new angle field. ComfyUI/DWPose downstream unchanged.
- **Calibration extension**: per-keypoint offsets are applied **after** rotation in head-local space (a user's ear-offset doesn't rotate with pitch). One-line schema note in `Calibration` shape.
- **Soft-clamp pitch to ±75°** in UI; full-range support unnecessary for our generation use case and protects against the narrow-Euler training distribution that most ControlNet OpenPose models were trained on (frontal ± moderate).
- **Add smoke-test deliverable**: a 5×5 grid of (pitch × roll) renders fed through DWPose ControlNet, verifying tracking at ±30° pitch and ±20° roll. Targets the failure regime called out in the Aug-2025 large-angle paper.

**Rejected alternatives**:
- **gl-matrix / mathjs for rotation math** — rejected: Three.js already provides Quaternion + Euler with named-order support; new linalg lib duplicates surface area.
- **Storing rotation as Euler triple in `RigData`** — rejected per 6DRepNet: gimbal lock and order-ambiguity bugs across save/load. Quaternion in storage; Euler only at UI edge.
- **Emitting a head-pose-angle field in our openpose JSON output** — rejected: no preprocessor downstream reads it; would silently diverge from the DWPose/openpose-18 contract.
- **Pulling head Euler from MediaPipe directly** — rejected: not an output of `pose_landmarker`; would require adding FaceMesh + solvePnP just to recover what the user is setting in the editor.

---

## Scope

### In
1. `src/pose/rig.ts` — new functions:
   ```ts
   export function applyHeadRotation(rig: RigData, quaternion: QuaternionLike, anchor?: [number, number]): RigData;
   export function applyHeadPose(rig: RigData, pose: { yaw: number; pitch: number; roll: number; order?: 'YXZ' }, anchor?: [number, number]): RigData;
   ```
   `applyHeadRotation` is canonical at the math layer; `applyHeadPose` is a convenience wrapper that builds an intrinsic `YXZ` quaternion from UI degrees.
2. UI: replace single yaw slider with three sliders (yaw, pitch, roll). Default ranges: yaw -90° to +90°, pitch -75° to +75°, roll -45° to +45°. Reset-to-zero buttons per axis. Numeric input alongside each slider for precise values.
3. Backend: extend `Rig.calibration_json` schema to include a `headPose` field; existing rigs without it default to `{ order: 'YXZ', quaternion: [0, 0, 0, 1], yaw: 0, pitch: 0, roll: 0 }`. New methods:
   - `setRigHeadPose({ rigId, headPose })` — persists to `calibration_json`.
4. Export: openpose JSON export uses the rotated rig; PNG renders at the current head pose.
5. Tests:
   - `test/pose_pitch_roll_math.test.js` — `applyHeadRotation(rig, identityQuat)` is identity; pitch/roll fixture quaternions rotate appropriately.
   - `test/pose_head_pose_order.test.js` — verifies intrinsic `YXZ` quaternion composition and save/load round-trip.
   - `test/pose_export_with_head_pose.test.js` — exporting at non-zero pitch/roll produces deterministic PNG bytes.
6. Spec bump. Manual MANUAL_VERSION bumped. Test suite Section M.4 expanded.
7. Ship as packaged build.

### Out
- 6-DOF (translation). Rotation only.
- Per-keypoint independent rotation (face turns differently from body). Rig moves rigidly.
- Animation interpolation. One static pose per rig.

## Acceptance criteria
- [x] Three sliders + numeric inputs render in the Pose tab; reset-to-zero per axis works.
- [x] 3D viewport reflects yaw + pitch + roll in real time.
- [x] 2D openpose viewport renders correctly at any combination.
- [x] `setRigHeadPose` persists; reload restores all three angles byte-exact.
- [x] Export PNG at non-zero head pose is deterministic.
- [x] Tests pass; existing tests still pass.
- [ ] Packaged build smoke verifies the feature. Deferred until the unrelated future-WP planning files are committed or removed from the dirty worktree.
