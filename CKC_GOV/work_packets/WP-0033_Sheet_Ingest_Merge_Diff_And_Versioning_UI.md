# WP-0033 — Sheet ingest/merge: diff + selective overwrite + versions/revert UI

Date: 2026-02-11
Owner: Codex
Status: IN_PROGRESS

## Summary
Expose the existing backend capabilities for ingest/patch/versions in the UI:
- paste/import a sheet block (with `FIELD-ID — descriptor: value` or `FIELD-ID: value`)
- preview a field-by-field diff
- select which fields to apply/overwrite
- create a new version entry for every applied change
- browse versions, diff two versions, and selectively revert fields (creates a new version)

## Motivation / context
Users need safe, auditable merges of sheet content (from txt/md) without losing current work, and must be able to revert selectively with a compare view.

## Scope
- Ingest UI:
  - Paste box + file import (txt/md).
  - Preview: list of fields with current vs proposed, change type, issues, and a checkbox.
  - Apply selected fields (writes a new sheet version).
- Versions UI:
  - List versions with timestamps/source/notes.
  - Diff two versions (field-by-field).
  - Revert selectively from a chosen version (writes a new sheet version; does not overwrite old).
- Character ID:
  - Ensure the character sheet merge flow never breaks the template integrity rules.

## Non-goals
- Full Git-like merge engine.
- Rich text diff rendering (plain compare is fine).

## Acceptance criteria
- [ ] Paste ingest parses both “ID only” and “ID + descriptor” formats and previews changes.
- [ ] Apply overwrites only selected fields and creates a new version.
- [ ] Import from txt/md works.
- [ ] Version list shows past versions; diff view compares two versions.
- [ ] Selective revert from a version works and creates a new version (no destructive overwrite).

## Test plan
- [ ] Manual: ingest paste, preview, apply subset, confirm version created.
- [ ] Manual: revert subset from an older version, confirm version created.
- [ ] Automated: `npm test`.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: yes (ingest/merge/version UX). Bump spec + mirror into `CKC_main/docs/`.
