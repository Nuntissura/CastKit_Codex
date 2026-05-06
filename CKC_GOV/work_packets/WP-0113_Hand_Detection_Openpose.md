# Work Packet: WP-0113 - Hand detection + openpose hand keypoints

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0108 stable build)

## Summary
Add MediaPipe hand detection to the pose pipeline. Each detected hand contributes 21 keypoints (wrist + 4 joints per 5 fingers); both hands surface in the openpose JSON export under `hand_left_keypoints_2d` and `hand_right_keypoints_2d` (63 floats each). Renders in 3D and 2D viewports. Enables DWPose-style hand conditioning in ComfyUI.

Carry-over citation: derived from OpenRepose `WP-I1-018` (in REVIEW; design intent is locked but operator sign-off pending).

---

## Why
DWPose and several ControlNet workflows use hand keypoints to condition image generation on specific hand gestures and finger positions — critical for character poses involving prop interaction, signing, or expressive gestures. The body-18 + face-70 from WP-0108 leaves both hands as zero-filled in the OpenPose JSON; this WP fills them in.

## Pre-flight read list

| File | Lines | Why |
|---|---|---|
| `CKC_main/src/workers/poseDetection.worker.ts` | full (after WP-0108) | Add `HandLandmarker` runner alongside the existing pose + face runners. |
| `CKC_main/src/pose/rig.ts` | full | `RigData.handLeft` / `handRight` are already optional — populate them. |
| `CKC_main/src/ui/components/Pose2DViewport.tsx` | full | Add hand rendering pass after body + face. |
| `CKC_main/src/ui/components/Pose3DViewport.tsx` | full | Add hand keypoints + bones to the scene. |
| `CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md` | search "Hand 21" | Hand 21 keypoint reference. |

## Hand 21 keypoint taxonomy (canonical OpenPose hand)

```ts
// Standard openpose hand 21 keypoint order. Wrist (0) + thumb (1-4) +
// index (5-8) + middle (9-12) + ring (13-16) + pinky (17-20).
// MediaPipe Hands publishes the same 21-point taxonomy in the same order
// (HandLandmarker.HAND_LANDMARKS), so the mapping is identity.
export const HAND_21 = [
  { idx: 0,  id: 'wrist' },
  { idx: 1,  id: 'thumb_cmc' },
  { idx: 2,  id: 'thumb_mcp' },
  { idx: 3,  id: 'thumb_ip' },
  { idx: 4,  id: 'thumb_tip' },
  { idx: 5,  id: 'index_mcp' },
  { idx: 6,  id: 'index_pip' },
  { idx: 7,  id: 'index_dip' },
  { idx: 8,  id: 'index_tip' },
  { idx: 9,  id: 'middle_mcp' },
  { idx: 10, id: 'middle_pip' },
  { idx: 11, id: 'middle_dip' },
  { idx: 12, id: 'middle_tip' },
  { idx: 13, id: 'ring_mcp' },
  { idx: 14, id: 'ring_pip' },
  { idx: 15, id: 'ring_dip' },
  { idx: 16, id: 'ring_tip' },
  { idx: 17, id: 'pinky_mcp' },
  { idx: 18, id: 'pinky_pip' },
  { idx: 19, id: 'pinky_dip' },
  { idx: 20, id: 'pinky_tip' },
] as const;

// 20 bone pairs per hand (wrist-to-finger-roots + finger segments).
export const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],     // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],     // index
  [0, 9], [9, 10], [10, 11], [11, 12], // middle
  [0, 13], [13, 14], [14, 15], [15, 16], // ring
  [0, 17], [17, 18], [18, 19], [19, 20], // pinky
];

// Hand line color: cyan (0, 255, 255) RGB. Hand keypoint dots: white. Line thickness: 2 px.
```

## Scope

### In
1. Add `@mediapipe/tasks-vision` `HandLandmarker` to the existing pose detection worker. Detection runs in parallel with pose + face_mesh against the same image bitmap. Returns up to 2 hands (`numHands: 2`).
2. `src/pose/rig.ts`: populate `RigData.handLeft` and `handRight` from the detector output. MediaPipe `HandLandmarker` returns `handednesses` (`Left`/`Right` classification) per detected hand; map appropriately. Hand 21 indices align directly with mediapipe order — no re-mapping.
3. 2D viewport: render hand bones in cyan, hand keypoints as white dots, after body + face passes.
4. 3D viewport: render hand keypoints as small spheres; bones as line segments.
5. OpenPose JSON export: populate `hand_left_keypoints_2d` and `hand_right_keypoints_2d` arrays (63 floats each). Confidence per keypoint = mediapipe `visibility` if available, else `1.0`.
6. Hand-specific calibration: optional per-hand visibility flag in `Calibration.perKeypoint` covers `hand_left_*` and `hand_right_*` ids; reuse existing infra.
7. UI: add a "Hands detected: 0/1/2" indicator in the Pose tab; toggle per-hand visibility.
8. Tests:
   - `test/hand_detection_taxonomy.test.js` — fixture mediapipe hand output → 21 keypoints; left/right correctly mapped.
   - `test/hand_openpose_export.test.js` — both hands present in exported JSON; 63 floats each.
   - `test/hand_2d_render_smoke.test.js` — render sample produces non-trivial bytes.
9. Spec bump, manual bump, test suite expanded.
10. Ship as packaged build.

### Out
- Hand-only mode (skip body + face). The detection runs all three.
- Per-finger calibration controls. Visibility per hand only; finer-grained is a follow-up.
- Hand pose presets. Future WP.

## Acceptance criteria
- [ ] Drop a portrait with one or both hands visible → hand keypoints appear in 3D + 2D viewports.
- [ ] OpenPose JSON export contains 63 floats per hand (or zeros if not detected).
- [ ] Hands rotate correctly with the rig under yaw/pitch/roll.
- [ ] ComfyUI workflow with a DWPose hand-conditioning node accepts the exported PNG end-to-end.
- [ ] All tests pass.
- [ ] Packaged build smoke verifies a portrait with hands produces a usable hand-conditioned ComfyUI generation.
