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

test('rating operators filter characters; global carousel prefers frontpage', async (t) => {
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
  t.after(() => lib.close());

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const srcA = path.join(libraryRoot, 'a.png');
  writeTinyPng(srcA);
  const importedA = await lib.importImages({ characterId: a, filePaths: [srcA], duplicatePolicy: 'skip' });
  assert.equal(importedA.imported.length, 1);
  const imgA = importedA.imported[0].id;

  const srcB = path.join(libraryRoot, 'b.png');
  writeTinyPng(srcB);
  const importedB = await lib.importImages({ characterId: b, filePaths: [srcB], duplicatePolicy: 'skip' });
  assert.equal(importedB.imported.length, 1);
  const imgB = importedB.imported[0].id;

  await lib.setImageMeta({ imageId: imgA, rating: 5, favorite: true, tags: ['carousel'] });
  await lib.setImageMeta({ imageId: imgB, rating: 1, favorite: false, tags: ['carousel'] });

  const ge4 = await lib.listCharacters({ galleryFilters: { ratingOp: '>=', ratingValue: 4 } });
  assert.ok(ge4.some((c) => c.id === a));
  assert.ok(!ge4.some((c) => c.id === b));

  const eq1 = await lib.listCharacters({ galleryFilters: { ratingOp: '=', ratingValue: 1 } });
  assert.ok(!eq1.some((c) => c.id === a));
  assert.ok(eq1.some((c) => c.id === b));

  const favOnly = await lib.listCharacters({ galleryFilters: { favoriteOnly: true } });
  assert.ok(favOnly.some((c) => c.id === a));
  assert.ok(!favOnly.some((c) => c.id === b));

  // Global carousel: if any frontpage images exist, show only frontpage; otherwise show carousel.
  const noFrontpage = await lib.listGlobalCarouselImages({ preferFrontpage: true });
  assert.ok(noFrontpage.some((img) => img.id === imgA));
  assert.ok(noFrontpage.some((img) => img.id === imgB));

  await lib.setImageMeta({ imageId: imgA, tags: ['frontpage'] });

  const preferFrontpage = await lib.listGlobalCarouselImages({ preferFrontpage: true });
  assert.ok(preferFrontpage.some((img) => img.id === imgA));
  assert.ok(!preferFrontpage.some((img) => img.id === imgB));

  const preferCarousel = await lib.listGlobalCarouselImages({ preferFrontpage: false });
  assert.ok(!preferCarousel.some((img) => img.id === imgA));
  assert.ok(preferCarousel.some((img) => img.id === imgB));
});

