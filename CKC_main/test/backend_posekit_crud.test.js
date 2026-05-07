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
const { get } = require('../app/backend/db');

function writeTinyPng(absPath) {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=';
  fs.writeFileSync(absPath, Buffer.from(base64, 'base64'));
}

function makeLib(t) {
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-posekit-crud-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return {
    libraryRoot,
    lib: new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null }),
  };
}

test('posekit backend: rigs, prompts, story beats, image notes, and tags share one library', async (t) => {
  const { libraryRoot, lib } = makeLib(t);
  await lib.initialize();

  const characterId = await lib.createCharacter({ displayName: 'Pose Data Test' });
  const srcPath = path.join(libraryRoot, 'posekit-sample.png');
  writeTinyPng(srcPath);
  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  assert.equal(imported.imported.length, 1);
  const imageId = imported.imported[0].id;

  await lib.setImageMeta({ imageId, notes: 'pose note regression', tags: ['posekit', 'sample', 'sample'] });
  const withMeta = await lib.getCharacter(characterId);
  const image = withMeta.images.find((item) => item.id === imageId);
  assert.ok(image);
  assert.equal(image.notes, 'pose note regression');
  assert.deepEqual(image.tags.sort(), ['posekit', 'sample'].sort());

  const createdRig = await lib.createRig({
    characterId,
    portraitImageId: imageId,
    label: 'front rig',
    poseJson: {
      schemaVersion: 1,
      people: [],
      openpose: { version: '1.0', people: [] },
    },
    calibrationJson: { schemaVersion: 1, yaw: 0 },
  });
  assert.equal(createdRig.ok, true);

  const rigs = await lib.listRigs({ characterId });
  assert.equal(rigs.length, 1);
  assert.equal(rigs[0].rigId, createdRig.rigId);
  assert.equal(rigs[0].portraitImageId, imageId);
  assert.equal(rigs[0].label, 'front rig');
  assert.equal(rigs[0].pose.openpose.version, '1.0');

  const rig = await lib.getRig({ rigId: createdRig.rigId });
  assert.ok(rig);
  assert.equal(rig.characterId, characterId);

  await lib.updateRigCalibration({ rigId: createdRig.rigId, calibrationJson: { schemaVersion: 1, yaw: 15 } });
  const updatedRig = await lib.getRig({ rigId: createdRig.rigId });
  assert.equal(updatedRig.calibration.yaw, 15);
  const headPoseResult = await lib.setRigHeadPose({
    rigId: createdRig.rigId,
    headPose: { order: 'YXZ', yaw: 20, pitch: -12, roll: 7, quaternion: [0.1, 0.2, 0.05, 0.97] },
  });
  assert.equal(headPoseResult.ok, true);
  assert.equal(headPoseResult.headPose.order, 'YXZ');
  const headPoseRig = await lib.getRig({ rigId: createdRig.rigId });
  assert.equal(headPoseRig.calibration.headPose.yaw, 20);
  assert.equal(headPoseRig.calibration.headPose.pitch, -12);
  assert.equal(headPoseRig.calibration.headPose.roll, 7);
  assert.equal(headPoseRig.calibration.yaw, 20);
  const derivedHeadPoseResult = await lib.setRigHeadPose({
    rigId: createdRig.rigId,
    headPose: { order: 'YXZ', yaw: -30, pitch: 15, roll: 10 },
  });
  assert.equal(derivedHeadPoseResult.ok, true);
  assert.deepEqual(
    derivedHeadPoseResult.headPose.quaternion.map((n) => Math.round(n * 1000) / 1000),
    [0.103, -0.267, 0.117, 0.951]
  );
  const derivedHeadPoseRig = await lib.getRig({ rigId: createdRig.rigId });
  assert.equal(derivedHeadPoseRig.calibration.headPose.yaw, -30);
  assert.equal(derivedHeadPoseRig.calibration.headPose.pitch, 15);
  assert.equal(derivedHeadPoseRig.calibration.headPose.roll, 10);

  await lib.updateRigPose({
    rigId: createdRig.rigId,
    status: 'ready',
    poseJson: {
      schemaVersion: 1,
      subsystem: 'posekit',
      canvas: { width: 1024, height: 1024 },
      body: [{ id: 'nose', x: 512, y: 180, z: 0, visibility: 1 }],
      face: [],
      handLeft: [],
      handRight: [],
      detector: { status: 'fallback', provider: 'test' },
      openpose: { version: '1.0', people: [], canvas_width: 1024, canvas_height: 1024 },
    },
  });
  const posedRig = await lib.getRig({ rigId: createdRig.rigId });
  assert.equal(posedRig.status, 'ready');
  assert.equal(posedRig.pose.body[0].id, 'nose');
  const sourceImageRow = await get(lib.db, 'SELECT rig_id, pose_json FROM ImageAsset WHERE image_id = ?', [imageId]);
  assert.equal(sourceImageRow.rig_id, createdRig.rigId);
  assert.match(sourceImageRow.pose_json, /"subsystem":"posekit"/);

  const exportResult = await lib.exportOpenposePng({
    rigId: createdRig.rigId,
    pngBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=',
    width: 1024,
    height: 1024,
  });
  assert.equal(exportResult.ok, true);
  assert.equal(exportResult.deduped, false);
  assert.match(exportResult.relativePath, /^images\/openpose\/[a-f0-9]{16}\.png$/);
  assert.equal(fs.existsSync(path.join(lib.getCharacterPaths(characterId).base, exportResult.relativePath.replaceAll('/', path.sep))), true);
  const exportedImage = await get(lib.db, 'SELECT openpose_png_path, rig_id FROM ImageAsset WHERE image_id = ?', [exportResult.imageId]);
  assert.equal(exportedImage.openpose_png_path, exportResult.relativePath);
  assert.equal(exportedImage.rig_id, createdRig.rigId);
  const dedupedExport = await lib.exportOpenposePng({
    rigId: createdRig.rigId,
    pngBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X0XkAAAAASUVORK5CYII=',
    width: 1024,
    height: 1024,
  });
  assert.equal(dedupedExport.deduped, true);
  assert.equal(dedupedExport.imageId, exportResult.imageId);

  const promptResult = await lib.upsertPrompt({
    characterId,
    kind: 'positive',
    title: 'Studio',
    text: 'clean portrait lighting',
    tags: ['lighting', 'portrait'],
  });
  assert.equal(promptResult.ok, true);
  const prompts = await lib.listPrompts({ characterId, kind: 'positive' });
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].text, 'clean portrait lighting');
  assert.deepEqual(prompts[0].tags.sort(), ['lighting', 'portrait'].sort());

  const beatResult = await lib.upsertStoryBeat({
    characterId,
    title: 'Opening',
    body: 'First pose frame',
    promptIds: [promptResult.promptId],
    orderIndex: 1,
  });
  assert.equal(beatResult.ok, true);
  const beats = await lib.listStoryBeats({ characterId });
  assert.equal(beats.length, 1);
  assert.equal(beats[0].title, 'Opening');
  assert.deepEqual(beats[0].promptIds, [promptResult.promptId]);

  await lib.deleteStoryBeat({ beatId: beatResult.beatId });
  assert.equal((await lib.listStoryBeats({ characterId })).length, 0);
  await lib.deletePrompt({ promptId: promptResult.promptId });
  assert.equal((await lib.listPrompts({ characterId })).length, 0);

  lib.close();
});
