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

test('globalSearch finds matches across sheets/docs/moodboards/images', async (t) => {
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

  const q = 'magic system';

  const characterId = await lib.createCharacter({ displayName: 'Searcher' });
  const templateAst = await lib.getTemplateAst('v2.00');
  const writableField =
    templateAst.sections
      .flatMap((s) => s.fields || [])
      .find((f) => f && f.type !== 'rule' && f.id && !['CHAR-ID-001', 'CHAR-ID-002'].includes(f.id))?.id || 'CHAR-ID-002';

  const char = await lib.getCharacter(characterId);
  assert.ok(char);
  const valuesById = { ...(char.valuesById || {}), [writableField]: `The ${q} uses mana crystals.` };
  const saved = await lib.saveCharacter({ characterId, valuesById, allowSaveWithErrors: true });
  assert.equal(saved.ok, true);

  const note = await lib.upsertDoc({ docType: 'notes', title: 'Magic Note', content: `A note about the ${q}.`, tags: [] });
  assert.equal(note.ok, true);

  const story = await lib.upsertDoc({ docType: 'stories', title: 'Magic Story', content: `Once upon a time.`, tags: [] });
  assert.equal(story.ok, true);
  await lib.setStoryBoard({
    docId: story.docId,
    board: { version: 1, cards: [{ id: 'c1', text: `Board mentions the ${q}.` }] },
  });

  const moodboardState = {
    version: 1,
    strokes: [],
    images: [],
    texts: [
      {
        id: 'txt1',
        x: 0.5,
        y: 0.5,
        w: 0.4,
        h: 0.2,
        text: `Moodboard text: ${q}.`,
      },
    ],
  };
  const mood = await lib.upsertDoc({
    docType: 'moodboard',
    title: 'Magic Moodboard',
    content: JSON.stringify(moodboardState),
    tags: [],
  });
  assert.equal(mood.ok, true);

  const imgPath = path.join(libraryRoot, 'img.png');
  writeTinyPng(imgPath);
  const imported = await lib.importImages({ characterId, filePaths: [imgPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;
  await lib.setImageMeta({ imageId, notes: `Image note: ${q}.`, tags: ['magic'] });

  const res = await lib.globalSearch({ queryText: q, scope: 'library', limitPerType: 50 });
  assert.equal(res.ok, true);

  assert.ok(res.results.characters.some((h) => h.characterId === characterId && h.fieldId === writableField));
  assert.ok(res.results.notes.some((h) => h.docId === note.docId));
  assert.ok(res.results.stories.some((h) => h.docId === story.docId));
  assert.ok(res.results.moodboards.some((h) => h.docId === mood.docId && h.layerId === 'txt1'));
  assert.ok(res.results.images.some((h) => h.imageId === imageId));

  assert.ok(
    [...res.results.characters, ...res.results.notes, ...res.results.stories, ...res.results.moodboards, ...res.results.images].some((h) =>
      String(h.snippet || '').includes('[[[')
    )
  );

  const scoped = await lib.globalSearch({ queryText: q, scope: 'character', characterId, limitPerType: 50 });
  assert.equal(scoped.ok, true);
  assert.ok(scoped.results.characters.some((h) => h.characterId === characterId));
  assert.ok(scoped.results.images.some((h) => h.characterId === characterId));
  assert.equal(scoped.results.notes.length, 0);
  assert.equal(scoped.results.stories.length, 0);
  assert.equal(scoped.results.moodboards.length, 0);

  lib.close();
});

