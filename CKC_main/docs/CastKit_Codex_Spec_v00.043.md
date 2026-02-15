# Technical Specification — CastKit Codex (CKC) — v00.043

Date: 2026-02-15  
GitHub repo: https://github.com/Nuntissura/CastKit_Codex

This file is the **current working spec**.

- Workflow + repo governance live in: `CKC_GOV/PROJECT_CODEX.md` and `CKC_main/docs/WORKFLOW.md`.
- The recovered requirements that describe the intended *latest iteration* live in: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`.

## 0.X Spec versioning

### 0.X.1 Version bump rule (MUST)

**CKC-SPEC-VERS-001 — Patch bump:** Every internal change to this spec MUST increment the spec version by `+0.001` and MUST append a new entry to the changelog.

### 0.X.2 Archiving rule (MUST)

When a new spec version file is created, the previous version MUST be moved into: `CKC_GOV/spec/archive_spec/`.

### 0.X.3 Changelog (append-only)

- **v00.019 (2026-02-10):** Created as the new current spec from the recovered requirements in `SESSION_DUMP_2026-02-10.md`. Archived `v00.004` into `spec/archive_spec/`.
- **v00.020 (2026-02-10):** Recorded decisions for rating shortcuts + DB-first docs storage; re-embedded Appendix A from `SESSION_DUMP_2026-02-10.md` to eliminate encoding artifacts.
- **v00.021 (2026-02-10):** Added frontpage exports (empty canonical template + LLM-friendly empty packs) and output folder picker; mirrored session dump into `CKC_main/docs/`; added built-in “All Fields” LLM pack preset.
- **v00.022 (2026-02-10):** Added character icons with stored focus framing (`focusX/focusY`) and Library list rendering.
- **v00.023 (2026-02-10):** Fixed Appendix A to be fully verbatim (removed accidental truncation placeholder) and clarified rating clearing-to-0 and global carousel tag naming.
- **v00.024 (2026-02-11):** Documented how session-dump “isCarousel/isFrontpage” concepts are represented in code (tags), documented `libraryRoot` + on-disk library layout, and removed workflow/repo-governance guidance from the spec.
- **v00.025 (2026-02-11):** Added LibraryRoot diagnostics UI and documented missing-media behavior/actions.
- **v00.026 (2026-02-11):** Added a repair tool to rehydrate missing copied images by hash (dry-run + report).
- **v00.027 (2026-02-11):** Fixed a startup library initialization race (Electron main process) and added portable-friendly defaults for config + `libraryRoot` (including a startup prompt when the configured `libraryRoot` is missing).
- **v00.028 (2026-02-11):** Updated media pane UX: header controls (Controls/Thumbs/Fullscreen), arrow-key navigation outside fullscreen, filters never trap (no-matches + clear filters), larger thumbnails, per-thumbnail carousel toggle (Photos mode), increased Library frontpage character icon size, and updated rating hotkeys to `LAlt+0..5`.
- **v00.029 (2026-02-12):** Added resizable splitters + persisted layouts for 2-panel and 3-panel modes (Library + Character views); config writes no longer reinitialize the library unless `libraryRoot` changes.
- **v00.030 (2026-02-12):** Restored docs mode as a safe writing surface: autosave, “notes always visible” stacked layout, and a docs library drawer with search/tags + “All” (full library) view.
- **v00.031 (2026-02-12):** Sheet editor UX: enum fields accept free text while still suggesting canonical options; single-line fields surface reusable per-Field-ID value suggestions from across the library.
- **v00.032 (2026-02-12):** Sheet ingest/merge + versioning UI: paste/import (txt/md), preview diff, selective apply, version list/diff, and selective revert (non-destructive). Default-protect `CHAR-ID-001` from overwrite.
- **v00.033 (2026-02-12):** Experimental local model integration: Tools UI + IPC for OpenAI-compatible `POST /v1/chat/completions` (configurable base URL + model + optional system prompt).
- **v00.034 (2026-02-12):** Local model timeout is configurable via `llm.timeoutSec` (default increased; clamped to a safe range).
- **v00.035 (2026-02-13):** Portable-safe data root defaults + UI reset actions, photo mode per-image metadata regroup + character header image dropzone, and Character ID is treated as system-managed (read-only, enforced on save/import).
- **v00.036 (2026-02-13):** Carousel behaves as a slideshow in normal (non-fullscreen) viewer: auto-advance with a toggle and safe pause while editing.
- **v00.037 (2026-02-14):** Moodboard upgrades: layers (images + ink hide/lock/reorder), transform tool (resize + modifiers), undo/redo + hotkeys, text/sticky notes, gradient drag direction (linear + optional radial), and zoom/pan + grid/snap.
- **v00.038 (2026-02-14):** Added high-ROI roadmap (WP-0054..WP-0063) for linking/backlinks, inbox import, clipboard import, batch metadata edit, duplicate detection, tag management, pop-out reference window, image annotations, story corkboard/outliner, and an export hub.
- **v00.039 (2026-02-15):** Added post-0063 high-ROI backlog (WP-0064..WP-0073): web import (URL capture), Smart Folders 2.0, color tools, near-duplicate finder (perceptual), reference window power modes, collections/playlists, relationship map, moodboard arrange tools, command palette, and a backup/restore wizard.
- **v00.040 (2026-02-15):** Character identity: introduce sequential public Character IDs (`CHAR-000001`) stored as `Character.public_id`, enforce `CHAR-ID-001` to equal the public ID (visible but system-managed), add a safe migration tool to assign public IDs to existing characters without renaming folders, and explicitly forbid any in-editor field hiding/censorship (operator-only at export/import).
- **v00.041 (2026-02-15):** Web import / URL capture: add an explicit “Import URL…” action (Inbox + Character) that downloads an image through the normal ingest pipeline, stores provenance (`ImageAsset.source_url` + optional `ImageAsset.source_note`), and surfaces provenance in the image metadata panel (copy URL + edit note).
- **v00.042 (2026-02-15):** Smart Folders 2.0: saved searches support include-any/include-all and excluded tags (rule-based tag logic), persist `SavedSearch.tag_mode` + `SavedSearch.tag_exclude_json`, and UI shows a live result count for the active rules.
- **v00.043 (2026-02-15):** Color tools: compute and cache dominant palettes per image (`ImageAsset.palette_json`), show palette chips in the image metadata panel, and add a filter-by-color control with a threshold slider.

## 1. Non-negotiables (summary)

If any conflict exists between this summary and Appendix A, **Appendix A wins**.

- No censorship / no rewriting / no euphemizing. Store + export byte-for-byte user text.
- Adult/explicit fields are first-class and always enabled.
- No field censorship/hiding inside the Character Sheet template or editor. Any redaction is operator-controlled and may only be applied at export/import time.
- Template integrity gates matter. No silent drops of Field IDs.
- Canonical template rule: descriptors MUST stay on the same line as their ID.
- UI: minimal by default; sharp 90° corners.
- Default layout is a 2-panel “portfolio viewer” (images + character sheet). Notes/Stories/Moodboard is a 3-panel mode.

## 2. Decisions (post-session dump)

These decisions resolve/supersede items listed under “Open questions to decide during rebuild” in Appendix A.

- Ratings assignment hotkeys: `LAlt+0`, `LAlt+1`, `LAlt+2`, `LAlt+3`, `LAlt+4`, `LAlt+5` set rating to 0–5 (0 clears).
- Notes/Stories/Moodboard persistence: DB-first (SQLite) is the source of truth; file exports are optional.
- Global carousel selection rule (tentative): if any images are tagged `frontpage`, show only those; otherwise show images tagged `carousel`.

## 3. Implementation mapping (session dump → code)

If the session dump describes a concept that does not appear literally in code (example: a boolean flag), this section documents how it is represented.

### 3.1 `isCarousel` / `isFrontpage` concepts

Session dump terminology:
- `isCarousel`: “include this image in the carousel” (global carousel on the Library front page, and per-character carousel).
- `isFrontpage`: referenced in discussion as a way to select which images the Library front page should prioritize.

Code representation:
- Images have `tags` stored as a string array in SQLite (`ImageAsset.tags_json`).
- `isCarousel` is represented as tag `carousel`.
- `isFrontpage` is represented as tag `frontpage`.
- Global carousel selection rule: if any images exist with tag `frontpage`, show only those; otherwise show images with tag `carousel`.
- Tag toggles are exposed in the image metadata bar as buttons `carousel` and `frontpage`.
- Photos mode also exposes a per-thumbnail `carousel` quick toggle (adds/removes the `carousel` tag).

## 4. Data layout (libraryRoot)

### 4.1 App config

- Config file name: `ckc-config.json`
- Location:
  - Default install: Electron `app.getPath('userData')` (Windows: typically `%APPDATA%\\castkit-codex\\ckc-config.json`)
  - Portable `.exe`: next to the executable (`%PORTABLE_EXECUTABLE_DIR%\\ckc-config.json` when provided by electron-builder portable)
- Default `libraryRoot`:
  - Default install: Electron `app.getPath('userData')\\CastKit Codex Library` (Windows: typically `%APPDATA%\\castkit-codex\\CastKit Codex Library`)
  - Portable `.exe`: `%PORTABLE_EXECUTABLE_DIR%\\CastKit Codex Library`

Startup behavior:
- If `libraryRoot` is configured but missing on disk, CKC prompts to:
  - Select an existing library root folder, or
  - Create a new library at the default location, or
  - Quit (explicit).

Optional local model (experimental):
- `llm` object (stored in `ckc-config.json`):
  - `baseUrl`: OpenAI-compatible base URL (host or `/v1`), e.g.:
    - Ollama: `http://127.0.0.1:11434/v1`
    - LM Studio: `http://127.0.0.1:1234/v1`
  - `model`: model name as expected by the local server.
  - `apiKey` (optional): bearer token for servers that require auth.
  - `systemPrompt` (optional): prepended as a system message for requests.
  - `timeoutSec` (optional): request timeout in seconds (default 900; clamped 5..7200).
