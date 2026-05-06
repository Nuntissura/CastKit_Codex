# Work Packet: WP-0110 - Pitch / roll head pose extension

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0108 stable build)

## Summary
Extend the pose pipeline from yaw-only rotation to full head pose: yaw + pitch + roll. New backend commands `setPitch`, `setRoll`, `setPose`. New UI sliders alongside the existing yaw slider. The 3D viewport applies all three rotations to the rig; the 2D openpose viewport renders the rotated rig at every angle. Calibration applies before rotation.

Carry-over citation: derived from OpenRepose `WP-I1-007` (planned, not implemented; design intent only).

---

## Why
Yaw alone covers half the LoRA-training pose sweep — characters need pitch (looking up/down) and roll (head tilt) for full coverage. The existing rig math already supports arbitrary rotation; this WP exposes pitch + roll as first-class controls and pins the convention so downstream ComfyUI workflows (and future skill-distillation pipelines per Handshake's pillar 20) can drive them.

## Pre-flight read list

| File | Lines | Why |
|---|---|---|
| `CKC_main/src/pose/rig.ts` | full | The `applyYaw` function and `RigData` types this WP extends. |
| `CKC_main/src/pose/calibration.ts` | full | Calibration-then-rotation order. |
| `CKC_main/src/ui/views/PoseView.tsx` | full | Yaw slider pattern to replicate for pitch + roll. |
| `CKC_main/app/backend/library.js` | search "createRig" | Backend wiring pattern. |
| `CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md` | search "Yaw rotation convention" | The math contract. Pitch + roll add to the same convention. |

External: OpenRepose `D:\Projects\LLM projects\OpenRepose\.product\src\openrepose\rotation.py:36-81` for pitch/roll convention reference (do not import).

## Rotation conventions (lock these)

- **Yaw** — rotation around world Y axis. Positive = avatar's head turns to her left (image-right). Anchor: neck position (`body[1]`). (Already pinned by WP-0108.)
- **Pitch** — rotation around world X axis. Positive = avatar's head tips up (chin lifts). Anchor: same neck position.
- **Roll** — rotation around world Z axis. Positive = avatar's head tilts to her right shoulder. Anchor: same neck position.
- **Order**: yaw → pitch → roll (extrinsic, applied in that sequence). Document this order in `rig.ts` and pin via tests.
- All angles in degrees at the UI; radians at the math layer; conversion at the boundary.

## Scope

### In
1. `src/pose/rig.ts` — new functions:
   ```ts
   export function applyPitch(rig: RigData, pitchRadians: number, anchor?: [number, number]): RigData;
   export function applyRoll(rig: RigData, rollRadians: number, anchor?: [number, number]): RigData;
   export function applyHeadPose(rig: RigData, pose: { yaw: number; pitch: number; roll: number }, anchor?: [number, number]): RigData;
   ```
   Applied in yaw → pitch → roll order. `applyHeadPose` is the canonical entry point.
2. UI: replace single yaw slider with three sliders (yaw, pitch, roll). Default range -90° to +90° per axis. Reset-to-zero buttons per axis. Numeric input alongside each slider for precise values.
3. Backend: extend `Rig.calibration_json` schema to include a `headPose` field; existing rigs without it default to `{ yaw: 0, pitch: 0, roll: 0 }`. New methods:
   - `setRigHeadPose({ rigId, headPose })` — persists to `calibration_json`.
4. Export: openpose JSON export uses the rotated rig; PNG renders at the current head pose.
5. Tests:
   - `test/pose_pitch_roll_math.test.js` — `applyPitch(rig, 0)` is identity; `applyPitch(rig, π/2)` rotates appropriately; same for roll.
   - `test/pose_head_pose_order.test.js` — verifies yaw→pitch→roll extrinsic order.
   - `test/pose_export_with_head_pose.test.js` — exporting at non-zero pitch/roll produces deterministic PNG bytes.
6. Spec bump. Manual MANUAL_VERSION bumped. Test suite Section M.4 expanded.
7. Ship as packaged build.

### Out
- 6-DOF (translation). Rotation only.
- Per-keypoint independent rotation (face turns differently from body). Rig moves rigidly.
- Animation interpolation. One static pose per rig.

## Acceptance criteria
- [ ] Three sliders + numeric inputs render in the Pose tab; reset-to-zero per axis works.
- [ ] 3D viewport reflects yaw + pitch + roll in real time.
- [ ] 2D openpose viewport renders correctly at any combination.
- [ ] `setRigHeadPose` persists; reload restores all three angles byte-exact.
- [ ] Export PNG at non-zero head pose is deterministic.
- [ ] Tests pass; existing tests still pass.
- [ ] Packaged build smoke verifies the feature.
