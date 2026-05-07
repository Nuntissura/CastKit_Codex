# CastKit Codex — Test Suite

**Status:** binding governance document. Linked from `CKC_GOV/PROJECT_CODEX.md`.

This document is the canonical, repeatable test suite for the CastKit Codex application. **Every addition, expansion, or large refactor of CKC must update this suite** — add new checks for new features, mark existing checks as deprecated when behavior changes, and update the agent-driven scripts under `### Agent-driven scripts` so the suite stays runnable end-to-end.

## How to run the suite

The agent (LLM/operator helper) drives the running CKC app via Chrome DevTools Protocol (CDP) plus the wired automation surface. The minimum environment:

1. Local PostgreSQL up (`CKC_GOV/scripts/postgres_up.ps1` — falls back to port 55432 when 5432 is taken).
2. Vite dev server: `cd CKC_main && npx vite --port 5173`.
3. Electron with CDP: `cd CKC_main && npx electron . --remote-debugging-port=9222` (in operator mode for visual checks; add `CKC_AUTOMATION_BACKGROUND=1` for stealth-mode checks).
4. Agent attaches via `http://localhost:9222/json` → WebSocket → `Runtime.evaluate` with `awaitPromise: true`.
5. Agent uses `window.ckc.automation*` for sessions/leases/captures and `window.ckc.<bridge>` for direct preload calls.
6. Agent captures screenshots via CDP `Page.captureScreenshot` (works regardless of OS-level window occlusion) AND `automationCaptureToFile` (background mode).

The suite is organized so each block can be run independently. Findings get recorded in `### Findings (latest pass)` with date.

---

## Section A — Boot + connectivity

- A1. App boots to Library route. `automationGetState()` returns `ok: true`, `app.databaseProvider === 'postgres'`, non-null `app.libraryRoot`, non-null `app.configPath`.
- A2. `diagnostics.ok === true`, `diagnostics.dbProvider === 'postgres'`, `characterCount` reflects DB.
- A3. Renderer paints (`document.body.innerHTML.length > 0`). DevTools console is clean of red errors.
- A4. CDP page target is reachable; `webSocketDebuggerUrl` connects.

## Section B — In-app LLM manual (WP-0099 / WP-0100)

- B1. `automationGetManual({ format: 'index' })` returns `ok: true`, valid `manualVersion`, ≥ 1 feature group.
- B2. `automationGetManual({ format: 'json' })` returns full manual including `commandReference`, `commandMap`, `topLevelIpc`, `wiredAutomationCommands`.
- B3. `automationGetManual({ format: 'markdown' })` returns a non-empty markdown string with the "Live verification (binding)" section.
- B4. **Self-consistency**: `automation_manual_consistency.test.js` passes — every `featureGroups[].commands` entry resolves to a wired command (or has `script:` prefix), every wired command has a `commandReference` entry, target labels match `classifyAutomationCommand`.
- B5. Help drawer: open menu → "LLM / Operator Manual" entry visible → modal opens with Markdown / Index / JSON tabs → version pinned matches `MANUAL_VERSION`.

## Section C — Automation surface (WP-0099)

### C1. Top-level IPC
- C1.1. `automationCreateSession` → unique session id, `status: 'active'`.
- C1.2. `automationHeartbeat` updates `lastHeartbeatAt`.
- C1.3. `automationAcquireLease` / `automationReleaseLease` reflect in `automationListSessions`.
- C1.4. `automationListLog({ limit: N })` returns recent events.
- C1.5. `automationEndSession` closes session cleanly.

### C2. Renderer commands
- C2.1. `openLibrary` / `openCharacter` / `openExports` / `openIntake` / `openPose` / `openWorkflow` change `route` correctly (verify via `getRendererState`).
- C2.2. `selectImage`, `openGlobalSearch`, `toggleMenu`, `closeOverlays` reflect in renderer state.
- C2.3. `getRendererUIState` returns richer payload including `initStatus`, `pendingDoc`, `exports.context`.

### C3. Synthetic input (WP-0099 slice 3)
- C3.1. `injectKey` and `injectMouse` route through `webContents.sendInputEvent` only — no OS input library calls (static-grep test pinned).
- C3.2. `clickElement` dispatches a click `MouseEvent` on the matched element.
- C3.3. `typeText` uses the native value setter so React `onChange` handlers fire.
- C3.4. **Known gap (2026-05-06):** `HTMLElement.click()` from CDP `Runtime.evaluate` does not always reach a React 19 controlled button's `onClick` handler. Verify via the canonical wired `clickElement` automation command instead of `el.click()`. Investigate whether to switch the WP-0099 `clickElement` impl to also dispatch synthetic React events for better reliability.

