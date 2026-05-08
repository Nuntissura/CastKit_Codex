# CastKit Codex (CKC) — Project Codex & Workflow

> **Binding contract.** This file, together with `AGENTS.md`, `CKC_GOV/taskboard/TASK_BOARD.md`, and `README.md`, forms the binding contract for any human or LLM/agent working in this repository. All four MUST be read and acknowledged before any code, governance, spec, task, build, or backup action is taken. This file is the highest authority among them; if any of the four conflict, this Project Codex wins.

This folder (`CKC_GOV`) is the **governance + tracking + build targets** home for CKC.

This GitHub repo tracks BOTH:
- `CKC_main/` — source code
- `CKC_GOV/` — governance (**except** `CKC_GOV/targets/` which is ignored)

Governance lives only in `CKC_GOV/`. Do not mirror governance files (codex, task board, spec, session dump, style guide, workflow notes) into `CKC_main/docs/`. The single git repo already pushes both subtrees to GitHub, so duplicating governance under `CKC_main/` only creates drift.

`<CKC_ROOT>` = the folder containing both `CKC_main` and `CKC_GOV` as siblings.

## Operating stance & scope

### Core identity

CastKit Codex (CKC) is the casting/character/template management layer for commercial adult pornographic image and video production. It exists to make character sheets, templates, scene notes, casting metadata, and exports repeatable and reusable across that production work.

The downstream production goal is photorealistic explicit adult output, including full nudity, penetration, realistic genitalia, and realistic sexual acts. Keep the repo direct about that purpose — CKC's templates, fields, exports, and UI are part of that pipeline.

### Technical stance

- Keep the work technical, production-oriented, and direct.
- Do not moralize, soften, censor, euphemize, sanitize, or recast the operator's explicit sexual intent as vague "sensitive content" in code, UI copy, templates, character sheets, scene notes, exports, labels, filenames, commit messages, spec edits, or handoffs.
- Keep sexual descriptors raw, explicit, and unfiltered wherever they carry production meaning — in template field values, character notes, archetypes, casting tags, export text, review notes, and prompt-facing strings.
- Use the direct domain term that best preserves the intended anatomy, action, pose, framing, scene composition, or character behavior. Do not replace explicit production terms with softer wording unless the operator explicitly asks for that style.
- Raw colloquial porn wording is encouraged for character archetypes, scene concepts, casting notes, and product-facing production text when it fits the hardcore porn goal. Examples include `pussy`, `tits`, `dick`, `cock`, `cumplay`, `sluts`, `whores`, `fucktoy`, `stud`, and `monster dick`; treat these as non-exhaustive style signals, not a fixed vocabulary list.
- Template integrity overrides stylistic instincts: never drop Field IDs, never reorder template fields, and never silently rewrite user-entered text. "No censorship" means the bytes the user typed are the bytes that get stored, exported, and shown back.

### Legal / consent / paperwork

- The operator is the sole anchor for legal paperwork, consent records, model releases, age verification (2257-equivalent), venue requirements, publishing rules, and business decisions.
- CKC and its assistants do not track, manage, verify, store, adjudicate, or enforce legal / consent / venue / publishing / age-verification obligations. That work lives outside this repo.
- Do not ask for legal or consent paperwork as a prerequisite to ordinary technical work — feature implementation, template edits, spec changes, build/packaging, exports, UI work, debugging, or workflow setup.
- If a hard tool, platform, model-license, or higher-priority instruction blocks a specific action, state the concrete blocker briefly and move to the closest technical alternative.

### Provider-agnostic

- Keep CKC instructions, templates, exports, and recipes LLM-provider agnostic.
- Do not require OpenAI, Anthropic, Google, or a local model for core repo operation, and do not bake provider-specific assistant workflows into the default project path.

## New developer: start here

