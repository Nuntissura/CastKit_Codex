# Work Packet: WP-0117 - Stylized-portrait landmark detector research

Date: 2026-05-07
Owner: Codex
Status: PLANNED (research; post-WP-0109 stable build)

## Summary
Pure research WP. Benchmark face-landmark detectors on stylized / anime / painted / illustrated / semi-real portraits where mediapipe FaceLandmarker (the WP-0108 default) underperforms. Output: a recommendation report and, if a swap is justified, a follow-up implementation WP. No CKC product code lands in this WP.

Carry-over citation: derived from OpenRepose `WP-I1-008` (planned, not implemented; design intent only).

---

## Why
WP-0108 ships mediapipe `FaceLandmarker` as the canonical 70-point face source; the model is documented to fail on stylized inputs (anime, painted, illustration). The character workflows CKC ingests will increasingly include stylized portraits — Aeri herself is a semi-realistic generated avatar; future characters span anime to photoreal. Without a credible plan for stylized-face landmarks, every downstream stage (openpose export, identity profiles in WP-0111, hand/face conditioning in WP-0113) silently degrades on stylized inputs and the operator only finds out at ComfyUI generation time.

This WP runs the benchmark to either justify a router/cascade architecture or pick a single replacement model. The research-first methodology rule (codex 2026-05-07) is the procedural authority for it.

---

## Field research / prior art

**Pass date**: 2026-05-07
**Searched**:
- Source areas: arXiv, ACM/CVF/ECCV proceedings, GitHub (mediapipe, hysts, deepghs, papulke, asindel, IDEA-Research, kanosawa, Fuyucch1), HuggingFace (Bingsu/adetailer, deepghs, vladmandic), Civitai, OpenReview, Reddit/r/StableDiffusion (via web), ComfyUI controlnet_aux issues
- Search queries used:
  1. `mediapipe FaceMesh face landmarker stylized anime art limitations 2025`
  2. `anime face landmark detection 2025 deep learning`
  3. `hysts anime-face-detector mmdet mmpose 28 landmarks`
  4. `DWPose face landmarks anime stylized illustration ComfyUI`
  5. `InsightFace buffalo antelopev2 anime stylized portrait performance`
  6. `"AnimeCeleb" landmark dataset facial keypoints`
  7. `"StylizedFacePoint" facial landmark detection stylized characters`
  8. `dlib 68 face landmarks anime cartoon performance comparison`
  9. `"face detection" illustration painting artwork cross-domain 2025`
  10. `DECA EMOCA FLAME 3DMM anime stylized face reconstruction`
  11. `"ArtFacePoints" high resolution facial landmark paintings prints`
  12. `mediapipe github issue face_mesh fails anime cartoon non-realistic`
  13. `"Manga109" face landmark annotation eyes nose mouth keypoints`
  14. `"face of art" landmark detection portraits geometric style`
  15. `"face_yolov8n" anime face detection model comparison benchmark`
  16. `"GroundingDINO" / "SAM2" face localization stylized art pipeline`
  17. `openpose 70 face keypoints contract DWPose anime conversion`

**Findings (most relevant)**:

- **StylizedFacePoint: Facial Landmark Detection for Stylized Characters** (ACM Multimedia 2024) — https://openreview.net/forum?id=J3mF5Ea5JG / https://dl.acm.org/doi/10.1145/3664647.3680984
  - Purpose-built deep model + the FLSC dataset (2,674 images / 4,086 faces / 98 landmarks/image) labeled by professionals from 16 cartoon clips. Generalizes to out-of-domain styles. The closest direct fit for our problem; their landmark scheme can be remapped to the openpose-70 contract.

- **ArtFacePoints: High-resolution Facial Landmark Detection in Paintings and Prints** (Sindel et al., ECCV 2022 VISART workshop) — https://arxiv.org/abs/2210.09204 / https://github.com/asindel/artfacepoints
  - Two-stage (global + per-region) network specifically for painted/etched portraits, plus a synthetically style-transferred training set. Code + weights released. Strong choice for painted / semi-real corpus.

