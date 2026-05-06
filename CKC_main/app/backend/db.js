const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const POSTGRES_TABLE_ORDER = [
  'Character',
  'Template',
  'FieldValue',
  'Tag',
  'CharacterTag',
  'SheetFile',
  'SheetVersion',
  'ProtectedField',
  'ImageAsset',
  'TemplateSpinOff',
  'TagRule',
  'SavedSearch',
  'TagTemplate',
  'AuditLog',
  'NoteDoc',
  'StoryDoc',
  'MoodboardDoc',
  'StoryBoard',
  'LinkIndex',
  'ImageAnnotation',
  'Collection',
  'CollectionItem',
  'CharacterRelation',
  'CkcMeta',
  'CkcDbMigration',
];

function dbNotReady(methodName) {
  const err = new Error(
    `CKC DB not initialized (missing db.${methodName}). Did you forget to call/await library.initialize()?`
  );
  err.code = 'CKC_DB_NOT_READY';
  return err;
}

function normalizeProvider(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'pg' || raw === 'postgres' || raw === 'postgresql') return 'postgres';
  return 'sqlite';
}

function resolveDbConfig(options = {}) {
  const raw =
    options && typeof options === 'object'
      ? options.database && typeof options.database === 'object'
        ? options.database
        : options.dbConfig && typeof options.dbConfig === 'object'
          ? options.dbConfig
          : options
      : {};

  const provider = normalizeProvider(process.env.CKC_DB_PROVIDER || process.env.CKC_DATABASE_PROVIDER || raw.provider);
  return {
    provider,
    connectionString:
      process.env.CKC_POSTGRES_URL ||
      process.env.CKC_POSTGRES_CONNECTION_STRING ||
      process.env.DATABASE_URL ||
      raw.connectionString ||
      raw.url ||
      '',
    host: process.env.CKC_POSTGRES_HOST || raw.host || undefined,
    port: process.env.CKC_POSTGRES_PORT || raw.port || undefined,
    database: process.env.CKC_POSTGRES_DATABASE || raw.database || raw.dbName || undefined,
    user: process.env.CKC_POSTGRES_USER || raw.user || undefined,
    password: process.env.CKC_POSTGRES_PASSWORD || raw.password || undefined,
    ssl: process.env.CKC_POSTGRES_SSL || raw.ssl || false,
    max: Number(process.env.CKC_POSTGRES_POOL_MAX || raw.max || 10) || 10,
  };
}

function isPostgresDb(db) {
  return !!db && (db.dialect === 'postgres' || db.provider === 'postgres');
}

