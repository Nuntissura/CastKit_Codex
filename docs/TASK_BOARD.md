# CKC — Task Board

Last updated: 2026-02-10

This is the single source of truth for work status.

This file is mirrored into the git repo for visibility:
- Mirror: `K:\CastKit Codex\CKC_main\docs\TASK_BOARD.md`

## Status legend
- `BACKLOG` — not started
- `IN_PROGRESS` — actively being worked on
- `BLOCKED` — waiting on external input
- `DONE` — completed + verified

## Work packets
| ID | Title | Status | Owner | Notes |
|---|---|---|---|---|
| WP-0001 | Rebuild `CKC_main` source repo on K: | IN_PROGRESS | Codex | `npm test` passes; packaging outputs to `CKC_GOV/targets/CKC/artifacts`; repo stays clean (no `dist/`). |
| WP-0002 | Bring spec up to date (v00.019+) | DONE | Codex | `v00.019` created + mirrored into `CKC_main/docs/`; `v00.004` archived in `spec/archive_spec/`. |
| WP-0003 | Portfolio layout + drawers + minimal UI | IN_PROGRESS | Codex | Two-panel default, 3-panel docs mode, menu/library drawers, hidden command bars. |
| WP-0004 | Ratings (0–5) assign + filter ops + slideshow | IN_PROGRESS | Codex | Hotkeys + star UI; operator filters; fullscreen + slideshow; needs manual smoke verification. |
| WP-0005 | Notes/Stories/Moodboard libraries + smart tags | IN_PROGRESS | Codex | DB-first doc tables + CRUD + UI baseline + moodboard canvas; smart tags + advanced tools still pending. |
| WP-0006 | Exports: empty template + LLM-friendly + custom field selection | IN_PROGRESS | Codex | Frontpage export UI + folder picker; canonical bytes export; LLM-friendly presets via spin-offs. |
| WP-0007 | Thumbnails: full image (no crop), horizontal scroll, sizing | BACKLOG | Codex | Larger thumbs, mousewheel scroll, toggle visibility for more image surface. |
| WP-0008 | Build pipeline: external targets + clean repo | BACKLOG | Codex | Electron-builder output to `CKC_GOV/targets/CKC/artifacts`. |
| WP-0009 | Workflow gates + spec archiving + backup docs | DONE | Codex | WP-first, spec updates + archive, commit/push gates, backup scripts documented. |
| WP-0010 | Record open-question decisions | DONE | Codex | Captured rating hotkeys (RAlt+1..5), DB-first docs storage, and tentative `isFrontpage` rule in spec v00.020. |
| WP-0011 | Rating hotkeys (RAlt+1..5) | DONE | Codex | Added global keybind in MediaPane to set rating on the selected image; ignores keybinds while typing in inputs. |
| WP-0012 | Character icons + focus framing | IN_PROGRESS | Codex | Pick icon from character images; store focusX/focusY; show icons in Library list/grid. |
| WP-0013 | New dev onboarding + governance mirrors + NAS backup usage | DONE | Codex | Added `CKC_main/docs/PROJECT_CODEX.md` + `TASK_BOARD.md` mirrors; updated README/workflow with commit/push + backup commands. |

## Current focus
- Next: WP-0003 / WP-0004 / WP-0005 (manual smoke + tighten UX)

