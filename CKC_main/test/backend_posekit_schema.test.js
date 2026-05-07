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
const { all } = require('../app/backend/db');

function makeLibraryRoot(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-posekit-schema-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  return libraryRoot;
}

function makeLib(libraryRoot) {
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

test('posekit schema: additive columns and tables initialize idempotently', async (t) => {
  const libraryRoot = makeLibraryRoot(t);
  const lib = makeLib(libraryRoot);
  await lib.initialize();

  const imageColumns = await all(lib.db, "PRAGMA table_info('ImageAsset')");
  const columnNames = new Set(imageColumns.map((row) => row.name));
  for (const name of [
    'pose_json',
    'openpose_png_path',
    'comfyui_workflow_json',
    'comfyui_metadata_json',
    'prompts_json',
    'rig_id',
  ]) {
    assert.equal(columnNames.has(name), true, `ImageAsset missing ${name}`);
  }

  const tableRows = await all(
    lib.db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Rig', 'Prompt', 'StoryBeat', 'RigTag') ORDER BY name"
  );
  assert.deepEqual(tableRows.map((row) => row.name), ['Prompt', 'Rig', 'RigTag', 'StoryBeat']);
  lib.close();

  const reopened = makeLib(libraryRoot);
  await reopened.initialize();
  const rigColumns = await all(reopened.db, "PRAGMA table_info('Rig')");
  const rigColumnNames = new Set(rigColumns.map((row) => row.name));
  assert.equal(rigColumnNames.has('label'), true);
  assert.equal(rigColumnNames.has('status'), true);
  reopened.close();
});