### C4. Backend commands (WP-0099)
- C4.1. `listCharacters`, `getCharacter`, `listGlobalCarouselImages`, `listPendingImages` all return shape-correct results.
- C4.2. `createCharacter`, `saveCharacter`, `softDeleteCharacters`, `restoreCharacters` round-trip cleanly.
- C4.3. `setImageMeta` persists `favorite`, `rating`, `notes`, `tags`, `sourceNote`. **Caveat:** the image object returned by `getCharacter().images[]` uses `id` (not `imageId`) — pass it as `imageId: img.id` to `setImageMeta`.
- C4.4. `setImagesMetaBatch` patches multiple images atomically (BEGIN/COMMIT).
- C4.5. `listTemplates`, `listAllTags`, `globalSearch` return shape-correct results.
- C4.6. Pose/Workflow backend commands round-trip: `listRigs`, `getRig`, `createRig`, `updateRigCalibration`, `setRigHeadPose`, `setRigPortrait`, `listPrompts`, `upsertPrompt`, `deletePrompt`, `listStoryBeats`, `upsertStoryBeat`, `deleteStoryBeat`.

## Section D — Stealth contract (WP-0099 slice 4)

- D1. Launch with `CKC_AUTOMATION_BACKGROUND=1`. Verify `Get-Process electron` shows empty `MainWindowTitle`.
- D2. CDP target reachable; renderer paints offscreen (`Page.visibilityState === 'visible'` because Chromium offscreen-paint mode treats window as visible, opposite of operator-mode occlusion).
- D3. `automationCaptureToFile` returns non-zero `width`/`height` and writes a real PNG.
- D4. Second launch attempt prints `[stealth] another CKC instance is running; this process exits without raising the first.` and exits 0.
- D5. `automationListLog` shows a `lifecycle.secondInstance` event with `backgroundMode: true`.
- D6. `automationListLog` shows `stealth.skip` events for `mainWindow.raise` (from `app.second-instance`) and `globalShortcut.register` (from `registerReferenceWindowShortcuts`).
- D7. Operator's foreground app remains active and receives operator's input during the run (no focus steal).

## Section E — Image-sourcing workflow (WP-0100)

### E1. Spec registry
- E1.1. `listWorkflowSpecs()` finds the v00.19 spec at `CKC_GOV/references/external_app_data/specs/`.
- E1.2. `getLatestWorkflowSpec({ specId: 'idol_image_sourcing_init_spec' })` returns the highest version.
- E1.3. Adding a fixture v00.20 spec file makes `getLatestWorkflowSpec` resolve to v00.20 without code changes.

### E2. Per-character scripts
- E2.1. `addCharacterScript` writes to `libraryRoot/characters/<id>/scripts/<script_id>__<sanitized_name>.<ext>` and returns `deduped: false` for new bytes.
- E2.2. Same content twice → second call returns `deduped: true` with the same `scriptId`.
- E2.3. `listCharacterScripts` lists the rows; `getCharacterScript` decodes the file content.
- E2.4. `removeCharacterScript` deletes both the row and the on-disk file.

### E3. Adapter (v00.19)
- E3.1. Dry-run against the real reference batch (`D:/Projects/Image_sourcing/lora_avatar_test_0006/task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J`) detects `spec_version: v00.19`, parses `dataset_id` + `task_id` from `task_state.yaml`, resolves `intake/accepted/`, walks lane folder, finds expected images and scripts (from `task_tools/scripts/`).
- E3.2. Re-running the same task (same character + sheet version) is idempotent — produces zero new imports, surfaces correct skip reasons.
- E3.3. Pending lane: imports set `review_status='pending'` and `pending` tag; surface via `listPendingImages`.
- E3.4. Rejected lane: writes `IngestionRejection` rows only; no `ImageAsset` rows.
- E3.5. Missing required fields (`taskRootPath`, `characterId`, `sheetVersionId`) error cleanly.
- E3.6. Unknown `spec_version` errors cleanly listing registered handlers.
- E3.7. `run_state_lock.json` held → adapter refuses to ingest.

### E4. Identity-decoupling
- E4.1. Imports use content-hash filenames (`<hashPrefix>.<ext>`); the character `display_name` does not appear in any path, sync-event payload, or DB row produced by the adapter.
- E4.2. Per-character scripts use `script_<id>__<sanitized_name>.<ext>` — opaque prefix.
- E4.3. The pinned unit test `backend_identity_decoupling.test.js` passes.

## Section F — Character sheet editor

