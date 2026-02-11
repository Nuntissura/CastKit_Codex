# CKC workflow (Work Packets -> Spec -> Git)

This repo is `https://github.com/Nuntissura/CastKit_Codex`.

Repo layout:
- `CKC_main/` — source code
- `CKC_GOV/` — governance (**except** `CKC_GOV/targets/` which is ignored)

On the workstation, governance lives under `<CKC_ROOT>\\CKC_GOV` (Task Board, Work Packets, spec archive, targets/artifacts).

`<CKC_ROOT>` = the folder containing both `CKC_main` and `CKC_GOV` as siblings.

Start here:
- `docs/PROJECT_CODEX.md` (mirrored from `CKC_GOV/PROJECT_CODEX.md`)
- `docs/TASK_BOARD.md` (mirrored from `CKC_GOV/taskboard/TASK_BOARD.md`)
- `docs/CastKit_Codex_Spec_v00.024.md` (mirrored from `CKC_GOV/spec/`)
- `docs/SESSION_DUMP_2026-02-10.md` (verbatim recovered requirements)

## Rules (MUST)

1. **Create a Work Packet before coding**
   - Add a `WP-xxxx` in `CKC_GOV/work_packets/`
   - Add/update the WP row in `CKC_GOV/taskboard/TASK_BOARD.md`

2. **Commit + push before starting new coding**
   - This includes committing/pushing the WP + Task Board update (the plan) so the intended work is on GitHub before you write any code.
   - `git status` must be clean
   - push to origin so GitHub stays current

3. **Update spec with every addition**
   - Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`
   - Mirror into this repo: `docs/CastKit_Codex_Spec_v00.024.md`
   - Session dump (verbatim requirements): `docs/SESSION_DUMP_2026-02-10.md`
   - When bumping spec version, move the previous version into `CKC_GOV/spec/archive_spec/`
   - If the spec summary/decisions ever contradict the session dump, the **session dump wins**.
     - Do **not** rewrite the session dump to “make it fit the code”.
     - Instead: update the spec summary/decisions to be consistent and, if needed, document how a requirement is represented in code (example: a boolean concept implemented as tags).
   - If a WP changes behavior/UX/data model, the WP is not “DONE” until the spec is updated and mirrored (or the WP explicitly states “No spec impact” with rationale).

4. **After a WP is done**
   - Update Task Board + Spec first
   - Then commit + push the code
   - Commit messages include the WP ID (example: `WP-0001: tighten packaging outputs`)

Typical commands:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm test
npx tsc --noEmit
git status
git add -A
git commit -m "WP-xxxx: short description"
git push origin main
```

## Backup (NAS mirror)

Scripts live in `CKC_GOV/scripts/`:
- `backup_to_mir.ps1` (ROBOCOPY `/MIR`)
- `register_backup_task.ps1` (scheduled task helper)

Run a backup now:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "..\\CKC_GOV\\scripts\\backup_to_mir.ps1"
```

Note: if PowerShell shows `â€”`/`â€¦` garbage when viewing docs, use UTF-8:
```powershell
Get-Content -Encoding utf8 .\\docs\\WORKFLOW.md
```
