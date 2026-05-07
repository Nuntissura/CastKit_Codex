# Work Packet: WP-0119 - PostgreSQL-first testing and SQLite removal

Date: 2026-05-08
Owner: Codex
Status: PLANNED

## Summary

Make PostgreSQL the required backend test target for CKC product behavior and remove SQLite from the normal product/test path. SQLite remains only where it is needed to read frozen legacy fixtures or explicitly test old-library compatibility.

Rationale: CKC is operated by multiple LLM/operator agents. The test gate must exercise PostgreSQL concurrency, transactions, pooling, SQL dialect behavior, and lock/lease semantics instead of relying on SQLite-only temp libraries.

## Scope

### In

1. Add a PostgreSQL test harness that creates isolated per-test schemas or databases and cleans them deterministically.
2. Convert backend product-behavior tests from implicit SQLite fallback to PostgreSQL-first execution.
3. Add multi-agent concurrency tests for automation sessions, leases, write conflicts, reset/backup boundaries, and representative CKCLibrary writes.
4. Keep SQLite only for explicitly named legacy fixture compatibility tests.
5. Remove or quarantine implicit SQLite fallback from test helpers so new backend tests cannot pass accidentally without PostgreSQL.
6. Decide whether runtime SQLite support can be removed from packaged CKC, or whether a read-only legacy import shim must remain.
7. Update docs, test suite, CI/local scripts, and package dependencies after the code path is settled.

### Out

- Migrating live operator SQLite data unless the operator explicitly provides a live SQLite library that must be preserved.
- Rewriting unrelated feature tests beyond the DB provider boundary they need.

## Acceptance Criteria

- [ ] `PROJECT_CODEX.md` PostgreSQL-first testing rule is enforced by tests/scripts, not only prose.
- [ ] Product backend tests fail fast when PostgreSQL is unavailable instead of silently falling back to SQLite.
- [ ] Legacy SQLite tests are clearly named and limited to fixture/import compatibility.
- [ ] Multi-agent concurrency tests run against PostgreSQL.
- [ ] SQLite runtime/dependency removal decision is recorded with concrete blockers, if any.
- [ ] Task board, spec, README, and test suite are updated to match the final provider policy.
