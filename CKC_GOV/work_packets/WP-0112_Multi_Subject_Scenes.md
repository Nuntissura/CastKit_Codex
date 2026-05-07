# Work Packet: WP-0112 - Multi-subject scenes

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0108 stable build)

## Summary
Extend the `Rig` data model from one subject per portrait to N subjects per scene. Each subject gets independent body 18 + face 70 + (optional) hands keypoints, independent calibration, independent yaw/pitch/roll head pose. The 3D viewport renders all subjects in scene space; the 2D openpose viewport composites them onto a single canvas. ComfyUI bridge emits one combined openpose image plus per-subject masks; `subject_index` selects the mask/conditioning slot.

Carry-over citation: derived from OpenRepose `WP-I1-011` (planned, not implemented; design intent only).

---

## Why
Single-character pose workflows are the common case, but multi-character production scenes (two characters interacting, ensemble shots, before/after pairs) are increasingly load-bearing for LoRA training and for character-relationship work. Without multi-subject support, the operator has to manually composite N single-subject openpose PNGs, losing per-subject calibration + head-pose state.

## Field research / prior art

**Pass date**: 2026-05-07
**Searched**: GitHub (mediapipe, ED-Pose, HigherHRNet, DEKR, MS-Diffusion, Sapiens), arXiv, ECVA/ECCV proceedings, Civitai workflow tag pages, OpenArt, Reddit / Latenode community threads, learnopencv, MarkTechPost, OpenPose docs.

Queries used:
- `mediapipe PoseLandmarker numPoses multiple people limit`
- `Sapiens Meta foundation human vision model multi-person pose`
- `ED-Pose end-to-end multi-person pose estimation github`
- `DEKR HigherHRNet bottom-up multi-person pose comparison benchmark`
- `ComfyUI multi-character workflow regional prompter latent couple two openpose`
- `multi-subject diffusion conditioning paper 2025 InstanceDiffusion MS-Diffusion`
- `openpose multi-person keypoint ordering left to right bounding box convention`
- `reddit StableDiffusion two character generation consistency openpose`

**Findings (most relevant)**:

- **Improving PoseLandmarker multipose** (google-ai-edge/mediapipe issue #4681, open) — https://github.com/google-ai-edge/mediapipe/issues/4681
  - Reproducible failure: with `num_poses=4`, one of two adjacent people is dropped when they come within ~50–75 cm of each other (at 3.5 m). Practical ceiling is **2–3 well-separated subjects**; quality degrades sharply on overlap/occlusion. Confirms we cannot trust `num_poses` alone for crowded scenes.

- **Sapiens / Sapiens2: Foundation for Human Vision Models** (Meta FAIR, ECCV 2024 + April 2026 update) — https://github.com/facebookresearch/sapiens, https://arxiv.org/abs/2408.12569, https://www.marktechpost.com/2026/04/27/meta-ai-releases-sapiens2-a-high-resolution-human-centric-vision-model-for-pose-segmentation-normals-pointmap-and-albedo/
  - Top-down (detector → per-ROI keypoints), 308-keypoint full-body skeleton in Sapiens2 with dense face (243) + hands (40), native 1K input. +7.6 mAP over prior SOTA on Humans-5K. Cleanest fallback if mediapipe `num_poses>2` proves unreliable; but 0.4B–5B params and 1024² is heavyweight for an Electron app.

- **ED-Pose: Explicit Box Detection Unifies End-to-End Multi-Person Pose Estimation** (IDEA-Research, ICLR 2023) — https://github.com/IDEA-Research/ED-Pose
  - End-to-end DETR-style detector that emits person boxes + 17 keypoints in one forward pass; 76.6 AP on CrowdPose. Single-stage, no NMS / heatmap post-processing — simpler integration than HigherHRNet/DEKR if we need crowded-scene robustness.

- **HigherHRNet (CVPR 2020) and DEKR (CVPR 2021)** — https://github.com/HRNet/HigherHRNet-Human-Pose-Estimation, https://github.com/HRNet/DEKR
  - Bottom-up baselines. HigherHRNet hits 67.6 AP on CrowdPose test, beating top-down methods in crowds; DEKR uses disentangled keypoint regression on COCO+CrowdPose. Established prior art for crowded-pose; both PyTorch-only, no in-browser path.

- **MS-Diffusion: Multi-subject Zero-shot Image Personalization with Layout Guidance** (ICLR 2025) — https://arxiv.org/abs/2406.07209, https://github.com/MS-Diffusion/MS-Diffusion
  - Grounding resampler + multi-subject cross-attention; each subject bound to a layout box. Same shape as our planned per-subject `RigData` v2 with bbox + index — validates the "subject = (bbox, conditioning)" abstraction on the diffusion side.

- **ComfyUI Multi-Subject Workflows / Latent Couple Pose v1.1** (Civitai, ongoing) — https://civitai.com/models/21100/comfyui-multi-subject-workflows
  - Real practitioner pattern: extract a single openpose image, **mask-crop per-subject regions**, then feed each cropped pose into Regional Sampling (Impact / Inspire pack) with per-region conditioning. Subjects ordered by region index (1 = masked, 2 = remainder; or sequential in PLUS variant). Confirms ComfyUI side wants *one* combined openpose PNG plus per-subject masks, not N separate openpose inputs.

- **Building a Multi-Character ComfyUI Workflow with Area Conditioning, OpenPose, Style Layering** (A. Zsogon, 2025) — https://www.andreszsogon.com/building-a-multi-character-comfyui-workflow-with-area-conditioning-openpose-control-and-style-layering/
  - Treats composition / pose / style as three independent pipelines; subject identity carried via per-region prompt + LoRA, structure via shared openpose ControlNet. Reinforces that `subject_index` should select a *region/conditioning slot*, not a separate ControlNet image.

- **"Why is pose transfer with character consistency still so difficult in 2025?"** (Latenode community, 2025) — https://community.latenode.com/t/why-is-pose-transfer-with-character-consistency-still-so-difficult-in-2025-looking-for-reliable-image-to-image-solutions-beyond-current-limitations/33329
  - Practitioner pain point: denoise <0.5 preserves identity but ignores pose; >0.6 obeys pose but loses identity. Two-character generation amplifies this — identity bleed across subjects is the dominant failure mode, more than pose accuracy.

**How findings inform WP-0112**:
- **Cap `numPoses` at 4 in schema, default 2, warn UI above 3.** Mediapipe issue #4681 shows degradation starts at 2 close subjects; promising more than that is dishonest. Surface a per-pose `confidence` field so the UI flags degraded detections.
- **Subject ordering: bbox-area descending, ties broken left-to-right by bbox center x.** OpenPose itself defines no canonical multi-person order, and Civitai workflows index by region; area-first matches user intent ("the main subject is #0") and is stable across frames. Persist `subject_index` in `RigData` v2 explicitly — never rely on detector order.
- **Keep mediapipe as primary; add a pluggable `PoseProvider` seam.** v2 schema is detector-agnostic (keypoints + bbox + score + `subject_index`). If field reports show mediapipe failing at N≥3, ED-Pose (lightest end-to-end) and Sapiens-0.4B (highest quality) are the drop-in candidates.
- **Add per-subject FaceLandmarker pass keyed by pose bbox.** FaceLandmarker is single-face-per-call; run once per pose-bbox crop so head pose stays bound to the correct `subject_index`.
- **ComfyUI bridge: emit ONE combined openpose PNG plus per-subject region masks, not N openpose PNGs.** Matches Latent Couple / Regional Sampling convention. `subject_index` selects mask + conditioning slot. **Supersedes the original draft's "ComfyUI bridge gains a `subject_index` input that injects per-subject openpose"** — the bridge emits combined-pose + per-subject-mask instead.
- **Document the identity-bleed risk in WP-0112 acceptance.** Cross-subject identity contamination (Latenode thread) is the #1 pain point; tests include a "two visually distinct characters" smoke case and a manual review gate, not just keypoint MSE.

**Rejected alternatives**:
- **Bottom-up HigherHRNet / DEKR as primary detector** — PyTorch-only, no @mediapipe/tasks-vision-equivalent web/Electron runtime; forces Python sidecar for marginal CrowdPose gains we don't need at N≤4.
- **N separate openpose PNGs into N ControlNet inputs in ComfyUI** — no community workflow does this; convention is single-pose-image + regional masks. Would invent a non-standard bridge contract.
- **Salience-based subject ordering (gaze / face-size weighting)** — no existing tool does it, non-deterministic across frames, unreviewable. Bbox-area ordering is boring and correct.

---

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
4. Detection: when the operator drops a multi-subject image, `PoseLandmarker.detect` runs with `numPoses` capped at 4, default 2, and a UI warning above 3. Each detected pose becomes a `SubjectRig`. Operator can manually add or remove subjects after detection.
5. ComfyUI bridge: new optional input `subject_index` (default `null` = all subjects, `0..N-1` = one mask/conditioning slot). Backend `replayWorkflow` accepts `subjectIndex` and exports the combined openpose PNG plus per-subject masks.
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
- Per-subject IPAdapter inputs in the same workflow. The `subject_index` ComfyUI input selects the region mask / conditioning slot; managing N IPAdapter inputs is the operator's workflow choice.

## Acceptance criteria
- [ ] Drop a 2-person photo → both subjects detected; both render in 3D + 2D viewports.
- [ ] Subject picker switches which subject Calibration / Reframer / head-pose sliders apply to.
- [ ] Per-subject head pose persists; reload restores all subjects' state.
- [ ] OpenPose JSON export contains N `people[]` entries.
- [ ] ComfyUI bridge accepts `subject_index`; replay against `subject_index=1` injects the combined openpose image and subject-1 mask/conditioning slot.
- [ ] Schema migration: existing single-subject rigs load cleanly under the new code.
- [ ] All tests pass.
- [ ] Packaged build smoke with a 2-person fixture verifies the full pipeline.
