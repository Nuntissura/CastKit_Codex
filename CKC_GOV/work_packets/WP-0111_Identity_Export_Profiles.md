# Work Packet: WP-0111 - Identity export profiles (face-swap / IPAdapter)

Date: 2026-05-07
Owner: Codex
Status: PLANNED (depends on WP-0108 stable build)

## Summary
Add a new artifact: an "identity profile" bundle per character that captures the locked face/body identity in a form ComfyUI face-swap and IPAdapter workflows consume. Bundle contents: cropped face PNG (canonical pose), face landmark JSON, feature measurements (eye distance, jaw width, nose-to-chin ratio), pose metadata. Stored under each character's folder; queryable from the character sheet; replayable via the Workflow tab as an IPAdapter input.

Carry-over citation: derived from OpenRepose `WP-I1-009` (planned, not implemented; design intent only).

---

## Why
Character consistency across many ComfyUI generations is the single biggest LoRA-training-prep pain point. An "identity profile" bundle gives the operator a stable, named reference that ComfyUI workflows can attach to as an IPAdapter or face-swap source — independent of pose, lighting, or output size. Without this, every replay-style run has to operator-pick a portrait reference manually; with it, the bundle attaches automatically via a CKC-bridge node input.

## Field research / prior art

**Pass date**: 2026-05-07
**Searched**:
- arXiv (cs.CV, last 18 months): identity-preserving diffusion, face-conditional, multi-reference
- GitHub: tencent-ailab/IP-Adapter, instantX-research/InstantID, ToTheBeginning/PuLID, cubiq/ComfyUI_IPAdapter_plus, cubiq/ComfyUI_InstantID, cubiq/PuLID_ComfyUI, balazik/ComfyUI-PuLID-Flux, Gourieff/ComfyUI-ReActor, deepinsight/insightface
- HuggingFace model cards: h94/IP-Adapter-FaceID, InstantX/InstantID, immich-app/antelopev2
- Civitai workflow tags: IPAdapter, InstantID, FaceID, PuLID-Flux
- Reddit r/StableDiffusion, r/comfyui pulse threads (2025-2026)
- Practitioner write-ups: MyAIForce, Apatero, RunComfy, Stable Diffusion Art

Queries used: "PuLID v2 ComfyUI identity preservation 2025", "InstantID face embedding input format ComfyUI", "IP-Adapter FaceID Plus v2 InsightFace antelopev2 preprocessing", "consistent character ComfyUI workflow 2025", "FFHQ alignment 5 landmarks arcface 112", "ConsistentID multimodal facial prompts arxiv", "InsightFace antelopev2 buffalo_l ArcFace 512 embedding", "PuLID Flux EVA-CLIP InsightFace antelopev2", "ReActor InsightFace inswapper 128 ComfyUI", "identity preserving diffusion 2025 multi-reference"

**Findings (most relevant)**:

- **InstantID: Zero-shot Identity-Preserving Generation in Seconds** (arXiv 2401.07519, instantX, 2024-01) — https://arxiv.org/abs/2401.07519
  - Canonical "ID + spatial" recipe: an `antelopev2` ArcFace 512-D embedding plus a **5-keypoint** landmark image (2 eyes, 1 nose, 2 mouth corners) consumed as an `IdentityNet` ControlNet. Trains on un-cropped originals. Defines the bundle shape most ComfyUI custom nodes adopt.

- **PuLID: Pure and Lightning ID Customization via Contrastive Alignment** (arXiv 2404.16022, ByteDance, NeurIPS 2024) — https://arxiv.org/abs/2404.16022
  - Tuning-free; combines an InsightFace antelopev2 512-D ID embedding with an **EVA02-CLIP-L-14-336** image embedding of the *aligned* face. Contrastive alignment loss minimizes "model pollution" — the leading 2026 default for Flux/Chroma/Flux.2. PuLID-Flux II is the active mainline.

- **ConsistentID: Portrait Generation with Multimodal Fine-Grained Identity Preserving** (arXiv 2404.16771, 2024-04) — https://arxiv.org/abs/2404.16771
  - Uses LLaVA-1.5 to generate per-region descriptions ("face, ears, eyes, nose, mouth") plus a face-attention-localized ID network. Demonstrates value of *region-tagged* metadata alongside raw embeddings.

- **IP-Adapter-FaceID model card** (HuggingFace, h94, updated through 2024-2025) — https://huggingface.co/h94/IP-Adapter-FaceID
  - Authoritative spec: base FaceID consumes only the 512-D ArcFace embedding (`buffalo_l`, det_size 640×640). **FaceID-Plus v2** additionally consumes a `face_align.norm_crop(image, landmark=faces[0].kps, image_size=224)` — i.e. a 224×224 ArcFace-template crop driven by the 5 InsightFace kps, plus a CLIP image embedding from that crop. This is the canonical preprocessing call.

- **cubiq/ComfyUI_InstantID** (GitHub) — https://github.com/cubiq/ComfyUI_InstantID
  - The reference ComfyUI bridge. Hard requires `antelopev2` (NOT buffalo_l). Exposes a separate `image_kps` input so the *pose* landmark image can be detached from the *identity* reference image — i.e. workflows already expect ID and pose-at-capture as separate bundle members.

