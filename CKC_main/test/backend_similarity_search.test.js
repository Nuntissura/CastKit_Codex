const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { run } = require('../app/backend/db');

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

test('findSimilarImages returns nearest by dhash distance', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const src1 = path.join(libraryRoot, 'one.png');
  const src2 = path.join(libraryRoot, 'two.png');
  const src3 = path.join(libraryRoot, 'three.png');
  fs.writeFileSync(src1, Buffer.from('fakepng1', 'utf8'));
  fs.writeFileSync(src2, Buffer.from('fakepng2', 'utf8'));
  fs.writeFileSync(src3, Buffer.from('fakepng3', 'utf8'));

  const imp1 = await lib.importImages({ characterId: a, filePaths: [src1], duplicatePolicy: 'skip' });
  const imp2 = await lib.importImages({ characterId: b, filePaths: [src2], duplicatePolicy: 'skip' });
  const imp3 = await lib.importImages({ characterId: b, filePaths: [src3], duplicatePolicy: 'skip' });
  assert.equal(imp1.imported.length, 1);
  assert.equal(imp2.imported.length, 1);
  assert.equal(imp3.imported.length, 1);

  const targetId = imp1.imported[0].id;
  const nearId = imp2.imported[0].id;
  const farId = imp3.imported[0].id;

  // Pre-seed dHash values; tests run with electronNativeImage=null so CKC won't compute hashes here.
  await run(lib.db, 'UPDATE ImageAsset SET dhash_hex = ? WHERE image_id = ?', ['0000000000000000', targetId]);
  await run(lib.db, 'UPDATE ImageAsset SET dhash_hex = ? WHERE image_id = ?', ['0000000000000001', nearId]);
  await run(lib.db, 'UPDATE ImageAsset SET dhash_hex = ? WHERE image_id = ?', ['ffffffffffffffff', farId]);

  const res = await lib.findSimilarImages({ imageId: targetId, maxDistance: 2, limit: 10, maxImages: 100 });
  assert.equal(res.ok, true);
  assert.equal(res.imageId, targetId);
  assert.equal(res.threshold, 2);

  assert.equal(Array.isArray(res.items), true);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].imageId, nearId);
  assert.equal(res.items[0].distance, 1);

  lib.close();
});