### F1. Field type coverage (template v2.00)
- F1.1. **String** (`<string>`, `<string | unset>`, `<string | optional>`): single-line input. Type → save → reload → byte-exact restore. Includes Unicode (`한글`, `ñ`, emoji), special chars (`< > & ' "`).
- F1.2. **Enum** (`<a | b | c>`): single-line input with HTML `datalist`. Valid value persists. Invalid value triggers `Non-canonical enum value` warning but persists when `allowSaveWithErrors: true`.
- F1.3. **Enum + other:descriptor** (`<a | b | other:<descriptor> | unknown>`): same as enum but the validator is currently buggy — single-word enum values like `curvy` fail `Descriptor must be 2-12 words`. **OPEN BUG (2026-05-06):** descriptor-validator misclassifies the union; saves anyway with `allowSaveWithErrors: true`.
- F1.4. **List** (`<list | optional>`): rendered as input or textarea depending on `inputRowsForField`. Operator-typed values stored verbatim — no parsing into array elements at the renderer level (validation/parse happens on save).
- F1.5. **Score_10** (`<score_10 | optional>`): `x/10` where x ∈ [0..10]. Out-of-range → validation error.
- F1.6. **Paragraph** (`<paragraph | optional>`): `<textarea>` with `rows > 3`. Newlines preserved.
- F1.7. **Block list / single block** (`<list of XYZ_Block | optional>`, `<XYZ_Block | optional>`): rendered as a structured inline editor (`BlockListEditor` → `BlockEditor` → `SheetField`). **RESOLVED 2026-05-06 (WP-0104):** prior textarea fallback replaced; schema descriptor lines no longer render as standalone empty divs (top-level `ckc-field-*` divs dropped from ~896 to ~480 on a fresh sheet).
  - F1.7.1. Empty list shows `No <BlockName> entries — click + Add to create one.` plus a `+ Add <BlockName>` button.
  - F1.7.2. Clicking + Add appends a new block with all sub-fields blank; sub-field input types match the block schema (string → input, enum → input + datalist, score_10 → input, descriptor → input/textarea, list → textarea).
  - F1.7.3. Remove deletes the block; Move up / Move down reorders. Move up disabled at index 0; Move down disabled at the last index.
  - F1.7.4. Sub-field validation: invalid `score_10` (e.g. `99/10`) and short descriptor (1 word in strict mode) surface in `saveCharacter` `issues[]` with paths like `CHAR-WRK-007[0].HUS-BLK-003`. Single-block fields use `CHAR-IDX-001.HUS-BLK-003` (no array index).
  - F1.7.5. JSON roundtrip: save → reload → byte-exact restore of all sub-field values, including Unicode and emoji. Empty list serializes to `''` (not `'[]'`); empty single block serializes to `''` (not `'{}'`).
  - F1.7.6. Tolerant parse: malformed pre-existing JSON falls back to an empty list with a one-time warning above the editor; the operator can save fresh content over it without losing the original raw bytes until they hit Save.
- F1.8. **Read-only rule** (`<rule>`): rendered as `<pre>` with `field.type === 'rule'`. Only 2 `<pre>` rule rows visible on a default render — the 6 `CHAR-DQR-*` rules at the top of the template seem to live in a section that is collapsed by default and so are not in the DOM until expanded.

