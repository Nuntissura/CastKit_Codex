const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

function makeLib(t) {
  const libraryRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const makeInstance = () =>
    new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  return { makeInstance, libraryRoot };
}

function writeTinyPng(absPath) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
}

test('collections persist and store cross-character images', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const src = path.join(libraryRoot, 'img.png');
  writeTinyPng(src);

  const importedA = await lib.importImages({ characterId: a, filePaths: [src], duplicatePolicy: 'skip' });
  const importedB = await lib.importImages({ characterId: b, filePaths: [src], duplicatePolicy: 'skip' });
  assert.equal(importedA.imported.length, 1);
  assert.equal(importedB.imported.length, 1);

  const imgA = importedA.imported[0].id;
  const imgB = importedB.imported[0].id;

  const created = await lib.createCollection({ name: 'Test Collection' });
  assert.equal(created.ok, true);

  await lib.addImagesToCollection({ collectionId: created.id, imageIds: [imgA, imgB] });

  const list1 = await lib.listCollections();
  const col1 = list1.find((c) => c.id === created.id);
  assert.ok(col1);
  assert.equal(col1.name, 'Test Collection');
  assert.equal(col1.itemCount, 2);

  const imgs1 = await lib.listCollectionImages({ collectionId: created.id });
  assert.equal(imgs1.length, 2);
  assert.ok(imgs1.some((x) => x.id === imgA));
  assert.ok(imgs1.some((x) => x.id === imgB));

  await lib.removeImagesFromCollection({ collectionId: created.id, imageIds: [imgA] });
  const imgs2 = await lib.listCollectionImages({ collectionId: created.id });
  assert.equal(imgs2.length, 1);
  assert.ok(imgs2[0].id === imgB);

  lib.close();

  const lib2 = makeInstance();
  await lib2.initialize();
  const list2 = await lib2.listCollections();
  const col2 = list2.find((c) => c.id === created.id);
  assert.ok(col2);
  assert.equal(col2.itemCount, 1);
  const imgs3 = await lib2.listCollectionImages({ collectionId: created.id });
  assert.equal(imgs3.length, 1);
  assert.equal(imgs3[0].id, imgB);
  lib2.close();
});

