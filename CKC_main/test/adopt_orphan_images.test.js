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
const { get } = require('../app/backend/db');
const { getPendingFullResetMarkerPath, writePendingFullResetMarker } = require('../app/backend/resetModes');

function writeTinyPng(absPath) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
}

function makeLibraryRoot(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-adopt-orphans-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  return libraryRoot;
}

function makeLib(libraryRoot) {
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

test('adoptOrphanImages restores image metadata and is idempotent', async (t) => {
  const libraryRoot = makeLibraryRoot(t);
  const lib = makeLib(libraryRoot);
  await lib.initialize();

  const oldCharacterId = await lib.createCharacter({ displayName: 'Old Source' });
  const srcPath = path.join(libraryRoot, 'adopt-source.png');
  writeTinyPng(srcPath);
  const imported = await lib.importImages({ characterId: oldCharacterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  const oldImageId = imported.imported[0].id;
  await lib.setImageMeta({
    imageId: oldImageId,
    favorite: true,
    rating: 5,
    notes: 'adopt me',
    tags: ['orphan', 'recover'],
    sourceNote: 'source-note',
  });

  const markerPath = getPendingFullResetMarkerPath(libraryRoot);
  writePendingFullResetMarker({ markerPath, libraryRoot });
  const reset = await lib.runPendingFullReset({ markerPath, now: new Date('2026-05-07T12:01:00Z') });
  lib.close();

  const lib2 = makeLib(libraryRoot);
  await lib2.initialize();
  t.after(() => lib2.close());

  const manifests = lib2.listOrphanManifests();
  assert.equal(manifests.length, 1);
  assert.equal(manifests[0].manifestPath, reset.manifestPath);

  const adopted = await lib2.adoptOrphanImages({ manifestPath: reset.manifestPath, targetCharacterId: '__new__' });
  assert.equal(adopted.ok, true);
  assert.equal(adopted.adopted.length, 1);
  assert.equal(adopted.skipped.length, 0);
  assert.equal(adopted.errors.length, 0);

  const targetCharacterId = adopted.adopted[0].targetCharacterId;
  const createdCharacter = await lib2.getCharacter(targetCharacterId);
  assert.equal(createdCharacter.displayName, 'Old Source');
  assert.equal(createdCharacter.images.length, 1);
  assert.equal(createdCharacter.images[0].rating, 5);
  assert.equal(createdCharacter.images[0].favorite, true);
  assert.equal(createdCharacter.images[0].notes, 'adopt me');
  assert.deepEqual(createdCharacter.images[0].tags.sort(), ['orphan', 'recover'].sort());

  const row = await get(lib2.db, 'SELECT source_note, file_hash FROM ImageAsset WHERE image_id = ?', [adopted.adopted[0].imageId]);
  assert.equal(row.source_note, 'source-note');
  assert.equal(row.file_hash, adopted.adopted[0].fileHash);

  const adoptedAgain = await lib2.adoptOrphanImages({ manifestPath: reset.manifestPath, targetCharacterId });
  assert.equal(adoptedAgain.adopted.length, 0);
  assert.equal(adoptedAgain.skipped.length, 1);
  assert.equal(adoptedAgain.skipped[0].reason, 'duplicate');
});
