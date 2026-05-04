# CastKit Codex (CKC) — Project Codex & Workflow

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
3. Current spec (requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\CastKit_Codex_Spec_v00.063.md`
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
- Naming: do not introduce spaces in file names, folder names, or generated artifact names. Use `_` or `-`.
- Build artifacts must NOT be committed to git (they live under `CKC_GOV/targets/` and are ignored).
- Workflow: create a Work Packet + update Task Board, then **commit + push BEFORE coding starts** (planning checkpoint). After implementation, update Task Board + Spec, then commit + push again (shipping checkpoint).

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
- `CastKit_Codex_Spec_v00.063.md` — current spec (update with every addition)
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
