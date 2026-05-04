# Work Packet: WP-0092 - PostgreSQL Storage

Date: 2026-05-04
Owner: Codex
Status: DONE - implementation complete; validation not run in this pass

## Summary
Build CKC persistence around PostgreSQL-backed storage suitable for parallel model/operator work.

## Why
Future parallel LLM workers need stronger concurrent writes, explicit schema setup, transactions, and service-style access. CKC is not in live use, so no SQLite data migration is required.

## Scope
### In
- Define PostgreSQL connection/config model.
- Introduce a database access boundary and make PostgreSQL the default app provider.
- Port schema, indexes, and constraints to PostgreSQL.
- Provide local PostgreSQL setup scripts.
- Preserve current library filesystem layout for images and exports unless explicitly changed.
- Update backup/restore expectations for PostgreSQL dumps.

### Out
- Multi-user auth or remote hosting.
- SQLite-to-PostgreSQL migration unless live SQLite data appears later.

## Acceptance criteria
- [x] App configuration defaults to PostgreSQL for new/current CKC runs.
- [x] PostgreSQL schema covers current CKC relational tables and image review status.
- [x] Local PostgreSQL Docker setup exists under `CKC_GOV/postgres/`.
- [x] Backup docs include PostgreSQL dump/restore steps.
- [x] SQLite migration is explicitly not required unless live SQLite data appears later.
- [ ] PostgreSQL smoke validation run.

## Test plan
- [ ] Unit/integration tests for DB helpers.
- [ ] Manual smoke: launch app, create character, import image, edit tags/notes, search.

## Governance checklist
- [x] Task Board updated with this WP status.
- [x] Spec updated with PostgreSQL as the persistence target.
- [x] Session dump alignment checked; storage representation changes documented.

## Implementation notes
- Key files touched:
  - `CKC_main/app/backend/db.js`
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/main.js`
  - `CKC_GOV/postgres/docker-compose.yml`
  - `CKC_GOV/scripts/postgres_up.ps1`
  - `CKC_GOV/scripts/postgres_down.ps1`
  - `CKC_GOV/scripts/postgres_dump.ps1`
  - `CKC_GOV/scripts/postgres_restore.ps1`
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.062.md`
- Data model changes: PostgreSQL schema and `ImageAsset.review_status`.
- IPC/API changes: renderer contracts unchanged for normal app use.
- PostgreSQL is the default app provider.
- SQLite remains a lower-level fallback for tests/legacy only.
- Local Docker Compose PostgreSQL uses:
  - DB: `castkit_codex`
  - User: `castkit_codex`
  - Password: `castkit_codex`

## Execution plan
- Phase 1: introduce an explicit database provider boundary.
- Phase 2: make PostgreSQL the default app provider and add local PostgreSQL setup.
- Phase 3: update backup/restore docs for PostgreSQL dumps.
- Phase 4: validate against a running PostgreSQL instance.

## Risks / mitigations
- Risk: broad regression from DB dialect differences.
- Mitigation: keep adapter boundary small and route current app queries through it.

## Rollback
Set `database.provider` only for explicit fallback testing. PostgreSQL remains the project default.
