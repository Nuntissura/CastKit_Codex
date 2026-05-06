# Work Packet: WP-0099 - LLM Automation Surface Expansion And In-App LLM Manual

Date: 2026-05-06
Owner: Codex
Status: DRAFT

## Summary
Close the gap between what the in-app LLM manual advertises and what the automation channel actually wires, expand the automation command map so an LLM can edit character sheets and inspect rendered form state, add window-scoped synthetic input commands for UI debugging while keeping background mode fully stealthy, and rebuild the in-app LLM manual so it is the canonical, runtime-served, code-truth reference for every tool and primitive an LLM can use.

## Why
Code audit (not Task Board) shows the current automation surface in `CKC_main/app/main.js` `getAutomationCommandMap()` lists only 9 renderer commands (all navigation) and 8 backend commands (mostly read-only + image-only writes). An LLM can land on a character sheet but cannot edit fields, save the sheet, create or delete characters, list templates, or read what is currently rendered beyond a 6-field `getRendererState`. The internal manual in `CKC_main/app/backend/automationManual.js` lists commands such as `setImagesMetaBatch` that are not in the command map, so the manual overstates the wired surface. The manual is the right place for LLM operating reference because it lives next to the code that defines the commands and is served at runtime through `automationGetManual` — but today it drifts from the wired surface and is missing primitives (background mode contract, lease names, capture conventions, decision table, worked examples).

## Scope
### In
- Wire the following commands into `getAutomationCommandMap()`, the renderer/backend automation dispatchers, and the preload bridge:
  - **Backend:** `saveCharacter`, `createCharacter`, `softDeleteCharacters`, `restoreCharacters`, `listTemplates`, `setImagesMetaBatch`, `listTags`, `searchGlobal`.
  - **Renderer:** `getRendererUIState` (returns active route, selected character/image/doc IDs, currently rendered sheet field values keyed by Field ID, drawer/overlay state, panel layout mode, dirty flags).
  - **Renderer (window-scoped synthetic input):** `injectKey`, `injectMouse`, `clickElement`, `typeText`. These dispatch through Electron `mainWindow.webContents.sendInputEvent` and renderer-side DOM `dispatchEvent`; they target only the CKC main `BrowserWindow` and never touch the OS input system.
- **Strict input-injection invariants** (asserted by tests and documented in the manual):
  - The CKC main `BrowserWindow` is the only target. No other window, process, or OS surface may be affected.
  - Operator OS focus, cursor position, physical keyboard, and active foreground window are never modified.
  - The CKC window must not be foregrounded, raised, or `focus()`-ed as a side effect of any inject command.
  - Background mode (`CKC_AUTOMATION_BACKGROUND=1`, hidden + unfocusable) must continue to work; injection must succeed against the offscreen renderer without un-hiding the window.
  - Implementation must not import or call OS-level input libraries (`robotjs`, `nut.js`, `node-key-sender`, Windows `SendInput`/`PostMessage`, AutoHotkey, etc.); a CI-style grep test pins this.
- **Strict background-mode stealth invariants** (apply to the entire app lifecycle when `CKC_AUTOMATION_BACKGROUND=1` or `appConfig.automationBackground` is set; asserted by tests and documented in the manual):
  - The main `BrowserWindow` is created hidden and stays hidden for its full lifetime. No flicker, no transient paint to a visible surface, no taskbar entry (`skipTaskbar: true`), no Alt-Tab entry where the OS allows suppression.
  - The following Electron APIs MUST NOT be called on the main window while background mode is on, from any code path (startup, IPC, automation, error handlers, single-instance handlers, update flows, file dialogs, context menus): `show()`, `showInactive()`, `restore()`, `focus()`, `moveTop()`, `setAlwaysOnTop(true)`, `flashFrame(true)`, `setSkipTaskbar(false)`, `minimize()`/`maximize()` transitions that imply visibility.
  - Native OS attention surfaces are forbidden in background mode: no `Notification` toasts, no `dialog.showMessageBox` modals against the main window, no taskbar flashing, no system sounds, no `app.dock.bounce` (mac), no foregrounding via `app.focus()` or `app.show()`.
  - Single-instance lock (`app.on('second-instance', ...)`) must NOT raise/show/focus the window in background mode; it should only log the second-instance event.
  - Mouse cursor must never be moved by the app. Physical keyboard state must never be read or intercepted (no `globalShortcut.register` while in background mode unless explicitly opted in by config).
  - Synthetic input (`injectKey`, `injectMouse`, `clickElement`, `typeText`) and capture (`automationCapture*`) must succeed against the hidden, unfocusable, offscreen-painted renderer with no visibility transition.
  - Crash/error handlers and unhandled-rejection paths must log to disk, not pop UI; any user-visible recovery prompt is deferred until the operator runs the app foreground manually.
  - When background mode is OFF (default operator-launched mode), normal UI behavior applies — these stealth invariants only constrain background mode.
