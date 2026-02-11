# Technical Specification — CastKit Codex (CKC) (Windows GUI) — v00.004
## 0. Product identity

- **Product name (user-facing):** CastKit Codex v00.004  
- **Short name / acronym:** CKC (v00.004)  
- **Spec version:** v00.004  
- **GitHub repo:** https://github.com/Nuntissura/CastKit_Codex  
- **Purpose label:** Character sheet editor + persona/casting library (fields/IDs/tags)  
- **Core guarantee:** No silent edits (never drops template Field IDs; no rewrite/redaction; round-trip integrity)  

---

## 0.X Spec versioning

### 0.X.1 Version bump rule (MUST)

**CKC-SPEC-VERS-001 — Patch bump:** Every internal change to this spec MUST increment the spec version by `+0.001` and MUST append a new entry to the changelog.

### 0.X.2 Changelog (append-only)

- **v00.004 (2026-02-08):** MVP updated: built-in **LLM Pack (strict)** is defined as an LLM-friendly **Safe Subset** Field Pack (curated whitelist excluding explicit/NSFW fields); removed any implication that MVP requires a separate “Research Pack” concept.
- **v00.004 (2026-02-08):** Spec cleanup; updated template reference to **v2.00**; added operator-facing rule “descriptor MUST stay on the same line as its ID”; restored explicit BUILD BREAK integrity gates; clarified canonical vs foreign/dirty ingest semantics; expanded acceptance criteria and testing requirements; fixed formatting/version glitches.
- **v00.002 (2026-02-08):** Added Template Spin-offs / Field Packs; introduced built-in **LLM Pack (strict)** as MVP requirement; defined custom spin-offs (SHOULD); added `TemplateSpinOff` data model; expanded features list.
- **v00.001 (2026-02-08):** Initial CKC spec baseline (repo-linked, ingest review, versioning, gallery, exports).

---

## 1. Product summary

**CastKit Codex (CKC) v00.004** is a Windows desktop app.


**CastKit Codex (CKC) v00.004 v00.004** is a Windows desktop app.

A **small Windows desktop app** that lets you:

- Maintain a **local database of characters** (records + files).
- Edit characters through a **GUI generated from a Character Sheet template** (including adult/explicit fields).
- **Create new sheets** from a chosen template.
- **Update existing sheets** by pasting “loose field IDs” + values (patch mode) or by editing in the form.
- Add **smart tags** (manual + rule-derived) for fast filtering and search.
- Use **dropdowns for fields where applicable** while **always allowing free typing**.
- Manage a **folder system** for each character (sheet + exports + pictures).
- View a **per-character image gallery** with **favorite** + **0–5 star rating**.
- Export to **TXT**, **MD**, and **PDF**.

**Hard non-goal:** The app contains **no built-in AI** (no LLM calls, no auto-fill by generative models).  
Determinism is preferred: same inputs → same outputs.

---

## 2. Goals and non-goals

### 2.1 Goals (MUST)

1. The app MUST run on **Windows 10/11 (x64)**.
2. The app MUST be a **GUI desktop app** (no browser requirement).
3. The app MUST support **Character Sheet template v2.00** as an input template format.
4. The app MUST support both:
   - **Template-first creation** (instantiate a new sheet from template).
   - **Sheet-first updates** (load an existing sheet and update in place).
5. **Adult module is always active**
   - The app MUST treat adult/explicit fields as **first-class, always enabled**.
   - The app MUST NOT provide a “hide adult fields” or “disable adult module” mode.
   - The app MAY import “SFW sheets” that simply leave adult fields blank; schema stays the same.
6. The app MUST allow **“loose Field ID paste”** to fill/update:
   - Recognize field IDs (e.g., `CHAR-ID-002`) and apply values to matching fields.
   - If a pasted ID is unknown to the active template, the app MUST not silently write it into the sheet; it MUST be reported as **unmapped**.
7. For any field with enumerated values (e.g., `<right | left | ambidextrous | unknown>`), the UI MUST provide a dropdown AND MUST allow free typing (editable combo box).
8. The app MUST store characters in a **local database** and provide **search + tag filtering**.
9. The app MUST provide **a folder system**:
   - A configurable “Library Root” directory.
   - A deterministic per-character folder layout under that root.
10. The app MUST provide a **character gallery**:
   - Import/copy images into the character folder (or reference them by path, if enabled).
   - Display images in a gallery with thumbnails.
   - Support **favorite** flag and **0–5 star rating** per image.
11. The app MUST export per character to:
   - `.txt`
   - `.md`
   - `.pdf`
12. **No censorship / no word softening**
   - The app MUST store, display, export, and search **exact user-provided text**.
   - The app MUST NOT automatically redact, mask, rewrite, euphemize, or “sanitize” content internally or externally.

### 2.2 Non-goals (MUST NOT)

