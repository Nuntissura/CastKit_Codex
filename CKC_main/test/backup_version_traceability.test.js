delete process.env.CKC_DB_PROVIDER;
delete process.env.CKC_DATABASE_PROVIDER;
delete process.env.CKC_POSTGRES_URL;
delete process.env.CKC_POSTGRES_CONNECTION_STRING;
delete process.env.DATABASE_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { createLibraryBackup, restoreLibraryBackup, validateLibraryBackup } = require('../app/backend/backup');

const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  return dir;
}

test('library backups carry version traceability and reject newer-app restores', async (t) => {
  const libraryRoot = makeTempDir(t, 'ckc-backup-trace-src-');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();
  t.after(() => lib.close());

  await lib.createCharacter({ displayName: 'Backup Traceability' });

  const backup = await createLibraryBackup({ libraryRoot, db: lib.db, outDirBase: null, backupName: 'wp-0106-backup' });
  assert.equal(backup.ok, true);

  const manifest = JSON.parse(fs.readFileSync(backup.manifestPath, 'utf8'));
  assert.equal(manifest.kind, 'ckc_library_backup');
  assert.match(manifest.ckc_app_version, /^\d+\.\d+\.\d+/);
  assert.ok(Object.prototype.hasOwnProperty.call(manifest, 'schema_migration_cursor'));
  assert.equal(manifest.schema_migration_cursor.migration_key, 'ckc_schema');
  assert.equal(manifest.created_at, manifest.createdAt);
  assert.equal(manifest.db_provider, 'sqlite');
  assert.equal(manifest.character_count, 1);
  assert.equal(manifest.image_count, 0);

  const validation = await validateLibraryBackup({ backupDir: backup.snapshotDir });
  assert.equal(validation.ok, true);

  const restoredRoot = makeTempDir(t, 'ckc-backup-trace-restore-');
  const restored = await restoreLibraryBackup({
    backupDir: backup.snapshotDir,
    destLibraryRoot: restoredRoot,
    currentLibraryRoot: libraryRoot,
    allowOverwrite: false,
  });
  assert.equal(restored.ok, true);

  manifest.ckc_app_version = '999.0.0';
  fs.writeFileSync(backup.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  await assert.rejects(
    () => validateLibraryBackup({ backupDir: backup.snapshotDir }),
    /Backup was created by newer CKC 999\.0\.0/
  );
  await assert.rejects(
    () => restoreLibraryBackup({
      backupDir: backup.snapshotDir,
      destLibraryRoot: makeTempDir(t, 'ckc-backup-trace-newer-'),
      currentLibraryRoot: libraryRoot,
      allowOverwrite: false,
    }),
    /Backup was created by newer CKC 999\.0\.0/
  );
});
