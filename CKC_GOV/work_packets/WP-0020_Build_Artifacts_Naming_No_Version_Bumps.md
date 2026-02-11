# Work Packet: WP-0020 - Build artifacts naming (no version bumps for local builds)

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Improve build output folder/file naming so builds are easy to identify and trace back to code.

Note: policy was updated after this WP — **distributable builds now bump SemVer and are tagged**. See `CKC_GOV/PROJECT_CODEX.md`.

## Scope
- Packaging-only (`npm run package:win:raw`) produces:
  - a readable per-build folder name
  - `.exe` filenames include SemVer (dev builds rely on the folder `buildId` for uniqueness)
  - stable metadata files (`LATEST_BUILD.txt`, `manifest.json`, `SHA256SUMS.txt`)
- Clear docs in Project Codex describing dev vs release builds.

## Out of scope
- Auto-updaters/code-signing.
- Reworking release automation beyond making paths compatible.

## Changes
- `CKC_main/scripts/package_win.ps1`:
  - Dev/debug builds go under `CKC_GOV/targets/CKC/artifacts/dev/<buildId>/` (buildId includes timestamp + git SHA).
  - Release builds (tagged `vX.Y.Z`) go under `.../artifacts/releases/vX.Y.Z/`.
  - Docs updated in Project Codex + README.

- `CKC_main/scripts/release.ps1` + `npm run package:win`:
  - `npm run package:win` bumps patch version, commits, tags `vX.Y.Z`, packages, and pushes commit+tag (so builds are traceable and “higher version = newer”).

## Acceptance criteria
- [x] Multiple local builds with the same SemVer do not overwrite each other and are distinguishable by output folder.
- [x] `LATEST_BUILD.txt` points to the latest build folder (relative path).
- [x] `manifest.json` + `SHA256SUMS.txt` exist per build.

## Test plan
- [ ] Run `npm run package:win:raw` twice and confirm unique folders + filenames (manual).
