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

test('character icon can be set/cleared and persists in get/list', async (t) => {
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
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'Icon Test' });

  const srcImg = path.join(libraryRoot, 'src.png');
  writeTinyPng(srcImg);
  const imported = await lib.importImages({ characterId, filePaths: [srcImg], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  await lib.setCharacterIcon({ characterId, imageId, focusX: 0.25, focusY: 0.75 });

  const full = await lib.getCharacter(characterId);
  assert.ok(full);
  assert.equal(full.iconImageId, imageId);
  assert.equal(full.iconFocusX, 0.25);
  assert.equal(full.iconFocusY, 0.75);

  const list = await lib.listCharacters({});
  const listed = list.find((c) => c.id === characterId);
  assert.ok(listed);
  assert.equal(listed.iconImageId, imageId);
  assert.equal(listed.iconFocusX, 0.25);
  assert.equal(listed.iconFocusY, 0.75);

  await lib.setCharacterIcon({ characterId, imageId: null });
  const cleared = await lib.getCharacter(characterId);
  assert.ok(cleared);
  assert.equal(cleared.iconImageId, null);
});

test('setCharacterIcon rejects image ids from other characters', async (t) => {
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
  t.after(() => lib.close());

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const srcImg = path.join(libraryRoot, 'src.png');
  writeTinyPng(srcImg);
  const imported = await lib.importImages({ characterId: a, filePaths: [srcImg], duplicatePolicy: 'skip' });
  const imageId = imported.imported[0].id;

  await assert.rejects(() => lib.setCharacterIcon({ characterId: b, imageId }), /not found for character/i);
});