1. The app MUST NOT call external AI services or embed a local LLM by default.
2. The app MUST NOT require an internet connection for core functionality.
3. The app MUST NOT rewrite unrelated formatting when updating an existing sheet:
   - Only the value portion of matched fields may change unless the user explicitly chooses a formatting operation.

---

## 3. Definitions and glossary

- **Template**: A canonical sheet structure file (sections + field definitions + block schemas).
- **Sheet**: A character’s filled (or partially filled) instance of a template, stored as a text/markdown file.
- **Field ID**: Stable identifier like `CHAR-ID-002`.
- **Field line**: A template/sheet line of the form: `FIELD-ID — Label: <type or value>`.
- **Enum field**: A field line that declares allowed values, e.g. `<low | medium | high | unknown>`.
- **Block schema**: A named set of fields repeated as an object, e.g., `Language_Block` with `LAN-BLK-*`.
- **Smart tag**: A tag automatically derived from field values using deterministic rules.
- **Library Root**: Base folder that contains the DB, templates, and per-character folders.

---

## 4. Primary workflows

### 4.1 Create new character (template-first)

1. User selects a template (default: v2.00).
2. App creates:
   - A new DB record.
   - A new per-character folder in the Library Root.
   - A new sheet file (initially unfilled placeholders or empty values, per serialization rules).
3. User edits via GUI.
4. App validates on save and exports/updates sheet file.

### 4.2 Import existing character (sheet-first)

1. User selects an existing sheet file.
2. App parses it into:
   - Template binding (best match by Template ID, or user-chosen).
   - Field/value map.
   - Unrecognized lines preserved as **verbatim extras**.
3. App optionally offers to “adopt into Library Root” (copy into per-character folder).
4. User edits via GUI and saves back to file.

### 4.3 Patch update via “loose Field IDs”

User pastes text like:

- `CHAR-ID-002: Jane Doe`
- `CHAR-MEAS-001 = 173`
- `CHAR-PREF-001: ["coffee", "quiet mornings"]`

The app:
1. Parses the paste into `(FieldID, value)` pairs.
2. Applies pairs to the loaded character (in-memory).
3. Shows:
   - Applied updates
   - Unmapped IDs
   - Values rejected by validation rules
4. User confirms save → file updated and DB record updated.

### 4.4 Manage gallery images

1. User opens a character → Gallery tab.
2. User imports images (drag & drop or file picker).
3. App stores:
   - Image files under the character’s folder (default: copy-in).
   - Image metadata (favorite, rating, optional notes/tags) in DB.
4. User can:
   - Mark favorite
   - Set 0–5 rating
   - Filter gallery by rating/favorite
   - Open image in OS viewer

---

### 4.5 Ingest (LLM-output) with review panel

**Intent:** Accept a partially filled or “dirty” sheet produced by an external LLM (or human), extract whatever values exist, and apply them to a canonical CKC sheet **without ever dropping fields**.

#### 4.5.1 Ingest modes (MUST)

- **Update existing character**
  - User selects a target character in CKC, then selects an input file to ingest.
- **Create new character from ingest**
  - CKC creates a new character bound to a chosen template, then applies extracted values into the new sheet.

#### 4.5.2 Extraction rules (MUST)

- CKC MUST key extraction **only** by **Field ID**.
- If the input file contains a line that matches a Field ID, CKC MUST extract the raw value text as-is.
- If the input file is missing template fields (common with LLM outputs), CKC MUST treat them as “no input” and MUST NOT infer values.
- If the input file contains unknown/unmapped Field IDs, CKC MUST list them as **Unmapped** (no silent insertion into the canonical sheet).
- If the input file rewrites labels or reorders sections, CKC MUST ignore label/ordering and rely on Field IDs.

#### 4.5.3 Review panel (MUST)

Before any write to the canonical sheet, CKC MUST show an **Ingest Review Panel**:

- Table view with columns:
  - `FieldID`
  - `Current value` (canonical)
  - `Proposed value` (from ingest)
  - `Change type` (`add` | `modify` | `same` | `blank` | `invalid`)
  - `Apply?` checkbox (default behavior defined below)
- A separate “Unmapped” list showing unknown Field IDs and their raw lines.

**Default checkbox policy (MUST be deterministic):**
- `modify` and `add` default to **checked**
- `same` defaults to **unchecked**
- `blank` defaults to **unchecked** (blank never overwrites by default)
- `invalid` defaults to **unchecked** (requires explicit user action)

CKC MUST allow:
- “Check all adds”
- “Check all modifies”
- “Uncheck all”
- Filtering by section / by change type

#### 4.5.4 Apply behavior (MUST)

