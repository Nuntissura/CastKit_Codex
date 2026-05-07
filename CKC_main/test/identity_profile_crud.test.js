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
  const libraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-identity-profile-'));
  t.after(() => {
    try {
      fs.rmSync(libraryRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
  const builtInTemplatePath = path.join(__dirname, '..', 'app', 'templates', 'CHARACTER_SHEET__v2.00.txt');
  return new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
}

function face70() {
  return Array.from({ length: 70 }, (_unused, idx) => {
    const angle = (idx / 70) * Math.PI * 2;
    const ring = idx < 17 ? 0.38 : idx < 36 ? 0.24 : 0.15;
    return {
      id: `face_${idx}`,
      x: 512 + Math.cos(angle) * 260 * ring,
      y: 430 + Math.sin(angle) * 320 * ring + (idx === 8 ? 190 : 0),
      z: 0,
      visibility: 1,
      estimated: false,
    };
  });
}

function pngSize(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('identity profiles: create/list/update/delete writes a 512x512 content-hash bundle', async (t) => {
  const lib = makeLib(t);
  await lib.initialize();
  t.after(() => lib.close());

  const characterId = await lib.createCharacter({ displayName: 'Identity Profile Test' });
  const srcPath = path.join(lib.libraryRoot, 'identity-source.png');
  writeTinyPng(srcPath);
  const imported = await lib.importImages({ characterId, filePaths: [srcPath], duplicatePolicy: 'skip' });
  const imageId = imported.imported[0].id;
  const face = face70();
  const createdRig = await lib.createRig({
    characterId,
    portraitImageId: imageId,
    label: 'identity rig',
    poseJson: {
      schemaVersion: 1,
      subsystem: 'posekit',
      characterId,
      portraitImageId: imageId,
      image: { width: 1024, height: 1024 },
      canvas: { width: 1024, height: 1024 },
      body: [],
      face,
      handLeft: [],
      handRight: [],
      detector: { provider: 'test', status: 'detected' },
      openpose: null,
    },
    calibrationJson: { schemaVersion: 1, headPose: { order: 'YXZ', yaw: 12, pitch: -4, roll: 3, quaternion: [0, 0, 0, 1] } },
  });

  const first = await lib.createIdentityProfile({
    characterId,
    sourceImageId: imageId,
    sourceRigId: createdRig.rigId,
    name: 'front_identity',
    description: 'front lit profile',
  });
  assert.equal(first.ok, true);
  assert.match(first.cropRelativePath, /^images\/identity\/[a-f0-9]{16}\.png$/);

  const profiles = await lib.listIdentityProfiles({ characterId });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'front_identity');
  assert.equal(profiles[0].sourceRigId, createdRig.rigId);
  assert.equal(profiles[0].featureMeasurements.interocularPx > 0, true);
  assert.equal(profiles[0].poseMetadata.yawDegAtCapture, 12);

  const cropAbs = path.join(lib.getCharacterPaths(characterId).base, profiles[0].cropRelativePath.replaceAll('/', path.sep));
  assert.equal(fs.existsSync(cropAbs), true);
  assert.deepEqual(pngSize(fs.readFileSync(cropAbs)), { width: 512, height: 512 });

  const second = await lib.createIdentityProfile({
    characterId,
    sourceImageId: imageId,
    sourceRigId: createdRig.rigId,
    name: 'front_identity_copy',
  });
  assert.equal(second.fileHash, first.fileHash);
  assert.equal(second.cropRelativePath, first.cropRelativePath);

  await lib.updateIdentityProfile({ profileId: first.profileId, name: 'front_identity_v2' });
  const updated = await lib.getIdentityProfile({ profileId: first.profileId });
  assert.equal(updated.name, 'front_identity_v2');
  assert.equal(updated.description, 'front lit profile');

  await lib.deleteIdentityProfile({ profileId: first.profileId });
  assert.equal((await lib.listIdentityProfiles({ characterId })).length, 1);
  assert.equal((await lib.getIdentityProfile({ profileId: first.profileId })), null);
  assert.equal((await lib.getIdentityProfile({ profileId: first.profileId, includeDeleted: true })).deletedAt != null, true);
});
