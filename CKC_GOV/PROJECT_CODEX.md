# CastKit Codex (CKC) — Project Codex & Workflow

This folder (`CKC_GOV`) is the **governance + tracking + build targets** home for CKC.

This GitHub repo tracks BOTH:
- `CKC_main/` — source code
- `CKC_GOV/` — governance (**except** `CKC_GOV/targets/` which is ignored)

This file is mirrored for convenience:
- Mirror: `CKC_main/docs/PROJECT_CODEX.md`

`<CKC_ROOT>` = the folder containing both `CKC_main` and `CKC_GOV` as siblings.

## New developer: start here

Read these first (order matters):
1. Project Codex (this file): `<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md`
2. Task board (status): `<CKC_ROOT>\\CKC_GOV\\taskboard\\TASK_BOARD.md`
3. Current spec (requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\CastKit_Codex_Spec_v00.023.md`
4. Session dump (verbatim requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\SESSION_DUMP_2026-02-10.md`

If you are reading these in PowerShell and you see garbage like `â€”`, open with UTF-8:
```powershell
Get-Content -Encoding utf8 "<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md"
```

Daily workflow (MUST):
1. Pick/create a Work Packet in `CKC_GOV/work_packets/` and add/update its row in `CKC_GOV/taskboard/TASK_BOARD.md`.
2. Keep `CKC_main` clean before starting new coding (`git status` clean).
3. Implement the WP (keep scope tight).
4. Verify locally (`npm test`, `npx tsc --noEmit`, and build/package as relevant).
5. Update Task Board + Spec (spec version bump + archive) and mirror spec into `CKC_main/docs/`.
6. Commit + push (`origin/main`). Commit messages include the WP id (`WP-xxxx: ...`).
7. Run the NAS mirror backup script.

## Golden rules
- Never touch `D:` during recovery. All CKC work happens under `<CKC_ROOT>`.
- No censorship: never redact/rewrite user text.
- Template integrity: never drop Field IDs; preserve template order.
- UI: minimal by default; sharp corners.
- Build artifacts must NOT be committed to git (they live under `CKC_GOV/targets/` and are ignored).
- Workflow: create a Work Packet **before** coding; update Task Board + Spec; then commit + push.

## Folder map
### 1) Source repo (code)
Path: `<CKC_ROOT>\\CKC_main`

Expected structure:
- `app/` — Electron main process + backend (SQLite, exports, IPC)
- `src/` — React renderer (UI)
- `scripts/` — build/packaging helpers
- `docs/` — in-repo docs that must ship with code

### 2) Governance repo (this folder)
Path: `<CKC_ROOT>\\CKC_GOV`

- `spec/`
- `CastKit_Codex_Spec_v00.023.md` — current spec (update with every addition)
  - `SESSION_DUMP_2026-02-10.md` — latest-iteration requirements (truth)
  - `archive_spec/` — older spec versions (append-only archive)
- `templates/`
  - `character sheet templates/CHARACTER_SHEET__v2.00.txt` — **canonical** template bytes
- `taskboard/`
  - `TASK_BOARD.md` — the single source of truth for work status
- `work_packets/`
  - `WP-*.md` — scoped work packets (what/why/how/acceptance)
- `scripts/`
  - `backup_to_mir.ps1` — mirror `<CKC_ROOT>` to NAS (ROBOCOPY `/MIR`)
  - `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)
- `targets/`
  - `CKC/artifacts/` — build outputs (**not** stored in git)
    - `CKC/artifacts/dev/` — local builds (version auto-includes timestamp+git SHA, so builds are easy to tell apart)
    - `CKC/artifacts/releases/` — release builds (tagged `vX.Y.Z` on `main`)
  - `CKC/logs/` — build logs
  - `cache/` — npm/electron caches (keep C: clean)
  - `scratch/` — temporary experiments
- `fail_log/`
  - `FAIL_LOG.md` — failure/incident log (append-only)

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

### Versioning + release policy (MUST)
- **Release version** = SemVer (`vX.Y.Z`) for official releases (release builds take the version from the git tag).
- **Local builds** must NOT require manual version bumps: `npm run package:win` auto-generates a SemVer prerelease version like `0.2.0-dev.20260211.120940.ee3bc03` so you can always tell which build is newer.
- Local builds go to `CKC_GOV/targets/CKC/artifacts/dev/v<localVersion>/`.
- Official release builds are tied to a git tag (`vX.Y.Z`) on `main` and published as GitHub Release assets (immutable, off-machine backup). Local release builds go under `CKC_GOV/targets/CKC/artifacts/releases/vX.Y.Z/<buildId>/`.
- Keep per-build checksums/manifest (`manifest.json` + `SHA256SUMS.txt`), and keep `LATEST_BUILD.txt` updated.

### Packaging (Windows)
Build a portable `.exe` and NSIS installer `.exe` using:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm run package:win
```

This writes versioned outputs under:
- Local: `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\dev\\v<localVersion>\\`
- Release (tagged): `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\releases\\vX.Y.Z\\<buildId>\\`

### Publishing a GitHub Release (recommended)
Do **not** commit `.exe` artifacts into `CKC_main` git history. Instead, publish them as a GitHub Release.

There is a workflow in the repo that builds Windows artifacts on tag push:
- `.github/workflows/release-win.yml` (triggers on tags like `v1.2.3`)

Recommended flow:
```powershell
cd "<CKC_ROOT>\\CKC_main"
git tag vX.Y.Z
git push origin vX.Y.Z
```
The tag triggers GitHub Actions to attach the installer + portable `.exe` to the GitHub Release.

Optional automation (does bump + commit + tag for you):
```powershell
cd "<CKC_ROOT>\\CKC_main"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Bump patch
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
cd "<CKC_ROOT>\\CKC_main"
npm test
npx tsc --noEmit
git status
git add -A
git commit -m "WP-xxxx: short description"
git push origin main
```

### Spec maintenance
- The **current spec** lives in `CKC_GOV/spec/` and must be mirrored to `CKC_main/docs/`.
- With every new addition/change, update the current spec.
- When a new spec version is created, move the previous version into `CKC_GOV/spec/archive_spec/` (archive is append-only).

### Fail log
- Any significant failure (tooling mistake, destructive command, data loss risk, etc.) is recorded in `fail_log/FAIL_LOG.md`.
- Include: date/time, what happened, root cause, and mitigation.

## Backup to NAS (mirror)

Scripts live in `CKC_GOV/scripts/`:
- `backup_to_mir.ps1` — mirror `<CKC_ROOT>` to NAS (ROBOCOPY `/MIR`)
- `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)

Run a backup now:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\backup_to_mir.ps1"
```

Automate backups (recommended):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\register_backup_task.ps1"
```
This creates a Scheduled Task that runs the mirror backup every 30 minutes while logged in.

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

