const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { createLibraryBackup, validateLibraryBackup, restoreLibraryBackup } = require('../app/backend/backup');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('library backup/restore snapshot writes manifest + SHA256SUMS (excludes exports/backups)', async (t) => {
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

  // Put something into exports/backups that must NOT be included in the snapshot.
  const excludedDir = path.join(libraryRoot, 'exports', 'backups');
  fs.mkdirSync(excludedDir, { recursive: true });
  fs.writeFileSync(path.join(excludedDir, 'SHOULD_NOT_BE_INCLUDED.txt'), 'nope', 'utf8');

  const backupRes = await createLibraryBackup({ libraryRoot, db: lib.db, outDirBase: null, backupName: 'unit test backup' });
  assert.equal(backupRes.ok, true);
  assert.ok(fs.existsSync(backupRes.snapshotDir));
  assert.equal(/[ \t]/.test(path.basename(backupRes.snapshotDir)), false);
  assert.ok(fs.existsSync(backupRes.manifestPath));
  assert.ok(fs.existsSync(backupRes.checksumsPath));
  assert.equal(fs.existsSync(path.join(backupRes.snapshotDir, 'exports', 'backups', 'SHOULD_NOT_BE_INCLUDED.txt')), false);

  const validation = await validateLibraryBackup({ backupDir: backupRes.snapshotDir });
  assert.equal(validation.ok, true);

  const restoredRoot = makeTempDir();
  t.after(() => {
    try {
      fs.rmSync(restoredRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  const restoreRes = await restoreLibraryBackup({
    backupDir: backupRes.snapshotDir,
    destLibraryRoot: restoredRoot,
    currentLibraryRoot: libraryRoot,
    allowOverwrite: false,
  });
  assert.equal(restoreRes.ok, true);
  assert.ok(fs.existsSync(path.join(restoredRoot, 'db', 'codex.db')));

  const lib2 = new CKCLibrary({ libraryRoot: restoredRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib2.initialize();
  lib2.close();
});
