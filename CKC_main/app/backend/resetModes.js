const fs = require('fs');
const path = require('path');

const { randomId, sha256Hex } = require('./crypto');
const { all, get, run, isPostgresDb, POSTGRES_TABLE_ORDER } = require('./db');

const FULL_RESET_MARKER = '.ckc-pending-full-reset';
const ORPHAN_MANIFEST_VERSION = 1;
const PRESERVED_IMAGE_RELATIVE_DIRS = ['images/original', 'images/thumb'];
const ELECTRON_PREFERENCE_PATHS = ['Preferences', 'Local Storage', 'Session Storage', 'IndexedDB'];

const PRESERVED_TABLES = new Set(['CkcMeta', 'CkcDbMigration']);
const CONTENT_TABLES = POSTGRES_TABLE_ORDER.filter((table) => !PRESERVED_TABLES.has(table));

const IMAGE_MANIFEST_COLUMNS = [
  'ia.image_id',
  'ia.character_id',
  'c.display_name',
  'ia.relative_path',
  'ia.file_hash',
  'ia.width',
  'ia.height',
  'ia.favorite',
  'ia.rating',
  'ia.notes',
  'ia.tags_json',
  'ia.storage_mode',
  'ia.source_path',
  'ia.source_url',
  'ia.source_note',
  'ia.source_dataset_id',
  'ia.source_task_id',
  'ia.source_run_id',
  'ia.source_contact_sheet_ref',
  'ia.sheet_version_id',
  'ia.review_status',
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function toIsoSafeTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function normalizeRel(rel) {
  return String(rel || '').replaceAll('\\', '/').replace(/^\/+/, '');
}

function pathInsideDir(dirAbs, candidateAbs) {
  const dir = path.resolve(String(dirAbs || ''));
  const candidate = path.resolve(String(candidateAbs || ''));
  if (!dir || !candidate) return false;
  if (process.platform === 'win32') {
    const d = dir.toLowerCase();
    const c = candidate.toLowerCase();
    return c === d || c.startsWith(d + path.sep);
  }
  return candidate === dir || candidate.startsWith(dir + path.sep);
}

function assertInsideDir(dirAbs, candidateAbs, label = 'Path') {
  if (!pathInsideDir(dirAbs, candidateAbs)) {
    throw new Error(`${label} escapes expected root: ${candidateAbs}`);
  }
}

function resolveInside(rootAbs, relPath, label = 'Path') {
  const root = path.resolve(String(rootAbs || ''));
  const rel = normalizeRel(relPath).replaceAll('/', path.sep);
  const abs = path.resolve(root, rel);
  assertInsideDir(root, abs, label);
  return abs;
}

function removePathIfInside(rootAbs, targetAbs) {
  const root = path.resolve(String(rootAbs || ''));
  const target = path.resolve(String(targetAbs || ''));
  if (!fs.existsSync(target)) return false;
  assertInsideDir(root, target, 'Reset delete target');
  if (target === root) throw new Error('Refusing to delete library root itself');
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

function writeJsonAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function getPendingFullResetMarkerPath(configDir) {
  return path.join(String(configDir || ''), FULL_RESET_MARKER);
}

function readPendingFullResetMarker(markerPath) {
  const p = String(markerPath || '').trim();
  if (!p || !fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingFullResetMarker({ markerPath, libraryRoot, database = null, requestedAt = new Date() } = {}) {
  const target = String(markerPath || '').trim();
  if (!target) throw new Error('markerPath is required');
  const root = String(libraryRoot || '').trim();
  if (!root) throw new Error('libraryRoot is required');
  const payload = {
    kind: 'ckc_pending_full_reset',
    version: 1,
    requested_at: new Date(requestedAt).toISOString(),
    library_root: root,
    database: database && typeof database === 'object' ? database : null,
  };
  writeJsonAtomic(target, payload);
  return { ok: true, markerPath: target, libraryRoot: root };
}

function clearPreferenceFiles({ userDataDir, configPath } = {}) {
  const deleted = [];
  const failed = [];
  const root = path.resolve(String(userDataDir || ''));
  if (!root) throw new Error('userDataDir is required');
  ensureDir(root);

  const cfg = String(configPath || '').trim();
  if (cfg && fs.existsSync(cfg)) {
    const cfgAbs = path.resolve(cfg);
    try {
      fs.rmSync(cfgAbs, { force: true });
      deleted.push(cfgAbs);
    } catch (err) {
      failed.push({ path: cfgAbs, error: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const rel of ELECTRON_PREFERENCE_PATHS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    try {
      removePathIfInside(root, abs);
      deleted.push(abs);
    } catch (err) {
      failed.push({ path: abs, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ok: true, deleted, failed };
}

async function collectOrphanImageRows(db) {
  const rows = await all(
    db,
    `SELECT ${IMAGE_MANIFEST_COLUMNS.join(', ')}
     FROM ImageAsset ia
     LEFT JOIN Character c ON c.character_id = ia.character_id
     ORDER BY ia.added_at ASC, ia.image_id ASC`
  );

  return rows.map((r) => {
    let tags = [];
    try {
      const parsed = JSON.parse(String(r.tags_json || '[]'));
      tags = Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
    } catch {
      tags = [];
    }
    return {
      image_id: String(r.image_id || ''),
      character_id: String(r.character_id || ''),
      display_name: String(r.display_name || ''),
      relative_path: normalizeRel(r.relative_path),
      file_hash: String(r.file_hash || ''),
      width: r.width == null ? null : Number(r.width),
      height: r.height == null ? null : Number(r.height),
      tags,
      rating: Number(r.rating || 0),
      favorite: Number(r.favorite || 0) ? 1 : 0,
      notes: r.notes == null ? '' : String(r.notes),
      storage_mode: String(r.storage_mode || 'copy'),
      source_path: r.source_path == null ? null : String(r.source_path),
      source_url: r.source_url == null ? null : String(r.source_url),
      source_note: r.source_note == null ? null : String(r.source_note),
      source_dataset_id: r.source_dataset_id == null ? null : String(r.source_dataset_id),
      source_task_id: r.source_task_id == null ? null : String(r.source_task_id),
      source_run_id: r.source_run_id == null ? null : String(r.source_run_id),
      source_contact_sheet_ref: r.source_contact_sheet_ref == null ? null : String(r.source_contact_sheet_ref),
      sheet_version_id: r.sheet_version_id == null ? null : String(r.sheet_version_id),
      review_status: r.review_status == null ? 'accepted' : String(r.review_status),
    };
  });
}

function writeOrphanManifest({ libraryRoot, entries, now = new Date(), marker = null } = {}) {
  const root = path.resolve(String(libraryRoot || ''));
  if (!root) throw new Error('libraryRoot is required');
  const stamp = toIsoSafeTimestamp(now);
  const manifestDir = path.join(root, 'orphans', stamp);
  const manifestPath = path.join(manifestDir, 'manifest.json');
  const payload = {
    manifest_version: ORPHAN_MANIFEST_VERSION,
    kind: 'ckc_orphan_images',
    created_at: new Date(now).toISOString(),
    library_root: root,
    preserved_dirs: PRESERVED_IMAGE_RELATIVE_DIRS,
    source_marker: marker && typeof marker === 'object' ? marker : null,
    entries: Array.isArray(entries) ? entries : [],
  };
  writeJsonAtomic(manifestPath, payload);
  return { manifestPath, manifestDir, entryCount: payload.entries.length };
}

function cleanLibraryForFullReset(libraryRoot) {
  const root = path.resolve(String(libraryRoot || ''));
  if (!root) throw new Error('libraryRoot is required');
  const removed = [];

  for (const rel of ['exports', 'templates']) {
    const abs = path.join(root, rel);
    if (removePathIfInside(root, abs)) removed.push(normalizeRel(rel));
  }

  const charactersDir = path.join(root, 'characters');
  if (fs.existsSync(charactersDir)) {
    assertInsideDir(root, charactersDir, 'Characters dir');
    for (const dirent of fs.readdirSync(charactersDir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const charBase = path.join(charactersDir, dirent.name);
      assertInsideDir(root, charBase, 'Character dir');
      for (const rel of ['sheet', 'extras', 'packs', 'scripts']) {
        const abs = path.join(charBase, rel);
        if (removePathIfInside(root, abs)) removed.push(normalizeRel(path.join('characters', dirent.name, rel)));
      }
    }
  }

  return { ok: true, removed };
}

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function truncateContentTables(db) {
  if (isPostgresDb(db)) {
    const quoted = CONTENT_TABLES.map(quoteIdent).join(', ');
    await run(db, `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    return { ok: true, provider: 'postgres', tables: CONTENT_TABLES };
  }

  await run(db, 'BEGIN');
  try {
    for (const table of [...CONTENT_TABLES].reverse()) {
      await run(db, `DELETE FROM ${quoteIdent(table)}`);
    }
    await run(db, 'COMMIT');
    return { ok: true, provider: 'sqlite', tables: CONTENT_TABLES };
  } catch (err) {
    try {
      await run(db, 'ROLLBACK');
    } catch {
      // surface original reset failure
    }
    throw err;
  }
}

async function runPendingFullReset({ markerPath, libraryRoot, db, now = new Date() } = {}) {
  const marker = readPendingFullResetMarker(markerPath);
  if (!marker) return { ok: true, ran: false };

  const rootFromMarker = String(marker.library_root || marker.libraryRoot || '').trim();
  const root = path.resolve(rootFromMarker || String(libraryRoot || ''));
  if (!root) throw new Error('libraryRoot is required for pending full reset');

  const entries = await collectOrphanImageRows(db);
  const manifest = writeOrphanManifest({ libraryRoot: root, entries, now, marker });
  const cleaned = cleanLibraryForFullReset(root);
  const truncated = await truncateContentTables(db);

  fs.rmSync(markerPath, { force: true });
  return {
    ok: true,
    ran: true,
    markerPath,
    libraryRoot: root,
    manifestPath: manifest.manifestPath,
    orphanCount: manifest.entryCount,
    removed: cleaned.removed,
    truncatedTables: truncated.tables,
  };
}

function listOrphanManifests({ libraryRoot, limit = 50 } = {}) {
  const root = path.resolve(String(libraryRoot || ''));
  const orphansDir = path.join(root, 'orphans');
  if (!fs.existsSync(orphansDir)) return [];

  const out = [];
  for (const dirent of fs.readdirSync(orphansDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const manifestPath = path.join(orphansDir, dirent.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
      out.push({
        manifestPath,
        createdAt: String(manifest.created_at || ''),
        entryCount: entries.length,
        oldCharacters: Array.from(new Set(entries.map((e) => String(e.display_name || e.character_id || '').trim()).filter(Boolean))).sort(),
      });
    } catch {
      out.push({ manifestPath, createdAt: '', entryCount: 0, oldCharacters: [], unreadable: true });
    }
  }

  const lim = Math.max(1, Math.min(500, Number(limit) || 50));
  return out.sort((a, b) => String(b.createdAt || b.manifestPath).localeCompare(String(a.createdAt || a.manifestPath))).slice(0, lim);
}

function readOrphanManifest({ libraryRoot, manifestPath } = {}) {
  const root = path.resolve(String(libraryRoot || ''));
  const rawPath = String(manifestPath || '').trim();
  if (!root) throw new Error('libraryRoot is required');
  if (!rawPath) throw new Error('manifestPath is required');
  const abs = path.resolve(rawPath);
  assertInsideDir(path.join(root, 'orphans'), abs, 'Orphan manifest');
  const manifest = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (Number(manifest.manifest_version) !== ORPHAN_MANIFEST_VERSION) {
    throw new Error(`Unsupported orphan manifest version: ${manifest.manifest_version}`);
  }
  if (!Array.isArray(manifest.entries)) throw new Error('Orphan manifest has no entries array');
  return { manifest, manifestPath: abs };
}

function entrySourceAbs({ libraryRoot, entry } = {}) {
  const mode = String(entry?.storage_mode || 'copy');
  if (mode === 'reference' && entry?.source_path) return path.resolve(String(entry.source_path));
  return resolveInside(
    libraryRoot,
    path.join('characters', String(entry?.character_id || ''), String(entry?.relative_path || '')),
    'Orphan image path'
  );
}

async function adoptOrphanImages({ library, manifestPath, targetCharacterId, imageIds = null } = {}) {
  if (!library || !library.db) throw new Error('library is required');
  const targetRaw = String(targetCharacterId || '').trim();
  if (!targetRaw) throw new Error('targetCharacterId is required');

  const { manifest } = readOrphanManifest({ libraryRoot: library.libraryRoot, manifestPath });
  const wanted = Array.isArray(imageIds) && imageIds.length > 0 ? new Set(imageIds.map((x) => String(x))) : null;
  const entries = manifest.entries.filter((entry) => {
    if (!wanted) return true;
    return wanted.has(String(entry.image_id || ''));
  });

  const newCharacterByDisplayName = new Map();
  const adopted = [];
  const skipped = [];
  const errors = [];

  for (const entry of entries) {
    try {
      const sourceAbs = entrySourceAbs({ libraryRoot: library.libraryRoot, entry });
      if (!fs.existsSync(sourceAbs)) throw new Error('file missing');
      const bytes = fs.readFileSync(sourceAbs);
      const actualHash = sha256Hex(bytes);
      const expectedHash = String(entry.file_hash || '');
      if (expectedHash && actualHash !== expectedHash) throw new Error('file_hash mismatch');

      let finalTargetId = targetRaw;
      if (targetRaw === '__new__') {
        const displayName = String(entry.display_name || 'Recovered images').trim() || 'Recovered images';
        if (!newCharacterByDisplayName.has(displayName)) {
          const id = await library.createCharacter({ displayName });
          newCharacterByDisplayName.set(displayName, id);
        }
        finalTargetId = newCharacterByDisplayName.get(displayName);
      } else {
        const existingTarget = await get(library.db, 'SELECT character_id FROM Character WHERE character_id = ?', [targetRaw]);
        if (!existingTarget) throw new Error('target character not found');
      }

      const existing = await get(
        library.db,
        'SELECT image_id, relative_path FROM ImageAsset WHERE character_id = ? AND file_hash = ? ORDER BY added_at ASC LIMIT 1',
        [finalTargetId, actualHash]
      );
      if (existing) {
        skipped.push({
          imageId: String(entry.image_id || ''),
          reason: 'duplicate',
          targetCharacterId: finalTargetId,
          existingImageId: String(existing.image_id || ''),
        });
        continue;
      }

      const paths = library.getCharacterPaths(finalTargetId);
      ensureDir(paths.imagesOriginalDir);
      ensureDir(paths.imagesThumbDir);

      const ext = path.extname(sourceAbs).toLowerCase() || '.png';
      const imageId = randomId('img_');
      const fileName = `${actualHash.slice(0, 16)}${ext}`;
      const destAbs = path.join(paths.imagesOriginalDir, fileName);
      fs.copyFileSync(sourceAbs, destAbs);
      const rel = normalizeRel(path.join('images', 'original', fileName));

      const oldRel = normalizeRel(entry.relative_path || '');
      const oldStem = path.basename(oldRel).replace(path.extname(oldRel), '');
      const oldThumbAbs = oldStem ? path.join(path.dirname(sourceAbs), '..', 'thumb', `${oldStem}.png`) : null;
      const destThumbAbs = path.join(paths.imagesThumbDir, `${actualHash.slice(0, 16)}.png`);
      if (oldThumbAbs && fs.existsSync(path.resolve(oldThumbAbs))) {
        fs.copyFileSync(path.resolve(oldThumbAbs), destThumbAbs);
      }

      const tags = Array.isArray(entry.tags) ? entry.tags.map((x) => String(x)).filter(Boolean) : [];
      await run(
        library.db,
        `INSERT INTO ImageAsset(
           image_id, character_id, relative_path, file_hash, width, height, favorite, rating, notes, tags_json,
           storage_mode, source_path, source_url, source_note, source_dataset_id, source_task_id, source_run_id,
           source_contact_sheet_ref, sheet_version_id, review_status
         )
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'copy', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          imageId,
          finalTargetId,
          rel,
          actualHash,
          entry.width == null ? null : Number(entry.width),
          entry.height == null ? null : Number(entry.height),
          Number(entry.favorite || 0) ? 1 : 0,
          Math.max(0, Math.min(5, Number(entry.rating || 0))),
          entry.notes == null ? '' : String(entry.notes),
          JSON.stringify(tags),
          entry.source_path == null ? null : String(entry.source_path),
          entry.source_url == null ? null : String(entry.source_url),
          entry.source_note == null ? null : String(entry.source_note),
          entry.source_dataset_id == null ? null : String(entry.source_dataset_id),
          entry.source_task_id == null ? null : String(entry.source_task_id),
          entry.source_run_id == null ? null : String(entry.source_run_id),
          entry.source_contact_sheet_ref == null ? null : String(entry.source_contact_sheet_ref),
          entry.sheet_version_id == null ? null : String(entry.sheet_version_id),
          entry.review_status == null ? 'accepted' : String(entry.review_status),
        ]
      );

      adopted.push({
        oldImageId: String(entry.image_id || ''),
        imageId,
        targetCharacterId: finalTargetId,
        relativePath: rel,
        fileHash: actualHash,
      });
    } catch (err) {
      errors.push({
        imageId: String(entry.image_id || ''),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ok: true, manifestPath, adopted, skipped, errors };
}

module.exports = {
  FULL_RESET_MARKER,
  ORPHAN_MANIFEST_VERSION,
  PRESERVED_IMAGE_RELATIVE_DIRS,
  ELECTRON_PREFERENCE_PATHS,
  CONTENT_TABLES,
  getPendingFullResetMarkerPath,
  readPendingFullResetMarker,
  writePendingFullResetMarker,
  clearPreferenceFiles,
  collectOrphanImageRows,
  writeOrphanManifest,
  cleanLibraryForFullReset,
  truncateContentTables,
  runPendingFullReset,
  listOrphanManifests,
  readOrphanManifest,
  adoptOrphanImages,
};