Read these first (order matters):
1. Project Codex (this file): `<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md`
2. Task board (status): `<CKC_ROOT>\\CKC_GOV\\taskboard\\TASK_BOARD.md`
3. Current spec (requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\CastKit_Codex_Spec_v00.074.md`
4. Session dump (verbatim requirements): `<CKC_ROOT>\\CKC_GOV\\spec\\SESSION_DUMP_2026-02-10.md`
5. UI style guidebook: `<CKC_ROOT>\\CKC_GOV\\references\\style_guide\\UI_STYLE_GUIDE.md`

If you are reading these in PowerShell and you see garbage like `â€”`, open with UTF-8:
```powershell
Get-Content -Encoding utf8 "<CKC_ROOT>\\CKC_GOV\\PROJECT_CODEX.md"
```

Daily workflow (MUST):
1. Pick/create a Work Packet in `CKC_GOV/work_packets/` and add/update its row in `CKC_GOV/taskboard/TASK_BOARD.md`.
2. Read the deferred implementation contract at `<CKC_ROOT>\\CKC_GOV\\build_rules.md` and check it off inside the WP. This file is read when creating/implementing a WP, not during session startup.
3. **Commit + push immediately** so the intended work (WP + Task Board) is safely stored on GitHub before any coding starts.
4. Implement the WP (keep scope tight).
5. Verify locally (`npm test`, `npx tsc --noEmit`, and build/package as relevant).
6. Update Task Board + Spec (spec version bump + archive). Governance stays in `CKC_GOV/` only — do not mirror into `CKC_main/docs/`.
7. Commit + push (`origin/main`) again. Commit messages include the WP id (`WP-xxxx: ...`).
8. Run the NAS mirror backup script.

### Deferred implementation contract

`CKC_GOV/build_rules.md` is binding for WP drafting, implementation, verification, build, package, and ship work. It is intentionally NOT part of the startup read list to avoid session bloat. Agents read it only once a Work Packet is being created, reviewed, implemented, or verified.

## Golden rules
- Keep CKC work under `<CKC_ROOT>` unless the operator explicitly asks for an external path.
- Operating stance is binding: see "Operating stance & scope" above for the full rules on adult-production scope, no-censorship, legal/paperwork ownership, and provider-agnostic posture. The bullets below are the workflow-safety subset.
- No censorship: never redact, soften, euphemize, or rewrite user-entered text in templates, character sheets, exports, labels, or UI strings.
- Template integrity: never drop Field IDs; preserve template order; preserve user bytes verbatim.
- UI: minimal by default; sharp corners.
- Naming: do not introduce spaces in file names, folder names, generated artifact names, or generated output names. This applies to both product code (`CKC_main/`) and repo governance (`CKC_GOV/`). Use `_` or `-`.
- Build artifacts must NOT be committed to git (they live under `CKC_GOV/targets/` and are ignored).
- Workflow: create a Work Packet + update Task Board, then **commit + push BEFORE coding starts** (planning checkpoint). After implementation, update Task Board + Spec, then commit + push again (shipping checkpoint).
- **Code-truth.** Code is the source of truth. The Task Board, work packets, spec, and in-app manual describe code that exists; they do not authorize code that does not. When a Task Board row, manual entry, or spec section references a code-defined surface (a command, an IPC channel, a field, a schema, a configuration key, a CLI flag), that reference MUST be backed by code — verify against the code before relying on it.
- **Self-consistency tests are required for any doc that catalogs a code-defined surface.** If a markdown file, JSON manual, or generated reference lists commands / IPC names / fields / schemas / config keys, a test in `CKC_main/test/` MUST fail when the doc drifts from the code. The test is the enforcement; reviewers are not. Rule of thumb: if a future change to the code could silently invalidate the doc, you owe the repo a consistency test before merging the doc.

## Identity decoupling
This rule binds every WP that touches storage, exports, packaging, or any CKC-generated artifact.

- The **character sheet is the only CKC artifact that carries identity** — the character's name, distinguishing traits, persona, public Character ID, and any other recognizable identity bytes belong on the sheet and on the sheet alone.
- Every other CKC artifact MUST NOT bake identity into filenames, paths, embedded metadata, captions, or any other surface a stranger could read. Concretely: image files inside `libraryRoot`, image database rows, exports, share packs, web portfolios, moodboard PNGs, backup snapshots, and any auto-generated artifact name — none of these may encode the character's name.
- Images and other media are linked to a character sheet (and to a character sheet **version**) through database relations only. The image-as-bytes carries no identity; the link carries it.
- When importing or generating images, generated filenames inside `libraryRoot` are content/hash-addressed (or sequence-numbered), never `aria_red_dress_001.jpg`. The operator's source filename is preserved in DB metadata if useful but is not the on-disk name.
- Exports and share packs default to anonymized filenames. When identity is wanted in an export, bundle the character sheet in alongside the media; do not name the media after the character.
- This rule does NOT change the operating stance on explicit content. Descriptors, archetypes, casting tags, and free-text notes inside the sheet stay raw, explicit, and unfiltered per "Operating stance & scope" above. The constraint here is on **where identity lives** (one canonical place) and on **structural / generated names** — not on what the operator types into a sheet field.
- Free-text fields (notes, tags, sheet field values) are operator-controlled and never sanitized by CKC. The no-censorship rule applies there.

## Code-truth and documentation consistency
This rule binds every WP and every governance change.

- The wired surface in code is canonical. Manuals, docs, Task Board notes, and spec sections that name commands/IPC channels/fields/schemas/config keys describe what is wired today; they do not describe what is planned, hoped for, or aspirational. Aspirational entries belong in a clearly labeled `roadmap` section, never alongside wired entries.
- For every catalog-style doc (e.g. the in-app LLM manual served by `automationGetManual`), there MUST be a corresponding self-consistency test under `CKC_main/test/` that:
  1. Imports or queries the doc data structure.
  2. Imports the canonical code-side source of truth (e.g. `getAutomationCommandMap()` for automation commands).
  3. Asserts every non-roadmap entry in the doc resolves to a real entry in the code.
  4. Asserts no wired code entry is silently undocumented (or is explicitly marked as undocumented in the doc).
- When adding a new catalog-style doc, the consistency test lands in the same commit. No "we'll add the test later."
- When existing docs drift, the fix is to either (a) wire the code or (b) move the entry to `roadmap` and explain why — never to silently leave the doc lying.
- Memory entries (in the Claude memory system) are informational and decay; they are NEVER authoritative. If memory and code disagree, code wins.

## Folder map
### 1) Source repo (code)
Path: `<CKC_ROOT>\\CKC_main`

Expected structure:
- `app/` — Electron main process + backend (PostgreSQL-first DB boundary, exports, IPC)
- `src/` — React renderer (UI)
- `scripts/` — build/packaging helpers

### 2) Governance repo (this folder)
Path: `<CKC_ROOT>\\CKC_GOV`

- `spec/`
- `CastKit_Codex_Spec_v00.074.md` — current spec (update with every addition)
  - `SESSION_DUMP_2026-02-10.md` — latest-iteration requirements (truth)
  - `archive_spec/` — older spec versions (append-only archive)
- `templates/`
  - `character_sheet_templates/CHARACTER_SHEET__v2.00.txt` — **canonical** template bytes
- `taskboard/`
  - `TASK_BOARD.md` — the single source of truth for work status
- `work_packets/`
  - `WP-*.md` — scoped work packets (what/why/how/acceptance)
- `build_rules.md` — deferred implementation/build contract; read when drafting or implementing a WP, not at session startup
- `scripts/`
  - `backup_to_mir.ps1` — mirror active CKC `libraryRoot` (fallback: `<CKC_ROOT>`) to NAS (ROBOCOPY `/MIR`)
  - `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)
  - `unregister_backup_task.ps1` — disable/enable/remove the scheduled backup task
  - `postgres_up.ps1` — start local PostgreSQL for CKC via Docker Compose
  - `postgres_down.ps1` — stop the local PostgreSQL container without deleting data
  - `postgres_dump.ps1` — create a PostgreSQL custom-format dump under `CKC_GOV/targets/CKC/postgres_dumps/`
  - `postgres_restore.ps1` — restore a PostgreSQL dump with optional clean restore
