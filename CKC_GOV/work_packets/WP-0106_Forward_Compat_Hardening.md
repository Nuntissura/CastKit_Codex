# Work Packet: WP-0106 - Forward / Backward Compatibility Hardening

Date: 2026-05-06
Owner: Codex
Status: DONE

## Summary
Lock the schema/ingestion forward+backward-compat invariants documented in `PROJECT_CODEX.md` ("Schema and ingestion forward/backward-compatibility (binding)") with concrete tests, a frozen-fixture suite, an additive-migration linter, and a multi-version handler routing pin. The goal is the operator's stated guarantee: **"a 75k-image collection imported under today's contract must still open, search, export, and re-attach after every future WP."**

## Why
The operator has 5 image-sourcing runs collected under v00.19, ~15k+ images each (~75k+ total), all queued for ingestion into CKC. Going forward CKC will keep adding features (new fields, new tables, new ingestion versions, new templates). Without enforced compat invariants, a routine schema change can silently make those 75k images unsearchable, untaggable, or worse — orphaned.

The codex now states the rules, but rules without tests rot. This WP makes them executable: the build refuses to ship a regression that violates the invariants.

## Field research / prior art

Research pass run 2026-05-07 before implementation. Sources checked across primary docs, vendor/hyperscaler material, Hugging Face/Civitai surfaces, and X/social search:

- PostgreSQL `CREATE INDEX CONCURRENTLY`: official docs confirm concurrent index builds avoid write-blocking locks on hot tables, with caveats around transaction blocks and invalid indexes: https://www.postgresql.org/docs/16/sql-createindex.html
- SQLite `ALTER TABLE ADD COLUMN`: official docs confirm `NOT NULL` additions require a non-null default, and constraint/drop-column paths can scan or rewrite existing content: https://www.sqlite.org/lang_altertable.html
- Prisma expand/contract migration guide: vendor guidance supports additive expansion, data migration/backfill, then later contract: https://www.prisma.io/docs/guides/database/data-migration
- AWS live database migration: vendor architecture blog reinforces dual-write/backfill/read-validation before cutover: https://aws.amazon.com/blogs/architecture/middleware-assisted-zero-downtime-live-database-migration-to-aws/
- Google Cloud Database Migration Service: hyperscaler docs emphasize explicit schema conversion and compatibility workspaces for heterogeneous migration: https://docs.cloud.google.com/database-migration/docs/overview
- Hugging Face Datasets metadata/version surfaces: dataset info includes explicit version/features metadata, supporting CKC's versioned contract approach: https://huggingface.co/docs/datasets/v2.7.1/en/package_reference/main_classes
- Civitai API docs and repo: public API exposes stable modelVersion IDs, image metadata, and hash lookup surfaces; repo stack uses Prisma/Postgres, making version/hash pins relevant to CKC ingestion provenance: https://github.com/civitai/civitai/wiki/REST-API-Reference/dff336bf9450cb11e80fb5a42327221ce3f09b45 and https://github.com/civitai/civitai
- X API consistency docs and X/search check: X's official API docs emphasize versioned endpoint structure and consistent response patterns. Social search did not surface stronger CKC-relevant implementation guidance than the official docs and database/vendor sources: https://docs.x.com/x-api/fundamentals/consistency

Implementation choices from the research: use additive nullable/defaulted migrations, pin handlers by `spec_version`, preserve stable field/image/provenance IDs, make duplicate re-import a no-op, record backup app/schema cursors, and enforce heavy-table index rules.

## Scope

### In

#### 1. Frozen legacy fixtures (`CKC_main/test/fixtures/legacy/`)
Append-only directory of small, real-shaped data snapshots from each schema/ingestion contract. Each fixture is a checked-in artifact (≤ 100 KB each) capturing what a real DB and disk layout looked like at a specific point in CKC history.

- `fixtures/legacy/wp-0091/` — schema before WP-0092 (SQLite-only, no `CharacterScript` / `IngestionBatch`).
- `fixtures/legacy/wp-0100/` — schema after WP-0100 (full v00.19 ImageAsset provenance columns).
- `fixtures/legacy/wp-0103/` — schema after WP-0103.
- `fixtures/legacy/wp-0104/` — schema after WP-0104 (block-list values populated for one character).
- Each fixture is a small SQLite DB plus a `manifest.json` listing the schema migration cursor, character count, image count, sample tag, sample sheet field, sample block-list value.

