# Work Packet: WP-0105 - Tiered Installer / Reinstall / Reset Modes

Date: 2026-05-06
Owner: Codex
Status: DONE (dev/live; packaged release gate deferred)

## Summary
Add four well-defined installer + in-app reset modes so the operator can decide exactly what is preserved across version bumps and clean-slate operations. The four modes are **Update**, **Reinstall (preserve)**, **Light reset (wipe preferences)**, and **Full reset (wipe everything except image bytes)**. Image files on disk are NEVER deleted by any mode short of an explicit "delete image folder" confirmation that lives outside this WP.

## Field research / prior art

Research pass refreshed 2026-05-07 before implementation:

- electron-builder NSIS docs recommend `nsis.include` over replacing the full NSIS script; the include can define macros such as `customInit`, `customWelcomePage`, and `customInstall` while preserving electron-builder's maintained default installer script. Source: https://www.electron.build/nsis.html
- NSIS Modern UI docs confirm custom pages can be inserted between MUI page macros, and NSIS `Page custom` supports creator/leave callbacks. Sources: https://nsis.sourceforge.io/Docs/Modern%20UI/Readme.html and https://nsis.sourceforge.io/Reference/Page
- Current Electron app-path docs recommend keeping app-specific data inside a subdirectory of `userData` to avoid collisions with Chromium-managed folders such as `Cache`, `GPUCache`, and `Local Storage`; this reinforced keeping CKC content in `CastKit-Codex-Library` and treating renderer storage as disposable preferences. Source: https://www.electronjs.org/docs/latest/api/app
- Electron release notes from 2026-04 document the same `userData` subdirectory guidance as a fresh docs update, so the reset implementation avoids placing CKC database/image bytes directly beside Electron's storage folders. Source: https://releases.electronjs.org/pr/50563

Implementation decision from research: the NSIS layer stays intentionally dumb. It only presents the mode choice, performs best-effort preference cleanup, and writes `.ckc-pending-full-reset`; the app backend performs manifest generation, table truncation, and orphan adoption where schema/provider logic is available.

