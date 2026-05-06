# Work Packet: WP-0100 - Image Sourcing Workflow Spec Registry + v00.19 Ingestion Adapter + Per-Character Scripts + Cross-Batch Dedup

Date: 2026-05-06
Owner: Codex
Status: DRAFT

## Summary
Stand up the CKC side of the image-sourcing workflow as a long-running, multi-version pipeline: CKC holds the canonical store of image-sourcing workflow specs (v00.19 today, v00.20+ later), exposes them so an LLM/operator can pull the latest spec and bootstrap a new task, then ingests every accepted, pending, and rejected lane back into CKC with full provenance. Pending lane images surface through the existing intake sorter (WP-0094) for an additional LLM or operator pass; accepted lane images attach to a character sheet **and** a sheet version with content-hash-addressed filenames per the identity-decoupling rule. The adapter copies the task's `task_tools/scripts/` (v00.19-canonical location) into a per-character script store inside CKC, dedupes images and scripts across re-imports of the same character, and writes back to the v00.19 `app_sync_events.jsonl` log. The architecture is pluggable: each spec version gets its own handler module so a v00.20+ release adds a new handler without touching v00.19.

## Why
The v00.19 init spec at `CKC_GOV/references/external_app_data/image_sourcing_init_spec-idol_v00.19.json` is the operator's contract for image-sourcing tasks. Every initialized batch already declares an `adapters.castkit_codex` slot in its `app_adapter.yaml` with `enabled: false, status: "not_defined_yet"`. CKC has no code to consume that contract today; this WP is the bridge.

The operator runs many parallel batches (different characters, same workflow), with image sourcing expected to continue for several days. CKC needs to be the durable home for:
- the workflow spec itself (so future LLMs can spawn the **latest** workflow without scraping git or hunting for files),
- the per-character helper scripts that produced each batch (collectors, selectors — for reuse and diagnosis),
- the imported images with full provenance (`dataset_id`, `task_id`, `run_id`, `contact_sheet_ref`, `source_url`),
- and the dedup ledger so a second pass over the same character's batches does not re-import what is already there.

Pending images need their own pass (LLM or operator) before promotion to accepted; CKC's intake sorter from WP-0094 is the right tool, so the adapter routes pending lane images through that flow rather than treating them as final imports.

The new identity-decoupling rule in `CKC_GOV/PROJECT_CODEX.md` ("Identity decoupling" section) binds this WP: imported image filenames inside `libraryRoot` are content-hash addressed; the character's name never appears in any path, sync-event payload, or generated artifact name produced by the adapter.

## Scope
### In

#### 1. Workflow spec registry (read-only)
- Workflow specs live under `CKC_GOV/references/external_app_data/specs/<spec_id>_v<version>.json` (relocate the existing `image_sourcing_init_spec-idol_v00.19.json` into this folder, keeping the existing filename for compatibility, plus a manifest entry).
- New backend automation commands:
  - `listWorkflowSpecs()` — return every registered spec (id, version, status, file path).
  - `getWorkflowSpec({ specId, version })` — return the parsed spec content.
  - `getLatestWorkflowSpec({ specId })` — return the highest-version spec for a given id.
- Reading is fs-backed, not DB-backed, because the spec is a governance artifact owned by the operator.
- Versioning convention: filename suffix `_v<MAJOR>.<MINOR>` (e.g. `_v00.19`); the registry parses + sorts numerically.

#### 2. Multi-version ingestion adapter
- New backend automation command:
  - `ingestImageSourcingTask({ taskRootPath, characterId, sheetVersionId, lane?, dryRun?, copyScripts?, dedupReasons? })`
