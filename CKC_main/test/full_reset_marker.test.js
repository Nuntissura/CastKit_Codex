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
const { get, run } = require('../app/backend/db');
const {
  getPendingFullResetMarkerPath,
  writePendingFullResetMarker,
  PRESERVED_IMAGE_RELATIVE_DIRS,
} = require('../app/backend/resetModes');
const { sha256Hex } = require('../app/backend/crypto');

const SAMPLE_DIR = 'D:\\Projects\\LLM projects\\OpenRepose\\test_material\\image_samples';

function sampleImagePath() {
  try {
    const found = fs
      .readdirSync(SAMPLE_DIR)
      .filter((name) => /\.(png|jpe?g|webp|bmp)$/i.test(name))
      .sort()[0];
    if (found) return path.join(SAMPLE_DIR, found);
  } catch {
    // fall through to tiny fixture
  }
  return null;
}

function writeTinyPng(absPath) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
}

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-full-reset-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return {
    libraryRoot,
    lib: new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null }),
  };
}

test('pending full reset writes orphan manifest, truncates content tables, and preserves image bytes', async (t) => {
  const { libraryRoot, lib } = makeLib(t);
  await lib.initialize();
  t.after(() => lib.close());

  await run(lib.db, `INSERT INTO CkcMeta(meta_key, meta_value) VALUES(?, ?)`, ['keep', 'yes']);

  const characterId = await lib.createCharacter({ displayName: 'Reset Sample' });
  const srcPath = sampleImagePath() || path.join(libraryRoot, 'sample.png');
  if (!fs.existsSync(srcPath)) writeTinyPng(srcPath);

  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;
  await lib.setImageMeta({ imageId, favorite: true, rating: 4, notes: 'preserve this row', tags: ['reset', 'sample'] });

  const characterPaths = lib.getCharacterPaths(characterId);
  const originalAbs = path.join(characterPaths.base, imported.imported[0].relativePath.replaceAll('/', path.sep));
  const originalHash = sha256Hex(fs.readFileSync(originalAbs));
  fs.mkdirSync(characterPaths.extrasDir, { recursive: true });
  fs.writeFileSync(path.join(characterPaths.extrasDir, 'delete-me.txt'), 'derived', 'utf8');

  const markerPath = getPendingFullResetMarkerPath(libraryRoot);
  writePendingFullResetMarker({ markerPath, libraryRoot });
  const result = await lib.runPendingFullReset({ markerPath, now: new Date('2026-05-07T12:00:00Z') });

  assert.equal(result.ok, true);
  assert.equal(result.ran, true);
  assert.equal(result.orphanCount, 1);
  assert.equal(fs.existsSync(markerPath), false);
  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(fs.existsSync(originalAbs), true);
  assert.equal(sha256Hex(fs.readFileSync(originalAbs)), originalHash);
  assert.equal(fs.existsSync(characterPaths.extrasDir), false);

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 1);
  assert.deepEqual(manifest.preserved_dirs, PRESERVED_IMAGE_RELATIVE_DIRS);
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].image_id, imageId);
  assert.equal(manifest.entries[0].display_name, 'Reset Sample');
  assert.equal(manifest.entries[0].rating, 4);
  assert.equal(manifest.entries[0].favorite, 1);
  assert.deepEqual(manifest.entries[0].tags.sort(), ['reset', 'sample'].sort());

  assert.equal(Number((await get(lib.db, 'SELECT COUNT(*) AS c FROM Character')).c), 0);
  assert.equal(Number((await get(lib.db, 'SELECT COUNT(*) AS c FROM ImageAsset')).c), 0);
  assert.equal(Number((await get(lib.db, 'SELECT COUNT(*) AS c FROM Template')).c), 0);
  assert.equal((await get(lib.db, 'SELECT meta_value FROM CkcMeta WHERE meta_key = ?', ['keep'])).meta_value, 'yes');
});
