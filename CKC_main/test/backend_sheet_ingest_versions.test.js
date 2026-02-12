const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CKCLibrary } = require('../app/backend/library');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('sheet ingest + versions diff/revert works and protects CHAR-ID-001', async (t) => {
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

  const characterId = await lib.createCharacter({ displayName: 'Test' });
  const before = await lib.getCharacter(characterId);
  assert.ok(before);
  const origCharIdField = String(before.valuesById['CHAR-ID-001'] ?? '');
  assert.equal(origCharIdField, characterId);

  const initialVersions = await lib.listVersions(characterId);
  const initialVer = initialVersions.find((v) => v.source === 'import' && String(v.notes || '').includes('Initial sheet created.'));
  assert.ok(initialVer, 'expected initial import version');

  const ingestText = ['CHAR-ID-006 — Primary_Role: Detective', 'CHAR-ID-007: Sidekick', ''].join('\n');
  const preview = await lib.ingestPreview({ characterId, inputText: ingestText });
  const changedIds = (preview.changes || []).map((c) => c.fieldId);
  assert.ok(changedIds.includes('CHAR-ID-006'));
  assert.ok(changedIds.includes('CHAR-ID-007'));
  assert.ok(!changedIds.includes('CHAR-ID-004')); // not present in input

  const c006 = preview.changes.find((c) => c.fieldId === 'CHAR-ID-006');
  assert.ok(c006);
  assert.equal(c006.changeType, 'add');

  const applyRes = await lib.ingestApply({ characterId, selectedFieldIds: ['CHAR-ID-006'], inputText: ingestText });
  assert.equal(applyRes.ok, true);

  const after = await lib.getCharacter(characterId);
  assert.ok(after);
  assert.equal(String(after.valuesById['CHAR-ID-006'] ?? ''), 'Detective');
  assert.equal(String(after.valuesById['CHAR-ID-007'] ?? ''), ''); // not applied

  const versionsAfterIngest = await lib.listVersions(characterId);
  const ingestVer = versionsAfterIngest.find((v) => v.source === 'ingest' && String(v.notes || '').includes('Applied ingest.'));
  assert.ok(ingestVer, 'expected ingest version');

  const diff = await lib.diffVersions({ characterId, fromVersionId: initialVer.id, toVersionId: ingestVer.id });
  assert.ok(Array.isArray(diff.changes));
  assert.ok(diff.changes.some((c) => c.fieldId === 'CHAR-ID-006'));
  assert.ok(!diff.changes.some((c) => c.fieldId === 'CHAR-ID-007'));

  const revertPreview = await lib.revertPreviewFromVersion({ characterId, versionId: initialVer.id });
  const r006 = revertPreview.changes.find((c) => c.fieldId === 'CHAR-ID-006');
  assert.ok(r006);
  assert.equal(String(r006.proposedValue ?? ''), '');

  const revertRes = await lib.revertApplyFromVersion({ characterId, versionId: initialVer.id, selectedFieldIds: ['CHAR-ID-006'] });
  assert.equal(revertRes.ok, true);

  const afterRevert = await lib.getCharacter(characterId);
  assert.ok(afterRevert);
  assert.equal(String(afterRevert.valuesById['CHAR-ID-006'] ?? ''), '');

  // Protected field: attempt overwrite should be ignored.
  await lib.ingestApply({ characterId, selectedFieldIds: ['CHAR-ID-001'], inputText: 'CHAR-ID-001: hacked' });
  const afterHack = await lib.getCharacter(characterId);
  assert.ok(afterHack);
  assert.equal(String(afterHack.valuesById['CHAR-ID-001'] ?? ''), origCharIdField);

  lib.close();
});