- UI: Character → Tools → “Local model (experimental)”
- IPC: `ckc:llmChat` calls OpenAI-compatible `POST /v1/chat/completions` (base URL is normalized to allow either host or `/v1` root).

### 4.2 Library root folder structure

Under `<libraryRoot>`:
- `db/codex.db` — SQLite database
- `templates/` — templates saved into the library
- `exports/` — default export destination
- `characters/<characterId>/` — per-character data (see below)

### 4.3 Per-character folder structure

Under `<libraryRoot>/characters/<characterId>/`:
- `sheet/character.txt` — canonical sheet text
- `sheet/character.md` — optional markdown export
- `sheet/versions/` — historical sheet versions
- `images/original/` — imported image files (copied mode)
- `images/thumb/` — generated thumbnails (PNG)
- `exports/` — per-character exports
- `extras/` — extra per-character assets
- `packs/` — field packs / presets (if applicable)

### 4.3.1 Character identity (internal vs public)

- Internal `characterId`:
  - Random (example prefix `char_...`).
  - Used as the stable folder/DB key (`<libraryRoot>/characters/<characterId>/`).
- Public Character ID:
  - System-managed sequential format: `CHAR-000001` (6 digits, zero-padded).
  - Stored in SQLite on the Character row as `public_id`.
  - Written into the sheet field `CHAR-ID-001` (visible in the editor, read-only/system-managed).
