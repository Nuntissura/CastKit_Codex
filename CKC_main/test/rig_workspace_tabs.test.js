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

const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';

function writeTinyPng(absPath) {
  fs.writeFileSync(absPath, Buffer.from(TINY_PNG_B64, 'base64'));
}

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-rig-workspaces-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  t.after(() => lib.close());
  return { libraryRoot, lib };
}

test('rig workspaces: open, activate, reorder, and close without deleting rigs', async (t) => {
  const { libraryRoot, lib } = makeLib(t);
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Workspace Tabs Test' });
  const srcPath = path.join(libraryRoot, 'workspace-source.png');
  writeTinyPng(srcPath);
  const imported = await lib.importImages({ characterId, filePaths: [srcPath, srcPath], duplicatePolicy: 'copy' });
  assert.equal(imported.imported.length, 2);

  const rigA = await lib.createRig({
    characterId,
    portraitImageId: imported.imported[0].id,
    label: 'front workspace',
    calibrationJson: { schemaVersion: 1, yaw: 0 },
  });
  const rigB = await lib.createRig({
    characterId,
    portraitImageId: imported.imported[1].id,
    label: 'side workspace',
    calibrationJson: { schemaVersion: 1, yaw: 30 },
  });

  assert.deepEqual(await lib.listOpenRigs({ characterId }), { ok: true, activeRigId: null, rigs: [] });

  const openedA = await lib.openRigWorkspace({ rigId: rigA.rigId });
  assert.equal(openedA.activeRigId, rigA.rigId);
  assert.deepEqual(openedA.rigs.map((rig) => rig.rigId), [rigA.rigId]);
  assert.equal(openedA.rigs[0].active, true);

  const openedB = await lib.openRigWorkspace({ rigId: rigB.rigId, transientState: { selectedPanel: 'markers' } });
  assert.equal(openedB.activeRigId, rigB.rigId);
  assert.deepEqual(openedB.rigs.map((rig) => rig.rigId), [rigA.rigId, rigB.rigId]);
  assert.equal(openedB.rigs[1].transientState.selectedPanel, 'markers');

  const activatedA = await lib.setActiveRig({ rigId: rigA.rigId });
  assert.equal(activatedA.activeRigId, rigA.rigId);
  assert.equal(activatedA.rigs.find((rig) => rig.rigId === rigA.rigId).active, true);

  const reordered = await lib.reorderOpenRigWorkspaces({ rigIds: [rigB.rigId, rigA.rigId] });
  assert.deepEqual(reordered.rigs.map((rig) => rig.rigId), [rigB.rigId, rigA.rigId]);
  assert.equal(reordered.activeRigId, rigA.rigId);

  const closedA = await lib.closeRigWorkspace({ rigId: rigA.rigId });
  assert.deepEqual(closedA.rigs.map((rig) => rig.rigId), [rigB.rigId]);
  assert.equal(closedA.activeRigId, rigB.rigId);
  assert.equal((await lib.getRig({ rigId: rigA.rigId })).label, 'front workspace');

  const closedB = await lib.closeRigWorkspace({ rigId: rigB.rigId });
  assert.deepEqual(closedB.rigs, []);
  assert.equal(closedB.activeRigId, null);
  assert.equal((await lib.getRig({ rigId: rigB.rigId })).label, 'side workspace');
});
