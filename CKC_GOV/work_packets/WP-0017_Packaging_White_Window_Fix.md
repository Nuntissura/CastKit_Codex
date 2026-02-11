# Work Packet: WP-0017 — Packaging: fix white window in built .exe

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Fix the packaged Windows app showing a white window by ensuring the renderer build emits relative asset paths compatible with Electron `loadFile` (`file://`).

## Why
The packaged app uses `BrowserWindow.loadFile(...)` to open `dist/index.html`. If Vite emits absolute `/assets/...` paths (default `base: '/'`), those assets fail to load under `file://`, resulting in a blank/white window.

## Scope
### In
- Configure Vite build `base` so packaged builds load correctly.
- Add a packaging guardrail that fails packaging if `dist/index.html` contains `/assets/...` absolute paths.

### Out
- Code signing, auto-updater, or release automation changes.

## Acceptance criteria
- [x] Packaged portable `.exe` and NSIS installer load UI (no white window).
- [x] Packaging fails fast if renderer output references `/assets/...`.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [x] `npm run package:win` and verify `CKC_GOV/targets/CKC/artifacts/LATEST_BUILD.txt` updated.

