# CKC — Task Board

Last updated: 2026-02-11

This is the single source of truth for work status.

This file is mirrored into the git repo for visibility:
- Mirror: `CKC_main/docs/TASK_BOARD.md`

## Status legend
- `BACKLOG` — not started
- `IN_PROGRESS` — actively being worked on
- `BLOCKED` — waiting on external input
- `DONE` — completed + verified

## Work packets
| ID | Title | Status | Owner | Notes |
|---|---|---|---|---|
| WP-0001 | Rebuild `CKC_main` source repo on K: | DONE | Codex | `npm test` passes; `npm run dev` + `npm run electron:dev` smoke-verified; packaging outputs to `CKC_GOV/targets/CKC/artifacts`; repo stays clean (no `dist/`). |
| WP-0002 | Bring spec up to date (v00.019+) | DONE | Codex | `v00.019` created + mirrored into `CKC_main/docs/`; `v00.004` archived in `spec/archive_spec/`. |
| WP-0003 | Portfolio layout + drawers + minimal UI | DONE | Codex | Two-panel default, 3-panel docs mode, menu/library drawers, hidden command bars. |
| WP-0004 | Ratings (0–5) assign + filter ops + slideshow | DONE | Codex | Hotkeys + star UI + clear; operator filters; fullscreen + slideshow. |
| WP-0005 | Notes/Stories/Moodboard libraries + smart tags | DONE | Codex | DB-first doc tables + CRUD + UI baseline + moodboard canvas; smart tags + advanced tools deferred. |
| WP-0006 | Exports: empty template + LLM-friendly + custom field selection | DONE | Codex | Frontpage export UI + folder picker; canonical bytes export (unit-tested); LLM-friendly presets via spin-offs (unit-tested). |
| WP-0007 | Thumbnails: full image (no crop), horizontal scroll, sizing | DONE | Codex | MediaPane thumbs: `object-fit: contain`, horizontal + mousewheel scroll, hide/show toggle. |
| WP-0008 | Build pipeline: external targets + clean repo | DONE | Codex | electron-builder outputs to `CKC_GOV/targets/CKC/artifacts`; stages in `CKC_GOV/targets/CKC/stage`; repo stays clean. |
| WP-0009 | Workflow gates + spec archiving + backup docs | DONE | Codex | WP-first, spec updates + archive, commit/push gates, backup scripts documented. |
| WP-0010 | Record open-question decisions | DONE | Codex | Captured rating hotkeys (RAlt+1..5), DB-first docs storage, and tentative `isFrontpage` rule in spec v00.020. |
| WP-0011 | Rating hotkeys (RAlt+1..5) | DONE | Codex | Added global keybind in MediaPane to set rating on the selected image; ignores keybinds while typing in inputs. |
| WP-0012 | Character icons + focus framing | DONE | Codex | Pick icon from character images; store focusX/focusY; show icons in Library list/grid. |
| WP-0013 | New dev onboarding + governance mirrors + NAS backup usage | DONE | Codex | Added `CKC_main/docs/PROJECT_CODEX.md` + `TASK_BOARD.md` mirrors; updated README/workflow with commit/push + backup commands. |
| WP-0014 | Photo notes + bottom metadata bar | DONE | Codex | Per-image notes UI; tags/notes moved to bottom metadata bar; hotkeys ignore typing. |
| WP-0015 | Moodboard: move/delete images + undo | DONE | Codex | Move tool + selection outline; drag reposition; delete selected; undo stroke/image add. |
| WP-0016 | Smart tags + saved searches UX | DONE | Codex | Saved searches + scope toggles + tag filters in command bar; manual tag editing; tag list/suggestions. |
| WP-0017 | Packaging: fix white window in built .exe | DONE | Codex | Set Vite build base to `./` for `file://`; add packaging guardrail to reject `/assets/...` output. |
| WP-0018 | Theme port from old build (palette + typography) | DONE | Codex | Ported CSS vars + font stacks; added accent glow; sheet Field ID/optional styling aligned to recovered build. |
| WP-0019 | Drive-letter agnostic paths (docs + scripts) | DONE | Codex | Removed hard-coded drive-letter paths from onboarding docs; backup + packaging scripts avoid drive-letter paths in metadata. |
| WP-0020 | Build artifacts naming (no version bumps for local builds) | DONE | Codex | Local builds go under `artifacts/dev/v<localVersion>` and `.exe` filenames include the local version; release builds go under `artifacts/releases/vX.Y.Z/<buildId>`. |

## Current focus
- Current: (none) — all listed work packets are DONE.