- Internal architecture: a `handlers/` table keyed by `spec_version` from the task's `task_state.yaml`. Each handler is a separate module under `CKC_main/app/backend/imageSourcingHandlers/`. Only `v00_19.js` ships in this WP.
- Handler responsibilities (per v00.19):
  - Read `<taskRootPath>/<task_id>.task_state.yaml` for `dataset_id`, `task_id`, `spec_version`.
  - Read `<taskRootPath>/<task_id>.task_topology.yaml` to resolve lane folder paths (per RID-TOPOLOGY-005 — never hardcode paths).
  - Read `<taskRootPath>/<task_id>.task_requirements.yaml` to capture done-criteria text and store it on the imported batch (see below).
  - Walk `intake/<lane>/`, build per-image payloads with full provenance.
  - Read `media_items.jsonl` (one of the v00.19 artifacts) to recover `source_url` per file when present; tolerate missing entries with a warning.
  - For `lane='accepted'` (default): import via existing `importImages` machinery, link to sheet version, hash-rename on disk per identity-decoupling.
  - For `lane='pending'`: import via the same machinery but set `review_status='pending'` and apply the `pending` tag, matching WP-0094 conventions so the intake sorter surfaces them.
  - For `lane='rejected'`: do NOT import as media; record an `IngestionRejection` row capturing the source URL + reason for audit purposes only. (Operator may later promote a rejected entry, but that is out of scope here.)
  - When `copyScripts: true` (default true), walk `task_tools/scripts/` (v00.19-canonical location) and copy each script through `addCharacterScript` with dedup.
  - Append one JSONL line per processed image to `<taskRootPath>/app/<task_id>.app_sync_events.jsonl` matching the v00.19 `app_sync_event_schema` shape (UUIDv7 event id, RFC 3339 UTC timestamp, lane, contact_sheet_ref, character/image refs).
  - Honor the v00.19 `run_state_lock.json` protocol: read before append, surface a clean error if held by another tool.
- `dryRun: true` returns the planned actions (per-image payloads, scripts that would be copied, sync-event lines that would be appended) without writing.
- The adapter refuses to ingest if `task_state.yaml.spec_version` is not in the handler table; surfaces a clear error so the operator knows to upgrade CKC before retrying.
- `sheetVersionId` is **required**. The adapter errors out if missing or if the supplied id does not belong to `characterId`.

#### 3. Image schema additions (nullable adds on `ImageAsset`)
- `source_dataset_id` — v00.19 `dataset_id`.
- `source_task_id` — v00.19 `task_id`.
- `source_run_id` — which run inside the task produced the image.
- `source_contact_sheet_ref` — which contact sheet selection chose the image (e.g. `raw_contact_sheet_0011#sel_005`).
- `sheet_version_id` — FK to `SheetVersion(version_id)`. Required for new adapter imports; pre-existing rows stay valid with NULL.

