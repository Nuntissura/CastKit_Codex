const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { get } = require('./db');

function readAppVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function compareSemver(a, b) {
  const pa = String(a || '0.0.0').split(/[.+-]/)[0].split('.').map((x) => Number(x) || 0);
  const pb = String(b || '0.0.0').split(/[.+-]/)[0].split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function safeCount(db, tableName) {
  try {
    const row = await get(db, `SELECT COUNT(*) AS c FROM ${tableName}`);
    return Number(row?.c || 0);
  } catch {
    return null;
  }
}

async function getSchemaMigrationCursor(db) {
  try {
    const row = await get(
      db,
      `SELECT migration_key, migration_value, updated_at
       FROM CkcDbMigration
       ORDER BY updated_at DESC, migration_key DESC
       LIMIT 1`
    );
    if (!row) return null;
    return {
      migration_key: row.migration_key == null ? null : String(row.migration_key),
      migration_value: row.migration_value == null ? '' : String(row.migration_value),
      updated_at: row.updated_at == null ? null : String(row.updated_at),
    };
  } catch {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toIsoSafeTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function sanitizeFolderName(name, fallback) {
  const raw = String(name ?? '').trim();
  const base = raw.length ? raw : String(fallback ?? 'backup');
  const cleaned = base
    .replaceAll(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^[._-]+|[._-]+$/g, '');
  const safe = cleaned.length ? cleaned.slice(0, 180) : String(fallback ?? 'backup');
  if (safe === '.' || safe === '..') return String(fallback ?? 'backup');
  return safe;
}

function getWindowsDriveLetter(p) {
  const raw = String(p ?? '').trim();
  if (!raw) return null;
  const m1 = raw.match(/^\\\\\?\\([A-Za-z]):[\\/]/);
  if (m1) return String(m1[1]).toUpperCase();
  const m2 = raw.match(/^([A-Za-z]):[\\/]/);
  if (m2) return String(m2[1]).toUpperCase();
  const m3 = raw.match(/^([A-Za-z]):$/);
  if (m3) return String(m3[1]).toUpperCase();
  return null;
}

function assertNotForbiddenDrive(p, contextLabel = 'Path') {
  const letter = getWindowsDriveLetter(p);
  if (!letter) return;
  if (letter === 'D') throw new Error(`${contextLabel} must not be on D:`);
}

function isDirectoryEmpty(dir) {
  if (!fs.existsSync(dir)) return true;
  const entries = fs.readdirSync(dir);
  return entries.length === 0;
}

function uniqueDirPath(parentDir, name) {
  const parent = String(parentDir ?? '').trim();
  const baseName = String(name ?? '').trim();
  if (!parent || !baseName) throw new Error('uniqueDirPath requires parentDir and name');

  let candidate = path.join(parent, baseName);
  if (!fs.existsSync(candidate) || isDirectoryEmpty(candidate)) return candidate;

  for (let i = 2; i < 10_000; i++) {
    candidate = path.join(parent, `${baseName}__${i}`);
    if (!fs.existsSync(candidate) || isDirectoryEmpty(candidate)) return candidate;
  }

  throw new Error('Failed to allocate a unique backup folder name');
}

function isSafeToRmRecursive(dir) {
  const resolved = path.resolve(String(dir ?? ''));
  if (!resolved) return false;
  const parsed = path.parse(resolved);
  if (!parsed.root) return false;
  if (resolved === parsed.root) return false; // never allow deleting a drive root
  return true;
}

function relPosixFromAbs(absPath, rootAbs) {
  const rel = path.relative(rootAbs, absPath);
  return rel.split(path.sep).join('/');
}

function absFromRelPosix(rootAbs, relPosix) {
  const rel = String(relPosix ?? '').split('/').filter(Boolean);
  return path.join(rootAbs, ...rel);
}

async function sha256FileHex(absPath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(absPath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function copyFileWithHash(srcAbs, destAbs) {
  ensureDir(path.dirname(destAbs));
  const hash = crypto.createHash('sha256');
  let sizeBytes = 0;
  await pipeline(
    fs.createReadStream(srcAbs),
    new Transform({
      transform(chunk, _enc, cb) {
        try {
          hash.update(chunk);
          sizeBytes += chunk.length;
          cb(null, chunk);
        } catch (err) {
          cb(err);
        }
      },
    }),
    fs.createWriteStream(destAbs)
  );
  return { sha256: hash.digest('hex'), sizeBytes };
}

async function walkFilesAbs(dirAbs, { excludeRelPrefixes = [] } = {}) {
  const root = path.resolve(String(dirAbs ?? ''));
  const prefixes = Array.isArray(excludeRelPrefixes) ? excludeRelPrefixes.map((p) => String(p ?? '').replaceAll('\\', '/')) : [];
  const out = [];

  async function rec(curAbs) {
    const ents = await fs.promises.readdir(curAbs, { withFileTypes: true });
    for (const ent of ents) {
      const nextAbs = path.join(curAbs, ent.name);
      const relPosix = relPosixFromAbs(nextAbs, root);
      const relPosixNorm = relPosix.replaceAll('\\', '/');
      if (prefixes.some((p) => p && (relPosixNorm === p || relPosixNorm.startsWith(`${p}/`)))) continue;

      if (ent.isDirectory()) {
        await rec(nextAbs);
      } else if (ent.isFile()) {
        out.push(nextAbs);
      }
    }
  }

  if (fs.existsSync(root)) await rec(root);
  return out;
}

function parseSha256Sums(text) {
  const lines = String(text ?? '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0 && !l.trimStart().startsWith('#'));

  const out = [];
  for (const line of lines) {
    const m = line.match(/^([0-9a-fA-F]{64})\s\s(.+)$/);
    if (!m) continue;
    out.push({ sha256: m[1].toLowerCase(), relPath: String(m[2]).trim() });
  }
  return out;
}

async function sqliteVacuumInto({ db, outPath, onProgress = null, isCancelled = null } = {}) {
  const abs = path.resolve(String(outPath ?? ''));
  ensureDir(path.dirname(abs));

  if (!db || typeof db.exec !== 'function') throw new Error('SQLite DB not ready');
  if (typeof isCancelled === 'function' && isCancelled()) throw new Error('Cancelled');

  const execSql = (sql) =>
    new Promise((resolve, reject) => {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

  const escaped = abs.replaceAll("'", "''");
  if (typeof onProgress === 'function') onProgress({ phase: 'db_snapshot', done: 0, total: 1 });

  // Best-effort checkpoint so the snapshot includes recent WAL content.
  try {
    await execSql('PRAGMA wal_checkpoint(FULL);');
  } catch {
    // ignore
  }

  try {
    await execSql(`VACUUM INTO '${escaped}'`);
    if (typeof onProgress === 'function') onProgress({ phase: 'db_snapshot', done: 1, total: 1 });
    return { ok: true, method: 'vacuum_into' };
  } catch (err) {
    // Fall back to copy; caller will handle.
    return { ok: false, method: 'vacuum_into', error: err instanceof Error ? err.message : String(err) };
  }
}

async function createLibraryBackup({
  libraryRoot,
  db,
  outDirBase = null,
  backupName = null,
  onProgress = null,
  isCancelled = null,
} = {}) {
  const srcRoot = path.resolve(String(libraryRoot ?? ''));
  if (!srcRoot) throw new Error('libraryRoot is required');

  const defaultOutBase = path.join(srcRoot, 'exports', 'backups');
  const outBase = path.resolve(String(outDirBase ?? '').trim() || defaultOutBase);

  assertNotForbiddenDrive(outBase, 'Backup destination');
  assertNotForbiddenDrive(srcRoot, 'LibraryRoot');

  ensureDir(outBase);

  const safeName = sanitizeFolderName(String(backupName ?? '').trim(), `ckc_backup__${toIsoSafeTimestamp()}`);
  const snapshotDir = uniqueDirPath(outBase, safeName);
  ensureDir(snapshotDir);

  const excludePrefixes = ['exports/backups', 'db/codex.db', 'db/codex.db-wal', 'db/codex.db-shm'];
  const fileAbsList = await walkFilesAbs(srcRoot, { excludeRelPrefixes: excludePrefixes });

  if (typeof onProgress === 'function') onProgress({ phase: 'copying', done: 0, total: fileAbsList.length + 1 });

  const files = [];
  const createdAt = new Date().toISOString();

  // --- DB snapshot first ---
  const dbOutAbs = path.join(snapshotDir, 'db', 'codex.db');
  let dbSnapshotMethod = 'copy';
  const vacuumRes = await sqliteVacuumInto({ db, outPath: dbOutAbs, onProgress, isCancelled });
  if (vacuumRes.ok) dbSnapshotMethod = vacuumRes.method;
  else {
    // fallback: copy the live file(s)
    const srcDbAbs = path.join(srcRoot, 'db', 'codex.db');
    if (!fs.existsSync(srcDbAbs)) throw new Error('Source DB file missing');
    ensureDir(path.dirname(dbOutAbs));
    await fs.promises.copyFile(srcDbAbs, dbOutAbs);
    const wal = `${srcDbAbs}-wal`;
    const shm = `${srcDbAbs}-shm`;
    if (fs.existsSync(wal)) await fs.promises.copyFile(wal, `${dbOutAbs}-wal`);
    if (fs.existsSync(shm)) await fs.promises.copyFile(shm, `${dbOutAbs}-shm`);
  }

  const dbHash = await sha256FileHex(dbOutAbs);
  const dbSize = fs.statSync(dbOutAbs).size;
  files.push({ path: 'db/codex.db', sizeBytes: dbSize, sha256: dbHash });
  for (const suffix of ['-wal', '-shm']) {
    const extraAbs = `${dbOutAbs}${suffix}`;
    if (!fs.existsSync(extraAbs)) continue;
    const extraHash = await sha256FileHex(extraAbs);
    const extraSize = fs.statSync(extraAbs).size;
    files.push({ path: `db/codex.db${suffix}`, sizeBytes: extraSize, sha256: extraHash });
  }

  let done = 1;
  for (const srcAbs of fileAbsList) {
    if (typeof isCancelled === 'function' && isCancelled()) throw new Error('Cancelled');
    const relPosix = relPosixFromAbs(srcAbs, srcRoot);
    const destAbs = absFromRelPosix(snapshotDir, relPosix);
    const { sha256, sizeBytes } = await copyFileWithHash(srcAbs, destAbs);
    files.push({ path: relPosix, sizeBytes, sha256 });

    done += 1;
    if (typeof onProgress === 'function' && (done % 25 === 0 || done === fileAbsList.length + 1)) {
      onProgress({ phase: 'copying', done, total: fileAbsList.length + 1 });
    }
  }

  files.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  const shaLines = files.map((f) => `${f.sha256}  ${f.path}`);
  const schemaMigrationCursor = await getSchemaMigrationCursor(db);
  const appVersion = readAppVersion();

  const manifest = {
    kind: 'ckc_library_backup',
    version: 1,
    ckc_app_version: appVersion,
    schema_migration_cursor: schemaMigrationCursor,
    created_at: createdAt,
    db_provider: db?.provider || db?.dialect || 'sqlite',
    image_count: await safeCount(db, 'ImageAsset'),
    character_count: await safeCount(db, 'Character'),
    createdAt,
    source: {
      libraryRoot: srcRoot,
      dbSnapshotMethod,
    },
    excluded: ['exports/backups/**'],
    files,
  };

  const manifestPath = path.join(snapshotDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const checksumsPath = path.join(snapshotDir, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumsPath, `${shaLines.join('\n')}\n`, 'utf8');

  return {
    ok: true,
    snapshotDir,
    manifestPath,
    checksumsPath,
    fileCount: files.length,
  };
}

async function validateLibraryBackup({ backupDir, onProgress = null, isCancelled = null } = {}) {
  const root = path.resolve(String(backupDir ?? ''));
  if (!root) throw new Error('backupDir is required');

  assertNotForbiddenDrive(root, 'Backup folder');

  const manifestPath = path.join(root, 'manifest.json');
  const checksumsPath = path.join(root, 'SHA256SUMS.txt');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json missing in backup folder');
  if (!fs.existsSync(checksumsPath)) throw new Error('SHA256SUMS.txt missing in backup folder');

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('manifest.json is invalid JSON');
  }
  const kind = String(manifest?.kind ?? '').trim();
  const version = Number(manifest?.version);
  if (kind !== 'ckc_library_backup' || version !== 1) throw new Error('Not a CKC library backup (unsupported manifest)');
  const backupVersion = String(manifest?.ckc_app_version || '').trim();
  const currentVersion = readAppVersion();
  if (backupVersion && compareSemver(backupVersion, currentVersion) > 0) {
    throw new Error(`Backup was created by newer CKC ${backupVersion}; installed CKC is ${currentVersion}`);
  }

  const entries = parseSha256Sums(fs.readFileSync(checksumsPath, 'utf8'));
  if (entries.length === 0) throw new Error('SHA256SUMS.txt has no entries');

  if (typeof onProgress === 'function') onProgress({ phase: 'verifying', done: 0, total: entries.length });

  let done = 0;
  for (const ent of entries) {
    if (typeof isCancelled === 'function' && isCancelled()) throw new Error('Cancelled');
    const abs = absFromRelPosix(root, ent.relPath);
    if (!fs.existsSync(abs)) throw new Error(`Missing file in backup: ${ent.relPath}`);
    const hash = await sha256FileHex(abs);
    if (hash.toLowerCase() !== ent.sha256) throw new Error(`Checksum mismatch: ${ent.relPath}`);

    done += 1;
    if (typeof onProgress === 'function' && (done % 25 === 0 || done === entries.length)) {
      onProgress({ phase: 'verifying', done, total: entries.length });
    }
  }

  return { ok: true, manifest, checksumsPath, fileCount: entries.length };
}

async function restoreLibraryBackup({
  backupDir,
  destLibraryRoot,
  currentLibraryRoot = null,
  allowOverwrite = false,
  confirmToken = null,
  onProgress = null,
  isCancelled = null,
} = {}) {
  const backupRoot = path.resolve(String(backupDir ?? ''));
  const destRoot = path.resolve(String(destLibraryRoot ?? ''));
  if (!backupRoot) throw new Error('backupDir is required');
  if (!destRoot) throw new Error('destLibraryRoot is required');

  assertNotForbiddenDrive(backupRoot, 'Backup folder');
  assertNotForbiddenDrive(destRoot, 'Restore destination');

  const relDestFromBackup = path.relative(backupRoot, destRoot);
  if (!relDestFromBackup || (!relDestFromBackup.startsWith('..') && !path.isAbsolute(relDestFromBackup))) {
    throw new Error('Restore destination must not be inside the backup folder.');
  }

  const relBackupFromDest = path.relative(destRoot, backupRoot);
  if (!relBackupFromDest || (!relBackupFromDest.startsWith('..') && !path.isAbsolute(relBackupFromDest))) {
    throw new Error('Backup folder must not be inside the restore destination.');
  }

  const current = currentLibraryRoot ? path.resolve(String(currentLibraryRoot)) : null;
  if (current && destRoot === current) throw new Error('Refusing to restore into the active libraryRoot. Choose a new folder.');

  const validation = await validateLibraryBackup({ backupDir: backupRoot, onProgress, isCancelled });

  if (!allowOverwrite && !isDirectoryEmpty(destRoot)) {
    throw new Error('Restore destination is not empty. Enable overwrite to proceed.');
  }

  if (allowOverwrite) {
    const token = String(confirmToken ?? '').trim().toUpperCase();
    if (token !== 'RESTORE') throw new Error('Overwrite confirmation missing. Type RESTORE to proceed.');
    if (!isSafeToRmRecursive(destRoot)) throw new Error('Refusing to overwrite an unsafe destination folder.');
    await fs.promises.rm(destRoot, { recursive: true, force: true });
  }

  ensureDir(destRoot);

  const entries = parseSha256Sums(fs.readFileSync(path.join(backupRoot, 'SHA256SUMS.txt'), 'utf8'));
  if (typeof onProgress === 'function') onProgress({ phase: 'restoring', done: 0, total: entries.length });

  let done = 0;
  for (const ent of entries) {
    if (typeof isCancelled === 'function' && isCancelled()) throw new Error('Cancelled');
    const srcAbs = absFromRelPosix(backupRoot, ent.relPath);
    const destAbs = absFromRelPosix(destRoot, ent.relPath);
    ensureDir(path.dirname(destAbs));
    await fs.promises.copyFile(srcAbs, destAbs);

    done += 1;
    if (typeof onProgress === 'function' && (done % 25 === 0 || done === entries.length)) {
      onProgress({ phase: 'restoring', done, total: entries.length });
    }
  }

  return { ok: true, destLibraryRoot: destRoot, manifest: validation.manifest, fileCount: entries.length };
}

module.exports = {
  createLibraryBackup,
  validateLibraryBackup,
  restoreLibraryBackup,
};
