# CKC — Task Board

Last updated: 2026-02-15

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
| WP-0029 | Resizable panels + persisted layouts (2/3 panel) | DONE | Codex | Splitters + per-mode persistence via config (`layoutLibrary2/layoutCharacter2/layoutCharacter3`); manual smoke recommended. |
| WP-0030 | Media panel chrome: filters, thumbs, hotkeys, overlap | DONE | Codex | Header controls (no overlay), arrow nav, bigger thumbs, no-match clear filters, per-thumb carousel toggle, hamburger-safe header inset, rating hotkeys LAlt+0..5. |
| WP-0031 | Docs mode: autosave + drawer search + layout restoration | DONE | Codex | Autosave + stacked Notes; lower Stories/Moodboard toggle; docs drawer search/tags + “All”; UI state persisted in config. |
| WP-0032 | Sheet editor: free-text enums + reusable per-field presets | DONE | Codex | Enum suggestions + custom text; reuse values per Field ID across characters. |
| WP-0033 | Sheet ingest/merge + diff + selective overwrite + versions UI | DONE | Codex | Paste/import, preview diff, apply selected fields, version list/diff/revert (non-destructive). |
| WP-0034 | Security: remediate `npm audit` HIGH (release builds) | DONE | Codex | Clear HIGH vulnerabilities (esp. `tar`) for prod + stage packaging trees. |
| WP-0035 | Startup: global carousel IPC crash + cold-start library load | DONE | Codex | Renderer waits for `ckc:initialize` before rendering; DB helpers throw `CKC_DB_NOT_READY` instead of `TypeError`; regression test added. |
| WP-0036 | Backup task: no popups (background) + easy enable/disable | DONE | Codex | Add `unregister_backup_task.ps1` (+ docs) to disable/enable/remove the scheduled task. |
| WP-0037 | Character ID: fixed format rule + migration strategy | DONE | Codex | Implement human-friendly public Character ID + safe migration (no folder renames by default). |
| WP-0038 | Docs mode middle pane polish | DONE | Codex | Clean up Notes + Stories/Moodboard middle panel layout (no behavior change). |
| WP-0039 | Local model integration spike (experimental) | DONE | Codex | Add minimal local LLM plumbing (OpenAI-compatible HTTP) + Tools UI to test prompts. |
| WP-0040 | Screenshot reference folder | DONE | Codex | Add `CKC_GOV/references/screenshots/` drop zone (ignored by default) + `keep/` for committed assets. |
| WP-0041 | Local model timeout configurable | DONE | Codex | Increase local-model timeout and allow configuring `llm.timeoutSec`. |
| WP-0042 | Docs mode middle pane layout fix | DONE | Codex | Fix docs middle pane header wrap + prevent tiny/overlapping controls at narrow widths. |
| WP-0043 | Reusable fail log system + UI style guide | DONE | Codex | Make mistakes + UI patterns repeatable across projects (CKC + Handshake). |
| WP-0044 | Portable data root + folder settings | DONE | Codex | Default data near portable exe; easy UI reset/change; avoid D: by accident. |
| WP-0045 | Photo mode metadata panel + image dropzone | DONE | Codex | Auto-show per-image meta in photo mode; group controls; drag-drop import near header. |
| WP-0046 | Character ID UX + spec sync | DONE | Codex | Copyable Character ID chip; enforce `CHAR-ID-001`; spec bumped to v00.035. |
| WP-0047 | Carousel slideshow behavior | DONE | Codex | Carousel auto-advances in normal viewer with a Slideshow toggle; pauses while Controls is open; spec bumped to v00.036. |
| WP-0048 | Moodboard layers | DONE | Codex | Layers panel; reorder/hide/lock images; ink layer hide/lock. |
| WP-0049 | Moodboard transform tool (resize/rotate) | DONE | Codex | Resize handles + modifiers (Shift/Alt); rotation deferred. |
| WP-0050 | Moodboard undo/redo history | DONE | Codex | Undo/redo stack + hotkeys; coalesced gestures. |
| WP-0051 | Moodboard text / sticky notes | DONE | Codex | Add text items; edit + move/resize; basic styling panel. |
| WP-0052 | Moodboard gradient tool upgrade | DONE | Codex | Drag-to-set direction + live preview; radial mode option. |
| WP-0053 | Moodboard zoom/pan + grid/snap | DONE | Codex | Zoom/pan navigation; grid overlay + snap-to-grid for move/transform. |
| WP-0054 | Links + backlinks | DONE | Codex | `[[...]]` links across docs/sheets + backlinks panel; no rewriting. |
| WP-0055 | Inbox / watch-folder import | DONE | Codex | Scan an Inbox folder, ingest screenshots, triage + assign to characters. |
| WP-0056 | Clipboard image paste import | DONE | Codex | Paste clipboard image into Character or Inbox/Library. |
| WP-0057 | Multi-select + batch image metadata | DONE | Codex | Ctrl/Shift multi-select + batch rating/favorite/tags + tag chips/input; backend batch IPC. |
| WP-0058 | Duplicate detection (exact hash) + safe cleanup | DONE | Codex | Group duplicates by hash; remove redundant DB entries safely. |
| WP-0059 | Tag manager | DONE | Codex | Rename/merge tags globally; show counts; pin tags + filter quick toggles. |
| WP-0060 | Pop-out reference window (always-on-top) | DONE | Codex | Separate viewer window synced to selection; always-on-top toggle. |
| WP-0061 | Image annotations / pins (non-destructive) | DONE | Codex | Text pins + simple overlays stored as JSON per image; show/hide. |
| WP-0062 | Stories corkboard / outliner | DONE | Codex | Story cards with drag reorder + links to chars/images. |
| WP-0063 | Export hub (moodboards + image sets + share packs) | DONE | Codex | Central export UI; moodboard PNG; image set export; share packs under `<libraryRoot>/exports/`. |
| WP-0064 | Web import (URL capture) | DONE | Codex | Import from URL; store provenance metadata. |
| WP-0065 | Smart Folders 2.0 (rule-based saved searches) | DONE | Codex | Editable rules + live results. |
| WP-0066 | Color tools (palettes + search) | DONE | Codex | Cache dominant palettes in `ImageAsset.palette_json`; palette chips + color filter UI shipped. |
| WP-0067 | Near-duplicate finder (perceptual) | IN_PROGRESS | Codex | Visually similar scan + safe review. |
| WP-0068 | Reference window power modes | BACKLOG | Codex | Opacity + click-through + hotkeys. |
| WP-0069 | Collections / playlists | BACKLOG | Codex | Curated cross-character image sets + slideshow/export. |
| WP-0070 | Character relationship map | BACKLOG | Codex | Structured edges + graph view. |
| WP-0071 | Moodboard arrange tools | BACKLOG | Codex | Align/distribute/group/tidy (undoable). |
| WP-0072 | Command palette (Ctrl+K) | BACKLOG | Codex | Keyboard-first navigation + actions. |
| WP-0073 | Backup/restore wizard | BACKLOG | Codex | Snapshot + restore with manifest/checksums. |

## Current focus
- Current: WP-0067.
- Next: WP-0068.
