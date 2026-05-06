# Repository Guidelines

## Binding Contract (read first)

The following four files form the **binding contract** for any human or LLM/agent doing work in this repository. They MUST be read and acknowledged before any code, governance, spec, task, build, or backup action is taken. Working in this repo without reading them is a process violation.

1. [AGENTS.md](AGENTS.md) — this file (pointer + naming + repo split rules)
2. [CKC_GOV/PROJECT_CODEX.md](CKC_GOV/PROJECT_CODEX.md) — canonical operating guide
3. [CKC_GOV/taskboard/TASK_BOARD.md](CKC_GOV/taskboard/TASK_BOARD.md) — single source of truth for work status
4. [README.md](README.md) — repo-level quickstart

The bootstrap script `ckcstart.cmd` at the repo root prints this read order on demand.

## Canonical Authority

The authoritative operating guide for this repository is [CKC_GOV/PROJECT_CODEX.md](CKC_GOV/PROJECT_CODEX.md).

Follow that file for workflow, governance, task tracking, build targets, backup rules, and repo-specific operating stance. **Conflict resolution order (highest authority first):**
1. `CKC_GOV/PROJECT_CODEX.md`
2. `CKC_GOV/taskboard/TASK_BOARD.md` (status of work, current focus)
3. `AGENTS.md` (this file)
4. `README.md`

If any of these conflict with each other, the higher-priority file wins. If any of them conflict with the operator's direct instruction in the active session, the operator wins for that session.

## Repository Split

The repo is intentionally split:

- `CKC_main/` is the product code.
- `CKC_GOV/` is the repository governance and canonical project record.

Keep product implementation and governance updates in their proper sides of that split.

## Recovery Directory

`CKC_recovery/` is non-canonical and stale. It is a recovered old version of the app after the repo and disk wipe, kept only for provenance and reference. Do not treat it as current architecture, source of truth, or implementation target.

## Naming Rule

Do not introduce spaces in file names, folder names, or generated artifact names. Use names such as `work_packet.md`, `release-v0.2.7`, or `batch-character-operations`.