- **cubiq/ComfyUI_IPAdapter_plus** (GitHub) — https://github.com/cubiq/ComfyUI_IPAdapter_plus
  - The most-installed IPAdapter node pack on Civitai. Live FaceID variants in 2025-2026: `ip-adapter-faceid-plusv2_sd15/sdxl`, `ip-adapter-faceid-portrait-v11_*`. Older v1 deprecated. All require `insightface` runtime; embedding extraction happens in-node from a passed PIL image.

- **Gourieff/ComfyUI-ReActor + InsightFace inswapper_128** (GitHub) — https://github.com/Gourieff/ComfyUI-ReActor
  - The dominant SFW face-swap path. Uses `buffalo_l` for detection + `inswapper_128.onnx` (resizes face to 128² internally — known detail-loss ceiling). Optional GPEN-BFR-512 face restoration. Operates source-face → target-face index; no embedding export.

- **Reference-Guided Identity Preserving Face Restoration (RefLDM)** (arXiv 2505.21905, 2025-05) — https://arxiv.org/pdf/2505.21905
  - Multi-reference paper introducing "Composite Context" — multiple complementary face representations stacked (high-level ArcFace + low-level pixel features) plus CacheKV. Validates that a **bundle of representations** outperforms a single embedding for ID fidelity, especially at angles.

**How findings inform WP-0111**:

- **Default bundle shape** (per character profile, content-hash-addressed): `{ aligned_crop_512.png, aligned_crop_224.png, arcface_template_crop_112.png, kps5.json (5pt InsightFace landmarks), face_mesh_70.json (existing CKC), arcface_embedding_antelopev2_512.bin, arcface_embedding_buffalo_l_512.bin, eva_clip_l_336_embedding.bin (optional), pose_at_capture.json, source_image_hash, profile_manifest.json }`. Single bundle satisfies InstantID, PuLID/PuLID-Flux, FaceID v1, FaceID-Plus v2, and ReActor inputs simultaneously. **Supersedes the lighter "cropped face PNG + landmarks + 6 measurements" sketch in the original draft above.**

- **Ship two ArcFace embeddings**, not one: `antelopev2` (InstantID, PuLID) and `buffalo_l` (IP-Adapter-FaceID family, ReActor). Not interchangeable; cost of caching both is ~4 KB.

- **Use ArcFace 5-point similarity-transform alignment** (the InsightFace `face_align.norm_crop` template) as the canonical alignment for the 112² and 224² crops. CKC's existing 70-point face_mesh is a *superset* — derive the 5 kps (left eye center, right eye center, nose tip, left mouth corner, right mouth corner) from face_mesh and persist explicitly in `kps5.json` so we never re-detect.

- **Crop dimensions to ship**: 112² (ArcFace recognition / embedding source), 224² (FaceID-Plus v2 + CLIP-L-224 path), 336² (PuLID EVA02-CLIP-L-14-336 path), 512² (FFHQ-style padded crop for face restoration / GPEN / Flux face-swap inpainting). All four derive from one similarity transform — store the transform matrix, generate on demand if disk pressure matters.

- **Detect at det_size 640×640** with progressive fallback (PuLID convention) and **fail the bundle** if no face is detected — silent fallback masks bad input characters at workflow time.

- **Pose-at-capture goes in the bundle, not the ID block.** InstantID's `image_kps` separation is the load-bearing pattern: the *identity* reference and the *pose target* are different inputs in 90% of practitioner workflows. CKC's pose pipeline output should land in `pose_at_capture.json` alongside, not fused into, the ID embedding.

- **Expose the bundle to the WP-0109 ComfyUI bridge** as a single intake payload (zip or JSON-with-base64-blobs); the custom node should split it into the per-encoder sockets InstantID / IPAdapter / PuLID nodes already expect. Avoids forcing every workflow author to know which fields each adapter wants.

- **Honesty caveat**: PuLID-Flux2 (Flux.2 backbone) and various 2026 follow-ons are extremely active; specific per-node input contracts may have shifted post-2026-01. Re-validate the EVA-CLIP variant and antelopev2 vs newer InsightFace packs before locking the manifest schema.

**Rejected alternatives**:

- **Single 512-D embedding only** (FaceID v1 style) — rejected: insufficient for FaceID-Plus v2, PuLID, or any 2025-2026 SOTA. Embedding-only is a 2023-era contract.

- **DreamBooth / per-character LoRA training as primary path** — rejected: minutes-to-hours per character, storage-heavy; orthogonal to a portable identity bundle. Practitioner consensus treats LoRA as an *optional* low-strength addition on top of PuLID/IPAdapter, not a replacement. CKC can support exporting a LoRA-training set later from the same bundle.

- **inswapper_128 as the canonical ID asset** — rejected: 128² internal resize hard-caps detail; model is unmaintained / license-encumbered, produces a *swap* not a reusable identity. Keep ReActor as a downstream consumer, not the bundle's reference shape.