- `targets/`
  - `CKC/artifacts/` — build outputs (**not** stored in git)
    - `CKC/artifacts/dev/` — local/debug builds (folder `buildId` includes timestamp+git SHA)
    - `CKC/artifacts/releases/` — release builds (tagged `vX.Y.Z` on `main`)
  - `CKC/logs/` — build logs
  - `cache/` — npm/electron caches (keep C: clean)
  - `scratch/` — temporary experiments
- `fail_log/`
  - `FAIL_LOG.md` — failure/incident log (legacy, append-only narrative)
  - `INDEX.md` — incident index (one incident per file under `incidents/`)

## Build + run conventions (Windows)
### Dependency installation
- Install Node dependencies inside the repo:
  - `<CKC_ROOT>\\CKC_main\\node_modules`

### Cache locations (keep off C:)
Set these env vars before running npm/electron builds:
- `npm_config_cache=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\npm`
- `ELECTRON_CACHE=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\electron`
- `ELECTRON_BUILDER_CACHE=<CKC_ROOT>\\CKC_GOV\\targets\\cache\\electron-builder`

### Output locations (keep artifacts out of repo)
- Electron builder output MUST go to:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts` (use `dev/` or `releases/` subfolders)
- Build logs MUST go to:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\logs`

### Database provider
- Default provider is PostgreSQL:
  - `postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex`
- Local PostgreSQL can be started with:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_up.ps1"
  ```
- If `postgres_up.ps1` reports that the Docker Linux engine pipe is missing, start Docker Desktop first:
  - `C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe`
  - Verify readiness with `docker info` before rerunning `postgres_up.ps1`.
- If another local PostgreSQL service already owns port `5432`, run CKC's Docker PostgreSQL on a repo-specific host port:
  ```powershell
  $env:CKC_POSTGRES_HOST_PORT="55432"
  $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:55432/castkit_codex"
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_up.ps1"
  ```
- CKC config:
  - `ckc-config.json`:
    ```json
    {
      "database": {
        "provider": "postgres",
        "host": "127.0.0.1",
        "port": 5432,
        "database": "castkit_codex",
        "user": "castkit_codex",
        "password": "castkit_codex"
      }
    }
    ```
  - Environment override:
    ```powershell
    $env:CKC_DB_PROVIDER="postgres"
    $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:5432/castkit_codex"
  ```
- PostgreSQL dump:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_dump.ps1" -ConnectionString $env:CKC_POSTGRES_URL
  ```