- Rebuild the in-app LLM manual in `CKC_main/app/backend/automationManual.js` so it is the **canonical, runtime-served, code-truth reference** an LLM hits at startup. The manual must:
  - Cover every tool and primitive available to an LLM, organized by group: control plane, renderer navigation, renderer state read, renderer synthetic input, backend data ops.
  - For every command: name, target (`control` / `renderer` / `backend`), parameter schema, return shape, example call, related commands, safety notes.
  - Include a Bootstrap section with the recommended cold-start sequence (`automationGetState` → `automationGetManual({ format: "index" })` → `automationCreateSession` → `automationAcquireLease("renderer-navigation")` for navigation, `"renderer-input"` for synthetic input → run commands → heartbeat → `automationEndSession`).
  - Include a Stealth Contract section spelling out the background-mode invariants (no `show`/`focus`/`flashFrame`/`Notification`/cursor-move/keyboard-read/`globalShortcut`, single-instance silent exit, etc.).
  - Include a Capture section with the dev vs packaged path conventions (`CKC_GOV/targets/CKC/automation_captures/` vs `<libraryRoot>/automation_captures/`) and PNG + JSON sidecar shape.
  - Include a Safety Rules section: no censorship, template integrity, window-scoped input only (never OS-level), no focus steal, lease before navigation, end session on exit.
  - Include a Decision Table for backend vs synthetic input: both first-class; prefer backend (`saveCharacter`, `setImagesMetaBatch`) for routine data work because deterministic and side-effect-tight; use synthetic input (`injectKey`, `injectMouse`, `clickElement`, `typeText`) for UI-only flows with no backend path, reproducing UI bugs, visual debugging of renderer interactions, and end-to-end smokes.
  - Include a Worked Example: open a character, read sheet via `getRendererUIState`, edit fields via `saveCharacter`, verify via `getRendererUIState`, capture screenshot, end session.
  - Reconciled so every command in `featureGroups[].commands` is actually wired in `getAutomationCommandMap()` (or has an explicit `script:` prefix for documented external scripts); aspirational entries are removed or moved to a `roadmap` field.
  - `MANUAL_VERSION` bumped to `2026-05-06.wp-0099`.
- Expose three formats from `automationGetManual`: `"index"` (compact summary + group/command list for quick LLM bootstrap), `"json"` (full structured manual for programmatic consumption), `"markdown"` (rendered for human reading).
- Add a renderer Help surface (drawer or page accessible from the existing menu drawer) that fetches the same in-app manual via IPC and renders the markdown form for the operator to read. Single source of truth for both LLMs and humans; no parallel docs.
- Update governance pointers (`AGENTS.md`, `CKC_GOV/PROJECT_CODEX.md`, `ckcstart.cmd`) to state plainly that the canonical LLM operator manual lives in-app and is fetched via `window.ckc.automationGetManual`. No external markdown manual file is created in governance.
- Add unit tests for the new backend automation commands (parameter validation, error shapes, success shapes) and for the input-injection invariants (target-window scoping, no OS-input library imports, background-mode capture-after-inject smoke).
- Bump spec `v00.064 -> v00.065`; archive `v00.064` into `CKC_GOV/spec/archive_spec/`.
- **Ship as a packaged build.** After dev-mode visual smoke passes, run `npm run package:win` from `CKC_main/` so the patch version is bumped, tagged `vX.Y.Z`, packaged, and pushed; the existing `.github/workflows/release-win.yml` attaches the installer + portable `.exe` to a GitHub Release. Verify the new automation surface works in the packaged build, not only in dev mode.

