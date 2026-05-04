const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const { randomId, sha256Hex } = require('./crypto');
const { openDb, initSchema, run, get, all, isPostgresDb } = require('./db');
const { parseTemplate } = require('./templateParser');
const {
  parseSheetText,
  applyFieldUpdatesToParsedSheet,
  extractFieldAssignmentsFromText,
  generateCanonicalSheetText,
} = require('./sheet');
const { validateCharacterValues, classifyChangeType } = require('./validation');
const { extractDominantPaletteFromBitmap } = require('./palette');
const { computeDhashHexFromBitmap, hammingDistanceHex64, isHex64 } = require('./dhash');

const INBOX_CHARACTER_ID = '__ckc_inbox';
const INBOX_CHARACTER_NAME = 'Inbox';

function extractBracketLinks(text) {
  const out = new Set();
  const raw = String(text ?? '');
  const re = /\[\[([^\]]+?)\]\]/g;
  let m = null;
  while ((m = re.exec(raw)) !== null) {
    const token = String(m[1] ?? '').trim();
    if (!token) continue;
    out.add(token);
  }
  return Array.from(out);
}

function docTargetType(docType) {
  return `doc.${String(docType || '').trim().toLowerCase()}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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

function sanitizeFileName(name, fallback) {
  const raw = String(name ?? '').trim();
  const base = raw.length ? raw : String(fallback ?? 'export.txt');
  // Windows-safe filename sanitization.
  const cleaned = base
    .replaceAll(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return cleaned.length ? cleaned.slice(0, 180) : 'export.txt';
}

function sanitizeNoSpaceFileName(name, fallback) {
  const raw = sanitizeFileName(name, fallback);
  const ext = path.extname(raw);
  const stem = raw.slice(0, Math.max(0, raw.length - ext.length)) || 'file';
  const safeStem = stem.replaceAll(/\s+/g, '_').replaceAll(/_+/g, '_').replaceAll(/^[._-]+|[._-]+$/g, '') || 'file';
  return `${safeStem.slice(0, 150)}${ext}`;
}

function shortStableIdForPath(id, maxBodyChars = 12) {
  const raw = String(id ?? '').trim();
  if (!raw) return 'id';

  const m = raw.match(/^([A-Za-z]+_)([0-9a-fA-F]+)$/);
  if (m) {
    const prefix = m[1];
    const body = m[2].toLowerCase();
    return `${prefix}${body.slice(0, Math.max(4, Math.min(Number(maxBodyChars) || 12, body.length)))}`;
  }

  const safe = raw.replaceAll(/[^A-Za-z0-9_-]+/g, '_');
  return safe.length > 16 ? safe.slice(0, 16) : safe;
}

function uniquePath(dir, fileName) {
  const base = String(fileName || 'export.txt');
  const ext = path.extname(base);
  const stem = base.slice(0, Math.max(0, base.length - ext.length)) || 'export';

  let candidate = path.join(dir, base);
  if (!fs.existsSync(candidate)) return candidate;

  for (let i = 2; i < 10_000; i++) {
    candidate = path.join(dir, `${stem}__${i}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }

  return path.join(dir, `${stem}__${toIsoSafeTimestamp()}${ext}`);
}

function toIsoSafeTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function computeSearchBlobs({ displayName, fieldsById, templateAst, tags }) {
  const name = displayName ? String(displayName) : '';
  const tagText = Array.isArray(tags) ? tags.join(' ') : '';

  const ids = [];
  const labels = [];
  const values = [];
  const allParts = [];

  if (name) allParts.push(name);

  for (const section of templateAst.sections) {
    for (const field of section.fields) {
      const val = fieldsById[field.id] ?? '';
      ids.push(field.id);
      labels.push(field.label);
      values.push(String(val ?? ''));
      allParts.push(`${field.id} ${field.label} ${val}`);
    }
  }

  if (tagText) allParts.push(tagText);

  return {
    all: allParts.join('\n'),
    ids: ids.join('\n'),
    labels: labels.join('\n'),
    values: values.join('\n'),
    tags: tagText,
    name,
  };
}

function defaultSafeSubsetSectionExclusion(title) {
  const t = String(title).toUpperCase();
  // Conservative exclusion for explicit/adult-only sections.
  return (
    t.includes('ADULT') ||
    t.includes('NSFW') ||
    t.includes('SEXUAL') ||
    t.includes('INTIMATE') ||
    t.includes('GENITAL') ||
    t.includes('ORAL') ||
    t.includes('ANAL')
  );
}

function orderFieldIdsByTemplate(templateAst, fieldIds) {
  const wanted = new Set((fieldIds || []).map((x) => String(x)));
  const ordered = [];
  for (const section of templateAst.sections) {
    for (const field of section.fields) {
      if (wanted.has(field.id)) ordered.push(field.id);
    }
  }
  return ordered;
}

function parseSheetHeaderMeta(sheetText) {
  const meta = {};
  const lines = String(sheetText ?? '').split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 64); i++) {
    const line = lines[i];
    if (!line || !line.trim().length) break;
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2] ?? '';
  }
  return meta;
}

function isSafeIdForFolder(value) {
  return /^[A-Za-z0-9_-]+$/.test(String(value || ''));
}

