# CKC workflow (Work Packets → Spec → Git)

This repo is `https://github.com/Nuntissura/CastKit_Codex`.

On the workstation, governance lives under `K:\CastKit Codex\CKC_GOV` (Task Board, Work Packets, spec archive, targets/artifacts).

## Rules (MUST)

1. **Create a Work Packet before coding**
   - Add a `WP-xxxx` in `CKC_GOV/work_packets/`
   - Add/update the WP row in `CKC_GOV/taskboard/TASK_BOARD.md`

2. **Commit + push before starting new coding**
   - `git status` must be clean
   - push to origin so GitHub stays current

3. **Update spec with every addition**
   - Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.019.md`
   - Mirror into this repo: `docs/CastKit_Codex_Spec_v00.019.md`
   - When bumping spec version, move the previous version into `CKC_GOV/spec/archive_spec/`

4. **After a WP is done**
   - Update Task Board + Spec first
   - Then commit + push the code
   - Commit messages include the WP ID (example: `WP-0001: tighten packaging outputs`)

## Backup (NAS mirror)

Scripts live in `CKC_GOV/scripts/`:
- `backup_to_mir.ps1` (ROBOCOPY `/MIR`)
- `register_backup_task.ps1` (scheduled task helper)

