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

test('stories: corkboard board persists + participates in link index', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const created = await lib.upsertDoc({
    docType: 'stories',
    title: 'My Story',
    content: 'Intro text [[tag:alpha]]',
    tags: [],
  });
  assert.equal(created.ok, true);
  const docId = created.docId;

  const before = await lib.getStoryBoard({ docId });
  assert.equal(before.ok, true);
  assert.deepEqual(before.board.cards, []);

  const setRes = await lib.setStoryBoard({
    docId,
    board: {
      version: 1,
      cards: [
        { id: '', text: 'Card one [[tag:beta]]' },
        { id: 'c2', text: 'Card two' },
      ],
    },
  });
  assert.equal(setRes.ok, true);

  const after = await lib.getStoryBoard({ docId });
  assert.equal(after.ok, true);
  assert.equal(after.board.version, 1);
  assert.equal(after.board.cards.length, 2);
  assert.ok(after.board.cards[0].id, 'expected empty card id to be normalized');
  assert.equal(after.board.cards[0].text, 'Card one [[tag:beta]]');
  assert.equal(after.board.cards[1].id, 'c2');

  const backlinks = await lib.listBacklinks({ targetType: 'tag', targetId: 'beta', limit: 50 });
  assert.ok(backlinks.some((b) => b.sourceType === 'stories' && b.sourceId === docId));

  await lib.setStoryBoard({
    docId,
    board: {
      version: 1,
      cards: [after.board.cards[1], after.board.cards[0]],
    },
  });
  const reordered = await lib.getStoryBoard({ docId });
  assert.equal(reordered.board.cards[0].id, 'c2');

  lib.close();
});

