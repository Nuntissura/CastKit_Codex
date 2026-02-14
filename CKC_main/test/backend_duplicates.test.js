const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { sha256Hex } = require('../app/backend/crypto');

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

test('duplicates view groups by exact hash and cleanup removes group', async (t) => {
  const { makeInstance, libraryRoot } = makeLib(t);
  const lib = makeInstance();
  await lib.initialize();

  const a = await lib.createCharacter({ displayName: 'A' });
  const b = await lib.createCharacter({ displayName: 'B' });

  const bytes = Buffer.from('this is a duplicate payload\n', 'utf8');
  const srcPath = path.join(libraryRoot, 'dup.png');
  fs.writeFileSync(srcPath, bytes);
  const fileHash = sha256Hex(bytes);

  const ia = await lib.importImages({ characterId: a, filePaths: [srcPath], duplicatePolicy: 'skip' });
  const ib = await lib.importImages({ characterId: b, filePaths: [srcPath], duplicatePolicy: 'skip' });

  assert.equal(ia.imported.length, 1);
  assert.equal(ib.imported.length, 1);

  const groups = await lib.listDuplicateGroups({ minCount: 2, limitGroups: 10, maxPerGroup: 10 });
  assert.ok(Array.isArray(groups));
  const g = groups.find((x) => x.fileHash === fileHash);
  assert.ok(g, 'expected duplicate group for imported hash');
  assert.equal(g.count, 2);
  assert.equal(g.images.length, 2);
  assert.ok(g.sizeBytes > 0);

  // Delete one image; group should disappear.
  await lib.deleteImages({ imageIds: [ia.imported[0].id], deleteFiles: true });
  const groupsAfter = await lib.listDuplicateGroups({ minCount: 2, limitGroups: 10, maxPerGroup: 10 });
  assert.ok(!groupsAfter.some((x) => x.fileHash === fileHash));

  lib.close();
});

