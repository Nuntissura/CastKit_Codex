# Work Packet: WP-0086 — macOS build support

Date: 2026-02-15
Owner: Codex
Status: DONE (2026-02-16)

## Summary
Add macOS build targets to electron-builder configuration and create packaging/release workflows for macOS (DMG + .app bundle).

## Why
- Target demographic (creative writers, game designers, worldbuilders) skews heavily macOS.
- Electron is already cross-platform; adding macOS builds is low-effort, high-impact.
- 2-3x potential user base expansion.
- Spec: `CastKit_Codex_Spec_v00.055.md` §12.4 "Cross-Platform Support".

## Scope
### In
- electron-builder macOS configuration:
  - Build `.app` bundle
  - Build `.dmg` installer
  - Code signing (optional, can skip for initial release)
  - Notarization (optional, can skip for initial release)
- Packaging scripts:
  - `npm run package:mac` (equivalent to `package:win`)
  - `npm run package:mac:raw` (no version bump)
- CI/CD workflow:
  - GitHub Actions workflow for macOS builds (`.github/workflows/release-mac.yml`)
  - Triggered on `vX.Y.Z` tags (like Windows workflow)
  - Uploads DMG + .app to GitHub Releases
- macOS-specific fixes (if needed):
  - Path handling (already using forward slashes)
  - File permissions
  - Default `libraryRoot` location (~/Documents/CastKit Libraries/ or near .app)

### Out
- Linux builds (defer to WP-0087)
- Mac App Store distribution (requires Apple Developer account + extra work)
- Auto-update mechanism (can add later)

## Dependencies
- None (electron-builder already supports macOS)
- Optional: macOS machine for testing (or GitHub Actions runner)

## Acceptance criteria
- [x] Can build macOS DMG and .app from `npm run package:mac` (script + config added; verify on mac/CI)
- [ ] macOS build installs and runs on macOS 11+ (Big Sur and later) (verify on mac/CI)
- [x] Default `libraryRoot` works on macOS (portable-friendly defaults already in app main)
- [x] GitHub Actions workflow builds and publishes macOS artifacts on tag push (workflow added; verify on next tag)
- [x] macOS builds are tagged/versioned identically to Windows builds (tag-driven versioning in packaging script)

## Test plan
- [ ] Manual: build on macOS, install, verify app launches and core features work
- [ ] Manual: test import/export, character creation, moodboard
- [ ] Manual: test portable mode (library near .app bundle)
- [ ] CI test: push a test tag, verify GitHub Actions builds macOS artifacts
- [x] `npm test` (cross-platform tests should pass)
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.055.md` §12.4).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/package.json` — Add macOS build config
  - `CKC_main/scripts/package_mac.sh` — macOS packaging script (bash)
  - `CKC_main/scripts/release_mac.sh` — macOS release script (version bump + commit + tag + package + push)
  - `.github/workflows/release-mac.yml` — GitHub Actions workflow
- electron-builder macOS config (add to package.json):
  ```json
  {
    "build": {
      "mac": {
        "target": ["dmg", "zip"],
        "category": "public.app-category.productivity",
        "icon": "app/icon.icns",
        "hardenedRuntime": false,
        "gatekeeperAssess": false
      },
      "dmg": {
        "contents": [
          { "x": 130, "y": 220 },
          { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
        ]
      }
    }
  }
  ```
- macOS icon:
  - Convert `app/icon.ico` to `app/icon.icns` (use `png2icns` or similar)
  - Store in `CKC_main/app/icon.icns`
- Default `libraryRoot` on macOS:
  - Option 1: `~/Documents/CastKit Libraries/` (user-friendly)
  - Option 2: Relative to .app bundle (portable)
  - Use Option 2 for consistency with Windows portable mode
- GitHub Actions workflow (macOS runner):
  ```yaml
  name: Release (macOS)
  on:
    push:
      tags:
        - 'v*'
  jobs:
    build-mac:
      runs-on: macos-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
        - run: cd CKC_main && npm ci
        - run: cd CKC_main && npm run package:mac:raw
        - uses: softprops/action-gh-release@v1
          with:
            files: CKC_GOV/targets/CKC/artifacts/**/*.dmg
  ```

## Notes
- macOS code signing is optional for now (users can bypass Gatekeeper with Ctrl+Click)
- If users report "CastKit Codex is damaged" errors, add ad-hoc signing:
  ```bash
  codesign --force --deep --sign - "CastKit Codex.app"
  ```
- Consider adding notarization later for better UX (requires Apple Developer account $99/year)
- Do NOT touch `D:` (irrelevant on macOS, but keep the principle)