- **The Face of Art: Landmark Detection and Geometric Style in Portraits** (Yaniv, Newman, Shamir, SIGGRAPH 2019) — https://faculty.idc.ac.il/arik/site/foa/face-of-art.asp / https://github.com/papulke/face-of-art
  - Artistic-Faces dataset (160 portraits across genres). Style-augmented landmark training pipeline; older but still the canonical "art portrait landmarks" baseline that almost every later paper compares against.

- **hysts/anime-face-detector** (MMDet + MMPose, MIT, last release 2021-11) — https://github.com/hysts/anime-face-detector
  - Detector + 28-keypoint pose head. The de-facto open anime face landmarker; aging dependencies (mmcv-full / mmdet 2.x / mmpose 0.x) which is now an integration risk on modern PyTorch. 28 points is below our 70-point export contract — needs landmark-remap layer.

- **kanosawa/anime_face_landmark_detection** (deep cascaded regression, PyTorch) — https://github.com/kanosawa/anime_face_landmark_detection
  - Older lineage descendant of `lbpcascade_animeface` plus a CNN regressor. Useful as a low-bar baseline in the benchmark; not actively maintained.

- **Facial Landmark Detection for Manga Images** (Stricker, Augereau et al., 2018) + the Manga109 landmark labels — https://arxiv.org/abs/1811.03214 / https://github.com/oaugereau/FacialLandmarkManga
  - 15-point scheme (eyes×6, brows×4, nose×1, mouth×4) on 750 Manga109 faces; later work extends to 60 points including chin contour. Important because it's the only public manga-specific landmark annotation, but point scheme is sparse vs openpose-70.

- **AnimeCeleb: Large-Scale Animation CelebHeads Dataset** (Kim et al., ECCV 2022) — https://github.com/kangyeolk/AnimeCeleb / https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136680405.pdf
  - Synthetic 3D-rendered anime heads with multi-pose annotations and a landmark proxy space. Useful as training augmentation, less useful as test corpus (looks synthetic).

- **DWPose** (Yang et al., ICCV 2023) + ComfyUI-controlnet-aux integration — https://github.com/IDEA-Research/DWPose / https://github.com/Fannovel16/comfyui_controlnet_aux
  - Whole-body pose with face keypoints, distilled from RTMPose. The de-facto replacement for OpenPose preprocessor in stylized SD/SDXL workflows; outputs the openpose-70-compatible face contract directly. Trained on photographic data — anime performance is "good enough for ControlNet conditioning" but not landmark-grade.

- **Pixel3DMM: Versatile Screen-Space Priors for Single-Image 3D Face Reconstruction** (Giebenhain et al., 2025) — https://arxiv.org/abs/2505.00615 / https://simongiebenhain.github.io/pixel3dmm/
  - DINO-based per-pixel UV+normal regression then FLAME fit. +15% on photoreal face reconstruction; the surface-normal head degrades gracefully on stylized inputs in our quick test cohort but no published anime benchmark exists. Promising as a fallback that produces dense correspondences from which 70 openpose points can be sampled.

- **Stylized-Face: A Million-level Stylized Face Dataset for Face Recognition** (Peng et al., ICCV 2025) — https://openaccess.thecvf.com/content/ICCV2025/papers/Peng_Stylized-Face_A_Million-level_Stylized_Face_Dataset_for_Face_Recognition_ICCV_2025_paper.pdf
  - 80 styles across Artistic Living / Classical Art / Fantasy / ACG. ID-focused not landmark-focused, but the corpus split is the cleanest public taxonomy of stylized portraits we can borrow for our test set.

- **Bingsu/adetailer YOLO face zoo** — https://huggingface.co/Bingsu/adetailer + Fuyucch1/yolov8_animeface — https://github.com/Fuyucch1/yolov8_animeface
  - `face_yolov8n/m/s` and dedicated anime variants are the practitioner standard inside SD/ComfyUI for finding faces in stylized images. Detection only (bbox) — must be paired with a landmarker. Useful as the "find the face" front-stage of a two-stage pipeline.

