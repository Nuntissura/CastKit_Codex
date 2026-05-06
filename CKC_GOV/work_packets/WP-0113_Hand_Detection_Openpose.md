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

## Field research / prior art

**Pass date**: 2026-05-07
**Searched**:
- Google MediaPipe docs (`ai.google.dev/edge/mediapipe`) — HandLandmarker model card, training data, latency
- GitHub: `google-ai-edge/mediapipe`, `IDEA-Research/DWPose`, `Fannovel16/comfyui_controlnet_aux`, `geopavlakos/hamer`, `wenquanlu/HandRefiner`, `CMU-Perceptual-Computing-Lab/openpose`
- HuggingFace model cards: `xinsir/controlnet-openpose-sdxl-1.0`, `thibaud/controlnet-openpose-sdxl-1.0`, `lllyasviel/control_v11p_sd15_openpose`, `dimitribarbot/controlnet-dwpose-sdxl-1.0`
- arXiv: 2312.05251 (HaMeR), 2307.15880 (DWPose), 2311.17957 (HandRefiner), 2506.12680 (3D Hand Mesh-Guided refinement)
- Civitai workflow tags ("DWPose", "OpenPose Hand", "Hand Fixer"), r/StableDiffusion / r/comfyui via Google

Queries used: "MediaPipe HandLandmarker tasks-vision 21 keypoints accuracy 2025", "DWPose vs OpenPose hand keypoints format ControlNet ComfyUI 2025", "ControlNet OpenPose hand preprocessor input format SDXL 2025", "HandRefiner HaMeR hand mesh diffusion 2025", "DWPose 133 keypoints whole body hand schema", "OpenPose JSON hand_left_keypoints_2d format", "MediaPipe hand landmark stylized art anime occluded limitations", "civitai DWPose workflow OpenPose hand SDXL 2025 production", "comfyui hands still bad 2025 fix workflow handrefiner"

**Findings (most relevant)**:

- **MediaPipe Hand Landmarker model card** (Google AI Edge, current revision) — https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
  - 21 3D landmarks per hand, handedness classifier, 192×192 / 224×224 input, ~17 ms CPU on Pixel 6. Trained on ~30k real images plus synthetic renders. Confirms the model we already load via `@mediapipe/tasks-vision` is the canonical 21-point model and that handedness comes free with the result — we do not need a separate left/right classifier before populating `hand_left_keypoints_2d` vs `hand_right_keypoints_2d`.

- **MediaPipe issue #5806 — occluded hands in multi-person scenarios** (open) — https://github.com/google-ai-edge/mediapipe/issues/5806
  - Documents that the landmark model is not gated by visibility: it will hallucinate full 21-point hands when a hand is partially out of frame or fully occluded. Critical for our portrait pipeline — we must threshold on `min_hand_detection_confidence` and per-landmark visibility/presence and drop the array (export an empty `hand_left_keypoints_2d`/`hand_right_keypoints_2d` rather than a confident-looking ghost) when below threshold.

- **DWPose (IDEA-Research, ICCV 2023, weights still current in 2026)** — https://github.com/IDEA-Research/DWPose and https://arxiv.org/abs/2307.15880
  - 133-keypoint COCO-WholeBody schema = 17 body + 6 foot + 68 face + 42 hand (21 per hand). The COCO-WholeBody hand index ordering is identical to OpenPose's hand 21 (wrist + 5 fingers × 4 joints), so a JSON written for OpenPose hand is directly consumable by ComfyUI DWPose-style preprocessors. Confirms we ship 21 per hand, no special remapping for DWPose interop.

- **comfyui_controlnet_aux — DWPreprocessor / OpenPose preprocessor** (Fannovel16) — https://github.com/Fannovel16/comfyui_controlnet_aux
  - Both preprocessors emit `POSE_KEYPOINT` in OpenPose JSON shape (`people[].pose_keypoints_2d`, `hand_left_keypoints_2d`, `hand_right_keypoints_2d`, `face_keypoints_2d`). DWPreprocessor normalizes x/y to [0,1]; classic OpenPose preprocessor uses pixel coords. The downstream ControlNet model still consumes a *rendered skeleton image*, not raw JSON — the JSON path goes through `convert_pose_keypoints_to_image` / DWPose drawer first.

- **xinsir/controlnet-openpose-sdxl-1.0 model card** (HuggingFace, the de-facto SDXL OpenPose ControlNet in 2025-2026) — https://huggingface.co/xinsir/controlnet-openpose-sdxl-1.0
  - Hard-coded `hand_and_face=False` in the official sample; trained body-only on HumanArt. **Confirms no widely deployed SDXL OpenPose ControlNet is trained on hand keypoints** — hand control on SDXL today is delivered via DWPose-rendered skeletons fed to the body model, or via a depth-based hand refiner, not via a hand-channel ControlNet. SD1.5 (`lllyasviel/control_v11p_sd15_openpose`) is the only widely-shipped model that natively accepts hand+face keypoints in the conditioning image.