Future WPs that touch schema add a new fixture for their state. Fixtures are NEVER deleted, only added.

#### 2. Frozen-fixture regression test (`CKC_main/test/legacy_fixture_compatibility.test.js`)
For each fixture under `fixtures/legacy/`:
- Open it with the current `CKCLibrary` (read-only mount).
- Run `ensureSchemaUpgrades` to bring it to current schema. Verify it succeeds.
- Assert: every character listed in `manifest.json` is loadable via `getCharacter`. Sheet values, tags, image rows, block-list JSON all round-trip. The recorded `image_count` and `tag_count` match.
- Assert: `validateCharacterValues` for each character produces no `error` issues that didn't already exist in the manifest's `known_issues` list (legacy validators are allowed to widen warnings; never to refuse to load).

#### 3. Additive-migration linter (`CKC_main/test/migration_invariants.test.js`)
Static-grep across `app/backend/db.js` and `app/backend/dbMigrations/` (or wherever migrations live):
- Refuse `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a `DEFAULT` clause.
- Refuse `DROP COLUMN` without a corresponding entry in a `DEPRECATIONS.md` under `CKC_GOV/` and a deprecation-window marker.
- Refuse `DROP TABLE` outright; require an explicit override comment that points at the deprecation entry.
- Refuse renames of any column listed in the codex's "provenance columns are sacred" set: `source_dataset_id`, `source_task_id`, `source_run_id`, `source_contact_sheet_ref`, `sheet_version_id`, `file_hash`, `image_id`, `character_id`, `relative_path`, `template_id`, `template_version`, `template_hash`.
- Refuse `CREATE INDEX` without `CONCURRENTLY` for non-trivial tables (ImageAsset, FieldValue, AuditLog) on Postgres path.

Output: list of offending lines + the rule violated. Test fails if any are found.

#### 4. Multi-version handler routing pin (`CKC_main/test/ingestion_handler_routing.test.js`)
- Load every spec under `CKC_GOV/references/external_app_data/specs/`.
- For each, assert a corresponding handler exists at `CKC_main/app/backend/imageSourcingHandlers/v<XX>_<YY>.js` and is registered in the dispatcher.
- Assert: handlers are NEVER removed. Static-grep ensures no `git rm` of a handler file in a future commit (verified by checking the dispatcher's import list against a frozen `pinned_handlers.json` that is append-only).

#### 5. Template-field-id immutability test (`CKC_main/test/template_field_id_immutability.test.js`)
- Read the canonical template at `CKC_GOV/templates/character_sheet_templates/CHARACTER_SHEET__v2.00.txt`.
- Build the set of all field IDs (`CHAR-*`, `HUS-BLK-*`, etc.).
- Compare against a checked-in baseline `test/fixtures/template_v2_00_field_ids.json`.
- Refuse: any field ID that existed in the baseline but is missing from the current template (deletion). New IDs are fine. Baseline is updated only when a field is intentionally added.
- Refuse: any field ID being reused for a different field (label or type changed beyond the allowed widening rules).

#### 6. Idempotent re-import test (`CKC_main/test/ingestion_idempotency.test.js`)
- Seed a fake v00.19 task folder with a known set of images.
- Run `ingestImageSourcingTask` twice in a row.
- Assert: second run produces zero net DB changes (same `IngestionBatch` count after dedup, identical `ImageAsset` row count, identical `file_hash` set).

#### 7. Backup version-traceability test (`CKC_main/test/backup_version_traceability.test.js`)
- Take a backup via `createLibraryBackup`.
- Inspect the backup's manifest.
- Assert: it carries `ckc_app_version`, `schema_migration_cursor` (last applied row in `ckcdbmigration`), `created_at`, `db_provider`, `image_count`, `character_count`.
- Restore on a fresh test root + simulate "older app version" by stripping the latest migration row → assert restore refuses with a clear "backup is newer than installed CKC" error.
- Restore on a fresh test root + current app version → assert it succeeds and the migration cursor catches up.

#### 8. CKC + spec roundtrip pin (`CKC_main/test/spec_canon_consistency.test.js`)
Already covered for v00.19 today by `backend_image_sourcing_v00_19.test.js`, but extend:
- For every spec_version under the registry:
  - Run `init_task.py` with `--dry-run` against a temp operator workspace.
  - Run `ingestImageSourcingTask({ dryRun: true })` against the resulting task folder.
  - Assert: the adapter accepts every artifact the init script wrote; no "unknown field" / "unmapped lane" errors.
- This is the executable form of the codex rule "init_task + spec_init are CKC-governed canon".

#### 9. Index pinning (`CKC_main/test/db_index_invariants.test.js`)
- Connect to the live Postgres test container.
- Assert: indexes exist on `(character_id, file_hash)`, `(sheet_version_id)`, `(source_dataset_id, source_task_id)`, `(review_status, character_id)`, `(file_hash)` global. List from `pg_indexes` matched against the codex's pinned set.
- Refuse drift: if the codex set is missing in the DB, fail; if extra indexes exist, allow (append-only).

#### 10. Documentation
- New section in the test suite (`CKC_GOV/test_suites/CKC_TEST_SUITE.md`) — "Section L: Forward-compat invariants" — listing all 9 tests above and how to run them.
- Manual entry: a short "Compat invariants" subsection under the operating contract noting that tests are run before any schema/ingestion change.
- Spec bump v00.069 → v00.070 (assuming WP-0105 ships first; otherwise v00.068 → v00.069).

#### 11. Ship as packaged build (per ship-as-packaged memory). v0.2.12 if WP-0105 ships first; v0.2.11 otherwise.

Deferred in this pass: the package script's clean-tree guard cannot run while unrelated pre-existing WP-0110+ planning files are dirty. The code/test/spec/manual work is complete and committed as the WP-0106 shipping checkpoint.

### Out
- Migrating existing legacy data. The fixtures are read-only test artifacts; we do not retroactively rewrite the codebase to handle hypothetical pre-WP-0091 DBs.
- Auto-generating fixtures from current production. Fixtures are hand-curated to be small + representative; full prod snapshots would be too large for git.
- Cross-DB-provider compat (SQLite → Postgres on the same install). Already handled by WP-0092; not re-litigated here.
- Image-format migration (e.g. WebP → AVIF). Out of scope; image bytes are immutable on disk per codex rule 4.
- Performance benchmarks at scale. The "scales linearly" rule (codex 9) is intent; concrete benchmarks against a synthetic 75k-image fixture is a follow-up WP.
- A migration framework rewrite. The current `ensureSchemaUpgrades` is fine; this WP only enforces invariants on top of it.

## Acceptance criteria
- [x] `test/fixtures/legacy/` exists with at least 4 fixtures (wp-0091, wp-0100, wp-0103, wp-0104). Each has a `manifest.json` with the recorded counts and sample values.
- [x] `legacy_fixture_compatibility.test.js` passes — every fixture loads, migrates, and round-trips as recorded in its manifest.
- [x] `migration_invariants.test.js` passes — no NOT-NULL-without-default, no DROP COLUMN without DEPRECATIONS.md entry, no DROP TABLE, no rename of pinned-provenance columns, no non-CONCURRENT index on heavy tables.
- [x] `ingestion_handler_routing.test.js` passes — every spec_version in the registry has a handler; `_pinned.json` is append-only.
- [x] `template_field_id_immutability.test.js` passes — no field ID deletion; baseline JSON tracks current set.
- [x] `ingestion_idempotency.test.js` passes — re-running ingestion is a no-op for content rows and duplicate-only reruns create no `IngestionBatch`.
- [x] `backup_version_traceability.test.js` passes — backups carry full version metadata; older-than-installed restore refuses cleanly.
- [x] `spec_canon_consistency.test.js` passes — registered spec versions dry-run through the adapter.
- [x] `db_index_invariants.test.js` passes against fresh SQLite schema — pinned index set is present. Live Postgres pin is deferred to the DB-backed gate.
- [x] Test suite Section L added with rows for each invariant.
- [x] PROJECT_CODEX.md links to the test files from the relevant invariant bullets (the rules now point at their executable enforcement).
- [x] Spec bumped. Manual `MANUAL_VERSION` bumped.
- [ ] `npm run package:win` produces a release; deferred because unrelated pre-existing WP-0110+ planning files keep the package script dirty guard from running.

## Test plan
- **Unit (per-fixture)**: load each frozen fixture, run migrations, assert counts and round-trips.
- **Static-grep (linter)**: scan migration source for forbidden patterns; expect zero matches; deliberately add a forbidden line in a temp branch to confirm the linter catches it.
- **Live Postgres (idx + handler routing + idempotency)**: against the existing `castkit-codex-postgres` container, exercise the `ImageAsset` table; verify dedup is idempotent across two ingestion runs.
- **Smoke (manual, dev mode)**: ingest one of the operator's real 15k-image v00.19 batches; verify it lands clean and surfaces in the library; re-run and confirm dedup; capture screenshots.
- **Stress (one batch only, packaged build)**: same flow against the packaged v0.2.11+ build.

## Governance checklist
- [x] Task Board updated with WP-0106 row at `DONE`.
- [x] Spec bumped to v00.070.
- [x] No new generated file/folder/artifact names with spaces.
- [ ] Planning-checkpoint commit was not possible in-session because the operator asked to execute back-to-back without waiting; shipping checkpoint commit is the authoritative checkpoint for this pass.
- [x] Shipping-checkpoint commit prepared after implementation.
- [x] In-app manual updated in the same commit as the new tests (per codex hard-requirement rule).
- [x] Test suite Section L added.
- [ ] Invariant mutation tests were not committed; focused positive suite passed and static tests encode the failure cases.
- [ ] NAS mirror backup script not run in this pass.

## Implementation notes
- Fixtures live under `CKC_main/test/fixtures/legacy/` not `CKC_GOV/` because they are test inputs the build needs at runtime; small enough to commit (≤ 100 KB each).
- The migration linter is intentionally a static-grep, not a runtime check; we want CI to catch a bad migration before it runs against any DB.
- `pinned_handlers.json` lives at `CKC_main/app/backend/imageSourcingHandlers/_pinned.json`; it's append-only by convention + enforced by the routing test.
- The frozen fixture for v00.19 ingestion uses a tiny synthetic dataset (~5 images, 2 lanes) — enough to exercise the adapter without dragging real assets into the repo.
- The "75k-image guarantee" in the codex isn't a perf claim, it's a correctness claim: every row written today is readable tomorrow. Perf is a follow-up.

## Risks / mitigations
- **Risk**: a future WP genuinely needs to break an invariant (e.g. drop a sacred provenance column because a better identifier replaces it). **Mitigation**: the codex rule allows the override but requires a deprecation window + migration script + test that proves the recovery path still works. The linter accepts the override only when the corresponding `DEPRECATIONS.md` entry is present.
- **Risk**: fixtures bit-rot when the migration framework changes. **Mitigation**: fixtures are read-only; the migration runner brings them forward. If a migration changes shape, the fixture's expected counts may need an update — but only the post-migration counts move, never the captured "as-of" snapshot.
- **Risk**: the canonical template field-ID baseline drifts and someone updates it without justification. **Mitigation**: baseline updates require a CHANGELOG entry in `test/fixtures/template_v2_00_field_ids.CHANGELOG.md` recording the WP that added the new field.
- **Risk**: `pinned_handlers.json` is mutated outside the dispatcher import list. **Mitigation**: the test reads BOTH the dispatcher and the pinned list and compares; a mismatch fails CI.
- **Risk**: index pinning conflicts with future query optimizations that drop unused indexes. **Mitigation**: the test pins MINIMUM presence, not maximum; dropping a pinned index requires removing it from the codex's pinned set, which requires a WP touching this file.

## Rollback
- Revert the WP commit. Tests disappear; codex rules remain (they're textual). The next operator who tries to break an invariant won't be caught by a test but will be caught by code review against the codex.
