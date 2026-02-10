# CastKit Codex (CKC)

Source repo: `K:\CastKit Codex\CKC_main`  
Governance / artifacts: `K:\CastKit Codex\CKC_GOV`

## Start here (governance + workflow)

On this workstation, the governance folder (`CKC_GOV`) is the source of truth. Key files are mirrored into this repo under `docs/` so new devs can read them from GitHub:
- `docs/PROJECT_CODEX.md` (workflow, build targets, backup)
- `docs/WORKFLOW.md` (WP -> Spec -> Git)
- `docs/TASK_BOARD.md` (status)
- `docs/CastKit_Codex_Spec_v00.023.md` (current spec)
- `docs/SESSION_DUMP_2026-02-10.md` (verbatim recovered requirements)

Workflow (MUST):
1. Create/choose a Work Packet (`CKC_GOV/work_packets/WP-xxxx_*.md`) and update `CKC_GOV/taskboard/TASK_BOARD.md`.
2. Keep changes scoped to the active WP.
3. Update spec (version bump + archive) and mirror into `CKC_main/docs/`.
4. Run tests, then commit (`WP-xxxx: ...`) and push `origin/main`.
5. Run the NAS mirror backup script.

## Backup (NAS mirror)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "K:\CastKit Codex\CKC_GOV\scripts\backup_to_mir.ps1"
```

## Dev
```powershell
cd "K:\CastKit Codex\CKC_main"
npm install
npm run dev
```

Run the full Electron app (renderer + main process):
```powershell
npm run electron:dev
```

## Build (local)
Build output goes to `K:\CastKit Codex\CKC_GOV\targets\scratch\renderer-dist`.
```powershell
npm run build
```

## Package (Windows)
Outputs to `K:\CastKit Codex\CKC_GOV\targets\CKC\artifacts`.
```powershell
npm run package:win
```

Packaging creates a **versioned** output folder under:
- `K:\CastKit Codex\CKC_GOV\targets\CKC\artifacts\`