function translateQuestionParams(sql) {
  const raw = String(sql ?? '');
  let out = '';
  let paramIndex = 1;
  let quote = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (raw[i + 1] === quote) {
          out += raw[i + 1];
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '?') {
      out += `$${paramIndex++}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function replaceOutsideSqlQuotes(sql, pattern, replacement) {
  const raw = String(sql ?? '');
  let out = '';
  let segment = '';
  let quote = null;

  const flushSegment = () => {
    if (!segment) return;
    out += segment.replace(pattern, replacement);
    segment = '';
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (raw[i + 1] === quote) {
          out += raw[i + 1];
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      flushSegment();
      quote = ch;
      out += ch;
      continue;
    }

    segment += ch;
  }

  flushSegment();
  return out;
}

function appendOnConflictDoNothing(sql) {
  const raw = String(sql ?? '').trim();
  if (!raw) return raw;
  const body = raw.replace(/;+\s*$/g, '');
  return `${body} ON CONFLICT DO NOTHING`;
}

function translatePostgresSql(sql) {
  const raw = String(sql ?? '');
  const hadInsertOrIgnore = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(raw);
  const hadInsertOrReplace = /\bINSERT\s+OR\s+REPLACE\s+INTO\b/i.test(raw);
  let out = raw
    .replace(/^\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;?\s*/gim, '')
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION');

  out = replaceOutsideSqlQuotes(
    out,
    /\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\s*=\s*\?\s+COLLATE\s+NOCASE\b/gi,
    (_match, column) => `LOWER(${column}) = LOWER(?)`
  );
  out = replaceOutsideSqlQuotes(out, /\bLIKE\b/gi, 'ILIKE');
  out = replaceOutsideSqlQuotes(out, /\s+COLLATE\s+NOCASE\b/gi, '');

  out = translateQuestionParams(out);
  if ((hadInsertOrIgnore || hadInsertOrReplace) && !/\bON\s+CONFLICT\b/i.test(out)) out = appendOnConflictDoNothing(out);
  return out;
}

function getPostgresConnectionOptions(config) {
  const sslRaw = config.ssl;
  const ssl =
    sslRaw === true || String(sslRaw).toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : sslRaw || undefined;

  if (config.connectionString) {
    return { connectionString: String(config.connectionString), ssl, max: config.max };
  }

  return {
    host: config.host,
    port: config.port ? Number(config.port) : undefined,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl,
    max: config.max,
  };
}

async function openPostgresDb(config) {
  let Pool = null;
  try {
    ({ Pool } = require('pg'));
  } catch (err) {
    const missing = new Error('PostgreSQL provider requires the `pg` package. Run npm install in CKC_main.');
    missing.code = 'CKC_POSTGRES_DRIVER_MISSING';
    missing.cause = err;
    throw missing;
  }

  const pool = new Pool(getPostgresConnectionOptions(config));
  let activeClient = null;
  const adapter = {
    provider: 'postgres',
    dialect: 'postgres',
    config,
    async query(sql, params = []) {
      const command = String(sql ?? '').trim().split(/\s+/)[0]?.toUpperCase() || '';

      if (command === 'BEGIN') {
        if (activeClient) throw new Error('PostgreSQL transaction already active on this CKC DB adapter.');
        activeClient = await pool.connect();
        try {
          return await activeClient.query(sql, params);
        } catch (err) {
          activeClient.release();
          activeClient = null;
          throw err;
        }
      }

      if (command === 'COMMIT' || command === 'ROLLBACK') {
        if (!activeClient) return pool.query(sql, params);
        const client = activeClient;
        try {
          return await client.query(sql, params);
        } finally {
          activeClient = null;
          client.release();
        }
      }

      if (activeClient) return activeClient.query(sql, params);
      return pool.query(sql, params);
    },
    close(callback) {
      const done = (async () => {
        if (activeClient) {
          const client = activeClient;
          activeClient = null;
          try {
            await client.query('ROLLBACK');
          } catch {
            // ignore
          } finally {
            client.release();
          }
        }
        await pool.end();
      })();
      if (typeof callback === 'function') done.then(() => callback(null), callback);
      return done;
    },
  };

  await adapter.query('SELECT 1');
  return adapter;
}

function openSqliteDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

async function openDb(dbPath, options = {}) {
  const config = resolveDbConfig(options);
  if (config.provider === 'postgres') return openPostgresDb(config);
  return openSqliteDb(dbPath);
}

async function run(db, sql, params = []) {
  if (isPostgresDb(db)) {
    const res = await db.query(translatePostgresSql(sql), params);
    return { changes: res.rowCount, rowCount: res.rowCount, rows: res.rows };
  }
  if (!db || typeof db.run !== 'function') throw dbNotReady('run');
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function get(db, sql, params = []) {
  if (isPostgresDb(db)) {
    const res = await db.query(translatePostgresSql(sql), params);
    return res.rows[0];
  }
  if (!db || typeof db.get !== 'function') throw dbNotReady('get');
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function all(db, sql, params = []) {
  if (isPostgresDb(db)) {
    const res = await db.query(translatePostgresSql(sql), params);
    return res.rows;
  }
  if (!db || typeof db.all !== 'function') throw dbNotReady('all');
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function exec(db, sql) {
  if (isPostgresDb(db)) {
    const translated = translatePostgresSql(sql).trim();
    if (!translated) return;
    await db.query(translated);
    return;
  }
  if (!db || typeof db.exec !== 'function') throw dbNotReady('exec');
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function postgresColumnDef(columnDefSql) {
  return String(columnDefSql ?? '')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION');
}

async function ensureColumn(db, tableName, columnName, columnDefSql) {
  if (isPostgresDb(db)) {
    const row = await get(
      db,
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
      [String(tableName).toLowerCase(), String(columnName).toLowerCase()]
    );
    if (row) return false;
    await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${postgresColumnDef(columnDefSql)}`);
    return true;
  }

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

  // Human-friendly Character IDs (public IDs, stable per character).
  await ensureColumn(db, 'Character', 'public_id', 'TEXT');
  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_character_public_id ON Character(public_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_character_created_at ON Character(created_at)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_character_updated_at ON Character(updated_at)');

  // Character icon + focus framing (Library list).
  await ensureColumn(db, 'Character', 'icon_image_id', 'TEXT');
  await ensureColumn(db, 'Character', 'icon_focus_x', 'REAL NOT NULL DEFAULT 0.5');
  await ensureColumn(db, 'Character', 'icon_focus_y', 'REAL NOT NULL DEFAULT 0.5');

  // System characters (Inbox, future internal helpers). Hidden from normal lists by default.
  await ensureColumn(db, 'Character', 'is_system', 'INTEGER NOT NULL DEFAULT 0');

  // Soft delete (Trash) for characters.
  await ensureColumn(db, 'Character', 'deleted_at', 'DATETIME');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_character_deleted_at ON Character(deleted_at)');

  // ImageAsset: allow duplicates (no unique index), plus optional tags and reference-mode.
  await run(db, 'DROP INDEX IF EXISTS idx_image_dedupe');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_hash ON ImageAsset(character_id, file_hash)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_character_id ON ImageAsset(character_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_added_at ON ImageAsset(added_at)');
  await ensureColumn(db, 'ImageAsset', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'ImageAsset', 'suggested_tags_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'ImageAsset', 'auto_tagged_at', 'DATETIME');
  await ensureColumn(db, 'ImageAsset', 'storage_mode', "TEXT NOT NULL DEFAULT 'copy'");
  await ensureColumn(db, 'ImageAsset', 'source_path', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'source_url', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'source_note', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'palette_json', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'dhash_hex', 'TEXT');
  await ensureColumn(db, 'ImageAsset', "review_status", "TEXT NOT NULL DEFAULT 'accepted'");
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_tags_json ON ImageAsset(tags_json)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_review_status ON ImageAsset(character_id, review_status)');

  // WP-0100: image-sourcing provenance + sheet-version linkage. All
  // nullable so existing rows stay valid; new ingestion paths fill them.
  await ensureColumn(db, 'ImageAsset', 'source_dataset_id', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'source_task_id', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'source_run_id', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'source_contact_sheet_ref', 'TEXT');
  await ensureColumn(db, 'ImageAsset', 'sheet_version_id', 'TEXT');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_source_selection ON ImageAsset(character_id, source_dataset_id, source_task_id, source_contact_sheet_ref)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_source_url ON ImageAsset(character_id, source_url)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_sheet_version ON ImageAsset(sheet_version_id)');

  // WP-0100: per-character helper scripts (image-sourcing collectors,
  // selectors, validators) ingested from a task's task_tools/scripts/.
  // Files live under libraryRoot/characters/<character_id>/scripts/;
  // this table is the index. Dedup by (character_id, script_bytes_hash).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS CharacterScript (
      script_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      source_task_id TEXT,
      script_bytes_hash TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_character_script_character ON CharacterScript(character_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_character_script_dedupe ON CharacterScript(character_id, script_bytes_hash);
  `
  );

  // WP-0100: ingestion audit. One IngestionBatch row per
  // ingestImageSourcingTask invocation; one IngestionRejection row per
  // item in a task's rejected lane (audit only, no ImageAsset row).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS IngestionBatch (
      batch_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      sheet_version_id TEXT,
      dataset_id TEXT,
      task_id TEXT,
      spec_version TEXT,
      lane TEXT NOT NULL,
      requirements_snapshot TEXT NOT NULL DEFAULT '',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      imported_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ingestion_batch_character ON IngestionBatch(character_id);
    CREATE INDEX IF NOT EXISTS idx_ingestion_batch_task ON IngestionBatch(dataset_id, task_id);

    CREATE TABLE IF NOT EXISTS IngestionRejection (
      rejection_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      source_url TEXT,
      source_path TEXT,
      rejection_reason TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(batch_id) REFERENCES IngestionBatch(batch_id) ON DELETE CASCADE,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ingestion_rejection_batch ON IngestionRejection(batch_id);
    CREATE INDEX IF NOT EXISTS idx_ingestion_rejection_character ON IngestionRejection(character_id);
  `
  );

  // Field values: speed up cross-character lookups (value suggestions, exports, etc.).
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_field_value_field_id ON FieldValue(field_id)');

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
  await ensureColumn(db, 'SavedSearch', 'tag_mode', "TEXT NOT NULL DEFAULT 'all'");
  await ensureColumn(db, 'SavedSearch', 'tag_exclude_json', "TEXT NOT NULL DEFAULT '[]'");

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

  // Notes / Stories / Moodboards (DB-first docs libraries).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS NoteDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_note_updated ON NoteDoc(updated_at DESC);

    CREATE TABLE IF NOT EXISTS StoryDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_story_updated ON StoryDoc(updated_at DESC);

    CREATE TABLE IF NOT EXISTS MoodboardDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      board_json TEXT NOT NULL DEFAULT '{}',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_moodboard_updated ON MoodboardDoc(updated_at DESC);
  `
  );

  // Stories: corkboard/outliner state (stored separately from free text).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS StoryBoard (
      doc_id TEXT PRIMARY KEY,
      board_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(doc_id) REFERENCES StoryDoc(doc_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_storyboard_updated ON StoryBoard(updated_at DESC);
  `
  );

  // Link index for [[...]] backlinks (computed on save; no text rewriting).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS LinkIndex (
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(source_type, source_id, target_type, target_id, raw_text)
    );

    CREATE INDEX IF NOT EXISTS idx_link_target ON LinkIndex(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_link_source ON LinkIndex(source_type, source_id);
  `
  );

  // Image annotations / pins (non-destructive overlays per image).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS ImageAnnotation (
      image_id TEXT PRIMARY KEY,
      annotations_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(image_id) REFERENCES ImageAsset(image_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_annotation_updated ON ImageAnnotation(updated_at DESC);
  `
  );

  // Collections / playlists (cross-character image sets).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS Collection (
      collection_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CollectionItem (
      collection_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(collection_id, image_id),
      FOREIGN KEY(collection_id) REFERENCES Collection(collection_id) ON DELETE CASCADE,
      FOREIGN KEY(image_id) REFERENCES ImageAsset(image_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_collection_item_order ON CollectionItem(collection_id, sort_order, added_at);
  `
  );

  // Character relationships (explicit structured edges).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS CharacterRelation (
      relation_id TEXT PRIMARY KEY,
      source_character_id TEXT NOT NULL,
      target_character_id TEXT NOT NULL,
      rel_type TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_character_id) REFERENCES Character(character_id) ON DELETE CASCADE,
      FOREIGN KEY(target_character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_relation_source ON CharacterRelation(source_character_id);
    CREATE INDEX IF NOT EXISTS idx_relation_target ON CharacterRelation(target_character_id);
  `
  );

  // Lightweight app meta store for one-off migration markers (FTS index built, etc).
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS CkcMeta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
  );

  // Global full-text search (SQLite FTS5). This must be best-effort: some sqlite builds may lack FTS5.
  // When unavailable, the app should still run without global search.
  try {
    await exec(
      db,
      `
      CREATE VIRTUAL TABLE IF NOT EXISTS character_fts USING fts5(
        character_id UNINDEXED,
        field_id UNINDEXED,
        content,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
        doc_id UNINDEXED,
        title,
        content,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS story_fts USING fts5(
        doc_id UNINDEXED,
        title,
        content,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS moodboard_fts USING fts5(
        doc_id UNINDEXED,
        layer_id UNINDEXED,
        content,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS image_fts USING fts5(
        image_id UNINDEXED,
        character_id UNINDEXED,
        content,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS character_fts_field_insert AFTER INSERT ON FieldValue BEGIN
        INSERT INTO character_fts(character_id, field_id, content)
        VALUES (new.character_id, new.field_id, COALESCE(new.value_text, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS character_fts_field_delete AFTER DELETE ON FieldValue BEGIN
        DELETE FROM character_fts WHERE character_id = old.character_id AND field_id = old.field_id;
      END;

      CREATE TRIGGER IF NOT EXISTS character_fts_field_update AFTER UPDATE ON FieldValue BEGIN
        DELETE FROM character_fts WHERE character_id = old.character_id AND field_id = old.field_id;
        INSERT INTO character_fts(character_id, field_id, content)
        VALUES (new.character_id, new.field_id, COALESCE(new.value_text, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS character_fts_character_insert AFTER INSERT ON Character BEGIN
        INSERT INTO character_fts(character_id, field_id, content)
        VALUES (new.character_id, '__NAME__', TRIM(COALESCE(new.display_name, '') || ' ' || COALESCE(new.public_id, '')));
      END;

      CREATE TRIGGER IF NOT EXISTS character_fts_character_delete AFTER DELETE ON Character BEGIN
        DELETE FROM character_fts WHERE character_id = old.character_id;
      END;

      CREATE TRIGGER IF NOT EXISTS character_fts_character_update AFTER UPDATE ON Character BEGIN
        DELETE FROM character_fts WHERE character_id = old.character_id AND field_id = '__NAME__';
        INSERT INTO character_fts(character_id, field_id, content)
        VALUES (new.character_id, '__NAME__', TRIM(COALESCE(new.display_name, '') || ' ' || COALESCE(new.public_id, '')));
      END;

      CREATE TRIGGER IF NOT EXISTS note_fts_insert AFTER INSERT ON NoteDoc BEGIN
        INSERT INTO note_fts(doc_id, title, content)
        VALUES (new.doc_id, COALESCE(new.title, ''), COALESCE(new.body_text, '') || ' ' || COALESCE(new.tags_json, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS note_fts_delete AFTER DELETE ON NoteDoc BEGIN
        DELETE FROM note_fts WHERE doc_id = old.doc_id;
      END;

      CREATE TRIGGER IF NOT EXISTS note_fts_update AFTER UPDATE ON NoteDoc BEGIN
        DELETE FROM note_fts WHERE doc_id = old.doc_id;
        INSERT INTO note_fts(doc_id, title, content)
        VALUES (new.doc_id, COALESCE(new.title, ''), COALESCE(new.body_text, '') || ' ' || COALESCE(new.tags_json, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS story_fts_insert AFTER INSERT ON StoryDoc BEGIN
        INSERT INTO story_fts(doc_id, title, content)
        VALUES (new.doc_id, COALESCE(new.title, ''), COALESCE(new.body_text, '') || ' ' || COALESCE(new.tags_json, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS story_fts_delete AFTER DELETE ON StoryDoc BEGIN
        DELETE FROM story_fts WHERE doc_id = old.doc_id;
      END;

      CREATE TRIGGER IF NOT EXISTS story_fts_update AFTER UPDATE ON StoryDoc BEGIN
        DELETE FROM story_fts WHERE doc_id = old.doc_id;
        INSERT INTO story_fts(doc_id, title, content)
        VALUES (new.doc_id, COALESCE(new.title, ''), COALESCE(new.body_text, '') || ' ' || COALESCE(new.tags_json, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS image_fts_insert AFTER INSERT ON ImageAsset BEGIN
        INSERT INTO image_fts(image_id, character_id, content)
        VALUES (new.image_id, new.character_id, COALESCE(new.notes, '') || ' ' || COALESCE(new.source_note, '') || ' ' || COALESCE(new.tags_json, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS image_fts_delete AFTER DELETE ON ImageAsset BEGIN
        DELETE FROM image_fts WHERE image_id = old.image_id;
      END;

      CREATE TRIGGER IF NOT EXISTS image_fts_update AFTER UPDATE ON ImageAsset BEGIN
        DELETE FROM image_fts WHERE image_id = old.image_id;
        INSERT INTO image_fts(image_id, character_id, content)
        VALUES (new.image_id, new.character_id, COALESCE(new.notes, '') || ' ' || COALESCE(new.source_note, '') || ' ' || COALESCE(new.tags_json, ''));
      END;
    `
    );
  } catch {
    // FTS5 not available (or other creation error). Keep the app running; search will be disabled.
  }
}

