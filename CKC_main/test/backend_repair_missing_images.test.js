const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('repairMissingImagesByHash dry-run and repair restores missing originals', async (t) => {
  const libraryRoot = makeTempDir();
  const scanDir = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    try {
      fs.rmSync(scanDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'Repair Test' });

  const srcPath = path.join(scanDir, 'a.jpg');
  fs.writeFileSync(srcPath, Buffer.from('same bytes => same hash', 'utf8'));

  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);

  const rel = String(imported.imported[0].relativePath || '');
  const destAbs = path.join(libraryRoot, 'characters', characterId, ...rel.split('/'));
  assert.equal(fs.existsSync(destAbs), true);

  fs.rmSync(destAbs, { force: true });
  assert.equal(fs.existsSync(destAbs), false);

  const dry = await lib.repairMissingImagesByHash({ scanDir, includeSubdirs: false, dryRun: true });
  assert.equal(dry.ok, true);
  assert.equal(dry.plannedActions, 1);
  assert.equal(dry.copied, 0);
  assert.equal(fs.existsSync(destAbs), false);

  const run = await lib.repairMissingImagesByHash({ scanDir, includeSubdirs: false, dryRun: false });
  assert.equal(run.ok, true);
  assert.equal(run.plannedActions, 1);
  assert.equal(run.copied, 1);
  assert.equal(fs.existsSync(destAbs), true);

  assert.ok(run.reportPath);
  assert.equal(fs.existsSync(run.reportPath), true);
  const report = JSON.parse(fs.readFileSync(run.reportPath, 'utf8'));
  assert.equal(report.kind, 'repairMissingImagesByHash');
  assert.equal(report.dryRun, false);
});

