# Work Packet: WP-0092 - PostgreSQL Storage Migration

Date: 2026-05-04
Owner: Codex
Status: IN_PROGRESS

## Summary
Move CKC persistence from local SQLite assumptions toward PostgreSQL-backed storage suitable for parallel model/operator work.

## Why
SQLite is deeply integrated and works for a single local app, but future parallel LLM workers need stronger concurrent writes, explicit migrations, transactions, and service-style access.

## Scope
### In
- Define PostgreSQL connection/config model.
- Introduce a database access boundary so product code stops depending on SQLite-specific helpers.
- Port schema, indexes, constraints, and migrations to PostgreSQL.
- Provide a migration path from existing `db/codex.db`.
- Preserve current library filesystem layout for images and exports unless explicitly changed.
- Update backup/restore expectations for PostgreSQL dumps.

### Out
- Rebuilding the UI.
- Image sorter UX work.
- Multi-user auth or remote hosting.

## Acceptance criteria
- [ ] App can initialize against PostgreSQL in development.
- [ ] Existing tests pass against the new DB layer or have PostgreSQL equivalents.
- [ ] SQLite-to-PostgreSQL migration imports characters, fields, images, notes, stories, moodboards, tags, collections, relations, and audit rows.
- [ ] Concurrent write behavior is covered by tests for core image/character updates.
- [ ] Backup docs include PostgreSQL dump/restore steps.

## Test plan
- [ ] Unit/integration tests for DB helpers and migrations.
- [ ] Migration test using a seeded SQLite fixture.
- [ ] Manual smoke: launch app, create character, import image, edit tags/notes, search.

## Governance checklist
- [ ] Task Board updated with this WP status.
- [ ] Spec updated with PostgreSQL as the persistence target.
- [ ] Session dump alignment checked; document any storage representation changes.

## Implementation notes
- Key files to touch:
  - `CKC_main/app/backend/db.js`
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/main.js`
  - `CKC_GOV/scripts/`
  - `CKC_GOV/spec/`
- Data model changes: PostgreSQL schema and migration metadata.
- IPC/API changes: avoid changing renderer contracts unless required.

## Execution plan
- Phase 1: introduce an explicit database provider boundary while keeping SQLite as the default path.
- Phase 2: add PostgreSQL schema/migration support behind that boundary.
- Phase 3: add SQLite-to-PostgreSQL import tooling and tests.
- Phase 4: update backup/restore docs for PostgreSQL dumps.

## Risks / mitigations
- Risk: broad regression from DB dialect differences.
- Mitigation: introduce the access boundary first, then port tables in tested slices.

## Rollback
Keep the SQLite path available until PostgreSQL migration is verified on a copied library.
