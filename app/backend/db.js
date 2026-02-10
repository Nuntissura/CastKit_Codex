const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function ensureColumn(db, tableName, columnName, columnDefSql) {
  const rows = await all(db, `PRAGMA table_info(${tableName})`);
  const has = rows.some((r) => r.name === columnName);
  if (has) return false;
  await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql}`);
  return true;
}

async function ensureSchemaUpgrades(db) {
  // Character search scope blobs (for UI scope toggles + saved searches).
  await ensureColumn(db, 'Character', 'search_blob_ids', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'Character', 'search_blob_labels', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'Character', 'search_blob_values', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'Character', 'search_blob_tags', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'Character', 'search_blob_name', "TEXT NOT NULL DEFAULT ''");

  // ImageAsset: allow duplicates (no unique index), plus optional tags and reference-mode.
  await run(db, 'DROP INDEX IF EXISTS idx_image_dedupe');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_hash ON ImageAsset(character_id, file_hash)');
  await ensureColumn(db, 'ImageAsset', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'ImageAsset', 'storage_mode', "TEXT NOT NULL DEFAULT 'copy'");
  await ensureColumn(db, 'ImageAsset', 'source_path', 'TEXT');

  // Tag rules can optionally be template-scoped.
  await ensureColumn(db, 'TagRule', 'template_id', 'TEXT');

  // Saved searches (deterministic; includes scope flags + tag/gallery filters).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS SavedSearch (
      search_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      query_text TEXT NOT NULL DEFAULT '',
      scope_flags_json TEXT NOT NULL DEFAULT '{}',
      tag_filters_json TEXT NOT NULL DEFAULT '[]',
      gallery_filters_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_builtin INTEGER NOT NULL DEFAULT 0
    );
  `
  );

  // Tag templates / quick-apply bundles (versioned by name).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS TagTemplate (
      template_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      description TEXT,
      tags_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(template_name, version)
    );
  `
  );

  // Audit log (append-only).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS AuditLog (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      character_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      details_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_character_time ON AuditLog(character_id, created_at DESC);
  `
  );
}

async function initSchema(db) {
  const schema = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS Character (
      character_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      template_hash TEXT NOT NULL,
      search_blob TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FieldValue (
      character_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      value_text TEXT,
      value_type TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(character_id, field_id),
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Tag (
      tag_id TEXT PRIMARY KEY,
      tag_text TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS CharacterTag (
      character_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      tag_type TEXT CHECK(tag_type IN ('manual', 'derived')) NOT NULL,
      PRIMARY KEY(character_id, tag_id),
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES Tag(tag_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Template (
      template_id TEXT PRIMARY KEY,
      version_label TEXT,
      source_path TEXT,
      template_hash TEXT,
      ast_json TEXT,
      raw_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS SheetFile (
      character_id TEXT NOT NULL,
      path TEXT PRIMARY KEY,
      format TEXT CHECK(format IN ('txt', 'md')) NOT NULL,
      raw_text TEXT,
      last_export_hash TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SheetVersion (
      version_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT CHECK(source IN ('ui_edit', 'ingest', 'paste_patch', 'import')) NOT NULL,
      parent_version_id TEXT,
      export_format TEXT,
      export_relative_path TEXT,
      sheet_bytes_hash TEXT,
      notes TEXT,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ProtectedField (
      protected_id TEXT PRIMARY KEY,
      scope TEXT CHECK(scope IN ('global', 'character')) NOT NULL,
      character_id TEXT,
      field_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ImageAsset (
      image_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      favorite INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_image_dedupe ON ImageAsset(character_id, file_hash);

    CREATE TABLE IF NOT EXISTS TemplateSpinOff (
      spinoff_id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      template_hash_at_create TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      field_id_list TEXT NOT NULL,
      format TEXT CHECK(format IN ('llm_pack_strict', 'fieldpack_with_values')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      UNIQUE(template_id, name),
      FOREIGN KEY(template_id) REFERENCES Template(template_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS TagRule (
      rule_id TEXT PRIMARY KEY,
      source_field_id TEXT NOT NULL,
      match_type TEXT CHECK(match_type IN ('equals', 'contains', 'regex')) NOT NULL,
      pattern TEXT NOT NULL,
      emit_tag TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await exec(db, schema);
  await ensureSchemaUpgrades(db);
}

module.exports = {
  openDb,
  initSchema,
  ensureSchemaUpgrades,
  run,
  get,
  all,
};
