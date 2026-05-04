#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const { openDb, initSchema, run, POSTGRES_TABLE_ORDER } = require('../app/backend/db');

function usage() {
  return `
Usage:
  node scripts/sqlite_to_postgres.js --library-root <path> --connection-string <postgres-url> [--truncate]
  node scripts/sqlite_to_postgres.js --sqlite <path-to-codex.db> --connection-string <postgres-url> [--truncate]

Options:
  --library-root <path>       CKC library root containing db/codex.db.
  --sqlite <path>             Source SQLite database path.
  --connection-string <url>   PostgreSQL connection string. Also reads CKC_POSTGRES_URL or DATABASE_URL.
  --truncate                  Delete known CKC PostgreSQL tables before import.
  --dry-run                   Count importable rows without writing to PostgreSQL.
  --help                      Show this help.
`.trim();
}

function parseArgs(argv) {
  const out = { truncate: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--truncate') out.truncate = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--library-root') out.libraryRoot = argv[++i];
    else if (a === '--sqlite') out.sqlitePath = argv[++i];
    else if (a === '--connection-string') out.connectionString = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function ident(value) {
  const raw = String(value ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) throw new Error(`Unsafe SQL identifier: ${raw}`);
  return raw;
}

function openSqliteReadonly(sqlitePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function closeSqlite(db) {
  return new Promise((resolve) => {
    if (!db || typeof db.close !== 'function') return resolve();
    db.close(() => resolve());
  });
}

async function getSqliteTables(db) {
  const rows = await sqliteAll(db, `SELECT name FROM sqlite_master WHERE type = 'table'`);
  return new Set(rows.map((r) => String(r.name || '')).filter(Boolean));
}

async function copyTable({ sourceDb, targetDb, table }) {
  const tableName = ident(table);
  const rows = await sqliteAll(sourceDb, `SELECT * FROM ${tableName}`);
  if (rows.length === 0) return 0;

  let imported = 0;
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => row[c] !== undefined);
    if (cols.length === 0) continue;
    const sql = `INSERT INTO ${tableName} (${cols.map(ident).join(', ')})
                 VALUES (${cols.map(() => '?').join(', ')})
                 ON CONFLICT DO NOTHING`;
    await run(
      targetDb,
      sql,
      cols.map((c) => row[c])
    );
    imported++;
  }

  return imported;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const sqlitePath = args.sqlitePath
    ? path.resolve(String(args.sqlitePath))
    : args.libraryRoot
      ? path.join(path.resolve(String(args.libraryRoot)), 'db', 'codex.db')
      : '';

  if (!sqlitePath) throw new Error('Missing --sqlite or --library-root');
  if (!fs.existsSync(sqlitePath)) throw new Error(`SQLite database not found: ${sqlitePath}`);

  const connectionString =
    args.connectionString ||
    process.env.CKC_POSTGRES_URL ||
    process.env.CKC_POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    '';
  if (!args.dryRun && !connectionString) {
    throw new Error('Missing --connection-string, CKC_POSTGRES_URL, or DATABASE_URL');
  }

  const sourceDb = await openSqliteReadonly(sqlitePath);
  let targetDb = null;

  try {
    const sourceTables = await getSqliteTables(sourceDb);
    const importTables = POSTGRES_TABLE_ORDER.filter((t) => sourceTables.has(t));

    if (args.dryRun) {
      const counts = {};
      for (const table of importTables) {
        const row = await sqliteAll(sourceDb, `SELECT COUNT(*) AS count FROM ${ident(table)}`);
        counts[table] = Number(row[0]?.count) || 0;
      }
      console.log(JSON.stringify({ ok: true, dryRun: true, sqlitePath, tables: counts }, null, 2));
      return;
    }

    targetDb = await openDb(null, {
      database: {
        provider: 'postgres',
        connectionString,
      },
    });
    await initSchema(targetDb);

    const imported = {};
    await run(targetDb, 'BEGIN');
    try {
      if (args.truncate) {
        for (const table of [...POSTGRES_TABLE_ORDER].reverse()) {
          await run(targetDb, `DELETE FROM ${ident(table)}`);
        }
      }

      for (const table of importTables) {
        imported[table] = await copyTable({ sourceDb, targetDb, table });
      }

      await run(
        targetDb,
        `INSERT INTO CkcDbMigration(migration_key, migration_value, updated_at)
         VALUES(?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(migration_key) DO UPDATE SET
           migration_value = excluded.migration_value,
           updated_at = CURRENT_TIMESTAMP`,
        ['sqlite_import_source', sqlitePath]
      );

      await run(targetDb, 'COMMIT');
    } catch (err) {
      await run(targetDb, 'ROLLBACK');
      throw err;
    }

    console.log(JSON.stringify({ ok: true, sqlitePath, imported }, null, 2));
  } finally {
    await closeSqlite(sourceDb);
    if (targetDb && typeof targetDb.close === 'function') await targetDb.close();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
