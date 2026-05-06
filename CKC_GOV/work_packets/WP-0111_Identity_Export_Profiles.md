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