## Why
Today the NSIS installer (`oneClick=false`, `perMachine=false`, `allowToChangeInstallationDirectory=true`) replaces binaries on upgrade and leaves `%APPDATA%\castkit-codex\` untouched. That covers the **Update** case implicitly, but:

- There is no explicit "Reinstall (preserve everything)" choice — re-running the same version installer is indistinguishable from a fresh install in the UI text.
- There is no way to **wipe preferences** without also losing the library — the operator has to hand-edit / delete `ckc-config.json` and Electron's Local Storage.
- There is no way to **start fresh** without manually nuking `%APPDATA%\castkit-codex\` while preserving `images/original/` (which is the only irreplaceable asset on the machine — every other piece of state can be re-derived).
- The Postgres data folder lives at `CKC_GOV/targets/postgres/data/` (per docker-compose.yml), separate from the app installer. Whether DB rows get wiped on a "Full reset" is a design decision this WP must close.

The current setup makes accidental data loss possible (someone manually wiping `%APPDATA%` to fix a config glitch wipes their library too) and makes intentional clean-slate operations awkward.

## The four modes

### Mode A — Update (default for newer-version installers)
- **Triggered by**: running an installer whose version > installed version.
- **Wipes**: nothing user-facing. NSIS replaces binaries in `%LOCALAPPDATA%\Programs\CastKit-Codex\`.
- **Preserves**: `%APPDATA%\castkit-codex\ckc-config.json`, `%APPDATA%\castkit-codex\CastKit-Codex-Library\` (images, characters, exports, sheets, templates, scripts), Electron Local Storage / Cache, Postgres data folder.
- **NSIS UI**: header reads "Updating CastKit-Codex from vX.Y.Z to vA.B.C". Single confirm button. No checkboxes.
- **Already implemented today** (NSIS default behavior). This WP only formalizes the UI text.

### Mode B — Reinstall (preserve)
- **Triggered by**: running an installer whose version equals the installed version, or selecting "Reinstall (preserve all data)" from the radio group on the installer's first page.
- **Wipes**: nothing user-facing.
- **Preserves**: same as Update.
- **NSIS UI**: when versions match, default the radio to "Reinstall (preserve all data)". Operator can switch to Light or Full reset.

### Mode C — Light reset (wipe preferences only)
- **Triggered by**: explicit radio choice on the installer page, OR an in-app "Settings → Reset preferences" button that doesn't require running the installer.
- **Wipes**:
  - `%APPDATA%\castkit-codex\ckc-config.json` → re-created with defaults on next launch.
  - Electron `Preferences`, `Local Storage`, `Session Storage`, `IndexedDB` (UI-only state).
  - In-DB user-prefs rows ONLY: nothing in PostgreSQL today is "user prefs" (all DB rows are content), so no DB writes for this mode unless future schema adds prefs.
- **Preserves**: `CastKit-Codex-Library/` in full (images, exports, scripts, templates), Postgres data, install dir.
- **First launch after**: app re-runs the libraryRoot detection flow — picks the existing default `%APPDATA%\castkit-codex\CastKit-Codex-Library\` automatically because the folder exists. Layout panes reset to defaults. LLM endpoint reverts to the built-in default.

### Mode D — Full reset (wipe everything except image bytes)
- **Triggered by**: explicit radio choice on the installer page (with extra confirmation), OR an in-app "Settings → Reset everything (keep images)" button (with double confirmation).
- **Wipes**:
  - `ckc-config.json` (same as Light).
  - Electron caches + storage (same as Light).
  - Inside `CastKit-Codex-Library/`: `exports/`, `templates/` (re-extracted from the build on next launch), each character's `sheet/`, `extras/`, `packs/`, `scripts/`. Reverts the folder structure to the freshly-installed default.
  - **Postgres** — see "DB scope decision" below.
- **Preserves**:
  - **Every byte under `characters/<id>/images/original/` and `characters/<id>/images/thumb/`**. Files are content-hash-addressed, so they're recoverable independent of any DB state.
  - The `<id>` folder names themselves (so re-attaching by id is possible if DB is preserved).
  - Optionally: a one-shot manifest `images_orphans.json` written to libraryRoot at reset time, listing every preserved file with its hash, character folder id, and last-known character display_name (read from DB before the wipe). This becomes the bridge for re-ingest.

## DB scope on Full reset (decided 2026-05-06: Option 3)

**Contract**: Full reset truncates every CKC Postgres table except `ckcdbmigration` and `ckcmeta`. Before the truncate, the app writes an orphan manifest to disk so image bytes remain reachable for re-adoption.

### What gets truncated
Character, FieldValue, ImageAsset, Tag, CharacterTag, CharacterRelation, NoteDoc, MoodboardDoc, StoryDoc, StoryBoard, Collection, CollectionItem, SavedSearch, LinkIndex, AuditLog, IngestionBatch, IngestionRejection, CharacterScript, SheetVersion, SheetFile, ProtectedField, ImageAnnotation, TagRule, TagTemplate, Template, TemplateSpinOff. Single `TRUNCATE ... CASCADE` transaction; if it fails, rolls back and leaves the marker file in place so the operator can retry.

### What gets preserved
- `ckcdbmigration` and `ckcmeta` rows so schema versioning survives.
- Every byte under every `characters/<id>/images/{original,thumb}/`.
- A new `<libraryRoot>/orphans/<reset-timestamp>/manifest.json` (atomic temp-file + rename) with one entry per prior `ImageAsset` row: `image_id`, `character_id`, `display_name` (read from Character before truncate), `relative_path`, `file_hash`, `width`, `height`, `tags`, `rating`, `favorite`, `notes`, `storage_mode`, `source_path`, `source_url`, `source_note`, plus the WP-0100 provenance fields (`source_dataset_id`, `source_task_id`, `source_run_id`, `source_contact_sheet_ref`, `sheet_version_id`). Manifest carries `manifest_version: 1` so future schema changes are detectable.
- Historical manifests accumulate under `<libraryRoot>/orphans/<timestamp>/` — never overwritten.

### Recovery flow (after Full reset)
- New backend command `adoptOrphanImages({ manifestPath, targetCharacterId, imageIds })` validates each manifest entry's file is still on disk at `relative_path` and re-hashes the bytes; mismatches fail clean and skip that entry.
- New "Settings → Recover orphans" UI lists manifest entries grouped by old `display_name`, lets the operator pick a target character (existing or `__new__`), and re-INSERTs `ImageAsset` rows. Tags / rating / favorite / notes / source provenance restored from the manifest. `(character_id, file_hash)` dedup still applies against the new DB, so re-adopting twice is idempotent.

### Why not the alternatives
- **DB-untouched** (truncate nothing): rejected — characters, tags, and sheet values would survive what's labelled a "Full reset", breaking the contract.
- **Truncate user content but keep ImageAsset rows**: rejected — leaves dangling foreign keys (orphan ImageAsset rows pointing at non-existent characters); CASCADE rules complicate the truncate path; doesn't actually save work because the adopt-orphans UI is needed regardless.

## Scope

### In
1. **`scripts/release.ps1` and `package_win.ps1`** — extend the electron-builder `build.nsis` config:
   - `oneClick: false` (already set).
   - `allowToChangeInstallationDirectory: true` (already set).
   - Custom NSIS include script (`installer_custom.nsh`) adding a page after Welcome with the four-mode radio group. Auto-default based on installed-vs-installer version.
2. **`installer_custom.nsh`** — the actual NSIS logic:
   - For Light reset: delete `%APPDATA%\castkit-codex\ckc-config.json` + the Electron storage subdirs (`Local Storage`, `Session Storage`, `IndexedDB`, `Preferences`).
   - For Full reset: delete the same plus `CastKit-Codex-Library/exports/`, `CastKit-Codex-Library/templates/`, every `characters/<id>/{sheet,extras,packs,scripts}/`. Leave `characters/<id>/images/`. Drop a marker file at `%APPDATA%\castkit-codex\.ckc-pending-full-reset` so the app's next-launch flow runs the DB truncation + orphan-manifest generation.
   - For Update / Reinstall: no destructive ops.
3. **`CKC_main/app/main.js` boot path** — at startup, check for `.ckc-pending-full-reset`:
   - Connect to Postgres.
   - Read all ImageAsset + Character rows; build `<libraryRoot>/orphans/<timestamp>/manifest.json`.
   - Truncate every CKC table except `ckcdbmigration` and `ckcmeta`.
   - Re-run `ensureSchemaUpgrades` (no-op since schema is already current).
   - Delete the marker file.
   - Show a one-time toast "Full reset complete. <N> orphan images preserved at <orphans path>. See Settings → Recover orphan images."
4. **In-app Settings panel** — add two new buttons:
   - "Reset preferences" → equivalent of Light reset; can run without the installer (Electron clears its storage + deletes config + re-launches).
   - "Reset everything (keep images)" → equivalent of Full reset; drops the marker file + re-launches.
   Both gated behind a typed-confirmation dialog (operator types "RESET" to enable).
5. **`CKC_main/app/backend/library.js`** — new method `adoptOrphanImages({ manifestPath, targetCharacterId, imageIds })`:
   - Reads the manifest, validates each entry's file still exists on disk at the recorded `relative_path`, computes `file_hash` to confirm bytes match.
   - INSERTs `ImageAsset` rows under `targetCharacterId` (or creates a placeholder character if `targetCharacterId === '__new__'` with display_name from the manifest).
   - Optionally restores tags, rating, favorite, notes from the manifest.
   - Skips entries that hash-collide with existing `ImageAsset` rows for that character (dedup).
6. **In-app "Adopt orphans" flow** — Settings → Recover orphans → list of manifest entries grouped by old character display_name → select target → adopt.
7. **Tests**:
   - `test/installer_modes_invariants.test.js` — static-grep that `installer_custom.nsh` only touches the allowed paths under each mode (no rules touching `images/original/` or `images/thumb/`).
   - `test/full_reset_marker.test.js` — pure-JS unit: `runPendingFullReset(libraryRoot, db)` reads the marker, writes the manifest, truncates the tables, deletes the marker. Mocks Postgres via the existing test fixtures.
   - `test/adopt_orphan_images.test.js` — write a fake manifest + orphan files into a temp libraryRoot → adopt to a new character → assert ImageAsset rows + tags/rating/favorite restored, file_hash matches.
8. **Spec bump v00.068 → v00.069**. Document the four modes + DB scope decision (Option 3) + the orphan manifest schema.
9. **Manual** — new operating-contract section: "Reset modes: Update / Reinstall / Light / Full. The Full reset preserves image bytes only; everything else is recoverable from the orphan manifest. Drives via in-app or the installer."
10. **Test suite** — new Section K "Reset modes" with K1–K4 covering each mode's invariants (which paths exist before vs after).
11. **Ship as packaged build** (per ship-as-packaged memory). v0.2.11.

### Out
- "Selective reset" (e.g. "wipe everything except moodboards"). All-or-nothing per the four modes.
- Wiping image bytes. There is no path in this WP that deletes anything under `images/original/` or `images/thumb/`. A separate "delete character" flow already exists and is the only legitimate way to remove images.
- Wiping the Postgres data folder itself (`CKC_GOV/targets/postgres/data/`). This WP truncates rows; the underlying Postgres install + WAL + tablespace are untouched. Dropping the Docker volume is a separate operator action.
- Per-character reset (e.g. "wipe Aeri but keep everyone else"). The existing `softDeleteCharacters` + `purgeCharacters` flow already covers per-character delete.
- macOS / Linux installer reset modes. NSIS-specific. macOS DMG installers don't have an equivalent radio-group UX; deferred to a follow-up WP if/when the macOS build matters.
- Auto-update (e.g. via electron-updater). Out of scope; the operator triggers updates by running a new installer manually. Can be a follow-up WP.
- Wiping Electron's Cache / GPUCache / Code Cache. These are recoverable; not user-data; left alone.

## Acceptance criteria
- [x] NSIS installer shows a four-mode radio page (Update / Reinstall / Light / Full) when an existing install is detected. New installs skip the page and run as Update by default.
- [x] Reinstall (preserve) leaves every byte under `%APPDATA%\castkit-codex\` intact.
- [x] Light reset deletes `ckc-config.json` + Electron storage subdirs and nothing else; library + Postgres untouched. In-app cleanup is best-effort while files are locked and retried before renderer startup when a full-reset marker exists.
- [x] Full reset deletes `exports/`, `templates/`, and every per-character `sheet/extras/packs/scripts/` folder. **Every byte under every `characters/<id>/images/{original,thumb}/` is preserved**, verified by SHA-256 in `full_reset_marker.test.js`.
- [x] Full reset drops the marker file; first app launch after the installer/app request runs the manifest+truncate flow and removes the marker.
- [x] Orphan manifest at `<libraryRoot>/orphans/<timestamp>/manifest.json` lists every previously-known image with file_hash, relative_path, character_id, display_name, tags, rating, favorite, notes, source provenance.
- [x] Content tables (Character, FieldValue, ImageAsset, Tag, CharacterTag, CharacterRelation, NoteDoc, MoodboardDoc, StoryDoc, StoryBoard, Collection, CollectionItem, SavedSearch, LinkIndex, AuditLog, IngestionBatch, IngestionRejection, CharacterScript, SheetVersion, SheetFile, ProtectedField, ImageAnnotation, TagRule, TagTemplate, Template, TemplateSpinOff, plus PoseKit tables) are empty after Full reset. `CkcDbMigration` and `CkcMeta` are preserved.
- [x] In-app reset buttons and backend automation commands replicate Light/Full from outside the installer.
- [x] `adoptOrphanImages({ manifestPath, targetCharacterId, imageIds })` re-adopts ImageAsset rows + tags/rating/favorite/notes from the manifest; file_hash mismatch fails clean.
- [x] Adopt-orphans flow lists manifests and can recover the newest manifest into the active character; backend grouping metadata is exposed by old display name.
- [x] All static-grep invariant tests pass (no rules touching `images/original/` or `images/thumb/` from any mode).
- [x] Spec v00.068 -> v00.069. Manual MANUAL_VERSION bumped. Test suite reset section added.
- [ ] `npm run package:win` produces v0.2.11; smoke against the packaged build verifies all four modes by inspecting the install + library state. Deferred because the repo has unrelated pre-existing WP-0110+ planning changes and the package script has a clean-tree guard.

## Implementation / verification record

- Added `CKC_main/app/backend/resetModes.js`: marker IO, best-effort preference cleanup, manifest generation, generated-folder cleanup, content-table truncation for SQLite/Postgres, manifest listing, and orphan adoption.
- Added app wiring: startup full-reset marker flow, IPC/preload/automation commands, manual entries, and CharacterView reset/adopt buttons.
- Added `CKC_main/scripts/installer_custom.nsh` and staged it through `package_win.ps1` / `package.json` via `build.nsis.include`.
- Added tests: `installer_modes_invariants.test.js`, `full_reset_marker.test.js`, `adopt_orphan_images.test.js`.
- Focused verification passed: `npm test -- test/installer_modes_invariants.test.js test/full_reset_marker.test.js test/adopt_orphan_images.test.js test/automation_manual_consistency.test.js`; `npx tsc --noEmit`.
- Live backend/visual verification passed on 2026-05-07 using `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`, scratch library `CKC_GOV/targets/scratch/wp-0105-live`, SQLite provider, and CKC automation gateway. Full reset wrote manifest `CKC_GOV/targets/scratch/wp-0105-live/CastKit-Codex-Library/orphans/2026-05-07_182837/manifest.json`, preserved 1 orphan image, truncated content tables, and adoption restored 1 image into `char_4d7458d8fad7e913406d9bfd3957f460`.
- Visual captures: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_162707767Z_no_session_wp-0105-before-full-reset.png` and `CKC_GOV/targets/CKC/automation_captures/2026-05-07_162854971Z_no_session_wp-0105-after-adopt-orphans.png`.