- **HaMeR — Reconstructing Hands in 3D with Transformers** (Pavlakos et al., CVPR 2024; HInt annotations May 2024; EgoExo4D challenge 2024) — https://arxiv.org/abs/2312.05251 and https://github.com/geopavlakos/hamer
  - ViT-H + MANO-regression transformer; SOTA on 3D hand pose benchmarks and the practitioner go-to when MediaPipe fails (motion blur, extreme angles, painted/anime). PyTorch + heavy GPU; not a browser-side option, but informs the fallback story: if MediaPipe confidence is low, mark the hand un-emitted and let the ComfyUI side optionally run HaMeR or HandRefiner downstream.

- **HandRefiner — diffusion-based hand inpainting** (Lu et al., ACM MM 2024) — https://arxiv.org/abs/2311.17957 and https://github.com/wenquanlu/HandRefiner
  - Confirms the prevailing 2025-2026 production pattern: don't try to *generate* perfect hands from a 2D skeleton — generate the body, then refine the hand crop with a depth/mesh-guided ControlNet (HandRefiner or MeshGraphormer Hand Refiner) at strength 0.4-0.8. Our 21-point export still has value as the *bounding hint* for the refiner crop.

- **OpenPose output spec — `hand_left_keypoints_2d` / `hand_right_keypoints_2d`** (CMU-Perceptual-Computing-Lab) — https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/doc/02_output.md
  - Canonical schema: flat array `[x0,y0,c0, ... x20,y20,c20]` (length 63), pixel coords by default, confidence in [0,1], nested in `people[]`. This is the exact wire format WP-0113 must emit; matches what comfyui_controlnet_aux already round-trips.

**How findings inform WP-0113**:

- Stick with **canonical OpenPose hand 21** (`[x0,y0,c0,...,x20,y20,c20]`, length 63, pixel coords). Both DWPose and OpenPose preprocessors in `comfyui_controlnet_aux` consume that shape; rendering to a skeleton image is the bridge node's job, not ours. No DWPose-specific JSON variant.

- Emit `hand_left_keypoints_2d` and `hand_right_keypoints_2d` keyed by MediaPipe's `handedness` (top-1 category). Mirror-image portraits (selfies, flipped scans) flip MediaPipe's left/right — add a config flag in the ingest layer rather than guessing.

- **Confidence gate**: drop the entire hand array when palm-detection confidence < 0.5 OR mean per-landmark presence < 0.5, because HandLandmarker hallucinates occluded landmarks (issue #5806). Better an empty array than a confident-wrong one — downstream HandRefiner can fill the gap.

- Recommend SDXL pipelines route hand JSON through a **DWPose-format skeleton render + body-only xinsir ControlNet**, and recommend SD1.5 pipelines use `control_v11p_sd15_openpose` with hand+face channel. **Document in the WP that there is no SDXL ControlNet that natively ingests a hand-keypoint channel as of 2026-05.**

- **Stylized art** (anime, painted): MediaPipe's training set is photographic; expect degraded confidence on stylized portraits. Treat low-confidence hands as a normal/expected outcome and include a `hand_detection_skipped: true` flag in the OpenPose JSON sidecar so downstream ComfyUI workflows can branch into HandRefiner / MeshGraphormer crop-and-refine instead of trying to condition on noise.

- Latency budget: ~12-17 ms/hand on commodity hardware per Google's numbers — adding HandLandmarker to the existing PoseLandmarker + FaceLandmarker worker stays within real-time portrait ingestion. No need for a second worker.

- Schema test: per the code-truth-and-self-consistency principle, ship a CI test that round-trips a fixture portrait through HandLandmarker → OpenPose JSON → `comfyui_controlnet_aux` DWPreprocessor's JSON loader to prove the wire format is byte-compatible.

**Rejected alternatives**:

- **HaMeR in the Web Worker** — rejected. ViT-H + MANO needs a CUDA-class GPU and is not packaged for browser/WASM. Keep as a server-side or ComfyUI-side optional refiner, not a CKC ingestion dependency.

- **DWPose ONNX in-browser instead of MediaPipe** — rejected for this WP. We already have MediaPipe loaded; DWPose's whole-body model is ~100M params and has no first-class WASM/WebGPU build. Switching estimators is a separate WP if MediaPipe quality proves insufficient.

- **Custom hand keypoint schema** — rejected. The OpenPose 21-point format is the lingua franca that DWPose, comfyui_controlnet_aux, HandRefiner, and every Civitai workflow already speak; inventing our own would force a second adapter on the ComfyUI bridge (WP-0109) for zero gain.

**Notes on freshness**: All linked specs are still active references as of 2026-05-07; nothing material superseded since 2026-01 cutoff. The "no SDXL OpenPose ControlNet trained on hand keypoints" finding is the main load-bearing claim worth re-verifying before code-freeze, since a hand-aware SDXL/SD3 OpenPose model could ship at any time and would change the SDXL recommendation above.

---

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
