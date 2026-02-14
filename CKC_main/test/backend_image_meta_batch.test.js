const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

function writeTinyPng(absPath) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
}

test('setImagesMetaBatch applies favorite/rating/tags across multiple images', async (t) => {
  const libraryRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
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

  await lib.setImagesMetaBatch({ imageIds: [imgA, imgB], favorite: true, rating: 4, addTags: ['foo', 'carousel'] });

  const charA = await lib.getCharacter(a);
  const charB = await lib.getCharacter(b);
  assert.ok(charA);
  assert.ok(charB);

  const rowA = (charA.images || []).find((x) => x.id === imgA);
  const rowB = (charB.images || []).find((x) => x.id === imgB);
  assert.ok(rowA);
  assert.ok(rowB);

  assert.equal(rowA.favorite, true);
  assert.equal(rowB.favorite, true);
  assert.equal(rowA.rating, 4);
  assert.equal(rowB.rating, 4);
  assert.ok(rowA.tags.includes('foo'));
  assert.ok(rowB.tags.includes('foo'));
  assert.ok(rowA.tags.includes('carousel'));
  assert.ok(rowB.tags.includes('carousel'));

  await lib.setImagesMetaBatch({ imageIds: [imgA, imgB], removeTags: ['foo'], rating: 0 });

  const reopenedA = await lib.getCharacter(a);
  const reopenedB = await lib.getCharacter(b);
  assert.ok(reopenedA);
  assert.ok(reopenedB);
  const rowA2 = (reopenedA.images || []).find((x) => x.id === imgA);
  const rowB2 = (reopenedB.images || []).find((x) => x.id === imgB);
  assert.ok(rowA2);
  assert.ok(rowB2);
  assert.equal(rowA2.rating, 0);
  assert.equal(rowB2.rating, 0);
  assert.ok(!rowA2.tags.includes('foo'));
  assert.ok(!rowB2.tags.includes('foo'));
  assert.ok(rowA2.tags.includes('carousel'));
  assert.ok(rowB2.tags.includes('carousel'));

  lib.close();
});

