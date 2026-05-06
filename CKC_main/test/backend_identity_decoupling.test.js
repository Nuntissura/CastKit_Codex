// WP-0100 slice 2: identity-decoupling enforcement.
//
// Per CKC_GOV/PROJECT_CODEX.md "Identity decoupling" section: imported
// image filenames inside libraryRoot are content-hash addressed; the
// character's name never appears in any path or sync-event payload.
// This test creates a character with a recognizable name and asserts
// _importOneImageWithProvenance produces a path that contains neither
// substring.

// Force SQLite regardless of operator env.
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

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-id-'));
  t.after(() => {
    try { fs.rmSync(libraryRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

test('identity decoupling: imported image path contains no character name', { timeout: 600000 }, async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Aria Stark' });

  // Write a fixture image file with a name that DOES contain the
  // character's name — this is what an LLM/operator might produce in a
  // task folder. The adapter must not preserve it on disk inside CKC.
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-fixture-'));
  t.after(() => { try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch { /* ignore */ } });
  const sourcePath = path.join(fixtureDir, 'aria_stark_dress_001.png');
  fs.writeFileSync(sourcePath, Buffer.from('arbitrary image bytes for hash test'));

  const res = await lib._importOneImageWithProvenance({
    characterId,
    filePath: sourcePath,
    sourceUrl: 'https://example.com/aria_stark/photo.png',
    provenance: {
      datasetId: 'dataset_x',
      taskId: 'task_y',
      runId: 'run_z',
      contactSheetRef: 'raw_contact_sheet_0001#sel_001',
      sheetVersionId: null,
    },
    reviewStatus: 'accepted',
    addTags: [],
  });

  assert.equal(res.skipped, false);
  assert.match(res.imageId, /^img_/);
  assert.ok(res.relativePath, 'relativePath must be set');

  // The on-disk filename must not contain any name substring.
  const lower = res.relativePath.toLowerCase();
  assert.equal(lower.includes('aria'), false, `relativePath contains 'aria': ${res.relativePath}`);
  assert.equal(lower.includes('stark'), false, `relativePath contains 'stark': ${res.relativePath}`);

  // Verify the file actually landed at the expected location with a
  // hash-addressed filename.
  const paths = lib.getCharacterPaths(characterId);
  const absPath = path.join(paths.base, res.relativePath);
  assert.ok(fs.existsSync(absPath), `expected file at ${absPath}`);

  // Provenance round-trip: read the row back and confirm fields.
  const { all } = require('../app/backend/db');
  const rows = await all(lib.db, 'SELECT image_id, relative_path, source_dataset_id, source_task_id, source_run_id, source_contact_sheet_ref, sheet_version_id, review_status FROM ImageAsset WHERE image_id = ?', [res.imageId]);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.source_dataset_id, 'dataset_x');
  assert.equal(row.source_task_id, 'task_y');
  assert.equal(row.source_run_id, 'run_z');
  assert.equal(row.source_contact_sheet_ref, 'raw_contact_sheet_0001#sel_001');
  assert.equal(row.review_status, 'accepted');

  lib.close();
});
