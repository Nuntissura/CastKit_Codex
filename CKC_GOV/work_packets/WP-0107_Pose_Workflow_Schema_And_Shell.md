# Work Packet: WP-0107 - Pose / Workflow schema + Tab shells

Date: 2026-05-06
Owner: Codex
Status: DRAFT

## Summary
First slice of folding the (now-defunct) OpenRepose project into CKC. Adds the database columns, tables, and tab shells the pose pipeline (WP-0108) and ComfyUI bridge (WP-0109) will fill. No pose math, no 3D viewport, no ComfyUI integration in this WP — only the storage layer + empty React tabs that subsequent WPs hang content from.

OpenRepose at `D:\Projects\LLM projects\OpenRepose` is preserved read-only as a historical reference; its Qt UI and Python core are not ported. The pose math, calibration logic, ComfyUI bridge, and library schema concepts are recreated from first principles in CKC's React/TS/Electron/PG stack.

## Why
The operator has consolidated to one app: CKC. OpenRepose's primary capabilities — projecting a frontal portrait onto a 3D pose vector, rotating it through yaw bins, exporting the openpose JSON+PNG, and registering ComfyUI outputs — must live in CKC because CKC is now the single image-database + character-sheet + workflow surface. Splitting that pipeline across two apps was costing more in cross-project coordination overhead than it saved in code reuse, and OpenRepose was never in production anyway.

This WP lands the empty rooms before the furniture: the schema CKC needs, the tab shells the operator needs to navigate, and the codex updates that document the absorption. Subsequent WPs fill them in.

## Scope

### In

#### 1. Schema additions (additive only, per WP-0106 invariants)
- **`ImageAsset`** — new NULL columns:
  - `pose_json TEXT` — keypoint set (mediapipe pose + face_mesh output) for images that have been pose-detected.
  - `openpose_png_path TEXT` — relative path to the rendered openpose-format PNG, when one exists.
  - `comfyui_workflow_json JSONB` — full ComfyUI workflow that produced this image, when applicable.
  - `comfyui_metadata_json JSONB` — model / sampler / seed / cfg / steps / prompts extracted at generation time.
  - `prompts_json JSONB` — operator-curated prompt list separate from generation metadata.
  - `rig_id TEXT NULL` — foreign key to a new `Rig` row when the image is part of a portrait→openpose triplet.
