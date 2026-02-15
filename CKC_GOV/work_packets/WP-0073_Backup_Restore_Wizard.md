# Work Packet: WP-0073 — Backup/restore wizard

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Add a guided backup/restore UX for a CKC libraryRoot (snapshot + restore), with manifests and checksums.

## Why
- High stakes data deserves one-click safety nets.
- Portable libraries need easy “pack up and move” flows.
- Spec: `CastKit_Codex_Spec_v00.049.md` §11.20.

## Scope
### In
- Backup wizard:
  - Pick destination folder (default under `<libraryRoot>/exports/backups/`).
  - Create a snapshot folder containing DB + character media + key exports.
  - Write `manifest.json` + `SHA256SUMS.txt`.
- Restore wizard:
  - Pick a backup folder (validate manifest/checksums).
  - Pick destination libraryRoot (create new or overwrite with confirmation).

### Out
- Cloud backup providers.
- Background scheduled backups (tracked separately).

## Acceptance criteria
- [ ] Backups and restores use only user-selected folders or `<libraryRoot>` defaults (never `D:`).
- [ ] Restore validates integrity before writing.
- [ ] Progress + clear errors on failure.

## Test plan
- [ ] Manual: create backup, restore to a new folder, open CKC pointing at restored library.

## Notes
- Do NOT touch `D:`.
