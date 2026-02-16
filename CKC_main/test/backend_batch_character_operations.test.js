const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('batchUpdateCharacterField sets/appends/clears values across characters', async (t) => {
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

  const setRes = await lib.batchUpdateCharacterField({
    characterIds: [a, b],
    fieldId: 'CHAR-ID-006',
    operation: 'set',
    valueText: 'Detective',
  });
  assert.equal(setRes.ok, true);
  assert.equal(setRes.updated, 2);

  const ca = await lib.getCharacter(a);
  const cb = await lib.getCharacter(b);
  assert.ok(ca);
  assert.ok(cb);
  assert.equal(ca.valuesById['CHAR-ID-006'], 'Detective');
  assert.equal(cb.valuesById['CHAR-ID-006'], 'Detective');

  await lib.batchUpdateCharacterField({
    characterIds: [a],
    fieldId: 'CHAR-ID-006',
    operation: 'append',
    valueText: '(night shift)',
  });
  const ca2 = await lib.getCharacter(a);
  assert.ok(ca2);
  assert.equal(ca2.valuesById['CHAR-ID-006'], 'Detective\n(night shift)');

  await lib.batchUpdateCharacterField({
    characterIds: [b],
    fieldId: 'CHAR-ID-006',
    operation: 'clear',
  });
  const cb2 = await lib.getCharacter(b);
  assert.ok(cb2);
  assert.equal(cb2.valuesById['CHAR-ID-006'] ?? '', '');

  // Protected field: Character_ID should never be overwritten.
  const idRes = await lib.batchUpdateCharacterField({
    characterIds: [a, b],
    fieldId: 'CHAR-ID-001',
    operation: 'set',
    valueText: 'HACKED',
  });
  assert.equal(idRes.ok, true);
  assert.equal(idRes.updated, 0);
  assert.equal((idRes.skipped || []).length, 2);

  const ca3 = await lib.getCharacter(a);
  assert.ok(ca3);
  assert.notEqual(ca3.valuesById['CHAR-ID-001'], 'HACKED');

  lib.close();
});

test('batchUpdateCharacterTags adds/removes manual tags across characters', async (t) => {
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

  const addRes = await lib.batchUpdateCharacterTags({ characterIds: [a, b], addTags: ['foo', 'bar'] });
  assert.equal(addRes.ok, true);
  assert.equal(addRes.updated, 2);

  const ca = await lib.getCharacter(a);
  const cb = await lib.getCharacter(b);
  assert.ok(ca);
  assert.ok(cb);

  const tagTextsA = new Map((ca.tags || []).map((t) => [t.text, t.type]));
  const tagTextsB = new Map((cb.tags || []).map((t) => [t.text, t.type]));
  assert.equal(tagTextsA.get('foo'), 'manual');
  assert.equal(tagTextsA.get('bar'), 'manual');
  assert.equal(tagTextsB.get('foo'), 'manual');
  assert.equal(tagTextsB.get('bar'), 'manual');
  assert.equal(tagTextsA.get('template:v2.00'), 'derived');

  await lib.batchUpdateCharacterTags({ characterIds: [a], removeTags: ['foo'] });

  const ca2 = await lib.getCharacter(a);
  const cb2 = await lib.getCharacter(b);
  assert.ok(ca2);
  assert.ok(cb2);
  const tagTextsA2 = new Map((ca2.tags || []).map((t) => [t.text, t.type]));
  const tagTextsB2 = new Map((cb2.tags || []).map((t) => [t.text, t.type]));
  assert.ok(!tagTextsA2.has('foo'));
  assert.equal(tagTextsA2.get('bar'), 'manual');
  assert.equal(tagTextsB2.get('foo'), 'manual');
  assert.equal(tagTextsB2.get('bar'), 'manual');

  lib.close();
});

test('softDeleteCharacters hides from active list and supports restore/purge', async (t) => {
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
  const c = await lib.createCharacter({ displayName: 'C' });

  await lib.softDeleteCharacters({ characterIds: [a, b] });

  const active = await lib.listCharacters({ queryText: '', tagFilters: [] });
  assert.equal(active.length, 1);
  assert.equal(active[0].id, c);

  const trash = await lib.listCharacters({ queryText: '', tagFilters: [], deletedMode: 'deleted' });
  const trashIds = new Set(trash.map((x) => x.id));
  assert.ok(trashIds.has(a));
  assert.ok(trashIds.has(b));
  for (const row of trash) assert.ok(row.deletedAt);

  await lib.restoreCharacters({ characterIds: [a] });

  const active2 = await lib.listCharacters({ queryText: '', tagFilters: [] });
  const activeIds2 = new Set(active2.map((x) => x.id));
  assert.ok(activeIds2.has(a));
  assert.ok(activeIds2.has(c));
  assert.ok(!activeIds2.has(b));

  const baseB = lib.getCharacterPaths(b).base;
  assert.ok(fs.existsSync(baseB));

  const purgeRes = await lib.purgeCharacters({ characterIds: [b] });
  assert.equal(purgeRes.ok, true);
  assert.equal(purgeRes.purged, 1);
  assert.ok(!fs.existsSync(baseB));
  assert.equal(await lib.getCharacter(b), null);

  lib.close();
});
