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

test('character templates: save -> list -> get', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Alpha' });
  await lib.saveCharacter({
    characterId,
    valuesById: { 'CHAR-ID-006': 'NPC' },
    validationMode: 'strict',
    allowSaveWithErrors: true,
    source: 'ui_edit',
    versionNotes: 'test',
  });

  const saved = await lib.saveCharacterTemplateFromCharacter({ characterId, name: 'Alpha template', includeImages: false, overwrite: true });
  assert.equal(saved.ok, true);
  assert.ok(String(saved.templateId).length > 0);
  assert.equal(saved.imageCount, 0);
  assert.equal(saved.fieldCount, 2); // Name + Primary_Role

  const list = await lib.listCharacterTemplates();
  const row = list.find((x) => x.id === saved.templateId);
  assert.ok(row);
  assert.equal(row.isBuiltIn, false);
  assert.equal(row.fieldCount, 2);

  const detail = await lib.getCharacterTemplate({ templateId: saved.templateId });
  assert.equal(detail.templateId, saved.templateId);
  assert.equal(detail.isBuiltIn, false);
  assert.ok(detail.fields.every((f) => f.fieldId !== 'CHAR-ID-001'));
  assert.ok(detail.fields.every((f) => !String(f.fieldId).startsWith('CHAR-DQR-')));

  lib.close();
});

test('character templates: create N characters from template', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const sourceId = await lib.createCharacter({ displayName: 'Source' });
  await lib.saveCharacter({
    characterId: sourceId,
    valuesById: { 'CHAR-ID-006': 'NPC' },
    validationMode: 'strict',
    allowSaveWithErrors: true,
    source: 'ui_edit',
    versionNotes: 'test',
  });

  const saved = await lib.saveCharacterTemplateFromCharacter({ characterId: sourceId, name: 'NPC Template', includeImages: false, overwrite: true });

  const res = await lib.createCharactersFromTemplate({ templateId: saved.templateId, count: 3, includeImages: false, numberNames: true });
  assert.equal(res.ok, true);
  assert.equal(res.created.length, 3);

  const names = [];
  for (const c of res.created) {
    const ch = await lib.getCharacter(c.characterId);
    assert.ok(ch);
    names.push(ch.displayName);
    assert.equal(ch.valuesById['CHAR-ID-006'], 'NPC');
    assert.ok(String(ch.publicId || '').trim().length > 0);
  }
  assert.deepEqual(names, ['NPC Template 1', 'NPC Template 2', 'NPC Template 3']);

  lib.close();
});

test('cloneCharacter: sheet-only vs with-images', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const sourceId = await lib.createCharacter({ displayName: 'HasImage' });
  const srcPath = path.join(libraryRoot, 'one.png');
  fs.writeFileSync(srcPath, Buffer.from('fakepng', 'utf8'));
  const imported = await lib.importImages({ characterId: sourceId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  await lib.setImageMeta({ imageId, favorite: true, rating: 4, notes: 'hello', tags: ['tag1'] });

  const sheetOnly = await lib.cloneCharacter({ sourceCharacterId: sourceId, includeImages: false, displayName: 'Clone sheet' });
  assert.equal(sheetOnly.ok, true);
  const sheetChar = await lib.getCharacter(sheetOnly.characterId);
  assert.ok(sheetChar);
  assert.equal(sheetChar.images.length, 0);

  const withImages = await lib.cloneCharacter({ sourceCharacterId: sourceId, includeImages: true, displayName: 'Clone full' });
  assert.equal(withImages.ok, true);
  const fullChar = await lib.getCharacter(withImages.characterId);
  assert.ok(fullChar);
  assert.equal(fullChar.images.length, 1);
  assert.equal(fullChar.images[0].favorite, true);
  assert.equal(fullChar.images[0].rating, 4);
  assert.equal(fullChar.images[0].notes, 'hello');
  assert.deepEqual(fullChar.images[0].tags, ['tag1']);

  lib.close();
});

