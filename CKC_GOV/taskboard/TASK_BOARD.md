# CKC — Task Board

Last updated: 2026-02-11

This is the single source of truth for work status.

This file is mirrored into `CKC_main/docs/` for convenience:
- Mirror: `CKC_main/docs/TASK_BOARD.md`

## Status legend
- `BACKLOG` — not started
- `IN_PROGRESS` — actively being worked on
- `BLOCKED` — waiting on external input
- `DONE` — completed + verified

## Work packets
| ID | Title | Status | Owner | Notes |
|---|---|---|---|---|
| WP-0001 | Rebuild `CKC_main` source repo under `<CKC_ROOT>` | DONE | Codex | `npm test` passes; `npm run dev` + `npm run electron:dev` smoke-verified; packaging outputs to `CKC_GOV/targets/CKC/artifacts`; repo stays clean (no `dist/`). |
| WP-0002 | Bring spec up to date (v00.019+) | DONE | Codex | `v00.019` created + mirrored into `CKC_main/docs/`; `v00.004` archived in `spec/archive_spec/`. |
| WP-0003 | Portfolio layout + drawers + minimal UI | DONE | Codex | Two-panel default, 3-panel docs mode, menu/library drawers, hidden command bars. |
| WP-0004 | Ratings (0–5) assign + filter ops + slideshow | DONE | Codex | Hotkeys + star UI + clear; operator filters; fullscreen + slideshow. |
| WP-0005 | Notes/Stories/Moodboard libraries + smart tags | DONE | Codex | DB-first doc tables + CRUD + UI baseline + moodboard canvas; smart tags + advanced tools deferred. |
| WP-0006 | Exports: empty template + LLM-friendly + custom field selection | DONE | Codex | Frontpage export UI + folder picker; canonical bytes export (unit-tested); LLM-friendly presets via spin-offs (unit-tested). |
| WP-0007 | Thumbnails: full image (no crop), horizontal scroll, sizing | DONE | Codex | MediaPane thumbs: `object-fit: contain`, horizontal + mousewheel scroll, hide/show toggle. |
| WP-0008 | Build pipeline: external targets + clean repo | DONE | Codex | electron-builder outputs to `CKC_GOV/targets/CKC/artifacts`; stages in `CKC_GOV/targets/CKC/stage`; repo stays clean. |
| WP-0009 | Workflow gates + spec archiving + backup docs | DONE | Codex | WP-first, spec updates + archive, commit/push gates, backup scripts documented. |
| WP-0010 | Record open-question decisions | DONE | Codex | Captured rating hotkeys decision, DB-first docs storage, and tentative `isFrontpage` rule in spec v00.020. |
| WP-0011 | Rating hotkeys (LAlt+0..5) | DONE | Codex | Added global keybind in MediaPane to set rating (0–5) on the selected image; ignores keybinds while typing in inputs. |
| WP-0012 | Character icons + focus framing | DONE | Codex | Pick icon from character images; store focusX/focusY; show icons in Library list/grid. |
| WP-0013 | New dev onboarding + governance mirrors + NAS backup usage | DONE | Codex | Added `CKC_main/docs/PROJECT_CODEX.md` + `TASK_BOARD.md` mirrors; updated README/workflow with commit/push + backup commands. |
| WP-0014 | Photo notes + bottom metadata bar | DONE | Codex | Per-image notes UI; tags/notes moved to bottom metadata bar; hotkeys ignore typing. |
| WP-0015 | Moodboard: move/delete images + undo | DONE | Codex | Move tool + selection outline; drag reposition; delete selected; undo stroke/image add. |
| WP-0016 | Smart tags + saved searches UX | DONE | Codex | Saved searches + scope toggles + tag filters in command bar; manual tag editing; tag list/suggestions. |
| WP-0017 | Packaging: fix white window in built .exe | DONE | Codex | Set Vite build base to `./` for `file://`; add packaging guardrail to reject `/assets/...` output. |
| WP-0018 | Theme port from old build (palette + typography) | DONE | Codex | Ported CSS vars + font stacks; added accent glow; sheet Field ID/optional styling aligned to recovered build. |
| WP-0019 | Drive-letter agnostic paths (docs + scripts) | DONE | Codex | Removed hard-coded drive-letter paths from onboarding docs; backup + packaging scripts avoid drive-letter paths in metadata. |
| WP-0020 | Build artifacts naming (no version bumps for local builds) | DONE | Codex | Updated policy: distributable builds bump SemVer + tag. `package:win:raw` outputs dev/debug builds to `artifacts/dev/<buildId>`; tagged releases output to `artifacts/releases/vX.Y.Z/`; `package:win` bumps+tags+packages+pushes. |
| WP-0021 | Monorepo root: track governance with product | DONE | Codex | Git repo root moved to `<CKC_ROOT>` so `CKC_GOV/` is committed alongside `CKC_main/` (while `CKC_GOV/targets/` stays ignored); release workflow runs from `CKC_main/`. |
| WP-0022 | Track `CKC_GOV/user_ilja` in git | DONE | Codex | Removed ignore for `CKC_GOV/user_ilja/` so personal scripts/notes can be versioned with the repo. |
| WP-0023 | Session dump gaps: docs smart tags, character exports, moodboard tools | DONE | Codex | Implemented + unit-tested; manual smoke check recommended (export/import/moodboard). |
| WP-0024 | Spec v00.024: implementation mapping (no governance) | DONE | Codex | Clarify `isCarousel/isFrontpage` representation, document library layout, keep governance out of spec. |
| WP-0025 | LibraryRoot diagnostics + missing media visibility | DONE | Codex | Make active library obvious; report missing images; help users fix “photos don’t load”. |
| WP-0026 | Repair tool: rehydrate missing images by hash | DONE | Codex | Scan recovery folder, match by hash, copy into library layout, regen thumbs, write report. |
| WP-0027 | Backup task: silent + covers libraryRoot | DONE | Codex | No popups; better logs; mirror `libraryRoot` if outside `<CKC_ROOT>`. |
| WP-0028 | Startup: library init concurrency + portable defaults | DONE | Codex | Fix null-DB startup race; portable default `libraryRoot` near `.exe`; prompt if missing. |
| WP-0029 | Resizable panels + persisted layouts (2/3 panel) | BACKLOG | Codex | Splitters; remember 2-panel vs 3-panel widths; persist on restart. |
| WP-0030 | Media panel chrome: filters, thumbs, hotkeys, overlap | DONE | Codex | Header controls (no overlay), arrow nav, bigger thumbs, no-match clear filters, per-thumb carousel toggle, hamburger-safe header inset, rating hotkeys LAlt+0..5. |
| WP-0031 | Docs mode: autosave + drawer search + layout restoration | BACKLOG | Codex | Notes always visible; below show stories/moodboard; autosave; full docs library view + filters. |
| WP-0032 | Sheet editor: free-text enums + reusable per-field presets | BACKLOG | Codex | Enum suggestions + custom text; reuse values per Field ID across characters. |
| WP-0033 | Sheet ingest/merge + diff + selective overwrite + versions UI | BACKLOG | Codex | Paste/import, preview diff, apply selected fields, version list/diff/revert (non-destructive). |

## Current focus
- Current: WP-0029 — resizable panels + persisted layouts (2/3 panel).
