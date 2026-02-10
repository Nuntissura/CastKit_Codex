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

async function expectDocCrudRoundtrip(t, docType, content) {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const created = await lib.upsertDoc({ docType, title: `Doc ${docType}`, content, tags: ['  alpha ', 'beta', 'beta'] });
  assert.equal(created.ok, true);
  lib.close();

  // "App restart" persistence: reopen the library and confirm the doc is still there.
  const lib2 = makeInstance();
  await lib2.initialize();

  const got = await lib2.getDoc({ docType, docId: created.docId });
  assert.ok(got);
  assert.equal(got.id, created.docId);
  assert.equal(got.docType, created.docType);
  assert.equal(got.title, `Doc ${docType}`);
  assert.equal(got.content, content);
  assert.deepEqual(got.tags, ['alpha', 'beta']);

  const list = await lib2.listDocs({ docType, queryText: `Doc ${docType}` });
  assert.ok(Array.isArray(list));
  assert.ok(list.some((d) => d.id === created.docId));

  await lib2.deleteDoc({ docType, docId: created.docId });
  lib2.close();

  // Reopen again and confirm deletion persists too.
  const lib3 = makeInstance();
  await lib3.initialize();
  const afterDelete = await lib3.getDoc({ docType, docId: created.docId });
  assert.equal(afterDelete, null);
  lib3.close();
}

test('notes CRUD roundtrip preserves bytes', async (t) => {
  const content = 'Line 1\r\nLine 2\nLine 3 — dash\n\nEnds with newline\n';
  await expectDocCrudRoundtrip(t, 'notes', content);
});

test('stories CRUD roundtrip preserves bytes', async (t) => {
  const content = 'Story\n\nParagraph 1\n  Indent stays\n\nFinal line\n';
  await expectDocCrudRoundtrip(t, 'stories', content);
});

test('moodboard CRUD roundtrip preserves JSON string', async (t) => {
  const board = {
    version: 1,
    strokes: [{ tool: 'pen', color: '#ff0000', width: 4, points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] }],
    images: [{ imageId: 'img_test', x: 0.12, y: 0.34, w: 0.2, h: 0.3, rot: 0 }],
  };
  const content = JSON.stringify(board, null, 2) + '\n';
  await expectDocCrudRoundtrip(t, 'moodboard', content);
});