- Safety invariants:
  - `CHAR-ID-001` cannot be overwritten via ingest/merge/version revert flows.
  - On save/import, `CHAR-ID-001` is enforced to match the Character’s `public_id`.
  - Migration assigns missing `public_id` values for existing characters without renaming folders.

### 4.4 Media storage modes (DB)

Each image row includes:
- `storage_mode`:
  - `copy`: store inside the character folder; `relative_path` resolves under `<libraryRoot>/characters/<id>/`
  - `reference`: keep original path; use `source_path` as the file location
- `relative_path`: DB path to the stored file (uses `/` separators; converted to OS separators at runtime)

Thumbnails:
- Thumb path is derived from the original file name stem and stored under `images/thumb/<stem>.png`.

## 5. LibraryRoot diagnostics (UI)

The app must make it obvious which library is active and must help diagnose “sheets load but photos don’t”.

### 5.1 LibraryRoot visibility + change

On the Library (front page), a toggleable **Library** command bar exposes:
- Config file path (for debugging)
- Current `libraryRoot`
- Actions:
  - Open config
  - Open `libraryRoot`
  - Change `libraryRoot` (folder picker)
  - Reset `libraryRoot` to default
  - Assign public Character IDs (safe migration; no folder renames)
  - Rescan diagnostics (refreshes counts + lists)

### 5.2 Missing media behavior (viewer)

If an image exists in the DB but the original file is missing on disk:
- The viewer shows an explicit **Missing image file** state (not a silent blank).
- It offers actions:
  - Retry (forces a re-fetch)
  - Change library folder...
  - Open diagnostics

### 5.3 Repair missing images (by hash)

