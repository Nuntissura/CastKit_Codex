// WP-0100 slice 1: ingestion batches + rejections (audit, reads).

// Force SQLite regardless of operator env (see backend_character_scripts.test.js
// for the same hermetic guard).
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

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-ib-'));
  t.after(() => {
    try { fs.rmSync(libraryRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

test('createIngestionBatch + finishIngestionBatch + getIngestionBatch round-trip', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'IB Test' });
  const created = await lib.createIngestionBatch({
    characterId,
    sheetVersionId: 'ver_001',
    datasetId: 'dataset_x',
    taskId: 'task_y',
    specVersion: 'v00.19',
    lane: 'accepted',
    requirementsSnapshot: 'task_id: task_y\noutcome: idol-grade reference set',
  });
  assert.equal(created.ok, true);
  assert.match(created.batchId, /^batch_/);

  await lib.finishIngestionBatch({ batchId: created.batchId, importedCount: 12, skippedCount: 3 });
  const got = await lib.getIngestionBatch({ batchId: created.batchId });
  assert.equal(got.ok, true);
  assert.equal(got.characterId, characterId);
  assert.equal(got.sheetVersionId, 'ver_001');
  assert.equal(got.datasetId, 'dataset_x');
  assert.equal(got.taskId, 'task_y');
  assert.equal(got.specVersion, 'v00.19');
  assert.equal(got.lane, 'accepted');
  assert.equal(got.importedCount, 12);
  assert.equal(got.skippedCount, 3);
  assert.match(got.requirementsSnapshot, /idol-grade reference set/);
  lib.close();
});

test('listIngestionBatches filters by character and sorts newest-first', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const c1 = await lib.createCharacter({ displayName: 'Char One' });
  const c2 = await lib.createCharacter({ displayName: 'Char Two' });
  const b1 = await lib.createIngestionBatch({ characterId: c1, datasetId: 'd', taskId: 't1', specVersion: 'v00.19', lane: 'accepted' });
  await new Promise((r) => setTimeout(r, 5));
  const b2 = await lib.createIngestionBatch({ characterId: c1, datasetId: 'd', taskId: 't2', specVersion: 'v00.19', lane: 'pending' });
  await new Promise((r) => setTimeout(r, 5));
  await lib.createIngestionBatch({ characterId: c2, datasetId: 'd', taskId: 't3', specVersion: 'v00.19', lane: 'accepted' });
  const c1Batches = await lib.listIngestionBatches({ characterId: c1 });
  assert.equal(c1Batches.length, 2);
  assert.deepEqual(c1Batches.map((b) => b.batchId).sort(), [b1.batchId, b2.batchId].sort());
  for (const b of c1Batches) assert.equal(b.characterId, c1);
  const all = await lib.listIngestionBatches({});
  assert.equal(all.length, 3);
  lib.close();
});

test('createIngestionRejection + listIngestionRejections by character and by batch', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  const characterId = await lib.createCharacter({ displayName: 'Rej Test' });
  const batch = await lib.createIngestionBatch({ characterId, datasetId: 'd', taskId: 't', specVersion: 'v00.19', lane: 'rejected' });
  await lib.createIngestionRejection({ batchId: batch.batchId, characterId, sourceUrl: 'https://example.com/a.jpg', rejectionReason: 'too small' });
  await lib.createIngestionRejection({ batchId: batch.batchId, characterId, sourceUrl: 'https://example.com/b.jpg', rejectionReason: 'wrong identity' });
  const byChar = await lib.listIngestionRejections({ characterId });
  assert.equal(byChar.length, 2);
  for (const r of byChar) {
    assert.equal(r.batchId, batch.batchId);
    assert.equal(r.characterId, characterId);
    assert.match(r.sourceUrl, /example\.com/);
  }
  const byBatch = await lib.listIngestionRejections({ batchId: batch.batchId });
  assert.equal(byBatch.length, 2);
  lib.close();
});

test('createIngestionBatch validates required args', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  await assert.rejects(() => lib.createIngestionBatch({}), /characterId is required/);
  await assert.rejects(() => lib.createIngestionBatch({ characterId: 'c' }), /lane is required/);
  await assert.rejects(() => lib.createIngestionRejection({}), /batchId is required/);
  await assert.rejects(() => lib.createIngestionRejection({ batchId: 'b' }), /characterId is required/);
  lib.close();
});