- CKC MUST apply updates only for fields that are checked.
- CKC MUST NOT partially apply and then export a modified file if any **hard-fail** validation triggers for checked fields (unless user explicitly overrides validation mode).
- After apply:
  - CKC MUST create a new **Sheet Version** entry (see versioning requirements).
  - CKC MUST update search index/tag derivations.
  - CKC MUST leave gallery links unchanged (gallery binds to character, not sheet version).




## 4.X Productivity automations (deterministic)

This section defines deterministic workflow automations intended to reduce manual work. These features MUST NOT introduce any AI/LLM behavior and MUST preserve the integrity gates.

### 4.X.1 Template spin-offs (“Field Packs”) (MUST)

**Goal:** Export/import deterministic “spin-off artifacts” derived from the canonical template, optimized for external completion (including external LLMs) and safe ingest back into CKC.

A **Template Spin-off / Field Pack** is:
- bound to a canonical `template_id`
- defined as an ordered list of **Field IDs**
- rendered in a strict, LLM-friendly line format
- ingestable by CKC using **Field ID** keys only

#### 4.X.1.1 Built-in LLM-friendly spin-off (MUST for MVP)

CKC MUST include one built-in spin-off profile intended to work with safety-filtered LLMs: **LLM Pack (strict) — Safe Subset**.

- File format: `.txt`
- One field per line: `FIELD-ID: ` (blank value placeholder)
- No prose, no headings, no markdown
- Stable ordering (template order)

**Field set (MUST):**
- The Safe Subset MUST be a **curated whitelist** of Field IDs derived from template v2.00.
- The Safe Subset MUST exclude explicit/NSFW-only fields to minimize refusal/omission behavior in safety-filtered LLMs.
- The Safe Subset definition MUST be deterministic and shipped with CKC as a first-class artifact (e.g., a built-in `TemplateSpinOff` entry or a manifest file listing Field IDs in order).

Optional variants (settings):
- include only empty fields (default SHOULD be ON)
- include selected sections (default OFF)
- include current values (default OFF; if ON, values are emitted byte-for-byte)

Example:
- `CHAR-ID-002: `
- `CHAR-PHY-001: `
- `CHAR-PSY-004: `


#### 4.X.1.2 Custom spin-offs (SHOULD; not required for MVP)

CKC SHOULD support user-defined spin-offs created via a **checkmark UI**:

- User selects a base template (typically the active canonical template).
- CKC shows the full field list (by section) with checkboxes.
- The saved spin-off consists of exactly the selected Field IDs, in deterministic order.

Custom spin-offs MUST be:
- **saveable** with a name (e.g., `LLM_pack_physical_only`)
- **reusable** across characters that share the same `template_id`
- **searchable** in the app (“search field template spin-offs”)

Rules:
- A custom spin-off MUST NOT contain Field IDs not present in its base template.
- CKC MUST record the template hash used at creation time; if the base template changes, CKC MUST flag the spin-off as “may be out of date” (no silent mutation).

#### 4.X.1.3 Export location and naming (MUST)

Recommended per-character pack path:
- `LibraryRoot/characters/<CharacterID>/packs/<PackName>/`
  - `<YYYYMMDD_HHMMSS>_<packname>.txt`

#### 4.X.1.4 Ingest contract (MUST)

- CKC ingest MUST parse Field Packs by **Field ID only**.
- Unknown/unmapped Field IDs MUST be reported and MUST NOT be inserted into the canonical sheet.
- Blank values MUST NOT overwrite existing values by default.
- Applying a pack MUST route through the **Ingest Review Panel** and create a new **SheetVersion** on apply.

#### 4.X.1.5 Safety rules (MUST)

- Pack export MUST include Field IDs only from the referenced template.
- Pack export MUST NOT rewrite or “sanitize” content; if current values are included, they MUST be emitted byte-for-byte.

### 4.X.2 Ingest Review Panel automation controls (MUST)

CKC MUST implement selection accelerators to reduce click burden in the ingest review panel:

- “Select all adds”
- “Select all modifies”
- “Select all non-empty proposed values”
- “Unselect all”
- “Invert selection”
- “Select only this section” (scope selection by section)
- Filter view by change type (`add|modify|same|blank|invalid`)

These controls MUST be deterministic and MUST never apply changes without the user explicitly triggering Apply.

### 4.X.3 Protected fields / default-lock list (MUST)

CKC MUST support a configurable list of **Protected Field IDs** that are treated as “hard to overwrite” during ingest.

Rules:
- Protected Field IDs MUST default to **unchecked** in ingest review, even if `add/modify`.
- CKC MUST display a “Protected” indicator in ingest review for these fields.
- CKC MUST provide quick actions:
  - “Unlock protected fields for this ingest” (session-scoped)
  - “Edit protected fields list” (global and per-character overrides)

### 4.X.4 Field coverage dashboard (SHOULD)

CKC SHOULD provide a deterministic completion dashboard per character:

- Overall coverage: `filled_fields / total_template_fields`
- Coverage per section
- “Next missing field” navigation:
  - jump to next empty field
  - jump to next empty field in current section
- Optional filters:
  - include/exclude optional fields
  - include/exclude specific sections

### 4.X.5 One-click folder scaffolding (MUST)

CKC MUST provide one-click creation/repair of the per-character folder layout:

- Ensure required directories exist (`sheet/`, `sheet/versions/`, `images/original/`, `images/thumb/`, `exports/`, `extras/`)
- Ensure canonical filenames exist (e.g., `sheet/character.md` or configured format)
- MUST NOT delete user content, especially under `extras/`
- MAY provide a “Fix missing thumbnails” action (non-destructive regeneration)

---

## 8.X Search, tags, and reuse accelerators (deterministic)

### 8.X.1 Saved searches / smart filters (SHOULD)

CKC SHOULD support saved searches that capture:
- text query
- scope flags (IDs / labels / values / tags / all)
- tag filters
- gallery filters (favorite/rating) if enabled in library view

Saved searches MUST be deterministic and must apply exactly the stored filters.

### 8.X.2 Tag templates / quick-apply bundles (SHOULD)

CKC SHOULD support tag bundles (templates) to apply consistent tag sets quickly, e.g.:
- `project:<name>`
- `status:<draft|final|archived>`
- `role:<...>`

Rules:
- Applying a tag template MUST be explicit user action.
- Tag templates MUST be stored locally and versioned by name.

### 8.X.3 Frequency-based suggestions (MAY)

CKC MAY suggest common tags/values based on local database frequency (no AI). This feature MUST:
- be deterministic
- not auto-apply without user action
- never rewrite existing values

---

## 11.X Gallery automation features (deterministic)

### 11.X.1 Duplicate detection on image import (SHOULD)

On image import, CKC SHOULD compute a file hash and detect duplicates per character:

- If a duplicate is detected, CKC SHOULD warn and offer:
  - “Skip import”
  - “Keep both” (renamed deterministically)
- Duplicate detection MUST NOT delete existing images.

### 11.X.2 Thumbnail generation queue (SHOULD)

CKC SHOULD generate thumbnails on import and/or via a repair action:

- Implement as a simple deterministic queue with progress indication.
- Thumbnail regeneration MUST be safe and non-destructive.

### 11.X.3 Gallery keyboard workflow (SHOULD)

CKC SHOULD support keyboard shortcuts in the gallery:

- `F` toggle favorite
- `1–5` set rating
- `0` clear rating
- arrow keys navigate items
- `Enter` open image in OS viewer

Shortcut behavior MUST be deterministic and clearly documented in UI help.

---

## 12.X Versioning convenience operations (deterministic)

### 12.X.1 Field-level revert (SHOULD)

CKC SHOULD support reverting a single field to its value from a selected prior version:

- Revert MUST create a new SheetVersion (no destructive rewrite).
- Revert MUST be visible as a staged change before applying.

### 12.X.2 Version diff view (SHOULD)

CKC SHOULD support a FieldID-level diff between two versions:

- Show only changed Field IDs by default
- Allow expanding to see old/new values
- Never rewrite values; diff is a view-only presentation

---

## 13.X Export automation (deterministic)

### 13.X.1 Export bundle (MUST)

CKC MUST provide a one-click “Export bundle” action per character:

- Export TXT + MD + PDF according to settings
- Write artifacts to the per-character `exports/` folder (and optionally to a shared LibraryRoot `exports/`)
- Export MUST respect all integrity gates (no rewrite/redaction; stable formatting)
- Export MUST be explicit user action (no background auto-export unless user enabled it)

### 13.X.2 Markdown image linking (MAY)

For MD export, CKC MAY optionally emit links to character images (without embedding binary data), e.g. a gallery section with relative paths. This MUST be opt-in and MUST not alter core sheet content.


## 5. Folder system and on-disk layout

### 5.1 Library Root (MUST)

User sets a Library Root folder (one-time, changeable in Settings). The app stores:

- `LibraryRoot/`
  - `db/` (SQLite)
  - `templates/`
  - `characters/`
  - `exports/` (optional shared export area)

### 5.2 Per-character folder layout (MUST be deterministic)

Recommended deterministic layout:

- `LibraryRoot/characters/<CharacterID>/`
  - `sheet/`
    - `character.md` (or `.txt`)
  - `images/`
    - `original/` (imported copies)
    - `thumb/` (generated thumbnails)
  - `exports/`
    - `character.txt`
    - `character.md`
    - `character.pdf`
  - `extras/` (user misc files; not touched by app unless explicitly imported)

Rules:
- The app MUST NOT delete user files in `extras/`.
- The app MAY regenerate `thumb/` as needed.
- The app MUST keep filenames stable unless the user requests renaming.