- **`Rig`** — new table for the portrait → openpose triplet:
  - `rig_id TEXT PRIMARY KEY`
  - `character_id TEXT NOT NULL REFERENCES Character(character_id)`
  - `portrait_image_id TEXT NOT NULL REFERENCES ImageAsset(image_id)` — the source frontal portrait
  - `pose_json TEXT NOT NULL` — canonical pose keypoints (mediapipe + face_mesh, normalized)
  - `calibration_json TEXT` — per-marker visibility overrides + 3D position adjustments
  - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
  - `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- **`Prompt`** — new table for reusable prompt fragments:
  - `prompt_id TEXT PRIMARY KEY`
  - `character_id TEXT NULL REFERENCES Character(character_id)` — NULL = library-wide prompt
  - `kind TEXT NOT NULL` — `positive` / `negative` / `style` / `loras` / etc.
  - `text TEXT NOT NULL`
  - `tags_json TEXT NOT NULL DEFAULT '[]'`
  - `created_at`, `updated_at`
- **`StoryBeat`** — new table for prompt sequencing (concept inherited from OpenRepose; light footprint):
  - `beat_id TEXT PRIMARY KEY`
  - `character_id TEXT NULL REFERENCES Character(character_id)`
  - `title TEXT NOT NULL`
  - `body TEXT`
  - `prompt_ids_json TEXT NOT NULL DEFAULT '[]'` — references into `Prompt`
  - `order_index INTEGER NOT NULL DEFAULT 0`
  - `created_at`, `updated_at`
- **`RigTag`** — many-to-many between `Rig` and `Tag` (mirrors `CharacterTag`):
  - `rig_id TEXT NOT NULL REFERENCES Rig(rig_id)`
  - `tag_id TEXT NOT NULL REFERENCES Tag(tag_id)`
  - `PRIMARY KEY (rig_id, tag_id)`
- Indexes: `(character_id)` on Rig / Prompt / StoryBeat; `(rig_id)` on RigTag; `(character_id, kind)` on Prompt.

All migrations land in `app/backend/db.js` `ensureSchemaUpgrades` and are no-ops on already-current DBs. Postgres + SQLite both supported per the existing dual-provider pattern.

#### 2. Backend stubs (return empty / not-yet-implemented)
New IPC commands routed through `app/main.js` + the automation command map:
- `listRigs({ characterId? })` — returns rows from `Rig` joined with `ImageAsset` and `RigTag`.
- `getRig({ rigId })`.
- `createRig({ characterId, portraitImageId, poseJson })` — implementation stub returns an error "not yet implemented; see WP-0108".
- `updateRigCalibration({ rigId, calibrationJson })` — same.
- `listPrompts({ characterId?, kind? })` — basic SELECT.
- `upsertPrompt({ ... })` / `deletePrompt({ promptId })` — full CRUD (these are simple, ship them now).
- `listStoryBeats({ characterId? })` / `upsertStoryBeat` / `deleteStoryBeat` — full CRUD.
- `registerComfyUIOutput({ ... })` — stub; full impl in WP-0109.
The command map and the in-app manual list every entry. Self-consistency test still passes.

#### 3. React tab shells
New top-level tabs in CKC's main UI (left of the existing tabs or in the right-pane mode switcher):
- **Pose** — empty placeholder with a "Coming in WP-0108" banner. Nested left-rail panels reserved: `Calibration`, `Markers`, `Reframer`, `3D viewport`, `2D openpose`.
- **Workflow** — empty placeholder with "Coming in WP-0109". Reserved panels: `Recent runs`, `Replay`, `Workflow library`.
- **Prompts** — wired-and-functional now (since CRUD is shipping). Lists `Prompt` rows with filter by character / kind / tag. Add / edit / delete.
- **Story beats** — wired now. Same pattern.

The Pose / Workflow tabs render an explicit "WP-XXXX" banner so it's obvious to the operator that work is pending; not a vaporware-trap.

#### 4. Codex updates
- New section in `PROJECT_CODEX.md` — **"OpenRepose absorption"**:
  - Rule: OpenRepose at `D:\Projects\LLM projects\OpenRepose` is defunct; CKC is now the canonical home for pose / openpose / ComfyUI workflow features.
  - Rule: the OpenRepose repo is preserved read-only for historical reference; do not modify, do not push, do not import as a dependency.
  - Rule: any pose / openpose / ComfyUI feature suggestions that reference "see how OpenRepose did it" must include the file path + line citation; the WP that lands the feature must justify the design choice from first principles in CKC's stack, not "because that's how OpenRepose did it".
- Codex's "Image-sourcing init_task + spec_init are CKC-governed canon" rule from earlier today already binds: pose artifacts referenced by the image-sourcing spec must round-trip through CKC.

#### 5. Test suite
- New section `M — Pose / Workflow / Prompts` in `CKC_GOV/test_suites/CKC_TEST_SUITE.md`. Initial check rows for the schema, the Prompts CRUD, the Story beats CRUD, and the empty Pose / Workflow tab placeholders.

#### 6. Tests
- `test/schema_pose_workflow_additions.test.js` — runs `ensureSchemaUpgrades` against a fresh DB and asserts the new columns + tables + indexes exist with the declared shapes. Runs against both SQLite and (when `CKC_TEST_POSTGRES_URL` is set) Postgres.
- `test/backend_prompts_crud.test.js` — full Prompt lifecycle.
- `test/backend_story_beats_crud.test.js` — full StoryBeat lifecycle.
- `test/backend_rigs_skeleton.test.js` — verifies `listRigs` returns `[]` on an empty DB and that `createRig` returns the stub error.
- All existing tests still pass.

#### 7. Spec bump v00.068 → v00.069 (assuming WP-0105 hasn't shipped yet; otherwise → next available). Documents the schema additions + the OpenRepose absorption.

#### 8. Manual MANUAL_VERSION bumped. New feature-group entries for `pose-workflow` and `prompts-and-beats` with the wired commands listed and the unwired ones in `roadmap` per the code-truth rule.

#### 9. Ship as packaged build per ship-as-packaged memory. v0.2.11.

### Out
- Pose detection (mediapipe-WASM, Three.js, canvas-based 2D viewport) — that's all WP-0108.
- ComfyUI bridge + actual `registerComfyUIOutput` impl + workflow replay — WP-0109.
- Migrating any data from OpenRepose (none exists; explicitly skipped).
- Touching OpenRepose's repo. It is read-only henceforth.
- Multi-yaw rendering pipeline / batch export — slot for a future WP.
- LoRA-training-pair extraction — slot for a future WP, possibly aligns with Handshake's pillar 20.

## Acceptance criteria
- [ ] `ensureSchemaUpgrades` adds the 6 new columns on `ImageAsset` and creates `Rig`, `Prompt`, `StoryBeat`, `RigTag` tables on both providers; idempotent.
- [ ] `Prompt` CRUD works end-to-end through the UI; saved values round-trip in PG and SQLite.
- [ ] `StoryBeat` CRUD works end-to-end with the same guarantees.
- [ ] `Rig` skeleton commands (`listRigs`, `getRig`) return correct empty results; mutating commands return the stub error pointing at WP-0108.
- [ ] Pose and Workflow tabs render with their "Coming in WP-XXXX" banners; tab-switch latency < 50 ms; no console errors.
- [ ] PROJECT_CODEX.md has the OpenRepose absorption section.
- [ ] Test suite Section M added with check rows for every shipped surface.
- [ ] All tests pass — new + existing.
- [ ] Spec bumped, old archived, manual MANUAL_VERSION bumped, self-consistency test passes.
- [ ] `npm run package:win` produces v0.2.11; smoke against the packaged build.

## Test plan
- **Unit (DB)**: schema migration on a fresh and a stale DB; verify additive-only.
- **Unit (CRUD)**: Prompt + StoryBeat lifecycles.
- **Smoke (manual, dev)**: open CKC, create 2-3 prompts on Aeri, verify they persist after reload; verify Pose + Workflow tabs render the banner.
- **Smoke (manual, packaged)**: same against v0.2.11 NSIS install.

## Governance checklist
- [ ] Task Board: WP-0107 row → IN_PROGRESS, then DONE.
- [ ] Spec bump + archive.
- [ ] No file/folder/artifact names with spaces.
- [ ] Planning-checkpoint commit pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit (hard requirement).
- [ ] Test suite Section M added.
- [ ] Live verification via CDP — captures of Pose tab placeholder, Workflow tab placeholder, Prompts CRUD.
- [ ] NAS mirror backup script run after shipping commit.

## Implementation notes
- Keep schema migrations idempotent + compatible with the WP-0106 additive-only rule.
- `Rig.calibration_json` shape is operator-defined in WP-0108; for WP-0107 it is just an opaque TEXT.
- `Prompt.kind` is a free string today — formal enum is a follow-up.
- Tab placement: add Pose + Workflow + Prompts + Story-beats as new entries in the existing tab list. The book metaphor (images left, sheet right) stays intact for the Library tab; the new tabs are full-width single-pane.
- Self-consistency test must list the new commands in the manual; the unwired ones go in `roadmap` for now.

## Risks / mitigations
- **Risk**: OpenRepose repo stays accessible to other assistants and they keep working in it. **Mitigation**: codex rule + a `CKC_README_FOR_ABSORPTION.md` top-level marker added to the OpenRepose repo (separate single-line commit, only one allowed) saying "absorbed into CKC; see CKC repo for active development".
- **Risk**: Prompt + StoryBeat tables drift from a future spec_init pose-pipeline contract. **Mitigation**: WP-0108 is the next WP; these tables are reviewed as part of that WP's design.
- **Risk**: empty tab placeholders shipping to a release create the impression of vaporware. **Mitigation**: explicit "Coming in WP-XXXX" banner with the WP id linked to the work_packet file.