async function initPostgresSchema(db) {
  await exec(
    db,
    `
    CREATE TABLE IF NOT EXISTS Character (
      character_id TEXT PRIMARY KEY,
      public_id TEXT UNIQUE,
      display_name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      template_hash TEXT NOT NULL,
      search_blob TEXT NOT NULL DEFAULT '',
      search_blob_ids TEXT NOT NULL DEFAULT '',
      search_blob_labels TEXT NOT NULL DEFAULT '',
      search_blob_values TEXT NOT NULL DEFAULT '',
      search_blob_tags TEXT NOT NULL DEFAULT '',
      search_blob_name TEXT NOT NULL DEFAULT '',
      icon_image_id TEXT,
      icon_focus_x DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      icon_focus_y DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      is_system INTEGER NOT NULL DEFAULT 0,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_character_public_id ON Character(public_id);
    CREATE INDEX IF NOT EXISTS idx_character_created_at ON Character(created_at);
    CREATE INDEX IF NOT EXISTS idx_character_updated_at ON Character(updated_at);
    CREATE INDEX IF NOT EXISTS idx_character_deleted_at ON Character(deleted_at);

    CREATE TABLE IF NOT EXISTS Template (
      template_id TEXT PRIMARY KEY,
      version_label TEXT,
      source_path TEXT,
      template_hash TEXT,
      ast_json TEXT,
      raw_text TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FieldValue (
      character_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      value_text TEXT,
      value_type TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(character_id, field_id),
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_field_value_field_id ON FieldValue(field_id);

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

    CREATE TABLE IF NOT EXISTS SheetFile (
      character_id TEXT NOT NULL,
      path TEXT PRIMARY KEY,
      format TEXT CHECK(format IN ('txt', 'md')) NOT NULL,
      raw_text TEXT,
      last_export_hash TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SheetVersion (
      version_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
      added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      favorite INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      suggested_tags_json TEXT NOT NULL DEFAULT '[]',
      auto_tagged_at TIMESTAMPTZ,
      storage_mode TEXT NOT NULL DEFAULT 'copy',
      source_path TEXT,
      source_url TEXT,
      source_note TEXT,
      palette_json TEXT,
      dhash_hex TEXT,
      review_status TEXT NOT NULL DEFAULT 'accepted',
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_hash ON ImageAsset(character_id, file_hash);
    CREATE INDEX IF NOT EXISTS idx_image_character_id ON ImageAsset(character_id);
    CREATE INDEX IF NOT EXISTS idx_image_added_at ON ImageAsset(added_at);
    CREATE INDEX IF NOT EXISTS idx_image_tags_json ON ImageAsset(tags_json);
    CREATE INDEX IF NOT EXISTS idx_image_review_status ON ImageAsset(character_id, review_status);

    CREATE TABLE IF NOT EXISTS TemplateSpinOff (
      spinoff_id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      template_hash_at_create TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      field_id_list TEXT NOT NULL,
      format TEXT CHECK(format IN ('llm_pack_strict', 'fieldpack_with_values')) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
      template_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS SavedSearch (
      search_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      query_text TEXT NOT NULL DEFAULT '',
      scope_flags_json TEXT NOT NULL DEFAULT '{}',
      tag_filters_json TEXT NOT NULL DEFAULT '[]',
      gallery_filters_json TEXT NOT NULL DEFAULT '{}',
      tag_mode TEXT NOT NULL DEFAULT 'all',
      tag_exclude_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_builtin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS TagTemplate (
      template_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      description TEXT,
      tags_json TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(template_name, version)
    );

    CREATE TABLE IF NOT EXISTS AuditLog (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      character_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      details_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_character_time ON AuditLog(character_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS NoteDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_note_updated ON NoteDoc(updated_at DESC);

    CREATE TABLE IF NOT EXISTS StoryDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_story_updated ON StoryDoc(updated_at DESC);

    CREATE TABLE IF NOT EXISTS MoodboardDoc (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      board_json TEXT NOT NULL DEFAULT '{}',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_moodboard_updated ON MoodboardDoc(updated_at DESC);

    CREATE TABLE IF NOT EXISTS StoryBoard (
      doc_id TEXT PRIMARY KEY,
      board_json TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(doc_id) REFERENCES StoryDoc(doc_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_storyboard_updated ON StoryBoard(updated_at DESC);

    CREATE TABLE IF NOT EXISTS LinkIndex (
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(source_type, source_id, target_type, target_id, raw_text)
    );

    CREATE INDEX IF NOT EXISTS idx_link_target ON LinkIndex(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_link_source ON LinkIndex(source_type, source_id);

    CREATE TABLE IF NOT EXISTS ImageAnnotation (
      image_id TEXT PRIMARY KEY,
      annotations_json TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(image_id) REFERENCES ImageAsset(image_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_annotation_updated ON ImageAnnotation(updated_at DESC);

    CREATE TABLE IF NOT EXISTS Collection (
      collection_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CollectionItem (
      collection_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(collection_id, image_id),
      FOREIGN KEY(collection_id) REFERENCES Collection(collection_id) ON DELETE CASCADE,
      FOREIGN KEY(image_id) REFERENCES ImageAsset(image_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_collection_item_order ON CollectionItem(collection_id, sort_order, added_at);

    CREATE TABLE IF NOT EXISTS CharacterRelation (
      relation_id TEXT PRIMARY KEY,
      source_character_id TEXT NOT NULL,
      target_character_id TEXT NOT NULL,
      rel_type TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_character_id) REFERENCES Character(character_id) ON DELETE CASCADE,
      FOREIGN KEY(target_character_id) REFERENCES Character(character_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_relation_source ON CharacterRelation(source_character_id);
    CREATE INDEX IF NOT EXISTS idx_relation_target ON CharacterRelation(target_character_id);

    CREATE TABLE IF NOT EXISTS CkcMeta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CkcDbMigration (
      migration_key TEXT PRIMARY KEY,
      migration_value TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `
  );

  await run(
    db,
    `INSERT INTO CkcDbMigration(migration_key, migration_value, updated_at)
     VALUES(?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(migration_key) DO UPDATE SET
       migration_value = excluded.migration_value,
       updated_at = CURRENT_TIMESTAMP`,
    ['postgres_schema', 'v1']
  );
}

async function initSchema(db) {
  if (isPostgresDb(db)) {
    await initPostgresSchema(db);
    return;
  }

  const schema = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS Character (
      character_id TEXT PRIMARY KEY,
      public_id TEXT UNIQUE,
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
  exec,
  ensureColumn,
  resolveDbConfig,
  isPostgresDb,
  translatePostgresSql,
  POSTGRES_TABLE_ORDER,
  dbNotReady,
};