### Out
- Public or remote network API.
- OS-level input APIs of any kind (Windows `SendInput`/`PostMessage`, `robotjs`, `nut.js`, `node-key-sender`, AutoHotkey, etc.).
- Any input path that can affect a window other than the CKC main `BrowserWindow`, steal operator focus, raise/foreground the CKC window, or move the operator's OS cursor.
- Chrome DevTools Protocol integration / DOM evaluation / network introspection.
- Moodboard / docs / collections automation commands (covered by future WPs if needed).
- Localization, telemetry, or remote logging of automation sessions.
- In-app auto-updater wiring (updates ship via new GitHub Release installer/portable; auto-update integration is a separate WP).

## Acceptance criteria
- [ ] `getAutomationCommandMap()` in `CKC_main/app/main.js` returns the expanded backend, renderer, and renderer-input command lists exactly as listed in scope.
- [ ] Each new backend command is callable through `automationRunCommand({ target: "backend", command: <name>, params })` and returns `{ ok: true, result }` or `{ ok: false, error }` with stable error messages.
- [ ] `getRendererUIState` returns a JSON object including: `route`, `selectedCharacterId`, `selectedImageId`, `selectedDocId`, `sheetFields` (object keyed by Field ID with current rendered values, no normalization), `drawerMode`, `overlays`, `panelLayoutMode`, `dirty` flags.
- [ ] `injectKey`, `injectMouse`, `clickElement`, `typeText` execute against the CKC main `BrowserWindow` only, succeed in background mode (`CKC_AUTOMATION_BACKGROUND=1`) without un-hiding or focusing the window, and never call OS-level input APIs.
- [ ] In background mode, throughout the full app lifecycle (startup, automation, error, second-instance, file dialogs, capture, input injection, end-session), the main window satisfies: `isVisible() === false`, `isFocused() === false`, `isMinimized() === false`, and the app never moves the OS cursor or flashes the taskbar.
- [ ] In background mode, the app produces zero native attention surfaces: no `Notification` toasts, no message-box dialogs, no `flashFrame`, no system sounds, no `dock.bounce`. A static-grep test forbids these calls behind the background flag.
- [ ] Single-instance lock in background mode: a second launch attempt logs the event and exits without raising or focusing the running instance.
- [ ] An end-to-end LLM session can perform: open character -> getRendererUIState -> saveCharacter (one field changed) -> getRendererUIState (verify update) -> automationCaptureToFile, with no foregrounding or focus steal.
- [ ] An end-to-end LLM session can perform: open character -> clickElement (sheet field) -> typeText -> injectKey (Tab) -> automationCaptureToFile, with no foregrounding or focus steal.
- [ ] `automationManual.js` `commands` arrays match `getAutomationCommandMap()` for every group; aspirational commands are removed or moved to a `roadmap` field; `MANUAL_VERSION` is bumped to `2026-05-06.wp-0099`.
- [ ] `automationGetManual` returns the new manual in `index`, `json`, and `markdown` formats. Each format includes Bootstrap, Stealth Contract, Capture, Safety Rules, Decision Table, and Worked Example sections; `json`/`markdown` include per-command parameter schema, return shape, and an example call.
- [ ] An in-app Help surface (drawer or page reachable from the menu drawer) renders the markdown manual fetched via IPC. The same content the LLM sees is what the operator sees.
- [ ] `AGENTS.md`, `CKC_GOV/PROJECT_CODEX.md`, and `ckcstart.cmd` state the canonical LLM operator manual lives in-app and is fetched via `window.ckc.automationGetManual`. No external markdown manual file is created in governance.
- [ ] `npm test` and `npx tsc --noEmit` pass in `CKC_main`.
- [ ] Spec bumped to `v00.065`; previous `v00.064` archived.
- [ ] No file or folder names with spaces are introduced.
- [ ] `npm run package:win` produces a tagged Windows release; the new automation commands are exercised against the packaged installer/portable build and produce the same results as in dev mode.

