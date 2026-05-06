# Work Packet: WP-0112 - Multi-subject scenes

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0108 stable build)

## Summary
Extend the `Rig` data model from one subject per portrait to N subjects per scene. Each subject gets independent body 18 + face 70 + (optional) hands keypoints, independent calibration, independent yaw/pitch/roll head pose. The 3D viewport renders all subjects in scene space; the 2D openpose viewport composites them onto a single canvas. ComfyUI bridge gains a `subject_index` input so workflows can target a specific subject.

Carry-over citation: derived from OpenRepose `WP-I1-011` (planned, not implemented; design intent only).

---

## Why
Single-character pose workflows are the common case, but multi-character production scenes (two characters interacting, ensemble shots, before/after pairs) are increasingly load-bearing for LoRA training and for character-relationship work. Without multi-subject support, the operator has to manually composite N single-subject openpose PNGs, losing per-subject calibration + head-pose state.

## Pre-flight read list

| File | Lines | Why |
|---|---|---|
| `CKC_main/src/pose/rig.ts` | full | The single-subject types this WP extends. |
| `CKC_main/src/ui/components/Pose3DViewport.tsx` | full | Single-subject rendering — extend to iterate over subjects. |
| `CKC_main/src/ui/components/Pose2DViewport.tsx` | full | Same. |
| `CKC_main/src/ui/views/PoseView.tsx` | full | Single-subject UI — extend to add a subject picker. |
| `CKC_main/comfyui_node/castkit_codex_bridge.py` | full | Add `subject_index` input. |
| `CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md` | full | Schema and OpenPose JSON format. |

## Schema migration (additive, per WP-0106)

The existing `Rig.pose_json` is single-subject. Migration path:

- **Option A (recommended)**: bump `RigData.schemaVersion` to 2; the new shape carries `subjects: SubjectRig[]`. WP-0108 rigs (schemaVersion: 1) load via a one-shot adapter (`{body, face} → {subjects: [{body, face}]}`).
- **Option B**: parallel `MultiSubjectRig` table. More code, less migration risk.

Pick A: reuses existing `Rig` rows; the JSON column is opaque so adding a `subjects` field is transparent to PG/SQLite.

```ts
type SubjectRig = {
  subjectIndex: number;       // 0-based
  label?: string;             // optional operator label, e.g. 'foreground' | 'background' | character public_id
  body: Keypoint[];           // length 18
  face: Keypoint[];           // length 70 (or 0)
  handLeft?: Keypoint[];
  handRight?: Keypoint[];
  calibration: Calibration;   // per-subject; default reframer applies to subject's bounding box, not canvas
  headPose: { yaw: number; pitch: number; roll: number };
};

type RigData = {
  schemaVersion: 2;
  subjects: SubjectRig[];
  meta: {
    detectorVersion: string;
    sourceWidth: number;
    sourceHeight: number;
    detectedAt: string;
    processingDurationMs: number;
  };
};
```

`mediapipe` Pose can detect multiple poses per image (`numPoses: N`). For face_mesh, run the detector per-subject on a cropped region of interest.

## Scope

### In
1. Schema migration: bump `RigData.schemaVersion`; backward-compat adapter at load time.
2. `src/pose/rig.ts`: every existing function (`fitMediapipeToRig`, `applyYaw`, `applyCalibration`, `exportOpenposeJson`) gains a multi-subject path. Single-subject helpers stay as wrappers (`getSubject(rig, 0)` for the common case).
3. UI: the Pose tab gains a "Subjects" panel listing detected subjects (or operator-added). Per-subject selection drives which subject the Calibration / Markers / Reframer / head-pose sliders apply to. The 3D viewport always shows all subjects; the 2D viewport composites all subjects.
4. Detection: when the operator drops a multi-subject image, `mediapipe.PoseLandmarker.detect` runs with `numPoses: 4` (configurable up to 8); each detected pose becomes a `SubjectRig`. Operator can manually add or remove subjects after detection.
5. ComfyUI bridge: new optional input `subject_index` (default `null` = all subjects, `0..N-1` = single subject). Backend `replayWorkflow` accepts `subjectIndex` parameter.
6. OpenPose JSON export: standard format already supports multiple `people[]` entries — N subjects → N people entries.
7. Tests:
   - `test/multi_subject_rig_math.test.js`
   - `test/multi_subject_detection_smoke.test.js` (uses a fixture 2-person image)
   - `test/multi_subject_openpose_export.test.js` — N subjects produce N people[] entries; each is independently rotatable.
   - `test/rig_schema_migration_v1_to_v2.test.js` — old rigs (schemaVersion: 1) load cleanly under the new code.
8. Spec bump, manual bump, test suite expanded.
9. Ship as packaged build.

### Out
- Subject-to-subject relationship inference (e.g. "facing each other"). Geometry is operator-driven.
- Subject identity matching across frames. Each rig stands alone.
- Per-subject IPAdapter inputs in the same workflow. The `subject_index` ComfyUI input lets the operator route per-subject; managing N IPAdapter inputs is the operator's workflow choice.

## Acceptance criteria
- [ ] Drop a 2-person photo → both subjects detected; both render in 3D + 2D viewports.
- [ ] Subject picker switches which subject Calibration / Reframer / head-pose sliders apply to.
- [ ] Per-subject head pose persists; reload restores all subjects' state.
- [ ] OpenPose JSON export contains N `people[]` entries.
- [ ] ComfyUI bridge accepts `subject_index`; replay against `subject_index=1` injects only that subject's openpose.
- [ ] Schema migration: existing single-subject rigs load cleanly under the new code.
- [ ] All tests pass.
- [ ] Packaged build smoke with a 2-person fixture verifies the full pipeline.
