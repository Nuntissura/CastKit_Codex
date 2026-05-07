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
const { listWorkflowSpecs } = require('../app/backend/workflowSpecRegistry');
const { resolveHandler } = require('../app/backend/imageSourcingAdapter');

const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  });
  return dir;
}

function makeTaskRoot(t, specVersion) {
  const root = makeTempDir(t, 'ckc-spec-canon-');
  const taskId = `task_${specVersion.replace(/[^0-9A-Za-z]+/g, '_')}`;
  const taskRoot = path.join(root, taskId);
  const acceptedDir = path.join(taskRoot, 'intake', 'accepted');
  fs.mkdirSync(acceptedDir, { recursive: true });
  fs.writeFileSync(path.join(acceptedDir, 'canon-sample.png'), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  ));
  fs.writeFileSync(
    path.join(taskRoot, `${taskId}.task_state.yaml`),
    [`dataset_id: dataset_${taskId}`, `task_id: ${taskId}`, `spec_version: ${specVersion}`, ''].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(taskRoot, `${taskId}.task_topology.yaml`),
    ['folders:', '  intake_accepted: intake/accepted', ''].join('\n'),
    'utf8'
  );
  fs.writeFileSync(path.join(taskRoot, `${taskId}.task_requirements.yaml`), 'dry_run: true\n', 'utf8');
  return taskRoot;
}

test('workflow specs and ingestion adapter agree on accepted task artifacts', async (t) => {
  const registry = listWorkflowSpecs();
  assert.equal(registry.ok, true);
  assert.equal(registry.errors.length, 0);

  const libraryRoot = makeTempDir(t, 'ckc-spec-canon-lib-');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.initialize();
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'Spec Canon' });
  const sheetVersion = (await lib.listVersions(characterId)).find((v) => v.source === 'import');
  assert.ok(sheetVersion);

  for (const spec of registry.specs) {
    const handler = resolveHandler(spec.specVersion);
    const taskRootPath = makeTaskRoot(t, spec.specVersion);
    const plan = handler.buildIngestionPlan({ taskRootPath, lane: 'accepted' });
    assert.equal(plan.specVersion, spec.specVersion);
    assert.equal(plan.items.length, 1);

    const dryRun = await lib.ingestImageSourcingTask({
      taskRootPath,
      characterId,
      sheetVersionId: sheetVersion.id,
      lane: 'accepted',
      dryRun: true,
    });
    assert.equal(dryRun.ok, true);
    assert.equal(dryRun.specVersion, spec.specVersion);
    assert.equal(dryRun.imported.length, 1);
    assert.equal(dryRun.batchId, null);
  }
});
