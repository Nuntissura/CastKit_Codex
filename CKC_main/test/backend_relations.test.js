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

test('character relations persist and can be updated', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const aId = await lib.createCharacter({ displayName: 'A' });
  const bId = await lib.createCharacter({ displayName: 'B' });

  const created = await lib.createCharacterRelation({
    sourceCharacterId: aId,
    targetCharacterId: bId,
    relType: 'friend',
    notes: 'met at the docks',
  });
  assert.equal(created.ok, true);
  assert.ok(created.id);

  const list1 = await lib.listCharacterRelations({ characterId: aId });
  assert.equal(list1.length, 1);
  assert.equal(list1[0].id, created.id);
  assert.equal(list1[0].sourceCharacterId, aId);
  assert.equal(list1[0].targetCharacterId, bId);
  assert.equal(list1[0].sourceCharacterName, 'A');
  assert.equal(list1[0].targetCharacterName, 'B');
  assert.equal(list1[0].relType, 'friend');

  await lib.updateCharacterRelation({ relationId: created.id, relType: 'ally', notes: 'joined the crew' });
  const list2 = await lib.listCharacterRelations({ characterId: aId });
  assert.equal(list2.length, 1);
  assert.equal(list2[0].relType, 'ally');
  assert.equal(list2[0].notes, 'joined the crew');

  const all1 = await lib.listCharacterRelations({ characterId: null });
  assert.ok(all1.some((r) => r.id === created.id));

  lib.close();

  const lib2 = makeInstance();
  await lib2.initialize();
  const list3 = await lib2.listCharacterRelations({ characterId: aId });
  assert.equal(list3.length, 1);
  assert.equal(list3[0].relType, 'ally');
  assert.equal(list3[0].notes, 'joined the crew');

  await lib2.deleteCharacterRelation({ relationId: created.id });
  const list4 = await lib2.listCharacterRelations({ characterId: aId });
  assert.equal(list4.length, 0);
  lib2.close();
});

