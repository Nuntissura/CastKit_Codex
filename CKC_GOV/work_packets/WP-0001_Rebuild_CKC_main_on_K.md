# Work Packet: WP-0001 — Rebuild `CKC_main` source repo on K:

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Recreate the CKC source repository under `K:\CastKit Codex\CKC_main` using the old packaged app as a baseline for branding/colors and the session dump as truth for latest behavior.

## Why
The original `D:` repo was lost. GitHub repo was empty. We need a clean, rebuildable codebase on `K:` with governance assets in `CKC_GOV`.

## Inputs
- Old packaged app (baseline branding/colors + backend reference):
  - `K:\CastKit Codex\CKC_recovery\CKC_old_install\resources\app.asar`
  - extracted copy: `K:\CastKit Codex\CKC_recovery\asar_extracted_old_20260210\`
- Canonical template bytes:
  - `K:\CastKit Codex\CKC_GOV\templates\character sheet templates\CHARACTER_SHEET__v2.00.txt`
- Latest requirements:
  - `K:\CastKit Codex\CKC_GOV\spec\SESSION_DUMP_2026-02-10.md`

## Scope
### In
- Create a new git repo at `K:\CastKit Codex\CKC_main`.
- Restore minimal Electron + React/Vite project structure.
- Copy `icon.ico` and base CSS variables/colors from old app.
- Ensure build artifacts go to `CKC_GOV/targets/CKC/artifacts`.

### Out
- Full feature parity (that is handled in later WPs).

## Acceptance criteria
- [x] `K:\CastKit Codex\CKC_main` exists and is a valid git repo.
- [x] `npm install` works with caches redirected to `CKC_GOV/targets/cache`.
- [x] `npm test` passes.
- [x] `npm run dev` launches renderer.
- [x] `npm run electron:dev` launches app.
- [x] `npm run electron:build` outputs installer/portable to `K:\CastKit Codex\CKC_GOV\targets\CKC\artifacts`.
- [x] Repo contains no `dist/`, `release/`, `win-unpacked/`, or build output folders.

## Test plan
- [x] Run unit tests.
- [x] Smoke test Electron app launch.

## Implementation notes
- Use old app CSS variables as the starting theme.
- Keep corners sharp (override any rounded radius from legacy CSS).
- Always keep build outputs and caches out of repo.
- Current status: `npm test` passes; `npm run dev` + `npm run electron:dev` smoke-verified; packaging outputs to `CKC_GOV/targets/CKC/artifacts`; repo stays clean (no `dist/`).

## Risks / mitigations
- Risk: old app is bundled (no TS/React source). Mitigation: rebuild from scratch using modern tooling; use old as reference.

## Rollback
- Delete `K:\CastKit Codex\CKC_main` and recreate.