### F2. Save flow
- F2.1. UI Save button is labeled `Save` when `isDirty`, `Saved` when clean, `Saving…` while in flight.
- F2.2. **OPEN GAP (2026-05-06, deeper pass):** clicking the Save button (header right, `<button onClick={() => void saveSheet()} disabled={!isDirty || isSaving}>`) via every UI-driven path fails to trigger `saveCharacter`. Verified end-to-end with DB readback against Aeri's `CHAR-ID-002A`: dirty value never persists. Methods tested:
  - `__reactProps.onClick({})` direct invocation
  - `fiber.memoizedProps.onClick({})` (latest commit's live closure)
  - native `el.click()`
  - DOM `dispatchEvent` of `pointerdown` → `mousedown` → `focus` → `pointerup` → `mouseup` → `click` with `bubbles: true, cancelable: true, view: window`
  - the wired `clickElement` automation arm (which performs the same pointer/mouse/click sequence)
  - `KeyboardEvent` Enter on a focused button
  - CDP-trusted `Input.dispatchMouseEvent` (per the prior pass)

  Ruled out:
  - **Disabled state**: button is enabled (`disabled: false`) when `isDirty=true`. Was a confounding variable in the prior pass — when sheet was clean the click was correctly ignored. With sheet dirty, it still doesn't fire.
  - **Wrong button**: only one element with `textContent === 'Save'` matches when the relations editor is collapsed; rect / parent class confirm it is the header-right SaveSheet button.
  - **Form ancestor**: no `<form>` ancestor up to `<body>`; `type="submit"` is harmless.
  - **Stale closure**: `__reactProps.onClick` and `fiber.memoizedProps.onClick` agree on source (`() => void saveSheet()`); CharacterView's `characterId` prop is set; SheetEditor's `valuesById` prop reflects the dirty input value.
  - **Console errors**: hooking `console.error` during the click captures nothing; no thrown exceptions.

  Other React buttons in the app (Help drawer, menu, sheet-editor `+ Add Hustle_Block` from WP-0104) work fine via `clickElement`. Genuine bug — open as a future investigation WP. Three diagnostic approaches still untried: (a) walk into CharacterView's hooks and pull saveSheet directly to invoke without onClick wrapper, (b) instrument `window.ckc.saveCharacter` via Electron preload re-export to confirm it's never called, (c) bisect — comment out the `() => void` wrapper and use just `saveSheet` to see if void is interfering with React's handling of returned Promise.

  **Canonical agent test path**: backend `window.ckc.saveCharacter({ characterId, valuesById })` direct call. Always works; verified across WP-0103 + WP-0104.
- F2.3. `saveCharacter` returns `issues[]` of `{ fieldId, severity: warn|error, message }`.
- F2.4. With `allowSaveWithErrors: true`, errors surface in `issues` but the values are persisted anyway.
- F2.5. With strict mode (`validationMode: strict, allowSaveWithErrors: false`), errors block the save.
- F2.6. Identity fields (`Character_ID` = `CHAR-ID-001`) are read-only in the UI (`readOnly: true` on the input).

### F3. Template integrity invariants (codex rule)
- F3.1. No Field IDs are dropped on save (run `saveCharacter` then `getCharacter` and compare key sets).
- F3.2. Template field order is preserved on read.
- F3.3. User bytes are stored verbatim — no silent rewriting (test: type `  spaced  ` and Unicode → reload → same bytes back).

### F4. Cross-character preset reuse (WP-0032)
- F4.1. Type a unique value for `Real_Name` on character A → save → focus the same field on character B → datalist suggestions include the value typed on A.
- F4.2. Suggestions only surface non-system tags / non-empty values; deduped case-insensitively.
- F4.3. `ensureSuggestionsLoaded(fieldId)` lazy-loads on focus.

### F5. Edge cases
- F5.1. Empty save (clear a previously populated field) → field becomes empty in `valuesById`; reload confirms.
- F5.2. Very long string (≥ 10k chars) → save + reload byte-exact.
- F5.3. Unicode + emoji in any string field → byte-exact roundtrip.
- F5.4. Template-syntax-looking value (`<test>`) — does not get treated as a placeholder; stored as the literal string.
- F5.5. Pasting multi-line content into a single-line `<input>` — newlines collapsed by the browser; document the actual behavior.

## Section G — Library + character lifecycle

- G1. Create character via `createCharacter` — appears at top of library list, inherits default template (`v2.00`).
- G2. Public Character ID assigned (`CHAR-NNNNNN` format).
- G3. Soft delete → character disappears from default list, appears in Trash; restore brings it back; purge is permanent.
- G4. Set character icon via `setCharacterIcon` (must reference an existing image owned by the character) → icon appears in the library list row.
- G5. Importing images attaches them to the character, with content-hash filenames (no operator name in path).

## Section H — Per-image metadata (Photo mode + tagging)

- H1. `setImageMeta` persists individual fields. **Caveat:** pass `imageId: img.id` (not `img.imageId`).
- H2. Adding tags via `setImagesMetaBatch({ imageIds, addTags: [...] })` batches via SQL transaction.
- H3. `pending` tag + `review_status='pending'` on intake-pending images surfaces in the WP-0094 intake sorter UI (Drawer → Intake Sorter → Pending tab).
- H4. Removing all tags via `setImagesMetaBatch({ removeTags: [...] })` clears them; images keep `tags_json: '[]'`.
- H5. Carousel: tagging an image with `carousel` makes it appear in the global carousel.

## Section I — Stealth + non-stealth parity

- I1. Every backend command returns the same shape in operator mode and stealth mode.
- I2. Renderer commands route correctly in both modes (renderer paints offscreen in stealth).
- I3. Captures: `automationCaptureToFile` produces real PNGs in stealth (no occlusion); in operator mode produces 0×0 PNGs when window is occluded → use CDP `Page.captureScreenshot` as fallback.

## Section J — Pose and Workflow tabs (WP-0107+)

- J1. Schema smoke: `backend_posekit_schema.test.js` passes. Fresh SQLite init and reopen include `ImageAsset.pose_json`, `openpose_png_path`, `comfyui_workflow_json`, `comfyui_metadata_json`, `prompts_json`, `rig_id`, plus `Rig`, `Prompt`, `StoryBeat`, and `RigTag`.
- J2. Backend CRUD smoke: `backend_posekit_crud.test.js` passes. Create character -> import image -> set image notes/tags -> create rig -> update calibration -> upsert/delete prompt -> upsert/delete story beat.
- J3. Sample-image smoke: import at least one image from `D:/Projects/LLM projects/OpenRepose/test_material/image_samples` into a temporary CKC library, create a rig, upsert a prompt and story beat, then delete the temporary library. Historical source stays read-only.
- J4. Renderer routes: `openPose` and `openWorkflow` route via `automationRunCommand({ target: 'renderer' })`; `getRendererUIState().route` returns `pose` and `workflow`.
- J5. Pose visual pass: capture the Pose tab after selecting the Tools / Calibration tab. Verify book layout: left image stage, right data/tools tabs, CKC color palette, no blank viewport, no text overlap.
- J6. Workflow visual pass: type a prompt through `typeText`, click `workflow-save-prompt` through `clickElement`, click `workflow-tab-beats`, capture the Story beats tab, and verify the prompt appears as selectable beat input.
- J7. Accessibility/static UI: `posekit_ui_static.test.js` passes. Pose and Workflow tab groups use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, and `aria-controls`.
- J8. Console: during visual pass, no renderer red errors. Dev CSP warning is acceptable in Vite/Electron dev mode only.
- J9. PoseKit core smoke: `posekit_core.test.js` passes. Fallback rig has body-18, serializes to canonical openpose arrays, yaw identity is deterministic, and calibration visibility zeroes keypoints.
- J10. PoseKit export smoke: `backend_posekit_crud.test.js` covers `updateRigPose` and `exportOpenposePng`, verifies content-hash `images/openpose/<hash>.png`, `openpose_png_path`, `rig_id`, and deduped re-export.
- J11. ComfyUI workflow storage smoke: `backend_posekit_workflow.test.js` passes. Synthetic bridge payload registers image bytes, stores workflow/metadata/prompts, dedupes repeated payloads, lists workflow history, extracts prompts, and posts replay to a mocked ComfyUI `/prompt`.
- J12. Intake server smoke: `intake_server.test.js` passes. Localhost intake binds, bearer token rejects unauthorized POST, and authorized POST dispatches to the registration callback.
- J13. ComfyUI node contract: `comfyui_node_contract.test.js` passes when Python is available. The CKC bridge node exposes ComfyUI class/display mappings under the CKC category.
- J14. WP-0108 live MediaPipe gate: import at least one image from `D:/Projects/LLM projects/OpenRepose/test_material/image_samples`, open Pose via `openPose`, click `pose-detect`, and verify `listRigs` returns status `ready`, detector provider `mediapipe.tasks-vision.pose+face`, body count 18, face count 70. Latest pass: 2026-05-07 on `1085406391.jpg`, rig `rig_c6af1bc51289088fee604f1de358d3f3`, capture `CKC_GOV/targets/CKC/automation_captures/2026-05-07_152842664Z_no_session_wp-0108-after-wasm-middleware-detect-refreshed.png`.
- J15. WP-0109 live ComfyUI gate: `getComfyUIStats` reaches `http://127.0.0.1:8188`, `replayWorkflow({ waitForCompletion: true })` submits a real ComfyUI API graph, polls `/history`, fetches `/view`, registers the output image under the target character/rig, and Workflow/Pose captures show the stored run plus enabled replay controls. Latest pass: 2026-05-07 on ComfyUI `0.20.1`, prompt `0b6a5812-f576-4807-8507-8cf89f8d5b87`, output `img_a89994d10d39213b4f65d8b137869e8d`, captures `CKC_GOV/targets/CKC/automation_captures/2026-05-07_155652022Z_no_session_wp-0109-workflow-live-replay.png` and `CKC_GOV/targets/CKC/automation_captures/2026-05-07_155653305Z_no_session_wp-0109-pose-replay-button.png`.
- J16. WP-0110 head-pose gate: `pose_head_pose_math.test.js`, `backend_posekit_crud.test.js`, `posekit_core.test.js`, `posekit_ui_static.test.js`, and `automation_manual_consistency.test.js` pass; Pose toolbar exposes yaw/pitch/roll inputs, sliders, and reset selectors; `setRigHeadPose` persists `Rig.calibration_json.headPose` with intrinsic `YXZ` quaternion and legacy `calibration.yaw` compatibility.
- J17. WP-0110 live visual/backend gate: import `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`, open Pose, detect a rig, call `setRigHeadPose({ yaw: 30, pitch: -15, roll: 10 })`, reload Pose, verify DOM controls show `30`, `-15`, `10`, verify 3D viewport canvas and 1024x1024 openpose preview exist, capture the Pose tools view, and export the preview PNG twice with identical hash. Latest pass: 2026-05-07, rig `rig_d815e8ea6a53933eacdf681f84ce6325`, capture `CKC_GOV/targets/CKC/automation_captures/2026-05-07_175728510Z_no_session_wp-0110-head-pose-live.png`, export hash `15e1ec81aed024e92db747aea026ef073bb9701bab0de25fd8124f80a0273116`.
- J18. Remaining release gate: packaged build smoke repeats J14, J15, and J17 from the packaged app.

## Section K - Reset modes (WP-0105)

- K1. Installer invariant: `installer_modes_invariants.test.js` passes; `installer_custom.nsh` exposes Update / Reinstall / Light / Full modes and no destructive rule targets `images/original` or `images/thumb`.
- K2. Full reset marker: `full_reset_marker.test.js` passes; marker startup path writes `orphans/<timestamp>/manifest.json`, preserves image-byte SHA-256, removes generated folders, truncates content tables, and preserves `CkcMeta` / `CkcDbMigration`.
- K3. Orphan adoption: `adopt_orphan_images.test.js` passes; `adoptOrphanImages` restores tags/rating/favorite/notes/source metadata and is idempotent.
- K4. Live reset smoke: import `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`, request Full reset through the backend automation gateway, restart CKC, verify `lastFullResetResult.ran === true`, list the newest orphan manifest, adopt into `__new__`, and capture the recovered character. Latest pass: 2026-05-07, manifest `CKC_GOV/targets/scratch/wp-0105-live/CastKit-Codex-Library/orphans/2026-05-07_182837/manifest.json`, captures `2026-05-07_162707767Z_no_session_wp-0105-before-full-reset.png` and `2026-05-07_162854971Z_no_session_wp-0105-after-adopt-orphans.png`.

## Section L - Forward-compat invariants (WP-0106)

- L1. Frozen fixtures: `legacy_fixture_compatibility.test.js` passes; fixtures `wp-0091`, `wp-0100`, `wp-0103`, and `wp-0104` migrate under the current `CKCLibrary` and round-trip manifest character/image/tag/block-list expectations.
- L2. Additive migration lint: `migration_invariants.test.js` passes; rejects NOT-NULL-without-default, unapproved drops, sacred provenance renames, and non-idempotent heavy-table index creation.
- L3. Handler routing pin: `ingestion_handler_routing.test.js` passes; every workflow spec version has a registered handler and `_pinned.json` entry.
- L4. Template field IDs: `template_field_id_immutability.test.js` passes; the governance and app copies of `CHARACTER_SHEET__v2.00.txt` match and baseline field IDs are not deleted or reused.
- L5. Re-import idempotency: `ingestion_idempotency.test.js` passes using `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg` when present; the second v00.19 accepted-lane run creates no new `ImageAsset` or `IngestionBatch`.
- L6. Backup traceability: `backup_version_traceability.test.js` passes; backup manifests carry CKC version, migration cursor, provider, counts, and newer-version restores refuse clearly.
- L7. Spec canon consistency: `spec_canon_consistency.test.js` passes; each registered workflow spec dry-runs through the adapter without unknown lane/spec errors.
- L8. Index pins: `db_index_invariants.test.js` passes; fresh SQLite schema exposes pinned `ImageAsset` indexes for content hash, sheet version, source task, and review status.
- L9. Focused command: `npm test -- test/migration_invariants.test.js test/ingestion_handler_routing.test.js test/template_field_id_immutability.test.js test/legacy_fixture_compatibility.test.js test/ingestion_idempotency.test.js test/backup_version_traceability.test.js test/db_index_invariants.test.js test/spec_canon_consistency.test.js`.
- L10. Latest pass: 2026-05-07, focused WP-0106 suite passed 12 tests.

## Section M - Packaged build smokes

Run after every `npm run package:win`:
- M1. NSIS installer + portable .exe land under `CKC_GOV/targets/CKC/artifacts/releases/vX.Y.Z/` with `manifest.json` + `SHA256SUMS.txt`.
- M2. Tag `vX.Y.Z` pushed; GitHub Action attaches assets to the GH Release.
- M3. Launch the portable .exe → repeats sections A, B, C, F, J, K, and L as a packaged-build smoke.
- M4. Stealth-mode launch on the packaged build succeeds (capture works, no window).

---

## Agent-driven scripts

The agent runs each section by attaching to CDP and evaluating JS in the renderer. Helper scripts:

- `.tmp/cdp_eval.js` — eval JS in the first page target with `awaitPromise: true`.
- `.tmp/cdp_capture.js` — capture screenshot to file via `Page.captureScreenshot` (occlusion-safe).

These helpers are not committed — they live under `.tmp/` (operator's local-only). The canonical scripts live in this document; if the helpers go missing, the agent rewrites them from these specs.

## Findings (latest pass)

### 2026-05-07 - WP-0110 head-pose extension
- Field research confirmed OpenPose/DWPose/ComfyUI pipelines encode head pose through projected keypoint geometry, not explicit Euler fields; MediaPipe Pose Landmarker also does not provide head yaw/pitch/roll directly. CKC therefore stores the operator-edited PoseKit head pose as intrinsic `YXZ` quaternion data in rig calibration.
- Product coverage: `createHeadPose`, `normalizeHeadPose`, `applyHeadRotation`, `applyHeadPose`, openpose serialization/rendering, 3D viewport transform, Pose toolbar controls, backend `setRigHeadPose`, IPC/preload/types/manual.
- Tests passed:
  - `npm test -- test/backend_posekit_crud.test.js test/pose_head_pose_math.test.js test/posekit_core.test.js test/posekit_ui_static.test.js test/automation_manual_consistency.test.js`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm test -- --test-reporter=spec` (197 pass, 1 skipped)
- Live hidden automation passed with `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`: MediaPipe rig `rig_d815e8ea6a53933eacdf681f84ce6325`, persisted `30/-15/10`, capture `2026-05-07_175728510Z_no_session_wp-0110-head-pose-live.png`, deterministic openpose export hash `15e1ec81aed024e92db747aea026ef073bb9701bab0de25fd8124f80a0273116`.
- During the gate, backend normalization was corrected so angle-only `setRigHeadPose` calls derive the matching quaternion instead of storing identity rotation.

### 2026-05-07 - WP-0108/WP-0109 functional PoseKit slices
- Online research refreshed before implementation: MediaPipe Tasks Vision Web, Three.js OrbitControls, ComfyUI server routes, and ARIA tabs. Current package metadata checked before dependency changes; installed React-19-compatible `@mediapipe/tasks-vision`, `three`, `@react-three/fiber`, `@react-three/drei`, and `@types/three`.
- PoseKit core/UI: worker + WASM copy path, deterministic body-18 fallback rig, yaw/calibration transforms, openpose JSON serializer, canvas renderer, 3D diagnostic viewport, 2D openpose preview, marker/reframer controls, debounced calibration save, detect/export/replay toolbar actions.
- Backend/manual/automation: `updateRigPose`, `exportOpenposePng`, `registerComfyUIOutput`, `getWorkflowHistory`, `extractPromptFromWorkflow`, `replayWorkflow`, and `getComfyUIStats` wired through IPC, preload, automation map, manual, and renderer types.
- ComfyUI bridge: localhost intake server module, app-bound intake lifecycle/state, CKC-named ComfyUI custom node under `CKC_main/comfyui_node/`, Workflow tab history/JSON/extract/replay panel, Pose tab replay button.
- Tests passed:
  - `node --test --test-reporter=spec test/posekit_core.test.js test/backend_posekit_crud.test.js test/backend_posekit_workflow.test.js test/intake_server.test.js test/comfyui_node_contract.test.js test/posekit_ui_static.test.js test/automation_manual_consistency.test.js`
  - `npm run build`
- Hidden visual smoke via CKC automation passed on CDP port 9333 using `D:/Projects/LLM projects/OpenRepose/test_material/image_samples` imported into a temporary portable CKC library. Captures:
  - Pose pipeline: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_080434918Z_no_session_posekit-pipeline-pose.png`
  - Pose sample/tools/3D: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_080619633Z_no_session_posekit-pose-tools-3d.png`
  - Workflow replay: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_080556969Z_no_session_posekit-workflow-replay.png`
- 2026-05-07 follow-up live gates passed after the initial slice: WP-0108 now verifies true MediaPipe pose+face detection with local model assets, and WP-0109 now verifies real ComfyUI replay plus `/history` + `/view` output registration. Remaining gate: packaged build smoke.

### 2026-05-07 — WP-0107 Pose/Workflow first slice
- Online research recorded before implementation in `WP-0107_Pose_Workflow_Schema_And_Shell.md` and `WP-0108_Pose_Pipeline_React.md`: MediaPipe web tasks, CMU OpenPose JSON output, WAI-ARIA tabs, Three.js OrbitControls, and ComfyUI server/custom-node docs.
- Backend: `Rig`, `Prompt`, `StoryBeat`, and `RigTag` schema landed; `ImageAsset` gained nullable pose/workflow columns. IPC, preload, automation map, and manual entries are wired.
- UI: Pose and Workflow routes landed with OpenRepose-inspired tabs, CKC colors, and the book layout rule: image/visual context left, data/tools right. Calibration tab is visually isolated inside the Pose tools panel.
- Tests passed:
  - `node --test --test-reporter=spec test/backend_posekit_schema.test.js`
  - `node --test --test-reporter=spec test/backend_posekit_crud.test.js`
  - `node --test --test-reporter=spec test/posekit_ui_static.test.js test/automation_manual_consistency.test.js test/automation_input_injection_invariants.test.js`
  - `node --test --test-reporter=spec test/backend_docs.test.js test/backend_tag_manager.test.js test/backend_image_meta_batch.test.js`
  - `npm run build`
- Sample-image smoke passed against `D:/Projects/LLM projects/OpenRepose/test_material/image_samples`: imported 3 images into a temporary CKC library, set notes/tags, created one rig, one prompt, and one story beat.
- Visual pass passed in hidden automation mode on CDP port 9333. Captures:
  - Pose Tools: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_030836216Z_llm_378ca9b889d6_1778123297247_posekit-pose-tools.png`
  - Workflow Story beats confirmed: `CKC_GOV/targets/CKC/automation_captures/2026-05-07_031106176Z_no_session_posekit-workflow-beats-confirmed.png`
- Renderer mouse/text interaction: `typeText` filled Workflow prompt title/body, `clickElement` saved the prompt, `clickElement` switched to Story beats, and backend `listPrompts` confirmed the prompt rows. This specifically exercises notes/tags/data via backend and app mouse interaction via renderer automation.
- Console findings: only Electron's dev-mode insecure-CSP warning appeared; no red renderer error surfaced during the visual pass.
- Migration fix found during testing: fresh SQLite initialization was slow because additive migrations ran as separate disk transactions. SQLite `initSchema` now wraps `ensureSchemaUpgrades` in one transaction. The obsolete fresh-bootstrap creation of `idx_image_dedupe` was replaced with the intended non-unique `idx_image_hash`; existing DBs still run the old-index drop migration.

### 2026-05-06 — post-WP-0099/WP-0100 inspection
- A: ✅ all pass; 2 pre-existing bugs found and fixed in commit `2846ddd` (`initSchema` Postgres skip, `lib.getDiagnostics` missing).
- B: ✅ all pass.
- C1, C2: ✅ all pass.
- C3: ✅ wired commands pass; **gap noted in C3.4** about `el.click()` not reliably firing React 19 onClick.
- C4: ✅ all pass.
- D: ✅ all pass; stealth contract verified end-to-end via `lifecycle.secondInstance` + `stealth.skip` log events.
- E1, E2, E3 (dry-run only), E4: ✅ all pass.
- F1.1 string ✅, F1.2 enum ✅ (with the noisy `Non-canonical enum value (allowed)` warning on every non-matching value, even for `<string | unset>` fields where any string is technically allowed).
- F1.3 enum+other:descriptor — **RESOLVED in WP-0103**. Parser now classifies `<a | b | other:<descriptor> | unknown>` as enum + `allowOtherType: 'descriptor'` + `allowedSpecialValues: ['unknown']`. `curvy`/`graceful` save cleanly with zero issues. Pinned by `validation_field_types.test.js`.
- F1.5 score_10 — **RESOLVED in WP-0103**. Parser now classifies `<score_10 | optional>` as `score_10`. Validator's `normalizeScore10` enforces 0..10 with severity `error`. Pinned by `validation_field_types.test.js`.
- F1.6 paragraph ✅ byte-exact, newlines + Unicode preserved.
- F1.7 block-list / single block — **RESOLVED 2026-05-06 (WP-0104)**: structured inline editor (`BlockListEditor` + `BlockEditor` + `SheetField`); + Add / Remove / Move up/down controls; per-sub-field input types from the block schema; recursive validation with path-style issue ids; JSON roundtrip byte-exact. Top-level `ckc-field-*` div count dropped to ~479 on a fresh sheet.
- F2.2 UI Save click via CDP — **deeper investigation done 2026-05-06; still a known gap.**
  - Findings: button text is "Save" (isDirty=true), `disabled=false`, React fiber resolves `characterId` correctly in the parent, `__reactProps.onClick` is exactly `() => void saveSheet()`. So the closure is wired correctly.
  - Direct `reactProps.onClick(fakeEvt)` returned no thrown error AND no console error AND the button never transitioned to "Saving…" or "Saved". `el.dispatchEvent(new MouseEvent('click', ...))` and CDP-native `Input.dispatchMouseEvent` (trusted) behave the same way — no transition.
  - Cannot directly instrument `window.ckc.saveCharacter` to verify if it fired: `window.ckc` is exposed by Electron `contextBridge` and is frozen + each method is `writable: false, configurable: false`. Monkey-patches silently fail in non-strict mode.
  - Other React-19 buttons (menu drawer toggle, "LLM / Operator Manual" entry) accept CDP-driven clicks fine. The gap is specific to this Save button.
  - **Canonical agent test path: backend `window.ckc.saveCharacter` directly.** Documented in the test suite, the in-app manual operating contract, and the WP-0103 spec.
  - For the next pass, the most promising avenues are: (a) listen to `Runtime.consoleAPICalled` while inserting `console.log` markers inside `saveSheet` to localize where execution stops; (b) test the same flow in a packaged production build (concurrent-mode behavior can differ from dev StrictMode); (c) compare to a non-async onClick handler on the same button class to see if the `() => void asyncFn()` wrapping is the issue.
- F3 template integrity ✅ — F3.1 (no Field IDs dropped), F3.2 (order preserved), F3.3 (byte-exact roundtrip) all confirmed via getCharacter + raw psql verification.
- F4 cross-character preset reuse — **PRE-EXISTING BUG, FIXED THIS PASS** (commit `89c0aa7`): `listFieldValueSuggestions` returned `[]` for every fieldId on Postgres because the SQL used `value_text AS valueText` (camelCase alias) and Postgres lowercases unquoted aliases — JS read of `r.valueText` was always `undefined`. SQLite preserved alias case so this never surfaced in tests. Same pattern broke `listTagStats` character-count branch (`r.tagText` undefined). Fixed both. Verified after fix: Aeri's Real_Name/Primary_Role/Ethnic_Background now surface correctly in suggestions.
- F5.1 empty save ✅, F5.2 ≥10k chars byte-exact ✅, F5.3 Unicode + emoji byte-exact ✅, F5.4 template-syntax-looking value `<string | unset>` stored verbatim ✅.
- G1 ✅ (Aeri creation), G2 ✅ (CHAR-NNNNNN), G3 ✅ (soft-delete cycle: create → softDelete → disappears from default list → restore → reappears → softDelete + purge → fully gone, `purgeCharacters({characterIds})` returned `{ ok: true, requested: 1, purged: 1 }`). Minor: `listCharacters({ includeDeleted: true })` did not return the soft-deleted row — the trash list uses a different parameter or method (UI button "Trash"). Worth a small follow-up to confirm the canonical agent path for trash listing. G4 ✅, G5 ✅.
- H1 ✅ (via `imageId: img.id`), H2 ✅, H3 ✅ (set `review_status='pending'` directly in DB → `listPendingImages` returns the row with full payload including character name, relative path, tags, source info — works as expected). H4 ✅ (`setImagesMetaBatch({ imageIds, removeTags: ['master_base','frontal'] })` cleanly removed the named tags, leaving the rest intact). H5 ✅ (adding `carousel` tag → image appears in `listGlobalCarouselImages`).
- Minor identity-decoupling consideration: `listPendingImages` includes `characterName` in the response payload (for operator/UI display). Acceptable since the sheet is the canonical home of identity and this API is consumed by the operator-facing intake-sorter UI; flagged for awareness only.
- I: ✅ stealth confirmed; operator-mode capture occlusion gap noted.
- J: ✅ J1, J2 confirmed at v0.2.9.

### Sources of bugs found this pass — all pre-existing, fixed during inspection:
1. WP-0092 era: `initSchema` → no `ensureSchemaUpgrades` for Postgres — fixed in commit `2846ddd`.
2. WP-0093 era: `lib.getDiagnostics` never implemented — fixed in commit `2846ddd`.
3. WP-0032 era: `listFieldValueSuggestions` + `listTagStats` Postgres camelCase-alias bug — fixed in commit `89c0aa7`.

These bugs all worked-by-luck on SQLite tests (which preserve alias case + ran the SQLite migration path), but broke production Postgres deployments. The pattern strongly suggests an audit pass: every SQL query in `library.js` should be checked for camelCase aliases, and every column/table addition should be verified against `ensureSchemaUpgrades` running for Postgres (now ensured by the slice-1 fix).