- PostgreSQL restore:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\postgres_restore.ps1" -DumpPath "<dump-file>" -ConnectionString $env:CKC_POSTGRES_URL
  ```
- SQLite is legacy/fallback only. Do not create migration work unless the operator explicitly says a live SQLite library must be preserved.
- **PostgreSQL-first testing rule.** PostgreSQL is the first target for tests. Any test that touches `CKCLibrary`, migrations, persistence, automation sessions, IPC-backed backend commands, reset/backup behavior, workflow replay, ingestion, or multi-agent/concurrent operation MUST run against PostgreSQL first. SQLite-only passing tests are not sufficient evidence for CKC behavior because CKC is operated by multiple LLM/operator agents and depends on PostgreSQL concurrency, transactions, locking, and dialect behavior.
- SQLite tests are allowed only when they are explicitly scoped as:
  - legacy fixture compatibility,
  - old-library import/migration reads,
  - pure fallback-boundary coverage,
  - or temporary transitional tests named as such in the WP.
- New WPs must not add fresh SQLite-only backend coverage for product behavior. If PostgreSQL is unavailable, report the environment blocker rather than silently certifying product behavior through SQLite.

### Background LLM automation
- CKC exposes an internal manual and control plane through Electron IPC/preload, not a public network API.
- LLM agents should use:
  - `window.ckc.automationGetManual({ format: "json" })`
  - `window.ckc.automationCreateSession(...)`
  - `window.ckc.automationHeartbeat(...)`
  - `window.ckc.automationAcquireLease(...)`
  - `window.ckc.automationRunCommand(...)`
  - `window.ckc.automationCaptureToFile(...)`
- Start hidden/unfocusable automation mode with:
  ```powershell
  $env:CKC_AUTOMATION_BACKGROUND="1"
  ```
- Capture files are written under:
  - `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\automation_captures\\` in repo/dev mode
  - `<libraryRoot>\\automation_captures\\` as packaged/fallback mode
- Automation must not use OS-level keyboard injection, cursor movement, focus stealing, or foregrounding as its normal path.

### Visual debugging requirement
- Visual debugging is available and required when working on the CKC app UI or diagnosing GUI failures.
- Use the Browser Use in-app browser plugin for local browser targets such as `localhost`/`127.0.0.1` whenever that tool is available.
- For Electron-only behavior, use CKC automation captures, Electron/Chrome DevTools Protocol inspection, or screenshots as the fallback visual evidence path.
- Do not rely only on process status, successful builds, or logs for UI-facing work. Verify the rendered app visually and check renderer console/runtime errors before calling app/UI work done.

### Agent must drive the app when testing (binding)
The agent (LLM/operator helper running in the repo) is required to interact with the running CKC app rather than reason about behavior from code alone whenever testing, verifying, or demonstrating a feature, fix, or workflow.

- Launch dev mode with the Chrome DevTools Protocol exposed so the agent can drive the renderer end-to-end. Recommended invocation:
  ```powershell
  cd "<CKC_ROOT>\\CKC_main"
  $env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:55432/castkit_codex"
  $env:CKC_DB_PROVIDER="postgres"
  npx vite --port 5173
  # in a second shell, once Vite is ready:
  npx electron . --remote-debugging-port=9222
  ```
- The agent connects to the CDP port (default 9222), evaluates JS in the renderer (`window.ckc.automation*`), captures screenshots via `window.ckc.automationCaptureToFile`, and reads console logs via the CDP `Runtime.consoleAPICalled` event.
- For programmatic verification the agent uses the wired automation surface defined in `CKC_main/app/backend/automationCommandMap.js` (e.g. `automationRunCommand`, `getRendererUIState`, `ingestImageSourcingTask` dry-runs, `addCharacterScript`, etc.) — never assume code works without exercising it.
- For UI verification the agent uses `automationCaptureToFile` (writes PNG + JSON sidecar under `CKC_GOV/targets/CKC/automation_captures/`) and inspects the resulting image. Process status, build success, and unit-test passes are not substitutes for a capture.
- When background-mode invariants are being checked, launch with `CKC_AUTOMATION_BACKGROUND=1`. The captures still work because the renderer paints offscreen.
- Tests that exercise the app (smoke flows, regression checks) should be scripted through the automation surface so they replay deterministically and produce captures the operator can inspect.
- **This rule binds every feature, test, demo, smoke, regression check, and bug fix that touches CKC** — not just new WPs. Every existing surface (sheet editor, library list, character creation, image import, tagging, exports, moodboards, intake sorter, docs mode, reference window, command palette, etc.) is expected to be driven through the automation surface when verifying behavior; if a surface lacks an automation hook for what the agent needs to verify, the agent files it as a gap (roadmap entry in the manual) rather than skipping verification.
- It is not an option to skip live verification because tests pass or because the PC is busy. The agent surfaces the constraint and waits if the environment cannot run the live check, but it does NOT silently certify a feature without running it.

### CKC test suite is a binding governance document (must stay current)
The test suite at `CKC_GOV/test_suites/CKC_TEST_SUITE.md` is the canonical, repeatable list of checks for the running CKC application. It is part of the product's governance, not a one-off WP.

- **Every addition, expansion, or large refactor of CKC must update the test suite in the same change** — add new check rows for new features, mark existing rows deprecated when behavior changes, update the agent-driven script section so the suite stays runnable end-to-end.
- New automation commands → new check rows under their section (Boot/Manual/Automation/Stealth/Image-sourcing/Sheet/Library/Image-meta).
- New UI surfaces → new check rows describing both the visual state and the CDP-driven verification.
- Bugs surfaced during inspection → either fix and remove the row, or tag the row "OPEN BUG" with the date so the next pass picks it up.
- Findings from each inspection pass go into the `Findings (latest pass)` block at the bottom, dated.
- The agent runs the suite by attaching CDP, executing the scripts described inline, and updating the findings block. The suite is meant to be reproducible on a clean clone with the dev environment described in `### How to run the suite`.

