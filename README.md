# CastKit Codex (CKC)

This repository contains:
- `CKC_main/` — application source (Electron + React + SQLite)
- `CKC_GOV/` — governance (spec, task board, work packets, templates, backup scripts)

Notes:
- Build outputs/caches live under `CKC_GOV/targets/` and are ignored (never commit).
- Local Windows packaging runs from `CKC_main/` and writes versioned artifacts under `CKC_GOV/targets/CKC/artifacts/`.

## Start here (order matters)
1. `CKC_GOV/PROJECT_CODEX.md`
2. `CKC_GOV/taskboard/TASK_BOARD.md`
3. `CKC_GOV/spec/CastKit_Codex_Spec_v00.060.md`
4. `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`

## Dev (Windows)
```powershell
cd CKC_main
npm install
npm run electron:dev
```

## Package (Windows)
```powershell
cd CKC_main
npm run package:win
```

This is the default: it bumps patch version, commits, tags `vX.Y.Z`, packages, and pushes commit+tag.

Packaging-only (no version bump/tag/push):
```powershell
cd CKC_main
npm run package:win:raw
```

## Release (Windows)
Push a SemVer tag (`vX.Y.Z`) on `main` to trigger `.github/workflows/release-win.yml` (GitHub Release assets).

## Backup (NAS mirror)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File CKC_GOV\\scripts\\backup_to_mir.ps1
```
Notes:
- Uses the active CKC `libraryRoot` from `%APPDATA%\\castkit-codex\\ckc-config.json` when available; warns if it cannot resolve it.
- Scheduled task runs hidden (no focus-stealing window).