If a library has a valid DB but many missing `images/original/*` files (after wipes/moves/backups), CKC provides a repair tool:

- User picks a **scan folder** (e.g. a recovery dump) and (optionally) includes subfolders.
- CKC hashes image files and matches them against missing `ImageAsset.file_hash` entries.
- It restores files into the expected per-character paths (copied storage mode).
- It regenerates thumbnails when possible.
- It always writes a JSON report under: `<libraryRoot>/exports/repair_reports/`.
- Default/safe operation is **dry-run** (no copies).

## 6. Media pane chrome (UX)

- Header bar (non-overlay):
  - Left slot: caller-provided media mode toggles (Carousel/Photos on Character page).
  - Right: `Slideshow` (carousel), `Controls`, `Thumbs`, `Fullscreen`.
  - Header content is inset to avoid overlap with the fixed hamburger menu button.
- Slideshow:
  - In carousel contexts (frontpage/global carousel and Character carousel mode), the viewer auto-advances like a slideshow.
  - A `Slideshow/Stop` toggle is available.
  - It pauses while `Controls` is open (so editing notes/tags is never disrupted).
- Controls panel (non-overlay):
  - Toggled by `Controls`.
  - Contains gallery filters (favorites only + rating operator/value).
  - Filters remain accessible even at zero matches (never traps the user).
- Per-image metadata:
  - Favorite + rating + notes + tags live in the bottom metadata bar for the selected image.
- Filter empty-state:
  - When filters produce zero matches, the viewer shows “No images match filters” + a “Clear filters” action.
- Thumbnails:
  - Horizontal scroll (mousewheel).
  - Larger sizing optimized for 4K/TV usage.
  - In Photos mode, each thumbnail has a quick `carousel` toggle (adds/removes the `carousel` tag).
- Keyboard:
  - `ArrowLeft` / `ArrowRight` navigate images outside fullscreen (ignored while typing).
  - Fullscreen keeps `Esc` to close and arrow navigation.
- Character header dropzone:
  - In the Character view, dropping image files onto the character header imports them into that character.

## 7. Resizable panels + persisted layouts

- Library view is resizable with a vertical splitter between:
  - Left: global carousel/media
  - Right: Library controls + character list
- Character view:
  - Default mode: 2 panels (media | character data) with a splitter.
  - Docs mode: 3 panels (media | docs | character data) with two splitters.
- Layout persistence:
  - Stored in `ckc-config.json` as fractions of **available width** (excluding splitter widths).
  - Keys:
    - `layoutLibrary2.leftFrac`
    - `layoutCharacter2.leftFrac`
    - `layoutCharacter3.leftFrac`, `layoutCharacter3.middleFrac` (right panel is the remainder)
  - Persisted on drag end; restored on restart and when switching modes.
- Minimum widths are enforced so panels cannot collapse to unusable sizes.

## 8. Docs mode (autosave + stacked layout)

- Docs mode is a 3-panel view on the Character page: media (left) | docs (middle) | character data (right).
- Notes are always visible at the top of the docs panel.
- The lower docs pane toggles between Stories and Moodboard.
- Autosave:
  - Notes + Stories autosave debounced while typing, and flush on blur.
  - Moodboard autosaves debounced on change.
  - Manual save/delete actions remain available.
- Docs library drawer:
  - Opens scoped to Notes/Stories/Moodboard, with an “All” view to browse all doc types together.
  - Search + tag filters apply to docs only; smart tags are derived from the current drawer result set.
- Persisted docs UI state:
  - Stored in `ckc-config.json` under `docsUi`:
    - `docsUi.lowerType` (`stories` or `moodboard`)
    - `docsUi.selected.notes/stories/moodboard` (last selected doc IDs)

## 9. Sheet editor: free-text enums + per-field suggestions

- Enum fields are **not** strict dropdowns:
  - Render as free-text input.
  - Still suggest canonical enum values (via browser datalist/autocomplete).
- Reusable value suggestions (presets):
  - Single-line fields surface suggestions based on **previously saved** values for that exact `field_id` across the library.
  - Suggestions are field-specific (no cross-field pollution) and never rewrite user input automatically; users pick a suggestion explicitly.
  - Implementation detail: suggestions come from `FieldValue` rows in SQLite (`field_id`-scoped distinct values, ordered by recency).

## 10. Sheet ingest/merge + versioning (UI)

