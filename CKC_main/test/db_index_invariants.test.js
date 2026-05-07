delete process.env.CKC_DB_PROVIDER;
delete process.env.CKC_DATABASE_PROVIDER;
delete process.env.CKC_POSTGRES_URL;
delete process.env.CKC_POSTGRES_CONNECTION_STRING;
delete process.env.DATABASE_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { all } = require('../app/backend/db');

const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-index-pin-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  return dir;
}

async function sqliteIndexColumns(db) {
  const indexes = await all(db, `PRAGMA index_list(ImageAsset)`);
  const out = new Map();
  for (const idx of indexes) {
    const name = String(idx.name || '');
    if (!name) continue;
    const cols = await all(db, `PRAGMA index_info(${name})`);
    out.set(name, cols.sort((a, b) => Number(a.seqno) - Number(b.seqno)).map((col) => String(col.name)));
  }
  return out;
}

test('ImageAsset pinned indexes are present on fresh SQLite schema', async (t) => {
  const libraryRoot = makeTempDir(t);
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();
  t.after(() => lib.close());

  const indexes = await sqliteIndexColumns(lib.db);
  const required = new Map([
    ['idx_image_hash', ['character_id', 'file_hash']],
    ['idx_image_file_hash', ['file_hash']],
    ['idx_image_sheet_version', ['sheet_version_id']],
    ['idx_image_source_task', ['source_dataset_id', 'source_task_id']],
    ['idx_image_review_status_character', ['review_status', 'character_id']],
  ]);

  const failures = [];
  for (const [indexName, expectedColumns] of required) {
    const actual = indexes.get(indexName);
    if (!actual) {
      failures.push(`${indexName}: missing`);
      continue;
    }
    if (actual.join(',') !== expectedColumns.join(',')) {
      failures.push(`${indexName}: expected ${expectedColumns.join(',')} got ${actual.join(',')}`);
    }
  }

  assert.deepEqual(failures, []);
});
