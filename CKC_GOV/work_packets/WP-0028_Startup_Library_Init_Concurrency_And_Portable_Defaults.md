# WP-0028 — Startup: library init concurrency + portable defaults

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Fix a startup race that can throw on first launch (concurrent IPC calls hit the library before SQLite is initialized), and improve portability by choosing sensible defaults when running the portable `.exe` (library lives next to the executable).

## Motivation / context
- Reported error at startup:
  - `Error invoking remote method 'ckc:listGlobalCarouselImages': TypeError: Cannot read properties of null (reading 'all')`
- This is consistent with concurrent calls returning a partially-initialized library instance.

## Scope
- Make library initialization concurrency-safe in the Electron main process.
- Ensure the library is initialized before the renderer starts making IPC calls.
- Portable defaults:
  - When running the **portable** build, default `libraryRoot` to a folder next to the portable executable.
  - When the configured `libraryRoot` is missing, prompt to locate it or create a new one.

## Non-goals
- Reworking the whole persistence model (DB vs file-first).
- Any changes to template parsing/validation rules.

## Acceptance criteria
- [x] App launches without the `ckc:listGlobalCarouselImages` null-DB error.
- [x] Concurrent startup IPC calls do not observe a partially-initialized library.
- [x] Portable build defaults `libraryRoot` to a sibling folder next to the portable `.exe` (no drive-letter assumptions).
- [x] If configured `libraryRoot` is missing on disk, the app prompts to locate/select/create a library root.

## Test plan
- [ ] Manual: launch freshly built portable `.exe`; confirm no startup error and Library loads.
- [ ] Manual: set `libraryRoot` to a non-existent folder; restart; confirm prompt and successful recovery.
- [x] Automated: run `npm test` (should stay green).

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec impact: yes (portable default + startup libraryRoot behavior). Bump spec and mirror into `CKC_main/docs/`.