- **MediaPipe issue #5386 + community signal** — https://github.com/google-ai-edge/mediapipe/issues/5386
  - Confirms FaceMesh has no documented support story for cartoon/anime. Issue closed as "support" with no fix. Mediapipe FaceMesh trains on synthetic-rendered + real-world photos — explains the failure mode WP-0108 already concedes.

- **InsightFace model zoo (buffalo_l/m/s, antelopev2)** — https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md
  - RetinaFace + ArcFace + 2d106/3d68 alignment. Documentation and community reports are explicit that training is photographic; degradation on stylized inputs is severe but graceful (it tends to no-detect rather than mis-place). Buffalo_l 2d106 is still the strongest realistic-face baseline to include for the "semi-real" slice of the corpus.

- **deepghs/imgutils** — https://github.com/deepghs/imgutils
  - Modern (active 2025) anime image utility library; provides anime face/head detection (bbox only — confirmed via fetch) but **no landmark detection**. Good for the detection front-stage, but does not solve our landmark problem.

**Detectors shortlist** (candidates for the benchmark this WP will run):

| Detector | Type | Style coverage | Output points | Cost / latency | License | Notes |
|---|---|---|---|---|---|---|
| MediaPipe FaceLandmarker (incumbent) | CNN landmarker | Photo only | 478 (3D) | ~3 ms GPU / ~15 ms CPU | Apache-2.0 | Baseline; documented to fail on stylized — the thing we're replacing |
| dlib 68 (Kazemi-Sullivan) | Regression trees | Photo, weak on cartoon | 68 | ~1 ms CPU | Boost | Legacy baseline; near-zero hit on flat-shaded anime |
| InsightFace buffalo_l 2d106 | RetinaFace + reg | Photo, semi-real | 106 | ~10 ms GPU | non-commercial research | Strongest realistic baseline; graceful no-detect on heavy stylization |
| DWPose (RTMPose-distill) face head | Heatmap | Photo, OK on anime | 68 (openpose-style) | ~20 ms GPU | Apache-2.0 | Already in ComfyUI; output is the right contract |
| hysts/anime-face-detector | MMDet+MMPose | Anime (near-frontal) | 28 | ~30 ms GPU | MIT | Aging deps; needs 28→70 remap |
| StylizedFacePoint (FLSC) | Stacked hourglass | Cartoon / stylized | 98 | TBD GPU | research; check release | Best published cartoon landmarker; need to confirm weights are public |
| ArtFacePoints | Global+region net | Painting / print | 68/98 | TBD GPU | research, code released | Best for painted / semi-real slice |
| Pixel3DMM | DINO + FLAME fit | Photo, untested anime | dense → sample 70 | ~200 ms GPU | research | Heavy; serves as gold standard / fallback for hard cases |
| YOLOv8 face_yolov8n + landmark head | Det + reg | Anime + photo (det only) | bbox only | ~5 ms GPU | AGPL/MIT mix | Front-stage only; pair with landmarker |
| GroundingDINO + face crop + landmarker | VLM zero-shot det | Any | depends | ~500 ms GPU | Apache-2.0 | Last-resort robust cropper for hard styles; expensive |