### 5.3 Adopt vs reference (optional capability)

Default behavior SHOULD be “copy into character folder” on import.  
The app MAY provide a setting to reference images by absolute path, but MUST warn about portability and broken links.

---

## 5.X Sheet versioning

CKC MUST support **per-character sheet versioning**.

### 5.X.1 Version scope (MUST)

- Versions apply to the **sheet content** (field/value state).
- The **gallery is linked to the character record**, not to a sheet version:
  - Image assets, favorite flags, and ratings MUST persist across sheet versions.

### 5.X.2 Version creation triggers (MUST)

CKC MUST create a new version when:
- user clicks Save after edits in the GUI
- an ingest session is applied
- a patch update via Field ID paste is applied

### 5.X.3 Version storage (MUST)

CKC MUST store:
- `version_id` (UUID)
- `character_id`
- `created_at`
- `source` (`ui_edit` | `ingest` | `paste_patch` | `import`)
- `parent_version_id` (optional)
- `sheet_bytes_hash` (hash of exported canonical sheet bytes)
- `export_path` (path to the version snapshot file)

Recommended on-disk layout addition:

- `LibraryRoot/characters/<CharacterID>/sheet/versions/`
  - `<YYYYMMDD_HHMMSS>_<hash>.md` (or `.txt`)

### 5.X.4 Revert and diff (SHOULD)

- CKC SHOULD support viewing diffs between two versions (FieldID-level diff).
- CKC SHOULD support reverting to a prior version (creates a new version; no destructive rewrite of history).




## 6.X Template contract (v2.00)

### 6.X.1 Template source (MUST)

- CKC MUST support loading the canonical character sheet template **v2.00**.
- CKC MUST record per-character:
  - `template_id`
  - `template_version` (e.g., `v2.00`)
  - `template_hash`

### 6.X.2 Field line rule: ID + descriptor on the same line (MUST)

This rule is **operator-facing** and exists to prevent confusion about what a Field ID means.

- CKC MUST display the **Field ID** and its **descriptor/label** on the **same line** in all operator-facing views:
  - editor form headings
  - ingest review panel rows
  - diff views
  - template spin-off selection UI
- If the UI cannot fit the full descriptor, CKC MUST keep it on the same line and MAY ellipsize the descriptor and/or show the full descriptor in a tooltip/detail pane.
- CKC MUST NOT wrap the descriptor onto a new line separate from its Field ID.

### 6.X.3 Parsing tolerance (MUST)

- CKC MUST parse Field IDs robustly even if the input file uses different dash separators (`—` vs `-`), extra whitespace, or reordered sections.
- CKC MUST key all extraction/updates by **Field ID**, never by descriptor text.


## 6. File formats and serialization rules

### 6.1 Supported inputs

- Template files: `.txt` and/or `.md` containing field lines and block schemas.
- Sheet files: `.txt` and/or `.md`.

### 6.2 Output formats

- TXT export: plain text, template-order, field lines preserved.
- MD export: same structure, optionally with markdown headings.
- PDF export:
  - MUST render a readable, paginated document.
  - MUST preserve exact text content (no rewriting).

### 6.3 Output determinism (MUST)

The exporter MUST:
- Preserve **section ordering** as in the template.
- Preserve **Field ID + label text** exactly as in the template.
- Only replace the **value portion** after the colon when updating fields.

#### Lists
- Default serialization SHOULD be JSON arrays on one line:
  - `CHAR-PREF-001 — Likes: ["coffee", "rainy days"]`

#### Blocks
- Repeated blocks MUST serialize in a deterministic, consistent structure.
- Minimum requirement: the app MUST round-trip blocks without losing data.

### 6.4 Formatting preservation (update safety)

When applying updates to an existing sheet file:
- The app MUST preserve all non-field lines verbatim.
- The app MUST preserve whitespace and punctuation around the Field ID and label.
- The app MUST treat `—` (em dash) and `-` (hyphen) as equivalent separators for parsing, but SHOULD emit the template’s canonical separator on export.

---

## 7. Template parsing and form generation

### 7.1 Template parser (MUST)

The parser MUST build an AST (abstract syntax tree) containing:

- Sections (header text)
- Field definitions:
  - `id` (e.g., `CHAR-ID-002`)
  - `label` (e.g., `Name`)
  - `type` (string/integer/list/descriptor/paragraph/score_10/enum/etc.)
  - `optional` flag (if labeled optional)
  - `enumValues` (if any)
- Block schemas:
  - block name
  - list of block fields
- Repeaters:
  - fields that are lists of blocks (e.g., “Languages: <list of Language_Block | optional>”)

### 7.2 Field type inference (SHOULD)

The template’s `<...>` type expression SHOULD be interpreted as:

- `<string>` → single-line textbox
- `<integer>` → numeric textbox (int)
- `<number>` → numeric textbox (float)
- `<paragraph>` → multi-line textbox
- `<descriptor>` → single-line textbox + DQR validation (word count, etc.)
- `<score_10>` → numeric 0..10 or string `x/10` depending on rule; prefer storing/displaying `x/10`
- `<list>` → list editor
- `<list of X_Block>` → block-list editor
- `<a | b | c>` → editable dropdown (enum)

### 7.3 UI control mapping (MUST)

- Enum → **editable ComboBox** (dropdown + free typing)
- List → list editor with add/remove; item is always a textbox
- Block list → “Add block” button; each block is a collapsible panel
- Unknown type → fallback to textbox (never block editing)

---

## 8. Smart tags

### 8.1 Tag model

Tags are `key:value` strings (recommended), e.g.:

- `group:IVE`
- `role:idol`
- `template:v2.00`

Two tag types:
- **Manual tags**: user-managed
- **Derived tags**: rule-managed (read-only in UI, but user can disable rules)

### 8.2 Derivation rules engine (MUST be deterministic)

A rule is:

- `rule_id`
- `source_field_id`
- `match_type`: `equals | contains | regex`
- `pattern`
- `emit_tag`

Rules run:
- On save
- On explicit “Recompute Tags”

Rules MUST be applied in a stable order (e.g., rule_id sort) to keep outputs deterministic.

### 8.3 “Smart suggestions” without AI (ALLOWED)

The app MAY suggest tags and common values based on:
- Existing values in the local DB (frequency-based).
This MUST be implemented with deterministic logic (no model inference).

---

## 9. Search and filtering

### 9.1 Search requirements (MUST)

The app MUST support search across:

- **Field IDs** (e.g., searching `CHAR-ID-002` matches that field)
- Field labels (e.g., “Name”)
- Field values
- Tags (manual + derived)
- Character display name

Search MUST support:
- substring match
- token match (split on whitespace/punctuation)

The app SHOULD provide:
- “Search scope” toggles (Fields / IDs / Tags / All), default: All.

### 9.2 Fast index strategy (recommended)

Use a precomputed “search blob” per character:
- Concatenate `FieldID=Value` lines into a single text field.
- Rebuild on save.
- Optionally use SQLite FTS for fast search.

---

## 10. Validation (deterministic)

### 10.1 Validation triggers

- Validate on field edit (inline) and on Save (blocking).
- Provide “Save anyway” only if user enables a setting; default SHOULD block on hard violations.

### 10.2 Core validation checks (MUST)

- Enum fields:
  - If user types a non-enum value, it is allowed (per requirement), but the validator MUST flag it as “non-canonical enum value”.
- `<integer>` fields:
  - Must parse as integer if non-empty.
- `<score_10>` fields:
  - Must be `0/10..10/10` (or `0..10` if user prefers input; app stores normalized `x/10`).
- `<descriptor>`:
  - MUST enforce configured word count (default: 2–12 words) when in strict mode.
- Lists:
  - SHOULD warn when an item is excessively long (indicates paragraph drift).

Validation modes:
- `advisory`
- `strict`
- `hard-fail`

---

## 11. Data model (local database)

### 11.1 Storage requirements

- Local-only DB (default under Library Root).
- Backups: optional automatic periodic backups (daily/weekly).

### 11.2 Recommended schema (SQLite)

**Character**
- `character_id` (UUID, primary key)
- `display_name` (string)
- `template_id` (string)
- `created_at`, `updated_at`

**SheetFile**
- `character_id` (FK)
- `path` (string)
- `format` (`txt` | `md`)
- `raw_text` (optional cached content)
- `last_export_hash` (string)

**FieldValue**
- `character_id` (FK)
- `field_id` (string)
- `value_text` (string; serialized)
- `value_type` (string)
- `updated_at`

**Tag**
- `tag_id` (UUID)
- `tag_text` (`key:value`)

**CharacterTag**
- `character_id` (FK)
- `tag_id` (FK)
- `tag_type` (`manual` | `derived`)

**Template**
- `template_id` (string)
- `version_label` (string)
- `source_path` (string)
- `template_hash` (string)
- `ast_json` (json)

**ImageAsset**

**SheetVersion**
- `version_id` (UUID, primary key)
- `character_id` (FK)
- `created_at` (datetime)
- `source` (`ui_edit` | `ingest` | `paste_patch` | `import`)
- `parent_version_id` (UUID; optional)
- `export_format` (`txt` | `md`)
- `export_relative_path` (string; under character folder)
- `sheet_bytes_hash` (string)
- `notes` (string; optional)

**IngestSession**
- `ingest_id` (UUID, primary key)
- `character_id` (FK; optional if “create new”)
- `template_id` (string)
- `input_path` (string)
- `input_hash` (string)
- `created_at` (datetime)
- `status` (`staged` | `applied` | `aborted`)
- `unmapped_count` (int)
- `proposed_change_count` (int)


