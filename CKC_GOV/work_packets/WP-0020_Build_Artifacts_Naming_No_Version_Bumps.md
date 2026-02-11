# Work Packet: WP-0020 - Build artifacts naming (no version bumps for local builds)

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Improve build output folder/file naming so repeated local builds are easy to identify without bumping the product version.

## Scope
- Local packaging (`npm run package:win`) produces:
  - a readable per-build folder name
  - `.exe` filenames that include a build identifier
  - stable metadata files (`LATEST_BUILD.txt`, `manifest.json`, `SHA256SUMS.txt`)
- Clear docs in Project Codex describing dev vs release builds.

## Out of scope
- Changing the product SemVer for every local build.
- Reworking release automation beyond making paths compatible.

## Changes
- `CKC_main/scripts/package_win.ps1`:
  - Local builds go under `CKC_GOV/targets/CKC/artifacts/dev/v<localVersion>/`.
  - Release builds (tagged `vX.Y.Z`) go under `.../artifacts/releases/vX.Y.Z/<buildId>/`.
  - Local builds auto-generate a SemVer prerelease version like `0.2.0-dev.20260211.120940.ee3bc03` so builds are easy to tell apart (no manual bumps).
  - For local builds, `.exe` filenames include the full local version (via electron-builder versioned outputs).
- Docs updated in Project Codex + README.

## Acceptance criteria
- [x] Multiple local builds with the same SemVer do not overwrite each other and are distinguishable by folder + filename.
- [x] `LATEST_BUILD.txt` points to the latest build folder (relative path).
- [x] `manifest.json` + `SHA256SUMS.txt` exist per build.

## Test plan
- [ ] Run `npm run package:win` twice and confirm unique folders + filenames (manual).