function parseCharPublicIdNumber(value) {
  const v = String(value ?? '').trim().toUpperCase();
  const m = v.match(/^CHAR-(\d{6})$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatCharPublicId(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `CHAR-${String(Math.floor(num)).padStart(6, '0')}`;
}

function clamp01(n, fallback = 0.5) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

class CKCLibrary {
  constructor({ libraryRoot, builtInTemplatePath, defaultTemplateId = 'v2.00', electronNativeImage = null, database = null }) {
    this.libraryRoot = libraryRoot;
    this.builtInTemplatePath = builtInTemplatePath;
    this.defaultTemplateId = defaultTemplateId || 'v2.00';
    this.electronNativeImage = electronNativeImage;
    this.database = database;

    this.db = null;
    this.template = null; // active default template AST
    this.templatesById = new Map(); // template_id -> AST

    this._ftsEnsurePromise = null;
    this._ftsAvailable = null;
  }

  getPaths() {
    return {
      dbPath: path.join(this.libraryRoot, 'db', 'codex.db'),
      templatesDir: path.join(this.libraryRoot, 'templates'),
      charactersDir: path.join(this.libraryRoot, 'characters'),
      exportsDir: path.join(this.libraryRoot, 'exports'),
    };
  }

  getCharacterPaths(characterId) {
    const base = path.join(this.getPaths().charactersDir, characterId);
    return {
      base,
      sheetDir: path.join(base, 'sheet'),
      versionsDir: path.join(base, 'sheet', 'versions'),
      sheetTxtPath: path.join(base, 'sheet', 'character.txt'),
      sheetMdPath: path.join(base, 'sheet', 'character.md'),
      imagesOriginalDir: path.join(base, 'images', 'original'),
      imagesThumbDir: path.join(base, 'images', 'thumb'),
      exportsDir: path.join(base, 'exports'),
      extrasDir: path.join(base, 'extras'),
      packsDir: path.join(base, 'packs'),
    };
  }

  async getImageAbsPath({ imageId, kind = 'original' }) {
    const row = await get(
      this.db,
      'SELECT character_id, relative_path, storage_mode, source_path FROM ImageAsset WHERE image_id = ?',
      [imageId]
    );
    if (!row) return null;

    const characterId = String(row.character_id || '');
    const rel = String(row.relative_path || '');
    const mode = String(row.storage_mode || 'copy');
    const paths = this.getCharacterPaths(characterId);

    const originalAbs =
      mode === 'reference' && row.source_path
        ? String(row.source_path)
        : path.join(paths.base, rel.replaceAll('/', path.sep));

    if (kind !== 'thumb') return originalAbs;

    const fileName = path.basename(rel.replaceAll('/', path.sep));
    const stem = fileName.replace(path.extname(fileName), '');
    if (!stem) return originalAbs;
    const thumbAbs = path.join(paths.imagesThumbDir, `${stem}.png`);
    return fs.existsSync(thumbAbs) ? thumbAbs : originalAbs;
  }

  async repairCharacterFolders(characterId) {
    const paths = this.getCharacterPaths(characterId);
    ensureDir(paths.sheetDir);
    ensureDir(paths.versionsDir);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);
    ensureDir(paths.exportsDir);
    ensureDir(paths.extrasDir);
    ensureDir(paths.packsDir);

    const existing = await this.getCharacter(characterId);
    if (!existing) throw new Error('Character not found');

    if (!fs.existsSync(paths.sheetTxtPath)) {
      const templateAst = await this.getTemplateAst(existing.templateId);
      const publicId =
        String(existing.publicId ?? '').trim() || String(existing.valuesById?.['CHAR-ID-001'] ?? '').trim() || String(characterId);
      const repaired = generateCanonicalSheetText(
        templateAst,
        {
          templateId: templateAst.id,
          templateVersion: templateAst.version,
          templateHash: templateAst.hash,
          characterId: publicId,
          displayName: existing.displayName,
        },
        existing.valuesById
      );
      fs.writeFileSync(paths.sheetTxtPath, repaired, 'utf8');
    }

    return { ok: true };
  }

  async initialize() {
    const { templatesDir, charactersDir, exportsDir, dbPath } = this.getPaths();
    ensureDir(this.libraryRoot);
    ensureDir(path.dirname(dbPath));
    ensureDir(templatesDir);
    ensureDir(charactersDir);
    ensureDir(exportsDir);

    this.db = await openDb(dbPath, { database: this.database, libraryRoot: this.libraryRoot });
    await initSchema(this.db);

    await this.ensureTemplateLoaded();
    await this.ensureBuiltinSafeSubsetPack();
    await this.ensureBuiltinAllFieldsPack();
    await this.ensureDefaultProtectedFields();
  }

  async _getMetaValue(key) {
    const k = String(key ?? '').trim();
    if (!k) return null;
    try {
      const row = await get(this.db, 'SELECT meta_value FROM CkcMeta WHERE meta_key = ?', [k]);
      if (!row) return null;
      const v = row.meta_value;
      return v == null ? null : String(v);
    } catch {
      return null;
    }
  }

  async _setMetaValue(key, value) {
    const k = String(key ?? '').trim();
    if (!k) return;
    const v = value == null ? '' : String(value);
    await run(
      this.db,
      `INSERT INTO CkcMeta(meta_key, meta_value, updated_at)
       VALUES(?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(meta_key) DO UPDATE SET
         meta_value = excluded.meta_value,
         updated_at = CURRENT_TIMESTAMP`,
      [k, v]
    );
  }

  async _ftsTablesExist() {
    if (isPostgresDb(this.db)) return false;
    try {
      const row = await get(this.db, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, ['character_fts']);
      return !!row?.name;
    } catch {
      return false;
    }
  }

  _extractNeedleFromFtsQuery(queryText) {
    const q = String(queryText ?? '').trim();
    if (!q) return '';

    const quoted = q.match(/"([^"]+)"/);
    if (quoted && String(quoted[1]).trim()) return String(quoted[1]).trim();

    const tokens = q
      .replaceAll(/[()]/g, ' ')
      .split(/\s+/g)
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()));
    return tokens[0] ?? '';
  }

  _extractStoryBoardCardText(boardJson) {
    try {
      const parsed = JSON.parse(String(boardJson ?? '{}'));
      const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
      const texts = cards.map((c) => String(c?.text ?? '')).filter((t) => t.trim().length > 0);
      return texts.join('\n\n');
    } catch {
      return '';
    }
  }

  _extractMoodboardTexts(boardJson) {
    try {
      const parsed = JSON.parse(String(boardJson ?? '{}'));
      const texts = Array.isArray(parsed?.texts) ? parsed.texts : [];
      return texts
        .map((t) => (t && typeof t === 'object' ? t : {}))
        .map((t) => ({
          id: String(t.id ?? '').trim(),
          text: String(t.text ?? ''),
          name: String(t.name ?? '').trim(),
          tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
        }))
        .filter((t) => t.id && t.text.trim().length > 0);
    } catch {
      return [];
    }
  }

  async _refreshMoodboardFtsForDoc({ docId, title, boardJson }) {
    const id = String(docId ?? '').trim();
    if (!id) return;
    if (!(await this._ftsTablesExist())) return;

    await run(this.db, `DELETE FROM moodboard_fts WHERE doc_id = ?`, [id]);

    const cleanedTitle = String(title ?? '').trim();
    if (cleanedTitle) {
      await run(this.db, `INSERT INTO moodboard_fts(doc_id, layer_id, content) VALUES(?, ?, ?)`, [id, '__TITLE__', cleanedTitle]);
    }

    for (const t of this._extractMoodboardTexts(boardJson)) {
      const contentParts = [t.text];
      if (t.name) contentParts.push(t.name);
      if (t.tags.length) contentParts.push(t.tags.join(' '));
      await run(this.db, `INSERT INTO moodboard_fts(doc_id, layer_id, content) VALUES(?, ?, ?)`, [id, t.id, contentParts.join('\n')]);
    }
  }

  async _refreshStoryFtsForDoc({ docId, title, bodyText, tagsJson = null }) {
    const id = String(docId ?? '').trim();
    if (!id) return;
    if (!(await this._ftsTablesExist())) return;

    let tagsRaw = tagsJson;
    if (tagsRaw == null) {
      try {
        const rowTags = await get(this.db, `SELECT tags_json FROM StoryDoc WHERE doc_id = ?`, [id]);
        tagsRaw = rowTags?.tags_json ?? '';
      } catch {
        tagsRaw = '';
      }
    }

    const row = await get(this.db, `SELECT board_json FROM StoryBoard WHERE doc_id = ?`, [id]);
    const cardsText = this._extractStoryBoardCardText(row?.board_json ?? '');

    const cleanedTitle = String(title ?? '').trim();
    const base = String(bodyText ?? '');
    const tagsPart = String(tagsRaw ?? '').trim();
    const mergedBase = tagsPart ? `${base}\n\n${tagsPart}` : base;
    const merged = cardsText ? `${mergedBase}\n\n${cardsText}` : mergedBase;

    await run(this.db, `DELETE FROM story_fts WHERE doc_id = ?`, [id]);
    await run(this.db, `INSERT INTO story_fts(doc_id, title, content) VALUES(?, ?, ?)`, [id, cleanedTitle, merged]);
  }

  async _rebuildGlobalSearchIndex() {
    if (!(await this._ftsTablesExist())) return { ok: false, reason: 'FTS tables missing' };

    await run(this.db, 'BEGIN');
    try {
      for (const t of ['character_fts', 'note_fts', 'story_fts', 'moodboard_fts', 'image_fts']) {
        await run(this.db, `DELETE FROM ${t}`);
      }

      await run(
        this.db,
        `INSERT INTO character_fts(character_id, field_id, content)
         SELECT character_id, '__NAME__', TRIM(COALESCE(display_name, '') || ' ' || COALESCE(public_id, ''))
         FROM Character`
      );

      await run(
        this.db,
        `INSERT INTO character_fts(character_id, field_id, content)
         SELECT character_id, field_id, COALESCE(value_text, '')
         FROM FieldValue
         WHERE value_text IS NOT NULL AND LENGTH(TRIM(value_text)) > 0`
      );

      await run(
        this.db,
        `INSERT INTO note_fts(doc_id, title, content)
         SELECT doc_id, COALESCE(title, ''), COALESCE(body_text, '') || ' ' || COALESCE(tags_json, '')
         FROM NoteDoc`
      );

      await run(
        this.db,
        `INSERT INTO story_fts(doc_id, title, content)
         SELECT doc_id, COALESCE(title, ''), COALESCE(body_text, '') || ' ' || COALESCE(tags_json, '')
         FROM StoryDoc`
      );

      await run(
        this.db,
        `INSERT INTO image_fts(image_id, character_id, content)
         SELECT image_id, character_id, COALESCE(notes, '') || ' ' || COALESCE(source_note, '') || ' ' || COALESCE(tags_json, '')
         FROM ImageAsset`
      );

      // Moodboards: index text layers (and title) rather than the raw JSON.
      const moodRows = await all(this.db, `SELECT doc_id, title, board_json FROM MoodboardDoc`);
      for (const r of moodRows) {
        await this._refreshMoodboardFtsForDoc({ docId: r.doc_id, title: r.title, boardJson: r.board_json });
      }

      // Stories: enrich index with corkboard/outliner card text when present.
      const storyRows = await all(this.db, `SELECT doc_id, title, body_text FROM StoryDoc`);
      for (const r of storyRows) {
        await this._refreshStoryFtsForDoc({ docId: r.doc_id, title: r.title, bodyText: r.body_text });
      }

      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._setMetaValue('fts_built_v1', new Date().toISOString());
    return { ok: true };
  }

  async _ensureGlobalSearchIndex() {
    if (this._ftsEnsurePromise) return this._ftsEnsurePromise;
    this._ftsEnsurePromise = (async () => {
      const hasFts = await this._ftsTablesExist();
      this._ftsAvailable = hasFts;
      if (!hasFts) return { ok: false, available: false };

      const built = await this._getMetaValue('fts_built_v1');
      if (String(built ?? '').trim()) return { ok: true, available: true, builtAt: built };

      try {
        const res = await this._rebuildGlobalSearchIndex();
        return { ok: !!res?.ok, available: true };
      } catch (err) {
        await this._setMetaValue('fts_build_error_v1', String(err?.message || err || 'Unknown error'));
        return { ok: false, available: true, error: String(err?.message || err || 'Unknown error') };
      }
    })();

    try {
      return await this._ftsEnsurePromise;
    } finally {
      // Keep the memoized promise so we don't thrash rebuilds. A future explicit "Rebuild index" action can reset it.
    }
  }

  _plainSearchSnippet(text, needle) {
    const raw = String(text ?? '');
    const n = String(needle ?? '').trim();
    if (!n) return raw.slice(0, 220);
    const lower = raw.toLowerCase();
    const idx = lower.indexOf(n.toLowerCase());
    if (idx < 0) return raw.slice(0, 220);
    const start = Math.max(0, idx - 80);
    const end = Math.min(raw.length, idx + n.length + 140);
    return `${start > 0 ? '...' : ''}${raw.slice(start, idx)}[[[${raw.slice(idx, idx + n.length)}]]]${raw.slice(
      idx + n.length,
      end
    )}${end < raw.length ? '...' : ''}`;
  }

  async _globalSearchPostgresFallback({ queryText = '', scope = 'library', characterId = null, limitPerType = 50 } = {}) {
    const q = String(queryText ?? '').trim();
    const lim = Math.max(1, Math.min(200, Number(limitPerType) || 50));
    const wantScope = String(scope ?? '').toLowerCase() === 'character' ? 'character' : 'library';
    const cid = String(characterId ?? '').trim();
    const scopeChar = wantScope === 'character' && cid ? cid : null;
    const like = `%${q}%`;

    const charParams = scopeChar ? [like, scopeChar, lim] : [like, lim];
    const charScope = scopeChar ? 'AND c.character_id = ?' : '';
    const charRows = await all(
      this.db,
      `SELECT c.character_id, c.display_name, c.public_id, fv.field_id, fv.value_text
       FROM Character c
       LEFT JOIN FieldValue fv ON fv.character_id = c.character_id
       WHERE (c.display_name ILIKE ? OR c.public_id ILIKE ? OR fv.value_text ILIKE ?)
       ${charScope}
       ORDER BY c.updated_at DESC
       LIMIT ?`,
      scopeChar ? [like, like, like, scopeChar, lim] : [like, like, like, lim]
    );

    const noteRows = await all(this.db, `SELECT doc_id, title, body_text, tags_json FROM NoteDoc WHERE title ILIKE ? OR body_text ILIKE ? OR tags_json ILIKE ? ORDER BY updated_at DESC LIMIT ?`, [
      like,
      like,
      like,
      lim,
    ]);
    const storyRows = await all(this.db, `SELECT doc_id, title, body_text, tags_json FROM StoryDoc WHERE title ILIKE ? OR body_text ILIKE ? OR tags_json ILIKE ? ORDER BY updated_at DESC LIMIT ?`, [
      like,
      like,
      like,
      lim,
    ]);
    const moodRows = await all(this.db, `SELECT doc_id, title, board_json, tags_json FROM MoodboardDoc WHERE title ILIKE ? OR board_json ILIKE ? OR tags_json ILIKE ? ORDER BY updated_at DESC LIMIT ?`, [
      like,
      like,
      like,
      lim,
    ]);

    const imageParams = scopeChar ? [like, like, like, scopeChar, lim] : [like, like, like, lim];
    const imageScope = scopeChar ? 'AND ia.character_id = ?' : '';
    const imageRows = await all(
      this.db,
      `SELECT ia.image_id, ia.character_id, ia.notes, ia.source_note, ia.tags_json, c.display_name
       FROM ImageAsset ia
       JOIN Character c ON c.character_id = ia.character_id
       WHERE (ia.notes ILIKE ? OR ia.source_note ILIKE ? OR ia.tags_json ILIKE ?)
       ${imageScope}
       ORDER BY ia.added_at DESC
       LIMIT ?`,
      imageParams
    );

    return {
      ok: true,
      provider: 'postgres',
      query: q,
      needle: q,
      scope: scopeChar ? 'character' : 'library',
      results: {
        characters: charRows.map((r) => ({
          characterId: String(r.character_id ?? ''),
          displayName: String(r.display_name ?? ''),
          publicId: r.public_id ?? null,
          fieldId: r.field_id ? String(r.field_id) : '__NAME__',
          snippet: this._plainSearchSnippet([r.display_name, r.public_id, r.value_text].filter(Boolean).join(' '), q),
        })),
        notes: noteRows.map((r) => ({
          docId: String(r.doc_id ?? ''),
          title: String(r.title ?? ''),
          snippet: this._plainSearchSnippet(`${r.title ?? ''}\n${r.body_text ?? ''}\n${r.tags_json ?? ''}`, q),
        })),
        stories: storyRows.map((r) => ({
          docId: String(r.doc_id ?? ''),
          title: String(r.title ?? ''),
          snippet: this._plainSearchSnippet(`${r.title ?? ''}\n${r.body_text ?? ''}\n${r.tags_json ?? ''}`, q),
        })),
        moodboards: moodRows.map((r) => ({
          docId: String(r.doc_id ?? ''),
          title: String(r.title ?? ''),
          layerId: '__TITLE__',
          snippet: this._plainSearchSnippet(`${r.title ?? ''}\n${r.board_json ?? ''}\n${r.tags_json ?? ''}`, q),
        })),
        images: imageRows.map((r) => ({
          imageId: String(r.image_id ?? ''),
          characterId: String(r.character_id ?? ''),
          characterName: String(r.display_name ?? ''),
          snippet: this._plainSearchSnippet(`${r.notes ?? ''}\n${r.source_note ?? ''}\n${r.tags_json ?? ''}`, q),
        })),
      },
    };
  }

  async globalSearch({ queryText = '', scope = 'library', characterId = null, limitPerType = 50 } = {}) {
    const q = String(queryText ?? '').trim();
    if (!q) {
      return { ok: true, query: '', scope: scope === 'character' ? 'character' : 'library', results: { characters: [], notes: [], stories: [], moodboards: [], images: [] } };
    }

    if (isPostgresDb(this.db)) {
      return this._globalSearchPostgresFallback({ queryText: q, scope, characterId, limitPerType });
    }

    await this._ensureGlobalSearchIndex();
    if (!this._ftsAvailable) throw new Error('Global search is unavailable (FTS5 missing in this SQLite build).');

    const lim = Math.max(1, Math.min(200, Number(limitPerType) || 50));
    const wantScope = String(scope ?? '').toLowerCase() === 'character' ? 'character' : 'library';
    const cid = String(characterId ?? '').trim();
    const scopeChar = wantScope === 'character' && cid ? cid : null;

    const SNIP_START = '[[[';
    const SNIP_END = ']]]';
    const SNIP_ELLIPSIS = '…';
    const SNIP_TOKENS = 28;

    const queryCharacters = async () => {
      const whereScope = scopeChar ? 'AND character_fts.character_id = ?' : '';
      const params = scopeChar ? [q, scopeChar, lim] : [q, lim];
      const rows = await all(
        this.db,
        `
        SELECT
          character_fts.character_id AS character_id,
          character_fts.field_id AS field_id,
          c.display_name AS display_name,
          c.public_id AS public_id,
          snippet(character_fts, 2, '${SNIP_START}', '${SNIP_END}', '${SNIP_ELLIPSIS}', ${SNIP_TOKENS}) AS snippet
        FROM character_fts
        JOIN Character c ON c.character_id = character_fts.character_id
        WHERE character_fts MATCH ?
        ${whereScope}
        ORDER BY bm25(character_fts)
        LIMIT ?
      `,
        params
      );
      return rows.map((r) => ({
        kind: 'character',
        characterId: String(r.character_id ?? ''),
        publicId: r.public_id != null ? String(r.public_id) : null,
        displayName: String(r.display_name ?? ''),
        fieldId: String(r.field_id ?? ''),
        snippet: String(r.snippet ?? ''),
      }));
    };

    const queryNotes = async () => {
      const rows = await all(
        this.db,
        `
        SELECT
          n.doc_id AS doc_id,
          n.title AS title,
          n.updated_at AS updated_at,
          snippet(note_fts, 2, '${SNIP_START}', '${SNIP_END}', '${SNIP_ELLIPSIS}', ${SNIP_TOKENS}) AS snippet
        FROM note_fts
        JOIN NoteDoc n ON n.doc_id = note_fts.doc_id
        WHERE note_fts MATCH ?
        ORDER BY bm25(note_fts)
        LIMIT ?
      `,
        [q, lim]
      );
      return rows.map((r) => ({
        kind: 'notes',
        docId: String(r.doc_id ?? ''),
        title: String(r.title ?? ''),
        updatedAt: String(r.updated_at ?? ''),
        snippet: String(r.snippet ?? ''),
      }));
    };

    const queryStories = async () => {
      const rows = await all(
        this.db,
        `
        SELECT
          s.doc_id AS doc_id,
          s.title AS title,
          s.updated_at AS updated_at,
          snippet(story_fts, 2, '${SNIP_START}', '${SNIP_END}', '${SNIP_ELLIPSIS}', ${SNIP_TOKENS}) AS snippet
        FROM story_fts
        JOIN StoryDoc s ON s.doc_id = story_fts.doc_id
        WHERE story_fts MATCH ?
        ORDER BY bm25(story_fts)
        LIMIT ?
      `,
        [q, lim]
      );
      return rows.map((r) => ({
        kind: 'stories',
        docId: String(r.doc_id ?? ''),
        title: String(r.title ?? ''),
        updatedAt: String(r.updated_at ?? ''),
        snippet: String(r.snippet ?? ''),
      }));
    };

    const queryMoodboards = async () => {
      const rows = await all(
        this.db,
        `
        SELECT
          m.doc_id AS doc_id,
          m.title AS title,
          m.updated_at AS updated_at,
          moodboard_fts.layer_id AS layer_id,
          snippet(moodboard_fts, 2, '${SNIP_START}', '${SNIP_END}', '${SNIP_ELLIPSIS}', ${SNIP_TOKENS}) AS snippet
        FROM moodboard_fts
        JOIN MoodboardDoc m ON m.doc_id = moodboard_fts.doc_id
        WHERE moodboard_fts MATCH ?
        ORDER BY bm25(moodboard_fts)
        LIMIT ?
      `,
        [q, lim]
      );
      return rows.map((r) => ({
        kind: 'moodboard',
        docId: String(r.doc_id ?? ''),
        title: String(r.title ?? ''),
        updatedAt: String(r.updated_at ?? ''),
        layerId: String(r.layer_id ?? ''),
        snippet: String(r.snippet ?? ''),
      }));
    };

    const queryImages = async () => {
      const whereScope = scopeChar ? 'AND image_fts.character_id = ?' : '';
      const params = scopeChar ? [q, scopeChar, lim] : [q, lim];
      const rows = await all(
        this.db,
        `
        SELECT
          image_fts.image_id AS image_id,
          image_fts.character_id AS character_id,
          c.display_name AS display_name,
          snippet(image_fts, 2, '${SNIP_START}', '${SNIP_END}', '${SNIP_ELLIPSIS}', ${SNIP_TOKENS}) AS snippet
        FROM image_fts
        JOIN Character c ON c.character_id = image_fts.character_id
        WHERE image_fts MATCH ?
        ${whereScope}
        ORDER BY bm25(image_fts)
        LIMIT ?
      `,
        params
      );
      return rows.map((r) => ({
        kind: 'image',
        imageId: String(r.image_id ?? ''),
        characterId: String(r.character_id ?? ''),
        characterName: String(r.display_name ?? ''),
        snippet: String(r.snippet ?? ''),
      }));
    };

    const [characters, notes, stories, moodboards, images] = await Promise.all([
      queryCharacters(),
      scopeChar ? Promise.resolve([]) : queryNotes(),
      scopeChar ? Promise.resolve([]) : queryStories(),
      scopeChar ? Promise.resolve([]) : queryMoodboards(),
      queryImages(),
    ]);

    const needle = this._extractNeedleFromFtsQuery(q);
    return {
      ok: true,
      query: q,
      needle,
      scope: wantScope,
      scopeCharacterId: scopeChar,
      results: { characters, notes, stories, moodboards, images },
    };
  }

  async _allocateNextPublicCharacterId() {
    const rows = await all(this.db, `SELECT public_id FROM Character WHERE public_id IS NOT NULL AND LENGTH(TRIM(public_id)) > 0`);
    let max = 0;
    for (const r of rows) {
      const n = parseCharPublicIdNumber(r.public_id);
      if (n && n > max) max = n;
    }
    return formatCharPublicId(max + 1);
  }

  async _getOrCreatePublicCharacterId(characterId) {
    const row = await get(this.db, `SELECT character_id, public_id, is_system FROM Character WHERE character_id = ?`, [characterId]);
    if (!row) throw new Error('Character not found');

    const existing = String(row.public_id ?? '').trim();
    if (existing) return existing;

    const isSystem = !!row.is_system;
    if (isSystem) return String(characterId);

    const next = await this._allocateNextPublicCharacterId();
    if (!next) throw new Error('Failed to allocate public Character ID');

    await run(this.db, `UPDATE Character SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE character_id = ?`, [next, characterId]);
    return next;
  }

  async ensureInboxCharacter() {
    const existing = await get(this.db, 'SELECT character_id FROM Character WHERE character_id = ?', [INBOX_CHARACTER_ID]);
    if (existing) return INBOX_CHARACTER_ID;

    const templateAst = await this.getTemplateAst(this.defaultTemplateId);
    const characterId = INBOX_CHARACTER_ID;
    const displayName = INBOX_CHARACTER_NAME;
    const paths = this.getCharacterPaths(characterId);

    ensureDir(paths.sheetDir);
    ensureDir(paths.versionsDir);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);
    ensureDir(paths.exportsDir);
    ensureDir(paths.extrasDir);
    ensureDir(paths.packsDir);

    const valuesById = {};
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        valuesById[field.id] = field.type === 'rule' ? (field.templateDescriptor ?? '') : '';
      }
    }

    if (Object.prototype.hasOwnProperty.call(valuesById, 'CHAR-ID-001')) valuesById['CHAR-ID-001'] = characterId;
    if (Object.prototype.hasOwnProperty.call(valuesById, 'CHAR-ID-002')) valuesById['CHAR-ID-002'] = displayName;

    const sheetText = generateCanonicalSheetText(
      templateAst,
      {
        templateId: templateAst.id,
        templateVersion: templateAst.version,
        templateHash: templateAst.hash,
        characterId,
        displayName,
      },
      valuesById
    );
    fs.writeFileSync(paths.sheetTxtPath, sheetText, 'utf8');

    await run(
      this.db,
      `INSERT INTO Character(character_id, public_id, display_name, template_id, template_version, template_hash, search_blob, is_system)
       VALUES(?, ?, ?, ?, ?, ?, ?, 1)`,
      [characterId, null, displayName, templateAst.id, templateAst.version, templateAst.hash, '']
    );

    await run(this.db, 'BEGIN');
    try {
      for (const [fieldId, valueText] of Object.entries(valuesById)) {
        if (!String(valueText ?? '').trim().length) continue;
        await run(
          this.db,
          `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
           VALUES(?, ?, ?, ?)`,
          [characterId, fieldId, valueText, this._fieldTypeById(templateAst, fieldId)]
        );
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._upsertDerivedTags(templateAst, characterId, valuesById);
    await this._updateSearchBlob(templateAst, characterId, displayName, valuesById);
    await this._createSheetVersion({ characterId, source: 'import', sheetPath: paths.sheetTxtPath, notes: 'System Inbox sheet created.' });
    await this._audit('character.createInbox', characterId, { displayName, templateId: templateAst.id, templateHash: templateAst.hash });

    return characterId;
  }

  async listInboxImages() {
    const inboxId = await this.ensureInboxCharacter();
    const rows = await all(
      this.db,
      `SELECT image_id, favorite, rating, notes, tags_json, source_url, source_note, added_at
       FROM ImageAsset
       WHERE character_id = ?
       ORDER BY added_at DESC`,
      [inboxId]
    );
    return rows.map((img) => ({
      id: img.image_id,
      favorite: !!img.favorite,
      rating: img.rating,
      notes: img.notes ?? '',
      sourceUrl: img.source_url ?? null,
      sourceNote: img.source_note ?? '',
      tags: (() => {
        try {
          const parsed = JSON.parse(img.tags_json ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      addedAt: img.added_at,
    }));
  }

  async importInboxFromDir({ inboxDir, includeSubdirs = false, maxFiles = 25_000 } = {}) {
    const root = String(inboxDir || '').trim();
    if (!root) throw new Error('inboxDir is required');
    if (!fs.existsSync(root)) throw new Error(`Inbox folder not found: ${root}`);

    const inboxId = await this.ensureInboxCharacter();

    const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
    const max = Math.max(1, Math.min(500_000, Number(maxFiles) || 25_000));

    const filePaths = [];
    const dirQueue = [root];
    while (dirQueue.length > 0 && filePaths.length < max) {
      const dir = dirQueue.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const ent of entries) {
        if (filePaths.length >= max) break;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (includeSubdirs) dirQueue.push(abs);
          continue;
        }
        const ext = path.extname(ent.name).toLowerCase();
        if (!allowedExt.has(ext)) continue;
        filePaths.push(abs);
      }
    }

    if (filePaths.length === 0) return { ok: true, scanned: 0, imported: [], duplicates: [] };

    const res = await this.importImages({ characterId: inboxId, filePaths, duplicatePolicy: 'skip' });
    await this._audit('inbox.importFromDir', inboxId, {
      inboxDir: root,
      includeSubdirs: !!includeSubdirs,
      scannedFiles: filePaths.length,
      importedCount: res.imported?.length ?? 0,
      duplicateCount: res.duplicates?.length ?? 0,
    });
    return { ok: true, scanned: filePaths.length, imported: res.imported || [], duplicates: res.duplicates || [] };
  }

  close() {
    if (this.db) this.db.close();
  }

  async getTemplateAst(templateId = null) {
    const id = templateId || this.defaultTemplateId;
    if (this.templatesById.has(id)) return this.templatesById.get(id);
    const row = await get(this.db, 'SELECT ast_json FROM Template WHERE template_id = ?', [id]);
    if (!row) throw new Error(`Template not found: ${id}`);
    const ast = JSON.parse(row.ast_json);
    this.templatesById.set(id, ast);
    return ast;
  }

  async listTemplates() {
    const rows = await all(
      this.db,
      'SELECT template_id, version_label, source_path, template_hash, updated_at, ast_json FROM Template ORDER BY updated_at DESC'
    );
    return rows.map((r) => {
      let ast = null;
      try {
        ast = this.templatesById.get(r.template_id) || JSON.parse(r.ast_json);
      } catch {
        ast = null;
      }
      if (ast) this.templatesById.set(r.template_id, ast);
      const sections = ast?.sections?.length ?? 0;
      const fields = ast?.sections?.reduce((acc, s) => acc + (s.fields?.length ?? 0), 0) ?? 0;
      const blocks = ast?.blockSchemas?.length ?? 0;
      return {
        id: r.template_id,
        version: r.version_label || 'unknown',
        hash: r.template_hash,
        sourcePath: r.source_path,
        updatedAt: r.updated_at,
        sectionCount: sections,
        fieldCount: fields,
        blockSchemaCount: blocks,
      };
    });
  }

  async setDefaultTemplateId(templateId) {
    const ast = await this.getTemplateAst(templateId);
    this.defaultTemplateId = templateId;
    this.template = ast;
    await this._audit('template.setDefault', null, { templateId });
    return ast;
  }

  async getTemplateDetail(templateId = null) {
    const id = templateId || this.defaultTemplateId;
    const row = await get(
      this.db,
      'SELECT template_id, version_label, source_path, template_hash, ast_json, raw_text, updated_at FROM Template WHERE template_id = ?',
      [id]
    );
    if (!row) return null;
    let ast = null;
    try {
      ast = JSON.parse(row.ast_json);
    } catch {
      ast = null;
    }
    if (ast) this.templatesById.set(id, ast);
    return {
      id: row.template_id,
      version: row.version_label || 'unknown',
      hash: row.template_hash,
      sourcePath: row.source_path,
      updatedAt: row.updated_at,
      ast,
      rawText: row.raw_text,
    };
  }

  _sanitizeTemplateId(id) {
    return String(id).trim().replace(/[^\w.\-]+/g, '_');
  }

  _sanitizeCharacterTemplateId(id) {
    const raw = String(id ?? '').trim();
    const safe = raw
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+/, '')
      .replace(/[-.]+$/, '');
    return safe || `tpl_${Date.now()}`;
  }

  _getBuiltInCharacterTemplatesDir() {
    return path.join(__dirname, '..', 'templates', 'character_templates');
  }

  _getUserCharacterTemplateJsonPath(templateId) {
    const id = this._sanitizeCharacterTemplateId(templateId);
    return path.join(this.getPaths().templatesDir, `CHARACTER_TEMPLATE__${id}.json`);
  }

  _getUserCharacterTemplateImagesDir(templateId) {
    const id = this._sanitizeCharacterTemplateId(templateId);
    return path.join(this.getPaths().templatesDir, `CHARACTER_TEMPLATE__${id}__images`);
  }

  async importTemplateFromFile({ filePath, templateId, overwrite = true }) {
    if (!filePath) throw new Error('Missing filePath');
    const raw = fs.readFileSync(filePath, 'utf8');
    const id = this._sanitizeTemplateId(templateId || path.basename(filePath, path.extname(filePath)));
    const ext = path.extname(filePath).toLowerCase() || '.txt';

    if (id === 'v2.00') {
      throw new Error('Template ID "v2.00" is reserved for the built-in Character Sheet (canonical). Import under a different ID.');
    }

    const templatesDir = this.getPaths().templatesDir;
    ensureDir(templatesDir);
    const destPath = path.join(templatesDir, `TEMPLATE__${id}${ext}`);
    if (!overwrite && fs.existsSync(destPath)) throw new Error(`Template already exists: ${id}`);
    fs.copyFileSync(filePath, destPath);

    const ast = parseTemplate(raw, id, destPath);
    await run(
      this.db,
      `INSERT INTO Template(template_id, version_label, source_path, template_hash, ast_json, raw_text)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(template_id) DO UPDATE SET
         version_label=excluded.version_label,
         source_path=excluded.source_path,
         template_hash=excluded.template_hash,
         ast_json=excluded.ast_json,
         raw_text=excluded.raw_text,
         updated_at=CURRENT_TIMESTAMP`,
      [ast.id, ast.version, destPath, ast.hash, JSON.stringify(ast), raw]
    );

    this.templatesById.set(ast.id, ast);
    if (this.defaultTemplateId === ast.id) this.template = ast;

    await this._audit('template.import', null, { templateId: ast.id, sourcePath: destPath, hash: ast.hash });
    return {
      id: ast.id,
      version: ast.version,
      hash: ast.hash,
      sourcePath: destPath,
      sectionCount: ast.sections.length,
      fieldCount: ast.sections.reduce((acc, s) => acc + s.fields.length, 0),
      blockSchemaCount: ast.blockSchemas.length,
    };
  }

  _normalizeCharacterTemplateDetail(parsed, { sourcePath, isBuiltIn }) {
    const obj = parsed && typeof parsed === 'object' ? parsed : {};
    const templateId = this._sanitizeCharacterTemplateId(obj.template_id ?? obj.templateId ?? path.basename(sourcePath, path.extname(sourcePath)));
    const name = String(obj.name ?? obj.template_name ?? templateId).trim() || templateId;
    const description = String(obj.description ?? '').trim();
    const version = String(obj.version ?? '1.0').trim() || '1.0';
    const sheetTemplateId = String(obj.sheet_template_id ?? obj.sheetTemplateId ?? this.defaultTemplateId).trim() || this.defaultTemplateId;

    const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
    const fields = rawFields
      .map((f) => {
        if (!f || typeof f !== 'object') return null;
        const fieldId = String(f.field_id ?? f.fieldId ?? '').trim();
        if (!fieldId) return null;
        const value = f.value == null ? '' : String(f.value);
        return { fieldId, value };
      })
      .filter(Boolean);

    const rawImgs = Array.isArray(obj.reference_images) ? obj.reference_images : Array.isArray(obj.referenceImages) ? obj.referenceImages : [];
    const referenceImages = rawImgs
      .map((img) => {
        if (!img || typeof img !== 'object') return null;
        const relPath = String(img.path ?? img.rel_path ?? img.relPath ?? '').trim().replaceAll('\\', '/');
        if (!relPath) return null;
        const fileHash = String(img.file_hash ?? img.fileHash ?? '').trim();
        const favorite = !!img.favorite;
        const rating = Math.max(0, Math.min(5, Number(img.rating) || 0));
        const notes = String(img.notes ?? '');
        const tags = Array.isArray(img.tags) ? img.tags.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
        const sourceUrl = img.source_url == null ? null : String(img.source_url ?? '').trim() || null;
        const sourceNote = img.source_note == null ? '' : String(img.source_note ?? '');
        const storageMode = String(img.storage_mode ?? img.storageMode ?? 'copy').trim() || 'copy';
        return { relPath, fileHash, favorite, rating, notes, tags, sourceUrl, sourceNote, storageMode };
      })
      .filter(Boolean);

    let updatedAt = null;
    try {
      const st = fs.statSync(sourcePath);
      updatedAt = st?.mtime ? st.mtime.toISOString() : null;
    } catch {
      updatedAt = null;
    }

    return {
      templateId,
      name,
      description,
      version,
      sheetTemplateId,
      fields,
      referenceImages,
      isBuiltIn: !!isBuiltIn,
      sourcePath,
      updatedAt,
    };
  }

  async listCharacterTemplates() {
    const out = new Map(); // templateId -> summary

    // Built-in templates (shipped with app)
    try {
      const builtInDir = this._getBuiltInCharacterTemplatesDir();
      if (fs.existsSync(builtInDir)) {
        for (const name of fs.readdirSync(builtInDir)) {
          if (!name.toLowerCase().endsWith('.json')) continue;
          const abs = path.join(builtInDir, name);
          try {
            const raw = fs.readFileSync(abs, 'utf8');
            const parsed = JSON.parse(raw);
            const detail = this._normalizeCharacterTemplateDetail(parsed, { sourcePath: abs, isBuiltIn: true });
            out.set(detail.templateId, {
              id: detail.templateId,
              name: detail.name,
              description: detail.description,
              version: detail.version,
              sheetTemplateId: detail.sheetTemplateId,
              fieldCount: detail.fields.length,
              imageCount: detail.referenceImages.length,
              updatedAt: detail.updatedAt,
              isBuiltIn: true,
            });
          } catch {
            // ignore invalid built-in template
          }
        }
      }
    } catch {
      // ignore
    }

    // User templates (stored in libraryRoot/templates)
    const templatesDir = this.getPaths().templatesDir;
    ensureDir(templatesDir);
    const prefix = 'CHARACTER_TEMPLATE__';
    for (const name of fs.readdirSync(templatesDir)) {
      if (!name.startsWith(prefix) || !name.toLowerCase().endsWith('.json')) continue;
      const abs = path.join(templatesDir, name);
      try {
        const raw = fs.readFileSync(abs, 'utf8');
        const parsed = JSON.parse(raw);
        const detail = this._normalizeCharacterTemplateDetail(parsed, { sourcePath: abs, isBuiltIn: false });
        out.set(detail.templateId, {
          id: detail.templateId,
          name: detail.name,
          description: detail.description,
          version: detail.version,
          sheetTemplateId: detail.sheetTemplateId,
          fieldCount: detail.fields.length,
          imageCount: detail.referenceImages.length,
          updatedAt: detail.updatedAt,
          isBuiltIn: false,
        });
      } catch {
        // ignore invalid user template
      }
    }

    const rows = Array.from(out.values());
    rows.sort((a, b) => {
      const ab = a.isBuiltIn ? 1 : 0;
      const bb = b.isBuiltIn ? 1 : 0;
      if (ab !== bb) return ab - bb;
      return String(a.name || '').localeCompare(String(b.name || '')) || String(a.id || '').localeCompare(String(b.id || ''));
    });
    return rows;
  }

  async getCharacterTemplate({ templateId } = {}) {
    const id = String(templateId ?? '').trim();
    if (!id) throw new Error('templateId is required');

    const userPath = this._getUserCharacterTemplateJsonPath(id);
    if (fs.existsSync(userPath)) {
      const raw = fs.readFileSync(userPath, 'utf8');
      const parsed = JSON.parse(raw);
      return this._normalizeCharacterTemplateDetail(parsed, { sourcePath: userPath, isBuiltIn: false });
    }

    const builtInDir = this._getBuiltInCharacterTemplatesDir();
    if (fs.existsSync(builtInDir)) {
      for (const name of fs.readdirSync(builtInDir)) {
        if (!name.toLowerCase().endsWith('.json')) continue;
        const abs = path.join(builtInDir, name);
        try {
          const raw = fs.readFileSync(abs, 'utf8');
          const parsed = JSON.parse(raw);
          const detail = this._normalizeCharacterTemplateDetail(parsed, { sourcePath: abs, isBuiltIn: true });
          if (detail.templateId === this._sanitizeCharacterTemplateId(id)) return detail;
        } catch {
          // ignore
        }
      }
    }

    throw new Error(`Character template not found: ${id}`);
  }

  async saveCharacterTemplateFromCharacter({
    characterId,
    templateId = null,
    name = null,
    description = '',
    includeImages = false,
    overwrite = true,
  } = {}) {
    const idRaw = templateId || name || null;
    const safeId = this._sanitizeCharacterTemplateId(idRaw);

    const cId = String(characterId ?? '').trim();
    if (!cId) throw new Error('characterId is required');
    const character = await this.getCharacter(cId);
    if (!character) throw new Error('Character not found');

    const templateName = String(name ?? character.displayName ?? safeId).trim() || safeId;
    const sheetTemplateId = String(character.templateId ?? this.defaultTemplateId).trim() || this.defaultTemplateId;

    const jsonPath = this._getUserCharacterTemplateJsonPath(safeId);
    const imagesDir = this._getUserCharacterTemplateImagesDir(safeId);

    if (!overwrite && fs.existsSync(jsonPath)) {
      throw new Error(`Template already exists: ${safeId}`);
    }

    // Reset images folder on overwrite (best-effort).
    try {
      if (fs.existsSync(imagesDir)) fs.rmSync(imagesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    const templateAst = await this.getTemplateAst(sheetTemplateId);

    const fields = [];
    for (const section of templateAst.sections || []) {
      for (const field of section.fields || []) {
        const fid = String(field?.id ?? '').trim();
        if (!fid) continue;
        if (fid === 'CHAR-ID-001') continue; // never template the system-managed public ID
        if (field.type === 'rule') continue; // never store rule descriptor lines in templates
        const text = character.valuesById && Object.prototype.hasOwnProperty.call(character.valuesById, fid) ? character.valuesById[fid] : '';
        if (!String(text ?? '').trim().length) continue;
        fields.push({ field_id: fid, value: String(text) });
      }
    }

    const referenceImages = [];
    if (includeImages) {
      ensureDir(imagesDir);
      const usedNames = new Set();

      for (const img of character.images || []) {
        const imageId = String(img?.id ?? '').trim();
        if (!imageId) continue;

        const srcAbs = await this.getImageAbsPath({ imageId, kind: 'original' });
        if (!srcAbs || !fs.existsSync(srcAbs)) continue;

        const ext = path.extname(srcAbs) || path.extname(String(img?.relativePath ?? '')) || '.png';
        let baseName = path.basename(String(img?.relativePath ?? '').replaceAll('/', path.sep));
        if (!baseName || baseName === '.' || baseName === path.sep) {
          const pref = String(img?.fileHash ?? '').slice(0, 16) || randomId('imgfile_');
          baseName = `${pref}${ext}`;
        }

        // ensure unique in template images folder
        let finalName = baseName;
        if (usedNames.has(finalName.toLowerCase())) {
          const stem = finalName.replace(path.extname(finalName), '') || 'img';
          const e = path.extname(finalName) || ext;
          let i = 2;
          while (usedNames.has(`${stem}__dup${i}${e}`.toLowerCase())) i += 1;
          finalName = `${stem}__dup${i}${e}`;
        }
        usedNames.add(finalName.toLowerCase());

        const destAbs = path.join(imagesDir, finalName);
        fs.copyFileSync(srcAbs, destAbs);

        const folderName = path.basename(imagesDir);
        const relPath = path.join(folderName, finalName).replaceAll('\\', '/');

        referenceImages.push({
          path: relPath,
          file_hash: String(img?.fileHash ?? '').trim(),
          favorite: !!img?.favorite,
          rating: Math.max(0, Math.min(5, Number(img?.rating) || 0)),
          notes: String(img?.notes ?? ''),
          tags: Array.isArray(img?.tags) ? img.tags.map((t) => String(t ?? '').trim()).filter(Boolean) : [],
          storage_mode: String(img?.storageMode ?? 'copy'),
          source_url: img?.sourceUrl == null ? null : String(img?.sourceUrl ?? '').trim() || null,
          source_note: String(img?.sourceNote ?? ''),
        });
      }
    }

    const doc = {
      template_id: safeId,
      name: templateName,
      description: String(description ?? '').trim(),
      version: '1.0',
      sheet_template_id: sheetTemplateId,
      include_images: !!includeImages,
      fields,
      reference_images: referenceImages,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf8');
    await this._audit('characterTemplate.save', cId, { templateId: safeId, includeImages: !!includeImages });

    return { ok: true, templateId: safeId, path: jsonPath, imageCount: referenceImages.length, fieldCount: fields.length };
  }

  async _importCharacterTemplateImagesToCharacter({ characterId, templateDetail }) {
    const cId = String(characterId ?? '').trim();
    if (!cId) throw new Error('characterId is required');

    const paths = this.getCharacterPaths(cId);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);

    const templatesDir = this.getPaths().templatesDir;
    const usedNames = new Set();

    for (const img of templateDetail?.referenceImages || []) {
      const rel = String(img?.relPath ?? '').trim().replaceAll('\\', '/');
      if (!rel) continue;
      const srcAbs = path.join(templatesDir, rel.replaceAll('/', path.sep));
      if (!fs.existsSync(srcAbs)) continue;

      const srcBase = path.basename(rel.replaceAll('/', path.sep));
      const ext = path.extname(srcBase) || path.extname(srcAbs) || '.png';
      let baseName = srcBase || `${String(img?.fileHash ?? '').slice(0, 16) || randomId('imgfile_')}${ext}`;

      let finalName = baseName;
      if (usedNames.has(finalName.toLowerCase())) {
        const stem = finalName.replace(path.extname(finalName), '') || 'img';
        const e = path.extname(finalName) || ext;
        let i = 2;
        while (usedNames.has(`${stem}__dup${i}${e}`.toLowerCase())) i += 1;
        finalName = `${stem}__dup${i}${e}`;
      }
      usedNames.add(finalName.toLowerCase());

      const destRel = path.join('images', 'original', finalName).replaceAll('\\', '/');
      const destAbs = path.join(paths.base, destRel.replaceAll('/', path.sep));
      ensureDir(path.dirname(destAbs));
      fs.copyFileSync(srcAbs, destAbs);

      let width = null;
      let height = null;
      if (this.electronNativeImage) {
        try {
          const nimg = this.electronNativeImage.createFromPath(destAbs);
          const size = nimg.getSize();
          width = Number(size?.width) || null;
          height = Number(size?.height) || null;

          const stem = path.basename(finalName, path.extname(finalName));
          const thumbAbs = path.join(paths.imagesThumbDir, `${stem}.png`);
          const thumb = nimg.resize({ width: 320 });
          fs.writeFileSync(thumbAbs, thumb.toPNG());
        } catch {
          // best-effort thumbs only
        }
      }

      const imageId = randomId('img_');
      const tagsJson = JSON.stringify(Array.isArray(img?.tags) ? img.tags : []);
      await run(
        this.db,
        `INSERT INTO ImageAsset(
           image_id, character_id, relative_path, file_hash, width, height,
           favorite, rating, notes, tags_json,
           storage_mode, source_path, source_url, source_note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          imageId,
          cId,
          destRel,
          String(img?.fileHash ?? '').trim() || sha256Hex(fs.readFileSync(destAbs)),
          width,
          height,
          img?.favorite ? 1 : 0,
          Math.max(0, Math.min(5, Number(img?.rating) || 0)),
          String(img?.notes ?? ''),
          tagsJson,
          'copy',
          srcAbs,
          img?.sourceUrl ?? null,
          String(img?.sourceNote ?? ''),
        ]
      );
    }
  }

  async createCharactersFromTemplate({ templateId, count = 1, includeImages = true, numberNames = true } = {}) {
    const detail = await this.getCharacterTemplate({ templateId });
    const n = Math.max(1, Math.min(500, Number(count) || 1));

    const valuesById = {};
    for (const f of detail.fields || []) {
      if (!f) continue;
      const fid = String(f.fieldId ?? '').trim();
      if (!fid) continue;
      if (fid === 'CHAR-ID-001') continue;
      valuesById[fid] = f.value == null ? '' : String(f.value);
    }

    const baseName = String(detail.name ?? 'Unnamed').trim() || 'Unnamed';
    const created = [];

    for (let i = 0; i < n; i += 1) {
      const displayName = n > 1 && numberNames ? `${baseName} ${i + 1}` : baseName;
      const characterId = await this.createCharacter({ displayName, templateId: detail.sheetTemplateId });

      const nextValues = { ...valuesById };
      nextValues['CHAR-ID-002'] = displayName;
      const saveRes = await this.saveCharacter({
        characterId,
        valuesById: nextValues,
        validationMode: 'strict',
        allowSaveWithErrors: true,
        source: 'import',
        versionNotes: `Created from character template: ${detail.templateId}`,
      });

      if (includeImages && Array.isArray(detail.referenceImages) && detail.referenceImages.length > 0) {
        await this._importCharacterTemplateImagesToCharacter({ characterId, templateDetail: detail });
      }

      created.push({ characterId, ok: !!saveRes?.ok, issues: saveRes?.issues || [] });
    }

    await this._audit('characterTemplate.createFromTemplate', null, { templateId: detail.templateId, count: created.length });
    return { ok: true, templateId: detail.templateId, created };
  }

  async cloneCharacter({ sourceCharacterId, includeImages = true, displayName = null } = {}) {
    const srcId = String(sourceCharacterId ?? '').trim();
    if (!srcId) throw new Error('sourceCharacterId is required');

    const src = await this.getCharacter(srcId);
    if (!src) throw new Error('Character not found');

    const baseName = String(displayName ?? '').trim() || `${src.displayName} (clone)`;
    const newId = await this.createCharacter({ displayName: baseName, templateId: src.templateId });

    const clonedValues = { ...(src.valuesById || {}) };
    delete clonedValues['CHAR-ID-001'];
    clonedValues['CHAR-ID-002'] = baseName;

    await this.saveCharacter({
      characterId: newId,
      valuesById: clonedValues,
      validationMode: 'strict',
      allowSaveWithErrors: true,
      source: 'import',
      versionNotes: `Cloned from ${src.publicId || srcId}`,
    });

    if (includeImages) {
      const fromPaths = this.getCharacterPaths(srcId);
      const toPaths = this.getCharacterPaths(newId);
      const rows = await all(
        this.db,
        `SELECT image_id, relative_path, file_hash, width, height, added_at, favorite, rating, notes, tags_json, storage_mode, source_path, source_url, source_note, palette_json, dhash_hex
         FROM ImageAsset WHERE character_id = ?
         ORDER BY added_at ASC`,
        [srcId]
      );

      const idMap = new Map();
      for (const r of rows) {
        const oldImageId = String(r.image_id ?? '').trim();
        if (!oldImageId) continue;
        const newImageId = randomId('img_');
        idMap.set(oldImageId, newImageId);

        const srcAbs = await this.getImageAbsPath({ imageId: oldImageId, kind: 'original' });
        const rel = String(r.relative_path ?? '').trim();
        const destAbs = path.join(toPaths.base, rel.replaceAll('/', path.sep));
        ensureDir(path.dirname(destAbs));
        if (srcAbs && fs.existsSync(srcAbs)) fs.copyFileSync(srcAbs, destAbs);

        // Copy thumb if it exists (best-effort).
        try {
          const fileName = path.basename(rel.replaceAll('/', path.sep));
          const stem = fileName.replace(path.extname(fileName), '');
          const fromThumb = path.join(fromPaths.imagesThumbDir, `${stem}.png`);
          const toThumb = path.join(toPaths.imagesThumbDir, `${stem}.png`);
          if (fs.existsSync(fromThumb)) fs.copyFileSync(fromThumb, toThumb);
        } catch {
          // ignore
        }

        await run(
          this.db,
          `INSERT INTO ImageAsset(
             image_id, character_id, relative_path, file_hash, width, height, added_at,
             favorite, rating, notes, tags_json,
             storage_mode, source_path, source_url, source_note,
             suggested_tags_json, auto_tagged_at,
             palette_json, dhash_hex
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', NULL, ?, ?)`,
          [
            newImageId,
            newId,
            rel,
            r.file_hash,
            r.width ?? null,
            r.height ?? null,
            r.added_at ?? null,
            r.favorite ? 1 : 0,
            Math.max(0, Math.min(5, Number(r.rating) || 0)),
            r.notes ?? '',
            r.tags_json ?? '[]',
            r.storage_mode ?? 'copy',
            r.source_path ?? null,
            r.source_url ?? null,
            r.source_note ?? null,
            r.palette_json ?? null,
            r.dhash_hex ?? null,
          ]
        );

        try {
          const ann = await get(this.db, 'SELECT annotations_json FROM ImageAnnotation WHERE image_id = ?', [oldImageId]);
          if (ann && ann.annotations_json != null) {
            await run(this.db, 'INSERT OR REPLACE INTO ImageAnnotation(image_id, annotations_json) VALUES(?, ?)', [
              newImageId,
              String(ann.annotations_json ?? '{}'),
            ]);
          }
        } catch {
          // ignore
        }
      }

      // Copy character icon mapping if possible.
      const iconOld = String(src.iconImageId ?? '').trim();
      if (iconOld && idMap.has(iconOld)) {
        await run(
          this.db,
          'UPDATE Character SET icon_image_id = ?, icon_focus_x = ?, icon_focus_y = ? WHERE character_id = ?',
          [idMap.get(iconOld), src.iconFocusX ?? 0.5, src.iconFocusY ?? 0.5, newId]
        );
      }
    }

    await this._audit('character.clone', srcId, { clonedCharacterId: newId, includeImages: !!includeImages });
    return { ok: true, characterId: newId };
  }

  async ensureTemplateLoaded() {
    const templateId = 'v2.00';
    const localTemplatePath = path.join(this.getPaths().templatesDir, 'CHARACTER_SHEET__v2.00.txt');

    // v2.00 is a shipped, canonical template and MUST remain complete and uncensored.
    // If the library copy is missing or diverges from the built-in bytes, restore it.
    ensureDir(path.dirname(localTemplatePath));
    const builtInBytes = fs.readFileSync(this.builtInTemplatePath);
    const builtInBytesHash = sha256Hex(builtInBytes);

    let localBytesHash = null;
    if (fs.existsSync(localTemplatePath)) {
      try {
        localBytesHash = sha256Hex(fs.readFileSync(localTemplatePath));
      } catch {
        localBytesHash = null;
      }
    }

    if (!fs.existsSync(localTemplatePath) || localBytesHash !== builtInBytesHash) {
      fs.copyFileSync(this.builtInTemplatePath, localTemplatePath);
      await this._audit('template.restoreBuiltin', null, {
        templateId,
        fromHash: localBytesHash,
        toHash: builtInBytesHash,
        path: localTemplatePath,
      });
    }

    const raw = fs.readFileSync(localTemplatePath, 'utf8');
    const ast = parseTemplate(raw, templateId, localTemplatePath);

    const row = await get(this.db, 'SELECT template_hash FROM Template WHERE template_id = ?', [templateId]);
    if (!row || row.template_hash !== ast.hash) {
      await run(
        this.db,
        `INSERT INTO Template(template_id, version_label, source_path, template_hash, ast_json, raw_text)
         VALUES(?, ?, ?, ?, ?, ?)
         ON CONFLICT(template_id) DO UPDATE SET
           version_label=excluded.version_label,
           source_path=excluded.source_path,
           template_hash=excluded.template_hash,
           ast_json=excluded.ast_json,
           raw_text=excluded.raw_text,
           updated_at=CURRENT_TIMESTAMP`,
        [ast.id, ast.version, localTemplatePath, ast.hash, JSON.stringify(ast), raw]
      );
    }

    this.templatesById.set(ast.id, ast);

    // Activate default template (falls back to v2.00).
    try {
      this.template = await this.getTemplateAst(this.defaultTemplateId);
    } catch {
      this.defaultTemplateId = 'v2.00';
      this.template = ast;
    }
  }

  async ensureBuiltinSafeSubsetPack() {
    const templateId = 'v2.00';
    const name = 'LLM Pack (strict) — Safe Subset';

    const existing = await get(this.db, 'SELECT spinoff_id FROM TemplateSpinOff WHERE template_id = ? AND name = ?', [
      templateId,
      name,
    ]);
    const templateAst = await this.getTemplateAst(templateId);

    let includedFieldIds = null;
    try {
      const manifestPath = path.join(path.dirname(this.builtInTemplatePath), 'spinoffs', 'LLM_SAFE_SUBSET__v2.00.json');
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) includedFieldIds = parsed.map((x) => String(x));
    } catch {
      includedFieldIds = null;
    }

    if (!includedFieldIds) {
      includedFieldIds = [];
      for (const section of templateAst.sections) {
        if (defaultSafeSubsetSectionExclusion(section.title)) continue;
        for (const field of section.fields) {
          if (field.type === 'rule') continue;
          includedFieldIds.push(field.id);
        }
      }
    }

    // Filter to template-known Field IDs (never emit unknown IDs).
    const validIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    includedFieldIds = includedFieldIds.filter((id) => validIds.has(id));

    if (!existing) {
      await run(
        this.db,
        `INSERT INTO TemplateSpinOff(
           spinoff_id, template_id, template_hash_at_create, name, description,
           field_id_list, format, is_builtin
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          randomId('spinoff_'),
          templateId,
          templateAst.hash,
          name,
          'Built-in LLM-friendly pack (strict). Safe Subset is shipped as a curated whitelist for template v2.00.',
          JSON.stringify(includedFieldIds),
          'llm_pack_strict',
        ]
      );
    } else {
      await run(
        this.db,
        `UPDATE TemplateSpinOff
         SET template_hash_at_create = ?, field_id_list = ?, updated_at = CURRENT_TIMESTAMP
         WHERE template_id = ? AND name = ? AND is_builtin = 1`,
        [templateAst.hash, JSON.stringify(includedFieldIds), templateId, name]
      );
    }
  }

  async ensureBuiltinAllFieldsPack() {
    const templateId = 'v2.00';
    const name = 'LLM Pack (strict) — All Fields';

    const existing = await get(this.db, 'SELECT spinoff_id FROM TemplateSpinOff WHERE template_id = ? AND name = ?', [
      templateId,
      name,
    ]);

    const templateAst = await this.getTemplateAst(templateId);
    const includedFieldIds = [];
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        if (field.type === 'rule') continue;
        includedFieldIds.push(field.id);
      }
    }

    // Filter to template-known Field IDs (never emit unknown IDs).
    const validIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    const filtered = includedFieldIds.filter((id) => validIds.has(id));

    if (!existing) {
      await run(
        this.db,
        `INSERT INTO TemplateSpinOff(
           spinoff_id, template_id, template_hash_at_create, name, description,
           field_id_list, format, is_builtin
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          randomId('spinoff_'),
          templateId,
          templateAst.hash,
          name,
          'Built-in LLM-friendly pack (strict). Includes all non-rule fields for template v2.00.',
          JSON.stringify(filtered),
          'llm_pack_strict',
        ]
      );
    } else {
      await run(
        this.db,
        `UPDATE TemplateSpinOff
         SET template_hash_at_create = ?, field_id_list = ?, updated_at = CURRENT_TIMESTAMP
         WHERE template_id = ? AND name = ? AND is_builtin = 1`,
        [templateAst.hash, JSON.stringify(filtered), templateId, name]
      );
    }
  }

  async ensureDefaultProtectedFields() {
    const defaults = ['CHAR-ID-001'];
    for (const fid of defaults) {
      const row = await get(
        this.db,
        `SELECT protected_id FROM ProtectedField WHERE scope = 'global' AND field_id = ? LIMIT 1`,
        [fid]
      );
      if (row) continue;
      await run(
        this.db,
        `INSERT INTO ProtectedField(protected_id, scope, field_id, notes) VALUES(?, 'global', ?, ?)`,
        [randomId('prot_'), fid, 'System default protected field.']
      );
    }
  }

  async listSpinOffs({ templateId = null } = {}) {
    const tid = templateId || this.defaultTemplateId;
    const templateAst = await this.getTemplateAst(tid);
    const rows = await all(
      this.db,
      `SELECT spinoff_id, template_id, template_hash_at_create, name, description, field_id_list, format, created_at, updated_at, is_builtin
       FROM TemplateSpinOff
       WHERE template_id = ?
       ORDER BY is_builtin DESC, name COLLATE NOCASE`,
      [tid]
    );
    return rows.map((r) => {
      let ids = [];
      try {
        const parsed = JSON.parse(r.field_id_list || '[]');
        ids = Array.isArray(parsed) ? parsed : [];
      } catch {
        ids = [];
      }
      return {
        id: r.spinoff_id,
        templateId: r.template_id,
        templateHashAtCreate: r.template_hash_at_create,
        outOfDate: String(r.template_hash_at_create || '') !== String(templateAst.hash || ''),
        name: r.name,
        description: r.description ?? '',
        format: r.format,
        fieldCount: ids.length,
        isBuiltin: !!r.is_builtin,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async getSpinOff(spinoffId) {
    const row = await get(
      this.db,
      `SELECT spinoff_id, template_id, template_hash_at_create, name, description, field_id_list, format, created_at, updated_at, is_builtin
       FROM TemplateSpinOff
       WHERE spinoff_id = ?`,
      [spinoffId]
    );
    if (!row) throw new Error('Spin-off not found');
    const templateAst = await this.getTemplateAst(row.template_id);
    let fieldIds = [];
    try {
      const parsed = JSON.parse(row.field_id_list || '[]');
      fieldIds = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    } catch {
      fieldIds = [];
    }
    return {
      id: row.spinoff_id,
      templateId: row.template_id,
      templateHashAtCreate: row.template_hash_at_create,
      outOfDate: String(row.template_hash_at_create || '') !== String(templateAst.hash || ''),
      name: row.name,
      description: row.description ?? '',
      format: row.format,
      fieldIds,
      isBuiltin: !!row.is_builtin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createSpinOff({ templateId = null, name, description = '', fieldIds = [], format = 'llm_pack_strict' }) {
    const tid = templateId || this.defaultTemplateId;
    const templateAst = await this.getTemplateAst(tid);
    const nm = String(name || '').trim();
    if (!nm) throw new Error('Spin-off name is required');
    if (format !== 'llm_pack_strict' && format !== 'fieldpack_with_values') throw new Error('Invalid spin-off format');

    const ordered = orderFieldIdsByTemplate(templateAst, fieldIds || []);
    if (ordered.length === 0) throw new Error('Spin-off must contain at least one Field ID');

    const spinoffId = randomId('spinoff_');
    await run(
      this.db,
      `INSERT INTO TemplateSpinOff(
         spinoff_id, template_id, template_hash_at_create, name, description, field_id_list, format, is_builtin
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [spinoffId, tid, templateAst.hash, nm, String(description ?? ''), JSON.stringify(ordered), format]
    );
    await this._audit('spinoff.create', null, { spinoffId, templateId: tid, name: nm, fieldCount: ordered.length });
    return spinoffId;
  }

  async updateSpinOff({ spinoffId, patch }) {
    const existing = await get(
      this.db,
      `SELECT spinoff_id, template_id, is_builtin FROM TemplateSpinOff WHERE spinoff_id = ?`,
      [spinoffId]
    );
    if (!existing) throw new Error('Spin-off not found');
    if (existing.is_builtin) throw new Error('Built-in spin-offs cannot be edited');
    const templateAst = await this.getTemplateAst(existing.template_id);

    const next = patch || {};
    if (next.name !== undefined && !String(next.name || '').trim()) throw new Error('Spin-off name cannot be blank');
    if (next.format !== undefined && next.format !== 'llm_pack_strict' && next.format !== 'fieldpack_with_values') {
      throw new Error('Invalid spin-off format');
    }

    let nextFieldIdListJson = null;
    let nextTemplateHashAtCreate = null;
    if (next.fieldIds !== undefined) {
      const ordered = orderFieldIdsByTemplate(templateAst, next.fieldIds || []);
      if (ordered.length === 0) throw new Error('Spin-off must contain at least one Field ID');
      nextFieldIdListJson = JSON.stringify(ordered);
      nextTemplateHashAtCreate = templateAst.hash;
    }

    await run(
      this.db,
      `UPDATE TemplateSpinOff
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           field_id_list = COALESCE(?, field_id_list),
           format = COALESCE(?, format),
           template_hash_at_create = COALESCE(?, template_hash_at_create),
           updated_at = CURRENT_TIMESTAMP
       WHERE spinoff_id = ?`,
      [
        next.name !== undefined ? String(next.name) : null,
        next.description !== undefined ? String(next.description ?? '') : null,
        nextFieldIdListJson,
        next.format !== undefined ? String(next.format) : null,
        nextTemplateHashAtCreate,
        spinoffId,
      ]
    );
    await this._audit('spinoff.update', null, { spinoffId });
    return { ok: true };
  }

  async deleteSpinOff(spinoffId) {
    const existing = await get(this.db, `SELECT spinoff_id, is_builtin FROM TemplateSpinOff WHERE spinoff_id = ?`, [
      spinoffId,
    ]);
    if (!existing) return { ok: true };
    if (existing.is_builtin) throw new Error('Built-in spin-offs cannot be deleted');
    await run(this.db, `DELETE FROM TemplateSpinOff WHERE spinoff_id = ?`, [spinoffId]);
    await this._audit('spinoff.delete', null, { spinoffId });
    return { ok: true };
  }

  async listCharacters({
    queryText = '',
    tagFilters = [],
    tagExcludeFilters = [],
    tagMode = 'all',
    scopeFlags = null,
    galleryFilters = null,
    includeSystem = false,
    deletedMode = 'active',
  } = {}) {
    const flags = {
      ids: true,
      labels: true,
      values: true,
      tags: true,
      name: true,
      ...(scopeFlags && typeof scopeFlags === 'object' ? scopeFlags : {}),
    };

    const tokens = String(queryText)
      .split(/[\s\p{P}]+/u)
      .map((t) => t.trim())
      .filter(Boolean);

    const clauses = [];
    const params = [];

    if (!includeSystem) clauses.push('(is_system = 0)');

    const deletedModeNorm = (() => {
      const raw = String(deletedMode ?? '').trim().toLowerCase();
      if (raw === 'all') return 'all';
      if (raw === 'deleted' || raw === 'trash') return 'deleted';
      return 'active';
    })();

    if (deletedModeNorm === 'active') clauses.push('(deleted_at IS NULL)');
    else if (deletedModeNorm === 'deleted') clauses.push('(deleted_at IS NOT NULL)');

    const includeTags = (() => {
      const raw = Array.isArray(tagFilters) ? tagFilters : [];
      const out = [];
      const seen = new Set();
      for (const t of raw) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      return out;
    })();

    const excludeTags = (() => {
      const raw = Array.isArray(tagExcludeFilters) ? tagExcludeFilters : [];
      const out = [];
      const seen = new Set();
      for (const t of raw) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      return out;
    })();

    const tagModeNorm = String(tagMode || '').trim().toLowerCase() === 'any' ? 'any' : 'all';

    if (includeTags.length > 0) {
      const placeholders = includeTags.map(() => '?').join(',');
      if (tagModeNorm === 'any') {
        clauses.push(
          `character_id IN (
            SELECT DISTINCT character_id FROM CharacterTag ct
            JOIN Tag t ON t.tag_id = ct.tag_id
            WHERE t.tag_text IN (${placeholders})
          )`
        );
      } else {
        clauses.push(
          `character_id IN (
            SELECT character_id FROM CharacterTag ct
            JOIN Tag t ON t.tag_id = ct.tag_id
            WHERE t.tag_text IN (${placeholders})
            GROUP BY character_id
            HAVING COUNT(DISTINCT t.tag_text) = ${includeTags.length}
          )`
        );
      }
      params.push(...includeTags);
    }

    if (excludeTags.length > 0) {
      const placeholders = excludeTags.map(() => '?').join(',');
      clauses.push(
        `character_id NOT IN (
          SELECT DISTINCT character_id FROM CharacterTag ct
          JOIN Tag t ON t.tag_id = ct.tag_id
          WHERE t.tag_text IN (${placeholders})
        )`
      );
      params.push(...excludeTags);
    }

    if (galleryFilters && typeof galleryFilters === 'object') {
      const gf = galleryFilters;
      const imgWhere = [];
      if (gf.favoriteOnly) imgWhere.push('favorite = 1');

      const clampRating = (x) => Math.max(0, Math.min(5, Number(x) || 0));
      const opRaw = gf.ratingOp != null ? String(gf.ratingOp) : null;
      const op = opRaw && ['=', '<', '<=', '>', '>='].includes(opRaw) ? opRaw : null;
      if (op && gf.ratingValue != null) imgWhere.push(`rating ${op} ?`);
      else if (gf.minRating != null) imgWhere.push('rating >= ?');
      const imgSql =
        imgWhere.length > 0
          ? `character_id IN (SELECT DISTINCT character_id FROM ImageAsset WHERE ${imgWhere.join(' AND ')})`
          : null;
      if (imgSql) clauses.push(imgSql);
      if (op && gf.ratingValue != null) params.push(clampRating(gf.ratingValue));
      else if (gf.minRating != null) params.push(clampRating(gf.minRating));
    }

    const wantsAll = !!flags.all || (flags.ids && flags.labels && flags.values && flags.tags && flags.name);
    const scopeCols = [];
    if (flags.ids) scopeCols.push('search_blob_ids');
    if (flags.labels) scopeCols.push('search_blob_labels');
    if (flags.values) scopeCols.push('search_blob_values');
    if (flags.tags) scopeCols.push('search_blob_tags');
    if (flags.name) scopeCols.push('search_blob_name');

    for (const tok of tokens) {
      if (wantsAll || scopeCols.length === 0) {
        clauses.push('(search_blob LIKE ? COLLATE NOCASE)');
        params.push(`%${tok}%`);
        continue;
      }
      const orParts = scopeCols.map((c) => `(${c} LIKE ? COLLATE NOCASE)`);
      clauses.push(`(${orParts.join(' OR ')})`);
      for (let i = 0; i < scopeCols.length; i++) params.push(`%${tok}%`);
    }

    let baseSql =
      'SELECT character_id, public_id, display_name, template_id, template_version, icon_image_id, icon_focus_x, icon_focus_y, created_at, updated_at, deleted_at FROM Character';
    if (clauses.length > 0) baseSql += ` WHERE ${clauses.join(' AND ')}`;
    baseSql += deletedModeNorm === 'deleted' ? ' ORDER BY deleted_at DESC, updated_at DESC' : ' ORDER BY updated_at DESC';

    const rows = await all(this.db, baseSql, params);
    return rows.map((r) => ({
      id: r.character_id,
      publicId: r.public_id ?? null,
      displayName: r.display_name,
      templateId: r.template_id,
      templateVersion: r.template_version,
      iconImageId: r.icon_image_id ?? null,
      iconFocusX: Number.isFinite(Number(r.icon_focus_x)) ? Number(r.icon_focus_x) : 0.5,
      iconFocusY: Number.isFinite(Number(r.icon_focus_y)) ? Number(r.icon_focus_y) : 0.5,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
      deletedAt: r.deleted_at ?? null,
    }));
  }

  async listAllTags() {
    const seen = new Set();

    const addTag = (t) => {
      const s = String(t ?? '').trim();
      if (!s) return;
      if (this._isSystemTag(s)) return;
      seen.add(s);
    };

    const addFromJson = (raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        for (const t of parsed) addTag(t);
      } catch {
        // Ignore invalid rows deterministically.
      }
    };

    // Character tag dictionary
    const rows = await all(this.db, 'SELECT tag_text FROM Tag');
    for (const r of rows) addTag(r.tag_text);

    // Image tags
    const imageRows = await all(this.db, 'SELECT tags_json FROM ImageAsset');
    for (const r of imageRows) addFromJson(r.tags_json);

    // Doc tags
    for (const table of ['NoteDoc', 'StoryDoc', 'MoodboardDoc']) {
      try {
        const docRows = await all(this.db, `SELECT tags_json FROM ${table}`);
        for (const r of docRows) addFromJson(r.tags_json);
      } catch {
        // Older DBs may not have doc tables yet.
      }
    }

    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  async listTagStats() {
    const statsByTag = new Map();

    const touch = (tagText) => {
      const t = String(tagText ?? '').trim();
      if (!t) return null;
      if (this._isSystemTag(t)) return null;
      if (!statsByTag.has(t)) {
        statsByTag.set(t, {
          tag: t,
          imageCount: 0,
          docCount: 0,
          docNotesCount: 0,
          docStoriesCount: 0,
          docMoodboardCount: 0,
          characterCount: 0,
        });
      }
      return statsByTag.get(t);
    };

    const parseJsonArray = (raw) => {
      try {
        const parsed = JSON.parse(raw ?? '[]');
        return Array.isArray(parsed) ? parsed.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
      } catch {
        return [];
      }
    };

    // Seed from Tag dictionary (characters).
    const tagRows = await all(this.db, 'SELECT tag_text FROM Tag');
    for (const r of tagRows) touch(r.tag_text);

    // Image tags: count per image (de-duped per asset).
    const imageRows = await all(this.db, 'SELECT image_id, tags_json FROM ImageAsset');
    for (const r of imageRows) {
      const unique = new Set(parseJsonArray(r.tags_json));
      for (const t of unique) {
        const s = touch(t);
        if (s) s.imageCount += 1;
      }
    }

    // Doc tags: count per doc (de-duped per doc).
    const docTables = [
      { docType: 'notes', table: 'NoteDoc', col: 'docNotesCount' },
      { docType: 'stories', table: 'StoryDoc', col: 'docStoriesCount' },
      { docType: 'moodboard', table: 'MoodboardDoc', col: 'docMoodboardCount' },
    ];
    for (const dt of docTables) {
      try {
        const docRows = await all(this.db, `SELECT doc_id, tags_json FROM ${dt.table}`);
        for (const r of docRows) {
          const unique = new Set(parseJsonArray(r.tags_json));
          for (const t of unique) {
            const s = touch(t);
            if (!s) continue;
            s.docCount += 1;
            s[dt.col] += 1;
          }
        }
      } catch {
        // Older DBs may not have doc tables yet.
      }
    }

    // Character tags (manual + derived): count per character (de-duped per character+tag).
    const charRows = await all(
      this.db,
      `SELECT t.tag_text AS tagText, COUNT(DISTINCT ct.character_id) AS c
       FROM CharacterTag ct
       JOIN Tag t ON t.tag_id = ct.tag_id
       GROUP BY t.tag_text`,
      []
    );
    for (const r of charRows) {
      const s = touch(r.tagText);
      if (s) s.characterCount = Number(r.c) || 0;
    }

    const list = Array.from(statsByTag.values());
    list.sort((a, b) => {
      const ta = (a.imageCount || 0) + (a.docCount || 0) + (a.characterCount || 0);
      const tb = (b.imageCount || 0) + (b.docCount || 0) + (b.characterCount || 0);
      if (tb !== ta) return tb - ta;
      return String(a.tag).localeCompare(String(b.tag), undefined, { sensitivity: 'base' });
    });
    return list;
  }

  async mergeTags({ fromTags, toTag } = {}) {
    const to = String(toTag ?? '').trim();
    if (!to) throw new Error('toTag is required');
    if (this._isSystemTag(to)) throw new Error('System tags cannot be merged/renamed');

    const rawFrom = Array.isArray(fromTags) ? fromTags : [fromTags];
    const fromList = [];
    const seen = new Set();
    for (const f of rawFrom) {
      const s = String(f ?? '').trim();
      if (!s) continue;
      if (this._isSystemTag(s)) throw new Error('System tags cannot be merged/renamed');
      if (s === to) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      fromList.push(s);
    }
    if (fromList.length === 0) return { ok: true, merged: 0 };

    const fromSet = new Set(fromList);

    const mergeJsonArray = (raw) => {
      const arr = (() => {
        try {
          const parsed = JSON.parse(raw ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return null;
        }
      })();
      if (!arr) return { changed: false, nextJson: raw };

      const out = [];
      const seenOut = new Set();
      let changed = false;
      for (const t of arr) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        const next = fromSet.has(s) ? to : s;
        if (next !== s) changed = true;
        if (seenOut.has(next)) {
          if (next === s) changed = true;
          continue;
        }
        seenOut.add(next);
        out.push(next);
      }
      return { changed, nextJson: JSON.stringify(out) };
    };

    const counts = { images: 0, docs: 0, tagTemplates: 0, savedSearches: 0, tagRules: 0, characters: 0 };

    const placeholders = fromList.map(() => '?').join(',');
    await run(this.db, 'BEGIN');
    try {
      // Update ImageAsset tags_json.
      const imageRows = await all(this.db, `SELECT image_id, tags_json FROM ImageAsset`);
      for (const r of imageRows) {
        const { changed, nextJson } = mergeJsonArray(r.tags_json);
        if (!changed) continue;
        await run(this.db, `UPDATE ImageAsset SET tags_json = ? WHERE image_id = ?`, [nextJson, r.image_id]);
        counts.images += 1;
      }

      // Update Doc tags_json.
      for (const table of ['NoteDoc', 'StoryDoc', 'MoodboardDoc']) {
        try {
          const docRows = await all(this.db, `SELECT doc_id, tags_json FROM ${table}`);
          for (const r of docRows) {
            const { changed, nextJson } = mergeJsonArray(r.tags_json);
            if (!changed) continue;
            await run(this.db, `UPDATE ${table} SET tags_json = ? WHERE doc_id = ?`, [nextJson, r.doc_id]);
            counts.docs += 1;
          }
        } catch {
          // ignore
        }
      }

      // Update TagTemplate tags_json (all versions).
      try {
        const tplRows = await all(this.db, `SELECT template_name, version, tags_json FROM TagTemplate`);
        for (const r of tplRows) {
          const { changed, nextJson } = mergeJsonArray(r.tags_json);
          if (!changed) continue;
          await run(this.db, `UPDATE TagTemplate SET tags_json = ? WHERE template_name = ? AND version = ?`, [
            nextJson,
            r.template_name,
            r.version,
          ]);
          counts.tagTemplates += 1;
        }
      } catch {
        // ignore
      }

      // Update SavedSearch tag filters.
      try {
        const ssRows = await all(this.db, `SELECT search_id, tag_filters_json, tag_exclude_json FROM SavedSearch`);
        for (const r of ssRows) {
          const inc = mergeJsonArray(r.tag_filters_json);
          const exc = mergeJsonArray(r.tag_exclude_json);
          if (!inc.changed && !exc.changed) continue;
          await run(
            this.db,
            `UPDATE SavedSearch
             SET tag_filters_json = COALESCE(?, tag_filters_json),
                 tag_exclude_json = COALESCE(?, tag_exclude_json),
                 updated_at = CURRENT_TIMESTAMP
             WHERE search_id = ?`,
            [inc.changed ? inc.nextJson : null, exc.changed ? exc.nextJson : null, r.search_id]
          );
          counts.savedSearches += 1;
        }
      } catch {
        // ignore
      }

      // Update TagRule emitted tags (so derived tags stay consistent after merge).
      const toId = await this._ensureTag(to);
      const tagRuleRes = await run(
        this.db,
        `UPDATE TagRule SET emit_tag = ?, updated_at = CURRENT_TIMESTAMP WHERE emit_tag IN (${placeholders})`,
        [to, ...fromList]
      );
      counts.tagRules = Number(tagRuleRes?.changes) || 0;

      // Merge CharacterTag entries (manual + derived).
      const fromTagRows = await all(this.db, `SELECT tag_id, tag_text FROM Tag WHERE tag_text IN (${placeholders})`, fromList);
      const fromIds = fromTagRows.map((r) => String(r.tag_id || '')).filter(Boolean);
      if (fromIds.length > 0) {
        const placeholdersIds = fromIds.map(() => '?').join(',');
        const affected = await all(
          this.db,
          `SELECT DISTINCT character_id FROM CharacterTag WHERE tag_id IN (${placeholdersIds})`,
          fromIds
        );
        const affectedIds = affected.map((r) => String(r.character_id || '')).filter(Boolean);

        for (const fromId of fromIds) {
          await run(
            this.db,
            `INSERT OR IGNORE INTO CharacterTag(character_id, tag_id, tag_type)
             SELECT character_id, ?, tag_type FROM CharacterTag WHERE tag_id = ?`,
            [toId, fromId]
          );
          await run(this.db, `DELETE FROM CharacterTag WHERE tag_id = ?`, [fromId]);
        }

        await run(this.db, `DELETE FROM Tag WHERE tag_id IN (${placeholdersIds})`, fromIds);

        for (const characterId of affectedIds) {
          const character = await this.getCharacter(characterId);
          if (!character) continue;
          const templateAst = await this.getTemplateAst(character.templateId);
          await this._updateSearchBlob(templateAst, characterId, character.displayName, character.valuesById);
        }
        counts.characters = affectedIds.length;
      }

      await this._audit('tag.merge', null, { fromTags: fromList, toTag: to, counts });
      await run(this.db, 'COMMIT');
      return { ok: true, fromTags: fromList, toTag: to, counts };
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }
  }

  async renameTag({ fromTag, toTag } = {}) {
    return this.mergeTags({ fromTags: [fromTag], toTag });
  }

  async listFieldValueSuggestions({ fieldId, limit = 60 } = {}) {
    const fid = String(fieldId ?? '').trim();
    if (!fid) return [];

    const limNum = Number(limit);
    const lim = Number.isFinite(limNum) ? Math.max(0, Math.min(200, Math.floor(limNum))) : 60;
    if (lim <= 0) return [];

    const rows = await all(
      this.db,
      `SELECT value_text AS valueText, MAX(updated_at) AS updatedAt
       FROM FieldValue
       WHERE field_id = ?
         AND value_text IS NOT NULL
         AND LENGTH(TRIM(value_text)) > 0
       GROUP BY value_text
       ORDER BY updatedAt DESC
       LIMIT ?`,
      [fid, lim]
    );

    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const raw = String(r.valueText ?? '');
      const v = raw.trim();
      if (!v) continue;
      if (v.includes('\n') || v.includes('\r')) continue;
      if (v.length > 240) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  async listGlobalCarouselImages({ preferFrontpage = true } = {}) {
    const rows = await all(
      this.db,
      `SELECT image_id, character_id, favorite, rating, notes, tags_json, source_url, source_note, added_at
       FROM ImageAsset
       ORDER BY favorite DESC, rating DESC, added_at DESC`
    );

    const parsed = rows.map((r) => ({
      id: r.image_id,
      characterId: r.character_id,
      favorite: !!r.favorite,
      rating: Number(r.rating) || 0,
      notes: r.notes ?? '',
      sourceUrl: r.source_url ?? null,
      sourceNote: r.source_note ?? '',
      tags: (() => {
        try {
          const raw = r.tags_json ?? '[]';
          const t = JSON.parse(raw);
          return Array.isArray(t) ? t.map((x) => String(x)) : [];
        } catch {
          return [];
        }
      })(),
      addedAt: r.added_at,
    }));

    const hasFrontpage = parsed.some((img) => img.tags.includes('frontpage'));
    const chosenTag = preferFrontpage && hasFrontpage ? 'frontpage' : 'carousel';

    return parsed.filter((img) => img.tags.includes(chosenTag));
  }

  async getMediaDiagnostics({ topN = 10 } = {}) {
    const paths = this.getPaths();

    const characterRows = await all(this.db, 'SELECT character_id FROM Character', []);
    const characterIds = characterRows.map((r) => String(r.character_id || '')).filter(Boolean);

    const imageRows = await all(
      this.db,
      `SELECT image_id, character_id, relative_path, storage_mode, source_path
       FROM ImageAsset`,
      []
    );

    let originalPresent = 0;
    let originalMissing = 0;
    let thumbPresent = 0;
    let thumbMissing = 0;

    const byCharacter = new Map();

    for (const r of imageRows) {
      const characterId = String(r.character_id || '');
      const rel = String(r.relative_path || '');
      const mode = String(r.storage_mode || 'copy');

      const cPaths = this.getCharacterPaths(characterId);
      const origAbs =
        mode === 'reference' && r.source_path
          ? String(r.source_path)
          : path.join(cPaths.base, rel.replaceAll('/', path.sep));
      const hasOriginal = !!origAbs && fs.existsSync(origAbs);
      if (hasOriginal) originalPresent += 1;
      else originalMissing += 1;

      const fileName = path.basename(rel.replaceAll('/', path.sep));
      const stem = fileName.replace(path.extname(fileName), '');
      const thumbAbs = stem ? path.join(cPaths.imagesThumbDir, `${stem}.png`) : null;
      const hasThumb = !!thumbAbs && fs.existsSync(thumbAbs);
      if (hasThumb) thumbPresent += 1;
      else thumbMissing += 1;

      const existing = byCharacter.get(characterId) ?? {
        characterId,
        totalImages: 0,
        missingOriginal: 0,
        missingThumb: 0,
        hasCharacterFolder: fs.existsSync(cPaths.base),
      };
      existing.totalImages += 1;
      if (!hasOriginal) existing.missingOriginal += 1;
      if (!hasThumb) existing.missingThumb += 1;
      existing.hasCharacterFolder = existing.hasCharacterFolder || fs.existsSync(cPaths.base);
      byCharacter.set(characterId, existing);
    }

    const missingCharacterFolders = [];
    for (const characterId of characterIds) {
      const base = path.join(paths.charactersDir, characterId);
      if (!fs.existsSync(base)) missingCharacterFolders.push(characterId);
    }

    const topMissingByCharacter = Array.from(byCharacter.values())
      .filter((c) => (Number(c.missingOriginal) || 0) > 0)
      .sort((a, b) => (b.missingOriginal || 0) - (a.missingOriginal || 0))
      .slice(0, Math.max(0, Number(topN) || 0));

    return {
      libraryRoot: this.libraryRoot,
      characterCount: characterIds.length,
      imageCount: imageRows.length,
      originals: { present: originalPresent, missing: originalMissing },
      thumbs: { present: thumbPresent, missing: thumbMissing },
      missingCharacterFolders,
      topMissingByCharacter,
    };
  }

  async listDuplicateGroups({ minCount = 2, limitGroups = 200, maxPerGroup = 40 } = {}) {
    const min = Math.max(2, Math.min(1000, Number(minCount) || 2));
    const lim = Math.max(1, Math.min(2000, Number(limitGroups) || 200));
    const per = Math.max(1, Math.min(200, Number(maxPerGroup) || 40));

    const groups = await all(
      this.db,
      `SELECT file_hash, COUNT(*) AS c
       FROM ImageAsset
       GROUP BY file_hash
       HAVING COUNT(*) >= ?
       ORDER BY c DESC
       LIMIT ?`,
      [min, lim]
    );

    const out = [];
    for (const g of groups) {
      const fileHash = String(g.file_hash || '');
      if (!fileHash) continue;

      const rows = await all(
        this.db,
        `SELECT ia.image_id, ia.character_id, c.display_name, ia.relative_path, ia.storage_mode, ia.source_path,
                ia.favorite, ia.rating, ia.tags_json, ia.added_at
         FROM ImageAsset ia
         JOIN Character c ON c.character_id = ia.character_id
         WHERE ia.file_hash = ?
         ORDER BY ia.favorite DESC, ia.rating DESC, ia.added_at DESC
         LIMIT ?`,
        [fileHash, per]
      );

      let maxSize = 0;
      let totalCopyBytes = 0;
      const images = [];

      for (const r of rows) {
        const imageId = String(r.image_id || '');
        const characterId = String(r.character_id || '');
        const relativePath = String(r.relative_path || '');
        const storageMode = String(r.storage_mode || 'copy');
        const sourcePath = r.source_path != null ? String(r.source_path) : null;

        const abs =
          storageMode === 'reference' && sourcePath
            ? sourcePath
            : path.join(this.getCharacterPaths(characterId).base, relativePath.replaceAll('/', path.sep));

        let sizeBytes = null;
        let isMissing = true;
        try {
          const st = fs.statSync(abs);
          if (st && st.isFile()) {
            sizeBytes = Number(st.size) || 0;
            isMissing = false;
          }
        } catch {
          // ignore
        }

        if (typeof sizeBytes === 'number' && sizeBytes > maxSize) maxSize = sizeBytes;
        if (storageMode === 'copy' && typeof sizeBytes === 'number' && sizeBytes > 0) totalCopyBytes += sizeBytes;

        let tags = [];
        try {
          const parsed = JSON.parse(r.tags_json ?? '[]');
          tags = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
        } catch {
          tags = [];
        }

        images.push({
          imageId,
          characterId,
          characterName: String(r.display_name ?? ''),
          relativePath,
          storageMode,
          sourcePath,
          favorite: !!r.favorite,
          rating: Number(r.rating) || 0,
          tags,
          addedAt: String(r.added_at ?? ''),
          absPath: abs,
          sizeBytes,
          isMissing,
        });
      }

      const count = Number(g.c) || images.length;
      const potentialSavingsBytes = maxSize > 0 ? Math.max(0, totalCopyBytes - maxSize) : 0;

      out.push({
        fileHash,
        count,
        sizeBytes: maxSize,
        totalCopyBytes,
        potentialSavingsBytes,
        images,
        truncated: images.length < count,
      });
    }

    return out;
  }

  _cleanTags(tags) {
    const cleaned = [];
    const seen = new Set();
    for (const t of Array.isArray(tags) ? tags : []) {
      const s = String(t ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      cleaned.push(s);
    }
    return cleaned;
  }

  _isSystemTag(tagText) {
    const s = String(tagText ?? '');
    return s.startsWith('__ckc_');
  }

  _docTypeTag(docType) {
    return `__ckc_docType:${String(docType || '').toLowerCase()}`;
  }

  _docTagMeta(docType, tagText) {
    const dt = String(docType || '').toLowerCase();
    const tt = String(tagText ?? '');
    return `__ckc_docTag:${dt}:${tt}`;
  }

  _docTableForType(docType) {
    const t = String(docType || '').toLowerCase();
    if (t === 'stories' || t === 'story') return { type: 'stories', table: 'StoryDoc', contentCol: 'body_text' };
    if (t === 'moodboard' || t === 'moodboards') return { type: 'moodboard', table: 'MoodboardDoc', contentCol: 'board_json' };
    return { type: 'notes', table: 'NoteDoc', contentCol: 'body_text' };
  }

  async listDocs({ docType = 'notes', queryText = '', tagFilters = [] } = {}) {
    const { type, table } = this._docTableForType(docType);
    const rows = await all(
      this.db,
      `SELECT doc_id, title, tags_json, created_at, updated_at
       FROM ${table}
       ORDER BY updated_at DESC`
    );

    const q = String(queryText || '').trim().toLowerCase();
    const qTokens = q ? q.split(/[\s\p{P}]+/u).map((t) => t.trim()).filter(Boolean) : [];
    const wantsTags = Array.isArray(tagFilters) ? tagFilters.map((t) => String(t).trim()).filter(Boolean) : [];

    const filtered = rows.filter((r) => {
      const title = String(r.title || '');
      if (qTokens.length > 0) {
        const hay = title.toLowerCase();
        if (!qTokens.every((tok) => hay.includes(tok))) return false;
      }

      if (wantsTags.length > 0) {
        let tags = [];
        try {
          tags = JSON.parse(r.tags_json ?? '[]');
          if (!Array.isArray(tags)) tags = [];
        } catch {
          tags = [];
        }
        const tagSet = new Set(tags.map((x) => String(x)));
        if (!wantsTags.every((t) => tagSet.has(t))) return false;
      }

      return true;
    });

    return filtered.map((r) => ({
      id: r.doc_id,
      docType: type,
      title: r.title,
      tags: (() => {
        try {
          const parsed = JSON.parse(r.tags_json ?? '[]');
          return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter((t) => !this._isSystemTag(t)) : [];
        } catch {
          return [];
        }
      })(),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getDoc({ docType = 'notes', docId }) {
    if (!docId) throw new Error('docId is required');
    const { type, table, contentCol } = this._docTableForType(docType);
    const row = await get(
      this.db,
      `SELECT doc_id, title, ${contentCol} AS content, tags_json, created_at, updated_at
       FROM ${table}
       WHERE doc_id = ?`,
      [docId]
    );
    if (!row) return null;

    let tags = [];
    try {
      const parsed = JSON.parse(row.tags_json ?? '[]');
      tags = Array.isArray(parsed) ? parsed.map((x) => String(x)).filter((t) => !this._isSystemTag(t)) : [];
    } catch {
      tags = [];
    }

    return {
      id: row.doc_id,
      docType: type,
      title: row.title,
      content: row.content ?? '',
      tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertDoc({ docType = 'notes', docId = null, title = 'Untitled', content = '', tags = [] } = {}) {
    const { type, table, contentCol } = this._docTableForType(docType);
    const prefix = type === 'stories' ? 'story_' : type === 'moodboard' ? 'mood_' : 'note_';
    const id = docId ? String(docId) : randomId(prefix);

    const cleanedTitle = String(title ?? '').trim() || 'Untitled';
    const userTags = this._cleanTags(tags).filter((t) => !this._isSystemTag(t));
    const metaTags = [this._docTypeTag(type), ...userTags.map((t) => this._docTagMeta(type, t))];
    const cleanedTags = this._cleanTags([...userTags, ...metaTags]);

    await run(
      this.db,
      `INSERT INTO ${table}(doc_id, title, ${contentCol}, tags_json)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(doc_id) DO UPDATE SET
         title = excluded.title,
         ${contentCol} = excluded.${contentCol},
         tags_json = excluded.tags_json,
         updated_at = CURRENT_TIMESTAMP`,
      [id, cleanedTitle, String(content ?? ''), JSON.stringify(cleanedTags)]
    );

    await this._audit('doc.upsert', null, { docType: type, docId: id });
    try {
      let linkText = String(content ?? '');
      if (type === 'stories') {
        try {
          const sb = await get(this.db, `SELECT board_json FROM StoryBoard WHERE doc_id = ?`, [id]);
          if (sb?.board_json) {
            const parsed = JSON.parse(sb.board_json ?? '{}');
            const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
            const cardText = cards.map((c) => String(c?.text ?? '')).filter((t) => t.trim().length > 0).join('\n\n');
            if (cardText) linkText = `${linkText}\n\n${cardText}`;
          }
        } catch {
          // ignore
        }
      }
      await this._reindexLinksForSource({ sourceType: type, sourceId: id, text: linkText });
    } catch (err) {
      await this._audit('linkIndex.reindexFailed', null, {
        sourceType: type,
        sourceId: id,
        message: String(err?.message || err || 'Unknown error'),
      });
    }

    // Best-effort: keep FTS tables in sync for doc types that need enrichment beyond triggers.
    try {
      if (type === 'moodboard') {
        await this._refreshMoodboardFtsForDoc({ docId: id, title: cleanedTitle, boardJson: String(content ?? '') });
      } else if (type === 'stories') {
        await this._refreshStoryFtsForDoc({
          docId: id,
          title: cleanedTitle,
          bodyText: String(content ?? ''),
          tagsJson: JSON.stringify(cleanedTags),
        });
      }
    } catch (err) {
      await this._audit('fts.refreshFailed', null, {
        docType: type,
        docId: id,
        message: String(err?.message || err || 'Unknown error'),
      });
    }

    return { ok: true, docId: id, docType: type };
  }

  async deleteDoc({ docType = 'notes', docId }) {
    if (!docId) throw new Error('docId is required');
    const { type, table } = this._docTableForType(docType);
    await run(this.db, `DELETE FROM ${table} WHERE doc_id = ?`, [docId]);
    await this._audit('doc.delete', null, { docType: type, docId });
    try {
      await run(this.db, `DELETE FROM LinkIndex WHERE source_type = ? AND source_id = ?`, [type, docId]);
      await run(this.db, `DELETE FROM LinkIndex WHERE target_type = ? AND target_id = ?`, [docTargetType(type), docId]);
    } catch {
      // Best-effort cleanup; user text remains untouched.
    }

    if (type === 'moodboard') {
      try {
        await run(this.db, `DELETE FROM moodboard_fts WHERE doc_id = ?`, [docId]);
      } catch {
        // ignore
      }
    }
    return { ok: true };
  }

  async getStoryBoard({ docId } = {}) {
    const id = String(docId ?? '').trim();
    if (!id) throw new Error('docId is required');

    const normalize = (raw) => {
      const obj = raw && typeof raw === 'object' ? raw : {};
      const cardsRaw = Array.isArray(obj.cards) ? obj.cards : [];
      const cards = [];
      for (const c of cardsRaw) {
        const card = c && typeof c === 'object' ? c : {};
        const text = String(card.text ?? '');
        if (!text.trim() && !String(card.id ?? '').trim()) continue;
        cards.push({
          id: String(card.id ?? '').trim() || randomId('card_'),
          text,
        });
      }
      return { version: 1, cards };
    };

    const row = await get(this.db, `SELECT board_json FROM StoryBoard WHERE doc_id = ?`, [id]);
    if (!row) return { ok: true, docId: id, board: { version: 1, cards: [] } };

    try {
      const parsed = JSON.parse(row.board_json ?? '{}');
      return { ok: true, docId: id, board: normalize(parsed) };
    } catch {
      return { ok: true, docId: id, board: { version: 1, cards: [] } };
    }
  }

  async setStoryBoard({ docId, board } = {}) {
    const id = String(docId ?? '').trim();
    if (!id) throw new Error('docId is required');

    const normalize = (raw) => {
      const obj = raw && typeof raw === 'object' ? raw : {};
      const cardsRaw = Array.isArray(obj.cards) ? obj.cards : [];
      const cards = [];
      for (const c of cardsRaw) {
        const card = c && typeof c === 'object' ? c : {};
        const text = String(card.text ?? '');
        if (!text.trim() && !String(card.id ?? '').trim()) continue;
        cards.push({
          id: String(card.id ?? '').trim() || randomId('card_'),
          text,
        });
      }
      return { version: 1, cards };
    };

    const cleaned = normalize(board);
    await run(
      this.db,
      `INSERT INTO StoryBoard(doc_id, board_json, updated_at)
       VALUES(?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(doc_id) DO UPDATE SET
         board_json = excluded.board_json,
         updated_at = CURRENT_TIMESTAMP`,
      [id, JSON.stringify(cleaned)]
    );
    await this._audit('story.setBoard', null, { docId: id, cards: cleaned.cards.length });

    try {
      const story = await get(this.db, `SELECT body_text FROM StoryDoc WHERE doc_id = ?`, [id]);
      const baseText = String(story?.body_text ?? '');
      const cardText = cleaned.cards
        .map((c) => String(c?.text ?? ''))
        .filter((t) => t.trim().length > 0)
        .join('\n\n');
      const linkText = cardText ? `${baseText}\n\n${cardText}` : baseText;
      await this._reindexLinksForSource({ sourceType: 'stories', sourceId: id, text: linkText });
    } catch (err) {
      await this._audit('linkIndex.reindexFailed', null, {
        sourceType: 'stories',
        sourceId: id,
        message: String(err?.message || err || 'Unknown error'),
      });
    }

    // Best-effort: ensure story FTS includes board card text.
    try {
      const storyRow = await get(this.db, `SELECT title, body_text, tags_json FROM StoryDoc WHERE doc_id = ?`, [id]);
      await this._refreshStoryFtsForDoc({
        docId: id,
        title: storyRow?.title ?? '',
        bodyText: storyRow?.body_text ?? '',
        tagsJson: storyRow?.tags_json ?? '',
      });
    } catch (err) {
      await this._audit('fts.refreshFailed', null, {
        docType: 'stories',
        docId: id,
        message: String(err?.message || err || 'Unknown error'),
      });
    }

    return { ok: true };
  }

  async resolveLinkToken(token) {
    return this._resolveLinkTokenCandidates(token);
  }

  async listBacklinks({ targetType, targetId, limit = 200 } = {}) {
    const tt = String(targetType ?? '').trim();
    const tid = String(targetId ?? '').trim();
    if (!tt || !tid) return [];
    const lim = Math.max(1, Math.min(5000, Number(limit) || 200));

    const rows = await all(
      this.db,
      `SELECT source_type, source_id, raw_text, created_at
       FROM LinkIndex
       WHERE target_type = ? AND target_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tt, tid, lim]
    );

    const out = [];
    for (const r of rows) {
      const sourceType = String(r.source_type || '');
      const sourceId = String(r.source_id || '');
      let label = `${sourceType}:${sourceId}`;

      if (sourceType === 'sheet') {
        const c = await get(this.db, `SELECT display_name FROM Character WHERE character_id = ?`, [sourceId]);
        label = c?.display_name ? `Sheet: ${String(c.display_name)}` : label;
      } else if (sourceType === 'notes' || sourceType === 'stories' || sourceType === 'moodboard') {
        try {
          const { table } = this._docTableForType(sourceType);
          const d = await get(this.db, `SELECT title FROM ${table} WHERE doc_id = ?`, [sourceId]);
          label = d?.title ? `${sourceType}: ${String(d.title)}` : label;
        } catch {
          // ignore
        }
      }

      out.push({
        sourceType,
        sourceId,
        label,
        rawText: String(r.raw_text ?? ''),
        createdAt: r.created_at,
      });
    }
    return out;
  }

  async _resolveLinkTokenCandidates(token) {
    const raw = String(token ?? '').trim();
    if (!raw) return [];

    const m = raw.match(/^([A-Za-z]+):(.*)$/);
    const known = new Set([
      'doc',
      'notes',
      'note',
      'stories',
      'story',
      'moodboard',
      'mood',
      'img',
      'image',
      'char',
      'character',
      'id',
      'tag',
      'imgtag',
    ]);

    let prefix = null;
    let rest = raw;
    if (m) {
      const p = String(m[1] ?? '').toLowerCase();
      if (known.has(p)) {
        prefix = p;
        rest = String(m[2] ?? '').trim();
      }
    }

    const findCharactersByNameOrId = async (value) => {
      const v = String(value ?? '').trim();
      if (!v) return [];
      const byId = await all(this.db, `SELECT character_id, display_name FROM Character WHERE character_id = ?`, [v]);
      const byPublicId = await all(this.db, `SELECT character_id, display_name FROM Character WHERE public_id = ?`, [v]);
      const byName = await all(this.db, `SELECT character_id, display_name FROM Character WHERE display_name = ? COLLATE NOCASE`, [v]);
      const merged = [...byId, ...byPublicId, ...byName].filter(Boolean);
      const seen = new Set();
      const out = [];
      for (const r of merged) {
        const id = String(r.character_id);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          targetType: 'character',
          targetId: id,
          label: String(r.display_name ?? id),
        });
      }
      return out;
    };

    const findDocsByIdOrTitle = async (docType, value) => {
      const v = String(value ?? '').trim();
      if (!v) return [];
      const { type, table } = this._docTableForType(docType);

      const rows = [];
      const byId = await get(this.db, `SELECT doc_id, title FROM ${table} WHERE doc_id = ?`, [v]);
      if (byId) rows.push(byId);
      const byTitle = await all(
        this.db,
        `SELECT doc_id, title
         FROM ${table}
         WHERE title = ? COLLATE NOCASE
         ORDER BY updated_at DESC
         LIMIT 25`,
        [v]
      );
      for (const r of byTitle) rows.push(r);

      const seen = new Set();
      const out = [];
      for (const r of rows) {
        if (!r) continue;
        const id = String(r.doc_id);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          targetType: docTargetType(type),
          targetId: id,
          docType: type,
          label: `${type}: ${String(r.title ?? id)}`,
        });
      }
      return out;
    };

    const findDocsAcrossAllTypes = async (value) => {
      const v = String(value ?? '').trim();
      if (!v) return [];
      const out = [];
      out.push(...(await findDocsByIdOrTitle('notes', v)));
      out.push(...(await findDocsByIdOrTitle('stories', v)));
      out.push(...(await findDocsByIdOrTitle('moodboard', v)));
      // De-dupe by (targetType,targetId)
      const seen = new Set();
      return out.filter((c) => {
        const k = `${c.targetType}::${c.targetId}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    if (prefix === 'img' || prefix === 'image') {
      const imageId = String(rest ?? '').trim();
      if (!imageId) return [];
      const row = await get(this.db, `SELECT image_id, character_id FROM ImageAsset WHERE image_id = ?`, [imageId]);
      if (!row) return [];
      return [
        {
          targetType: 'image',
          targetId: String(row.image_id),
          characterId: String(row.character_id),
          label: `image:${String(row.image_id)}`,
        },
      ];
    }

    if (prefix === 'tag' || prefix === 'imgtag') {
      const tag = String(rest ?? '').trim();
      if (!tag) return [];
      return [{ targetType: 'tag', targetId: tag, label: `tag:${tag}` }];
    }

    if (prefix === 'doc') return findDocsAcrossAllTypes(rest);
    if (prefix === 'notes' || prefix === 'note') return findDocsByIdOrTitle('notes', rest);
    if (prefix === 'stories' || prefix === 'story') return findDocsByIdOrTitle('stories', rest);
    if (prefix === 'moodboard' || prefix === 'mood') return findDocsByIdOrTitle('moodboard', rest);

    if (prefix === 'char' || prefix === 'character' || prefix === 'id') return findCharactersByNameOrId(rest);

    // Default: treat as character name/id (wikilink).
    return findCharactersByNameOrId(rest);
  }

  async _reindexLinksForSource({ sourceType, sourceId, text } = {}) {
    const st = String(sourceType ?? '').trim().toLowerCase();
    const sid = String(sourceId ?? '').trim();
    if (!st || !sid) return { ok: false };

    const tokens = extractBracketLinks(text);
    await run(this.db, `DELETE FROM LinkIndex WHERE source_type = ? AND source_id = ?`, [st, sid]);

    for (const tok of tokens) {
      const candidates = await this._resolveLinkTokenCandidates(tok);
      if (!Array.isArray(candidates) || candidates.length !== 1) continue;
      const c = candidates[0];
      const tt = String(c.targetType ?? '').trim();
      const tid = String(c.targetId ?? '').trim();
      if (!tt || !tid) continue;
      await run(
        this.db,
        `INSERT OR IGNORE INTO LinkIndex(source_type, source_id, target_type, target_id, raw_text)
         VALUES(?, ?, ?, ?, ?)`,
        [st, sid, tt, tid, String(tok)]
      );
    }

    return { ok: true, tokenCount: tokens.length };
  }

  async listSavedSearches() {
    const rows = await all(
      this.db,
      `SELECT search_id, name, query_text, scope_flags_json, tag_filters_json, tag_exclude_json, tag_mode, gallery_filters_json, created_at, updated_at, is_builtin
       FROM SavedSearch
       ORDER BY name COLLATE NOCASE`
    );
    return rows.map((r) => ({
      id: r.search_id,
      name: r.name,
      queryText: r.query_text || '',
      scopeFlags: (() => {
        try {
          return JSON.parse(r.scope_flags_json || '{}') || {};
        } catch {
          return {};
        }
      })(),
      tagFilters: (() => {
        try {
          const parsed = JSON.parse(r.tag_filters_json || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      tagExcludeFilters: (() => {
        try {
          const parsed = JSON.parse(r.tag_exclude_json || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      tagMode: (() => {
        const raw = r.tag_mode != null ? String(r.tag_mode) : 'all';
        return raw === 'any' ? 'any' : 'all';
      })(),
      galleryFilters: (() => {
        try {
          return JSON.parse(r.gallery_filters_json || '{}') || {};
        } catch {
          return {};
        }
      })(),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isBuiltin: !!r.is_builtin,
    }));
  }

  async createSavedSearch({
    name,
    queryText = '',
    scopeFlags = {},
    tagFilters = [],
    tagExcludeFilters = [],
    tagMode = 'all',
    galleryFilters = {},
  }) {
    const searchId = randomId('ss_');
    await run(
      this.db,
      `INSERT INTO SavedSearch(search_id, name, query_text, scope_flags_json, tag_filters_json, tag_exclude_json, tag_mode, gallery_filters_json)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        searchId,
        String(name),
        String(queryText || ''),
        JSON.stringify(scopeFlags || {}),
        JSON.stringify(tagFilters || []),
        JSON.stringify(tagExcludeFilters || []),
        String(tagMode === 'any' ? 'any' : 'all'),
        JSON.stringify(galleryFilters || {}),
      ]
    );
    await this._audit('savedSearch.create', null, { name });
    return searchId;
  }

  async updateSavedSearch({ searchId, name, queryText, scopeFlags, tagFilters, tagExcludeFilters, tagMode, galleryFilters }) {
    const existing = await get(this.db, 'SELECT search_id FROM SavedSearch WHERE search_id = ?', [searchId]);
    if (!existing) throw new Error('Saved search not found');
    await run(
      this.db,
      `UPDATE SavedSearch
       SET name = COALESCE(?, name),
           query_text = COALESCE(?, query_text),
           scope_flags_json = COALESCE(?, scope_flags_json),
           tag_filters_json = COALESCE(?, tag_filters_json),
           tag_exclude_json = COALESCE(?, tag_exclude_json),
           tag_mode = COALESCE(?, tag_mode),
           gallery_filters_json = COALESCE(?, gallery_filters_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE search_id = ?`,
      [
        name != null ? String(name) : null,
        queryText != null ? String(queryText) : null,
        scopeFlags != null ? JSON.stringify(scopeFlags) : null,
        tagFilters != null ? JSON.stringify(tagFilters) : null,
        tagExcludeFilters != null ? JSON.stringify(tagExcludeFilters) : null,
        tagMode != null ? String(tagMode === 'any' ? 'any' : 'all') : null,
        galleryFilters != null ? JSON.stringify(galleryFilters) : null,
        searchId,
      ]
    );
    await this._audit('savedSearch.update', null, { searchId });
    return { ok: true };
  }

  async deleteSavedSearch(searchId) {
    await run(this.db, `DELETE FROM SavedSearch WHERE search_id = ?`, [searchId]);
    await this._audit('savedSearch.delete', null, { searchId });
    return { ok: true };
  }

  async listTagTemplates() {
    const rows = await all(
      this.db,
      `
      SELECT template_name, MAX(version) AS latest_version
      FROM TagTemplate
      GROUP BY template_name
      ORDER BY template_name COLLATE NOCASE
    `
    );
    const out = [];
    for (const r of rows) {
      const row = await get(
        this.db,
        `SELECT template_name, version, description, tags_json, created_at
         FROM TagTemplate
         WHERE template_name = ? AND version = ?`,
        [r.template_name, r.latest_version]
      );
      if (!row) continue;
      out.push({
        name: row.template_name,
        version: row.version,
        description: row.description ?? '',
        tags: (() => {
          try {
            const parsed = JSON.parse(row.tags_json || '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        createdAt: row.created_at,
      });
    }
    return out;
  }

  async listTagTemplateVersions(templateName) {
    const rows = await all(
      this.db,
      `SELECT template_name, version, description, tags_json, created_at
       FROM TagTemplate
       WHERE template_name = ?
       ORDER BY version DESC`,
      [templateName]
    );
    return rows.map((r) => ({
      name: r.template_name,
      version: r.version,
      description: r.description ?? '',
      tags: (() => {
        try {
          const parsed = JSON.parse(r.tags_json || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      createdAt: r.created_at,
    }));
  }

  async upsertTagTemplate({ templateName, description = '', tags = [] }) {
    const existing = await get(
      this.db,
      `SELECT MAX(version) AS v FROM TagTemplate WHERE template_name = ?`,
      [templateName]
    );
    const nextVersion = (existing?.v || 0) + 1;
    await run(
      this.db,
      `INSERT INTO TagTemplate(template_name, version, description, tags_json)
       VALUES(?, ?, ?, ?)`,
      [String(templateName), nextVersion, String(description ?? ''), JSON.stringify(tags || [])]
    );
    await this._audit('tagTemplate.upsert', null, { templateName, version: nextVersion });
    return { ok: true, version: nextVersion };
  }

  async deleteTagTemplateVersion({ templateName, version }) {
    await run(this.db, `DELETE FROM TagTemplate WHERE template_name = ? AND version = ?`, [templateName, version]);
    await this._audit('tagTemplate.deleteVersion', null, { templateName, version });
    return { ok: true };
  }

  async applyTagTemplateToCharacter({ characterId, templateName }) {
    const latest = await get(
      this.db,
      `SELECT MAX(version) AS v FROM TagTemplate WHERE template_name = ?`,
      [templateName]
    );
    if (!latest?.v) throw new Error('Tag template not found');
    const row = await get(
      this.db,
      `SELECT tags_json FROM TagTemplate WHERE template_name = ? AND version = ?`,
      [templateName, latest.v]
    );
    if (!row) throw new Error('Tag template not found');
    let tags = [];
    try {
      const parsed = JSON.parse(row.tags_json || '[]');
      tags = Array.isArray(parsed) ? parsed : [];
    } catch {
      tags = [];
    }
    for (const t of tags) {
      await this.addManualTag(characterId, String(t));
    }
    await this._audit('tagTemplate.apply', characterId, { templateName, tagCount: tags.length });
    return { ok: true, tagCount: tags.length };
  }

  async listTagRules({ templateId = null } = {}) {
    const rows =
      templateId == null
        ? await all(
            this.db,
            `SELECT rule_id, template_id, source_field_id, match_type, pattern, emit_tag, enabled, created_at, updated_at
             FROM TagRule
             ORDER BY rule_id ASC`
          )
        : await all(
            this.db,
            `SELECT rule_id, template_id, source_field_id, match_type, pattern, emit_tag, enabled, created_at, updated_at
             FROM TagRule
             WHERE template_id IS NULL OR template_id = ?
             ORDER BY rule_id ASC`,
            [templateId]
          );
    return rows.map((r) => ({
      id: r.rule_id,
      templateId: r.template_id ?? null,
      sourceFieldId: r.source_field_id,
      matchType: r.match_type,
      pattern: r.pattern,
      emitTag: r.emit_tag,
      enabled: !!r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async createTagRule({ templateId = null, sourceFieldId, matchType, pattern, emitTag, enabled = true }) {
    const ruleId = randomId('rule_');
    await run(
      this.db,
      `INSERT INTO TagRule(rule_id, template_id, source_field_id, match_type, pattern, emit_tag, enabled)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [ruleId, templateId, String(sourceFieldId), String(matchType), String(pattern), String(emitTag), enabled ? 1 : 0]
    );
    await this._audit('tagRule.create', null, { ruleId, templateId, sourceFieldId, matchType });
    return ruleId;
  }

  async updateTagRule({ ruleId, patch }) {
    const existing = await get(this.db, 'SELECT rule_id FROM TagRule WHERE rule_id = ?', [ruleId]);
    if (!existing) throw new Error('Rule not found');

    const next = patch || {};
    await run(
      this.db,
      `UPDATE TagRule
       SET template_id = COALESCE(?, template_id),
           source_field_id = COALESCE(?, source_field_id),
           match_type = COALESCE(?, match_type),
           pattern = COALESCE(?, pattern),
           emit_tag = COALESCE(?, emit_tag),
           enabled = COALESCE(?, enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE rule_id = ?`,
      [
        next.templateId !== undefined ? next.templateId : null,
        next.sourceFieldId !== undefined ? String(next.sourceFieldId) : null,
        next.matchType !== undefined ? String(next.matchType) : null,
        next.pattern !== undefined ? String(next.pattern) : null,
        next.emitTag !== undefined ? String(next.emitTag) : null,
        next.enabled !== undefined ? (next.enabled ? 1 : 0) : null,
        ruleId,
      ]
    );
    await this._audit('tagRule.update', null, { ruleId });
    return { ok: true };
  }

  async deleteTagRule(ruleId) {
    await run(this.db, 'DELETE FROM TagRule WHERE rule_id = ?', [ruleId]);
    await this._audit('tagRule.delete', null, { ruleId });
    return { ok: true };
  }

  async recomputeDerivedTags(characterId) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');
    const templateAst = await this.getTemplateAst(character.templateId);
    await this._upsertDerivedTags(templateAst, characterId, character.valuesById);
    await this._updateSearchBlob(templateAst, characterId, character.displayName, character.valuesById);
    await this._audit('tagRule.recompute', characterId, { templateId: character.templateId });
    return { ok: true };
  }

  async recomputeDerivedTagsAll() {
    const chars = await all(this.db, 'SELECT character_id FROM Character');
    for (const c of chars) {
      await this.recomputeDerivedTags(c.character_id);
    }
    return { ok: true, count: chars.length };
  }

  async getCharacter(characterId) {
    const character = await get(
      this.db,
      'SELECT character_id, public_id, display_name, template_id, template_version, template_hash, icon_image_id, icon_focus_x, icon_focus_y, is_system, created_at, updated_at FROM Character WHERE character_id = ?',
      [characterId]
    );
    if (!character) return null;

    const fields = await all(this.db, 'SELECT field_id, value_text, value_type FROM FieldValue WHERE character_id = ?', [
      characterId,
    ]);
    const tags = await all(
      this.db,
      `SELECT t.tag_text, ct.tag_type FROM CharacterTag ct
       JOIN Tag t ON t.tag_id = ct.tag_id
       WHERE ct.character_id = ?
       ORDER BY t.tag_text ASC`,
      [characterId]
    );
    const images = await all(
      this.db,
      `SELECT image_id, relative_path, file_hash, favorite, rating, notes, tags_json, storage_mode, source_path, source_url, source_note, added_at
       FROM ImageAsset WHERE character_id = ?
       ORDER BY favorite DESC, rating DESC, added_at DESC`,
      [characterId]
    );

    const valuesById = {};
    for (const f of fields) valuesById[f.field_id] = f.value_text ?? '';

    return {
      id: character.character_id,
      publicId: character.public_id ?? null,
      displayName: character.display_name,
      templateId: character.template_id,
      templateVersion: character.template_version,
      templateHash: character.template_hash,
      iconImageId: character.icon_image_id ?? null,
      iconFocusX: Number.isFinite(Number(character.icon_focus_x)) ? Number(character.icon_focus_x) : 0.5,
      iconFocusY: Number.isFinite(Number(character.icon_focus_y)) ? Number(character.icon_focus_y) : 0.5,
      isSystem: !!character.is_system,
      createdAt: character.created_at,
      updatedAt: character.updated_at,
      valuesById,
      tags: tags.map((t) => ({ text: t.tag_text, type: t.tag_type })),
      images: images.map((img) => ({
        id: img.image_id,
        relativePath: img.relative_path,
        fileHash: img.file_hash,
        favorite: !!img.favorite,
        rating: img.rating,
        notes: img.notes ?? '',
        tags: (() => {
          try {
            const raw = img.tags_json ?? '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        storageMode: img.storage_mode ?? 'copy',
        sourcePath: img.source_path ?? null,
        sourceUrl: img.source_url ?? null,
        sourceNote: img.source_note ?? '',
        addedAt: img.added_at,
      })),
    };
  }

  async assignPublicCharacterIds({ dryRun = false } = {}) {
    const rows = await all(
      this.db,
      `SELECT character_id, public_id, is_system, created_at
       FROM Character
       WHERE is_system = 0
       ORDER BY created_at ASC`
    );

    const used = new Set();
    let max = 0;
    for (const r of rows) {
      const pid = String(r.public_id ?? '').trim().toUpperCase();
      if (!pid) continue;
      used.add(pid);
      const n = parseCharPublicIdNumber(pid);
      if (n && n > max) max = n;
    }

    const assignments = [];
    for (const r of rows) {
      const characterId = String(r.character_id ?? '').trim();
      if (!characterId) continue;
      const pid = String(r.public_id ?? '').trim();
      if (pid) continue;

      let next = null;
      do {
        max += 1;
        next = formatCharPublicId(max);
      } while (next && used.has(String(next).toUpperCase()));

      if (!next) throw new Error('Failed to allocate public Character ID');
      used.add(String(next).toUpperCase());
      assignments.push({ characterId, publicId: next });
    }

    if (dryRun) return { ok: true, assigned: assignments };

    let updated = 0;
    const errors = [];

    for (const a of assignments) {
      try {
        const character = await this.getCharacter(a.characterId);
        if (!character) throw new Error('Character not found');

        const templateAst = await this.getTemplateAst(character.templateId);
        const hasCharId = templateAst.sections.some((s) => s.fields.some((f) => f.id === 'CHAR-ID-001'));

        await run(this.db, 'BEGIN');
        try {
          await run(this.db, `UPDATE Character SET public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE character_id = ?`, [
            a.publicId,
            a.characterId,
          ]);

          if (hasCharId) {
            const paths = this.getCharacterPaths(a.characterId);
            if (fs.existsSync(paths.sheetTxtPath)) {
              const raw = fs.readFileSync(paths.sheetTxtPath, 'utf8');
              let rewritten = raw;
              if (/^CHARACTER_ID:\s*.*$/m.test(rewritten)) {
                rewritten = rewritten.replace(/^CHARACTER_ID:\s*.*$/m, `CHARACTER_ID: ${a.publicId}`);
              }
              const parsed = parseSheetText(rewritten);
              if (parsed.fieldSpans.has('CHAR-ID-001')) {
                rewritten = applyFieldUpdatesToParsedSheet(parsed, { 'CHAR-ID-001': a.publicId });
              }
              if (rewritten !== raw) fs.writeFileSync(paths.sheetTxtPath, rewritten, 'utf8');
            }

            await run(
              this.db,
              `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
               VALUES(?, 'CHAR-ID-001', ?, ?)
               ON CONFLICT(character_id, field_id) DO UPDATE SET
                 value_text=excluded.value_text,
                 value_type=excluded.value_type,
                 updated_at=CURRENT_TIMESTAMP`,
              [a.characterId, a.publicId, this._fieldTypeById(templateAst, 'CHAR-ID-001')]
            );
          }

          await run(this.db, 'COMMIT');
        } catch (err) {
          await run(this.db, 'ROLLBACK');
          throw err;
        }

        const nextValues = { ...(character.valuesById || {}) };
        if (hasCharId) nextValues['CHAR-ID-001'] = a.publicId;
        await this._updateSearchBlob(templateAst, a.characterId, character.displayName, nextValues);

        const paths = this.getCharacterPaths(a.characterId);
        if (fs.existsSync(paths.sheetTxtPath)) {
          await this._createSheetVersion({
            characterId: a.characterId,
            source: 'ui_edit',
            sheetPath: paths.sheetTxtPath,
            notes: 'Assigned public Character ID.',
          });
        }

        await this._audit('character.assignPublicId', a.characterId, { publicId: a.publicId });
        updated += 1;
      } catch (err) {
        errors.push({ characterId: a.characterId, message: String(err?.message || err || 'Unknown error') });
      }
    }

    return { ok: errors.length === 0, assigned: assignments, updated, errors };
  }

  async setCharacterIcon({ characterId, imageId, focusX, focusY } = {}) {
    if (!characterId) throw new Error('characterId is required');

    const exists = await get(this.db, 'SELECT character_id FROM Character WHERE character_id = ?', [characterId]);
    if (!exists) throw new Error('Character not found');

    const shouldSetImage = imageId !== undefined;
    const nextImageId = shouldSetImage ? (imageId === null ? null : String(imageId)) : null;
    if (shouldSetImage && nextImageId) {
      const img = await get(this.db, 'SELECT image_id FROM ImageAsset WHERE image_id = ? AND character_id = ?', [
        nextImageId,
        characterId,
      ]);
      if (!img) throw new Error('Icon image not found for character');
    }

    const shouldSetX = focusX !== undefined;
    const shouldSetY = focusY !== undefined;
    const nextX = shouldSetX ? clamp01(focusX, 0.5) : null;
    const nextY = shouldSetY ? clamp01(focusY, 0.5) : null;

    await run(
      this.db,
      `UPDATE Character
       SET icon_image_id = CASE WHEN ? = 1 THEN ? ELSE icon_image_id END,
           icon_focus_x = CASE WHEN ? = 1 THEN ? ELSE icon_focus_x END,
           icon_focus_y = CASE WHEN ? = 1 THEN ? ELSE icon_focus_y END,
           updated_at = CURRENT_TIMESTAMP
       WHERE character_id = ?`,
      [shouldSetImage ? 1 : 0, nextImageId, shouldSetX ? 1 : 0, nextX, shouldSetY ? 1 : 0, nextY, characterId]
    );

    await this._audit('character.setIcon', characterId, {
      iconImageId: shouldSetImage ? nextImageId : undefined,
      iconFocusX: shouldSetX ? nextX : undefined,
      iconFocusY: shouldSetY ? nextY : undefined,
    });

    return { ok: true };
  }

  async createCharacter({ displayName = 'Unnamed', templateId = null } = {}) {
    const chosenTemplateId = templateId || this.defaultTemplateId;
    const templateAst = await this.getTemplateAst(chosenTemplateId);

    const characterId = randomId('char_');
    const publicId = await this._allocateNextPublicCharacterId();
    if (!publicId) throw new Error('Failed to allocate public Character ID');
    const paths = this.getCharacterPaths(characterId);

    // Folder scaffolding
    ensureDir(paths.sheetDir);
    ensureDir(paths.versionsDir);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);
    ensureDir(paths.exportsDir);
    ensureDir(paths.extrasDir);
    ensureDir(paths.packsDir);

    const valuesById = {};
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        valuesById[field.id] = field.type === 'rule' ? (field.templateDescriptor ?? '') : '';
      }
    }

    // Ensure Character_ID field reflects our internal id if present.
    if (Object.prototype.hasOwnProperty.call(valuesById, 'CHAR-ID-001')) valuesById['CHAR-ID-001'] = publicId;
    if (Object.prototype.hasOwnProperty.call(valuesById, 'CHAR-ID-002')) valuesById['CHAR-ID-002'] = displayName;

    const sheetText = generateCanonicalSheetText(
      templateAst,
      {
        templateId: templateAst.id,
        templateVersion: templateAst.version,
        templateHash: templateAst.hash,
        characterId: publicId,
        displayName,
      },
      valuesById
    );
    fs.writeFileSync(paths.sheetTxtPath, sheetText, 'utf8');

    await run(
      this.db,
      `INSERT INTO Character(character_id, public_id, display_name, template_id, template_version, template_hash, search_blob)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [characterId, publicId, displayName, templateAst.id, templateAst.version, templateAst.hash, '']
    );

    // Persist only non-empty values (blank fields are represented as blank in the sheet file).
    await run(this.db, 'BEGIN');
    try {
      for (const [fieldId, valueText] of Object.entries(valuesById)) {
        if (!String(valueText ?? '').trim().length) continue;
        await run(
          this.db,
          `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
           VALUES(?, ?, ?, ?)`,
          [characterId, fieldId, valueText, this._fieldTypeById(templateAst, fieldId)]
        );
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._upsertDerivedTags(templateAst, characterId, valuesById);
    await this._updateSearchBlob(templateAst, characterId, displayName, valuesById);

    // Initial version snapshot (source=import to match "creation from template").
    await this._createSheetVersion({ characterId, source: 'import', sheetPath: paths.sheetTxtPath, notes: 'Initial sheet created.' });
    await this._audit('character.create', characterId, { displayName, templateId: templateAst.id, templateHash: templateAst.hash });

    return characterId;
  }

  async importCharacterFromSheetFile({ filePath, templateId = null, displayName = null, preferSheetCharacterId = true } = {}) {
    if (!filePath) throw new Error('filePath is required');
    if (!fs.existsSync(filePath)) throw new Error('Sheet file not found');

    const bytes = fs.readFileSync(filePath);
    const text = bytes.toString('utf8');
    const meta = parseSheetHeaderMeta(text);

    const inferredTemplateId = templateId || meta.TEMPLATE_ID || this.defaultTemplateId;
    const templateAst = await this.getTemplateAst(inferredTemplateId);

    const extraction = extractFieldAssignmentsFromText(text);

    const suggestedName = String(extraction.assignments.get('CHAR-ID-002') ?? meta.DISPLAY_NAME ?? '').trim();
    const finalName = String(displayName ?? '').trim() || suggestedName || path.basename(filePath, path.extname(filePath));

    const incomingPublicIdCandidate = preferSheetCharacterId
      ? String(meta.CHARACTER_ID ?? extraction.assignments.get('CHAR-ID-001') ?? '').trim()
      : '';

    let publicId = incomingPublicIdCandidate && isSafeIdForFolder(incomingPublicIdCandidate) ? incomingPublicIdCandidate : '';
    if (publicId) {
      const exists = await get(this.db, 'SELECT character_id FROM Character WHERE public_id = ? OR character_id = ?', [publicId, publicId]);
      if (exists) publicId = '';
    }
    if (!publicId) {
      const next = await this._allocateNextPublicCharacterId();
      if (!next) throw new Error('Failed to allocate public Character ID');
      publicId = next;
    }

    // Internal ID: keep stable storage separate from the public sheet ID.
    let characterId = null;
    do {
      characterId = randomId('char_');
    } while (fs.existsSync(this.getCharacterPaths(characterId).base));

    const paths = this.getCharacterPaths(characterId);
    ensureDir(paths.sheetDir);
    ensureDir(paths.versionsDir);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);
    ensureDir(paths.exportsDir);
    ensureDir(paths.extrasDir);
    ensureDir(paths.packsDir);

    // Preserve bytes exactly when possible; only rewrite when the imported Character ID doesn't match our chosen public id.
    // This avoids ending up with a sheet that claims a different Character ID than our system-managed public identity.
    let sheetBytesToWrite = bytes;
    const incomingMetaId = String(meta.CHARACTER_ID ?? '').trim();
    const incomingFieldId = String(extraction.assignments.get('CHAR-ID-001') ?? '').trim();
    const shouldRewriteCharacterId =
      incomingMetaId !== publicId || (incomingFieldId && incomingFieldId !== publicId) || (!incomingMetaId && !incomingFieldId);
    if (shouldRewriteCharacterId) {
      let rewrittenText = text;
      if (incomingMetaId) rewrittenText = rewrittenText.replace(/^CHARACTER_ID:\\s*.*$/m, `CHARACTER_ID: ${publicId}`);

      const parsedSheet = parseSheetText(rewrittenText);
      if (parsedSheet.fieldSpans.has('CHAR-ID-001')) {
        rewrittenText = applyFieldUpdatesToParsedSheet(parsedSheet, { 'CHAR-ID-001': publicId });
      }

      sheetBytesToWrite = Buffer.from(rewrittenText, 'utf8');
    }

    fs.writeFileSync(paths.sheetTxtPath, sheetBytesToWrite);

    await run(
      this.db,
      `INSERT INTO Character(character_id, public_id, display_name, template_id, template_version, template_hash, search_blob)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [characterId, publicId, finalName, templateAst.id, templateAst.version, templateAst.hash, '']
    );

    const knownIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    const valuesById = {};
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        valuesById[field.id] = extraction.assignments.has(field.id) ? String(extraction.assignments.get(field.id) ?? '') : '';
      }
    }

    // Ensure Character_ID field reflects our public id if present.
    if (Object.prototype.hasOwnProperty.call(valuesById, 'CHAR-ID-001')) valuesById['CHAR-ID-001'] = publicId;

    await run(this.db, 'BEGIN');
    try {
      for (const [fieldId, valueText] of Object.entries(valuesById)) {
        if (!knownIds.has(fieldId)) continue;
        if (!String(valueText ?? '').trim().length) continue;
        await run(
          this.db,
          `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
           VALUES(?, ?, ?, ?)`,
          [characterId, fieldId, String(valueText ?? ''), this._fieldTypeById(templateAst, fieldId)]
        );
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._upsertDerivedTags(templateAst, characterId, valuesById);
    await this._updateSearchBlob(templateAst, characterId, finalName, valuesById);

    const importNotes = `Imported sheet: ${path.basename(filePath)}`;
    await this._createSheetVersion({ characterId, source: 'import', sheetPath: paths.sheetTxtPath, notes: importNotes });
    await this._audit('character.importSheet', characterId, { templateId: templateAst.id, fileName: path.basename(filePath) });

    const unmapped = [];
    for (const [fieldId] of extraction.assignments) {
      if (!knownIds.has(fieldId)) unmapped.push(fieldId);
    }

    return { characterId, unmappedFieldIds: unmapped };
  }

  _fieldTypeById(templateAst, fieldId) {
    for (const section of templateAst.sections) {
      const f = section.fields.find((x) => x.id === fieldId);
      if (f) return f.type;
    }
    return 'string';
  }

  async _createSheetVersion({ characterId, source, sheetPath, notes = '' }) {
    const bytes = fs.readFileSync(sheetPath);
    const hash = sha256Hex(bytes);
    const ts = toIsoSafeTimestamp();

    const paths = this.getCharacterPaths(characterId);
    ensureDir(paths.versionsDir);

    const fileName = `${ts}_${hash.slice(0, 12)}.txt`;
    const rel = path.join('sheet', 'versions', fileName);
    const dest = path.join(paths.base, rel);
    fs.copyFileSync(sheetPath, dest);

    const parent = await get(
      this.db,
      `SELECT version_id FROM SheetVersion WHERE character_id = ? ORDER BY created_at DESC LIMIT 1`,
      [characterId]
    );

    await run(
      this.db,
      `INSERT INTO SheetVersion(version_id, character_id, source, parent_version_id, export_format, export_relative_path, sheet_bytes_hash, notes)
       VALUES(?, ?, ?, ?, 'txt', ?, ?, ?)`,
      [randomId('ver_'), characterId, source, parent?.version_id ?? null, rel.replaceAll('\\', '/'), hash, notes]
    );

    return { hash, relativePath: rel.replaceAll('\\', '/') };
  }

  async _audit(eventType, characterId = null, details = {}) {
    try {
      await run(
        this.db,
        `INSERT INTO AuditLog(event_id, event_type, character_id, details_json)
         VALUES(?, ?, ?, ?)`,
        [randomId('aud_'), String(eventType), characterId, JSON.stringify(details ?? {})]
      );
    } catch {
      // Best-effort: audit must never break core flows.
    }
  }

  async listAuditLog({ characterId = null, limit = 200 } = {}) {
    const lim = Math.max(1, Math.min(1000, Number(limit) || 200));
    const rows =
      characterId == null
        ? await all(
            this.db,
            `SELECT event_id, event_type, character_id, created_at, details_json
             FROM AuditLog
             ORDER BY created_at DESC
             LIMIT ?`,
            [lim]
          )
        : await all(
            this.db,
            `SELECT event_id, event_type, character_id, created_at, details_json
             FROM AuditLog
             WHERE character_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [characterId, lim]
          );

    return rows.map((r) => {
      let details = {};
      try {
        details = JSON.parse(r.details_json ?? '{}') || {};
      } catch {
        details = {};
      }
      return {
        id: r.event_id,
        type: r.event_type,
        characterId: r.character_id,
        createdAt: r.created_at,
        details,
      };
    });
  }

  async saveCharacter({
    characterId,
    valuesById,
    validationMode = 'strict',
    allowSaveWithErrors = false,
    source = 'ui_edit',
    versionNotes = 'Saved.',
  }) {
    const existing = await this.getCharacter(characterId);
    if (!existing) throw new Error('Character not found');
    const templateAst = await this.getTemplateAst(existing.templateId);

    const mergedValuesById = { ...(valuesById || {}) };
    const hasCharId = templateAst.sections.some((s) => s.fields.some((f) => f.id === 'CHAR-ID-001'));
    const publicId = hasCharId ? await this._getOrCreatePublicCharacterId(characterId) : null;
    if (hasCharId && publicId) mergedValuesById['CHAR-ID-001'] = publicId;

    const paths = this.getCharacterPaths(characterId);
    if (!fs.existsSync(paths.sheetTxtPath)) {
      // Repair missing sheet file.
      const repaired = generateCanonicalSheetText(
        templateAst,
        {
          templateId: templateAst.id,
          templateVersion: templateAst.version,
          templateHash: templateAst.hash,
          characterId: publicId || characterId,
          displayName: existing.displayName,
        },
        existing.valuesById
      );
      ensureDir(paths.sheetDir);
      fs.writeFileSync(paths.sheetTxtPath, repaired, 'utf8');
    }

    const raw = fs.readFileSync(paths.sheetTxtPath, 'utf8');
    const parsed = parseSheetText(raw);

    const { issues, normalizedValuesById } = validateCharacterValues(templateAst, mergedValuesById, validationMode);
    const hasErrors = issues.some((i) => i.severity === 'error');
    if (hasErrors && !allowSaveWithErrors) {
      return { ok: false, issues };
    }

    // Only update changed fields to preserve unknown lines and round-trip fidelity.
    const updates = {};
    for (const [fieldId, newValue] of Object.entries(normalizedValuesById)) {
      const current = parsed.fieldValues.get(fieldId) ?? '';
      if (String(current) !== String(newValue ?? '')) updates[fieldId] = newValue ?? '';
    }

    const updatedText = applyFieldUpdatesToParsedSheet(parsed, updates);
    fs.writeFileSync(paths.sheetTxtPath, updatedText, 'utf8');

    // Update display name if Name field exists.
    const newDisplayName = normalizedValuesById['CHAR-ID-002'] ? String(normalizedValuesById['CHAR-ID-002']) : existing.displayName;

    await run(this.db, `UPDATE Character SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE character_id = ?`, [
      newDisplayName,
      characterId,
    ]);

    // Persist only changed fields; delete rows for newly-blank values.
    await run(this.db, 'BEGIN');
    try {
      for (const [fieldId, valueText] of Object.entries(updates)) {
        const nextText = String(valueText ?? '');
        if (!nextText.trim().length) {
          await run(this.db, `DELETE FROM FieldValue WHERE character_id = ? AND field_id = ?`, [characterId, fieldId]);
          continue;
        }
        await run(
          this.db,
          `INSERT INTO FieldValue(character_id, field_id, value_text, value_type)
           VALUES(?, ?, ?, ?)
           ON CONFLICT(character_id, field_id) DO UPDATE SET
             value_text=excluded.value_text,
             value_type=excluded.value_type,
             updated_at=CURRENT_TIMESTAMP`,
          [characterId, fieldId, nextText, this._fieldTypeById(templateAst, fieldId)]
        );
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._upsertDerivedTags(templateAst, characterId, normalizedValuesById);
    await this._updateSearchBlob(templateAst, characterId, newDisplayName, normalizedValuesById);

    await this._createSheetVersion({ characterId, source, sheetPath: paths.sheetTxtPath, notes: versionNotes });
    await this._audit('character.save', characterId, { source, notes: versionNotes, issueCount: issues.length });

    try {
      const linkText = Object.values(normalizedValuesById || {})
        .map((v) => String(v ?? ''))
        .join('\n');
      await this._reindexLinksForSource({ sourceType: 'sheet', sourceId: characterId, text: linkText });
    } catch (err) {
      await this._audit('linkIndex.reindexFailed', characterId, {
        sourceType: 'sheet',
        sourceId: characterId,
        message: String(err?.message || err || 'Unknown error'),
      });
    }

    return { ok: true, issues };
  }

  async batchUpdateCharacterField({
    characterIds = [],
    fieldId,
    operation = 'set',
    valueText = '',
    validationMode = 'strict',
    allowSaveWithErrors = false,
  } = {}) {
    const idsRaw = Array.isArray(characterIds) ? characterIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    const fid = String(fieldId ?? '').trim();
    if (!fid) throw new Error('fieldId is required');

    const op = (() => {
      const raw = String(operation ?? '').trim().toLowerCase();
      if (raw === 'append') return 'append';
      if (raw === 'clear') return 'clear';
      return 'set';
    })();

    const val = String(valueText ?? '');
    const mode = String(validationMode ?? 'strict').trim() || 'strict';
    const allow = !!allowSaveWithErrors;

    const globalProtected = new Set(await this.listProtectedFieldIdsGlobal());
    globalProtected.add('CHAR-ID-001');

    const result = {
      ok: true,
      requested: ids.length,
      updated: 0,
      skipped: [],
      errors: [],
    };

    for (const characterId of ids) {
      try {
        const existing = await this.getCharacter(characterId);
        if (!existing) {
          result.skipped.push({ characterId, reason: 'missing' });
          continue;
        }
        if (existing.isSystem) {
          result.skipped.push({ characterId, reason: 'system' });
          continue;
        }

        const protectedIds = new Set(await this.listProtectedFieldIds(characterId));
        if (protectedIds.has(fid) || globalProtected.has(fid)) {
          result.skipped.push({ characterId, reason: 'protected', fieldId: fid });
          continue;
        }

        const templateAst = await this.getTemplateAst(existing.templateId);
        const field =
          templateAst.sections?.flatMap((s) => s.fields || []).find((f) => String(f?.id ?? '') === fid) || null;
        if (!field || field.type === 'rule') {
          result.skipped.push({ characterId, reason: 'field_not_in_template', fieldId: fid });
          continue;
        }

        const current = String(existing.valuesById?.[fid] ?? '');
        const next = (() => {
          if (op === 'clear') return '';
          if (op === 'append') {
            const add = String(val ?? '');
            if (!add.trim()) return current;
            if (!current.trim()) return add;
            return `${current}\n${add}`;
          }
          return String(val ?? '');
        })();

        const merged = { ...(existing.valuesById || {}) };
        merged[fid] = next;

        const saveRes = await this.saveCharacter({
          characterId,
          valuesById: merged,
          validationMode: mode,
          allowSaveWithErrors: allow,
          source: 'ui_edit',
          versionNotes: `Batch edit: ${op} ${fid}.`,
        });

        if (!saveRes.ok) {
          result.errors.push({
            characterId,
            message: `Validation failed for ${fid} (${saveRes.issues?.length ?? 0} issue(s)).`,
            issues: saveRes.issues,
          });
          continue;
        }

        result.updated += 1;
      } catch (err) {
        result.errors.push({ characterId, message: err instanceof Error ? err.message : String(err) });
      }
    }

    await this._audit('character.batchUpdateField', null, {
      fieldId: fid,
      operation: op,
      requested: ids.length,
      updated: result.updated,
      skipped: result.skipped.length,
      errors: result.errors.length,
    });
    return result;
  }

  async batchUpdateCharacterTags({ characterIds = [], addTags = [], removeTags = [] } = {}) {
    const idsRaw = Array.isArray(characterIds) ? characterIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));

    const cleanTags = (raw) => {
      const list = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const out = [];
      for (const t of list) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      return out;
    };

    const cleanedAdd = cleanTags(addTags);
    const cleanedRemove = cleanTags(removeTags);

    const result = {
      ok: true,
      requested: ids.length,
      updated: 0,
      skipped: [],
      errors: [],
    };

    if (ids.length === 0) return result;
    if (cleanedAdd.length === 0 && cleanedRemove.length === 0) return result;

    const templateCache = new Map(); // templateId -> ast

    for (const characterId of ids) {
      const cid = String(characterId ?? '').trim();
      if (!cid) continue;

      try {
        const meta = await get(
          this.db,
          `SELECT character_id, display_name, template_id, is_system, deleted_at
           FROM Character
           WHERE character_id = ?`,
          [cid]
        );
        if (!meta) {
          result.skipped.push({ characterId: cid, reason: 'missing' });
          continue;
        }
        if (meta.is_system) {
          result.skipped.push({ characterId: cid, reason: 'system' });
          continue;
        }
        if (meta.deleted_at) {
          result.skipped.push({ characterId: cid, reason: 'deleted' });
          continue;
        }

        let changed = 0;

        await run(this.db, 'BEGIN');
        try {
          for (const tagText of cleanedRemove) {
            const tagRow = await get(this.db, 'SELECT tag_id FROM Tag WHERE tag_text = ?', [tagText]);
            if (!tagRow) continue;
            const del = await run(
              this.db,
              `DELETE FROM CharacterTag WHERE character_id = ? AND tag_id = ? AND tag_type = 'manual'`,
              [cid, tagRow.tag_id]
            );
            changed += Number(del?.changes) || 0;
          }

          for (const tagText of cleanedAdd) {
            const tagId = await this._ensureTag(tagText);
            const ins = await run(
              this.db,
              `INSERT OR IGNORE INTO CharacterTag(character_id, tag_id, tag_type) VALUES(?, ?, 'manual')`,
              [cid, tagId]
            );
            changed += Number(ins?.changes) || 0;
          }

          await run(this.db, 'COMMIT');
        } catch (err) {
          await run(this.db, 'ROLLBACK');
          throw err;
        }

        if (changed <= 0) {
          result.skipped.push({ characterId: cid, reason: 'no_change' });
          continue;
        }

        const tid = String(meta.template_id ?? '').trim() || this.defaultTemplateId;
        const templateAst = templateCache.get(tid) || (await this.getTemplateAst(tid));
        templateCache.set(tid, templateAst);

        const fields = await all(this.db, 'SELECT field_id, value_text FROM FieldValue WHERE character_id = ?', [cid]);
        const valuesById = {};
        for (const f of fields) valuesById[f.field_id] = f.value_text ?? '';

        await this._updateSearchBlob(templateAst, cid, String(meta.display_name ?? ''), valuesById);

        result.updated += 1;
      } catch (err) {
        result.errors.push({ characterId: cid, message: err instanceof Error ? err.message : String(err) });
      }
    }

    await this._audit('character.batchTags', null, {
      requested: ids.length,
      updated: result.updated,
      skipped: result.skipped.length,
      errors: result.errors.length,
      add: cleanedAdd.length,
      remove: cleanedRemove.length,
    });

    return result;
  }

  async softDeleteCharacters({ characterIds = [] } = {}) {
    const idsRaw = Array.isArray(characterIds) ? characterIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    if (ids.length === 0) return { ok: true, requested: 0, updated: 0, skipped: [] };

    const skipped = [];
    let updated = 0;

    await run(this.db, 'BEGIN');
    try {
      for (const characterId of ids) {
        const row = await get(this.db, `SELECT character_id, is_system, deleted_at FROM Character WHERE character_id = ?`, [
          characterId,
        ]);
        if (!row) {
          skipped.push({ characterId, reason: 'missing' });
          continue;
        }
        if (row.is_system) {
          skipped.push({ characterId, reason: 'system' });
          continue;
        }
        if (row.deleted_at) {
          skipped.push({ characterId, reason: 'already_deleted' });
          continue;
        }

        await run(this.db, `UPDATE Character SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE character_id = ?`, [
          characterId,
        ]);
        updated += 1;
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._audit('character.softDelete', null, { requested: ids.length, updated, skipped: skipped.length });
    return { ok: true, requested: ids.length, updated, skipped };
  }

  async restoreCharacters({ characterIds = [] } = {}) {
    const idsRaw = Array.isArray(characterIds) ? characterIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    if (ids.length === 0) return { ok: true, requested: 0, updated: 0, skipped: [] };

    const skipped = [];
    let updated = 0;

    await run(this.db, 'BEGIN');
    try {
      for (const characterId of ids) {
        const row = await get(this.db, `SELECT character_id, is_system, deleted_at FROM Character WHERE character_id = ?`, [
          characterId,
        ]);
        if (!row) {
          skipped.push({ characterId, reason: 'missing' });
          continue;
        }
        if (row.is_system) {
          skipped.push({ characterId, reason: 'system' });
          continue;
        }
        if (!row.deleted_at) {
          skipped.push({ characterId, reason: 'not_deleted' });
          continue;
        }

        await run(this.db, `UPDATE Character SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE character_id = ?`, [
          characterId,
        ]);
        updated += 1;
      }
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._audit('character.restore', null, { requested: ids.length, updated, skipped: skipped.length });
    return { ok: true, requested: ids.length, updated, skipped };
  }

  async purgeCharacters({ characterIds = null } = {}) {
    const idsNorm = (() => {
      if (characterIds == null) return null;
      const idsRaw = Array.isArray(characterIds) ? characterIds : [];
      return Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    })();

    const ids =
      idsNorm !== null
        ? idsNorm
        : (await all(this.db, `SELECT character_id FROM Character WHERE is_system = 0 AND deleted_at IS NOT NULL`)).map((r) =>
            String(r.character_id ?? '').trim()
          );

    const errors = [];
    let purged = 0;

    for (const characterId of ids) {
      if (!characterId) continue;
      try {
        const del = await run(this.db, `DELETE FROM Character WHERE character_id = ? AND is_system = 0 AND deleted_at IS NOT NULL`, [
          characterId,
        ]);
        const changes = Number(del?.changes) || 0;
        if (changes <= 0) continue;
      } catch (err) {
        errors.push({ characterId, message: err instanceof Error ? err.message : String(err) });
        continue;
      }

      purged += 1;

      try {
        const paths = this.getCharacterPaths(characterId);
        if (fs.existsSync(paths.base)) {
          if (typeof fs.rmSync === 'function') fs.rmSync(paths.base, { recursive: true, force: true });
          else fs.rmdirSync(paths.base, { recursive: true });
        }
      } catch (err) {
        errors.push({ characterId, message: `Failed to delete files: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    await this._audit('character.purge', null, { requested: ids.length, purged, errors: errors.length });
    return { ok: true, requested: ids.length, purged, errors };
  }

  async _upsertDerivedTags(templateAst, characterId, valuesById) {
    // Always include template tag.
    const derived = new Set([`template:${templateAst.id}`]);

    // Apply TagRules deterministically by rule_id order.
    const rules = await all(
      this.db,
      'SELECT rule_id, source_field_id, match_type, pattern, emit_tag FROM TagRule WHERE enabled = 1 AND (template_id IS NULL OR template_id = ?) ORDER BY rule_id ASC',
      [templateAst.id]
    );
    for (const r of rules) {
      const val = String(valuesById[r.source_field_id] ?? '');
      if (!val) continue;

      if (r.match_type === 'equals' && val === r.pattern) derived.add(r.emit_tag);
      else if (r.match_type === 'contains' && val.includes(r.pattern)) derived.add(r.emit_tag);
      else if (r.match_type === 'regex') {
        try {
          const re = new RegExp(r.pattern);
          if (re.test(val)) derived.add(r.emit_tag);
        } catch {
          // Invalid regex: ignore deterministically.
        }
      }
    }

    // Clear existing derived tags.
    await run(
      this.db,
      `DELETE FROM CharacterTag
       WHERE character_id = ? AND tag_type = 'derived'`,
      [characterId]
    );

    for (const tagText of Array.from(derived).sort()) {
      const tagId = await this._ensureTag(tagText);
      await run(this.db, `INSERT OR IGNORE INTO CharacterTag(character_id, tag_id, tag_type) VALUES(?, ?, 'derived')`, [
        characterId,
        tagId,
      ]);
    }
  }

  async _ensureTag(tagText) {
    const existing = await get(this.db, 'SELECT tag_id FROM Tag WHERE tag_text = ?', [tagText]);
    if (existing) return existing.tag_id;
    const tagId = randomId('tag_');
    await run(this.db, 'INSERT INTO Tag(tag_id, tag_text) VALUES(?, ?)', [tagId, tagText]);
    return tagId;
  }

  async _getAllTagTexts(characterId) {
    const rows = await all(
      this.db,
      `SELECT t.tag_text FROM CharacterTag ct
       JOIN Tag t ON t.tag_id = ct.tag_id
       WHERE ct.character_id = ?
       ORDER BY t.tag_text ASC`,
      [characterId]
    );
    return rows.map((r) => r.tag_text);
  }

  async _updateSearchBlob(templateAst, characterId, displayName, valuesById) {
    const tags = await this._getAllTagTexts(characterId);
    const blobs = computeSearchBlobs({ displayName, fieldsById: valuesById, templateAst, tags });
    await run(
      this.db,
      `UPDATE Character SET search_blob = ?, search_blob_ids = ?, search_blob_labels = ?, search_blob_values = ?, search_blob_tags = ?, search_blob_name = ?
       WHERE character_id = ?`,
      [blobs.all, blobs.ids, blobs.labels, blobs.values, blobs.tags, blobs.name, characterId]
    );
  }

  async addManualTag(characterId, tagText) {
    const tagId = await this._ensureTag(tagText);
    await run(this.db, `INSERT OR IGNORE INTO CharacterTag(character_id, tag_id, tag_type) VALUES(?, ?, 'manual')`, [
      characterId,
      tagId,
    ]);
    const character = await this.getCharacter(characterId);
    if (character) {
      const templateAst = await this.getTemplateAst(character.templateId);
      await this._updateSearchBlob(templateAst, characterId, character.displayName, character.valuesById);
    }
  }

  async removeManualTag(characterId, tagText) {
    const tagRow = await get(this.db, 'SELECT tag_id FROM Tag WHERE tag_text = ?', [tagText]);
    if (!tagRow) return;
    await run(this.db, `DELETE FROM CharacterTag WHERE character_id = ? AND tag_id = ? AND tag_type = 'manual'`, [
      characterId,
      tagRow.tag_id,
    ]);
    const character = await this.getCharacter(characterId);
    if (character) {
      const templateAst = await this.getTemplateAst(character.templateId);
      await this._updateSearchBlob(templateAst, characterId, character.displayName, character.valuesById);
    }
  }

  async listProtectedFieldIds(characterId = null) {
    const rows = await all(
      this.db,
      `SELECT field_id FROM ProtectedField
       WHERE scope = 'global' OR (scope = 'character' AND character_id = ?)`,
      [characterId]
    );
    return rows.map((r) => r.field_id);
  }

  async listProtectedFieldIdsGlobal() {
    const rows = await all(this.db, `SELECT field_id FROM ProtectedField WHERE scope = 'global' ORDER BY field_id ASC`);
    return rows.map((r) => r.field_id);
  }

  async listProtectedFieldIdsForCharacter(characterId) {
    const rows = await all(
      this.db,
      `SELECT field_id FROM ProtectedField WHERE scope = 'character' AND character_id = ? ORDER BY field_id ASC`,
      [characterId]
    );
    return rows.map((r) => r.field_id);
  }

  async setProtectedFieldIdsGlobal(fieldIds) {
    await run(this.db, `DELETE FROM ProtectedField WHERE scope = 'global'`);
    for (const fid of fieldIds) {
      await run(
        this.db,
        `INSERT INTO ProtectedField(protected_id, scope, field_id) VALUES(?, 'global', ?)`,
        [randomId('prot_'), fid]
      );
    }
    await this._audit('protectedFields.setGlobal', null, { count: (fieldIds || []).length });
    return { ok: true };
  }

  async setProtectedFieldIdsForCharacter(characterId, fieldIds) {
    if (!characterId) throw new Error('characterId is required');
    const existing = await get(this.db, 'SELECT character_id FROM Character WHERE character_id = ?', [characterId]);
    if (!existing) throw new Error('Character not found');

    await run(this.db, `DELETE FROM ProtectedField WHERE scope = 'character' AND character_id = ?`, [characterId]);
    for (const fid of fieldIds || []) {
      await run(
        this.db,
        `INSERT INTO ProtectedField(protected_id, scope, character_id, field_id)
         VALUES(?, 'character', ?, ?)`,
        [randomId('prot_'), characterId, fid]
      );
    }
    await this._audit('protectedFields.setCharacter', characterId, { count: (fieldIds || []).length });
    return { ok: true };
  }

  async ingestPreview({ characterId = null, inputText }) {
    if (!inputText) throw new Error('No input text provided');

    const target = characterId ? await this.getCharacter(characterId) : null;
    const currentValues = target ? target.valuesById : {};
    const templateAst = await this.getTemplateAst(target ? target.templateId : this.defaultTemplateId);

    const extraction = extractFieldAssignmentsFromText(inputText);
    const protectedIds = new Set(await this.listProtectedFieldIds(characterId));

    // Pre-validate proposed values against template field types.
    const { issues } = validateCharacterValues(templateAst, Object.fromEntries(extraction.assignments), 'strict');
    const issuesById = new Map();
    for (const i of issues) {
      const arr = issuesById.get(i.fieldId) || [];
      arr.push(i);
      issuesById.set(i.fieldId, arr);
    }

    const changes = [];
    const presentIds = new Set(Array.from(extraction.assignments.keys()));
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        if (!presentIds.has(field.id)) continue;
        const proposed = extraction.assignments.get(field.id) ?? '';
        const current = currentValues[field.id] ?? '';
        const fieldIssues = issuesById.get(field.id) || [];
        const changeType = classifyChangeType(current, proposed, fieldIssues);
        const isProtected = protectedIds.has(field.id);

        let defaultSelected = changeType === 'add' || changeType === 'modify';
        if (changeType === 'same' || changeType === 'blank' || changeType === 'invalid') defaultSelected = false;
        if (isProtected) defaultSelected = false;

        changes.push({
          fieldId: field.id,
          label: field.label,
          section: section.title,
          currentValue: current,
          proposedValue: proposed,
          changeType,
          isProtected,
          defaultSelected,
          issues: fieldIssues,
        });
      }
    }

    const unmapped = [];
    for (const [fieldId] of extraction.assignments) {
      const inTemplate = templateAst.sections.some((s) => s.fields.some((f) => f.id === fieldId));
      if (!inTemplate) {
        unmapped.push({ fieldId, rawLine: extraction.rawById.get(fieldId) || `${fieldId}: ${extraction.assignments.get(fieldId)}` });
      }
    }

    return { targetCharacterId: characterId, changes, unmapped };
  }

  async ingestApply({ characterId, selectedFieldIds, inputText, validationMode = 'strict', allowSaveWithErrors = false }) {
    const preview = await this.ingestPreview({ characterId, inputText });
    const selected = new Set(selectedFieldIds || []);

    const updates = {};
    for (const c of preview.changes) {
      if (!selected.has(c.fieldId)) continue;
      if (c.isProtected) continue;
      // Never overwrite with blank unless explicitly selected (already is).
      updates[c.fieldId] = c.proposedValue ?? '';
    }

    const existing = await this.getCharacter(characterId);
    if (!existing) throw new Error('Character not found');
    const merged = { ...existing.valuesById, ...updates };

    const result = await this.saveCharacter({
      characterId,
      valuesById: merged,
      validationMode,
      allowSaveWithErrors,
      source: 'ingest',
      versionNotes: 'Applied ingest.',
    });
    if (!result.ok) return result;
    return { ok: true, issues: result.issues };
  }

  async ingestCreateCharacter({
    displayName = 'Unnamed',
    templateId = null,
    inputText,
    selectedFieldIds,
    validationMode = 'strict',
    allowSaveWithErrors = false,
  }) {
    if (!inputText) throw new Error('No input text provided');

    const extraction = extractFieldAssignmentsFromText(inputText);
    const suggestedName = String(extraction.assignments.get('CHAR-ID-002') ?? '').trim();
    const finalName = suggestedName || String(displayName || 'Unnamed');

    const characterId = await this.createCharacter({ displayName: finalName, templateId });
    const res = await this.ingestApply({ characterId, selectedFieldIds, inputText, validationMode, allowSaveWithErrors });
    return { characterId, ...res };
  }

  async patchPreview({ characterId, patchText }) {
    return this.ingestPreview({ characterId, inputText: patchText });
  }

  async patchApply({ characterId, selectedFieldIds, patchText, validationMode = 'strict', allowSaveWithErrors = false }) {
    const preview = await this.patchPreview({ characterId, patchText });
    const selected = new Set(selectedFieldIds || []);
    const updates = {};
    for (const c of preview.changes) {
      if (!selected.has(c.fieldId)) continue;
      if (c.isProtected) continue;
      updates[c.fieldId] = c.proposedValue ?? '';
    }

    const existing = await this.getCharacter(characterId);
    if (!existing) throw new Error('Character not found');
    const merged = { ...existing.valuesById, ...updates };

    const result = await this.saveCharacter({
      characterId,
      valuesById: merged,
      validationMode,
      allowSaveWithErrors,
      source: 'paste_patch',
      versionNotes: 'Applied paste patch.',
    });
    if (!result.ok) return result;
    return { ok: true, issues: result.issues };
  }

  async exportBundle({ characterId, outDir = null } = {}) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');

    const paths = this.getCharacterPaths(characterId);
    const exportDir = outDir
      ? path.join(String(outDir), 'characters', sanitizeFileName(null, `${character.displayName}__${shortStableIdForPath(characterId)}`))
      : paths.exportsDir;
    assertNotForbiddenDrive(exportDir, 'Export destination');
    ensureDir(exportDir);

    // Canonical TXT is the sheet itself.
    const sheetText = fs.readFileSync(paths.sheetTxtPath, 'utf8');
    const txtPath = path.join(exportDir, 'character.txt');
    fs.writeFileSync(txtPath, sheetText, 'utf8');

    const md = this._sheetTextToMarkdown(sheetText);
    const mdPath = path.join(exportDir, 'character.md');
    fs.writeFileSync(mdPath, md, 'utf8');

    const pdfPath = path.join(exportDir, 'character.pdf');
    // PDF is generated in the Electron main process via printToPDF to avoid extra deps.

    return {
      txtPath,
      mdPath,
      pdfPath,
    };
  }

  async exportImageSet({ characterId = null, imageIds = [], outDir = null, setName = null } = {}) {
    const idsRaw = Array.isArray(imageIds) ? imageIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('imageIds is required');

    let character = null;
    const cid = characterId == null ? null : String(characterId ?? '').trim();
    if (cid) character = await this.getCharacter(cid);

    const exportRoot = outDir ? String(outDir) : this.getPaths().exportsDir;
    assertNotForbiddenDrive(exportRoot, 'Export destination');
    const safeSetName =
      String(setName ?? '').trim() ||
      (character ? `${character.displayName}__${shortStableIdForPath(cid)}` : 'image_set');
    const exportDir = path.join(
      exportRoot,
      'image_sets',
      sanitizeFileName(null, `${safeSetName}__${toIsoSafeTimestamp()}`)
    );
    ensureDir(exportDir);

    const written = [];
    const skipped = [];
    for (const imageId of ids) {
      const srcAbs = await this.getImageAbsPath({ imageId, kind: 'original' });
      if (!srcAbs || !fs.existsSync(srcAbs)) {
        skipped.push({ imageId, reason: 'missing' });
        continue;
      }

      const srcBase = path.basename(srcAbs);
      const ext = path.extname(srcBase) || '';
      const safeSrcBase = sanitizeFileName(srcBase, `image_${shortStableIdForPath(imageId)}${ext}`);
      const destName = sanitizeFileName(null, `${shortStableIdForPath(imageId)}__${safeSrcBase}`);
      const destAbs = uniquePath(exportDir, destName);
      fs.copyFileSync(srcAbs, destAbs);
      written.push({ imageId, path: destAbs });
    }

    await this._audit('imageSet.export', cid || null, { outDir: exportDir, requested: ids.length, written: written.length });
    return { ok: true, outDir: exportDir, written, skipped };
  }

  async exportSharePack({
    characterId,
    outDir = null,
    includeSheet = true,
    imageIds = [],
    docIdsByType = {},
  } = {}) {
    const cid = String(characterId ?? '').trim();
    if (!cid) throw new Error('characterId is required');

    const character = await this.getCharacter(cid);
    if (!character) throw new Error('Character not found');

    const exportRoot = outDir ? String(outDir) : this.getPaths().exportsDir;
    assertNotForbiddenDrive(exportRoot, 'Export destination');
    const packDir = path.join(
      exportRoot,
      'share_packs',
      sanitizeFileName(null, `${character.displayName}__${shortStableIdForPath(cid)}__${toIsoSafeTimestamp()}`)
    );
    ensureDir(packDir);

    const sheetDir = path.join(packDir, 'sheet');
    const imagesDir = path.join(packDir, 'images');
    const docsDir = path.join(packDir, 'docs');
    ensureDir(sheetDir);
    ensureDir(imagesDir);
    ensureDir(docsDir);

    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      character: {
        id: cid,
        displayName: character.displayName,
        templateId: character.templateId,
      },
      includeSheet: !!includeSheet,
      images: [],
      docs: {
        notes: [],
        stories: [],
        moodboard: [],
      },
    };

    if (includeSheet) {
      const paths = this.getCharacterPaths(cid);
      const sheetOut = path.join(sheetDir, 'character.txt');
      fs.copyFileSync(paths.sheetTxtPath, sheetOut);
    }

    const idsRaw = Array.isArray(imageIds) ? imageIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    for (const imageId of ids) {
      const srcAbs = await this.getImageAbsPath({ imageId, kind: 'original' });
      if (!srcAbs || !fs.existsSync(srcAbs)) continue;
      const srcBase = path.basename(srcAbs);
      const ext = path.extname(srcBase) || '';
      const safeSrcBase = sanitizeFileName(srcBase, `image_${shortStableIdForPath(imageId)}${ext}`);
      const destName = sanitizeFileName(null, `${shortStableIdForPath(imageId)}__${safeSrcBase}`);
      const destAbs = uniquePath(imagesDir, destName);
      fs.copyFileSync(srcAbs, destAbs);
      manifest.images.push({ imageId, path: `images/${path.basename(destAbs)}` });
    }

    const wantedDocs = docIdsByType && typeof docIdsByType === 'object' ? docIdsByType : {};
    const types = [
      { docType: 'notes', ext: 'txt' },
      { docType: 'stories', ext: 'txt' },
      { docType: 'moodboard', ext: 'json' },
    ];

    for (const { docType, ext } of types) {
      const listRaw = Array.isArray(wantedDocs[docType]) ? wantedDocs[docType] : [];
      const docIds = Array.from(new Set(listRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
      for (const docId of docIds) {
        const doc = await this.getDoc({ docType, docId });
        if (!doc) continue;
        const titleSafe = sanitizeFileName(String(doc.title ?? ''), docType);
        const baseName = sanitizeFileName(null, `${docType}__${titleSafe}__${shortStableIdForPath(doc.id)}.${ext}`);
        const destAbs = uniquePath(docsDir, baseName);
        fs.writeFileSync(destAbs, String(doc.content ?? ''), 'utf8');
        manifest.docs[docType].push({ docId: doc.id, title: doc.title, path: `docs/${path.basename(destAbs)}` });
      }
    }

    const manifestPath = path.join(packDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    await this._audit('sharePack.export', cid, {
      outDir: packDir,
      includeSheet: !!includeSheet,
      imageCount: manifest.images.length,
      noteCount: manifest.docs.notes.length,
      storyCount: manifest.docs.stories.length,
      moodboardCount: manifest.docs.moodboard.length,
    });
    return { ok: true, outDir: packDir, manifestPath };
  }

  async exportWebPortfolio({
    outDir = null,
    characterIds = null,
    format = 'portfolio',
    imageMode = 'all',
    fieldMode = 'safe',
  } = {}) {
    const exportRoot = outDir ? String(outDir) : this.getPaths().exportsDir;
    assertNotForbiddenDrive(exportRoot, 'Export destination');
    ensureDir(exportRoot);

    const safeFormat = String(format ?? '').trim().toLowerCase() === 'codex' ? 'codex' : 'portfolio';
    const safeImageMode = (() => {
      const m = String(imageMode ?? '').trim().toLowerCase();
      if (m === 'carousel' || m === 'frontpage' || m === 'all') return m;
      return 'all';
    })();
    const safeFieldMode = (() => {
      const m = String(fieldMode ?? '').trim().toLowerCase();
      if (m === 'none' || m === 'all' || m === 'safe') return m;
      return 'safe';
    })();

    const folderName = `web-portfolio-${toIsoSafeTimestamp()}`;
    const siteDir = uniquePath(exportRoot, sanitizeFileName(null, folderName));
    assertNotForbiddenDrive(siteDir, 'Export destination');
    ensureDir(siteDir);

    const dirs = {
      characters: path.join(siteDir, 'characters'),
      images: path.join(siteDir, 'images'),
      assets: path.join(siteDir, 'assets'),
      icons: path.join(siteDir, 'assets', 'icons'),
    };
    ensureDir(dirs.characters);
    ensureDir(dirs.images);
    ensureDir(dirs.assets);
    ensureDir(dirs.icons);

    const escapeHtml = (text) =>
      String(text ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const templateDir = path.join(__dirname, '..', 'templates', 'web-portfolio');
    const readTemplate = (fileName, fallback) => {
      try {
        const abs = path.join(templateDir, fileName);
        if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
      } catch {
        // ignore
      }
      return fallback;
    };

    const defaultCss = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#0b0d10;color:#e9eef5}a{color:inherit}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace}img{max-width:100%}.topbar{position:sticky;top:0;background:rgba(10,12,15,0.9);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,0.12);padding:12px 16px;display:flex;gap:12px;align-items:center;z-index:2}.title{font-weight:900;letter-spacing:0.02em}.wrap{padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.card{display:block;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);text-decoration:none;overflow:hidden}.card:hover{background:rgba(255,255,255,0.06)}.cardImg{aspect-ratio:1/1;background:rgba(255,255,255,0.02);display:flex;align-items:center;justify-content:center}.cardImg img{width:100%;height:100%;object-fit:cover}.cardBody{padding:10px 12px}.cardName{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.muted{color:rgba(233,238,245,0.7);font-size:0.9rem}.backLink{display:inline-block;margin:16px 16px 0;color:rgba(233,238,245,0.75);text-decoration:none}.backLink:hover{color:#e9eef5}.page{max-width:1100px;margin:0 auto;padding:0 16px 30px}.h1{font-size:1.6rem;font-weight:900;margin:10px 0}.fields{display:flex;flex-direction:column;gap:8px;margin:14px 0}.field{border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);padding:10px 12px}.fieldTop{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.fid{font-weight:900}.label{color:rgba(233,238,245,0.7)}.value{white-space:pre-wrap;word-break:break-word;margin-top:6px;color:#e9eef5}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.gallery img{width:100%;height:auto;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.02)}`;

    const defaultIndexHtml = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>CastKit Codex Export</title><link rel="stylesheet" href="assets/style.css"/></head><body><div class="topbar"><div class="title">CastKit Codex — Web Export</div><div class="muted">{{EXPORT_SUBTITLE}}</div></div><div class="wrap"><div class="grid">{{CHAR_CARDS}}</div></div></body></html>`;

    const defaultCharacterHtml = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{{CHAR_NAME}}</title><link rel="stylesheet" href="../assets/style.css"/></head><body><a class="backLink" href="../index.html">← Back</a><div class="page"><div class="h1">{{CHAR_NAME}}</div><div class="muted">ID: <code>{{CHAR_ID}}</code></div>{{FIELDS_BLOCK}}<div class="gallery">{{IMAGES}}</div></div></body></html>`;

    const css = readTemplate('style.css', defaultCss);
    const indexTpl = readTemplate('index.html', defaultIndexHtml);
    const charTpl = readTemplate('character.html', defaultCharacterHtml);
    const appJs = readTemplate('app.js', '');

    fs.writeFileSync(path.join(dirs.assets, 'style.css'), css, 'utf8');
    fs.writeFileSync(path.join(dirs.assets, 'app.js'), appJs, 'utf8');

    const wantedIdsRaw = Array.isArray(characterIds) ? characterIds : [];
    const wanted = new Set(wantedIdsRaw.map((x) => String(x ?? '').trim()).filter(Boolean));

    const rows = await all(
      this.db,
      `SELECT character_id
       FROM Character
       WHERE is_system = 0
       ORDER BY created_at ASC`
    );
    const ids = rows.map((r) => String(r.character_id ?? '').trim()).filter(Boolean);
    const finalIds = wanted.size ? ids.filter((id) => wanted.has(id)) : ids;

    const templateCache = new Map(); // templateId -> { ast, labelById, safeFieldIds, allFieldIds }
    const safeSpinoffName = 'LLM Pack (strict) — Safe Subset';

    const getTemplateInfo = async (templateId) => {
      const tid = String(templateId ?? '').trim() || this.defaultTemplateId;
      if (templateCache.has(tid)) return templateCache.get(tid);

      const ast = await this.getTemplateAst(tid);
      const labelById = new Map();
      const allFieldIds = [];
      for (const section of ast.sections || []) {
        for (const f of section.fields || []) {
          labelById.set(f.id, f.label);
          if (f.type === 'rule') continue;
          allFieldIds.push(f.id);
        }
      }

      let safeFieldIds = allFieldIds.slice();
      try {
        const row = await get(
          this.db,
          `SELECT field_id_list FROM TemplateSpinOff WHERE template_id = ? AND name = ? AND is_builtin = 1 LIMIT 1`,
          [tid, safeSpinoffName]
        );
        if (row?.field_id_list) {
          const parsed = JSON.parse(String(row.field_id_list ?? '[]'));
          if (Array.isArray(parsed)) {
            const valid = new Set(ast.sections.flatMap((s) => s.fields.map((f) => f.id)));
            safeFieldIds = parsed.map((x) => String(x)).filter((id) => valid.has(id));
          }
        }
      } catch {
        // ignore and fallback to all fields
      }

      const info = { ast, labelById, allFieldIds, safeFieldIds };
      templateCache.set(tid, info);
      return info;
    };

    const cards = [];
    let exportedCharacters = 0;
    let exportedImages = 0;

    for (const cid of finalIds) {
      const character = await this.getCharacter(cid);
      if (!character) continue;

      const publicId = String(character.publicId || '').trim() || shortStableIdForPath(cid);
      const fileBase = sanitizeFileName(publicId, `char_${shortStableIdForPath(cid)}`);
      const pageFileName = sanitizeFileName(null, `${fileBase}.html`);

      const info = await getTemplateInfo(character.templateId);
      const fieldIds =
        safeFieldMode === 'none'
          ? []
          : safeFieldMode === 'all'
          ? info.allFieldIds
          : safeFieldMode === 'safe'
          ? info.safeFieldIds
          : info.safeFieldIds;

      const fieldsHtml = [];
      for (const fid of fieldIds) {
        const raw = String(character.valuesById?.[fid] ?? '');
        const value = raw.trim();
        if (!value) continue;
        const label = String(info.labelById.get(fid) ?? '');
        fieldsHtml.push(
          `<div class="field"><div class="fieldTop"><span class="fid">${escapeHtml(fid)}</span><span class="label">${escapeHtml(
            label
          )}</span></div><div class="value">${escapeHtml(raw)}</div></div>`
        );
      }
      const fieldsBlock =
        fieldsHtml.length && safeFormat === 'portfolio'
          ? `<details class="fieldsDetails"><summary>Details</summary><div class="fields">${fieldsHtml.join(
              ''
            )}</div></details>`
          : fieldsHtml.length
          ? `<div class="fields">${fieldsHtml.join('')}</div>`
          : '';

      const charImages = Array.isArray(character.images) ? character.images : [];
      const selectedImages = (() => {
        if (safeImageMode === 'all') return charImages;
        const tag = safeImageMode === 'frontpage' ? 'frontpage' : safeImageMode === 'carousel' ? 'carousel' : null;
        if (!tag) return charImages;
        return charImages.filter((img) => Array.isArray(img.tags) && img.tags.includes(tag));
      })();

      const imagesDir = path.join(dirs.images, fileBase);
      ensureDir(imagesDir);

      const imgTags = [];
      for (const img of selectedImages) {
        const imageId = String(img?.id ?? '').trim();
        if (!imageId) continue;

        const srcAbs = await this.getImageAbsPath({ imageId, kind: 'original' });
        if (!srcAbs || !fs.existsSync(srcAbs)) continue;

        const srcExt = path.extname(srcAbs).toLowerCase();
        const baseName = sanitizeFileName(null, `${shortStableIdForPath(imageId)}${srcExt || '.img'}`);
        const destAbs = uniquePath(imagesDir, baseName);
        const destRel = `../images/${encodeURIComponent(fileBase)}/${encodeURIComponent(path.basename(destAbs))}`;

        let wrote = false;
        if (this.electronNativeImage) {
          try {
            const nimg = this.electronNativeImage.createFromPath(srcAbs);
            const size = nimg.getSize();
            const maxDim = Math.max(Number(size?.width) || 0, Number(size?.height) || 0);
            const shouldResize = maxDim > 2048;
            const resized = shouldResize
              ? (Number(size?.width) || 0) >= (Number(size?.height) || 0)
                ? nimg.resize({ width: 2048 })
                : nimg.resize({ height: 2048 })
              : nimg;
            const bytes = resized.toJPEG(80);
            const jpgAbs = destAbs.replace(/\.[^.]+$/, '') + '.jpg';
            fs.writeFileSync(jpgAbs, bytes);
            imgTags.push(`<img src="${destRel.replace(/\.[^.]+$/, '.jpg')}" alt="" loading="lazy" />`);
            wrote = true;
          } catch {
            wrote = false;
          }
        }

        if (!wrote) {
          fs.copyFileSync(srcAbs, destAbs);
          imgTags.push(`<img src="${destRel}" alt="" loading="lazy" />`);
        }

        exportedImages += 1;
      }

      // Icon
      let iconRel = '';
      const iconImageId = String(character.iconImageId || '').trim();
      if (iconImageId) {
        const srcAbs = await this.getImageAbsPath({ imageId: iconImageId, kind: 'thumb' });
        if (srcAbs && fs.existsSync(srcAbs)) {
          const ext = path.extname(srcAbs).toLowerCase() || '.png';
          const destAbs = path.join(dirs.icons, `${fileBase}${ext}`);
          try {
            fs.copyFileSync(srcAbs, destAbs);
            iconRel = `assets/icons/${encodeURIComponent(path.basename(destAbs))}`;
          } catch {
            iconRel = '';
          }
        }
      }

      const pageHtml = charTpl
        .replaceAll('{{CHAR_NAME}}', escapeHtml(character.displayName))
        .replaceAll('{{CHAR_ID}}', escapeHtml(publicId))
        .replaceAll('{{FIELDS_BLOCK}}', fieldsBlock)
        .replaceAll('{{IMAGES}}', imgTags.join(''));

      fs.writeFileSync(path.join(dirs.characters, pageFileName), pageHtml, 'utf8');

      const cardImg = iconRel ? `<img src="${escapeHtml(iconRel)}" alt="" />` : `<div class="muted">No icon</div>`;
      cards.push(
        `<a class="card" href="characters/${encodeURIComponent(pageFileName)}"><div class="cardImg">${cardImg}</div><div class="cardBody"><div class="cardName">${escapeHtml(
          character.displayName
        )}</div><div class="muted"><code>${escapeHtml(publicId)}</code></div></div></a>`
      );

      exportedCharacters += 1;
    }

    const subtitle = `${exportedCharacters} characters • ${exportedImages} images • ${safeFormat}`;
    const indexHtml = indexTpl
      .replaceAll('{{EXPORT_SUBTITLE}}', escapeHtml(subtitle))
      .replaceAll('{{CHAR_CARDS}}', cards.join(''));
    fs.writeFileSync(path.join(siteDir, 'index.html'), indexHtml, 'utf8');

    const readmeLines = [
      'CastKit Codex — Web Export',
      '',
      `Format: ${safeFormat}`,
      `Image mode: ${safeImageMode}`,
      `Field mode: ${safeFieldMode}`,
      '',
      'Open index.html in a browser. This export is fully offline (no CDN dependencies).',
      'License: not set by CastKit Codex. If you publish this site, add a LICENSE file or otherwise state your intended license.',
      '',
    ];
    fs.writeFileSync(path.join(siteDir, 'README.txt'), readmeLines.join('\n'), 'utf8');

    await this._audit('webPortfolio.export', null, {
      outDir: siteDir,
      characterCount: exportedCharacters,
      imageCount: exportedImages,
      format: safeFormat,
      imageMode: safeImageMode,
      fieldMode: safeFieldMode,
    });

    return { ok: true, outDir: siteDir, characterCount: exportedCharacters, imageCount: exportedImages };
  }

  async exportMoodboardPng({ docId = null, title = 'Moodboard', pngBase64, outDir = null } = {}) {
    const base64 = String(pngBase64 ?? '').trim();
    if (!base64) throw new Error('pngBase64 is required');
    const prefix = 'data:image/png;base64,';
    const cleaned = base64.startsWith(prefix) ? base64.slice(prefix.length) : base64;
    const bytes = Buffer.from(cleaned, 'base64');
    if (!bytes.length) throw new Error('pngBase64 is invalid');

    const outPath = this.allocateMoodboardExportPath({ docId, title, outDir, ext: 'png' });
    fs.writeFileSync(outPath, bytes);

    await this._audit('moodboard.exportPng', null, { outPath, docId: docId ? String(docId) : null });
    return { ok: true, path: outPath };
  }

  allocateMoodboardExportPath({ docId = null, title = 'Moodboard', outDir = null, ext = 'png' } = {}) {
    const exportRoot = outDir ? String(outDir) : this.getPaths().exportsDir;
    assertNotForbiddenDrive(exportRoot, 'Export destination');
    const safeTitle = sanitizeFileName(String(title ?? '').trim() || 'moodboard', 'moodboard');
    const idPart = docId ? shortStableIdForPath(docId) : 'mood';
    const safeExt = String(ext ?? 'png').replace(/^\.+/, '').toLowerCase() || 'png';
    const fileName = sanitizeFileName(null, `${safeTitle}__${idPart}__${toIsoSafeTimestamp()}.${safeExt}`);

    const exportDir = path.join(exportRoot, 'moodboards');
    ensureDir(exportDir);
    return uniquePath(exportDir, fileName);
  }

  async exportMoodboardPdf({ docId = null, title = 'Moodboard', pdfBytes, outDir = null } = {}) {
    const bytes = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes || '');
    if (!bytes.length) throw new Error('pdfBytes is required');

    const outPath = this.allocateMoodboardExportPath({ docId, title, outDir, ext: 'pdf' });
    fs.writeFileSync(outPath, bytes);

    await this._audit('moodboard.exportPdf', null, { outPath, docId: docId ? String(docId) : null });
    return { ok: true, path: outPath };
  }

  _sheetTextToMarkdown(sheetText) {
    // Deterministic: wrap in fenced code block to preserve bytes.
    return ['# CastKit Codex Export', '', '```text', sheetText.replaceAll('\r\n', '\n').replaceAll('\r', '\n'), '```', ''].join('\n');
  }

  // PDF generation lives in the Electron main process.

  async listVersions(characterId) {
    const rows = await all(
      this.db,
      `SELECT version_id, created_at, source, export_relative_path, sheet_bytes_hash, notes
       FROM SheetVersion WHERE character_id = ?
       ORDER BY created_at DESC`,
      [characterId]
    );
    return rows.map((r) => ({
      id: r.version_id,
      createdAt: r.created_at,
      source: r.source,
      relativePath: r.export_relative_path,
      hash: r.sheet_bytes_hash,
      notes: r.notes ?? '',
    }));
  }

  async diffVersions({ characterId, fromVersionId, toVersionId }) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');
    const templateAst = await this.getTemplateAst(character.templateId);

    const paths = this.getCharacterPaths(characterId);
    const fromRow = await get(
      this.db,
      `SELECT export_relative_path FROM SheetVersion WHERE character_id = ? AND version_id = ?`,
      [characterId, fromVersionId]
    );
    const toRow = await get(
      this.db,
      `SELECT export_relative_path FROM SheetVersion WHERE character_id = ? AND version_id = ?`,
      [characterId, toVersionId]
    );
    if (!fromRow || !toRow) throw new Error('Version not found');

    const fromAbs = path.join(paths.base, String(fromRow.export_relative_path || '').replaceAll('/', path.sep));
    const toAbs = path.join(paths.base, String(toRow.export_relative_path || '').replaceAll('/', path.sep));
    const fromText = fs.readFileSync(fromAbs, 'utf8');
    const toText = fs.readFileSync(toAbs, 'utf8');

    const fromExtraction = extractFieldAssignmentsFromText(fromText);
    const toExtraction = extractFieldAssignmentsFromText(toText);

    const fieldMetaById = new Map();
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        fieldMetaById.set(field.id, { label: field.label, section: section.title });
      }
    }

    const changes = [];
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        const a = String(fromExtraction.assignments.get(field.id) ?? '');
        const b = String(toExtraction.assignments.get(field.id) ?? '');
        if (a === b) continue;
        const meta = fieldMetaById.get(field.id) || { label: field.label, section: section.title };
        changes.push({
          fieldId: field.id,
          label: meta.label,
          section: meta.section,
          fromValue: a,
          toValue: b,
        });
      }
    }

    return {
      characterId,
      fromVersionId,
      toVersionId,
      changeCount: changes.length,
      changes,
    };
  }

  async revertPreviewFromVersion({ characterId, versionId }) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');
    const templateAst = await this.getTemplateAst(character.templateId);

    const paths = this.getCharacterPaths(characterId);
    const ver = await get(
      this.db,
      `SELECT export_relative_path FROM SheetVersion WHERE character_id = ? AND version_id = ?`,
      [characterId, versionId]
    );
    if (!ver) throw new Error('Version not found');
    const abs = path.join(paths.base, String(ver.export_relative_path || '').replaceAll('/', path.sep));
    const text = fs.readFileSync(abs, 'utf8');
    const extraction = extractFieldAssignmentsFromText(text);

    const currentValues = character.valuesById || {};
    const proposedById = {};
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        proposedById[field.id] = extraction.assignments.has(field.id) ? extraction.assignments.get(field.id) : '';
      }
    }

    const protectedIds = new Set(await this.listProtectedFieldIds(characterId));

    const { issues } = validateCharacterValues(templateAst, proposedById, 'strict');
    const issuesById = new Map();
    for (const i of issues) {
      const arr = issuesById.get(i.fieldId) || [];
      arr.push(i);
      issuesById.set(i.fieldId, arr);
    }

    const changes = [];
    for (const section of templateAst.sections) {
      for (const field of section.fields) {
        const proposed = String(proposedById[field.id] ?? '');
        const current = String(currentValues[field.id] ?? '');
        const fieldIssues = issuesById.get(field.id) || [];
        const isProtected = protectedIds.has(field.id);

        let changeType = 'same';
        if (current !== proposed) {
          if (fieldIssues.some((i) => i.severity === 'error')) changeType = 'invalid';
          else if (!current.trim().length && proposed.trim().length) changeType = 'add';
          else changeType = 'modify';
        }

        let defaultSelected = current !== proposed && changeType !== 'invalid';
        if (isProtected) defaultSelected = false;

        changes.push({
          fieldId: field.id,
          label: field.label,
          section: section.title,
          currentValue: current,
          proposedValue: proposed,
          changeType,
          isProtected,
          defaultSelected,
          issues: fieldIssues,
        });
      }
    }

    const knownIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    const unmapped = [];
    for (const [fieldId] of extraction.assignments) {
      if (!knownIds.has(fieldId)) {
        unmapped.push({ fieldId, rawLine: extraction.rawById.get(fieldId) || `${fieldId}: ${extraction.assignments.get(fieldId)}` });
      }
    }

    return { targetCharacterId: characterId, changes, unmapped };
  }

  async revertApplyFromVersion({ characterId, versionId, selectedFieldIds, validationMode = 'strict', allowSaveWithErrors = false }) {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');

    const paths = this.getCharacterPaths(characterId);
    const ver = await get(
      this.db,
      `SELECT export_relative_path FROM SheetVersion WHERE character_id = ? AND version_id = ?`,
      [characterId, versionId]
    );
    if (!ver) throw new Error('Version not found');
    const abs = path.join(paths.base, String(ver.export_relative_path || '').replaceAll('/', path.sep));
    const text = fs.readFileSync(abs, 'utf8');
    const extraction = extractFieldAssignmentsFromText(text);

    const protectedIds = new Set(await this.listProtectedFieldIds(characterId));
    const selected = new Set((selectedFieldIds || []).filter((fid) => !protectedIds.has(fid)));
    const updates = {};
    for (const [fieldId, valueText] of extraction.assignments) {
      if (!selected.has(fieldId)) continue;
      updates[fieldId] = String(valueText ?? '');
    }

    // Ensure clearing works even if the version file lacks the line (treat as blank).
    for (const fid of Array.from(selected)) {
      if (!Object.prototype.hasOwnProperty.call(updates, fid)) updates[fid] = '';
    }

    const merged = { ...character.valuesById, ...updates };
    const res = await this.saveCharacter({
      characterId,
      valuesById: merged,
      validationMode,
      allowSaveWithErrors,
      source: 'ui_edit',
      versionNotes: `Reverted fields from version ${versionId}.`,
    });
    if (!res.ok) return res;
    await this._audit('version.revertApply', characterId, { versionId, fieldCount: Array.from(selected).length });
    return { ok: true, issues: res.issues };
  }

  async importImages({ characterId, filePaths, duplicatePolicy = 'skip', sourceUrl, sourceNote, sourcePath } = {}) {
    const paths = this.getCharacterPaths(characterId);
    ensureDir(paths.imagesOriginalDir);
    ensureDir(paths.imagesThumbDir);

    const imported = [];
    const duplicates = [];

    const sourceUrlText = sourceUrl !== undefined ? String(sourceUrl || '').trim() || null : null;
    const sourceNoteText = sourceNote !== undefined ? String(sourceNote ?? '') : null;
    const sourcePathOverride = sourcePath !== undefined ? (sourcePath == null ? null : String(sourcePath)) : undefined;

    // fileHash -> { existing: number, imported: number }
    const counts = new Map();

    for (const srcPath of filePaths || []) {
      const bytes = fs.readFileSync(srcPath);
      const fileHash = sha256Hex(bytes);
      const ext = path.extname(srcPath).toLowerCase() || '.png';
      const hashPrefix = fileHash.slice(0, 16);

      if (!counts.has(fileHash)) {
        const row = await get(
          this.db,
          'SELECT COUNT(*) AS c FROM ImageAsset WHERE character_id = ? AND file_hash = ?',
          [characterId, fileHash]
        );
        counts.set(fileHash, { existing: Number(row?.c || 0), imported: 0 });
      }

      const c = counts.get(fileHash);
      const before = c.existing + c.imported;
      const isDup = before > 0;

      if (isDup) {
        duplicates.push({
          srcPath,
          fileHash,
          existingCount: c.existing,
          alreadyImportedInBatch: c.imported,
        });
        if (duplicatePolicy === 'skip') continue;
      }

      const nextIndex = before === 0 ? null : before + 1;
      const stem = nextIndex ? `${hashPrefix}__dup${nextIndex}` : hashPrefix;
      const baseName = `${stem}${ext}`;
      const rel = path.join('images', 'original', baseName);
      const dest = path.join(paths.base, rel);

      fs.writeFileSync(dest, bytes);

      // Thumbnail generation (best-effort).
      let thumbRel = null;
      const imageId = randomId('img_');
      const sourcePathText = sourcePathOverride !== undefined ? sourcePathOverride : srcPath;

      if (this.electronNativeImage) {
        try {
          const img = this.electronNativeImage.createFromPath(dest);
          const size = img.getSize();
          const thumb = img.resize({ width: 320 });
          const thumbName = `${stem}.png`;
          thumbRel = path.join('images', 'thumb', thumbName);
          fs.writeFileSync(path.join(paths.base, thumbRel), thumb.toPNG());

          await run(
            this.db,
            `INSERT INTO ImageAsset(image_id, character_id, relative_path, file_hash, width, height, favorite, rating, notes, tags_json, storage_mode, source_path, source_url, source_note)
             VALUES(?, ?, ?, ?, ?, ?, 0, 0, '', '[]', 'copy', ?, ?, ?)`,
            [imageId, characterId, rel.replaceAll('\\', '/'), fileHash, size.width, size.height, sourcePathText, sourceUrlText, sourceNoteText]
          );
        } catch {
          await run(
            this.db,
            `INSERT INTO ImageAsset(image_id, character_id, relative_path, file_hash, favorite, rating, notes, tags_json, storage_mode, source_path, source_url, source_note)
             VALUES(?, ?, ?, ?, 0, 0, '', '[]', 'copy', ?, ?, ?)`,
            [imageId, characterId, rel.replaceAll('\\', '/'), fileHash, sourcePathText, sourceUrlText, sourceNoteText]
          );
        }
      } else {
        await run(
          this.db,
          `INSERT INTO ImageAsset(image_id, character_id, relative_path, file_hash, favorite, rating, notes, tags_json, storage_mode, source_path, source_url, source_note)
           VALUES(?, ?, ?, ?, 0, 0, '', '[]', 'copy', ?, ?, ?)`,
          [imageId, characterId, rel.replaceAll('\\', '/'), fileHash, sourcePathText, sourceUrlText, sourceNoteText]
        );
      }

      imported.push({
        id: imageId,
        relativePath: rel.replaceAll('\\', '/'),
        fileHash,
        thumbRelativePath: thumbRel?.replaceAll('\\', '/') ?? null,
      });
      c.imported += 1;
    }

    await this._audit('gallery.importImages', characterId, {
      importedCount: imported.length,
      duplicateCount: duplicates.length,
      duplicatePolicy: String(duplicatePolicy || ''),
    });

    return { imported, duplicates };
  }

  async importFromUrl({ characterId, url, sourceNote } = {}) {
    const targetId = String(characterId || '').trim();
    if (!targetId) throw new Error('characterId is required');

    const rawUrl = String(url || '').trim();
    if (!rawUrl) throw new Error('url is required');

    let parsed = null;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http(s) URLs are supported');
    }

    const maxBytes = 100 * 1024 * 1024;
    const timeoutMs = 5 * 60_000;

    const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
    const extByContentType = new Map([
      ['image/png', '.png'],
      ['image/jpeg', '.jpg'],
      ['image/jpg', '.jpg'],
      ['image/webp', '.webp'],
      ['image/gif', '.gif'],
      ['image/bmp', '.bmp'],
    ]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Timed out downloading URL')), timeoutMs);

    let tmpPath = null;
    let finalUrl = rawUrl;

    try {
      const res = await fetch(parsed.toString(), { redirect: 'follow', signal: controller.signal });
      finalUrl = String(res?.url || rawUrl);

      if (!res.ok) {
        throw new Error(`Download failed (HTTP ${res.status})`);
      }

      const contentTypeRaw = String(res.headers.get('content-type') || '').toLowerCase();
      const contentType = contentTypeRaw.split(';')[0].trim();

      let extFromUrl = null;
      try {
        extFromUrl = path.extname(new URL(finalUrl).pathname).toLowerCase();
      } catch {
        extFromUrl = path.extname(parsed.pathname).toLowerCase();
      }
      const urlExt = allowedExt.has(extFromUrl) ? extFromUrl : null;

      const isImageContentType = contentType.startsWith('image/');
      const isAllowedGenericContentType = !contentType || contentType === 'application/octet-stream';
      if (!isImageContentType && !isAllowedGenericContentType) {
        throw new Error(`Unsupported content-type: ${contentTypeRaw || '(missing)'}`);
      }

      const ext = extByContentType.get(contentType) || urlExt;
      if (!ext || !allowedExt.has(ext)) {
        throw new Error(`Unsupported or unknown image type (content-type: ${contentTypeRaw || '(missing)'})`);
      }

      const contentLength = Number(res.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('File is too large (> 100 MB)');
      }

      if (!res.body) throw new Error('Download failed (empty body)');

      const tmpName = `ckc_urlimport_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
      tmpPath = path.join(os.tmpdir(), tmpName);

      let downloaded = 0;
      const limiter = new Transform({
        transform(chunk, _enc, cb) {
          downloaded += chunk.length;
          if (downloaded > maxBytes) return cb(new Error('File is too large (> 100 MB)'));
          cb(null, chunk);
        },
      });

      await pipeline(Readable.fromWeb(res.body), limiter, fs.createWriteStream(tmpPath));

      const out = await this.importImages({
        characterId: targetId,
        filePaths: [tmpPath],
        duplicatePolicy: 'skip',
        sourceUrl: finalUrl,
        sourceNote: sourceNote !== undefined ? String(sourceNote ?? '') : null,
        sourcePath: null,
      });

      await this._audit('web.importFromUrl', targetId, {
        url: rawUrl,
        finalUrl,
        importedCount: out.imported?.length ?? 0,
        duplicateCount: out.duplicates?.length ?? 0,
      });

      return out;
    } finally {
      clearTimeout(timer);
      if (tmpPath) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // ignore best-effort cleanup
        }
      }
    }
  }

  async moveImagesToCharacter({ imageIds, targetCharacterId }) {
    const targetId = String(targetCharacterId || '').trim();
    if (!targetId) throw new Error('targetCharacterId is required');

    const target = await get(this.db, 'SELECT character_id FROM Character WHERE character_id = ?', [targetId]);
    if (!target) throw new Error('Target character not found');

    const rawIds = Array.isArray(imageIds) ? imageIds : [];
    const ids = [];
    const seen = new Set();
    for (const id of rawIds) {
      const s = String(id ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      ids.push(s);
    }
    if (ids.length === 0) return { ok: true, moved: [], errors: [] };

    const targetPaths = this.getCharacterPaths(targetId);
    ensureDir(targetPaths.imagesOriginalDir);
    ensureDir(targetPaths.imagesThumbDir);

    const moved = [];
    const errors = [];

    for (const imageId of ids) {
      try {
        const row = await get(
          this.db,
          'SELECT image_id, character_id, relative_path, storage_mode, source_path FROM ImageAsset WHERE image_id = ?',
          [imageId]
        );
        if (!row) throw new Error('Image not found');

        const fromId = String(row.character_id || '').trim();
        if (!fromId) throw new Error('Image has no character_id');
        if (fromId === targetId) {
          moved.push({ imageId, fromCharacterId: fromId, toCharacterId: targetId, relativePath: String(row.relative_path || '') });
          continue;
        }

        const relRaw = String(row.relative_path || '');
        const relOs = relRaw.replaceAll('/', path.sep);
        const fileName = path.basename(relOs);
        const mode = String(row.storage_mode || 'copy');

        let nextRel = relRaw;
        let destOriginalAbs = null;

        if (mode === 'copy') {
          const fromPaths = this.getCharacterPaths(fromId);
          const oldOriginalAbs = path.join(fromPaths.base, relOs);

          const destDir = targetPaths.imagesOriginalDir;
          let destAbs = path.join(destDir, fileName);
          if (fs.existsSync(destAbs)) destAbs = uniquePath(destDir, fileName);

          const newFileName = path.basename(destAbs);
          nextRel = path.join('images', 'original', newFileName).replaceAll('\\', '/');
          destOriginalAbs = destAbs;

          if (fs.existsSync(oldOriginalAbs)) {
            try {
              fs.renameSync(oldOriginalAbs, destAbs);
            } catch {
              fs.copyFileSync(oldOriginalAbs, destAbs);
              try {
                fs.unlinkSync(oldOriginalAbs);
              } catch {
                // ignore best-effort cleanup
              }
            }
          }

          const oldStem = fileName.replace(path.extname(fileName), '');
          const oldThumbAbs = path.join(fromPaths.imagesThumbDir, `${oldStem}.png`);
          const newStem = newFileName.replace(path.extname(newFileName), '');
          const destThumbAbs = path.join(targetPaths.imagesThumbDir, `${newStem}.png`);

          let wroteThumb = false;
          if (this.electronNativeImage && destOriginalAbs && fs.existsSync(destOriginalAbs)) {
            try {
              const img = this.electronNativeImage.createFromPath(destOriginalAbs);
              const thumb = img.resize({ width: 320 });
              fs.writeFileSync(destThumbAbs, thumb.toPNG());
              wroteThumb = true;
            } catch {
              wroteThumb = false;
            }
          }

          if (!wroteThumb && fs.existsSync(oldThumbAbs) && !fs.existsSync(destThumbAbs)) {
            try {
              fs.copyFileSync(oldThumbAbs, destThumbAbs);
              wroteThumb = true;
            } catch {
              // ignore
            }
          }

          if (fs.existsSync(oldThumbAbs)) {
            try {
              fs.unlinkSync(oldThumbAbs);
            } catch {
              // ignore
            }
          }
        } else {
          // Reference mode: keep relative_path but ensure the thumbnail exists in the new character folder.
          const fromPaths = this.getCharacterPaths(fromId);
          const stem = fileName.replace(path.extname(fileName), '');
          if (stem) {
            const destThumbAbs = path.join(targetPaths.imagesThumbDir, `${stem}.png`);
            if (!fs.existsSync(destThumbAbs)) {
              let wroteThumb = false;
              const src = row.source_path ? String(row.source_path) : null;
              if (this.electronNativeImage && src && fs.existsSync(src)) {
                try {
                  const img = this.electronNativeImage.createFromPath(src);
                  const thumb = img.resize({ width: 320 });
                  fs.writeFileSync(destThumbAbs, thumb.toPNG());
                  wroteThumb = true;
                } catch {
                  wroteThumb = false;
                }
              }
              const oldThumbAbs = path.join(fromPaths.imagesThumbDir, `${stem}.png`);
              if (!wroteThumb && fs.existsSync(oldThumbAbs)) {
                try {
                  fs.copyFileSync(oldThumbAbs, destThumbAbs);
                } catch {
                  // ignore
                }
              }
            }
          }
        }

        await run(this.db, 'UPDATE ImageAsset SET character_id = ?, relative_path = ? WHERE image_id = ?', [
          targetId,
          String(nextRel || '').replaceAll('\\', '/'),
          imageId,
        ]);

        // If this image was used as a character icon, clear it from the source character (safe UX).
        await run(this.db, 'UPDATE Character SET icon_image_id = NULL WHERE character_id = ? AND icon_image_id = ?', [fromId, imageId]);

        await run(this.db, 'UPDATE Character SET updated_at = CURRENT_TIMESTAMP WHERE character_id IN (?, ?)', [fromId, targetId]);

        moved.push({ imageId, fromCharacterId: fromId, toCharacterId: targetId, relativePath: String(nextRel || '') });
      } catch (err) {
        errors.push({ imageId, message: String(err?.message || err || 'Unknown error') });
      }
    }

    await this._audit('gallery.moveImagesToCharacter', targetId, { movedCount: moved.length, errorCount: errors.length });
    return { ok: true, moved, errors };
  }

  async deleteImages({ imageIds, deleteFiles = true } = {}) {
    const rawIds = Array.isArray(imageIds) ? imageIds : [];
    const ids = [];
    const seen = new Set();
    for (const id of rawIds) {
      const s = String(id ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      ids.push(s);
    }
    if (ids.length === 0) return { ok: true, deleted: [], errors: [] };

    const deleted = [];
    const errors = [];

    for (const imageId of ids) {
      try {
        const row = await get(
          this.db,
          'SELECT image_id, character_id, relative_path, storage_mode, source_path FROM ImageAsset WHERE image_id = ?',
          [imageId]
        );
        if (!row) continue;

        const characterId = String(row.character_id || '').trim();
        const relRaw = String(row.relative_path || '');
        const relOs = relRaw.replaceAll('/', path.sep);
        const mode = String(row.storage_mode || 'copy');

        const paths = characterId ? this.getCharacterPaths(characterId) : null;
        const fileName = path.basename(relOs);
        const stem = fileName.replace(path.extname(fileName), '');

        if (deleteFiles && paths) {
          if (mode === 'copy') {
            const origAbs = path.join(paths.base, relOs);
            try {
              if (fs.existsSync(origAbs)) fs.unlinkSync(origAbs);
            } catch {
              // ignore best-effort cleanup
            }
          }

          if (stem) {
            const thumbAbs = path.join(paths.imagesThumbDir, `${stem}.png`);
            try {
              if (fs.existsSync(thumbAbs)) fs.unlinkSync(thumbAbs);
            } catch {
              // ignore best-effort cleanup
            }
          }
        }

        await run(this.db, 'DELETE FROM ImageAsset WHERE image_id = ?', [imageId]);
        await run(this.db, 'UPDATE Character SET icon_image_id = NULL WHERE icon_image_id = ?', [imageId]);
        deleted.push(imageId);
      } catch (err) {
        errors.push({ imageId, message: String(err?.message || err || 'Unknown error') });
      }
    }

    await this._audit('gallery.deleteImages', null, { deletedCount: deleted.length, errorCount: errors.length });
    return { ok: true, deleted, errors };
  }

  async repairThumbnails({ characterId }) {
    const paths = this.getCharacterPaths(characterId);
    ensureDir(paths.imagesThumbDir);

    const rows = await all(
      this.db,
      `SELECT image_id, relative_path, storage_mode, source_path FROM ImageAsset WHERE character_id = ?`,
      [characterId]
    );

    let created = 0;
    let skipped = 0;

    for (const r of rows) {
      const rel = String(r.relative_path || '');
      const fileName = path.basename(rel.replaceAll('/', path.sep));
      const stem = fileName.replace(path.extname(fileName), '');
      if (!stem) {
        skipped += 1;
        continue;
      }

      const thumbAbs = path.join(paths.imagesThumbDir, `${stem}.png`);
      if (fs.existsSync(thumbAbs)) {
        skipped += 1;
        continue;
      }

      const mode = String(r.storage_mode || 'copy');
      const origAbs =
        mode === 'reference' && r.source_path
          ? String(r.source_path)
          : path.join(paths.base, rel.replaceAll('/', path.sep));

      if (!origAbs || !fs.existsSync(origAbs) || !this.electronNativeImage) {
        skipped += 1;
        continue;
      }

      try {
        const img = this.electronNativeImage.createFromPath(origAbs);
        const thumb = img.resize({ width: 320 });
        fs.writeFileSync(thumbAbs, thumb.toPNG());
        created += 1;
      } catch {
        skipped += 1;
      }
    }

    await this._audit('gallery.repairThumbnails', characterId, { created, skipped, total: rows.length });
    return { ok: true, created, skipped, total: rows.length };
  }

  async repairMissingImagesByHash({
    scanDir,
    includeSubdirs = true,
    dryRun = true,
    topN = 200,
    maxScanFiles = 50_000,
  } = {}) {
    const startedAt = new Date().toISOString();
    const root = String(scanDir || '').trim();
    if (!root) throw new Error('scanDir is required');
    if (!fs.existsSync(root)) throw new Error(`scanDir not found: ${root}`);

    const lim = Math.max(1, Math.min(5000, Number(topN) || 200));
    const maxFiles = Math.max(1, Math.min(500_000, Number(maxScanFiles) || 50_000));

    const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

    const filePaths = [];
    const dirQueue = [root];
    while (dirQueue.length > 0 && filePaths.length < maxFiles) {
      const dir = dirQueue.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const ent of entries) {
        if (filePaths.length >= maxFiles) break;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (includeSubdirs) dirQueue.push(abs);
          continue;
        }
        if (!ent.isFile()) continue;
        const ext = path.extname(ent.name).toLowerCase();
        if (!allowedExts.has(ext)) continue;
        filePaths.push(abs);
      }
    }

    const hashToPaths = new Map();
    let hashedFiles = 0;
    let hashErrors = 0;
    for (const p of filePaths) {
      try {
        const bytes = fs.readFileSync(p);
        const h = sha256Hex(bytes);
        hashedFiles += 1;
        const list = hashToPaths.get(h) ?? [];
        if (list.length < 8) list.push(p);
        hashToPaths.set(h, list);
      } catch {
        hashErrors += 1;
      }
    }

    const imageRows = await all(
      this.db,
      `SELECT image_id, character_id, relative_path, file_hash, storage_mode, source_path
       FROM ImageAsset`,
      []
    );

    const missing = [];
    for (const r of imageRows) {
      const imageId = String(r.image_id || '');
      const characterId = String(r.character_id || '');
      const rel = String(r.relative_path || '');
      const fileHash = String(r.file_hash || '');
      const mode = String(r.storage_mode || 'copy');

      if (!imageId || !characterId || !rel || !fileHash) continue;

      const cPaths = this.getCharacterPaths(characterId);
      const expectedAbs = path.join(cPaths.base, rel.replaceAll('/', path.sep));
      const origAbs =
        mode === 'reference' && r.source_path
          ? String(r.source_path)
          : expectedAbs;

      if (origAbs && fs.existsSync(origAbs)) continue;

      missing.push({
        imageId,
        characterId,
        relativePath: rel,
        fileHash,
        storageMode: mode,
        expectedAbs,
      });
    }

    const planned = [];
    for (const m of missing) {
      if (m.storageMode !== 'copy') continue;
      const candidates = hashToPaths.get(m.fileHash);
      if (!candidates || candidates.length === 0) continue;
      planned.push({
        imageId: m.imageId,
        characterId: m.characterId,
        fileHash: m.fileHash,
        srcPath: candidates[0],
        destPath: m.expectedAbs,
        relativePath: m.relativePath,
      });
    }

    let copied = 0;
    let skippedExisting = 0;
    let copyErrors = 0;
    let thumbsCreated = 0;
    let thumbErrors = 0;

    if (!dryRun) {
      for (const a of planned) {
        try {
          if (fs.existsSync(a.destPath)) {
            skippedExisting += 1;
            continue;
          }
          ensureDir(path.dirname(a.destPath));
          fs.copyFileSync(a.srcPath, a.destPath);
          copied += 1;

          const fileName = path.basename(a.destPath);
          const stem = fileName.replace(path.extname(fileName), '');
          if (!stem || !this.electronNativeImage) continue;

          const cPaths = this.getCharacterPaths(a.characterId);
          ensureDir(cPaths.imagesThumbDir);
          const thumbAbs = path.join(cPaths.imagesThumbDir, `${stem}.png`);
          if (fs.existsSync(thumbAbs)) continue;

          try {
            const img = this.electronNativeImage.createFromPath(a.destPath);
            const thumb = img.resize({ width: 320 });
            fs.writeFileSync(thumbAbs, thumb.toPNG());
            thumbsCreated += 1;
          } catch {
            thumbErrors += 1;
          }
        } catch {
          copyErrors += 1;
        }
      }
    }

    const paths = this.getPaths();
    const reportsDir = path.join(paths.exportsDir, 'repair_reports');
    ensureDir(reportsDir);

    const report = {
      kind: 'repairMissingImagesByHash',
      startedAt,
      finishedAt: new Date().toISOString(),
      libraryRoot: this.libraryRoot,
      scanDir: root,
      includeSubdirs: !!includeSubdirs,
      dryRun: !!dryRun,
      maxScanFiles: maxFiles,
      scannedFiles: filePaths.length,
      hashedFiles,
      hashErrors,
      dbImages: imageRows.length,
      missingImages: missing.length,
      plannedActions: planned.length,
      copied,
      skippedExisting,
      copyErrors,
      thumbsCreated,
      thumbErrors,
      sampleActions: planned.slice(0, lim),
    };

    const reportName = `rehydrate_images__${toIsoSafeTimestamp()}${dryRun ? '__dryrun' : ''}.json`;
    const reportPath = path.join(reportsDir, reportName);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    await this._audit('repair.rehydrateMissingImagesByHash', null, {
      dryRun: !!dryRun,
      scanDir: root,
      scannedFiles: filePaths.length,
      hashedFiles,
      hashErrors,
      missingImages: missing.length,
      plannedActions: planned.length,
      copied,
      copyErrors,
      thumbsCreated,
      reportPath,
    });

    return { ok: true, reportPath, ...report };
  }

  async setImageMeta({ imageId, favorite, rating, notes, tags, sourceNote }) {
    const row = await get(this.db, 'SELECT character_id FROM ImageAsset WHERE image_id = ?', [imageId]);

    let tagsJson = null;
    if (tags !== undefined) {
      const cleaned = [];
      const seen = new Set();
      for (const t of Array.isArray(tags) ? tags : []) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        if (this._isSystemTag(s)) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        cleaned.push(s);
      }
      tagsJson = JSON.stringify(cleaned);
    }

    await run(
      this.db,
      `UPDATE ImageAsset
       SET favorite = COALESCE(?, favorite),
           rating = COALESCE(?, rating),
           notes = COALESCE(?, notes),
           tags_json = COALESCE(?, tags_json),
           source_note = COALESCE(?, source_note)
       WHERE image_id = ?`,
      [
        favorite !== undefined ? (favorite ? 1 : 0) : null,
        rating !== undefined ? Math.max(0, Math.min(5, Number(rating) || 0)) : null,
        notes !== undefined ? String(notes ?? '') : null,
        tagsJson,
        sourceNote !== undefined ? String(sourceNote ?? '') : null,
        imageId,
      ]
    );

    await this._audit('gallery.setImageMeta', row?.character_id ?? null, { imageId });
    return { ok: true };
  }

  _cleanSuggestedTags(suggestions, { maxTags = 24 } = {}) {
    const raw = Array.isArray(suggestions) ? suggestions : [];
    const cleaned = [];
    const seen = new Set();

    for (const s of raw) {
      if (!s) continue;
      const tagRaw = typeof s === 'string' ? s : s.tag;
      const tag = String(tagRaw ?? '')
        .trim()
        .replaceAll(/\s+/g, ' ');
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let confidence = 0.5;
      const confRaw = typeof s === 'object' && s ? s.confidence : undefined;
      if (confRaw !== undefined && confRaw !== null && confRaw !== '') {
        const confNum = Number(confRaw);
        if (Number.isFinite(confNum)) confidence = Math.max(0, Math.min(1, confNum));
      }

      cleaned.push({ tag, confidence: Math.round(confidence * 1000) / 1000 });
      if (cleaned.length >= Math.max(1, Math.min(200, Number(maxTags) || 24))) break;
    }

    return cleaned;
  }

  async getImageTagSuggestions({ imageId }) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');
    const row = await get(this.db, `SELECT image_id, suggested_tags_json, auto_tagged_at FROM ImageAsset WHERE image_id = ?`, [id]);
    if (!row) throw new Error('Image not found');

    let suggestions = [];
    try {
      const parsed = JSON.parse(String(row.suggested_tags_json ?? '[]'));
      if (Array.isArray(parsed)) suggestions = parsed;
    } catch {
      suggestions = [];
    }

    return {
      ok: true,
      imageId: String(row.image_id ?? id),
      suggestions: this._cleanSuggestedTags(suggestions, { maxTags: 200 }),
      autoTaggedAt: row.auto_tagged_at ? String(row.auto_tagged_at) : null,
    };
  }

  async setImageTagSuggestions({ imageId, suggestions }) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const cleaned = this._cleanSuggestedTags(suggestions, { maxTags: 200 });
    await run(
      this.db,
      `UPDATE ImageAsset
       SET suggested_tags_json = ?,
           auto_tagged_at = CURRENT_TIMESTAMP
       WHERE image_id = ?`,
      [JSON.stringify(cleaned), id]
    );

    await this._audit('aiTagging.setSuggestions', null, { imageId: id, tagCount: cleaned.length });
    return { ok: true, imageId: id, suggestions: cleaned };
  }

  async clearImageTagSuggestions({ imageId }) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');
    await run(
      this.db,
      `UPDATE ImageAsset
       SET suggested_tags_json = '[]',
           auto_tagged_at = NULL
       WHERE image_id = ?`,
      [id]
    );
    await this._audit('aiTagging.clearSuggestions', null, { imageId: id });
    return { ok: true, imageId: id };
  }

  async listImageIdsForAiTagging({ mode = 'untagged', limit = 2500 } = {}) {
    const lim = Math.max(1, Math.min(50_000, Number(limit) || 2500));
    const m = String(mode ?? '').toLowerCase();

    if (m === 'all') {
      const rows = await all(this.db, `SELECT image_id FROM ImageAsset ORDER BY added_at DESC LIMIT ?`, [lim]);
      return rows.map((r) => String(r.image_id ?? '')).filter(Boolean);
    }

    const rows = await all(
      this.db,
      `
      SELECT image_id
      FROM ImageAsset
      WHERE (tags_json IS NULL OR TRIM(tags_json) = '' OR TRIM(tags_json) = '[]')
        AND (suggested_tags_json IS NULL OR TRIM(suggested_tags_json) = '' OR TRIM(suggested_tags_json) = '[]')
      ORDER BY added_at DESC
      LIMIT ?
    `,
      [lim]
    );
    return rows.map((r) => String(r.image_id ?? '')).filter(Boolean);
  }

  async getImagePalette({ imageId, colorCount = 6 } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const row = await get(
      this.db,
      `SELECT image_id, character_id, relative_path, storage_mode, source_path, palette_json
       FROM ImageAsset
       WHERE image_id = ?`,
      [id]
    );
    if (!row) throw new Error('Image not found');

    const existing = (() => {
      if (!row.palette_json) return null;
      try {
        const parsed = JSON.parse(row.palette_json);
        if (!Array.isArray(parsed)) return null;
        return parsed.map((c) => String(c)).filter(Boolean);
      } catch {
        return null;
      }
    })();

    if (existing) return { ok: true, imageId: id, palette: existing };
    if (!this.electronNativeImage) return { ok: true, imageId: id, palette: [] };

    const characterId = String(row.character_id ?? '').trim();
    const relRaw = String(row.relative_path ?? '');
    const mode = String(row.storage_mode ?? 'copy');
    const sourcePath = row.source_path != null ? String(row.source_path) : null;

    const paths = this.getCharacterPaths(characterId);
    const fileName = path.basename(relRaw.replaceAll('/', path.sep));
    const stem = fileName.replace(path.extname(fileName), '');
    const thumbAbs = stem ? path.join(paths.imagesThumbDir, `${stem}.png`) : null;

    const originalAbs =
      mode === 'reference' && sourcePath ? sourcePath : path.join(paths.base, relRaw.replaceAll('/', path.sep));

    const pickedAbs = thumbAbs && fs.existsSync(thumbAbs) ? thumbAbs : originalAbs;
    if (!pickedAbs || !fs.existsSync(pickedAbs)) return { ok: true, imageId: id, palette: [] };

    const cc = Math.max(1, Math.min(12, Number(colorCount) || 6));

    let palette = [];
    try {
      const img = this.electronNativeImage.createFromPath(pickedAbs);
      const resized = img.resize({ width: 96 });
      const size = resized.getSize();
      const bytes = resized.toBitmap();
      palette = extractDominantPaletteFromBitmap({
        width: size.width,
        height: size.height,
        bytes,
        colorCount: cc,
        channelOrder: 'bgra',
      });
    } catch {
      palette = [];
    }

    await run(this.db, `UPDATE ImageAsset SET palette_json = ? WHERE image_id = ?`, [JSON.stringify(palette), id]);
    await this._audit('image.palette.compute', characterId || null, {
      imageId: id,
      colorCount: cc,
      paletteCount: palette.length,
      source: thumbAbs && fs.existsSync(thumbAbs) ? 'thumb' : 'original',
    });

    return { ok: true, imageId: id, palette };
  }

  async ensureImagePalettes({ imageIds, colorCount = 6, maxImages = 2000 } = {}) {
    const rawIds = Array.isArray(imageIds) ? imageIds : [];
    const ids = [];
    const seen = new Set();
    for (const id of rawIds) {
      const s = String(id ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      ids.push(s);
      if (ids.length >= Math.max(1, Math.min(100_000, Number(maxImages) || 2000))) break;
    }

    const palettes = {};
    for (const id of ids) {
      try {
        const res = await this.getImagePalette({ imageId: id, colorCount });
        palettes[id] = Array.isArray(res?.palette) ? res.palette : [];
      } catch {
        palettes[id] = [];
      }
    }

    return { ok: true, palettes };
  }

  async getImageDhash({ imageId } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const row = await get(
      this.db,
      `SELECT image_id, character_id, relative_path, storage_mode, source_path, dhash_hex
       FROM ImageAsset
       WHERE image_id = ?`,
      [id]
    );
    if (!row) throw new Error('Image not found');

    if (row.dhash_hex != null) {
      const s = String(row.dhash_hex ?? '').trim().toLowerCase();
      if (s === '' || isHex64(s)) return { ok: true, imageId: id, dhash: s };
    }

    if (!this.electronNativeImage) return { ok: true, imageId: id, dhash: '' };

    const characterId = String(row.character_id ?? '').trim();
    const relRaw = String(row.relative_path ?? '');
    const mode = String(row.storage_mode ?? 'copy');
    const sourcePath = row.source_path != null ? String(row.source_path) : null;

    const paths = this.getCharacterPaths(characterId);
    const fileName = path.basename(relRaw.replaceAll('/', path.sep));
    const stem = fileName.replace(path.extname(fileName), '');
    const thumbAbs = stem ? path.join(paths.imagesThumbDir, `${stem}.png`) : null;

    const originalAbs =
      mode === 'reference' && sourcePath ? sourcePath : path.join(paths.base, relRaw.replaceAll('/', path.sep));

    const hasThumb = !!(thumbAbs && fs.existsSync(thumbAbs));
    const pickedAbs = hasThumb ? thumbAbs : originalAbs;
    if (!pickedAbs || !fs.existsSync(pickedAbs)) {
      await run(this.db, `UPDATE ImageAsset SET dhash_hex = ? WHERE image_id = ?`, ['', id]);
      return { ok: true, imageId: id, dhash: '' };
    }

    let dhash = '';
    try {
      const img = this.electronNativeImage.createFromPath(pickedAbs);
      const resized = img.resize({ width: 9, height: 8 });
      const size = resized.getSize();
      const bytes = resized.toBitmap();
      dhash = computeDhashHexFromBitmap({
        width: size.width,
        height: size.height,
        bytes,
        channelOrder: 'bgra',
      });
    } catch {
      dhash = '';
    }

    const stored = dhash && isHex64(dhash) ? String(dhash).trim().toLowerCase() : '';
    await run(this.db, `UPDATE ImageAsset SET dhash_hex = ? WHERE image_id = ?`, [stored, id]);
    await this._audit('image.dhash.compute', characterId || null, {
      imageId: id,
      source: hasThumb ? 'thumb' : 'original',
    });
    return { ok: true, imageId: id, dhash: stored };
  }

  async findSimilarImages({ imageId, maxDistance = 10, limit = 20, maxImages = 10_000 } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const thr = Math.max(0, Math.min(32, Number(maxDistance) || 10));
    const lim = Math.max(1, Math.min(200, Number(limit) || 20));
    const max = Math.max(10, Math.min(100_000, Number(maxImages) || 10_000));

    const targetRes = await this.getImageDhash({ imageId: id });
    const target = String(targetRes?.dhash ?? '').trim().toLowerCase();
    if (!target || !isHex64(target)) {
      await this._audit('image.similar.search', null, { imageId: id, threshold: thr, limit: lim, maxImages: max, matched: 0, reason: 'missing_dhash' });
      return { ok: true, imageId: id, threshold: thr, items: [], reason: 'missing_dhash' };
    }

    const rows = await all(
      this.db,
      `SELECT ia.image_id, ia.character_id, c.display_name, ia.favorite, ia.rating, ia.tags_json, ia.dhash_hex, ia.added_at
       FROM ImageAsset ia
       JOIN Character c ON c.character_id = ia.character_id
       WHERE ia.image_id != ?
       ORDER BY ia.added_at DESC
       LIMIT ?`,
      [id, max]
    );

    const items = [];
    let processed = 0;
    for (const r of rows) {
      processed += 1;
      const candId = String(r.image_id ?? '').trim();
      if (!candId) continue;
      const dh = r.dhash_hex != null ? String(r.dhash_hex ?? '').trim().toLowerCase() : '';
      if (!dh || !isHex64(dh)) continue;

      const distance = hammingDistanceHex64(target, dh);
      if (distance > thr) continue;

      let tags = [];
      try {
        const parsed = JSON.parse(r.tags_json ?? '[]');
        tags = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
      } catch {
        tags = [];
      }

      items.push({
        imageId: candId,
        characterId: String(r.character_id ?? '').trim(),
        characterName: String(r.display_name ?? ''),
        favorite: !!r.favorite,
        rating: Number(r.rating) || 0,
        tags,
        distance,
      });

      if (processed % 500 === 0) await new Promise((res) => setTimeout(res, 0));
    }

    items.sort(
      (a, b) =>
        (a.distance || 0) - (b.distance || 0) ||
        Number(b.favorite) - Number(a.favorite) ||
        (b.rating || 0) - (a.rating || 0) ||
        String(a.imageId).localeCompare(String(b.imageId))
    );

    const out = items.slice(0, lim);
    await this._audit('image.similar.search', null, {
      imageId: id,
      threshold: thr,
      limit: lim,
      maxImages: max,
      considered: rows.length,
      matched: out.length,
    });

    return { ok: true, imageId: id, threshold: thr, limit: lim, totalConsidered: rows.length, matched: out.length, items: out };
  }

  async scanNearDuplicateGroups({ threshold = 10, maxImages = 2500, maxPerGroup = 60, onProgress = null, isCancelled = null } = {}) {
    const thr = Math.max(0, Math.min(32, Number(threshold) || 10));
    const lim = Math.max(1, Math.min(50_000, Number(maxImages) || 2500));
    const per = Math.max(2, Math.min(400, Number(maxPerGroup) || 60));

    const rows = await all(
      this.db,
      `SELECT ia.image_id, ia.character_id, c.display_name, ia.favorite, ia.rating, ia.tags_json, ia.dhash_hex, ia.added_at
       FROM ImageAsset ia
       JOIN Character c ON c.character_id = ia.character_id
       ORDER BY ia.added_at DESC
       LIMIT ?`,
      [lim]
    );

    const cancelled = () => (typeof isCancelled === 'function' ? !!isCancelled() : false);

    const items = [];
    const total = rows.length;
    let done = 0;

    for (const r of rows) {
      if (cancelled()) return { ok: true, cancelled: true, threshold: thr, groups: [] };

      const imageId = String(r.image_id ?? '').trim();
      const characterId = String(r.character_id ?? '').trim();
      const characterName = String(r.display_name ?? '');

      let tags = [];
      try {
        const parsed = JSON.parse(r.tags_json ?? '[]');
        tags = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
      } catch {
        tags = [];
      }

      let dhash = r.dhash_hex != null ? String(r.dhash_hex ?? '').trim().toLowerCase() : null;
      const needsCompute = dhash == null || (dhash !== '' && !isHex64(dhash));
      if (needsCompute && imageId) {
        try {
          const res = await this.getImageDhash({ imageId });
          dhash = String(res?.dhash ?? '').trim().toLowerCase();
        } catch {
          dhash = '';
        }
      }

      if (dhash && isHex64(dhash)) {
        items.push({
          imageId,
          characterId,
          characterName,
          favorite: !!r.favorite,
          rating: Number(r.rating) || 0,
          tags,
          dhash,
        });
      }

      done += 1;
      if (typeof onProgress === 'function' && (done % 10 === 0 || done === total)) {
        onProgress({ phase: 'hashing', done, total });
      }
      if (done % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const n = items.length;
    if (n < 2) return { ok: true, threshold: thr, totalImages: total, hashedImages: n, groups: [] };

    const buckets = new Map();
    for (let i = 0; i < n; i++) {
      const h = String(items[i].dhash);
      for (let b = 0; b < 4; b++) {
        const key = `${b}:${h.slice(b * 4, b * 4 + 4)}`;
        const arr = buckets.get(key);
        if (arr) arr.push(i);
        else buckets.set(key, [i]);
      }
    }

    const parent = Array.from({ length: n }, (_, i) => i);
    const rank = new Array(n).fill(0);

    const find = (x) => {
      let p = parent[x];
      while (p !== parent[p]) p = parent[p];
      let cur = x;
      while (cur !== p) {
        const nxt = parent[cur];
        parent[cur] = p;
        cur = nxt;
      }
      return p;
    };

    const union = (a, b) => {
      let ra = find(a);
      let rb = find(b);
      if (ra === rb) return;
      const rka = rank[ra] || 0;
      const rkb = rank[rb] || 0;
      if (rka < rkb) {
        parent[ra] = rb;
        return;
      }
      if (rkb < rka) {
        parent[rb] = ra;
        return;
      }
      parent[rb] = ra;
      rank[ra] = rka + 1;
    };

    let groupedDone = 0;
    for (let i = 0; i < n; i++) {
      if (cancelled()) return { ok: true, cancelled: true, threshold: thr, groups: [] };

      const h = String(items[i].dhash);
      const seen = new Set();

      for (let b = 0; b < 4; b++) {
        const key = `${b}:${h.slice(b * 4, b * 4 + 4)}`;
        const cand = buckets.get(key) || [];
        for (const j of cand) {
          if (j <= i) continue;
          seen.add(j);
        }
      }

      for (const j of seen) {
        if (hammingDistanceHex64(h, String(items[j].dhash)) <= thr) union(i, j);
      }

      groupedDone += 1;
      if (typeof onProgress === 'function' && (groupedDone % 20 === 0 || groupedDone === n)) {
        onProgress({ phase: 'grouping', done: groupedDone, total: n });
      }
      if (groupedDone % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const byRoot = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const arr = byRoot.get(root);
      if (arr) arr.push(i);
      else byRoot.set(root, [i]);
    }

    const groups = [];
    for (const [root, idxs] of byRoot.entries()) {
      if (!idxs || idxs.length < 2) continue;
      const repIdx = idxs[0];
      const repHash = String(items[repIdx].dhash);
      let maxDistance = 0;
      const images = idxs.map((idx) => {
        const it = items[idx];
        const distance = hammingDistanceHex64(repHash, String(it.dhash));
        if (distance > maxDistance) maxDistance = distance;
        return { ...it, distance };
      });
      images.sort((a, b) => a.distance - b.distance || Number(b.favorite) - Number(a.favorite) || (b.rating || 0) - (a.rating || 0));
      const truncated = images.length > per;
      groups.push({
        groupId: `nd_${String(root)}`,
        count: images.length,
        repHash,
        maxDistance,
        truncated,
        images: images.slice(0, per),
      });
    }

    groups.sort((a, b) => (b.count || 0) - (a.count || 0) || (a.maxDistance || 0) - (b.maxDistance || 0));
    return { ok: true, threshold: thr, totalImages: total, hashedImages: n, groups };
  }

  async listCollections() {
    const rows = await all(
      this.db,
      `SELECT c.collection_id, c.name, c.created_at, c.updated_at, COUNT(ci.image_id) AS item_count
       FROM Collection c
       LEFT JOIN CollectionItem ci ON ci.collection_id = c.collection_id
       GROUP BY c.collection_id
       ORDER BY c.name COLLATE NOCASE ASC`
    );
    return rows.map((r) => ({
      id: String(r.collection_id ?? ''),
      name: String(r.name ?? ''),
      itemCount: Number(r.item_count) || 0,
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    }));
  }

  async createCollection({ name } = {}) {
    const n = String(name ?? '').trim();
    if (!n) throw new Error('name is required');
    if (n.length > 140) throw new Error('name is too long');

    const id = randomId('col_');
    await run(
      this.db,
      `INSERT INTO Collection(collection_id, name)
       VALUES(?, ?)`,
      [id, n]
    );
    await this._audit('collection.create', null, { collectionId: id, name: n });
    return { ok: true, id, name: n };
  }

  async renameCollection({ collectionId, name } = {}) {
    const id = String(collectionId ?? '').trim();
    if (!id) throw new Error('collectionId is required');
    const n = String(name ?? '').trim();
    if (!n) throw new Error('name is required');
    if (n.length > 140) throw new Error('name is too long');

    await run(
      this.db,
      `UPDATE Collection
       SET name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE collection_id = ?`,
      [n, id]
    );
    await this._audit('collection.rename', null, { collectionId: id, name: n });
    return { ok: true };
  }

  async deleteCollection({ collectionId } = {}) {
    const id = String(collectionId ?? '').trim();
    if (!id) throw new Error('collectionId is required');
    await run(this.db, `DELETE FROM Collection WHERE collection_id = ?`, [id]);
    await this._audit('collection.delete', null, { collectionId: id });
    return { ok: true };
  }

  async addImagesToCollection({ collectionId, imageIds = [] } = {}) {
    const cid = String(collectionId ?? '').trim();
    if (!cid) throw new Error('collectionId is required');
    const idsRaw = Array.isArray(imageIds) ? imageIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('imageIds is required');

    const maxRow = await get(this.db, `SELECT COALESCE(MAX(sort_order), 0) AS m FROM CollectionItem WHERE collection_id = ?`, [cid]);
    let order = (Number(maxRow?.m) || 0) + 1;

    let inserted = 0;
    let skipped = 0;
    await run(this.db, 'BEGIN');
    try {
      for (const imageId of ids) {
        const res = await run(
          this.db,
          `INSERT OR IGNORE INTO CollectionItem(collection_id, image_id, sort_order)
           VALUES(?, ?, ?)`,
          [cid, imageId, order]
        );
        if (Number(res?.changes) > 0) {
          inserted += 1;
          order += 1;
        } else {
          skipped += 1;
        }
      }
      await run(this.db, `UPDATE Collection SET updated_at = CURRENT_TIMESTAMP WHERE collection_id = ?`, [cid]);
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._audit('collection.addImages', null, { collectionId: cid, requested: ids.length, inserted, skipped });
    return { ok: true, inserted, skipped };
  }

  async removeImagesFromCollection({ collectionId, imageIds = [] } = {}) {
    const cid = String(collectionId ?? '').trim();
    if (!cid) throw new Error('collectionId is required');
    const idsRaw = Array.isArray(imageIds) ? imageIds : [];
    const ids = Array.from(new Set(idsRaw.map((x) => String(x ?? '').trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('imageIds is required');

    let removed = 0;
    await run(this.db, 'BEGIN');
    try {
      for (const imageId of ids) {
        const res = await run(this.db, `DELETE FROM CollectionItem WHERE collection_id = ? AND image_id = ?`, [cid, imageId]);
        removed += Number(res?.changes) || 0;
      }
      await run(this.db, `UPDATE Collection SET updated_at = CURRENT_TIMESTAMP WHERE collection_id = ?`, [cid]);
      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._audit('collection.removeImages', null, { collectionId: cid, requested: ids.length, removed });
    return { ok: true, removed };
  }

  async listCollectionImages({ collectionId } = {}) {
    const cid = String(collectionId ?? '').trim();
    if (!cid) throw new Error('collectionId is required');

    const rows = await all(
      this.db,
      `SELECT ia.image_id, ia.character_id, c.display_name,
              ia.favorite, ia.rating, ia.notes, ia.tags_json, ia.source_url, ia.source_note, ia.added_at,
              ci.sort_order, ci.added_at AS added_to_collection_at
       FROM CollectionItem ci
       JOIN ImageAsset ia ON ia.image_id = ci.image_id
       JOIN Character c ON c.character_id = ia.character_id
       WHERE ci.collection_id = ?
       ORDER BY ci.sort_order ASC, ci.added_at ASC`,
      [cid]
    );

    return rows.map((img) => ({
      id: img.image_id,
      characterId: img.character_id,
      characterName: String(img.display_name ?? ''),
      favorite: !!img.favorite,
      rating: img.rating,
      notes: img.notes ?? '',
      sourceUrl: img.source_url ?? null,
      sourceNote: img.source_note ?? '',
      tags: (() => {
        try {
          const parsed = JSON.parse(img.tags_json ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      addedAt: img.added_at,
      sortOrder: Number(img.sort_order) || 0,
      addedToCollectionAt: String(img.added_to_collection_at ?? ''),
    }));
  }

  async listCharacterRelations({ characterId = null } = {}) {
    const cid = characterId == null ? null : String(characterId ?? '').trim();
    const params = [];
    let where = '';
    if (cid) {
      where = 'WHERE r.source_character_id = ?';
      params.push(cid);
    }

    const rows = await all(
      this.db,
      `
      SELECT r.relation_id, r.source_character_id, r.target_character_id, r.rel_type, r.notes, r.created_at, r.updated_at,
             cs.display_name AS source_name,
             ct.display_name AS target_name
      FROM CharacterRelation r
      JOIN Character cs ON cs.character_id = r.source_character_id
      JOIN Character ct ON ct.character_id = r.target_character_id
      ${where}
      ORDER BY r.created_at DESC
    `,
      params
    );

    return rows.map((r) => ({
      id: String(r.relation_id ?? ''),
      sourceCharacterId: String(r.source_character_id ?? ''),
      sourceCharacterName: String(r.source_name ?? ''),
      targetCharacterId: String(r.target_character_id ?? ''),
      targetCharacterName: String(r.target_name ?? ''),
      relType: String(r.rel_type ?? ''),
      notes: String(r.notes ?? ''),
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    }));
  }

  async createCharacterRelation({ sourceCharacterId, targetCharacterId, relType = '', notes = '' } = {}) {
    const sourceId = String(sourceCharacterId ?? '').trim();
    const targetId = String(targetCharacterId ?? '').trim();
    if (!sourceId) throw new Error('sourceCharacterId is required');
    if (!targetId) throw new Error('targetCharacterId is required');
    if (sourceId === targetId) throw new Error('source and target must be different characters');

    const src = await get(this.db, `SELECT character_id FROM Character WHERE character_id = ?`, [sourceId]);
    if (!src) throw new Error('Source character not found');
    const tgt = await get(this.db, `SELECT character_id FROM Character WHERE character_id = ?`, [targetId]);
    if (!tgt) throw new Error('Target character not found');

    const id = randomId('rel_');
    await run(
      this.db,
      `INSERT INTO CharacterRelation(relation_id, source_character_id, target_character_id, rel_type, notes)
       VALUES(?, ?, ?, ?, ?)`,
      [id, sourceId, targetId, String(relType ?? ''), String(notes ?? '')]
    );

    await this._audit('relation.create', sourceId, { relationId: id, targetCharacterId: targetId });
    return { ok: true, id };
  }

  async updateCharacterRelation({ relationId, relType, notes } = {}) {
    const id = String(relationId ?? '').trim();
    if (!id) throw new Error('relationId is required');

    await run(
      this.db,
      `UPDATE CharacterRelation
       SET rel_type = COALESCE(?, rel_type),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE relation_id = ?`,
      [relType !== undefined ? String(relType ?? '') : null, notes !== undefined ? String(notes ?? '') : null, id]
    );
    await this._audit('relation.update', null, { relationId: id });
    return { ok: true };
  }

  async deleteCharacterRelation({ relationId } = {}) {
    const id = String(relationId ?? '').trim();
    if (!id) throw new Error('relationId is required');
    await run(this.db, `DELETE FROM CharacterRelation WHERE relation_id = ?`, [id]);
    await this._audit('relation.delete', null, { relationId: id });
    return { ok: true };
  }

  async getImageAnnotations({ imageId } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const normalize = (raw) => {
      const obj = raw && typeof raw === 'object' ? raw : {};
      const pinsRaw = Array.isArray(obj.pins) ? obj.pins : [];
      const pins = [];
      for (const p of pinsRaw) {
        const pin = p && typeof p === 'object' ? p : {};
        const x = Number(pin.x);
        const y = Number(pin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
        pins.push({
          id: String(pin.id ?? '').trim() || randomId('pin_'),
          x: clamp01(x),
          y: clamp01(y),
          text: String(pin.text ?? ''),
        });
      }
      return { version: 1, pins };
    };

    const row = await get(this.db, `SELECT annotations_json FROM ImageAnnotation WHERE image_id = ?`, [id]);
    if (!row) return { ok: true, imageId: id, annotations: { version: 1, pins: [] } };

    try {
      const parsed = JSON.parse(row.annotations_json ?? '{}');
      return { ok: true, imageId: id, annotations: normalize(parsed) };
    } catch {
      return { ok: true, imageId: id, annotations: { version: 1, pins: [] } };
    }
  }

  async setImageAnnotations({ imageId, annotations } = {}) {
    const id = String(imageId ?? '').trim();
    if (!id) throw new Error('imageId is required');

    const normalize = (raw) => {
      const obj = raw && typeof raw === 'object' ? raw : {};
      const pinsRaw = Array.isArray(obj.pins) ? obj.pins : [];
      const pins = [];
      const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
      for (const p of pinsRaw) {
        const pin = p && typeof p === 'object' ? p : {};
        const x = Number(pin.x);
        const y = Number(pin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        pins.push({
          id: String(pin.id ?? '').trim() || randomId('pin_'),
          x: clamp01(x),
          y: clamp01(y),
          text: String(pin.text ?? ''),
        });
      }
      return { version: 1, pins };
    };

    const cleaned = normalize(annotations);
    const json = JSON.stringify(cleaned);
    const row = await get(this.db, 'SELECT character_id FROM ImageAsset WHERE image_id = ?', [id]);

    await run(
      this.db,
      `INSERT INTO ImageAnnotation(image_id, annotations_json, updated_at)
       VALUES(?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(image_id) DO UPDATE SET
         annotations_json = excluded.annotations_json,
         updated_at = CURRENT_TIMESTAMP`,
      [id, json]
    );

    await this._audit('image.setAnnotations', row?.character_id ?? null, { imageId: id, pins: cleaned.pins.length });
    return { ok: true };
  }

  async setImagesMetaBatch({ imageIds, favorite, rating, addTags = [], removeTags = [] } = {}) {
    const rawIds = Array.isArray(imageIds) ? imageIds : [];
    const ids = [];
    const seenIds = new Set();
    for (const id of rawIds) {
      const s = String(id ?? '').trim();
      if (!s) continue;
      if (seenIds.has(s)) continue;
      seenIds.add(s);
      ids.push(s);
    }
    if (ids.length === 0) return { ok: true, updated: 0 };

    const shouldSetFavorite = favorite !== undefined;
    const shouldSetRating = rating !== undefined;
    const cleanedAdd = this._cleanTags(addTags).filter((t) => !this._isSystemTag(t));
    const cleanedRemove = this._cleanTags(removeTags).filter((t) => !this._isSystemTag(t));
    const shouldPatchTags = cleanedAdd.length > 0 || cleanedRemove.length > 0;

    if (!shouldSetFavorite && !shouldSetRating && !shouldPatchTags) return { ok: true, updated: 0 };

    const favoriteVal = shouldSetFavorite ? (favorite ? 1 : 0) : null;
    const ratingVal = shouldSetRating ? Math.max(0, Math.min(5, Number(rating) || 0)) : null;

    const chunkSize = 800;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

    await run(this.db, 'BEGIN');
    try {
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');

        if (shouldSetFavorite || shouldSetRating) {
          await run(
            this.db,
            `UPDATE ImageAsset
             SET favorite = COALESCE(?, favorite),
                 rating = COALESCE(?, rating)
             WHERE image_id IN (${placeholders})`,
            [favoriteVal, ratingVal, ...chunk]
          );
        }

        if (shouldPatchTags) {
          const rows = await all(this.db, `SELECT image_id, tags_json FROM ImageAsset WHERE image_id IN (${placeholders})`, chunk);
          const removeSet = new Set(cleanedRemove);
          for (const r of rows) {
            const imageId = String(r.image_id || '');
            let tags = [];
            try {
              const parsed = JSON.parse(r.tags_json || '[]');
              tags = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
            } catch {
              tags = [];
            }

            const out = [];
            const seen = new Set();
            for (const t of tags) {
              const s = String(t ?? '').trim();
              if (!s) continue;
              if (this._isSystemTag(s)) continue;
              if (removeSet.has(s)) continue;
              if (seen.has(s)) continue;
              seen.add(s);
              out.push(s);
            }

            for (const t of cleanedAdd) {
              const s = String(t ?? '').trim();
              if (!s) continue;
              if (this._isSystemTag(s)) continue;
              if (seen.has(s)) continue;
              seen.add(s);
              out.push(s);
            }

            await run(this.db, 'UPDATE ImageAsset SET tags_json = ? WHERE image_id = ?', [JSON.stringify(out), imageId]);
          }
        }
      }

      await run(this.db, 'COMMIT');
    } catch (err) {
      await run(this.db, 'ROLLBACK');
      throw err;
    }

    await this._audit('gallery.setImagesMetaBatch', null, {
      imageCount: ids.length,
      favorite: shouldSetFavorite ? !!favorite : undefined,
      rating: shouldSetRating ? ratingVal : undefined,
      addTags: cleanedAdd,
      removeTags: cleanedRemove,
    });

    return { ok: true, updated: ids.length };
  }

  _isIntakeImagePath(filePath) {
    const ext = path.extname(String(filePath ?? '')).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
  }

  _normalizeIntakeStatus(status) {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'pass' || s === 'accepted' || s === 'accept') return 'accepted';
    if (s === 'reject' || s === 'rejected') return 'rejected';
    if (s === 'pending') return 'pending';
    throw new Error('status must be accepted, rejected, or pending');
  }

  _folderStatusName(status) {
    const s = this._normalizeIntakeStatus(status);
    if (s === 'accepted') return 'pass';
    if (s === 'rejected') return 'reject';
    return 'pending';
  }

  async scanIntakeFolder({ sourceDir } = {}) {
    const rawDir = String(sourceDir ?? '').trim();
    if (!rawDir) throw new Error('sourceDir is required');
    const dir = path.resolve(rawDir);
    if (!fs.existsSync(dir)) throw new Error('sourceDir does not exist');
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) throw new Error('sourceDir must be a folder');

    const statusDirs = new Set(['pass', 'reject', 'pending']);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const images = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!this._isIntakeImagePath(entry.name)) continue;
      const absPath = path.join(dir, entry.name);
      const s = fs.statSync(absPath);
      images.push({
        path: absPath,
        fileName: entry.name,
        bytes: s.size,
        mtimeMs: s.mtimeMs,
        statusTargets: {
          accepted: path.join(dir, 'pass', sanitizeNoSpaceFileName(entry.name, entry.name)),
          rejected: path.join(dir, 'reject', sanitizeNoSpaceFileName(entry.name, entry.name)),
          pending: path.join(dir, 'pending', sanitizeNoSpaceFileName(entry.name, entry.name)),
        },
      });
    }

    return {
      ok: true,
      sourceDir: dir,
      images,
      statusDirs: Array.from(statusDirs).map((name) => path.join(dir, name)),
      counts: { images: images.length },
    };
  }

  async classifyIntakeImage({
    sourcePath,
    status,
    mode = 'folder',
    characterId = null,
    notes = '',
    tags = [],
    duplicatePolicy = 'skip',
  } = {}) {
    const rawSrc = String(sourcePath ?? '').trim();
    if (!rawSrc) throw new Error('sourcePath is required');
    const src = path.resolve(rawSrc);
    if (!fs.existsSync(src)) throw new Error('sourcePath does not exist');
    if (!this._isIntakeImagePath(src)) throw new Error('sourcePath is not a supported image file');

    const normalizedStatus = this._normalizeIntakeStatus(status);
    const normalizedMode = String(mode ?? 'folder').trim().toLowerCase() === 'linked' ? 'linked' : 'folder';

    if (normalizedMode === 'folder') {
      const parent = path.dirname(src);
      const folderName = this._folderStatusName(normalizedStatus);
      const destDir = path.join(parent, folderName);
      ensureDir(destDir);
      const destPath = uniquePath(destDir, sanitizeNoSpaceFileName(path.basename(src), path.basename(src)));
      fs.renameSync(src, destPath);
      return { ok: true, mode: 'folder', status: normalizedStatus, movedTo: destPath };
    }

    const cid = String(characterId ?? '').trim();
    if (!cid) throw new Error('characterId is required in linked mode');
    if (normalizedStatus === 'rejected') {
      return { ok: true, mode: 'linked', status: normalizedStatus, imported: [], preservedSourcePath: src };
    }

    const imported = await this.importImages({ characterId: cid, filePaths: [src], duplicatePolicy });
    const rows = Array.isArray(imported?.imported) ? imported.imported : [];
    const cleanedTags = this._cleanTags(tags).filter((t) => !this._isSystemTag(t));
    const notesText = String(notes ?? '');
    for (const row of rows) {
      const imageId = String(row?.id || row?.imageId || '').trim();
      if (!imageId) continue;
      const existing = await get(this.db, `SELECT tags_json FROM ImageAsset WHERE image_id = ?`, [imageId]);
      let mergedTags = [];
      try {
        const parsed = JSON.parse(existing?.tags_json || '[]');
        mergedTags = Array.isArray(parsed) ? parsed.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
      } catch {
        mergedTags = [];
      }
      const seen = new Set(mergedTags);
      for (const t of cleanedTags) {
        if (seen.has(t)) continue;
        seen.add(t);
        mergedTags.push(t);
      }
      if (normalizedStatus === 'pending' && !seen.has('pending')) {
        mergedTags.push('pending');
      }

      await run(
        this.db,
        `UPDATE ImageAsset
         SET review_status = ?,
             notes = COALESCE(NULLIF(?, ''), notes),
             tags_json = ?
         WHERE image_id = ?`,
        [normalizedStatus, notesText, JSON.stringify(mergedTags), imageId]
      );
    }

    await this._audit('intake.classifyLinked', cid, {
      sourcePath: src,
      status: normalizedStatus,
      imported: rows.length,
      duplicateCount: Array.isArray(imported?.duplicates) ? imported.duplicates.length : 0,
    });

    return {
      ok: true,
      mode: 'linked',
      status: normalizedStatus,
      preservedSourcePath: src,
      imported: rows,
      duplicates: imported?.duplicates || [],
    };
  }

  async listPendingImages({ characterId = null } = {}) {
    const cid = String(characterId ?? '').trim();
    const params = [];
    let where = `WHERE ia.review_status = 'pending'`;
    if (cid) {
      where += ' AND ia.character_id = ?';
      params.push(cid);
    }

    const rows = await all(
      this.db,
      `SELECT ia.image_id, ia.character_id, ia.relative_path, ia.file_hash, ia.width, ia.height,
              ia.added_at, ia.favorite, ia.rating, ia.notes, ia.tags_json, ia.source_path, ia.source_url, ia.source_note,
              c.display_name
       FROM ImageAsset ia
       JOIN Character c ON c.character_id = ia.character_id
       ${where}
       ORDER BY ia.added_at DESC
       LIMIT 500`,
      params
    );

    return rows.map((img) => ({
      id: String(img.image_id ?? ''),
      characterId: String(img.character_id ?? ''),
      characterName: String(img.display_name ?? ''),
      relativePath: String(img.relative_path ?? ''),
      fileHash: String(img.file_hash ?? ''),
      width: img.width ?? null,
      height: img.height ?? null,
      favorite: !!img.favorite,
      rating: Number(img.rating) || 0,
      notes: String(img.notes ?? ''),
      sourcePath: img.source_path ?? null,
      sourceUrl: img.source_url ?? null,
      sourceNote: String(img.source_note ?? ''),
      tags: (() => {
        try {
          const parsed = JSON.parse(img.tags_json ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      addedAt: String(img.added_at ?? ''),
    }));
  }

  async exportFieldPack(params) {
    const characterId = params?.characterId;
    const spinoffId = params?.spinoffId ?? null;
    const spinoffName = params?.spinoffName ?? 'LLM Pack (strict) — Safe Subset';
    const includeEmptyOnly = params?.includeEmptyOnly ?? true;
    const includeValues = params?.includeValues ?? false;
    const includeSections = params?.includeSections ?? null;
    const outDir = params?.outDir ?? null;

    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');
    const templateAst = await this.getTemplateAst(character.templateId);

    const row =
      spinoffId != null
        ? await get(this.db, `SELECT spinoff_id, template_id, name, field_id_list FROM TemplateSpinOff WHERE spinoff_id = ?`, [
            spinoffId,
          ])
        : await get(
            this.db,
            `SELECT spinoff_id, template_id, name, field_id_list FROM TemplateSpinOff WHERE template_id = ? AND name = ?`,
            [character.templateId, spinoffName]
          );
    if (!row) throw new Error('Spin-off not found');
    if (String(row.template_id || '') !== String(character.templateId || '')) {
      throw new Error('Spin-off template does not match character template');
    }

    let fieldIds = [];
    try {
      const parsed = JSON.parse(row.field_id_list || '[]');
      fieldIds = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    } catch {
      fieldIds = [];
    }

    const validIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    fieldIds = fieldIds.filter((id) => validIds.has(id));

    if (Array.isArray(includeSections) && includeSections.length > 0) {
      const allowed = new Set();
      const sectionSet = new Set(includeSections.map((s) => String(s)));
      for (const section of templateAst.sections) {
        if (!sectionSet.has(section.title)) continue;
        for (const f of section.fields) allowed.add(f.id);
      }
      fieldIds = fieldIds.filter((id) => allowed.has(id));
    }

    const lines = [];
    for (const fid of fieldIds) {
      const cur = String(character.valuesById[fid] ?? '');
      if (includeEmptyOnly && cur.trim()) continue;

      if (!includeValues) {
        lines.push(`${fid}: `);
        continue;
      }

      const parts = String(cur ?? '').split('\n');
      const first = parts[0] ?? '';
      lines.push(`${fid}: ${first}`);
      for (const cont of parts.slice(1)) lines.push(`  ${cont}`);
    }

    const packName = String(row.name || spinoffName);
    const paths = this.getCharacterPaths(characterId);

    const packRoot = outDir
      ? path.join(String(outDir), 'packs', sanitizeFileName(null, `${character.displayName}__${shortStableIdForPath(characterId)}`))
      : paths.packsDir;
    const packDir = path.join(packRoot, sanitizeFileName(null, packName.replaceAll('/', '_')));
    ensureDir(packDir);

    const fileName = `${toIsoSafeTimestamp()}_${packName.replaceAll(/\s+/g, '_').replaceAll(/[^\w\-]+/g, '').toLowerCase()}.txt`;
    const outPath = uniquePath(packDir, fileName);
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

    await this._audit('spinoff.export', characterId, {
      spinoffId: row.spinoff_id,
      name: packName,
      lineCount: lines.length,
      includeEmptyOnly: !!includeEmptyOnly,
      includeValues: !!includeValues,
    });

    return { path: outPath, lineCount: lines.length, spinoffId: row.spinoff_id, name: packName };
  }

  async exportEmptyTemplate({ templateId = null, outDir = null, fileName = null } = {}) {
    const id = templateId || this.defaultTemplateId;
    const detail = await this.getTemplateDetail(id);
    if (!detail) throw new Error('Template not found');

    const dir = outDir ? String(outDir) : this.getPaths().exportsDir;
    ensureDir(dir);

    const baseName = sanitizeFileName(fileName, `CHARACTER_SHEET__${id}.txt`);
    const outPath = uniquePath(dir, baseName);

    const sourcePath = detail.sourcePath ? String(detail.sourcePath) : null;
    if (sourcePath && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, outPath);
    } else {
      fs.writeFileSync(outPath, String(detail.rawText ?? ''), 'utf8');
    }

    await this._audit('template.exportEmpty', null, { templateId: id, outPath });
    return { ok: true, path: outPath, templateId: id };
  }

  async exportTemplateFieldPack({
    templateId = null,
    spinoffId = null,
    spinoffName = null,
    outDir = null,
    fileName = null,
    includeSections = null,
  } = {}) {
    const tid = templateId || this.defaultTemplateId;
    const templateAst = await this.getTemplateAst(tid);

    let row = null;
    if (spinoffId != null) {
      row = await get(this.db, `SELECT spinoff_id, template_id, name, field_id_list FROM TemplateSpinOff WHERE spinoff_id = ?`, [
        spinoffId,
      ]);
    } else if (spinoffName != null) {
      row = await get(
        this.db,
        `SELECT spinoff_id, template_id, name, field_id_list FROM TemplateSpinOff WHERE template_id = ? AND name = ?`,
        [tid, spinoffName]
      );
    }

    let fieldIds = [];
    if (row) {
      if (String(row.template_id || '') !== String(tid || '')) throw new Error('Spin-off template does not match');
      try {
        const parsed = JSON.parse(row.field_id_list || '[]');
        fieldIds = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
      } catch {
        fieldIds = [];
      }
    } else {
      for (const section of templateAst.sections) {
        for (const field of section.fields) {
          if (field.type === 'rule') continue;
          fieldIds.push(field.id);
        }
      }
    }

    const validIds = new Set(templateAst.sections.flatMap((s) => s.fields.map((f) => f.id)));
    fieldIds = fieldIds.filter((id) => validIds.has(id));

    if (Array.isArray(includeSections) && includeSections.length > 0) {
      const allowed = new Set();
      const sectionSet = new Set(includeSections.map((s) => String(s)));
      for (const section of templateAst.sections) {
        if (!sectionSet.has(section.title)) continue;
        for (const f of section.fields) allowed.add(f.id);
      }
      fieldIds = fieldIds.filter((id) => allowed.has(id));
    }

    const lines = fieldIds.map((fid) => `${fid}: `);

    const dir = outDir ? String(outDir) : this.getPaths().exportsDir;
    ensureDir(dir);

    const presetName = row ? String(row.name || '') : 'All Fields';
    const fallbackName = `LLM_EMPTY__${tid}__${presetName.replaceAll(/\s+/g, '_')}.txt`;
    const baseName = sanitizeFileName(fileName, fallbackName);
    const outPath = uniquePath(dir, baseName);

    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    await this._audit('template.exportFieldPack', null, {
      templateId: tid,
      spinoffId: row ? row.spinoff_id : null,
      name: presetName,
      lineCount: lines.length,
      outPath,
    });

    return {
      ok: true,
      path: outPath,
      lineCount: lines.length,
      templateId: tid,
      spinoffId: row ? row.spinoff_id : null,
      name: presetName,
    };
  }
}

module.exports = {
  CKCLibrary,
};