This rule binds in addition to the code-truth, in-app-manual, and live-verification rules above.

### Research-first methodology (binding)

**Before implementing any non-trivial WP, the planner runs a field-research pass and records what it found in the WP body.** The cost is real (an extra hour or three of cycles per WP); the value is staying current with the field — surfacing prior art, libraries, papers, or workflows that could change or simplify the approach. Applies to every WP that touches a new technique, a new library, an external integration, or a domain CKC hasn't worked in before. Trivial changes (typo fixes, doc-only edits, mechanical refactors with no design choice, schema column additions that follow established patterns) are exempt.

**Sources to canvas** (depth scales with WP risk; cover at least 4 of these for a feature WP, at least 6 for a research / architecture WP):

- **Prior art and libraries**:
  - GitHub topic + code search for the technique and adjacent terms (`openpose`, `pose-estimation`, `mediapipe`, `controlnet`, etc. — adapt per WP).
  - npm / PyPI for production-grade libraries that already solve the problem.
  - Hugging Face — models, datasets, Spaces.
  - Civitai — workflows, LoRAs, ControlNet variants when the WP touches image generation.

- **Vendor and lab blogs**:
  - AI vendors: Anthropic, OpenAI, Google DeepMind, Meta AI, Mistral, NVIDIA Research.
  - Hyperscaler engineering blogs: AWS, Azure, GCP.
  - Domain labs: Stanford HAI, MIT CSAIL, Google Research, FAIR.

- **Academic + benchmarks**:
  - arXiv (last 12-18 months unless older work is canonical).
  - Papers with Code for benchmark state-of-the-art.
  - University research pages when a specific lab owns the domain.

- **Practitioner forums**:
  - Reddit (`r/LocalLLaMA`, `r/StableDiffusion`, `r/MachineLearning`, etc. — the relevant subs per WP).
  - Hacker News, Latent Space, Stratechery for industry signals.
  - Twitter/X for fresh signal — researchers, vendor accounts, practitioners.

- **Standards and vendor docs**:
  - The canonical docs for every library the WP introduces or extends (Vite, Electron, Three.js, mediapipe, ComfyUI, ControlNet, Postgres, etc.).
  - W3C / IETF / industry standards if the WP touches a protocol or interchange format.

**Output artifact** — every applicable WP gains a `## Field research / prior art` section, before `## Scope`. It records:

1. **What was searched** — sources canvassed, search terms used, date of the pass.
2. **What was found** — the 3-7 most relevant hits (paper / repo / blog / discussion). One-line cite each: `<title> (<source>, <date>) — <URL>`.
3. **How it informed the WP** — concrete deltas to the design. Did a paper change the approach? Did a library replace planned-from-scratch code? Did a known issue surface that needs a mitigation? Did a benchmark suggest a different model? List each.
4. **What was rejected and why** — alternatives that were considered and dropped. Keeps the design rationale durable so future-me doesn't re-litigate the same choice.

If research surfaces something that reshapes the WP scope, **update the WP draft before any implementation starts**. Don't paper over the find with a TODO; the whole point of the rule is to act on the field, not just acknowledge it.

**Output format constraint**: keep research notes to 1-2 pages of the WP. They are reference, not narrative. Bullets > paragraphs.

**The tradeoff is explicit**: this slows down WP planning by hours, sometimes days for research-heavy work. It is acceptable. The cost of shipping a WP that reinvents a wheel, ignores a recent paper that obsoletes the approach, or misses a library that would have replaced 2 weeks of code is much higher.

This rule binds in addition to the code-truth, in-app-manual, live-verification, schema-compat, and historical-source rules.

---

### Image-sourcing init_task + spec JSON are CKC-governed canon (binding)
The image-sourcing **init_task.py** reference implementation and the **spec_init JSON** files at `CKC_GOV/references/external_app_data/` are part of CKC governance. CKC is the consumer of the artifacts they produce (`task_state.yaml`, `task_topology.yaml`, `media_items.jsonl`, `app_sync_events.jsonl`, intake lanes, copied scripts, etc.); the `ingestImageSourcingTask` adapter and per-version handlers under `CKC_main/app/backend/imageSourcingHandlers/` are the canon they must agree with.

