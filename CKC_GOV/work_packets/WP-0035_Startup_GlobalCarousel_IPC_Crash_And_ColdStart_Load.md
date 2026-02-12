# WP-0035 — Startup: global carousel IPC crash + cold-start library load

Date: 2026-02-12
Owner: Codex
Status: BACKLOG

## Summary
Fix the reported startup error:

`Error invoking remote method 'ckc:listGlobalCarouselImages': TypeError: Cannot read properties of null (reading 'all')`

…and ensure the Library/Character views load characters + images on first launch (no “refresh to see data”).

## Motivation / context
If CKC throws IPC errors during startup or appears empty until a manual refresh, it feels broken and undermines trust in the rebuild.

## Scope
- Reproduce the error on the latest tagged release build (`v0.2.7` or newer) and in dev.
- Ensure all renderer startup flows call `ckc:initialize` (or otherwise await library readiness) before any `list*` IPC calls.
- Harden main/renderer/backend against “library not initialized yet” states:
  - Prefer graceful empty results + visible “loading” state over throwing TypeErrors.
  - Add explicit guards so uninitialized DB usage yields a friendly error, not `db.all` on `null`.
- Confirm global carousel loads reliably and does not block the rest of the Library view.

## Non-goals
- New features in carousel behavior (filters, hero selection, etc.).
- Major refactors of the library layer or IPC architecture.

## Acceptance criteria
- [ ] App startup does not log/throw the `ckc:listGlobalCarouselImages` / `db.all` null error.
- [ ] On cold start, Library view shows characters and global carousel images without needing a manual refresh.
- [ ] If the libraryRoot is missing/unset, CKC prompts/handles it without crashing and without leaving the UI in a broken state.
- [ ] `npm test` passes and release packaging still succeeds.

## Test plan
- [ ] Manual: run the tagged portable `.exe` (from `CKC_GOV/targets/CKC/artifacts/releases/`) and confirm no startup IPC errors.
- [ ] Manual: restart multiple times, confirm first-load data appears consistently.
- [ ] Automated: add a regression test that covers the initialization ordering or the guarded failure mode (no `TypeError`).

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: no (bugfix only).