- Tools panel exposes:
  - **Sheet ingest / merge**:
    - Paste or import a txt/md block of Field ID assignments.
    - Preview a field-by-field compare (current vs proposed) and select which fields to apply.
    - Preview lists only the Field IDs present in the pasted/imported block (it is not a full-template sheet view).
    - Applying selected fields creates a new sheet version entry (append-only history).
  - **Sheet versions**:
    - List versions with timestamps/source/notes.
    - Diff any two versions (field-by-field).
    - Selective revert from a chosen version (creates a new version; does not overwrite any older version).
- Protected fields:
  - `CHAR-ID-001` is protected by default and cannot be overwritten via ingest/patch/revert flows.
  - `CHAR-ID-001` is treated as system-managed: it is enforced to match the Character’s public ID (`Character.public_id`, formatted like `CHAR-000001`) on save/import and is surfaced in UI as a copyable ID (not a normal editable field).

## 11. High-ROI roadmap (planned)

This section defines planned near-term features that are likely low-effort/high-impact for CKC. Each item maps to a Work Packet (WP) and is expected to land without violating non-negotiables (no rewriting/censorship, byte-for-byte preservation, and template integrity).

### 11.1 Links + backlinks (WP-0054)
- Notes/Stories/Moodboard and sheet text support click-to-navigate links using a simple syntax:
  - Wikilinks: `[[Character Name]]`, `[[doc:Notes Title]]`, `[[doc:Stories Title]]`, `[[doc:Moodboard Title]]`
  - Image links: `[[img:<imageId>]]` and/or `[[imgtag:tagName]]` (implementation-defined; must be stable once shipped).
- Provide a Backlinks panel for the active item (character/doc/image) listing all incoming links.
- No auto-rewriting: links are never “fixed” in user text silently. Only explicit user actions may insert/update links.

### 11.2 Inbox / watch-folder import (WP-0055)
- Optional configured watch folder (“Inbox”) that CKC can scan/import from.
- Imported media defaults to a safe holding area (Unassigned/Inbox) until the user assigns to a character.
- Provide an Inbox view with quick actions:
  - Assign to character (copy/reference mode consistent with current import settings)
  - Bulk tag/rate/favorite
  - Dismiss/delete-from-inbox (must be explicit; never auto-delete user files)

### 11.3 Clipboard image paste import (WP-0056)
- Support pasting images from clipboard (single image) into:
  - Character view (imports into that character)
  - Library/Inbox view (imports as Unassigned)
- Pasting must be a deliberate action (keyboard shortcut / menu). Never capture clipboard automatically.

### 11.4 Multi-select + batch edit for image metadata (WP-0057)
- Thumbnails support multi-select (Shift range, Ctrl toggle).
- Batch edit applies to the whole selection:
  - Toggle favorite
  - Set rating (0–5)
  - Add/remove tags (including `carousel` and `frontpage`)
  - (Optional) Apply a notes “stamp” (predefined short snippets)
- UX: must remain safe; batch actions require clear selection count and an undo path where feasible.

### 11.5 Duplicate detection (exact hash) + safe cleanup (WP-0058)
- Provide a duplicates view that groups images by exact file hash (byte-identical).
- Show per-group context: characters using it, tags/ratings, storage mode, and disk size.
- Cleanup actions must be safe and explicit:
  - Remove duplicate DB rows (when redundant)
  - (Optional) Consolidate copies to a single stored file when storage mode is `copy` (only if it does not break library invariants).
- Never delete external referenced files without explicit confirmation.

### 11.6 Tag manager (WP-0059)
- Provide a single place to manage tags across:
  - Images
  - Notes/Stories/Moodboard docs
- Capabilities:
  - Rename tag (global)
  - Merge tags (A -> B)
  - Show counts per entity type
  - Pin/favorite tags for quick filters
- Must preserve user text byte-for-byte: tag operations affect structured tag fields only (not free text).

### 11.7 Pop-out reference window (WP-0060)
- A separate window that can display:
  - Current image viewer (with minimal chrome)
  - (Optional) Current moodboard
- Support always-on-top toggle.
- Must not disrupt current mode (docs mode stays active; image interactions must not kick out of notes mode).

### 11.8 Image annotations / pins (non-destructive) (WP-0061)
- Allow adding non-destructive overlays to an image:
  - Text notes (pins)
  - Simple shapes (arrow/rect/ellipse) and highlight
