const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');
const { parseSheetText, applyFieldUpdatesToParsedSheet } = require('../app/backend/sheet');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('public character id is sequential and enforced in CHAR-ID-001', async (t) => {
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

  const c1 = await lib.createCharacter({ displayName: 'A' });
  const c2 = await lib.createCharacter({ displayName: 'B' });

  assert.ok(String(c1).startsWith('char_'));
  assert.ok(String(c2).startsWith('char_'));
  assert.notEqual(c1, c2);

  const a = await lib.getCharacter(c1);
  const b = await lib.getCharacter(c2);
  assert.ok(a);
  assert.ok(b);

  assert.match(String(a.publicId || ''), /^CHAR-\d{6}$/);
  assert.match(String(b.publicId || ''), /^CHAR-\d{6}$/);
  assert.equal(a.valuesById['CHAR-ID-001'], a.publicId);
  assert.equal(b.valuesById['CHAR-ID-001'], b.publicId);

  const list = await lib.listCharacters({ queryText: '', tagFilters: [], scopeFlags: { all: true }, galleryFilters: {} });
  const foundA = list.find((x) => x.id === c1);
  const foundB = list.find((x) => x.id === c2);
  assert.equal(foundA?.publicId, a.publicId);
  assert.equal(foundB?.publicId, b.publicId);

  lib.close();
});

test('assignPublicCharacterIds migrates missing public_id without renaming folders', async (t) => {
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

  const characterId = await lib.createCharacter({ displayName: 'Needs migration' });
  await lib.createCharacter({ displayName: 'Keeps id (to advance the sequence)' });
  const before = await lib.getCharacter(characterId);
  assert.ok(before?.publicId);
  const originalPublicId = String(before.publicId);

  // Simulate an older library: clear public_id and revert CHAR-ID-001 to the internal storage id.
  await new Promise((resolve, reject) => {
    lib.db.run(`UPDATE Character SET public_id = NULL WHERE character_id = ?`, [characterId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise((resolve, reject) => {
    lib.db.run(
      `UPDATE FieldValue SET value_text = ? WHERE character_id = ? AND field_id = 'CHAR-ID-001'`,
      [characterId, characterId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  const sheetPath = path.join(libraryRoot, 'characters', characterId, 'sheet', 'character.txt');
  const raw = fs.readFileSync(sheetPath, 'utf8');
  const parsed = parseSheetText(raw);
  const rewritten = applyFieldUpdatesToParsedSheet(parsed, { 'CHAR-ID-001': characterId });
  fs.writeFileSync(sheetPath, rewritten, 'utf8');

  const mig = await lib.assignPublicCharacterIds({ dryRun: false });
  assert.ok(mig.ok);

  const after = await lib.getCharacter(characterId);
  assert.ok(after);
  assert.ok(after.publicId);
  assert.notEqual(after.publicId, originalPublicId);
  assert.equal(after.valuesById['CHAR-ID-001'], after.publicId);

  const afterRaw = fs.readFileSync(sheetPath, 'utf8');
  const afterParsed = parseSheetText(afterRaw);
  assert.equal(afterParsed.fieldValues.get('CHAR-ID-001'), after.publicId);

  // Internal folder name remains unchanged.
  assert.ok(fs.existsSync(path.join(libraryRoot, 'characters', characterId)));

  lib.close();
});