**ProtectedField**
- `protected_id` (UUID, primary key)
- `scope` (`global` | `character`)
- `character_id` (FK; nullable)
- `field_id` (string)
- `created_at` (datetime)
- `notes` (string; optional)

**SavedSearch**
- `search_id` (UUID, primary key)
- `name` (string)
- `query_text` (string)
- `scope_flags` (json; e.g., `{ "ids": true, "labels": false, "values": true, "tags": true }`)
- `tag_filters` (json list)
- `created_at` (datetime)
- `updated_at` (datetime)


**TemplateSpinOff**
- `spinoff_id` (UUID, primary key)
- `template_id` (string)
- `template_hash_at_create` (string)
- `name` (string; unique per template_id)
- `description` (string; optional)
- `field_id_list` (json array of Field IDs, in order)
- `format` (`llm_pack_strict` | `fieldpack_with_values`)
- `created_at` (datetime)
- `updated_at` (datetime)
- `is_builtin` (bool)


**TagTemplate**
- `template_id` (UUID, primary key)
- `name` (string; unique)
- `tags` (json list of `key:value`)
- `created_at` (datetime)
- `updated_at` (datetime)


**IngestProposedChange**
- `ingest_id` (FK)
- `field_id` (string)
- `current_value_text` (string)
- `proposed_value_text` (string)
- `change_type` (`add` | `modify` | `same` | `blank` | `invalid`)
- `is_selected` (bool)

- `image_id` (UUID, primary key)
- `character_id` (FK)
- `relative_path` (string; relative to character folder)
- `file_hash` (string; for dedupe)
- `width`, `height` (int; optional)
- `added_at` (datetime)
- `favorite` (bool)
- `rating` (int; 0..5)
- `notes` (string; optional)

### 11.3 Change history (optional but recommended)

If enabled:
- Store field-level diffs in `AuditLog`:
  - who/what changed, when, old value, new value, source (UI vs paste patch)

---

## 12. Architecture and tech stack

### 12.1 Recommended stack (Windows-native)

- **Language/runtime:** C# + .NET 8
- **UI:** WPF (MVVM) *or* WinUI 3
- **DB:** SQLite (with optional FTS)
- **Packaging:** MSIX

### 12.2 PDF export implementation options (non-AI)

