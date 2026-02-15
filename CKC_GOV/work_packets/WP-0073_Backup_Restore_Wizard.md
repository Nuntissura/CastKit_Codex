# Work Packet: WP-0073 — Backup/restore wizard

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add a guided backup/restore UX for a CKC libraryRoot (snapshot + restore), with manifests and checksums.

## Why
- High stakes data deserves one-click safety nets.
- Portable libraries need easy “pack up and move” flows.
- Spec: `CastKit_Codex_Spec_v00.050.md` §11.20.

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
- [x] Backups and restores use only user-selected folders or `<libraryRoot>` defaults (never `D:`).
- [x] Restore validates integrity before writing.
- [x] Progress + clear errors on failure.

## Test plan
- [x] Manual: create backup, restore to a new folder, open CKC pointing at restored library.

## Notes
- Do NOT touch `D:`.
