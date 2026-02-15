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

test('tag manager: listTagStats + renameTag updates images/docs/characters', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });

  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId: a, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  await lib.setImageMeta({ imageId, tags: ['foo', 'keep'] });
  const note1 = await lib.upsertDoc({ docType: 'notes', title: 'N1', content: 'x', tags: ['foo'] });
  assert.equal(note1.ok, true);
  await lib.addManualTag(a, 'foo');

  const statsBefore = await lib.listTagStats();
  const fooBefore = statsBefore.find((s) => s.tag === 'foo');
  assert.ok(fooBefore, 'expected foo to exist');
  assert.equal(fooBefore.imageCount, 1);
  assert.equal(fooBefore.docCount, 1);
  assert.equal(fooBefore.characterCount, 1);

  const res = await lib.renameTag({ fromTag: 'foo', toTag: 'bar' });
  assert.equal(res.ok, true);

  const ch = await lib.getCharacter(a);
  assert.ok(ch);
  const img = (ch.images || []).find((x) => x.id === imageId);
  assert.ok(img);
  assert.deepEqual(img.tags.sort(), ['bar', 'keep'].sort());
  assert.ok((ch.tags || []).some((x) => x.text === 'bar'));
  assert.ok(!(ch.tags || []).some((x) => x.text === 'foo'));

  const d = await lib.getDoc({ docType: 'notes', docId: note1.docId });
  assert.ok(d);
  assert.ok(d.tags.includes('bar'));
  assert.ok(!d.tags.includes('foo'));

  const statsAfter = await lib.listTagStats();
  assert.ok(!statsAfter.some((s) => s.tag === 'foo'));
  const barAfter = statsAfter.find((s) => s.tag === 'bar');
  assert.ok(barAfter);
  assert.equal(barAfter.imageCount, 1);
  assert.equal(barAfter.docCount, 1);
  assert.equal(barAfter.characterCount, 1);

  lib.close();
});