#### 4. New `CharacterScript` table
- `script_id` (PK), `character_id` (FK), `relative_path`, `name`, `role`, `source_task_id`, `script_bytes_hash`, `imported_at`, `notes`.
- Files copied to `libraryRoot/characters/<internal_id>/scripts/<script_id>__<sanitized_name>.<ext>` (no spaces; identity-decoupling note: internal id is opaque, not the character's name).
- Dedup: `(character_id, script_bytes_hash)` unique — the same script ingested from multiple tasks collapses to one row.
- New backend automation commands: `listCharacterScripts({ characterId })`, `getCharacterScript({ scriptId })`, `addCharacterScript({ characterId, scriptName, scriptContent, role?, sourceTaskId?, notes? })`, `removeCharacterScript({ scriptId })`.

#### 5. New `IngestionBatch` and `IngestionRejection` rows (audit + done-criteria)
- `IngestionBatch` row written per `ingestImageSourcingTask` invocation. Captures `batch_id`, `character_id`, `sheet_version_id`, `dataset_id`, `task_id`, `spec_version`, `lane`, `requirements_snapshot` (verbatim contents of the task's `task_requirements.yaml` at ingestion time, so done-criteria are preserved), `started_at`, `finished_at`, `imported_count`, `skipped_count`, `error`.
- `IngestionRejection` row written per item in the rejected lane. Captures `rejection_id`, `batch_id`, `character_id`, `source_url`, `source_path`, `rejection_reason` (free text from the v00.19 `reject_manifest`), `created_at`.
- New backend automation commands: `listIngestionBatches({ characterId? })`, `getIngestionBatch({ batchId })`, `listIngestionRejections({ characterId?, batchId? })`.

#### 6. Cross-batch dedup
- Existing `file_hash` skip path remains the default for `lane='accepted'`.
- New: same `(source_dataset_id, source_task_id, source_contact_sheet_ref)` triple already imported for this `character_id` → skip with reason `dup-selection`.
- New: same `source_url` already imported for this `character_id` → skip with reason `dup-url` (configurable via `dedupReasons` parameter; defaults to `["content-hash", "selection", "url"]`).
- Pending lane uses the same dedup; rejected lane never dedupes (rejections are append-only audit).

#### 7. Identity-decoupling enforcement
- All adapter imports use content-hash-addressed filenames inside `libraryRoot/characters/<internal_id>/images/`.
- The character's `display_name` (and any sheet field value the operator could read as a name) MUST NOT appear in: image filename, script filename, script `relative_path`, sync-event JSON payload, ingestion-batch row, ingestion-rejection row.
- Unit test `backend_identity_decoupling.test.js` pins this for both image and script paths.

#### 8. Manual reconciliation (code-truth)
- Add a new feature group `image-sourcing-ingestion` to `automationManual.js`.
- Add `commandReference` entries for every new command (12 new commands total: 3 spec-registry + 1 adapter + 4 character-script + 3 ingestion-batch + 1 listIngestionRejections).
- `automation_manual_consistency.test.js` continues to pass.

#### 9. Dependency add
- `js-yaml` added to `dependencies` in `CKC_main/package.json` for parsing the v00.19 YAML artifacts. Pin a current stable version. The static-grep test for forbidden OS-input libs continues to pass (js-yaml is not in that list).

#### 10. Spec bump + ship
- `CKC_GOV/spec/CastKit_Codex_Spec_v00.066.md`. Archive v00.065 to `spec/archive_spec/`. Document: workflow spec registry layout, multi-version dispatch, lane semantics, identity-decoupling enforcement on adapter imports.
- `npm run package:win` produces v0.2.9 installer + portable; tag pushed to trigger `release-win.yml`.

### Out
- **Modifying the v00.19 init spec itself.** The operator owns it; CKC consumes it.
- **Building the autonomous LLM workflow runner** that drives the end-to-end flow (spawn spec → start task → run sourcing → call CKC adapter). That tool lives outside CKC and is scoped to a separate WP-0102.
- **Legacy flat-folder ingestion** (e.g. `D:\Projects\Image_sourcing\karina_blonde_0500\`). Non-conforming batches get a one-shot legacy migrator in WP-0101 after the in-flight v00.19 batches have settled.
- **Identity-accuracy verification** of accepted images. The operator runs that pass before adapter import; CKC just consumes whatever already sits in `intake/accepted/`.
- **Live watch** on `intake/<lane>/` (auto-import on file appearance). Manual invocation only in this WP.
- **Spec authoring / upload from inside CKC.** The spec registry is read-only here. Adding new spec versions is operator-driven (drop a file in the registry folder, restart or call a `refreshWorkflowSpecs` later WP).
- **Pending → accepted promotion UI.** WP-0094's intake sorter already handles pending image review; this WP only ensures pending lane imports surface there with the right `review_status` + tag. A dedicated "promote pending v00.19 batch" wizard is a follow-up.
- **In-app auto-updater wiring.**

## Acceptance criteria
- [ ] Schema migration adds the five new `ImageAsset` columns and the `CharacterScript`, `IngestionBatch`, `IngestionRejection` tables without breaking existing imports. Migration is idempotent across SQLite + PostgreSQL.
- [ ] `listWorkflowSpecs`, `getWorkflowSpec`, `getLatestWorkflowSpec` return the v00.19 spec read from `CKC_GOV/references/external_app_data/specs/`. Adding a fixture v00.20 file makes `getLatestWorkflowSpec` resolve to it without code changes.
- [ ] `ingestImageSourcingTask` errors clearly when:
  - `taskRootPath` does not exist or lacks `<task_id>.task_state.yaml`,
  - `spec_version` is unknown (no handler registered),
  - `sheetVersionId` is missing or does not belong to `characterId`,
  - the v00.19 `run_state_lock.json` is held.
- [ ] Each accepted-lane import carries non-null `source_dataset_id`, `source_task_id`, `sheet_version_id`. The on-disk filename is content-hash-addressed.
- [ ] Pending-lane imports also write to `ImageAsset` but with `review_status='pending'` and the `pending` tag set (matching WP-0094 conventions). They appear in `listPendingImages`.
- [ ] Rejected-lane items write `IngestionRejection` rows only; no `ImageAsset` rows are created.
- [ ] Cross-batch dedup: re-running the same task produces zero new imports and skip reasons surface as `dup-content-hash`, `dup-selection`, `dup-url`. Configurable via `dedupReasons`.
- [ ] Each successful import appends a single JSONL line to `<taskRootPath>/app/<task_id>.app_sync_events.jsonl` matching the v00.19 `app_sync_event_schema`.
- [ ] When `copyScripts: true`, every file under `task_tools/scripts/` is copied via `addCharacterScript`, deduplicated by `(character_id, script_bytes_hash)`, surfaced in the result.
- [ ] `IngestionBatch` row contains a verbatim snapshot of `task_requirements.yaml` so done-criteria are preserved.
- [ ] All 12 new commands appear in `getAutomationCommandMap()` AND in `automationManual.js` `commandReference`. Self-consistency test passes.
- [ ] Identity-decoupling test: character with `display_name` "Aria Stark" produces zero on-disk path or sync-event payload that contains `aria` or `stark` (case-insensitive).
- [ ] `npm test` (or the targeted subset relevant to this WP) and `npx tsc --noEmit` pass.
- [ ] Spec bumped to v00.066; v00.065 archived.
- [ ] No file or folder names with spaces are introduced.
- [ ] `npm run package:win` produces a tagged Windows release; the new adapter command is exercised against the packaged installer/portable build (smoke deferred until operator-permitted).

## Test plan
- [ ] Unit: schema migration runs on a fresh DB and on an existing-data DB without errors; column count + table presence asserted.
- [ ] Unit: `listWorkflowSpecs` / `getLatestWorkflowSpec` against fixture spec files (v00.19 only, then add a v00.20 fixture and re-run).
- [ ] Unit: `ingestImageSourcingTask` happy path against a fixture task root with two accepted images, one pending, one rejected, and two scripts.
- [ ] Unit: `ingestImageSourcingTask` re-run idempotency — second invocation returns `imported: []` and matches skip reasons.
- [ ] Unit: dedup matrix — exercise `dup-content-hash`, `dup-selection`, `dup-url` independently.
- [ ] Unit: error path — unknown spec_version, missing sheetVersionId, wrong-character sheetVersionId, lock held.
- [ ] Unit: `addCharacterScript` dedup by `script_bytes_hash`.
- [ ] Unit: `app_sync_events.jsonl` line shape matches v00.19 schema (`schema_version`, `event_id`, `event_kind`, `timestamp`, `dataset_id`, `task_id`, `app`, `lane`, `media_id`, `app_object_id`).
- [ ] Unit: identity-decoupling — character "Aria Stark", import three images (one per lane), assert no name substring in any on-disk path or sync-event payload.
- [ ] Unit: pending-lane integration — pending images returned by `listPendingImages` after adapter run, with `review_status='pending'` and `pending` tag.
- [ ] Unit: manual self-consistency — every new command resolves through `classifyAutomationCommand`, every new entry has matching target/description/example.
- [ ] Smoke (manual, dev mode): point the adapter at the operator's reference task `D:\Projects\Image_sourcing\lora_avatar_test_0006\task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J\` with `dryRun: true` first; review the planned actions; then a real run against a test character + sheet version.
- [ ] Smoke (manual, packaged): same flow against the v0.2.9 installer/portable build.

## Governance checklist
- [ ] Task Board updated with this WP at status `IN_PROGRESS`, then `DONE` after validation.
- [ ] Spec bumped (`v00.065` → `v00.066`); old version archived to `spec/archive_spec/`.
- [ ] No generated file or folder names with spaces.
- [ ] Planning-checkpoint commit (WP + Task Board) pushed before any code in `CKC_main/` is changed.
- [ ] Shipping-checkpoint commit (code + Task Board + spec) pushed after implementation.
- [ ] Identity-decoupling rule (per `CKC_GOV/PROJECT_CODEX.md`) honored: imported image filenames inside `libraryRoot` are content-hash-addressed; the character's name does not appear in any path, sync-event, or generated artifact name produced by this WP.
- [ ] Code-truth rule honored: every new command is in `automationCommandMap.js` AND `automationManual.js`; the self-consistency test enforces it.
- [ ] NAS mirror backup script run after the shipping commit.

## Implementation notes
- Files expected to change / be added:
  - `CKC_main/package.json` — add `js-yaml` dependency.
  - `CKC_main/app/backend/library.js` — schema additions for `ImageAsset` columns, new `CharacterScript`, `IngestionBatch`, `IngestionRejection` tables; migration; CRUD for new tables; extended `importImages` dedup paths (or a new internal helper that wraps it for the adapter case).
  - `CKC_main/app/backend/workflowSpecRegistry.js` (new) — fs-backed list/get/getLatest over `CKC_GOV/references/external_app_data/specs/`.
  - `CKC_main/app/backend/imageSourcingAdapter.js` (new) — multi-version dispatcher: keys handlers by `spec_version`.
  - `CKC_main/app/backend/imageSourcingHandlers/v00_19.js` (new) — v00.19-specific reader for task_state/task_topology/task_requirements/media_items, lane walker, sync-event emitter.
  - `CKC_main/app/backend/automationCommandMap.js` — add new backend commands.
  - `CKC_main/app/main.js` — dispatch arms in `runBackendAutomationCommand` calling the registry, adapter, and library helpers.
  - `CKC_main/app/backend/automationManual.js` — new feature group + `commandReference` entries.
  - `CKC_main/test/` — new tests `backend_workflow_spec_registry.test.js`, `backend_image_sourcing_adapter.test.js`, `backend_image_sourcing_handler_v00_19.test.js`, `backend_character_scripts.test.js`, `backend_image_provenance_dedup.test.js`, `backend_ingestion_batches.test.js`, `backend_identity_decoupling.test.js`. Existing `automation_manual_consistency.test.js` keeps passing.
  - `CKC_GOV/references/external_app_data/specs/` (new folder) — relocate `image_sourcing_init_spec-idol_v00.19.json` here.
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.066.md` — new spec; v00.065 archived.
- Provenance read order in the v00.19 handler: `task_state.yaml` → `task_topology.yaml` → `task_requirements.yaml` → `media_items.jsonl`. Each missing file surfaces a clear error (state/topology/requirements are required; media_items can be partial with a warning).
- The adapter MUST NOT touch task artifacts other than: the lane folder it is reading, `task_tools/scripts/` it is copying, and `app/<task_id>.app_sync_events.jsonl` it is appending to. Lock acquisition follows the v00.19 `run_state_lock.json` protocol.
- Schema migration uses the existing migration helper. Nullable column adds are safe on populated PG databases.
- `libraryRoot/characters/<internal_id>/scripts/` directory is created lazily on first `addCharacterScript` for that character.
- Identity-decoupling specifics: character internal id is opaque; the rule blocks operator-name strings only. The unit test pins this for image and script paths and for sync-event JSON payloads.
- Default `lane`: `accepted`. The adapter accepts any single lane per call. Multi-lane runs in one invocation are out of scope; callers run the adapter once per lane.

## Risks / mitigations
- **Risk:** v00.19 task files use YAML and CKC currently has no YAML parser dependency. **Mitigation:** Add `js-yaml` to `dependencies`; pin a current stable version. The static-grep test for forbidden OS-input libs continues to pass.
- **Risk:** Identity leaks via filename despite the rule. **Mitigation:** explicit identity-decoupling unit test asserts no name substring in on-disk paths or sync-event payloads. The test fails CI if a future change regresses.
- **Risk:** `app_sync_events.jsonl` writes corrupt the operator's task folder. **Mitigation:** append-only line write with explicit `\n` termination; honor the v00.19 `run_state_lock.json` read before append. If lock is held, surface a clean error and do nothing.
- **Risk:** Schema migration on a populated PostgreSQL DB takes too long. **Mitigation:** new columns are nullable adds (no row rewrites); new tables are empty at create time. Both are O(table-metadata) operations.
- **Risk:** Image-sourcing tasks evolve to v00.20+ during these few days, breaking the adapter assumptions. **Mitigation:** the adapter dispatches by `spec_version`; v00.20 lands as a new handler module in a follow-up WP without touching v00.19 code. Until then, an unknown `spec_version` produces a clean error.
- **Risk:** Per-character scripts grow unboundedly. **Mitigation:** dedup by `(character_id, script_bytes_hash)`; identical bytes from another task collapse to one row. `removeCharacterScript` exists for cleanup.
- **Risk:** Operator runs the adapter against the wrong character (mis-mapping). **Mitigation:** `dryRun: true` returns the planned actions without writing; require operator review before a real run. The autonomous LLM workflow (WP-0102) will encode the mapping per task explicitly so mis-mapping is unlikely.
- **Risk:** Pending-lane imports flood the intake sorter. **Mitigation:** pending images are tagged and `review_status='pending'`, so the existing sorter filters them naturally; the operator can review per-batch via the new `IngestionBatch.batch_id` filter.
- **Risk:** Relocating `image_sourcing_init_spec-idol_v00.19.json` into `specs/` breaks operator scripts that hardcode the old path. **Mitigation:** keep a copy at the old path with a deprecation comment for one WP cycle; remove in WP-0101 or later. (Alternative: leave the original in place and add a manifest entry pointing to it. Operator preference TBD.)

## Rollback
- Revert the WP commit. Schema additions are nullable and additive; new tables are unused if no one calls the new commands. The new automation commands are additive in the command map. Existing import flow is unchanged. The relocation of the v00.19 spec file is reversible with a `git mv` back if needed.