- Store annotations as structured data (JSON) keyed by `imageId`.
- Viewer provides show/hide toggle; annotations never alter the original image bytes.

### 11.9 Stories corkboard / outliner (WP-0062)
- Provide a board/outliner view for Stories:
  - Cards/items can be reordered via drag/drop.
  - Items can link to characters/images (using the same link primitives as 11.1).
- Data is stored as part of Stories library (DB-first); exports are optional.

### 11.10 Export hub: moodboards + image sets + share packs (WP-0063)
- Add an export hub UI that consolidates common exports:
  - Export moodboard to PNG (and optionally PDF)
  - Export filtered/selected image sets to a chosen folder (and optionally zip)
  - Export “share pack” per character (sheet + selected images + selected docs)
- Default export destination is under `<libraryRoot>/exports/` unless user chooses otherwise.
- Export hub provides a persistent “Exports folder” setting:
  - Default is `<libraryRoot>/exports/` (portable-safe)
  - User can override via folder picker (applies to all exports)
- Exports are organized into subfolders under the exports folder:
  - `moodboards/`
  - `image_sets/`
  - `share_packs/`
- Exports must respect non-negotiables (no rewriting; canonical template bytes preserved).

### 11.11 Web import / URL capture (WP-0064)
- Provide an explicit “Import URL…” action (Library/Inbox and Character) that downloads an image and imports it through the normal ingest pipeline.
- UI entrypoints:
  - Library -> Inbox bar -> “Import URL…”
  - Character -> header -> “Import URL…”
- Store per-asset provenance metadata (SQLite `ImageAsset`):
  - `source_url` (read-only display)
  - Optional `source_note` (free text, editable)
- Viewer metadata panel shows provenance:
  - Copy source URL
  - Edit source note
- Must never fetch remote content automatically; imports are always an explicit user action.

### 11.12 Smart Folders 2.0 (rule-based saved searches) (WP-0065)
- Saved searches (Smart Folders) are rule-based definitions for the Library character list (not a snapshot), including:
  - Search text + scope flags (Name/Tags/IDs/Labels/Values)
  - Include tags with mode: all (AND) / any (OR)
  - Exclude tags
  - Gallery filters: Favorite only, Rating operator/value (filters characters by whether they have images matching)
- Persistence (SQLite `SavedSearch`):
  - Include tags: `tag_filters_json`
  - Exclude tags: `tag_exclude_json`
  - Tag mode: `tag_mode` (`all` or `any`)
- UI supports editing rules and shows a live results count.

### 11.13 Color tools: palettes + search (WP-0066)
- Each image can have a cached dominant palette (array of hex colors) stored in SQLite:
  - `ImageAsset.palette_json` (JSON array; empty array allowed)
- Palette computation:
  - Lazy/on-demand (computed when needed by UI)
  - Prefer thumbnail PNG when available; otherwise use the original/reference path
  - Default: 6 colors; clamp to 1..12
- UI:
  - Image metadata panel shows palette chips for the selected image
  - Clicking a chip enables the Color filter and sets the target color
- Color filter:
  - Filters the current MediaPane image list to images whose palette contains a color within the threshold
  - Threshold is a simple RGB Euclidean distance (0..220)
  - While palettes are being ensured, show a “Computing palettes…” message (avoid confusing “no matches”)

### 11.14 Near-duplicate finder (perceptual) (WP-0067)
- Provide a “visually similar” scan that groups images by perceptual similarity (not only exact hashes).
- Results show side-by-side comparisons and context (tags/ratings/characters).
- Cleanup actions must be explicit and safe (never auto-delete).

### 11.15 Reference window power modes (WP-0068)
- Extend the pop-out reference window with:
  - Opacity slider
  - Click-through toggle (when enabled, mouse passes through; hotkey to toggle back)
  - Always-on-top toggle (baseline from WP-0060)

### 11.16 Collections / playlists (WP-0069)
- Allow creating named collections of images across characters (curated sets).
- Collections run as slideshows (respect filters) and can be exported as image sets.

### 11.17 Character relationship map (WP-0070)
- Provide explicit character→character relationship edges with:
  - Type (free text or enum)
  - Notes
- Add a lightweight graph view to browse relationships and jump to characters.

### 11.18 Moodboard arrange tools (WP-0071)
- Add basic arrange tools for selected items:
  - Align (left/center/right, top/middle/bottom)
  - Distribute (horizontal/vertical)
  - Group/ungroup
  - Auto-pack (simple “tidy” layout for a loose cluster)
