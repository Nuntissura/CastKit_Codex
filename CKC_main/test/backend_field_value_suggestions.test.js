const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('listFieldValueSuggestions returns distinct recent values per Field ID', async (t) => {
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

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  await lib.saveCharacter({ characterId: a, valuesById: { 'CHAR-ID-004': 'fictional' } });
  await lib.saveCharacter({ characterId: b, valuesById: { 'CHAR-ID-004': 'original' } });
  await lib.saveCharacter({ characterId: b, valuesById: { 'CHAR-ID-006': 'primary role example' } });

  const got = await lib.listFieldValueSuggestions({ fieldId: 'CHAR-ID-004', limit: 20 });
  assert.ok(Array.isArray(got));
  assert.ok(got.includes('fictional'));
  assert.ok(got.includes('original'));
  assert.ok(!got.includes('primary role example'));

  lib.close();
});