**How findings inform WP-0117**:
- **The benchmark is justified** — there is no single landmark detector that covers photo + anime + painted + illustration + semi-real cleanly. Picking by style class is unavoidable.
- **Adopt a tiered cascade rather than picking one model**: detection (face_yolov8n or hysts) → style classifier → route to `{InsightFace 2d106 | StylizedFacePoint | ArtFacePoints | DWPose}` → remap to openpose-70.
- **Test corpus to assemble** (target ~300 images, 50 per slice): photographic (FFHQ subset), semi-real (MetFaces / WikiART-Face), painted classical (Artistic-Faces, ArtFacePoints set), anime/manga (Manga109 + danbooru-derived deepghs sample), modern illustration (Civitai SDXL outputs), and a "hard" slice (low-detail / chibi / extreme stylization).
- **Metrics**: NME (normalized mean error) per-point against human-relabeled GT in the openpose-70 scheme; detection recall (face found at all); per-region NME for eyes / mouth (since those drive ID-encoder + DWPose downstream); failure-mode taxonomy (hallucinated face, drifted cluster, mirrored eyes).
- **Scope adjustment vs the original Task Board row**: the deliverable is a *router + remap layer recommendation*, not a single model swap. StylizedFacePoint + ArtFacePoints look strong enough that "drop the benchmark and just adopt X" is tempting — but neither covers all five style slices.
- **Constraint to honor**: 70-point openpose taxonomy is the export contract, so every candidate ships with a dense→70 remap function in the report. The 28-point hysts model and 15-point manga model both require synthesized intermediate points; flag this as a precision ceiling.
- **Background/stealth (per memory)**: all benchmark runs must respect `assertBackgroundSafe()` — landmark visualizations get written to disk only, never shown.

**Rejected alternatives**:
- **Train a from-scratch anime landmarker on Manga109 + AnimeCeleb** — out of WP-0117 scope (research WP, not training WP); revisit only if benchmark shows no public model is viable.
- **Single-model swap to DWPose face head** — covers ControlNet conditioning fine but loses precision on heavy stylization (chibi, painted) where StylizedFacePoint/ArtFacePoints clearly win; can't be the only path.
- **CLIP/SAM2-only face localization** — produces masks not keypoints; useful as a robust cropper but not a landmark solution. Keep as an emergency upstream stage, not a candidate.
- **dlib 68 only** — kept as a baseline row in the metrics table for documentation, but rejected as a production option for anything beyond photographic inputs.
- **InsightFace antelopev2** — superseded by buffalo_l on photoreal data per upstream docs; including buffalo_l only.

---

## Scope

### In
1. **Test corpus assembly** — ~300 images, 50 per style slice, sourced per the "Test corpus" bullet above. License-clean only; document each subset's source. Stored at `CKC_GOV/targets/research/wp-0117/corpus/` (excluded from git per repo `.gitignore`).
2. **Human-relabeled ground truth** in the openpose-70 scheme for every corpus image. Operator-supplied or labeled via a Civitai-style annotator UI; one-shot effort, not a recurring cost.
3. **Detector wrappers** — thin Python adapters (one per shortlist row) that take a PIL image and return `{ found: bool, points70: number[][], bbox: [x,y,w,h], confidence: number }`. The benchmark runs these in isolation against the corpus.
4. **Benchmark harness** — produces a CSV per detector × style slice with NME, detection recall, per-region NME, and a failure-taxonomy column. Pinned via a CI test that re-runs on the corpus on every change.
5. **Report deliverable** — `CKC_GOV/research/wp-0117_stylized_landmark_report.md` with metrics tables, failure-mode plates (per-detector × per-slice example images), and a recommendation: either (a) router + remap cascade with named per-style detectors, or (b) single-detector swap if one wins outright.
6. **Follow-up WP draft** — if (a), draft the cascade WP (likely WP-0118 or later); if (b), draft the swap WP. Either way, the implementation is OUT of WP-0117.

### Out
- All product-code changes. Pure research and report.
- Training a new model. The corpus is too small to train; that's a separate WP if research justifies it.
- Per-character LoRA / IDFlow tuning. Adjacent concern; not a landmark question.

## Acceptance criteria
- [ ] Test corpus assembled with 50 images per slice (photo / semi-real / painted / anime/manga / modern illustration / hard) and a license / source manifest.
- [ ] Human-relabeled ground truth available for every corpus image in the openpose-70 scheme.
- [ ] All shortlist detectors run end-to-end against the full corpus and produce CSV outputs.
- [ ] Report at `CKC_GOV/research/wp-0117_stylized_landmark_report.md` published with the recommendation locked.
- [ ] Follow-up WP draft committed (router or swap) before WP-0117 is marked DONE.
- [ ] All findings + plates browsable in the report; reproducible from `CKC_GOV/scripts/research/wp-0117/run_benchmark.sh`.
