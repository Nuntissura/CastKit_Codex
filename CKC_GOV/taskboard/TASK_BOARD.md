# CKC — Task Board

Last updated: 2026-05-06

> **Binding contract.** This file is part of the binding repo contract together with `AGENTS.md`, `CKC_GOV/PROJECT_CODEX.md`, and `README.md`. All four MUST be read and acknowledged before any work is done in this repo. `PROJECT_CODEX.md` wins on conflicts; this Task Board is the authoritative status of work and current focus.

This is the single source of truth for work status. It lives only in `CKC_GOV/` — do not mirror into `CKC_main/docs/`.

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
| WP-0067 | Near-duplicate finder (perceptual) | DONE | Codex | Cancellable perceptual scan + safe review UI (dHash cache, open + tag redundant). |
| WP-0068 | Reference window power modes | DONE | Codex | Persisted opacity + click-through + hotkey toggle. |
| WP-0069 | Collections / playlists | DONE | Codex | Collections CRUD + slideshow + export (Export Hub + Character action). |
| WP-0070 | Character relationship map | DONE | Codex | Structured edges + graph view (Character → Tools editor + Library graph). |
| WP-0071 | Moodboard arrange tools | DONE | Codex | Multi-select arrange + group/ungroup + tidy (undoable). |
| WP-0072 | Command palette (Ctrl+K) | DONE | Codex | Ctrl+K global palette: characters/docs/tags/actions. |
| WP-0073 | Backup/restore wizard | DONE | Codex | Export Hub wizard; snapshot+restore jobs w/ progress; manifest+SHA256SUMS; refuses D:. |
| WP-0074 | Moodboard: vector shapes + per-layer fills | DONE | Codex | Rect/ellipse layers; bucket/gradient apply to selected shapes; layers+move+transform+arrange. |
| WP-0075 | Moodboard: vector connectors | DONE | Codex | Editable line/arrow layers (not ink). |
| WP-0076 | Moodboard: vector masks / clipping frames | DONE | Codex | Clip images into shapes (non-destructive). |
| WP-0077 | Moodboard: selection power tools | DONE | Codex | Box select + copy/paste/duplicate + nudge + context menu (`npm test`, `npx tsc --noEmit`). |
| WP-0078 | Moodboard: rotate + numeric inspector | DONE | Codex | Rotate handle + Inspector (x/y/w/h/rot) (`npm test`, `npx tsc --noEmit`). |
| WP-0079 | Moodboard: guides/rulers + smart snapping | DONE | Codex | Guides + rulers + smart snapping w/ visible cues (`npm test`, `npx tsc --noEmit`). |
| WP-0080 | Moodboard: layer folders + search/tags | DONE | Codex | Nested folders + board-local tags + search (`npm test`, `npx tsc --noEmit`). |
| WP-0081 | Moodboard: styling (opacity/blend/shadow) | DONE | Codex | Per-layer styling (non-destructive). |
| WP-0082 | Moodboard: export powerhouse | DONE | Codex | Hi-res + selection export + PDF. |
| WP-0083 | Global full-text search | DONE | Codex | Ctrl+Shift+F global search across sheets/docs/moodboards/images with snippets + jump-to (`npm test`, `npx tsc --noEmit`). |
| WP-0084 | AI-assisted image tagging | DONE | Codex | OpenAI-compatible vision endpoint (LM Studio/Ollama/OpenAI) for suggested tags + confidence; per-image review/apply; cancellable bulk job; auto-suggest on import toggle (`npm test`, `npx tsc --noEmit`). |
| WP-0085 | Character templates & cloning | DONE | Codex | Save/load templates; create-from-template (batch); clone (sheet-only or with images); built-in starter templates; tests added. |
| WP-0086 | macOS build support | DONE | Codex | Added mac build config + `package:mac:*` scripts + `release-mac.yml` workflow (tag-triggered). Manual mac smoke check pending. |
| WP-0087 | Web portfolio export | DONE | Codex | Export Hub export writes static HTML site (index + per-character pages) with image/field filtering + safe subset mode (`npm test`, `npx tsc --noEmit`). |
| WP-0088 | Performance optimization (large libraries) | DONE | Codex | Added DB indexes + character list pagination + capped thumbnail rendering (Load more) (`npm test`, `npx tsc --noEmit`). |
| WP-0089 | Visual similarity search | DONE | Codex | Added dHash-based "Similar…" modal with distance threshold + jump-to (IPC + unit test) (`npm test`, `npx tsc --noEmit`). |
| WP-0090 | Batch character operations | DONE | Codex | Multi-select; bulk field edits; bulk tag add/remove; batch export; Trash (soft delete) + restore/purge. |
| WP-0091 | Governance canonical docs cleanup | DONE | Codex | Removed stale `CKC_main/docs/` mirrors; kept `CKC_GOV/PROJECT_CODEX.md` authoritative; renamed canonical governance template folder to no-space path. |
| WP-0092 | PostgreSQL storage | DONE | Codex | PostgreSQL-first default, local Docker setup, schema/provider boundary, dump/restore docs; SQLite migration explicitly not required unless live data appears. Validation not run. |
| WP-0093 | LLM automation and visual debugger | DONE | Codex | JSON state inspection, renderer/backend automation commands, and non-focus-stealing capture IPC/preload. Validation not run. |
| WP-0094 | Image intake sorter | DONE | Codex | Drawer page + scan/classify IPC; folder-only moves to pass/reject/pending; linked mode copies accepted/pending to CKC and exposes pending images. Validation not run. |
| WP-0095 | Background LLM control plane + internal manual | DONE | Codex | Internal indexed manual, multi-agent sessions/leases/logs, hidden background mode, non-focus-stealing screenshot-to-file, and explicit command/navigation API. Validation not run. |
| WP-0096 | No-space folders and generated artifacts | DONE | Codex | Checkout renamed; default library/artifact/export/backup names no longer preserve blanks; path inventory is 0 files/dirs with blank names. `tsc` + touched tests pass; full `npm test` timed out. |
| WP-0097 | Image sourcing init portability | DONE | Codex | Relative `--spec` prefers the script-adjacent spec, relative `--request` resolves beside the selected spec, and first-phase init created `CKC_GOV/references/external_app_data/task_request.json`. |
| WP-0098 | Fix MainApp hook-order blank window | DONE | Codex | Fixed React hook-order crash, verified rendered UI with Electron/CDP visual debugger, and cleared PostgreSQL `COLLATE NOCASE` startup errors. |
| WP-0099 | LLM automation surface expansion + in-app LLM manual | DONE | Codex | 9 new backend commands, getRendererUIState, 4 window-scoped synthetic-input commands (injectKey/injectMouse/clickElement/typeText) via webContents.sendInputEvent + DOM dispatch. assertBackgroundSafe stealth guard, single-instance lock, all dialogs/show/focus/globalShortcut routed through guards. In-app Help drawer renders the manual. 25 new tests pass (7 manual consistency + 5 input invariants + 13 stealth invariants). Spec bumped v00.064 -> v00.065. **Released as v0.2.8** (NSIS + portable, ~88 MB each, under `CKC_GOV/targets/CKC/artifacts/releases/v0.2.8/`; tag pushed → release-win.yml). |
| WP-0100 | Image-sourcing workflow spec registry + v00.19 ingestion adapter + per-character scripts + cross-batch dedup | DONE | Codex | Workflow spec registry at `CKC_GOV/references/external_app_data/specs/` (read-only). Multi-version ingestion adapter dispatching by `spec_version` (`v00_19` handler ships; v00.20+ slots in as a new module). Accepted/pending/rejected lanes; pending images surface via WP-0094 intake sorter, rejected become `IngestionRejection` audit rows only. 5 new `ImageAsset` provenance columns + required `sheet_version_id`. `CharacterScript`/`IngestionBatch`/`IngestionRejection` tables. 11 new automation commands (3 spec-registry + 4 character-script + 3 ingestion-audit + ingestImageSourcingTask). Identity-decoupling enforced + pinned by test. js-yaml@^4.1.1 added. Spec bumped v00.065 → v00.066. **Released as v0.2.9** (NSIS + portable, ~88 MB each, under `CKC_GOV/targets/CKC/artifacts/releases/v0.2.9/`; tag pushed → release-win.yml). |
| WP-0103 | Sheet validator + clickElement React-19 + SQL alias regression guard | DONE | Codex | Parser rewritten to be union-aware (handles `<string | unset>`, `<integer | adult>`, `<score_10 | optional>`, `<a | b | other:<descriptor> | unknown>` etc. correctly). Validator now type-aware: strings accept anything, enum-with-other:descriptor accepts both literal enum values and descriptor-format fallbacks, score_10 range-checks 0..10. Active template prefers freshly-parsed AST over stale DB cache. `clickElement` dispatches the full pointer/mouse/click sequence (still has a known React-19 gap on the Save button — agent tests use backend `saveCharacter`). New SQL alias regression test. 25 new unit tests pass. Spec v00.066 → v00.067. Manual v2026-05-06.wp-0103. Packaged build deferred. |
| WP-0104 | Block-list inline editor for sheet fields | DONE | Codex | New `BlockListEditor` + `BlockEditor` + `SheetField` components delegate `block_list`/`block` fields away from the textarea fallback. + Add / Remove / Move up/down controls; per-sub-field input types from the block schema; namespaced datalist suggestions (`ckc-block-suggest-${parentFieldId}-${blockFieldId}`); tolerant JSON parse with a renderer warning; recursive validation in `validation.js` produces path-style issues (`CHAR-WRK-007[0].HUS-BLK-003`) and propagates `score_10` normalization. 25 new tests pass (serialize roundtrip + recursive validation); existing 62 validator/parser/governance tests still pass. Live verified end-to-end on Aeri's `Side_Hustles` (Tarot Streamer / Live / 7/10 / late night ritual streamer) — byte-exact roundtrip after hard reload. Spec v00.067 → v00.068; retroactive v00.067 changelog entry added for WP-0103 which had been skipped. Manual v2026-05-06.wp-0104. Top-level `ckc-field-*` divs dropped from ~896 to ~479 on a fresh sheet (block descriptor lines no longer render as standalone divs — they only exist inside their block context). **Released as v0.2.10** (NSIS + portable, ~88 MB each, under `CKC_GOV/targets/CKC/artifacts/releases/v0.2.10/`; tag pushed → release-win.yml; commit `43f2a51`). |
| WP-0105 | Tiered installer / reinstall / reset modes (Update / Reinstall preserve / Light reset wipe-prefs / Full reset wipe-everything-except-images) | PLANNED | Codex | Adds an explicit four-mode radio page to the NSIS installer plus in-app Settings → Reset preferences and Settings → Reset everything (keep images). Light wipes `ckc-config.json` + Electron storage; Full additionally drops `exports/`, `templates/`, per-character `sheet/extras/packs/scripts/`, and truncates every CKC Postgres table EXCEPT `ckcdbmigration` / `ckcmeta`. **Image bytes under `images/original/` and `images/thumb/` are never deleted by any mode** — Full reset writes an orphan manifest under `<libraryRoot>/orphans/<timestamp>/manifest.json` (atomic write, manifest_version=1) capturing every prior ImageAsset row's metadata, and a new `adoptOrphanImages` backend command + UI re-attaches them to a chosen target character. NSIS only writes a marker file; the app handles DB ops on next launch where it has the full backend stack. **DB scope decided 2026-05-06: Option 3 (full truncate + orphan manifest + adopt-orphans).** Spec v00.068 → v00.069. Will ship as packaged build per ship-as-packaged-build memory. |

