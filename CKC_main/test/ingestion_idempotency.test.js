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
const { all, get } = require('../app/backend/db');

const operatorSamplePath = 'D:\\Projects\\LLM projects\\OpenRepose\\test_material\\image_samples\\1085406391.jpg';
const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  return dir;
}

function writeFallbackPng(filePath) {
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  );
  fs.writeFileSync(filePath, png1x1);
}

function buildTaskFixture(t) {
  const root = makeTempDir(t, 'ckc-ingest-task-');
  const taskId = 'task_wp_0106';
  const taskRoot = path.join(root, taskId);
  const acceptedDir = path.join(taskRoot, 'intake', 'accepted');
  const logsDir = path.join(taskRoot, 'logs');
  fs.mkdirSync(acceptedDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const imageName = 'openrepose-sample.jpg';
  const imageDest = path.join(acceptedDir, imageName);
  if (fs.existsSync(operatorSamplePath)) fs.copyFileSync(operatorSamplePath, imageDest);
  else writeFallbackPng(imageDest);

  fs.writeFileSync(
    path.join(taskRoot, `${taskId}.task_state.yaml`),
    ['dataset_id: dataset_wp_0106', `task_id: ${taskId}`, 'spec_version: v00.19', ''].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(taskRoot, `${taskId}.task_topology.yaml`),
    ['folders:', '  intake_accepted: intake/accepted', ''].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(taskRoot, `${taskId}.task_requirements.yaml`),
    ['task_id: task_wp_0106', 'source: openrepose-image-samples', ''].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(logsDir, `${taskId}.media_items.jsonl`),
    JSON.stringify({
      media_basename: imageName,
      media_path: `intake/accepted/${imageName}`,
      source_url: 'file:///openrepose-image-samples/1085406391.jpg',
      contact_sheet_ref: 'wp-0106-sample-001',
      run_id: 'wp-0106-idempotency',
    }) + '\n',
    'utf8'
  );

  return taskRoot;
}

async function imageState(db, characterId) {
  const rows = await all(
    db,
    `SELECT image_id, file_hash, relative_path, source_dataset_id, source_task_id, source_contact_sheet_ref
     FROM ImageAsset
     WHERE character_id = ?
     ORDER BY image_id`,
    [characterId]
  );
  return rows.map((row) => ({
    id: row.image_id,
    fileHash: row.file_hash,
    relativePath: row.relative_path,
    datasetId: row.source_dataset_id,
    taskId: row.source_task_id,
    contactSheetRef: row.source_contact_sheet_ref,
  }));
}

test('v00.19 image sourcing re-import is idempotent for operator sample images', async (t) => {
  const libraryRoot = makeTempDir(t, 'ckc-ingest-idempotency-');
  const taskRootPath = buildTaskFixture(t);
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'WP-0106 Idempotency' });
  const initialVersion = (await lib.listVersions(characterId)).find((v) => v.source === 'import');
  assert.ok(initialVersion, 'expected initial sheet version');

  const beforeBatchCount = await get(lib.db, `SELECT COUNT(*) AS c FROM IngestionBatch`);
  const first = await lib.ingestImageSourcingTask({
    taskRootPath,
    characterId,
    sheetVersionId: initialVersion.id,
    lane: 'accepted',
  });
  const afterFirst = await imageState(lib.db, characterId);
  const afterFirstBatchCount = await get(lib.db, `SELECT COUNT(*) AS c FROM IngestionBatch`);

  assert.equal(first.ok, true);
  assert.equal(first.imported.length, 1);
  assert.equal(first.skipped.length, 0);
  assert.ok(first.batchId);
  assert.equal(afterFirst.length, 1);
  assert.equal(Number(afterFirstBatchCount.c), Number(beforeBatchCount.c) + 1);

  const second = await lib.ingestImageSourcingTask({
    taskRootPath,
    characterId,
    sheetVersionId: initialVersion.id,
    lane: 'accepted',
  });
  const afterSecond = await imageState(lib.db, characterId);
  const afterSecondBatchCount = await get(lib.db, `SELECT COUNT(*) AS c FROM IngestionBatch`);

  assert.equal(second.ok, true);
  assert.equal(second.imported.length, 0);
  assert.equal(second.skipped.length, 1);
  assert.equal(second.skipped[0].reason, 'dup-selection');
  assert.equal(second.batchId, null);
  assert.deepEqual(afterSecond, afterFirst);
  assert.equal(Number(afterSecondBatchCount.c), Number(afterFirstBatchCount.c));
});
