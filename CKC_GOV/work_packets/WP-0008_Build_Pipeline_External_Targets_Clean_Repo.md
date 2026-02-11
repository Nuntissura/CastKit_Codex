# Work Packet: WP-0008 — Build pipeline: external targets + clean repo

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Ensure builds/package outputs and caches stay under `CKC_GOV/targets/` so the source repo remains clean and rebuildable.

## Why
Build artifacts must never be committed into the source repo. Packaging should always land in an external, versioned artifacts folder.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Electron-builder output to `CKC_GOV/targets/CKC/artifacts/`.
- Renderer build output redirected to `CKC_GOV/targets/...` (no in-repo `dist/`).
- Packaging stages in `CKC_GOV/targets/CKC/stage/`.

### Out
- CI build pipeline (GitHub Actions) and signing.

## Acceptance criteria
- [x] `npm run electron:build` outputs installer/portable to `<CKC_ROOT>\CKC_GOV\targets\CKC\artifacts`.
- [x] Repo contains no build output folders (`dist/`, `release/`, `win-unpacked/`) after packaging.
- [x] Packaging stages live under `CKC_GOV/targets/CKC/stage/`.

## Test plan
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run electron:build`
- [ ] Manual smoke: run the portable build from `CKC_GOV/targets/CKC/artifacts`.

## Implementation notes
- `electron-builder` `directories.output` points to `../CKC_GOV/targets/CKC/artifacts`.
- Windows packaging wrapper: `CKC_main/scripts/package_win.ps1`.

## Rollback
- Revert packaging config and helper scripts.