## Test plan
- [ ] Unit: each new backend command - happy path + invalid params + missing-id error.
- [ ] Unit: `getRendererUIState` shape with at least one populated sheet field.
- [ ] Unit: `automationManual.js` self-consistency check (every listed command exists in the map).
- [ ] Unit: input-injection module imports neither `robotjs`, `nut.js`, `node-key-sender`, nor any FFI/native input library; assertion via static grep over implementation files.
- [ ] Unit: input-injection helpers route through `mainWindow.webContents.sendInputEvent` (or renderer DOM `dispatchEvent`); a stub of `webContents.sendInputEvent` records calls and tests assert exclusive use.
- [ ] Smoke (manual, Electron, dev mode): launch with `CKC_AUTOMATION_BACKGROUND=1`, fetch state and manual, create session, edit a character field via `saveCharacter`, capture PNG, end session. Verify capture file appears under `CKC_GOV/targets/CKC/automation_captures/`.
- [ ] Smoke (manual, Electron, dev mode): with a non-CKC window focused (e.g. a text editor), run an `injectKey`/`typeText` sequence into CKC and verify (a) the text editor receives no input, (b) the operator's foreground window does not change, (c) the CKC window stays hidden if started with `CKC_AUTOMATION_BACKGROUND=1`.
- [ ] Stealth smoke (manual, Electron, background mode): launch with `CKC_AUTOMATION_BACKGROUND=1` while the operator works in another app (browser/text editor/IDE focused). Run a 60-second mixed sequence (`getRendererUIState`, `openCharacter`, `clickElement`, `typeText`, `saveCharacter`, `automationCaptureToFile`). Verify zero visible flicker, zero taskbar flash, zero focus change, zero cursor movement, zero notification, and the operator's keystrokes/clicks all reach the foreground app.
- [ ] Stealth smoke (manual): trigger a crash path (e.g. invalid command, missing characterId) in background mode and verify no popup, no dialog, no foregrounding — only a log entry.
- [ ] Stealth smoke (manual): attempt a second launch (`castkit-codex.exe`) in background mode and verify the second process exits quietly without raising the first instance.
- [ ] Smoke (manual, packaged): run the same two smoke flows against the installer/portable build produced by `npm run package:win`; results must match dev mode.
- [ ] Visual debugger: confirm window stays hidden and unfocusable during all background-mode smoke runs.

## Governance checklist
- [ ] Task Board updated with this WP at status `IN_PROGRESS`, then `DONE` after validation.
- [ ] Spec bumped (`v00.064` -> `v00.065`); old version archived to `spec/archive_spec/`.
- [ ] No generated file or folder names with spaces.
- [ ] Planning-checkpoint commit (WP + Task Board) pushed before any code in `CKC_main/` is changed.
- [ ] Shipping-checkpoint commit (code + Task Board + spec) pushed after implementation.
- [ ] NAS mirror backup script run after the shipping commit.

