# Technical Specification — CastKit Codex (CKC) — v00.027

Date: 2026-02-11  
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

## 1. Non-negotiables (summary)

If any conflict exists between this summary and Appendix A, **Appendix A wins**.

- No censorship / no rewriting / no euphemizing. Store + export byte-for-byte user text.
- Adult/explicit fields are first-class and always enabled.
- Template integrity gates matter. No silent drops of Field IDs.
- Canonical template rule: descriptors MUST stay on the same line as their ID.
- UI: minimal by default; sharp 90° corners.
- Default layout is a 2-panel “portfolio viewer” (images + character sheet). Notes/Stories/Moodboard is a 3-panel mode.

## 2. Decisions (post-session dump)

These decisions resolve/supersede items listed under “Open questions to decide during rebuild” in Appendix A.

- Ratings assignment hotkeys: `RAlt+1`, `RAlt+2`, `RAlt+3`, `RAlt+4`, `RAlt+5` set rating to 1–5. Clearing to 0 is supported via an explicit **Clear** action in the rating UI.
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

## 4. Data layout (libraryRoot)

### 4.1 App config

- Config file name: `ckc-config.json`
- Location:
  - Default install: Electron `app.getPath('userData')` (Windows: typically `%APPDATA%\\castkit-codex\\ckc-config.json`)
  - Portable `.exe`: next to the executable (`%PORTABLE_EXECUTABLE_DIR%\\ckc-config.json` when provided by electron-builder portable)
- Default `libraryRoot`:
  - Default install: `%USERPROFILE%\\Documents\\CastKit Codex Library`
  - Portable `.exe`: `%PORTABLE_EXECUTABLE_DIR%\\CastKit Codex Library`

Startup behavior:
- If `libraryRoot` is configured but missing on disk, CKC prompts to:
  - Select an existing library root folder, or
  - Create a new library at the default location, or
  - Quit (explicit).

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
  - Rescan diagnostics (refreshes counts + lists)

### 5.2 Missing media behavior (viewer)

If an image exists in the DB but the original file is missing on disk:
- The viewer shows an explicit **Missing image file** state (not a silent blank).
- It offers actions:
  - Retry (forces a re-fetch)
  - Change library folder…
  - Open diagnostics

### 5.3 Repair missing images (by hash)

If a library has a valid DB but many missing `images/original/*` files (after wipes/moves/backups), CKC provides a repair tool:

- User picks a **scan folder** (e.g. a recovery dump) and (optionally) includes subfolders.
- CKC hashes image files and matches them against missing `ImageAsset.file_hash` entries.
- It restores files into the expected per-character paths (copied storage mode).
- It regenerates thumbnails when possible.
- It always writes a JSON report under: `<libraryRoot>/exports/repair_reports/`.
- Default/safe operation is **dry-run** (no copies).

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
- Free drawing
- Vector masks

Tools requested/implemented direction:
- Pen
- Line
- Arrow
- Eraser
- Paint bucket
- Gradient tool
- Shapes (requested)
- Better “Photoshop-like” bucket/gradient behavior (requested)

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
