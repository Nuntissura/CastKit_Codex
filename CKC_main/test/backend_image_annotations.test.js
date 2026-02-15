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

test('image annotations roundtrip stores pins JSON per image', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId: a, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  const ann = { version: 1, pins: [{ id: 'p1', x: 0.25, y: 0.5, text: 'hello' }] };
  const setRes = await lib.setImageAnnotations({ imageId, annotations: ann });
  assert.equal(setRes.ok, true);

  const got = await lib.getImageAnnotations({ imageId });
  assert.equal(got.ok, true);
  assert.equal(got.imageId, imageId);
  assert.equal(got.annotations.version, 1);
  assert.deepEqual(got.annotations.pins, ann.pins);

  lib.close();
});