## Implementation notes
- Files expected to change:
  - `CKC_main/app/main.js` - extend `getAutomationCommandMap()`, add backend and renderer-input command dispatch arms in the `automationRunCommand` IPC handler, add `webContents.sendInputEvent` helper.
  - `CKC_main/src/ui/App.tsx` - add `getRendererUIState`, `clickElement`, `typeText` arms in the automation command effect; expose current sheet field values via the existing sheet-editor state lifted to App or via a context query.
  - `CKC_main/app/preload.js` and `CKC_main/src/vite-env.d.ts` - typings for any new direct preload methods (most new commands run through `automationRunCommand`, so preload changes should be minimal).
  - `CKC_main/app/backend/automationManual.js` - rewrite to be the canonical LLM reference: per-command schema/return/example, Bootstrap, Stealth Contract, Capture, Safety Rules, Decision Table, Worked Example sections; add input-injection group; bump `MANUAL_VERSION` to `2026-05-06.wp-0099`.
  - `CKC_main/src/ui/` - new in-app Help drawer/page that fetches and renders the manual via IPC; reachable from the existing menu drawer.
  - `CKC_main/test/` - new tests `backend_automation_character_commands.test.js`, `automation_manual_consistency.test.js`, `automation_input_injection_invariants.test.js`, `automation_background_stealth_invariants.test.js`.
  - `AGENTS.md`, `CKC_GOV/PROJECT_CODEX.md`, `ckcstart.cmd` - point at the in-app manual as the canonical LLM reference (fetch via `window.ckc.automationGetManual`); clarify that window-scoped synthetic input via Electron `webContents.sendInputEvent` is allowed and OS-level input is forbidden. No external markdown manual is created in governance.
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.065.md` - new spec; `v00.064` archived.
- Backend command implementations should call existing library/character/template handlers in `CKC_main/app/backend/library.js`, `templates.js`, and `tags.js` rather than duplicating logic. The automation channel is a thin wrapper.
- Renderer state for `getRendererUIState` should be read-only; do not mutate React state when an LLM queries.
- Input-injection commands route only through `mainWindow.webContents.sendInputEvent` (`keyDown`/`keyUp`/`char`/`mouseDown`/`mouseUp`/`mouseMove`) and renderer-side `element.dispatchEvent` for `clickElement`. They must not call `mainWindow.show()`, `focus()`, `setAlwaysOnTop()`, or any OS input library. `typeText` is a thin loop over `injectKey` `char` events.
- Lease guidance: agents must `automationAcquireLease("renderer-navigation")` before any navigation command and `automationAcquireLease("renderer-input")` before any synthetic-input command; tests should not depend on lease state but the manual must require it.
- `softDeleteCharacters` and `restoreCharacters` operate on existing trash semantics from WP-0090 - do not reimplement; just expose.
- Packaging: keep dev-mode entry points (`npm run dev`, `npm run electron:dev`) untouched. Use `npm run package:win` (the default that bumps version, tags, packages, and pushes) so the GitHub Release workflow attaches the installer + portable. Do not commit any `.exe` artifacts.

## Risks / mitigations
- Risk: surfacing `saveCharacter` lets a buggy or hostile LLM scribble over a character sheet without confirmation.
  - Mitigation: keep template integrity invariants in the backend handler (no Field ID drops, no reordering, no silent rewrites of user bytes); session/lease and command log already record who did what; document a non-destructive review pattern (`getRendererUIState` -> propose diff -> `saveCharacter`) in the operator manual.
- Risk: `getRendererUIState` exposes more state than UI consumers expect, leaking internal flags.
  - Mitigation: explicit allow-list of fields in the implementation; tests pin the shape.
- Risk: synthetic input steals operator focus or affects another window.
  - Mitigation: route exclusively through `mainWindow.webContents.sendInputEvent` (window-scoped, not OS-level); never call `show()`/`focus()`/`setAlwaysOnTop()` from inject paths; static-grep test forbids OS-level input libraries; manual smoke verifies a non-CKC focused window receives no input.
- Risk: input injection accidentally raises the hidden window in background mode.
  - Mitigation: explicit test that injection succeeds with `paintWhenInitiallyHidden: true` and the window remains hidden + unfocusable afterward (`isVisible() === false`, `isFocused() === false`).
- Risk: a non-automation code path (error handler, dialog, second-instance, update prompt) calls `show()` / `focus()` / `flashFrame()` and breaks stealth.
  - Mitigation: introduce a single `assertBackgroundSafe(callsiteName)` guard that wraps every visibility-changing call in `main.js`; in background mode it logs and no-ops, in operator mode it passes through. Static-grep test forbids direct `mainWindow.show()` etc. outside the guard.
- Risk: `globalShortcut.register` in some code path captures real keystrokes in background mode.
  - Mitigation: forbid `globalShortcut.register` while background mode is on (assert in startup); document this as part of the stealth contract.
- Risk: manual reconciliation removes a command that something else depends on.
  - Mitigation: the manual is documentation-only; nothing imports the `commands` arrays at runtime; sweep with grep before deleting.
- Risk: spec bump without code-truth check repeats the original `automationManual.js` drift problem.
  - Mitigation: add the `automation_manual_consistency.test.js` self-check so future drift fails CI.
- Risk: packaged build behaves differently from dev mode (asar paths, capture dir resolution, env vars).
  - Mitigation: explicit packaged-build smoke is part of acceptance; capture dir already has packaged-vs-dev fallback in `getAutomationCaptureDir()`.

## Rollback
- Revert the WP commit. The new commands are additive in `getAutomationCommandMap()` and in dispatch arms; existing automation calls keep working. The cold-start manual is a single new file under `CKC_GOV/references/`. The spec archive is append-only, so the previous spec stays available.
