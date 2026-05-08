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
- Every non-trivial WP created from 2026-05-07 onward needs a `## Field research / prior art` section before implementation.
- Trivial governance or typo-only changes may explicitly mark research as not applicable.

## PostgreSQL-First Rule

- PostgreSQL is the first target for CKC product behavior tests.
- Tests touching `CKCLibrary`, persistence, migrations, automation sessions, IPC-backed backend commands, reset/backup behavior, workflow replay, ingestion, or multi-agent/concurrent operation MUST run against PostgreSQL first.
- SQLite-only passing tests are not sufficient evidence for product behavior.
- SQLite tests are allowed only for explicitly named legacy fixture compatibility, old-library import/migration reads, pure fallback-boundary coverage, or temporary transitional tests named as such in the WP.
- If PostgreSQL is unavailable, report the environment blocker instead of certifying behavior through SQLite.

## Build And Artifact Rules

- Do not write build artifacts inside `CKC_main/`.
- Build artifacts, logs, caches, screenshots, captures, dumps, and scratch outputs belong under `CKC_GOV/targets/`.
- Do not commit generated build artifacts.
- Set npm/electron caches to `CKC_GOV/targets/cache/` before packaging.
- Distributable builds must be tied to a SemVer git tag on `main`.
- Local/dev builds go under `CKC_GOV/targets/CKC/artifacts/dev/`.
- Release builds go under `CKC_GOV/targets/CKC/artifacts/releases/`.

## Verification Rules

- Run the smallest meaningful automated tests first, then broaden when the blast radius justifies it.
- For product behavior, prefer PostgreSQL-backed tests.
- For UI-facing work, tests and successful builds are not enough. Use CKC automation/visual debugger captures and inspect the rendered result.
- For app interactions, use CKC backend automation and renderer automation commands where possible.
- Do not rely only on process status, logs, or "build succeeded" for UI completion.
- Record any skipped verification with the concrete blocker.

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

## Naming And Path Rules

- Do not introduce spaces in file names, folder names, generated artifact names, archive names, image names, document names, export names, app names, build artifact names, or code-generated paths.
- Use hyphens or underscores.
- Keep generated paths portable and repo-relative where possible.

## Handoff Rules

- Update the WP acceptance checklist, test plan, and taskboard row before marking work done.
- Commit messages include the WP id.
- Note verification commands and visual/backend gates in the WP or final handoff.
- If verification was blocked, say exactly what did not run and why.
