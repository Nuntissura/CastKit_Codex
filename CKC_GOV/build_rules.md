# CKC Build Rules

Status: implementation contract
Read timing: deferred. Do not read this file during session bootstrap unless the active work is to draft, review, implement, verify, build, package, or ship a Work Packet.

## Contract

Every Work Packet author and implementer MUST read this file before drafting or implementing the WP. The WP body must keep an explicit checklist item proving this file was read.

This file does not replace `AGENTS.md`, `CKC_GOV/PROJECT_CODEX.md`, `CKC_GOV/taskboard/TASK_BOARD.md`, or `README.md`. Those remain the startup binding contract. This file is the implementation/build contract that applies only once a WP is being created or executed.

## Work Packet Rules

- Create or update the WP before product implementation starts.
- Update `CKC_GOV/taskboard/TASK_BOARD.md` with the WP row/status.
- Commit and push the planning checkpoint before coding starts when the work is non-trivial.
- Keep scope tight. Do not fold unrelated cleanup into a WP.
- Every WP needs a `## Field research / prior art` section before implementation. Non-trivial WPs record a real research pass; trivial governance, typo-only, or mechanical changes may explicitly mark research as not applicable with rationale.

## Research-First WP Rules

Every WP must account for field research before implementation. Non-trivial WPs run a field-research pass and record what was found in the WP body. Trivial changes may mark research as not applicable with a short rationale.

Sources to canvas, with depth scaled to WP risk:

- Prior art and libraries:
  - GitHub topic and code search for the technique and adjacent terms.
  - npm / PyPI for production-grade libraries that already solve the problem.
  - Hugging Face models, datasets, and Spaces.
  - Civitai workflows, LoRAs, and ControlNet variants when the WP touches image generation.
- Vendor and lab blogs:
  - Anthropic, OpenAI, Google DeepMind, Meta AI, Mistral, NVIDIA Research.
  - AWS, Azure, and GCP engineering blogs.
  - Stanford HAI, MIT CSAIL, Google Research, FAIR, and relevant domain labs.
- Academic and benchmarks:
  - arXiv, normally last 12-18 months unless older work is canonical.
  - Papers with Code for benchmark state of the art.
  - University research pages when a specific lab owns the domain.
- Practitioner forums:
  - Relevant Reddit communities such as `r/LocalLLaMA`, `r/StableDiffusion`, and `r/MachineLearning`.
  - Hacker News, Latent Space, and comparable industry-signal sources.
  - Twitter/X for fresh signal from researchers, vendors, and practitioners.
- Standards and vendor docs:
  - Canonical docs for every library the WP introduces or extends.
  - W3C, IETF, or industry standards if the WP touches a protocol or interchange format.

The WP research section records:

1. What was searched, including sources, search terms, and date.
2. What was found, with 3-7 relevant hits and one-line citations.
3. How findings changed the WP design.
4. What was rejected and why.

If research reshapes the scope, update the WP draft before implementation starts. Keep research notes to roughly 1-2 pages; bullets are preferred.

## PostgreSQL-First Rule

- PostgreSQL is the first target for CKC product behavior tests.
- Any test that touches `CKCLibrary`, migrations, persistence, automation sessions, IPC-backed backend commands, reset/backup behavior, workflow replay, ingestion, or multi-agent/concurrent operation MUST run against PostgreSQL first.
- SQLite-only passing tests are not sufficient evidence for CKC behavior because CKC is operated by multiple LLM/operator agents and depends on PostgreSQL concurrency, transactions, locking, and dialect behavior.
- SQLite tests are allowed only when explicitly scoped as legacy fixture compatibility, old-library import/migration reads, pure fallback-boundary coverage, or temporary transitional tests named as such in the WP.
- New WPs must not add fresh SQLite-only backend coverage for product behavior.
- If PostgreSQL is unavailable, report the environment blocker instead of certifying behavior through SQLite.

## Build And Artifact Rules

- Do not write build artifacts inside `CKC_main/`.
- Build artifacts, logs, caches, screenshots, captures, dumps, and scratch outputs belong under `CKC_GOV/targets/`.
- Do not commit generated build artifacts.
- Set npm/electron caches to `CKC_GOV/targets/cache/` before packaging.
- Distributable builds must be tied to a SemVer git tag on `main`.
- Publish official builds as GitHub Release assets.
- Local artifacts still land under `CKC_GOV/targets/CKC/artifacts/` with per-build checksums/manifest and `LATEST_BUILD.txt` updated.
- Local/dev builds go under `CKC_GOV/targets/CKC/artifacts/dev/`.
- Release builds go under `CKC_GOV/targets/CKC/artifacts/releases/`.
- `npm run package:win` is the default Windows release path: it bumps patch version, commits, tags `vX.Y.Z`, packages, and pushes commit+tag.
- `npm run package:win:raw` is packaging only, with no version bump/tag/push, for quick local debugging.
- The Windows release workflow is `.github/workflows/release-win.yml`, triggered by tags like `v1.2.3`.

## Verification Rules

- Run the smallest meaningful automated tests first, then broaden when the blast radius justifies it.
- For product behavior, prefer PostgreSQL-backed tests.
- For UI-facing work, tests and successful builds are not enough. Use CKC automation/visual debugger captures and inspect the rendered result.
- For app interactions, use CKC backend automation and renderer automation commands where possible.
- Do not rely only on process status, logs, or "build succeeded" for UI completion.
- Record any skipped verification with the concrete blocker.

## Automation And App-Driving Rules

CKC exposes an internal manual and control plane through Electron IPC/preload, not a public network API. LLM agents should use:

- `window.ckc.automationGetManual({ format: "json" })`
- `window.ckc.automationCreateSession(...)`
- `window.ckc.automationHeartbeat(...)`
- `window.ckc.automationAcquireLease(...)`
- `window.ckc.automationRunCommand(...)`
- `window.ckc.automationCaptureToFile(...)`

Start hidden/unfocusable automation mode with:

```powershell
$env:CKC_AUTOMATION_BACKGROUND="1"
```

Capture files are written under:

- `<CKC_ROOT>\CKC_GOV\targets\CKC\automation_captures\` in repo/dev mode.
- `<libraryRoot>\automation_captures\` as packaged/fallback mode.

Automation must not use OS-level keyboard injection, cursor movement, focus stealing, or foregrounding as its normal path.

When testing, verifying, or demonstrating a feature, fix, or workflow, the agent must interact with the running CKC app rather than reason from code alone.

Recommended dev launch for CDP-driven verification:

```powershell
cd "<CKC_ROOT>\CKC_main"
$env:CKC_POSTGRES_URL="postgres://castkit_codex:castkit_codex@127.0.0.1:55432/castkit_codex"
$env:CKC_DB_PROVIDER="postgres"
npx vite --port 5173
# in a second shell, once Vite is ready:
npx electron . --remote-debugging-port=9222
```

The agent connects to the CDP port, evaluates JS in the renderer (`window.ckc.automation*`), captures screenshots via `window.ckc.automationCaptureToFile`, and reads console logs via CDP `Runtime.consoleAPICalled`.

For programmatic verification, use the wired automation surface in `CKC_main/app/backend/automationCommandMap.js`, such as `automationRunCommand`, `getRendererUIState`, ingestion dry-runs, and backend commands. Do not assume code works without exercising it.

If a surface lacks the automation hook needed for verification, record it as a manual/roadmap gap instead of skipping verification.

## Visual Verification Rules

- Visual debugging is required when working on CKC UI or diagnosing GUI failures.
- Use the Browser Use in-app browser plugin for local browser targets such as `localhost`/`127.0.0.1` whenever available.
- For Electron-only behavior, use CKC automation captures, Electron/CDP inspection, or screenshots as fallback visual evidence.
- For UI verification, use `automationCaptureToFile`, inspect the resulting image, and check renderer console/runtime errors.
- Tests, process status, logs, and successful builds are not substitutes for a visual capture on UI-facing work.
- It is not acceptable to silently certify a feature without live verification. If the environment cannot run the check, surface the blocker and leave verification blocked.

## Test Suite Maintenance Rules

The test suite at `CKC_GOV/test_suites/CKC_TEST_SUITE.md` is the canonical repeatable list of checks for the running CKC application.

- Every addition, expansion, or large refactor of CKC must update the test suite in the same change.
- Add check rows for new features.
- Mark rows deprecated when behavior changes.
- Update the agent-driven script section so the suite stays runnable end-to-end.
- New automation commands require new check rows under their relevant section.
- New UI surfaces require rows describing visual state and CDP-driven verification.
- Bugs surfaced during inspection are either fixed and removed from open findings, or tagged `OPEN BUG` with the date.
- Findings from each inspection pass go into the dated `Findings (latest pass)` block.

## Data And Migration Rules

- Prefer additive schema changes.
- Never silently drop, rename, or rewrite user-entered data.
- Character sheet Field IDs are protected. Do not drop, reorder, or normalize them unless the WP explicitly owns that migration and includes tests.
- Image bytes under `characters/<id>/images/{original,thumb}/` are durable. Do not move or rename them automatically without an undo manifest and recovery path.
- For multi-agent or concurrent behavior, design for PostgreSQL transactions, row-level semantics, leases, or future CRDT/event-log behavior. Do not assume SQLite behavior represents production.

## Documentation Rules

- Code is truth for wired surfaces.
- Docs that catalog commands, IPC names, schema fields, config keys, CLI flags, or other code-defined surfaces need a self-consistency test unless the entries are clearly marked roadmap.
- Governance remains in `CKC_GOV/`. Do not mirror governance docs into `CKC_main/docs/`.
- Spec updates require version bump and archive when the product behavior changes. If there is no spec impact, say so in the WP.

## Internal Manual Rules

The in-app LLM/operator manual at `CKC_main/app/backend/automationManual.js` is part of the product.

- Every CKC change that touches an automation command, IPC channel, feature group described in the manual, roadmap item, safety contract, quick-start sequence, or operating contract must update the manual in the same commit.
- Adding a wired automation command requires the matching `commandReference` entry and feature-group `commands` list update.
- Removing or renaming a command requires removing or renaming it in the manual in the same commit.
- Adding a new feature that is not automation-callable still requires a feature-group entry with the surface in `roadmap`.
- Bump `MANUAL_VERSION` whenever the manual contract changes.
- The in-app Help drawer (`HelpModal`) renders the same manual operators see; keep the prose operator-facing and code-truthful.

## Spec Maintenance Rules

- The current spec lives in `CKC_GOV/spec/` only.
- Do not mirror the spec into `CKC_main/docs/`.
- Every product behavior addition or change must update the current spec.
- When a new spec version is created, move the previous version into `CKC_GOV/spec/archive_spec/`.
- If there is no spec impact, record the rationale in the WP.

## Naming And Path Rules

- Do not introduce spaces in file names, folder names, generated artifact names, archive names, image names, document names, export names, app names, build artifact names, or code-generated paths.
- Use hyphens or underscores.
- Keep generated paths portable and repo-relative where possible.

## Handoff Rules

- Update the WP acceptance checklist, test plan, and taskboard row before marking work done.
- Commit messages include the WP id.
- Note verification commands and visual/backend gates in the WP or final handoff.
- If verification was blocked, say exactly what did not run and why.
