# CastKit Codex (CKC)

Source repo: `<CKC_ROOT>\\CKC_main`  
Governance / artifacts: `<CKC_ROOT>\\CKC_GOV`

`<CKC_ROOT>` = the folder containing both `CKC_main` and `CKC_GOV` as siblings.

## Start here (governance + workflow)

Governance lives in `CKC_GOV/` (source of truth). Key files are mirrored into `CKC_main/docs/` for convenience:
- `docs/PROJECT_CODEX.md` (workflow, build targets, backup)
- `docs/WORKFLOW.md` (WP -> Spec -> Git)
- `docs/TASK_BOARD.md` (status)
- `docs/CastKit_Codex_Spec_v00.023.md` (current spec)
- `docs/SESSION_DUMP_2026-02-10.md` (verbatim recovered requirements)

Workflow (MUST):
1. Create/choose a Work Packet (`CKC_GOV/work_packets/WP-xxxx_*.md`) and update `CKC_GOV/taskboard/TASK_BOARD.md`.
2. **Commit + push immediately** (planning checkpoint) so the intended work (WP + Task Board) is safely stored on GitHub before any coding starts.
3. Keep changes scoped to the active WP.
4. Update spec (version bump + archive) and mirror into `CKC_main/docs/`.
5. Run tests, then commit (`WP-xxxx: ...`) and push `origin/main`.
6. Run the NAS mirror backup script.

## Backup (NAS mirror)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "..\\CKC_GOV\\scripts\\backup_to_mir.ps1"
```

## Dev
```powershell
npm install
npm run dev
```

Run the full Electron app (renderer + main process):
```powershell
npm run electron:dev
```

## Build (local)
Build output goes to `..\\CKC_GOV\\targets\\scratch\\renderer-dist`.
```powershell
npm run build
```

## Package (Windows)
Default (recommended) creates a traceable, versioned build:
```powershell
npm run package:win
```

Outputs to:
- `..\\CKC_GOV\\targets\\CKC\\artifacts\\releases\\vX.Y.Z\\`

Packaging-only (no version bump/tag/push) for quick debugging:
```powershell
npm run package:win:raw
```

Outputs to:
- `..\\CKC_GOV\\targets\\CKC\\artifacts\\dev\\<buildId>\\`
