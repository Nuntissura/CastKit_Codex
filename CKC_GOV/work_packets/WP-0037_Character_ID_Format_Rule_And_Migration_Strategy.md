# WP-0037 — Character ID: fixed format rule + migration strategy

Date: 2026-02-12
Owner: Codex
Status: DONE

## Summary
Define and implement a fixed, human-friendly Character ID formatting rule so IDs are readable, comparable, and reliable for linking/merging/exporting.

## Motivation / context
Users interpret the Character ID as a primary identifier. Random internal IDs (e.g. `char_...`) are hard to recognize and make merges/links error-prone.

## Scope
- Decide an ID rule (example options):
  - `CKC-CHAR-000001` (sequential)
  - `CHAR-000001` (sequential)
  - `CKC-YYYY-0001` (time-bucketed sequential)
- Implement the chosen rule:
  - new characters get a system-managed, human-friendly Character ID that follows the rule
  - the sheet field `CHAR-ID-001` reflects the rule (system-managed; visible in editor)
  - IDs remain safe for folder names (no special chars)
- Migration strategy for existing characters:
  - keep old IDs but optionally assign/display a new “public” ID, or
  - migrate internal IDs + folders + DB references (higher risk)
- Ensure Character ID is protected from overwrite via ingest/merge/version revert flows.

## Implementation choice (CKC)
- Keep the internal `character_id` as the stable folder/DB key (no renames by default).
- Introduce a system-managed sequential public Character ID (format: `CHAR-000001`).
- Treat `CHAR-ID-001` as the public Character ID (visible in the editor, protected from overwrite).
- Migration: assign public IDs to existing characters and update `CHAR-ID-001` without renaming folders.

## Non-goals
- Cross-library syncing of IDs (future).
- Multi-user conflict resolution (future).

## Acceptance criteria
- [x] ID format rule is documented and enforced for new characters.
- [x] Existing libraries have a safe migration path (documented and tested).
- [x] Ingest/merge cannot corrupt or overwrite the Character ID.
- [x] Automated tests cover ID generation + a basic migration case.

## Test plan
- [x] Automated: unit tests around ID generation + validation.
- [x] Manual: create several characters and verify IDs increment/format correctly in UI and exports.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [x] Spec impact: yes (user-facing identity rule). Bumped spec + mirrored into `CKC_main/docs/`.

## Implementation notes (what shipped)
- New Characters are created with:
  - internal `characterId` (random `char_…`, stable folder/DB key)
  - public Character ID (`CHAR-000001`, sequential) stored as `Character.public_id`
  - `CHAR-ID-001` enforced to the public ID (visible in editor, read-only/system-managed)
- Migration tool: “Assign public IDs” assigns missing `public_id` values to existing characters without renaming folders and repairs `CHAR-ID-001` accordingly.