- All arrange operations are undoable.

### 11.19 Command palette (Ctrl+K) (WP-0072)
- A keyboard-first command palette that can:
  - Jump to character/doc/tag
  - Run exports/tools
  - Toggle views/modes
- Fuzzy match, works without leaving the keyboard.

### 11.20 Backup/restore wizard (WP-0073)
- Provide a guided backup/restore UX for a CKC libraryRoot:
  - Backup: snapshot DB + media + exports to a user-selected folder (default under `<libraryRoot>/exports/`).
  - Restore: select a backup and restore into a user-selected destination folder (never auto-overwrite without confirmation).
- Backups include a manifest and checksums for integrity verification.

---

## Appendix A — SESSION_DUMP_2026-02-10 (verbatim)

# CKC — Session Dump (Recovered Requirements + Latest Iterations)

Date: 2026-02-10

This file is a "memory dump" of what we discussed/implemented in the last session before data loss. Use this as the source of truth when rebuilding CKC. The old spec (v00.004) and old packaged app are useful baselines, but the items below describe the intended *latest iteration*.

## Hard rules (non-negotiable)
- No censorship / no rewriting / no euphemizing. Store and export byte-for-byte user text.
- Adult/explicit fields are first-class and always enabled.
- Template integrity gates matter (round-trip, completeness). No silent drops of Field IDs.
- Canonical template rule: **Descriptors MUST always stay on the same line as their ID.**
- UI preference: minimal UI by default; sharp 90° corners.

## High-level product direction
"Character sheet + portfolio viewer".

Default experience: images (carousel/gallery) are the hero, always side-by-side with the character sheet.

## Layout / navigation (portfolio viewer)
### Menu drawer
- Replace the big banner/left block with a left slide-out drawer (hamburger).
- Drawer toggles with hotkey (we used `Ctrl+B`) and `Esc` closes.
- Drawer must be closable (button + hotkey).

### Two-panel default
- For most pages: **2 panels**.
  - Left: big image surface (carousel or photos)
  - Right: character sheet editor

### Front page (Library)
- Left: a **global carousel** showing **ALL images across ALL characters** that are marked `isCarousel`.
- Right: character list/grid with icons.
- Carousel must display the **full image** (no unintended cropping).
- Minimal UI: hide most controls by default.

### Character sheet page
- Left: toggle between **Carousel** and **Photos**.
  - Carousel here is **character-specific**: only that character’s `isCarousel` images.
- Right: character sheet editor.

### Notes / Stories / Moodboard mode (3-panel)
- When Notes/Stories/Moodboard is opened: **3 panels**.
  - Left: images (carousel/photos) with a toggle (must not exit 3-panel mode when switching)
  - Middle: Notes / Stories / Moodboard
  - Right: character sheet editor
- Important bug/requirement: clicking the image pane must NOT kick you out of notes mode. You must be able to view photos while in notes/stories/moodboard.

## Minimal UI / hideable command bar
- Search bar + saved searches + tags + filters should live together in one hideable bar (search-glass toggle).
- Toolbars/filters are allowed to overlay the photo, but should be hidden by default.
- Gallery filters (favorites/frontpage/carousel/ratings/etc) should be hidden by default and toggled visible.