- QuestPDF (C#) or iText7 (license considerations) for PDF generation.
- Requirement: export must be deterministic and preserve exact text.

---

## 13. UI/UX specification

### 13.1 Layout

- Left sidebar:
  - Character list
  - Search box
  - Tag filters
- Main area:
  - Section tabs/accordion
  - Generated fields UI (from template)
- Right panel (optional):
  - Live sheet preview (exact export text)
  - Validation panel

### 13.2 Key screens

1. **Library**
   - list + search + tags
2. **Character editor**
   - template-bound form + preview
3. **Gallery**
   - thumbnails grid + details
   - favorite toggle + 0–5 star rating control
4. **Template manager**
   - add/update templates
   - view parsed sections/fields
5. **Rules manager**
   - manage smart-tag rules
6. **Import/export**
   - import sheet
   - export sheet(s) to TXT/MD/PDF

---

## 14. Updating existing sheets (patch algorithm)

### 14.1 Parsing a sheet file

The parser MUST:
- Identify field lines by matching:
  - `^([A-Z0-9-]+)\s+—\s+(.+?):\s*(.*)$`
  - Accept both `—` and `-` as separator variants.
- Capture:
  - Field ID
  - Label text (stored but not used as key)
  - Value text (raw)

### 14.2 Applying updates

For each `(FieldID, newValue)`:
- If FieldID exists in template:
  - Replace value in internal model.
- Else:
  - Add to Unmapped list.

On export back to the sheet file:
- If field line exists:
  - Replace only the value text after `:`
- If field line does not exist:
  - Insert the field at its canonical location based on template ordering (optional feature; safe default is: do not insert, just keep in DB).

---

## 15. Configuration

A local config file (JSON) SHOULD include:

- Library Root path
- Default template
- Validation mode
- Export preferences (which formats; where)
- Auto-backup settings
- Thumbnail generation settings
- Whether to store raw sheet text in DB

---

## 16. Desktop launch icon and install UX

- Installer MUST create (for CastKit Codex):
  - Start Menu entry
  - Application icon
- Installer SHOULD optionally create:
  - Desktop shortcut (user choice during install)
- App window icon MUST be set and consistent with installer icon assets.

---

## 17. Testing requirements

### 17.1 Unit tests (MUST)

- Template parser: enum extraction; block schemas; section ordering.
- Sheet parser: dash variants (`—` vs `-`); Field ID keyed extraction.
- Field packs: strict `FIELD-ID: ` emission; empty-only/section scoping.
- Ingest review: deterministic change classification; default checkbox policy; bulk toggles; protected Field ID behavior; unmapped reporting.
- Exporter: deterministic output; header-only normalization (when enabled); value replacement only.
- Versioning: version creation triggers; version hash stability.
- Gallery: metadata persistence; thumbnail generation determinism.

### 17.2 Golden-file tests (MUST)

Maintain a corpus of representative canonical CKC sheets (including explicit/adult sections and blocks).

- Round-trip Gate: canonical import → export (no edits) MUST be byte-identical.
- Template Completeness Gate: canonical export MUST contain every template Field ID.
- No-Redaction / No-Rewrite Gate: values remain byte-identical across save/export and remain searchable.
- Foreign/dirty ingest tests: correct extraction by Field ID; correct staging; no silent insertion of unmapped IDs.


## 18. Risks and mitigations

1. **Template drift / versioning**
   - Mitigation: store template hash + template_id in each character; provide migration UI.
2. **Parsing ambiguity (dash variants, user edits)**
   - Mitigation: tolerant parser, strict exporter, “unknown lines preserved”.
3. **Large template → UI performance**
   - Mitigation: virtualized controls, section-by-section rendering, lazy load blocks.
4. **On-disk portability**
   - Mitigation: default “copy-in” for images; store relative paths; allow Library Root move tooling.

---

## 19. Acceptance criteria (minimum viable)

1. Create a character from template v2.00 and export a canonical sheet file.
2. Import a canonical sheet, make no edits, and export: output MUST be byte-identical (**Round-trip Gate**).
3. Import a canonical sheet, edit 3 fields, export: only the value portions for those Field IDs changed; unrelated lines unchanged.
4. Paste 10 Field ID updates: 8 apply; 2 show as unmapped; user can export.
5. Enum fields render as editable dropdowns (dropdown + free typing).
6. Library search finds matches across **Field IDs**, labels, values, and tags.
7. Folder system scaffolding creates/repairs the per-character folder layout without deleting user files.
8. Gallery: import 20 images; thumbnails render; favorite + 0–5 rating persist across restarts.
9. Sheet versioning: each save/ingest/patch produces a new SheetVersion; gallery metadata persists across versions.
10. Ingest Review Panel: ingest a “dirty” sheet, review staged changes, apply only checked fields; unchecked fields remain unchanged.
11. LLM Pack (strict) — Safe Subset (MUST for MVP): export `FIELD-ID: ` lines for the curated whitelist, ingest back, review + apply works without schema loss.
12. Template Completeness Gate: canonical export contains every Field ID present in the active template (even if blank).
13. No-Redaction / No-Rewrite Gate: export + search index are byte-for-byte stored values (unless user enabled explicit normalization mode).
14. Export bundle: one click produces TXT+MD+PDF and respects all integrity gates.
15. Descriptor-on-same-line rule: operator views never split descriptors from their IDs (ellipsis/tooltip allowed).


## X. Integrity gates (BUILD BREAKS)

These gates are **mandatory**. Any failing gate MUST fail the build/CI and MUST block release.

### X.1 Template Completeness Gate (MUST)

- On canonical export (TXT/MD/PDF), the output MUST contain **every Field ID** defined in the active template, in template order.
- A field MAY be blank/placeholder, but it MUST NOT be omitted.
- For list/block fields, the parent Field ID line MUST exist even if the list is empty.

### X.2 No-Redaction / No-Rewrite Gate (MUST)

- The exporter and search index builder MUST use **byte-for-byte** the stored value text for each field.
- CKC MUST NOT:
  - mask content (e.g., `***`, `[redacted]`)
  - euphemize or synonym-swap
  - apply case-folding, profanity filtering, or “safe language” substitutions
  - normalize whitespace within field values
- Any “Normalization Mode” MUST be:
  - OFF by default
  - explicit user opt-in
  - limited to header-only normalization and newline normalization
  - covered by tests

### X.3 Round-trip Gate (MUST)

- **Canonical round-trip:** importing a canonical CKC sheet and exporting without edits MUST be **byte-identical**.
- **Foreign/dirty inputs:** round-trip identity is NOT required for foreign “dirty” files; they MUST be handled via **Ingest → Review → Apply → Canonical export**.


## 20. Roadmap (suggested)

### Phase 1 — MVP
- Template parser + form renderer
- SQLite store
- Import/export (TXT/MD)
- Loose-ID patch updates
- Basic tags + search
- Folder system (Library Root + per-character folders)
- Gallery (import + view + favorite + rating)

### Phase 2 — Quality
- Audit log
- FTS search
- Rule-based smart tags UI
- Golden-file round-trip mode
- PDF export

### Phase 3 — Scale
- Bulk import/export
- Template migration tooling
- Plugin-like “field widgets” for complex block editors