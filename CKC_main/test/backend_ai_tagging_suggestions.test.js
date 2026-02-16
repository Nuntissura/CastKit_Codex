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
  const makeInstance = () => new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  return { makeInstance, libraryRoot };
}

test('AI tag suggestions roundtrip stores/clears suggestions per image', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId: a, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  const initial = await lib.getImageTagSuggestions({ imageId });
  assert.equal(initial.ok, true);
  assert.equal(initial.imageId, imageId);
  assert.deepEqual(initial.suggestions, []);
  assert.equal(initial.autoTaggedAt, null);

  const setRes = await lib.setImageTagSuggestions({
    imageId,
    suggestions: [{ tag: '  Cat  ', confidence: 1.2 }, { tag: 'cat', confidence: 0.1 }, 'dog', { tag: 'Sky', confidence: -1 }],
  });
  assert.equal(setRes.ok, true);
  assert.equal(setRes.imageId, imageId);
  assert.deepEqual(setRes.suggestions, [
    { tag: 'Cat', confidence: 1 },
    { tag: 'dog', confidence: 0.5 },
    { tag: 'Sky', confidence: 0 },
  ]);

  const got = await lib.getImageTagSuggestions({ imageId });
  assert.equal(got.ok, true);
  assert.equal(got.imageId, imageId);
  assert.equal(got.suggestions.length, 3);
  assert.equal(typeof got.autoTaggedAt, 'string');
  assert.ok(String(got.autoTaggedAt).trim().length > 0);

  const clr = await lib.clearImageTagSuggestions({ imageId });
  assert.equal(clr.ok, true);
  assert.equal(clr.imageId, imageId);

  const after = await lib.getImageTagSuggestions({ imageId });
  assert.equal(after.ok, true);
  assert.deepEqual(after.suggestions, []);
  assert.equal(after.autoTaggedAt, null);

  lib.close();
});

test('listImageIdsForAiTagging returns only untagged + unsuggested images by default', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const src1 = path.join(libraryRoot, 'one.png');
  const src2 = path.join(libraryRoot, 'two.png');
  fs.writeFileSync(src1, Buffer.from('fakepng1', 'utf8'));
  fs.writeFileSync(src2, Buffer.from('fakepng2', 'utf8'));
  const imported = await lib.importImages({ characterId: a, filePaths: [src1, src2], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 2);
  const image1 = imported.imported[0].id;
  const image2 = imported.imported[1].id;

  await lib.setImageMeta({ imageId: image2, tags: ['keep'] });

  const ids = await lib.listImageIdsForAiTagging({ mode: 'untagged', limit: 50 });
  assert.deepEqual(ids.sort(), [image1].sort());

  await lib.setImageTagSuggestions({ imageId: image1, suggestions: ['hello'] });
  const ids2 = await lib.listImageIdsForAiTagging({ mode: 'untagged', limit: 50 });
  assert.deepEqual(ids2, []);

  const allIds = await lib.listImageIdsForAiTagging({ mode: 'all', limit: 50 });
  assert.equal(allIds.includes(image1), true);
  assert.equal(allIds.includes(image2), true);

  lib.close();
});