- **Storing only the source image and re-running detection per workflow** — rejected: non-deterministic across InsightFace version bumps, and forces every consumer to install `insightface`. Pre-extracting pinned-model embeddings + crops is the whole point of a profile.

---

## Pre-flight read list

| File | Lines | Why |
|---|---|---|
| `CKC_main/app/backend/library.js` | importImages (~5604) | Content-hash-addressed file write pattern. |
| `CKC_main/app/backend/library.js` | search `getCharacterPaths` | Per-character folder layout — extras/, scripts/, packs/. New `identity_profiles/` subfolder. |
| `CKC_GOV/work_packets/WP-0107_Pose_Workflow_Schema_And_Shell.md` | full | Schema foundation. New `IdentityProfile` table mirrors `Rig` shape. |
| `CKC_main/src/pose/rig.ts` | full (after WP-0108 ships) | Source of face landmarks for the bundle. |

External: OpenRepose `D:\Projects\LLM projects\OpenRepose\` (search for "identity_profile" or "face_lock") for design intent — do not import.

## Bundle shape (lock this)

```ts
type IdentityProfile = {
  schemaVersion: 1;
  profileId: string;          // 'idp_<random>'
  characterId: string;
  name: string;               // operator-supplied, e.g. 'aeri_face_v1'
  description?: string;
  sourceImageId: string;      // the portrait this profile was derived from
  sourceRigId?: string;       // optional rig the operator was working with at capture
  croppedFaceImageId: string; // a NEW ImageAsset row pointing at the cropped, normalized face PNG
  faceLandmarksJson: string;  // mediapipe face_mesh output trimmed to 70 openpose face points
  featureMeasurements: {
    interocularPx: number;
    jawWidthPx: number;
    noseToChinPx: number;
    eyeToBrowLeftPx: number;
    eyeToBrowRightPx: number;
    cheekboneWidthPx: number;
  };
  poseMetadata: {
    yawDegAtCapture: number;
    pitchDegAtCapture: number;
    rollDegAtCapture: number;
    visibilityAvg: number;
  };
  createdAt: string;
  updatedAt: string;
};
```

Stored on disk as `<libraryRoot>/characters/<characterId>/identity_profiles/<profileId>.json` plus the cropped face PNG via the standard ImageAsset content-hash path.

## Scope

### In
1. New schema: `IdentityProfile` table mirroring the field set above (TEXT columns; `face_landmarks_json` and `feature_measurements_json` as JSON strings). Indexes on `character_id` and `source_image_id`.
2. New backend methods:
   - `createIdentityProfile({ characterId, sourceImageId, name, description, sourceRigId? }) → { ok, profileId }` — uses the most recent rig for the source image to read landmarks; auto-crops + normalizes the face to 512×512; writes the cropped PNG into the character's `images/identity/` folder content-hash-addressed; computes feature measurements; INSERTs the row.
   - `listIdentityProfiles({ characterId? })`
   - `getIdentityProfile({ profileId })`
   - `updateIdentityProfile({ profileId, name?, description? })` — metadata only; never edits the locked landmarks.
   - `deleteIdentityProfile({ profileId })` — soft-delete (sets `deleted_at`); cropped face PNG stays on disk.
3. UI: new tab inside the Pose tab's left rail — **Identity** — lists profiles for the active character, shows the cropped face thumbnail, "Create new" button. Click a profile → opens detail with feature measurements + a "Use as IPAdapter source" button that wires it to the Workflow tab's Replay panel.
4. Workflow tab integration: Replay panel gains an "Identity profile" dropdown alongside the existing rig dropdown. Selected profile's cropped face becomes the IPAdapter input override on replay (injected into ComfyUI bridge node inputs).
5. Tests:
   - `test/identity_profile_crud.test.js`
   - `test/identity_profile_face_crop.test.js` — crop pipeline produces a deterministic 512×512 PNG given the same source + landmarks.
   - `test/identity_profile_replay_injection.test.js` — Replay payload carries the profile reference.
6. Spec bump, manual bump, test suite Section N (new).
7. Ship as packaged build.

### Out
- Generated identity (CKC creates the profile from a synthetic source). Profiles are derived from operator-supplied portraits.
- Multi-face profiles per character (one profile = one face).
- LoRA training pair generation. The profiles are inputs to ComfyUI; LoRA training is a separate pillar (Handshake #20).

## Acceptance criteria
- [ ] `createIdentityProfile` produces a valid bundle from any rigged portrait; cropped face PNG is 512×512, content-hash addressed under `images/identity/`.
- [ ] Feature measurements computed deterministically; same input → same output.
- [ ] UI lists profiles per character; thumbnails render; create/delete works end-to-end.
- [ ] Replay panel accepts a profile + injects it into the ComfyUI workflow as an IPAdapter source via the bridge node.
- [ ] All tests pass.
- [ ] Spec, manual, test suite bumped.
- [ ] Packaged build smoke verifies a full pose → identity → replay → ComfyUI generation cycle.
