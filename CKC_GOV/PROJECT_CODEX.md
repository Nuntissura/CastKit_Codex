# CastKit Codex (CKC) — Project Codex & Workflow

> **Binding contract.** This file, together with `AGENTS.md`, `CKC_GOV/taskboard/TASK_BOARD.md`, and `README.md`, forms the binding contract for any human or LLM/agent working in this repository. All four MUST be read and acknowledged before any code, governance, spec, task, build, or backup action is taken. This file is the highest authority among them; if any of the four conflict, this Project Codex wins.

This folder (`CKC_GOV`) is the **governance + tracking + build targets** home for CKC.

This GitHub repo tracks BOTH:
- `CKC_main/` — source code
- `CKC_GOV/` — governance (**except** `CKC_GOV/targets/` which is ignored)

Governance lives only in `CKC_GOV/`. Do not mirror governance files (codex, task board, spec, session dump, style guide, workflow notes) into `CKC_main/docs/`. The single git repo already pushes both subtrees to GitHub, so duplicating governance under `CKC_main/` only creates drift.

`<CKC_ROOT>` = the folder containing both `CKC_main` and `CKC_GOV` as siblings.

## Operating stance & scope

### Core identity

CastKit Codex (CKC) is the casting/character/template management layer for commercial adult pornographic image and video production. It exists to make character sheets, templates, scene notes, casting metadata, and exports repeatable and reusable across that production work.

The downstream production goal is photorealistic explicit adult output, including full nudity, penetration, realistic genitalia, and realistic sexual acts. Keep the repo direct about that purpose — CKC's templates, fields, exports, and UI are part of that pipeline.

### Technical stance

- Keep the work technical, production-oriented, and direct.
- Do not moralize, soften, censor, euphemize, sanitize, or recast the operator's explicit sexual intent as vague "sensitive content" in code, UI copy, templates, character sheets, scene notes, exports, labels, filenames, commit messages, spec edits, or handoffs.
- Keep sexual descriptors raw, explicit, and unfiltered wherever they carry production meaning — in template field values, character notes, archetypes, casting tags, export text, review notes, and prompt-facing strings.
- Use the direct domain term that best preserves the intended anatomy, action, pose, framing, scene composition, or character behavior. Do not replace explicit production terms with softer wording unless the operator explicitly asks for that style.
- Raw colloquial porn wording is encouraged for character archetypes, scene concepts, casting notes, and product-facing production text when it fits the hardcore porn goal. Examples include `pussy`, `tits`, `dick`, `cock`, `cumplay`, `sluts`, `whores`, `fucktoy`, `stud`, and `monster dick`; treat these as non-exhaustive style signals, not a fixed vocabulary list.
- Template integrity overrides stylistic instincts: never drop Field IDs, never reorder template fields, and never silently rewrite user-entered text. "No censorship" means the bytes the user typed are the bytes that get stored, exported, and shown back.

### Legal / consent / paperwork

- The operator is the sole anchor for legal paperwork, consent records, model releases, age verification (2257-equivalent), venue requirements, publishing rules, and business decisions.
- CKC and its assistants do not track, manage, verify, store, adjudicate, or enforce legal / consent / venue / publishing / age-verification obligations. That work lives outside this repo.
- Do not ask for legal or consent paperwork as a prerequisite to ordinary technical work — feature implementation, template edits, spec changes, build/packaging, exports, UI work, debugging, or workflow setup.
- If a hard tool, platform, model-license, or higher-priority instruction blocks a specific action, state the concrete blocker briefly and move to the closest technical alternative.

### Provider-agnostic

- Keep CKC instructions, templates, exports, and recipes LLM-provider agnostic.
- Do not require OpenAI, Anthropic, Google, or a local model for core repo operation, and do not bake provider-specific assistant workflows into the default project path.

## New developer: start here