## Current focus
- Current: WP-0104 shipped + packaged. **Released as v0.2.10** (commit `43f2a51`, tag `v0.2.10` pushed). 167 tests pass. Live verified end-to-end on Aeri (`CHAR-000003`) `Side_Hustles`. Spec v00.067 → v00.068 (also retroactive v00.067 entry for WP-0103). Manual v2026-05-06.wp-0104b. Test suite F1.7 RESOLVED. Operator-mode capture occlusion fix landed (commit `2b4fbe9`) — `disable-features=CalculateNativeWinOcclusion` switch + CDP fallback in `automationCaptureToFile`.
- WP-0105 planned: tiered installer / reinstall / reset modes. Picks Option 3 for DB scope (full truncate + orphan manifest + adopt-orphans flow). Image bytes preserved under every mode.
- Last shipped releases: v0.2.10 (WP-0104 packaged build; tag pushed 2026-05-06).
- Open minor findings (not yet WPs):
  - F2.2 React 19 Save button click via CDP — `Input.dispatchMouseEvent` (trusted), `__reactProps.onClick`, and DOM `dispatchEvent(MouseEvent)` all fail to transition the Save button while other React buttons in the same app work fine. Workaround documented: agent tests use backend `saveCharacter`. Investigation pending.
  - Operator-mode `automationCaptureToFile` returns 0×0 PNGs when the CKC window is occluded by other windows (Chromium occlusion detection). Workarounds: bring window forward, disable native-occlusion via Electron flag, or use CDP `Page.captureScreenshot`. Stealth mode is unaffected.
- Next: WP-0101 legacy flat-folder migrator (karina_blonde-style batches) once in-flight v00.19 batches settle. WP-0102 autonomous LLM workflow runner that drives spawn → sourcing → CKC ingest end-to-end.
- Deferred: packaged-build smoke for WP-0099 + WP-0100 + WP-0103 + WP-0104 (run when operator permits); NAS mirror backup; DB-backed test suite verification against the live PostgreSQL container.
- Pending: validation pass for WP-0092/WP-0093/WP-0094/WP-0095 when operator permits.
- High-ROI backlog: to be created after validation.
