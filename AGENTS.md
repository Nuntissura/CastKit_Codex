# Repository Guidelines

## Canonical Authority

The authoritative operating guide for this repository is [CKC_GOV/PROJECT_CODEX.md](CKC_GOV/PROJECT_CODEX.md).

Follow that file for workflow, governance, task tracking, build targets, backup rules, and repo-specific operating stance. If this file conflicts with `CKC_GOV/PROJECT_CODEX.md`, `PROJECT_CODEX.md` wins.

## Repository Split

The repo is intentionally split:

- `CKC_main/` is the product code.
- `CKC_GOV/` is the repository governance and canonical project record.

Keep product implementation and governance updates in their proper sides of that split.

## Recovery Directory

`CKC_recovery/` is non-canonical and stale. It is a recovered old version of the app after the repo and disk wipe, kept only for provenance and reference. Do not treat it as current architecture, source of truth, or implementation target.

## Naming Rule

Do not introduce spaces in file names, folder names, or generated artifact names. Use names such as `work_packet.md`, `release-v0.2.7`, or `batch-character-operations`.