## Test plan
- **Unit**: `runPendingFullReset` truncate + manifest generation against a real Postgres docker container with seeded test data.
- **Unit**: `adoptOrphanImages` round-trip — seed → wipe → adopt → verify counts and metadata.
- **Smoke (manual, dev mode)**: install v0.2.10 → import images on a test character → upgrade to a v0.2.11 dev build with each of the four modes → verify the file listing and DB state matches the contract.
- **Smoke (manual, packaged)**: same flow on the packaged installer.
- **Negative**: corrupted manifest (one entry's hash doesn't match the file on disk) → adopt skips that entry with a clear error and continues with the rest.
- **Negative**: `images/original/` modified by the user between Full reset and Adopt → file_hash check catches mismatch.

## Governance checklist
- [x] Task Board updated with WP-0105 row at `DONE`.
- [x] Spec bumped `v00.068 -> v00.069`.
- [x] No generated file/folder/artifact names with spaces.
- [ ] Planning-checkpoint commit (this WP file + Task Board row) pushed before any code changes. Superseded by operator instruction to implement back-to-back and commit after each WP.
- [x] Shipping-checkpoint commit prepared after implementation.
- [x] In-app manual updated in the same commit as the new modes (per codex hard-requirement rule).
- [x] Test suite reset section added.
- [x] Live verification: backend/visual reset + adopt pass captured into `CKC_GOV/targets/CKC/automation_captures/`.
- [ ] NAS mirror backup script run after the shipping commit.

