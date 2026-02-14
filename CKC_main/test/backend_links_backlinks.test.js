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
  return { makeInstance };
}

test('link index: doc->character and doc->doc backlinks resolve', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const note1 = await lib.upsertDoc({ docType: 'notes', title: 'Note One', content: 'Hello [[B]]\n', tags: [] });
  assert.equal(note1.ok, true);

  const note2 = await lib.upsertDoc({
    docType: 'notes',
    title: 'Note Two',
    content: 'See [[doc:Note One]]\n',
    tags: [],
  });
  assert.equal(note2.ok, true);

  const backlinksToB = await lib.listBacklinks({ targetType: 'character', targetId: b });
  assert.ok(Array.isArray(backlinksToB));
  assert.ok(backlinksToB.some((x) => x.sourceType === 'notes' && x.sourceId === note1.docId && x.rawText === 'B'));

  const backlinksToNote1 = await lib.listBacklinks({ targetType: 'doc.notes', targetId: note1.docId });
  assert.ok(Array.isArray(backlinksToNote1));
  assert.ok(
    backlinksToNote1.some((x) => x.sourceType === 'notes' && x.sourceId === note2.docId && x.rawText === 'doc:Note One')
  );

  // Also verify sheet backlinks (character A sheet links to B).
  const chA = await lib.getCharacter(a);
  assert.ok(chA);
  const values = { ...(chA.valuesById || {}) };
  values['CHAR-STY-001'] = '[[B]]';
  const saved = await lib.saveCharacter({ characterId: a, valuesById: values, validationMode: 'strict', allowSaveWithErrors: true });
  assert.equal(saved.ok, true);

  const backlinksToBAfterSheet = await lib.listBacklinks({ targetType: 'character', targetId: b });
  assert.ok(backlinksToBAfterSheet.some((x) => x.sourceType === 'sheet' && x.sourceId === a && x.rawText === 'B'));

  lib.close();
});