## Carousel / photo surface goals
- Increase the displayed image surface area significantly (works well on 4K/65" screens).
- Thumbnails can be hidden with a toggle to make the main image feel much larger.
- Thumbnails should be horizontal + scrollable (mousewheel).
- Thumbnails should show the **entire image** (no square crop cutout).

## Character icons
- Character icon should be selectable and reframable.
- Store icon focus framing (e.g. `focusX/focusY`) so it doesn’t show a random center crop.

## Ratings (0–5 stars)
- Rating is not just a filter: you must be able to **assign** ratings like Adobe apps.
- Support 0–5 stars.
- Filters must support operators: `=`, `<`, `≤`, `>`, `≥` (and combos like “equal or less / equal or more”).
- Slideshow must respect active filters (e.g. slideshow of only 1-star items).

## Fullscreen
- Fullscreen mode for:
  - Frontpage carousel
  - Character carousel
  - Photo viewer / slideshow

## Notes / Stories / Moodboards: separate libraries
Goal: each of these is its own library with smart tags.

- Notes library
- Stories library
- Moodboard library (Milanote-like canvas)

Library UI:
- Library list appears as a left sidebar/drawer.
- The library drawer should slide from the **same side as the main menu drawer**.
- Menu button should “switch drawers”: close library drawer and open menu drawer (and vice versa).
- Library drawer width should scale with window size; initial width ~2× the menu width.
- In the middle panel, each section (Notes/Stories/Moodboard) should have its own:
  - “Library” button
  - Save button
  - Delete button
  - Close/toggle behavior

Critical UX bug:
- When typing in a new/open note/story/moodboard, controls must NOT disappear.
- Notes/Stories/Moodboards must have their own Save behavior (not piggybacking on character sheet save).

Smart tags:
- Each doc type should have smart tags.
- Tags must include doc-type metadata (so later it’s clear whether a tag came from notes vs stories vs moodboard) but still allow cross-filtering with photo tags if desired.

## Moodboard canvas (Milanote-ish)
Core:
- Add pictures (from character/global library)
- Free drawing (pen/line/arrow/rect/ellipse/eraser)
- Background tools (bucket + gradient)
- Text / sticky notes
- Vector masks (requested; not yet implemented)

Editing + organization:
- Layers panel: reorder + hide/show + lock/unlock for images; ink layer hide/lock
- Transform tool: resize selected image/text (modifiers: `Shift` keep aspect, `Alt` resize from center)
- Undo/redo: toolbar buttons + hotkeys (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`), with coalesced drag/resize gestures

Navigation + precision:
- Zoom (mouse wheel + buttons)
- Pan (hold `Space` + drag)
- Grid overlay toggle + snap-to-grid toggle (affects move/transform)

Gradient tool:
- Drag-to-set direction on-canvas with live preview (hold `Shift` to snap angles)
- Optional radial mode

Image picker UX:
- Image selection popup must be portal/modal (on top of everything), not embedded inside a scrollable canvas.

## Character sheet editor
- Cluster/group fields more logically where it improves usability.
- Do NOT drop fields.
- Do NOT add any “moral/safety filters”.
- “Data quality” field is template artifact; remove if possible, otherwise collapse by default.

UI:
- Move the bar with: `Back / Character name / Sheet / Photos / Notes / Tools` into the character sheet panel header.
- Avoid duplicate back buttons; make back behavior consistent.
- Media dropbox should live inside the same header/toolbar area.

## Exports (template + character)
Frontpage (Library) needs an export function:
- Export an **empty character sheet** that matches the canonical template bytes/layout.
- Also export an **LLM-friendly** empty version (Field ID lines, optionally selected sections/fields).

Exports must:
- Allow selecting fields/sections to include.
- Be reusable as dropdown presets.
- Allow choosing export folder/path.
  - Default to an app folder near the library root / exports folder.

Character exports:
- Same behavior for filled-in character exports.

Canonical template
- The up-to-date canonical file is:
  - `CKC_GOV/templates/character sheet templates/CHARACTER_SHEET__v2.00.txt`
- Empty-template export must look like that.
- Must preserve the "descriptor stays on same line" rule.

## Photo panel details
- When showing “controls”, notes/tags must not be blocked by the controls bar.
- Move tags/notes/metadata UI to the bottom so it stays visible.

## Style notes (we lost the styleguide)
- Reuse old app’s colors/logos and `icon.ico`.
- Keep the “glass panel” vibe if desired, but remove rounded corners.
- Prefer minimal chrome around the images.

## Build/repo hygiene (important)
- Do not keep build artifacts in the source repo.
- Put build outputs, caches, and logs under `CKC_GOV/targets/`.

Suggested structure:
- `CKC_GOV/targets/CKC/artifacts/` (installer/portable)
- `CKC_GOV/targets/CKC/logs/`
- `CKC_GOV/targets/cache/npm/`
- `CKC_GOV/targets/cache/electron/`
- `CKC_GOV/targets/cache/electron-builder/`

## Recovery baselines available
- Old packaged app (for colors/logos + some backend reference):
  - `CKC_recovery/CKC_old_install/resources/app.asar`
- Old spec (goals baseline):
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.004.md`

## Open questions to decide during rebuild
- Exact keyboard shortcuts for rating assignment (1–5?), fullscreen, drawer toggle.
- How to store docs/moodboard content in DB vs files (DB-first vs file-first).
- Whether global carousel uses only `isCarousel`, or also uses `isFrontpage` as optional filter.