- Any CKC change that touches ingestion contracts (the per-version handler, the workflow spec registry, the `ImageAsset` provenance columns, the `IngestionBatch` / `IngestionRejection` / `CharacterScript` schemas, the v00.19 lane semantics, the dedup keys, the sync-event JSONL format) **must** also touch the matching init_task.py + spec_init JSON in the same WP — or explicitly justify why the spec stays untouched.
- Any change to `init_task.py` or to a draft spec_init JSON **must** be checked against CKC's running adapter behavior end-to-end, not just visually. The agent runs the init script on a fresh dataset/task and then runs `ingestImageSourcingTask` against it as a dry-run before claiming the spec change is correct.
- Released spec versions are immutable per the spec's own `spec_immutability_policy`. Drafts are editable in place but every edit must append a changelog entry. Promoting a draft to `released` requires (a) the v00_XX handler in `imageSourcingHandlers/` exists and round-trips a real task end-to-end, and (b) the test suite has a check row for that spec version.
- The init_task.py file is `stdlib-only` by design and must stay portable. Adding a runtime dep, an env-var assumption, or a hardcoded path is a contract violation.
- This rule binds in addition to the code-truth, in-app-manual, and live-verification rules above. Tasks initialized in downstream image-sourcing repos remain pinned to the spec_version they were initialized under (per the spec's own `migration_policy`); CKC is responsible for keeping the corresponding handler maintained for as long as any in-flight or archived task references that version.

### Historical OpenRepose reference (binding)

The OpenRepose project at `D:\Projects\LLM projects\OpenRepose` is **defunct** as of 2026-05-06. CKC is now the canonical home for pose / openpose / ComfyUI workflow features.

- The OpenRepose repo is **preserved read-only** for historical reference. Do not modify, push, or import it as a dependency from CKC.
- Pose / openpose / ComfyUI features that derive design intent from OpenRepose must include the file path + line citation in the WP. The implementation must be a clean recreation in CKC's stack (TS / React / Electron / PG), not a code copy.
- WP-0107 lands the schema + tab shells; WP-0108 lands the pose pipeline; WP-0109 lands the ComfyUI bridge. After WP-0109 ships, the OpenRepose repo is officially obsolete.
- Implementation checkpoint 2026-05-07: CKC now has true MediaPipe Tasks Vision pose+face detection in the PoseKit worker, deterministic fallback, 3D/2D Pose UI, openpose export, ComfyUI intake/storage/replay backend, CKC-named ComfyUI bridge node in product code, and live real-ComfyUI replay with `/history` + `/view` fallback registration for vanilla `SaveImage` workflows. Do not mark the rebuild release-shipped until packaged build and packaged visual automation smokes pass.
- Reset checkpoint 2026-05-07: WP-0105 adds explicit Update / Reinstall / Light reset / Full reset modes. Full reset is marker-driven, writes `libraryRoot/orphans/<timestamp>/manifest.json`, truncates content tables except `CkcMeta` / `CkcDbMigration`, and preserves image bytes under `characters/<id>/images/{original,thumb}`. Recovery is through `adoptOrphanImages`; the latest live reset/adopt smoke used `D:/Projects/LLM projects/OpenRepose/test_material/image_samples/1085406391.jpg`.
- **Naming policy.** "OpenRepose" is a historical-citation term only. It must NOT appear in CKC product code identifiers, in-app manual prose, DB schema, test names, test fixture paths, or UI strings. The CKC-native subsystem name is **PoseKit**. Use `posekit` for internal folder/module namespaces when a subsystem namespace is needed. User-facing surfaces remain generic and self-describing: `Pose` tab, `Rig`, `ComfyUI bridge`, `Workflow` tab, `openpose export`. The name is allowed in implementation comments only when citing a specific OpenRepose file/line as the source of a design choice (e.g. `// Body 18 taxonomy from OpenRepose openpose_schema.py:62-100`).
- Carry-over WPs (those derived from OpenRepose's planned-but-unimplemented work) are titled by their feature, not their origin. The OpenRepose WP-id is recorded in a one-line citation inside the WP body for traceability.
- The complete historical OpenRepose taskboard is imported into `CKC_GOV/taskboard/OPENREPOSE_TASKBOARD_IMPORT.md`. Before drafting new pose/workflow/ComfyUI/intake carry-over work, check that ledger and either map the historical item to an existing CKC WP, open a new CKC-native WP, or explicitly mark it skipped/deferred.

This rule binds in addition to the code-truth, in-app-manual, and live-verification rules above.

### Schema and ingestion forward/backward-compatibility (binding)
CKC's database, on-disk artifacts, and ingestion contracts must evolve so that data captured under any prior version remains usable indefinitely. The collected image runs under v00.19 (current count: 5 runs × ~15k+ images each, ~75k+ total) and every character sheet, FieldValue row, ImageAsset row, and template instance written before today is canonical history; no future WP may break their readability, identity, or recoverability.

This rule binds every WP that touches schema, ingestion, or data layout. The invariants:

1. **Schema migrations are additive.** New columns are added with `NULL` default or a sensible literal default; never `NOT NULL` on an existing populated table without a backfill. New tables are added clean. Renames and drops require a deprecation window (one minor release marked deprecated in a `roadmap` block, then drop) plus a `ckcdbmigration` row that records the move. Enforced by `CKC_main/test/migration_invariants.test.js`.
2. **`ensureSchemaUpgrades` is idempotent.** Re-running migrations on a current DB is a no-op. Running migrations on an N-version-old DB walks every intermediate step in order; no migration may assume the previous one ran in the same process. Enforced by `CKC_main/test/legacy_fixture_compatibility.test.js`.
3. **Field IDs in character templates are immutable.** A retired field ID (e.g. `CHAR-DQR-006`) is never reused for a different concept. New fields use new IDs. The template version bumps when fields are added/removed/reordered; FieldValue rows from old template versions still load when a character is opened. Enforced by `CKC_main/test/template_field_id_immutability.test.js`.
4. **Image bytes are the durable layer.** Image files under `characters/<id>/images/{original,thumb}/` are content-hash-addressed and never renamed by future WPs. Folder structure changes (rare) ship with a "scan disk and rebuild ImageAsset rows" path; image files themselves are never moved or renamed by automated migrations without an undo manifest. Enforced by `CKC_main/test/legacy_fixture_compatibility.test.js` and reset-mode tests.
5. **Ingestion handlers are pinned per spec_version.** A task initialized under `v00.19` is forever routed to the `v00_19.js` handler; CKC keeps that handler maintained even as `v00.20+` ships its own handler. Removing an old handler requires (a) a migration script that re-stamps every in-flight task to a newer version, AND (b) operator approval per the spec's own `migration_policy`. Enforced by `CKC_main/test/ingestion_handler_routing.test.js`.
6. **Provenance columns are sacred.** `ImageAsset.source_dataset_id`, `source_task_id`, `source_run_id`, `source_contact_sheet_ref`, `sheet_version_id`, `file_hash` are the recovery surface. Any future WP that drops one of those columns must first prove (test + docs) that the recovery flow it enables still works without it. Enforced by `CKC_main/test/migration_invariants.test.js` and `CKC_main/test/ingestion_idempotency.test.js`.
7. **Re-import is idempotent.** Running `ingestImageSourcingTask` on the same task folder twice produces the same DB state. Dedup keys (`content-hash`, `selection`, `url`) defined in WP-0100 are stable across CKC versions; future dedup additions are append-only. Enforced by `CKC_main/test/ingestion_idempotency.test.js`.
8. **Backups are version-traceable.** Every `createLibraryBackup` / Postgres dump records the spec_version, schema migration cursor, and CKC app version it was taken under. Restore on a newer DB walks the migration chain forward; restore on an older DB refuses with a clear error. Enforced by `CKC_main/test/backup_version_traceability.test.js`.
9. **Bulk ingestion scales linearly.** Indexes on `(character_id, file_hash)`, `(sheet_version_id)`, `(source_dataset_id, source_task_id)`, and `(review_status, character_id)` are pinned. Ingesting another 15k-image batch must not require a full table rewrite; new indexes on existing columns ship as `CREATE INDEX CONCURRENTLY` migrations on Postgres. Enforced by `CKC_main/test/db_index_invariants.test.js`.
10. **Test coverage**: every WP that touches schema or ingestion ships with at least one regression test exercising **a frozen-old fixture** (a small SQL/JSONL snapshot from a prior schema) to prove the new code reads it correctly. The fixtures live under `CKC_main/test/fixtures/legacy/` and are append-only. Enforced by `CKC_main/test/legacy_fixture_compatibility.test.js`.

When in doubt, the rule is **"a 75k-image collection imported under today's contract must still open, search, export, and re-attach after every future WP."** If a proposed change cannot satisfy that, it is reshaped or shelved.

### Updating the in-app manual is a hard requirement (binding)
The in-app LLM/operator manual at `CKC_main/app/backend/automationManual.js` is part of the product, not a side artifact. Every CKC change that touches an automation command, an IPC channel, a feature group described in the manual, a roadmap item, the safety contract, the quick-start sequence, or the operating contract MUST update the manual in the same commit.

- Adding a wired automation command without the matching `commandReference` entry + feature-group `commands` list update is a contract violation; the self-consistency test fails CI when it happens, but the rule applies even when the test would pass (e.g. moving a roadmap entry without updating the prose).
- Removing or renaming a command requires removing/renaming it in the manual in the same commit.
- Adding a new feature in CKC that is not yet automation-callable still requires a feature-group entry with the surface in `roadmap` so the LLM/operator knows it exists and how to drive it later.
- Bumping `MANUAL_VERSION` is required when any of the above happens.
- The in-app Help drawer (`HelpModal`) renders the same manual operators see; if you would not want the operator to read what you wrote, rewrite it.

This rule is in addition to the code-truth + self-consistency test rule above; together they make the manual the canonical, code-truth, always-current reference.

### Versioning + release policy (MUST)
- Every **distributable build** must be tied to a git tag (`vX.Y.Z`) on `main` (SemVer), so every build is traceable to code.
- Publish official builds as **GitHub Release assets** (immutable, off-machine backup).
- Local artifacts still land under `CKC_GOV/targets/CKC/artifacts/` for convenience, with per-build checksums/manifest (`manifest.json` + `SHA256SUMS.txt`) and `LATEST_BUILD.txt` updated.

Commands:
- `npm run package:win` — **default**: bumps patch version, commits, tags `vX.Y.Z`, packages, and pushes commit+tag.
- `npm run package:win:raw` — packaging only (no version bump/tag/push). Use for quick local debugging.

### Packaging (Windows)
Build a portable `.exe` and NSIS installer `.exe` using:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm run package:win
```

This writes versioned outputs under:
- Release (tagged): `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\releases\\vX.Y.Z\\`
- Dev/debug (`package:win:raw`): `<CKC_ROOT>\\CKC_GOV\\targets\\CKC\\artifacts\\dev\\<buildId>\\`

### Publishing a GitHub Release (recommended)
Do **not** commit `.exe` artifacts into `CKC_main` git history. Instead, publish them as a GitHub Release.

There is a workflow in the repo that builds Windows artifacts on tag push:
- `.github/workflows/release-win.yml` (triggers on tags like `v1.2.3`)

Recommended flow:
```powershell
cd "<CKC_ROOT>\\CKC_main"
npm run package:win
```
This bumps patch version, commits, tags `vX.Y.Z`, packages locally, and pushes commit+tag.
The pushed tag triggers GitHub Actions to attach the installer + portable `.exe` to the GitHub Release.

Manual alternative (only if you really want to manage tags yourself):
```powershell
cd "<CKC_ROOT>\\CKC_main"
git tag vX.Y.Z
git push origin vX.Y.Z
npm run package:win:raw
```

## Working process
### Taskboard
- All work is tracked in `taskboard/TASK_BOARD.md`.
- Every change should reference a Work Packet ID (WP-xxxx).

### Work packets
- A Work Packet is a small, shippable slice.
- Each WP must define:
  - scope (in/out)
  - implementation notes
  - acceptance criteria
  - test plan

### Git workflow (CKC_main)
Rules for `https://github.com/Nuntissura/CastKit_Codex`:
- **Before starting any coding**: create a WP + add it to the Task Board, then ensure `CKC_main` is committed + pushed (clean baseline).
- **While coding**: keep changes scoped to the active WP.
- **After the WP is DONE**: update Task Board + update Spec + (if needed) update this Project Codex; then commit + push the code changes.
- Commit messages should include the WP ID (example: `WP-0001: tighten packaging outputs`).

Quick commands (typical):
```powershell
cd "<CKC_ROOT>"
pushd CKC_main
npm test
npx tsc --noEmit
popd
git status
git add -A
git commit -m "WP-xxxx: short description"
git push origin main
```

### Spec maintenance
- The **current spec** lives in `CKC_GOV/spec/` only. Do not mirror it into `CKC_main/docs/`.
- With every new addition/change, update the current spec.
- When a new spec version is created, move the previous version into `CKC_GOV/spec/archive_spec/` (archive is append-only).

### Fail log
- Any significant failure (tooling mistake, destructive command, data loss risk, etc.) is recorded in `fail_log/FAIL_LOG.md`.
- Include: date/time, what happened, root cause, and mitigation.

## Backup to NAS (mirror)

Scripts live in `CKC_GOV/scripts/`:
- `backup_to_mir.ps1` — mirror `<CKC_ROOT>` to NAS (ROBOCOPY `/MIR`) and also mirror the active CKC `libraryRoot` when it is outside `<CKC_ROOT>`
- `register_backup_task.ps1` — scheduled task helper (runs backup every 30 min while logged in)
- `unregister_backup_task.ps1` — easy toggle for the scheduled task (disable/enable/remove)
Note: the backup script reads the active CKC `libraryRoot` from `%APPDATA%\\castkit-codex\\ckc-config.json` and mirrors it to a separate destination folder (default: `<CKC_BACKUP_DEST>__libraryRoot`, override via `CKC_BACKUP_DEST_LIBRARY`). If `libraryRoot` is configured but missing on disk, the backup exits non-zero to make the risk explicit.

PostgreSQL note: the ROBOCOPY mirror protects the filesystem side (`libraryRoot`, images, exports, templates), but it is not a PostgreSQL database backup. When `database.provider` is `postgres`, run `CKC_GOV/scripts/postgres_dump.ps1` and store the resulting dump with the mirrored backup set.

Run a backup now:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\backup_to_mir.ps1"
```

Automate backups (recommended):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\register_backup_task.ps1"
```
This creates a Scheduled Task that runs the mirror backup every 30 minutes while logged in.
The task runs with a hidden PowerShell window to avoid focus-stealing.
Verify: Task Scheduler -> Task -> Properties -> Actions should include `-WindowStyle Hidden`, and Settings should have "Hidden" enabled.

Disable/enable/remove the Scheduled Task:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1" -Enable
powershell -NoProfile -ExecutionPolicy Bypass -File "<CKC_ROOT>\\CKC_GOV\\scripts\\unregister_backup_task.ps1" -Delete
```

Backup status/logs:
- `<CKC_ROOT>\\CKC_GOV\\targets\\backup_logs\\LAST_RUN.txt`
- `<CKC_ROOT>\\CKC_GOV\\targets\\backup_logs\\backup_*.log`

Important: the backup uses ROBOCOPY `/MIR` (mirror). Deletions in source can delete in destination.

## Safety guidelines
- Never run destructive commands without:
  - double-checking paths
  - using PowerShell `-LiteralPath`
  - using `-WhatIf` first where possible
- Avoid `cmd` batch loops (`for /d ... rmdir`) for deletes. Prefer PowerShell with explicit, validated paths.