Read these first (order matters):
1. Project Codex (this file): `<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md`
2. Task board (status): `<CKC_ROOT>\\CKC_GOV\\taskboard\\TASK_BOARD.md`
3. Current spec (requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\CastKit_Codex_Spec_v00.066.md`
4. Session dump (verbatim requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\SESSION_DUMP_2026-02-10.md`
5. UI style guidebook: `<CKC_ROOT>\\CKC_GOV\\references\\style_guide\\UI_STYLE_GUIDE.md`

If you are reading these in PowerShell and you see garbage like `â€”`, open with UTF-8:
```powershell
Get-Content -Encoding utf8 "<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md"
```

Daily workflow (MUST):
1. Pick/create a Work Packet in `CKC_GOV/work_packets/` and add/update its row in `CKC_GOV/taskboard/TASK_BOARD.md`.
2. **Commit + push immediately** so the intended work (WP + Task Board) is safely stored on GitHub before any coding starts.
3. Implement the WP (keep scope tight).
4. Verify locally (`npm test`, `npx tsc --noEmit`, and build/package as relevant).
5. Update Task Board + Spec (spec version bump + archive). Governance stays in `CKC_GOV/` only — do not mirror into `CKC_main/docs/`.
6. Commit + push (`origin/main`) again. Commit messages include the WP id (`WP-xxxx: ...`).
7. Run the NAS mirror backup script.

## Golden rules
- Keep CKC work under `<CKC_ROOT>` unless the operator explicitly asks for an external path.
- Operating stance is binding: see "Operating stance & scope" above for the full rules on adult-production scope, no-censorship, legal/paperwork ownership, and provider-agnostic posture. The bullets below are the workflow-safety subset.
- No censorship: never redact, soften, euphemize, or rewrite user-entered text in templates, character sheets, exports, labels, or UI strings.
- Template integrity: never drop Field IDs; preserve template order; preserve user bytes verbatim.
- UI: minimal by default; sharp corners.
- Naming: do not introduce spaces in file names, folder names, generated artifact names, or generated output names. This applies to both product code (`CKC_main/`) and repo governance (`CKC_GOV/`). Use `_` or `-`.
- Build artifacts must NOT be committed to git (they live under `CKC_GOV/targets/` and are ignored).
- Workflow: create a Work Packet + update Task Board, then **commit + push BEFORE coding starts** (planning checkpoint). After implementation, update Task Board + Spec, then commit + push again (shipping checkpoint).
- **Code-truth.** Code is the source of truth. The Task Board, work packets, spec, and in-app manual describe code that exists; they do not authorize code that does not. When a Task Board row, manual entry, or spec section references a code-defined surface (a command, an IPC channel, a field, a schema, a configuration key, a CLI flag), that reference MUST be backed by code — verify against the code before relying on it.
- **Self-consistency tests are required for any doc that catalogs a code-defined surface.** If a markdown file, JSON manual, or generated reference lists commands / IPC names / fields / schemas / config keys, a test in `CKC_main/test/` MUST fail when the doc drifts from the code. The test is the enforcement; reviewers are not. Rule of thumb: if a future change to the code could silently invalidate the doc, you owe the repo a consistency test before merging the doc.

## Identity decoupling
This rule binds every WP that touches storage, exports, packaging, or any CKC-generated artifact.

- The **character sheet is the only CKC artifact that carries identity** — the character's name, distinguishing traits, persona, public Character ID, and any other recognizable identity bytes belong on the sheet and on the sheet alone.
- Every other CKC artifact MUST NOT bake identity into filenames, paths, embedded metadata, captions, or any other surface a stranger could read. Concretely: image files inside `libraryRoot`, image database rows, exports, share packs, web portfolios, moodboard PNGs, backup snapshots, and any auto-generated artifact name — none of these may encode the character's name.
- Images and other media are linked to a character sheet (and to a character sheet **version**) through database relations only. The image-as-bytes carries no identity; the link carries it.
- When importing or generating images, generated filenames inside `libraryRoot` are content/hash-addressed (or sequence-numbered), never `aria_red_dress_001.jpg`. The operator's source filename is preserved in DB metadata if useful but is not the on-disk name.
- Exports and share packs default to anonymized filenames. When identity is wanted in an export, bundle the character sheet in alongside the media; do not name the media after the character.
- This rule does NOT change the operating stance on explicit content. Descriptors, archetypes, casting tags, and free-text notes inside the sheet stay raw, explicit, and unfiltered per "Operating stance & scope" above. The constraint here is on **where identity lives** (one canonical place) and on **structural / generated names** — not on what the operator types into a sheet field.
- Free-text fields (notes, tags, sheet field values) are operator-controlled and never sanitized by CKC. The no-censorship rule applies there.

## Code-truth and documentation consistency
This rule binds every WP and every governance change.

- The wired surface in code is canonical. Manuals, docs, Task Board notes, and spec sections that name commands/IPC channels/fields/schemas/config keys describe what is wired today; they do not describe what is planned, hoped for, or aspirational. Aspirational entries belong in a clearly labeled `roadmap` section, never alongside wired entries.
- For every catalog-style doc (e.g. the in-app LLM manual served by `automationGetManual`), there MUST be a corresponding self-consistency test under `CKC_main/test/` that:
  1. Imports or queries the doc data structure.
  2. Imports the canonical code-side source of truth (e.g. `getAutomationCommandMap()` for automation commands).
  3. Asserts every non-roadmap entry in the doc resolves to a real entry in the code.
  4. Asserts no wired code entry is silently undocumented (or is explicitly marked as undocumented in the doc).
- When adding a new catalog-style doc, the consistency test lands in the same commit. No "we'll add the test later."
- When existing docs drift, the fix is to either (a) wire the code or (b) move the entry to `roadmap` and explain why — never to silently leave the doc lying.
- Memory entries (in the Claude memory system) are informational and decay; they are NEVER authoritative. If memory and code disagree, code wins.

## Folder map
### 1) Source repo (code)
Path: `<CKC_ROOT>\\CKC_main`

Expected structure:
- `app/` — Electron main process + backend (SQLite, exports, IPC)
- `src/` — React renderer (UI)
- `scripts/` — build/packaging helpers

### 2) Governance repo (this folder)
Path: `<CKC_ROOT>\\CKC_GOV`

- `spec/`
- `CastKit_Codex_Spec_v00.066.md` — current spec (update with every addition)
  - `SESSION_DUMP_2026-02-10.md` — latest-iteration requirements (truth)
  - `archive_spec/` — older spec versions (append-only archive)
- `templates/`
  - `character_sheet_templates/CHARACTER_SHEET__v2.00.txt` — **canonical** template bytes
- `taskboard/`
  - `TASK_BOARD.md` — the single source of truth for work status
- `work_packets/`
  - `WP-*.md` — scoped work packets (what/why/how/acceptance)
- `scripts/`
  - `backup_to_mir.ps1` — mirror active CKC `libraryRoot` (fallback: `<CKC_ROOT>`) to NAS (ROBOCOPY `/MIR`)
  - `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)
  - `unregister_backup_task.ps1` — disable/enable/remove the scheduled backup task
  - `postgres_up.ps1` — start local PostgreSQL for CKC via Docker Compose
  - `postgres_down.ps1` — stop the local PostgreSQL container without deleting data
  - `postgres_dump.ps1` — create a PostgreSQL custom-format dump under `CKC_GOV/targets/CKC/postgres_dumps/`
  - `postgres_restore.ps1` — restore a PostgreSQL dump with optional clean restore
- `targets/`
  - `CKC/artifacts/` — build outputs (**not** stored in git)
    - `CKC/artifacts/dev/` — local/debug builds (folder `buildId` includes timestamp+git SHA)
    - `CKC/artifacts/releases/` — release builds (tagged `vX.Y.Z` on `main`)
  - `CKC/logs/` — build logs
  - `cache/` — npm/electron caches (keep C: clean)
  - `scratch/` — temporary experiments
- `fail_log/`
  - `FAIL_LOG.md` — failure/incident log (legacy, append-only narrative)
  - `INDEX.md` — incident index (one incident per file under `incidents/`)

## Build + run conventions (Windows)
### Dependency installation
- Install Node dependencies inside the repo:
  - `<CKC_ROOT>\\CKC_main\\node_modules`

### Cache locations (keep off C:)
Set these env vars before running npm/electron builds:
- `npm_config_cache=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\npm`
- `ELECTRON_CACHE=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\electron`
- `ELECTRON_BUILDER_CACHE=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\electron-builder`

### Output locations (keep artifacts out of repo)
- Electron builder output MUST go to:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts` (use `dev/` or `releases/` subfolders)
- Build logs MUST go to:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\logs`

### Database provider
- Default provider is PostgreSQL:
  - `postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex`
- Local PostgreSQL can be started with:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_up.ps1"
  ```
- If `postgres_up.ps1` reports that the Docker Linux engine pipe is missing, start Docker Desktop first:
  - `C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe`
  - Verify readiness with `docker info` before rerunning `postgres_up.ps1`.
- If another local PostgreSQL service already owns port `5432`, run CKC's Docker PostgreSQL on a repo-specific host port:
  ```powershell
  $env:CKC_POSTGRES_HOST_PORT="55432"
  $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:55432/castkit_codex"
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_up.ps1"
  ```
- CKC config:
  - `ckc-config.json`:
    ```json
    {
      "database": {
        "provider": "postgres",
        "host": "127.0.0.1",
        "port": 5432,
        "database": "castkit_codex",
        "user": "castkit_codex",
        "password": "castkit_codex"
      }
    }
    ```
  - Environment override:
    ```powershell
    $env:CKC_DB_PROVIDER="postgres"
    $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex"
  ```
- PostgreSQL dump:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_dump.ps1" -ConnectionString $env:CKC_POSTGRES_URL
  ```
- PostgreSQL restore:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_restore.ps1" -DumpPath "<dump-file>" -ConnectionString $env:CKC_POSTGRES_URL
  ```
- SQLite is legacy/test fallback only. Do not create migration work unless the operator explicitly says a live SQLite library must be preserved.

### Background LLM automation
- CKC exposes an internal manual and control plane through Electron IPC/preload, not a public network API.
- LLM agents should use:
  - `window.ckc.automationGetManual({ format: "json" })`
  - `window.ckc.automationCreateSession(...)`
  - `window.ckc.automationHeartbeat(...)`
  - `window.ckc.automationAcquireLease(...)`
  - `window.ckc.automationRunCommand(...)`
  - `window.ckc.automationCaptureToFile(...)`
- Start hidden/unfocusable automation mode with:
  ```powershell
  $env:CKC_AUTOMATION_BACKGROUND="1"
  ```
- Capture files are written under:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\automation_captures\\` in repo/dev mode
  - `<libraryRoot>\\automation_captures\\` as packaged/fallback mode
- Automation must not use OS-level keyboard injection, cursor movement, focus stealing, or foregrounding as its normal path.

### Visual debugging requirement
- Visual debugging is available and required when working on the CKC app UI or diagnosing GUI failures.
- Use the Browser Use in-app browser plugin for local browser targets such as `localhost`/`127.0.0.1` whenever that tool is available.
- For Electron-only behavior, use CKC automation captures, Electron/Chrome DevTools Protocol inspection, or screenshots as the fallback visual evidence path.
- Do not rely only on process status, successful builds, or logs for UI-facing work. Verify the rendered app visually and check renderer console/runtime errors before calling app/UI work done.

### Agent must drive the app when testing (binding)
The agent (LLM/operator helper running in the repo) is required to interact with the running CKC app rather than reason about behavior from code alone whenever testing, verifying, or demonstrating a feature, fix, or workflow.

- Launch dev mode with the Chrome DevTools Protocol exposed so the agent can drive the renderer end-to-end. Recommended invocation:
  ```powershell
  cd "<CKC_ROOT>\\CKC_main"
  $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:55432/castkit_codex"
  $env:CKC_DB_PROVIDER="postgres"
  npx vite --port 5173
  # in a second shell, once Vite is ready:
  npx electron . --remote-debugging-port=9222
  ```
- The agent connects to the CDP port (default 9222), evaluates JS in the renderer (`window.ckc.automation*`), captures screenshots via `window.ckc.automationCaptureToFile`, and reads console logs via the CDP `Runtime.consoleAPICalled` event.
- For programmatic verification the agent uses the wired automation surface defined in `CKC_main/app/backend/automationCommandMap.js` (e.g. `automationRunCommand`, `getRendererUIState`, `ingestImageSourcingTask` dry-runs, `addCharacterScript`, etc.) — never assume code works without exercising it.
- For UI verification the agent uses `automationCaptureToFile` (writes PNG + JSON sidecar under `CKC_GOV/targets/CKC/automation_captures/`) and inspects the resulting image. Process status, build success, and unit-test passes are not substitutes for a capture.
- When background-mode invariants are being checked, launch with `CKC_AUTOMATION_BACKGROUND=1`. The captures still work because the renderer paints offscreen.
- Tests that exercise the app (smoke flows, regression checks) should be scripted through the automation surface so they replay deterministically and produce captures the operator can inspect.
- This rule binds every WP that touches the app: it is not an option to skip live verification because tests pass or because the PC is busy. The agent surfaces the constraint and waits if the environment cannot run the live check, but it does NOT silently certify a feature without running it.

### Versioning + release policy (MUST)
- Every **distributable build** must be tied to a git tag (`vX.Y.Z`) on `main` (SemVer), so every build is traceable to code.
- Publish official builds as **GitHub Release assets** (immutable, off-machine backup).
- Local artifacts still land under `CKC_GOV/targets/CKC/artifacts/` for convenience, with per-build checksums/manifest (`manifest.json` + `SHA256SUMS.txt`) and `LATEST_BUILD.txt` updated.

Commands:
- `npm run package:win` — **default**: bumps patch version, commits, tags `vX.Y.Z`, packages, and pushes commit+tag.
- `npm run package:win:raw` — packaging only (no version bump/tag/push). Use for quick local debugging.

### Packaging (Windows)
Build a portable `.exe` and NSIS installer `.exe` using:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm run package:win
```

This writes versioned outputs under:
- Release (tagged): `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\releases\\vX.Y.Z\\`
- Dev/debug (`package:win:raw`): `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\dev\\<buildId>\\`

### Publishing a GitHub Release (recommended)
Do **not** commit `.exe` artifacts into `CKC_main` git history. Instead, publish them as a GitHub Release.

There is a workflow in the repo that builds Windows artifacts on tag push:
- `.github/workflows/release-win.yml` (triggers on tags like `v1.2.3`)

Recommended flow:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm run package:win
```
This bumps patch version, commits, tags `vX.Y.Z`, packages locally, and pushes commit+tag.
The pushed tag triggers GitHub Actions to attach the installer + portable `.exe` to the GitHub Release.

Manual alternative (only if you really want to manage tags yourself):
```powershell
cd "<CKC_ROOT>\\CKC_main"
git tag vX.Y.Z
git push origin vX.Y.Z
npm run package:win:raw
```

## Working process
### Taskboard
- All work is tracked in `taskboard/TASK_BOARD.md`.
- Every change should reference a Work Packet ID (WP-xxxx).

### Work packets
- A Work Packet is a small, shippable slice.
- Each WP must define:
  - scope (in/out)
  - implementation notes
  - acceptance criteria
  - test plan

### Git workflow (CKC_main)
Rules for `https://github.com/Nuntissura/CastKit_Codex`:
- **Before starting any coding**: create a WP + add it to the Task Board, then ensure `CKC_main` is committed + pushed (clean baseline).
- **While coding**: keep changes scoped to the active WP.
- **After the WP is DONE**: update Task Board + update Spec + (if needed) update this Project Codex; then commit + push the code changes.
- Commit messages should include the WP ID (example: `WP-0001: tighten packaging outputs`).

Quick commands (typical):
```powershell
cd "<CKC_ROOT>"
pushd CKC_main
npm test
npx tsc --noEmit
popd
git status
git add -A
git commit -m "WP-xxxx: short description"
git push origin main
```

### Spec maintenance
- The **current spec** lives in `CKC_GOV/spec/` only. Do not mirror it into `CKC_main/docs/`.
- With every new addition/change, update the current spec.
- When a new spec version is created, move the previous version into `CKC_GOV/spec/archive_spec/` (archive is append-only).

### Fail log
- Any significant failure (tooling mistake, destructive command, data loss risk, etc.) is recorded in `fail_log/FAIL_LOG.md`.
- Include: date/time, what happened, root cause, and mitigation.

## Backup to NAS (mirror)

Scripts live in `CKC_GOV/scripts/`:
- `backup_to_mir.ps1` — mirror `<CKC_ROOT>` to NAS (ROBOCOPY `/MIR`) and also mirror the active CKC `libraryRoot` when it is outside `<CKC_ROOT>`
- `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)
- `unregister_backup_task.ps1` — easy toggle for the scheduled task (disable/enable/remove)
Note: the backup script reads the active CKC `libraryRoot` from `%APPDATA%\\castkit-codex\\ckc-config.json` and mirrors it to a separate destination folder (default: `<CKC_BACKUP_DEST>__libraryRoot`, override via `CKC_BACKUP_DEST_LIBRARY`). If `libraryRoot` is configured but missing on disk, the backup exits non-zero to make the risk explicit.

PostgreSQL note: the ROBOCOPY mirror protects the filesystem side (`libraryRoot`, images, exports, templates), but it is not a PostgreSQL database backup. When `database.provider` is `postgres`, run `CKC_GOV/scripts/postgres_dump.ps1` and store the resulting dump with the mirrored backup set.

Run a backup now:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\backup_to_mir.ps1"
```

Automate backups (recommended):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\register_backup_task.ps1"
```
This creates a Scheduled Task that runs the mirror backup every 30 minutes while logged in.
The task runs with a hidden PowerShell window to avoid focus-stealing.
Verify: Task Scheduler -> Task -> Properties -> Actions should include `-WindowStyle Hidden`, and Settings should have "Hidden" enabled.

Disable/enable/remove the Scheduled Task:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1" -Enable
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1" -Delete
```

Backup status/logs:
- `<CKC_ROOT>\\CKC_GOV\\targets\\backup_logs\\LAST_RUN.txt`
- `<CKC_ROOT>\\CKC_GOV\\targets\\backup_logs\\backup_*.log`

Important: the backup uses ROBOCOPY `/MIR` (mirror). Deletions in source can delete in destination.

## Safety guidelines
- Never run destructive commands without:
  - double-checking paths
  - using PowerShell `-LiteralPath`
  - using `-WhatIf` first where possible
- Avoid `cmd` batch loops (`for /d ... rmdir`) for deletes. Prefer PowerShell with explicit, validated paths.