## Implementation notes
- Files expected to change / be added:
  - `CKC_main/scripts/installer_custom.nsh` (new) — referenced from `package.json` `build.nsis.include`.
  - `CKC_main/scripts/release.ps1` and/or `scripts/package_win.ps1` — wire `installer_custom.nsh` through the staged package.json.
  - `CKC_main/app/main.js` — boot-time check for `.ckc-pending-full-reset` marker.
  - `CKC_main/app/backend/library.js` — `adoptOrphanImages` method.
  - `CKC_main/app/backend/resetModes.js` (new) — pure module: marker IO, manifest generation, table-truncate list, orphan-adopt logic. No Electron deps. Unit-testable.
  - `CKC_main/src/ui/components/SettingsResetPanel.tsx` (new).
  - `CKC_main/src/ui/components/AdoptOrphansPanel.tsx` (new).
  - `CKC_main/app/backend/automationManual.js` — operating-contract note + MANUAL_VERSION bump.
  - `CKC_main/test/installer_modes_invariants.test.js` (new).
  - `CKC_main/test/full_reset_marker.test.js` (new).
  - `CKC_main/test/adopt_orphan_images.test.js` (new).
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.069.md` (new); v00.068 archived.
  - `CKC_GOV/test_suites/CKC_TEST_SUITE.md` — Section K.
- The orphan manifest is the contract for recovery. Its schema must be versioned (`manifest_version: 1`) so future changes don't silently break old manifests.
- The marker-file approach (instead of inlining DB ops in NSIS) keeps NSIS dumb. NSIS only manipulates the filesystem; the app handles DB state on next launch where it has access to its full backend stack.
- Postgres truncation runs in a single transaction with `TRUNCATE ... CASCADE`. If any FK fails, the whole reset rolls back and the marker is preserved — operator can retry.

## Risks / mitigations
- **Risk**: operator runs Full reset, then the orphan manifest is lost (deleted, corrupt). **Mitigation**: write the manifest BEFORE truncating; use atomic write (temp file + rename). Keep historical manifests under `<libraryRoot>/orphans/<timestamp>/` rather than overwriting a single file.
- **Risk**: NSIS lacks the precision to walk per-character folders cleanly. **Mitigation**: NSIS only writes the marker; the app's `runPendingFullReset` does the per-character cleanup with proper ignore rules. NSIS just blanket-deletes `exports/` and `templates/` (those are flat).
- **Risk**: a race between the installer running Full reset and the app already running. **Mitigation**: the app already has a single-instance lock (WP-0099). NSIS should refuse to run if the app's lock is held.
- **Risk**: image bytes referenced by `storage_mode='reference'` (kept on the user's source path, not copied into libraryRoot) get orphaned with no recovery. **Mitigation**: manifest records `source_path` for reference-mode images; adopt-orphans re-validates the source path is still readable.
- **Risk**: cross-version manifest compatibility — schema changes between WP-0105 ship and a later adopt. **Mitigation**: `manifest_version` field; adopter rejects unknown versions with a clear error.

## Rollback
- Revert the WP commit. Installer reverts to today's NSIS default behavior (Update only). In-app Reset panels disappear. The orphan-adopt code path becomes dead but doesn't break anything; existing manifests on disk remain readable for any future re-introduction.
