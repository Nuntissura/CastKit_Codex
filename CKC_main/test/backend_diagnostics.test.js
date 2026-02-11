const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('getMediaDiagnostics reports missing originals', async (t) => {
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

  const characterId = await lib.createCharacter({ displayName: 'Diag Test' });
  const srcPath = path.join(libraryRoot, 'src.png');
  fs.writeFileSync(srcPath, Buffer.from('not a real png but ok', 'utf8'));

  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);

  const first = imported.imported[0];
  const abs = path.join(libraryRoot, 'characters', characterId, ...String(first.relativePath).split('/'));
  assert.equal(fs.existsSync(abs), true);

  const diagA = await lib.getMediaDiagnostics({ topN: 10 });
  assert.equal(diagA.imageCount, 1);
  assert.equal(diagA.originals.present, 1);
  assert.equal(diagA.originals.missing, 0);

  fs.rmSync(abs, { force: true });

  const diagB = await lib.getMediaDiagnostics({ topN: 10 });
  assert.equal(diagB.originals.present, 0);
  assert.equal(diagB.originals.missing, 1);
  assert.ok(diagB.topMissingByCharacter.some((c) => c.characterId === characterId && c.missingOriginal === 1));
});

