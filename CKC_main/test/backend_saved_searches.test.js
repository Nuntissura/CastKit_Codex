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

test('saved searches CRUD persists across reopen', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const scopeFlags = { ids: true, labels: false, values: false, tags: true, name: true };
  const tagFilters = ['alpha', 'beta'];
  const galleryFilters = { favoriteOnly: true, ratingOp: '>=', ratingValue: 4 };

  const searchId = await lib.createSavedSearch({
    name: 'Test Search',
    queryText: 'hello world',
    scopeFlags,
    tagFilters,
    galleryFilters,
  });

  const list1 = await lib.listSavedSearches();
  const created = list1.find((s) => s.id === searchId);
  assert.ok(created);
  assert.equal(created.name, 'Test Search');
  assert.equal(created.queryText, 'hello world');
  assert.deepEqual(created.scopeFlags, scopeFlags);
  assert.deepEqual(created.tagFilters, tagFilters);
  assert.deepEqual(created.galleryFilters, galleryFilters);

  await lib.updateSavedSearch({
    searchId,
    name: 'Test Search Renamed',
    queryText: 'updated',
    scopeFlags: { ids: false, labels: false, values: true, tags: false, name: false },
    tagFilters: ['gamma'],
    galleryFilters: { favoriteOnly: false },
  });

  const list2 = await lib.listSavedSearches();
  const updated = list2.find((s) => s.id === searchId);
  assert.ok(updated);
  assert.equal(updated.name, 'Test Search Renamed');
  assert.equal(updated.queryText, 'updated');
  assert.deepEqual(updated.scopeFlags, { ids: false, labels: false, values: true, tags: false, name: false });
  assert.deepEqual(updated.tagFilters, ['gamma']);
  assert.deepEqual(updated.galleryFilters, { favoriteOnly: false });

  lib.close();

  const lib2 = makeInstance();
  await lib2.initialize();

  const reopened = await lib2.listSavedSearches();
  const reopenedSearch = reopened.find((s) => s.id === searchId);
  assert.ok(reopenedSearch);
  assert.equal(reopenedSearch.name, 'Test Search Renamed');
  assert.equal(reopenedSearch.queryText, 'updated');
  assert.deepEqual(reopenedSearch.tagFilters, ['gamma']);

  await lib2.deleteSavedSearch(searchId);
  const afterDelete = await lib2.listSavedSearches();
  assert.ok(!afterDelete.some((s) => s.id === searchId));

  lib2.close();
});

test('manual tags are filterable via tagFilters', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  await lib.addManualTag(a, 'alpha');
  await lib.addManualTag(a, 'gamma');
  await lib.addManualTag(b, 'beta');

  const byAlpha = await lib.listCharacters({ tagFilters: ['alpha'] });
  assert.ok(byAlpha.some((c) => c.id === a));
  assert.ok(!byAlpha.some((c) => c.id === b));

  const byAlphaGamma = await lib.listCharacters({ tagFilters: ['alpha', 'gamma'] });
  assert.ok(byAlphaGamma.some((c) => c.id === a));
  assert.ok(!byAlphaGamma.some((c) => c.id === b));

  const byUnknown = await lib.listCharacters({ tagFilters: ['doesnotexist'] });
  assert.equal(byUnknown.length, 0);

  lib.close();

  const lib2 = makeInstance();
  await lib2.initialize();
  const reopened = await lib2.listCharacters({ tagFilters: ['alpha', 'gamma'] });
  assert.ok(reopened.some((c) => c.id === a));
  lib2.close();
});

test('scope flags control name search deterministically', async (t) => {
  const { makeInstance } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'ScopeNameQWERTY123' });

  const defaultScope = await lib.listCharacters({ queryText: 'ScopeNameQWERTY123' });
  assert.ok(defaultScope.some((c) => c.id === characterId));

  const noName = await lib.listCharacters({
    queryText: 'ScopeNameQWERTY123',
    scopeFlags: { ids: true, labels: false, values: false, tags: false, name: false },
  });
  assert.ok(!noName.some((c) => c.id === characterId));

  const nameOnly = await lib.listCharacters({
    queryText: 'ScopeNameQWERTY123',
    scopeFlags: { ids: false, labels: false, values: false, tags: false, name: true },
  });
  assert.ok(nameOnly.some((c) => c.id === characterId));

  lib.close();
});

