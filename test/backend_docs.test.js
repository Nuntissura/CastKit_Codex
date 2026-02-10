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
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  return { lib, libraryRoot };
}

async function expectDocCrudRoundtrip(t, docType, content) {
  const { lib } = makeLib(t);
  await lib.initialize();
  t.after(() => lib.close());

  const created = await lib.upsertDoc({ docType, title: `Doc ${docType}`, content, tags: ['  alpha ', 'beta', 'beta'] });
  assert.equal(created.ok, true);

  const got = await lib.getDoc({ docType, docId: created.docId });
  assert.ok(got);
  assert.equal(got.id, created.docId);
  assert.equal(got.docType, created.docType);
  assert.equal(got.title, `Doc ${docType}`);
  assert.equal(got.content, content);
  assert.deepEqual(got.tags, ['alpha', 'beta']);

  const list = await lib.listDocs({ docType, queryText: `Doc ${docType}` });
  assert.ok(Array.isArray(list));
  assert.ok(list.some((d) => d.id === created.docId));

  await lib.deleteDoc({ docType, docId: created.docId });
  const afterDelete = await lib.getDoc({ docType, docId: created.docId });
  assert.equal(afterDelete, null);
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

